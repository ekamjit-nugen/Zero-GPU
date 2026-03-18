import { useState } from "react";
import {
  Server,
  Copy,
  Check,
  Activity,
  Globe,
} from "lucide-react";
import { cn } from "../lib/utils";

const MOCK_LOGS = [
  { timestamp: "10:05:12", method: "POST", path: "/v1/chat/completions", status: 200, latency: "142ms" },
  { timestamp: "10:04:58", method: "GET", path: "/v1/models", status: 200, latency: "3ms" },
  { timestamp: "10:04:30", method: "POST", path: "/v1/chat/completions", status: 200, latency: "238ms" },
  { timestamp: "10:03:15", method: "POST", path: "/v1/chat/completions", status: 400, latency: "2ms" },
  { timestamp: "10:02:01", method: "GET", path: "/v1/models", status: 200, latency: "1ms" },
  { timestamp: "10:01:45", method: "POST", path: "/v1/completions", status: 200, latency: "189ms" },
];

function CopyButton({ text, overlay }: { text: string; overlay?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-md transition-all duration-200",
        overlay
          ? "absolute top-2.5 right-2.5 bg-[#1f1f23]/80 backdrop-blur-sm border border-[#2a2a30]/60 text-[#52525B] hover:text-[#FAFAFA] hover:border-[#6366F1]/40"
          : "text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#1f1f23]"
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-[#1f1f23]">
      {icon}
      <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-tight">
        {title}
      </h3>
      {badge}
    </div>
  );
}

function CurlHighlighted({
  endpoint,
  selectedModel,
}: {
  endpoint: string;
  selectedModel: string;
}) {
  return (
    <>
      <span className="text-[#818CF8]">curl</span>{" "}
      <span className="text-emerald-400">{endpoint}</span>{" "}
      <span className="text-[#A1A1AA]">\</span>
      {"\n"}
      {"  "}<span className="text-[#818CF8]">-H</span>{" "}
      <span className="text-amber-300">"Content-Type: application/json"</span>{" "}
      <span className="text-[#A1A1AA]">\</span>
      {"\n"}
      {"  "}<span className="text-[#818CF8]">-d</span>{" "}
      <span className="text-amber-300">{"'"}</span>
      <span className="text-[#A1A1AA]">{"{"}</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">"model"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-emerald-400">"{selectedModel}"</span>
      <span className="text-[#A1A1AA]">,</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">"messages"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-[#A1A1AA]">[{"{"}</span>
      <span className="text-[#818CF8]">"role"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-emerald-400">"user"</span>
      <span className="text-[#A1A1AA]">,</span>{" "}
      <span className="text-[#818CF8]">"content"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-emerald-400">"Hello!"</span>
      <span className="text-[#A1A1AA]">{"}]"}</span>
      <span className="text-[#A1A1AA]">,</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">"temperature"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-orange-300">0.7</span>
      {"\n"}
      {"  "}<span className="text-[#A1A1AA]">{"}"}</span>
      <span className="text-amber-300">{"'"}</span>
    </>
  );
}

function PythonHighlighted({
  port,
  selectedModel,
}: {
  port: string;
  selectedModel: string;
}) {
  return (
    <>
      <span className="text-[#818CF8]">from</span>{" "}
      <span className="text-[#FAFAFA]">openai</span>{" "}
      <span className="text-[#818CF8]">import</span>{" "}
      <span className="text-emerald-400">OpenAI</span>
      {"\n\n"}
      <span className="text-[#FAFAFA]">client</span>{" "}
      <span className="text-[#A1A1AA]">=</span>{" "}
      <span className="text-emerald-400">OpenAI</span>
      <span className="text-[#A1A1AA]">(</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">base_url</span>
      <span className="text-[#A1A1AA]">=</span>
      <span className="text-amber-300">"http://localhost:{port}/v1"</span>
      <span className="text-[#A1A1AA]">,</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">api_key</span>
      <span className="text-[#A1A1AA]">=</span>
      <span className="text-amber-300">"not-needed"</span>
      {"\n"}
      <span className="text-[#A1A1AA]">)</span>
      {"\n\n"}
      <span className="text-[#FAFAFA]">response</span>{" "}
      <span className="text-[#A1A1AA]">=</span>{" "}
      <span className="text-[#FAFAFA]">client</span>
      <span className="text-[#A1A1AA]">.</span>
      <span className="text-[#FAFAFA]">chat</span>
      <span className="text-[#A1A1AA]">.</span>
      <span className="text-[#FAFAFA]">completions</span>
      <span className="text-[#A1A1AA]">.</span>
      <span className="text-emerald-400">create</span>
      <span className="text-[#A1A1AA]">(</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">model</span>
      <span className="text-[#A1A1AA]">=</span>
      <span className="text-amber-300">"{selectedModel}"</span>
      <span className="text-[#A1A1AA]">,</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">messages</span>
      <span className="text-[#A1A1AA]">=</span>
      <span className="text-[#A1A1AA]">[{"{"}</span>
      <span className="text-amber-300">"role"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-amber-300">"user"</span>
      <span className="text-[#A1A1AA]">,</span>{" "}
      <span className="text-amber-300">"content"</span>
      <span className="text-[#A1A1AA]">:</span>{" "}
      <span className="text-amber-300">"Hello!"</span>
      <span className="text-[#A1A1AA]">{"}]"}</span>
      <span className="text-[#A1A1AA]">,</span>
      {"\n"}
      {"    "}<span className="text-[#818CF8]">temperature</span>
      <span className="text-[#A1A1AA]">=</span>
      <span className="text-orange-300">0.7</span>
      {"\n"}
      <span className="text-[#A1A1AA]">)</span>
      {"\n"}
      <span className="text-[#818CF8]">print</span>
      <span className="text-[#A1A1AA]">(</span>
      <span className="text-[#FAFAFA]">response</span>
      <span className="text-[#A1A1AA]">.</span>
      <span className="text-[#FAFAFA]">choices</span>
      <span className="text-[#A1A1AA]">[</span>
      <span className="text-orange-300">0</span>
      <span className="text-[#A1A1AA]">].</span>
      <span className="text-[#FAFAFA]">message</span>
      <span className="text-[#A1A1AA]">.</span>
      <span className="text-[#FAFAFA]">content</span>
      <span className="text-[#A1A1AA]">)</span>
    </>
  );
}

export default function ServerPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [port, setPort] = useState("8421");
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-q4km");

  const endpoint = `http://localhost:${port}/v1/chat/completions`;

  const curlCommand = `curl ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "temperature": 0.7
  }'`;

  const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:${port}/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="${selectedModel}",
    messages=[{"role": "user", "content": "Hello!"}],
    temperature=0.7
)
print(response.choices[0].message.content)`;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Server Status */}
        <div className="glass-card rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                  isRunning
                    ? "bg-gradient-to-br from-[#6366F1]/20 to-[#818CF8]/10 shadow-[0_0_16px_rgba(99,102,241,0.1)]"
                    : "bg-[#1f1f23]"
                )}
              >
                <Server
                  className={cn(
                    "w-5 h-5 transition-colors duration-300",
                    isRunning ? "text-[#818CF8]" : "text-[#52525B]"
                  )}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#FAFAFA] tracking-tight">
                    Local Server
                  </h3>
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-500",
                      isRunning
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse-soft"
                        : "bg-[#52525B]"
                    )}
                  />
                </div>
                <p className="text-xs text-[#52525B] mt-0.5">
                  {isRunning
                    ? `Running on port ${port}`
                    : "Stopped"}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "relative w-12 h-7 rounded-full transition-all duration-300 ease-in-out",
                isRunning
                  ? "bg-gradient-to-r from-[#6366F1] to-[#818CF8] shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                  : "bg-[#1f1f23] border border-[#2a2a30]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-300 ease-in-out",
                  isRunning
                    ? "translate-x-5 bg-white shadow-md"
                    : "translate-x-0 bg-[#52525B]"
                )}
              />
            </button>
          </div>

          {/* Config */}
          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[#1f1f23]">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#52525B] uppercase tracking-wider">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0c0c0e] border border-[#1f1f23] rounded-lg text-[#A1A1AA] focus:outline-none focus:border-[#6366F1]/50 focus:ring-1 focus:ring-[#6366F1]/20 transition-all duration-200"
              >
                <option value="llama-3.1-8b-q4km">Llama-3.1-8B-Q4_K_M</option>
                <option value="mistral-7b-q5km">Mistral-7B-Q5_K_M</option>
                <option value="phi-3-mini-q8">Phi-3-mini-Q8_0</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#52525B] uppercase tracking-wider">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0c0c0e] border border-[#1f1f23] rounded-lg text-[#A1A1AA] focus:outline-none focus:border-[#6366F1]/50 focus:ring-1 focus:ring-[#6366F1]/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="glass-card rounded-xl p-5 space-y-4 animate-fade-in" style={{ animationDelay: "60ms" }}>
          <SectionHeader
            icon={<Globe className="w-4 h-4 text-[#6366F1]" />}
            title="Connection Info"
            badge={
              <span className="ml-auto text-[10px] font-medium text-[#818CF8]/80 bg-[#6366F1]/10 border border-[#6366F1]/15 px-2 py-0.5 rounded-full tracking-wide">
                OpenAI Compatible
              </span>
            }
          />

          {/* Endpoint */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#52525B] uppercase tracking-wider">
              Endpoint
            </label>
            <div className="flex items-center bg-[#0c0c0e] border border-[#1f1f23] rounded-lg overflow-hidden">
              <code className="flex-1 px-3 py-2.5 text-xs text-[#A1A1AA] font-mono truncate">
                {endpoint}
              </code>
              <div className="pr-1.5">
                <CopyButton text={endpoint} />
              </div>
            </div>
          </div>

          {/* Curl */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#52525B] uppercase tracking-wider">
              curl
            </label>
            <div className="relative group">
              <pre className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg p-3.5 pr-10 text-xs font-mono overflow-x-auto leading-relaxed">
                <CurlHighlighted endpoint={endpoint} selectedModel={selectedModel} />
              </pre>
              <CopyButton text={curlCommand} overlay />
            </div>
          </div>

          {/* Python */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#52525B] uppercase tracking-wider">
              Python
            </label>
            <div className="relative group">
              <pre className="bg-[#0c0c0e] border border-[#1f1f23] rounded-lg p-3.5 pr-10 text-xs font-mono overflow-x-auto leading-relaxed">
                <PythonHighlighted port={port} selectedModel={selectedModel} />
              </pre>
              <CopyButton text={pythonCode} overlay />
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="glass-card rounded-xl p-5 animate-fade-in" style={{ animationDelay: "120ms" }}>
          <SectionHeader
            icon={<Activity className="w-4 h-4 text-[#6366F1]" />}
            title="Activity Log"
          />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#52525B] text-left">
                  <th className="pb-3 font-medium text-[11px] uppercase tracking-wider">Time</th>
                  <th className="pb-3 font-medium text-[11px] uppercase tracking-wider">Method</th>
                  <th className="pb-3 font-medium text-[11px] uppercase tracking-wider">Path</th>
                  <th className="pb-3 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  <th className="pb-3 font-medium text-[11px] uppercase tracking-wider text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="text-[#A1A1AA]">
                {MOCK_LOGS.map((log, i) => (
                  <tr
                    key={i}
                    className="border-t border-[#1f1f23]/50 transition-colors duration-150 hover:bg-[#1f1f23]/30"
                  >
                    <td className="py-2.5 font-mono text-[#52525B]">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide",
                          log.method === "POST"
                            ? "bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/15"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        )}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[#A1A1AA]">{log.path}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 font-mono text-xs",
                          log.status === 200
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            log.status === 200 ? "bg-emerald-400" : "bg-red-400"
                          )}
                        />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[#52525B]">
                      {log.latency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
