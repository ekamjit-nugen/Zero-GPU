import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Send,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  Bot,
  User,
  Loader2,
  Square,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ModelMeta, ChatMessageEntry } from "../types";

interface ChatTokenEvent {
  token: string;
  done: boolean;
  tok_s: number;
  tokens_generated: number;
  prompt_tok_s: number;
}

interface LocalConversation {
  id: string;
  title: string;
  model_id: string;
  messages: ChatMessageEntry[];
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3).split("\n");
      const lang = lines[0];
      const code = lines.slice(1).join("\n");
      return (
        <pre
          key={i}
          className="bg-[#0c0c0e] border border-[#1f1f23] rounded-xl p-4 my-3 overflow-x-auto"
        >
          {lang && (
            <div className="text-[10px] text-[#52525B] mb-2 uppercase tracking-widest font-medium">
              {lang}
            </div>
          )}
          <code className="text-xs text-[#A1A1AA] font-mono leading-relaxed">
            {code}
          </code>
        </pre>
      );
    }
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={i}>
        {boldParts.map((bp, j) =>
          bp.startsWith("**") && bp.endsWith("**") ? (
            <strong key={j} className="font-semibold text-[#FAFAFA]">
              {bp.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{bp}</span>
          )
        )}
      </span>
    );
  });
}

export default function RunPage() {
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(40);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assistant."
  );
  const [generating, setGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentTokS, setCurrentTokS] = useState(0);
  const [currentTokenCount, setCurrentTokenCount] = useState(0);
  const [lastGenTokS, setLastGenTokS] = useState(0);
  const [lastPromptTokS, setLastPromptTokS] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load models from library
  useEffect(() => {
    invoke<ModelMeta[]>("get_models")
      .then((m) => {
        // Fix: the backend returns Result, handle both shapes
        const modelList = Array.isArray(m) ? m : [];
        setModels(modelList);
        if (modelList.length > 0 && !selectedModelId) {
          setSelectedModelId(modelList[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Listen for streaming tokens
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<ChatTokenEvent>("chat-token", (event) => {
      const { token, done, tok_s, tokens_generated, prompt_tok_s } =
        event.payload;

      if (done) {
        // Finalize the assistant message
        setGenerating(false);
        setLastGenTokS(tok_s);
        setLastPromptTokS(prompt_tok_s);
        setCurrentTokS(tok_s);

        setStreamingContent((prev) => {
          const finalContent = prev;
          // Add the completed message to the conversation
          setConversations((convs) =>
            convs.map((c) => {
              if (c.id !== activeId) return c; // use closure
              // Remove the streaming placeholder if exists, add final
              const filtered = c.messages.filter(
                (m) => m.id !== "streaming"
              );
              return {
                ...c,
                messages: [
                  ...filtered,
                  {
                    id: `m${Date.now()}`,
                    role: "assistant" as const,
                    content: finalContent,
                    timestamp: new Date().toISOString(),
                    tokens: tokens_generated,
                    tok_s: tok_s,
                  },
                ],
              };
            })
          );
          return "";
        });
      } else {
        setStreamingContent((prev) => prev + token);
        setCurrentTokS(tok_s);
        setCurrentTokenCount(tokens_generated);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [activeId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingContent, conversations]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const messages = activeConversation?.messages ?? [];
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedModel = models.find((m) => m.id === selectedModelId);

  const handleSend = useCallback(async () => {
    if (!input.trim() || generating) return;
    if (!selectedModelId) {
      setError("No model selected. Optimize a model first.");
      return;
    }

    const userMsg: ChatMessageEntry = {
      id: `m${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
      tokens: input.split(/\s+/).length,
    };

    // Create conversation if needed
    let convId = activeId;
    if (!convId) {
      const newConvo: LocalConversation = {
        id: `conv-${Date.now()}`,
        title: input.trim().slice(0, 40) + (input.length > 40 ? "..." : ""),
        model_id: selectedModelId,
        messages: [],
      };
      convId = newConvo.id;
      setConversations((prev) => [newConvo, ...prev]);
      setActiveId(convId);
    }

    // Add user message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages, userMsg] } : c
      )
    );

    const prompt = input.trim();
    setInput("");
    setGenerating(true);
    setStreamingContent("");
    setCurrentTokS(0);
    setCurrentTokenCount(0);
    setError(null);

    try {
      await invoke("send_chat_message", {
        modelId: selectedModelId,
        prompt,
        systemPrompt,
        temperature,
        topP,
        topK,
        maxTokens,
      });
    } catch (e) {
      setError(`Inference error: ${e}`);
      setGenerating(false);
    }
  }, [
    input,
    generating,
    selectedModelId,
    activeId,
    systemPrompt,
    temperature,
    topP,
    topK,
    maxTokens,
  ]);

  const handleNewChat = () => {
    const newConvo: LocalConversation = {
      id: `conv-${Date.now()}`,
      title: "New Chat",
      model_id: selectedModelId,
      messages: [],
    };
    setConversations((prev) => [newConvo, ...prev]);
    setActiveId(newConvo.id);
  };

  const tokenCount = input.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-full bg-[#09090b]">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#0c0c0e] border-r border-[#1f1f23] flex flex-col shrink-0">
        <div className="p-4 space-y-3">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-[#6366F1] to-[#5B5BD6] rounded-lg hover:from-[#818CF8] hover:to-[#6366F1] transition-all duration-200 shadow-lg shadow-[#6366F1]/10"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#09090b] border border-[#1f1f23] rounded-lg text-[#A1A1AA] placeholder:text-[#52525B] focus:outline-none focus:border-[#6366F1]/50 focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {filteredConversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs text-left transition-all duration-150 group",
                c.id === activeId
                  ? "text-[#FAFAFA] border-l-2 border-[#6366F1] bg-[#6366F1]/5 pl-2.5"
                  : "text-[#A1A1AA] hover:bg-[#FAFAFA]/[0.03] hover:text-[#FAFAFA] border-l-2 border-transparent pl-2.5"
              )}
            >
              <MessageSquare className={cn(
                "w-3.5 h-3.5 shrink-0 transition-colors",
                c.id === activeId ? "text-[#818CF8]" : "text-[#52525B] group-hover:text-[#A1A1AA]"
              )} />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="flex flex-col items-center py-8 px-4">
              <MessageSquare className="w-5 h-5 text-[#52525B]/50 mb-2" />
              <p className="text-[11px] text-[#52525B] text-center">
                No conversations yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        {/* No model warning */}
        {models.length === 0 && (
          <div className="mx-6 mt-4 p-3.5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-yellow-400/80 shrink-0" />
            <span className="text-xs text-yellow-400/80">
              No optimized models found. Go to the Optimize tab to optimize a
              model first.
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-[#141417] border border-[#1f1f23] flex items-center justify-center mb-5">
                <Sparkles className="w-7 h-7 text-[#6366F1]/60" />
              </div>
              <p className="text-base font-medium text-[#FAFAFA]/80 mb-1.5">
                Start a conversation
              </p>
              <p className="text-xs text-[#52525B] max-w-xs text-center leading-relaxed">
                Send a message to begin chatting with your local model
              </p>
              {selectedModel && (
                <div className="mt-4 px-3.5 py-1.5 rounded-full bg-[#141417] border border-[#1f1f23]">
                  <p className="text-[11px] text-[#A1A1AA]">
                    {selectedModel.name}{" "}
                    <span className="text-[#52525B]">
                      ({selectedModel.quantization})
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3.5 max-w-2xl animate-fade-in",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-[#6366F1] to-[#5B5BD6]"
                    : "bg-[#141417] border border-[#1f1f23]"
                )}
              >
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-[#818CF8]" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-[#6366F1] to-[#5B5BD6] text-white shadow-lg shadow-[#6366F1]/10"
                    : "bg-[#141417] text-[#A1A1AA] border border-[#1f1f23] border-l-2 border-l-[#6366F1]/30"
                )}
              >
                <div className="whitespace-pre-wrap">
                  {renderContent(msg.content)}
                </div>
                {msg.role === "assistant" && (msg.tok_s || msg.tokens) && (
                  <div className="mt-2.5 pt-2 border-t border-[#1f1f23] flex items-center gap-3 text-[10px] text-[#52525B]">
                    {msg.tok_s ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                        <span className="text-emerald-400/80 font-medium">
                          {msg.tok_s.toFixed(1)} tok/s
                        </span>
                      </span>
                    ) : null}
                    {msg.tokens ? <span>{msg.tokens} tokens</span> : null}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {(generating || streamingContent) && (
            <div className="flex gap-3.5 max-w-2xl mr-auto animate-fade-in">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-[#141417] border border-[#1f1f23]">
                {generating && !streamingContent ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#818CF8] animate-spin" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-[#818CF8]" />
                )}
              </div>
              <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#141417] text-[#A1A1AA] border border-[#1f1f23] border-l-2 border-l-[#6366F1]/30">
                {streamingContent ? (
                  <div className="whitespace-pre-wrap">
                    {renderContent(streamingContent)}
                    {generating && (
                      <span className="inline-block w-[3px] h-[18px] bg-[#818CF8] ml-0.5 rounded-full animate-pulse" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 text-[#52525B]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#818CF8]" />
                    <span className="text-xs">Loading model...</span>
                  </div>
                )}
                {generating && currentTokS > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#1f1f23] flex items-center gap-3 text-[10px] text-[#52525B]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
                      <span className="text-emerald-400/80 font-medium">
                        {currentTokS.toFixed(1)} tok/s
                      </span>
                    </span>
                    <span>{currentTokenCount} tokens</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3.5 bg-red-500/5 border border-red-500/10 rounded-xl max-w-2xl animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0" />
              <span className="text-xs text-red-400/80">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 pb-5 pt-2">
          <div className="relative bg-[#141417]/80 backdrop-blur-xl border border-[#1f1f23] rounded-xl shadow-2xl shadow-black/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                models.length === 0
                  ? "Optimize a model first..."
                  : "Type a message..."
              }
              disabled={models.length === 0}
              rows={1}
              className="w-full px-4 py-3.5 pr-24 text-sm bg-transparent text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none resize-none disabled:opacity-40"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-2">
              <span className="text-[10px] text-[#52525B] tabular-nums mr-1">
                ~{tokenCount} tokens
              </span>
              <button
                onClick={handleSend}
                disabled={generating || !input.trim() || models.length === 0}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200 shrink-0",
                  generating
                    ? "bg-red-500/90 hover:bg-red-500 shadow-lg shadow-red-500/20"
                    : "bg-gradient-to-r from-[#6366F1] to-[#5B5BD6] hover:from-[#818CF8] hover:to-[#6366F1] shadow-lg shadow-[#6366F1]/20",
                  (!input.trim() || models.length === 0) &&
                    !generating &&
                    "opacity-30 cursor-not-allowed shadow-none"
                )}
              >
                {generating ? (
                  <Square className="w-4 h-4 text-white" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel Toggle */}
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="absolute right-0 top-14 p-2 text-[#52525B] hover:text-[#A1A1AA] z-10 transition-colors"
        style={rightPanelOpen ? { right: "18rem" } : { right: 0 }}
      >
        {rightPanelOpen ? (
          <PanelRightClose className="w-4 h-4" />
        ) : (
          <PanelRightOpen className="w-4 h-4" />
        )}
      </button>

      {/* Right Panel */}
      {rightPanelOpen && (
        <div className="w-72 bg-[#0c0c0e] border-l border-[#1f1f23] p-5 space-y-0 overflow-y-auto shrink-0">
          {/* Model Selector */}
          <div className="space-y-2 pb-5 border-b border-[#1f1f23]">
            <label className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">
              Model
            </label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-[#09090b] border border-[#1f1f23] rounded-xl text-[#A1A1AA] focus:outline-none focus:border-[#6366F1]/50 focus:ring-1 focus:ring-[#6366F1]/20 transition-all appearance-none cursor-pointer"
            >
              {models.length === 0 && (
                <option value="">No models — optimize one first</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.quantization})
                </option>
              ))}
            </select>
          </div>

          {/* System Prompt */}
          <div className="space-y-2 py-5 border-b border-[#1f1f23]">
            <label className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-xs bg-[#09090b] border border-[#1f1f23] rounded-xl text-[#A1A1AA] focus:outline-none focus:border-[#6366F1]/50 focus:ring-1 focus:ring-[#6366F1]/20 resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Parameters */}
          <div className="py-5 space-y-4 border-b border-[#1f1f23]">
            <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">
              Parameters
            </p>
            <SliderControl
              label="Temperature"
              value={temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={setTemperature}
            />
            <SliderControl
              label="Top-P"
              value={topP}
              min={0}
              max={1}
              step={0.05}
              onChange={setTopP}
            />
            <SliderControl
              label="Top-K"
              value={topK}
              min={0}
              max={100}
              step={1}
              onChange={setTopK}
            />
            <SliderControl
              label="Max Tokens"
              value={maxTokens}
              min={128}
              max={8192}
              step={64}
              onChange={setMaxTokens}
            />
          </div>

          {/* Live Stats */}
          <div className="pt-5 space-y-3">
            <p className="text-[10px] font-semibold text-[#52525B] uppercase tracking-widest">
              Performance
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400/70" />
                  <span className="text-[11px] text-[#A1A1AA]">Gen Speed</span>
                </div>
                <span className="text-xs font-mono text-emerald-400/90 tabular-nums">
                  {generating
                    ? `${currentTokS.toFixed(1)} tok/s`
                    : lastGenTokS > 0
                    ? `${lastGenTokS.toFixed(1)} tok/s`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400/70" />
                  <span className="text-[11px] text-[#A1A1AA]">
                    Prompt Speed
                  </span>
                </div>
                <span className="text-xs font-mono text-blue-400/90 tabular-nums">
                  {lastPromptTokS > 0
                    ? `${lastPromptTokS.toFixed(1)} tok/s`
                    : "—"}
                </span>
              </div>
              {generating && (
                <div className="flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#818CF8]/70 animate-pulse" />
                    <span className="text-[11px] text-[#A1A1AA]">Tokens</span>
                  </div>
                  <span className="text-xs font-mono text-[#FAFAFA]/70 tabular-nums">
                    {currentTokenCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-[#A1A1AA]">{label}</label>
        <span className="text-[11px] font-mono text-[#FAFAFA]/60 tabular-nums bg-[#09090b] px-2 py-0.5 rounded-md border border-[#1f1f23]">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#1f1f23] rounded-full appearance-none cursor-pointer accent-[#6366F1] [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#6366F1] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#6366F1]/30"
      />
    </div>
  );
}
