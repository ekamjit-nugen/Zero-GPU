import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  FileBox,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  Sparkles,
  HardDrive,
  Zap,
  AlertCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { HardwareInfo } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const STAGE_ORDER = [
  "import",
  "hardware",
  "quantize",
  "spec_decode",
  "compile",
  "benchmark",
  "done",
];

const STAGE_LABELS: Record<string, string> = {
  import: "Import",
  hardware: "Hardware",
  quantize: "Quantize",
  spec_decode: "Spec. Decode",
  compile: "Compile",
  benchmark: "Benchmark",
  done: "Done",
};

interface ModelFileInfo {
  name: string;
  path: string;
  size: string;
  format: string;
}

interface PipelineProgressEvent {
  stage: string;
  progress_percent: number;
  message: string;
  log_line: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824)
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function OptimizePage() {
  const [dragOver, setDragOver] = useState(false);
  const [modelFile, setModelFile] = useState<ModelFileInfo | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [hwLoading, setHwLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [currentStage, setCurrentStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [benchResults, setBenchResults] = useState<{
    gen_tok_s: number;
    prompt_tok_s: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logsExpanded]);

  // Listen to optimization progress events from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<PipelineProgressEvent>("optimization-progress", (event) => {
      const { stage, progress_percent, message, log_line } = event.payload;

      setCurrentStage(stage);
      setProgress(progress_percent);
      setStatusMessage(message);

      if (log_line) {
        setLogs((prev) => [...prev, log_line]);
      }

      if (stage === "done") {
        setCompleted(true);
        setOptimizing(false);
      }

      if (stage === "failed") {
        setFailed(true);
        setOptimizing(false);
      }

      // Extract benchmark results from messages
      if (
        stage === "benchmark" &&
        message.includes("tok/s")
      ) {
        const genMatch = message.match(/Generation:\s*([\d.]+)\s*tok\/s/);
        const promptMatch = message.match(/Prompt:\s*([\d.]+)\s*tok\/s/);
        if (genMatch || promptMatch) {
          setBenchResults({
            gen_tok_s: genMatch ? parseFloat(genMatch[1]) : 0,
            prompt_tok_s: promptMatch ? parseFloat(promptMatch[1]) : 0,
          });
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const fetchHardware = useCallback(async () => {
    setHwLoading(true);
    try {
      const hw = await invoke<HardwareInfo>("get_hardware_info");
      setHardware(hw);
    } catch (e) {
      console.error("Failed to detect hardware:", e);
    } finally {
      setHwLoading(false);
    }
  }, []);

  const loadModelFile = useCallback(
    (name: string, path: string, size: number) => {
      const isGguf = name.toLowerCase().endsWith(".gguf");
      const isSafetensors = name.toLowerCase().endsWith(".safetensors");
      const isBlob = !name.includes("."); // Ollama blobs have no extension

      if (!isGguf && !isSafetensors && !isBlob) {
        setError(
          "Unsupported format. Please select a .gguf or .safetensors file."
        );
        return;
      }

      setModelFile({
        name: isBlob ? name : name.replace(/\.(gguf|safetensors)$/i, ""),
        path: path || name,
        size: size > 0 ? formatBytes(size) : "Calculating...",
        format: isGguf ? "GGUF" : isSafetensors ? "SafeTensors" : "GGUF (Ollama)",
      });
      setError(null);

      if (!hardware) fetchHardware();
    },
    [hardware, fetchHardware]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        const filePath =
          (file as unknown as { path?: string }).path || file.name;
        loadModelFile(file.name, filePath, file.size);
      }
    },
    [loadModelFile]
  );

  const handleBrowseClick = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Model Files",
            extensions: ["gguf", "safetensors"],
          },
        ],
      });
      if (selected) {
        const path =
          typeof selected === "string" ? selected : String(selected);
        const name = path.split("/").pop() || path.split("\\").pop() || path;
        loadModelFile(name, path, 0);
        return;
      }
    } catch (e) {
      console.warn("Tauri dialog failed, falling back to file input:", e);
    }
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const filePath =
        (file as unknown as { path?: string }).path ||
        (file as unknown as { webkitRelativePath?: string })
          .webkitRelativePath ||
        file.name;
      loadModelFile(file.name, filePath, file.size);
    }
    e.target.value = "";
  };

  const clearModel = () => {
    setModelFile(null);
    setHardware(null);
    setOptimizing(false);
    setCompleted(false);
    setFailed(false);
    setCurrentStage("");
    setProgress(0);
    setStatusMessage("");
    setLogs([]);
    setError(null);
    setBenchResults(null);
  };

  const startOptimize = async () => {
    if (!modelFile) return;

    setOptimizing(true);
    setCompleted(false);
    setFailed(false);
    setCurrentStage("import");
    setProgress(0);
    setLogs([]);
    setBenchResults(null);
    setError(null);

    try {
      const modelId = await invoke<string>("start_optimization", {
        modelPath: modelFile.path,
      });
      setLogs((l) => [
        ...l,
        `[INFO] Model saved to library with ID: ${modelId}`,
      ]);
    } catch (e) {
      setLogs((l) => [...l, `[ERROR] Optimization failed: ${e}`]);
      setFailed(true);
      setOptimizing(false);
    }
  };

  const currentStageIdx = STAGE_ORDER.indexOf(currentStage);

  const chartData = benchResults
    ? {
        labels: ["Generation (tok/s)", "Prompt Processing (tok/s)"],
        datasets: [
          {
            label: "Optimized",
            data: [benchResults.gen_tok_s, benchResults.prompt_tok_s],
            backgroundColor: "rgba(99, 102, 241, 0.7)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    indexAxis: "y" as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: { color: "#a1a1aa" },
        grid: { color: "#1f1f23" },
        title: { display: true, text: "tokens/second", color: "#52525B" },
      },
      y: { ticks: { color: "#a1a1aa" }, grid: { display: false } },
    },
  };

  return (
    <div className="h-full overflow-y-auto p-8" style={{ backgroundColor: "#09090b" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gguf,.safetensors"
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        {!optimizing && !modelFile && !completed && (
          <div className="animate-fade-in text-center space-y-3 pt-6 pb-1">
            <div className="flex items-center justify-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#6366F1]" />
              </div>
              <h1 className="text-base font-semibold text-[#FAFAFA] tracking-tight">
                Optimize Your Model
              </h1>
            </div>
            <p className="text-xs text-[#52525B] max-w-sm mx-auto leading-relaxed">
              Drop a GGUF or SafeTensors model to auto-detect hardware,
              quantize, and benchmark — all in one click.
            </p>
          </div>
        )}

        {/* Drop Zone */}
        {!modelFile && !optimizing && !completed && (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
              }}
              onDrop={handleDrop}
              onClick={handleBrowseClick}
              className={cn(
                "animate-fade-in relative group flex flex-col items-center justify-center gap-5 py-16 px-10 border border-dashed rounded-xl transition-all duration-300 cursor-pointer",
                dragOver
                  ? "border-[#6366F1] bg-[#6366F1]/[0.06] scale-[1.005]"
                  : "border-[#1f1f23] bg-gradient-to-b from-[#141417] to-[#0f0f12] hover:border-[#2a2a30] hover:from-[#161619] hover:to-[#111114]"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500",
                  dragOver ? "opacity-100" : "group-hover:opacity-60"
                )}
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.05) 0%, transparent 65%)",
                }}
              />

              <div
                className={cn(
                  "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  dragOver
                    ? "bg-[#6366F1]/15 scale-105"
                    : "bg-[#6366F1]/[0.07] group-hover:bg-[#6366F1]/10 group-hover:scale-[1.03]"
                )}
              >
                <Upload
                  className={cn(
                    "w-5 h-5 transition-colors duration-300",
                    dragOver
                      ? "text-[#818CF8]"
                      : "text-[#6366F1]/50 group-hover:text-[#6366F1]/80"
                  )}
                />
              </div>

              <div className="relative text-center space-y-1">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors",
                    dragOver ? "text-[#FAFAFA]" : "text-[#A1A1AA]"
                  )}
                >
                  {dragOver
                    ? "Release to load model"
                    : "Drop your model here"}
                </p>
                <p className="text-[11px] text-[#52525B]">
                  Supports{" "}
                  <span className="text-[#A1A1AA]/70 font-mono text-[10px]">.gguf</span>{" "}
                  and{" "}
                  <span className="text-[#A1A1AA]/70 font-mono text-[10px]">.safetensors</span>{" "}
                  formats
                </p>
              </div>

              <div className="relative flex items-center gap-3">
                <div className="h-px w-10 bg-[#1f1f23]" />
                <span className="text-[10px] text-[#52525B] uppercase tracking-widest font-medium">
                  or
                </span>
                <div className="h-px w-10 bg-[#1f1f23]" />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBrowseClick();
                }}
                className="relative flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1a1a1f] hover:border-[#2a2a30] hover:text-[#FAFAFA] transition-all duration-200"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse Files
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#52525B]">
              <HardDrive className="w-3 h-3 text-[#52525B]/70" />
              <span>Llama, Qwen, DeepSeek, Mistral, Phi, Gemma</span>
              <span className="text-[#52525B]/50">·</span>
              <span>1B to 70B+ parameters</span>
            </div>

            {error && (
              <div className="animate-fade-in flex items-center justify-center gap-2 p-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-400/80" />
                <span className="text-xs text-red-400/90">{error}</span>
              </div>
            )}
          </>
        )}

        {/* Model Loaded — pre-optimize */}
        {modelFile && !optimizing && !completed && !failed && (
          <>
            {/* Model info card */}
            <div className="animate-fade-in glass-card rounded-xl p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-[#6366F1]/[0.08] flex items-center justify-center shrink-0">
                <FileBox className="w-4 h-4 text-[#6366F1]/80" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-sm font-medium text-[#FAFAFA] truncate tracking-tight">
                  {modelFile.name}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[#6366F1]/[0.08] text-[#818CF8] border border-[#6366F1]/15">
                    {modelFile.format}
                  </span>
                  {modelFile.size !== "Calculating..." && (
                    <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[#1f1f23]/80 text-[#A1A1AA] border border-[#1f1f23]">
                      {modelFile.size}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#52525B] truncate font-mono">
                  {modelFile.path}
                </p>
              </div>
              <button
                onClick={clearModel}
                className="text-[#52525B] hover:text-[#A1A1AA] transition-colors p-1 rounded-lg hover:bg-[#1f1f23]/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hardware detection card */}
            <div className="animate-fade-in glass-card rounded-xl p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/[0.08] flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-emerald-400/80" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-medium text-[#FAFAFA] tracking-tight">
                  Hardware Detected
                </h3>
                {hwLoading ? (
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                    <Loader2 className="w-3 h-3 animate-spin text-[#52525B]" />
                    Detecting hardware capabilities...
                  </div>
                ) : hardware ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#A1A1AA]">
                      <span className="inline-flex items-center px-2.5 py-0.5 font-medium rounded-full bg-emerald-500/[0.08] text-emerald-400/90 border border-emerald-500/15">
                        {hardware.cpu_model}
                      </span>
                      <span className="text-[#52525B]/60">·</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 font-medium rounded-full bg-[#1f1f23]/80 text-[#A1A1AA] border border-[#1f1f23]">
                        {hardware.physical_cores}C / {hardware.logical_cores}T
                      </span>
                      <span className="text-[#52525B]/60">·</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 font-medium rounded-full bg-[#1f1f23]/80 text-[#A1A1AA] border border-[#1f1f23]">
                        {hardware.total_ram_gb.toFixed(0)} GB
                      </span>
                    </div>
                    {hardware.apple_silicon_gen && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                        <Zap className="w-3 h-3" />
                        Apple Silicon {hardware.apple_silicon_gen} — Metal GPU acceleration
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#52525B]">
                    Could not detect hardware
                  </p>
                )}
              </div>
            </div>

            {/* Optimize button */}
            <div className="gradient-border rounded-xl animate-fade-in">
              <button
                onClick={startOptimize}
                disabled={!hardware}
                className={cn(
                  "w-full py-3 text-sm font-medium text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
                  hardware
                    ? "bg-[#6366F1] hover:bg-[#818CF8] shadow-md shadow-[#6366F1]/10 hover:shadow-lg hover:shadow-[#6366F1]/20 active:scale-[0.995]"
                    : "bg-[#1f1f23] text-[#52525B] cursor-not-allowed"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Optimize Model
              </button>
            </div>
          </>
        )}

        {/* Pipeline Running / Completed / Failed */}
        {(optimizing || completed || failed) && (
          <>
            {/* Status header */}
            <div className="animate-fade-in text-center text-xs text-[#A1A1AA] pt-4">
              {completed ? (
                <span className="text-emerald-400 font-medium">
                  Optimization Complete
                </span>
              ) : failed ? (
                <span className="text-red-400 font-medium">
                  Optimization Failed
                </span>
              ) : (
                <>
                  <span className="text-[#52525B]">Optimizing</span>{" "}
                  <span className="text-[#FAFAFA] font-medium">
                    {modelFile?.name}
                  </span>
                  {hardware?.cpu_model && (
                    <span className="text-[#52525B]">
                      {" "}
                      on {hardware.cpu_model}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Stepper */}
            <div className="animate-fade-in bg-[#141417] border border-[#1f1f23] rounded-xl p-5">
              <div className="flex items-start justify-between mb-5 relative">
                {/* Connecting line */}
                <div className="absolute top-3.5 left-0 right-0 h-px bg-[#1f1f23] mx-8" />
                {STAGE_ORDER.map((stageKey, i) => {
                  const isDone =
                    completed ||
                    (currentStageIdx >= 0 && i < currentStageIdx);
                  const isCurrent =
                    !completed && !failed && stageKey === currentStage;
                  const isFailed = failed && stageKey === currentStage;
                  return (
                    <div
                      key={stageKey}
                      className="flex flex-col items-center flex-1 relative z-10"
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold mb-1.5 transition-all duration-300",
                          isDone
                            ? "bg-emerald-500/90 text-white shadow-sm shadow-emerald-500/20"
                            : isFailed
                            ? "bg-red-500/90 text-white"
                            : isCurrent
                            ? "bg-[#6366F1] text-white shadow-sm shadow-[#6366F1]/25"
                            : "bg-[#1f1f23] text-[#52525B]"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isFailed ? (
                          <AlertCircle className="w-3.5 h-3.5" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium leading-tight",
                          isDone
                            ? "text-emerald-400/80"
                            : isCurrent
                            ? "text-[#A1A1AA]"
                            : isFailed
                            ? "text-red-400/80"
                            : "text-[#52525B]/70"
                        )}
                      >
                        {STAGE_LABELS[stageKey]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-[#1f1f23] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    failed
                      ? "bg-red-500"
                      : "bg-gradient-to-r from-[#6366F1] to-[#818CF8]"
                  )}
                  style={{
                    width: `${progress}%`,
                    boxShadow: failed
                      ? "none"
                      : progress > 0
                      ? "0 0 8px rgba(99, 102, 241, 0.3), 0 0 2px rgba(99, 102, 241, 0.5)"
                      : "none",
                  }}
                />
              </div>
              <p className="text-[10px] text-[#52525B] mt-2.5 text-center tracking-wide">
                {statusMessage || "Starting..."}
              </p>
            </div>

            {/* Live Logs */}
            <div className="animate-fade-in rounded-xl overflow-hidden border border-[#1f1f23]" style={{ backgroundColor: "#0c0c0e" }}>
              <button
                onClick={() => setLogsExpanded(!logsExpanded)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-[11px] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                <span className="font-medium tracking-wide">
                  Pipeline Logs
                  <span className="ml-1.5 text-[10px] text-[#52525B]/60">
                    ({logs.length})
                  </span>
                </span>
                {logsExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {logsExpanded && (
                <div className="px-4 pb-3 max-h-56 overflow-y-auto border-t border-[#1f1f23]/80">
                  <pre className="text-[10px] font-mono leading-[1.7] pt-2 space-y-px">
                    {logs.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          line.includes("[ERROR]")
                            ? "text-red-400/80"
                            : line.includes("[WARN]")
                            ? "text-amber-400/70"
                            : line.includes("[BENCH]")
                            ? "text-blue-400/70"
                            : line.includes("[QUANT]")
                            ? "text-purple-400/70"
                            : line.includes("[OUTPUT]")
                            ? "text-emerald-400/70"
                            : "text-[#52525B]/80"
                        )}
                      >
                        {line}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </pre>
                </div>
              )}
            </div>

            {/* Benchmark Chart */}
            {completed && chartData && (
              <div className="animate-fade-in bg-[#141417] border border-[#1f1f23] rounded-xl overflow-hidden">
                <div
                  className="px-5 py-3.5 border-b border-[#1f1f23]"
                  style={{
                    background: "linear-gradient(to right, rgba(99, 102, 241, 0.04), transparent)",
                  }}
                >
                  <h3 className="text-xs font-medium text-[#FAFAFA] flex items-center gap-2 tracking-tight">
                    <Zap className="w-3.5 h-3.5 text-[#6366F1]/80" />
                    Benchmark Results
                  </h3>
                </div>
                <div className="p-5">
                  <Bar data={chartData} options={chartOptions} />
                  {benchResults && benchResults.gen_tok_s > 0 && (
                    <div className="mt-5 flex items-center justify-center gap-8">
                      <div className="text-center">
                        <div className="text-xl font-semibold text-[#818CF8] tracking-tight">
                          {benchResults.gen_tok_s.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-[#52525B] mt-0.5 tracking-wide">
                          tok/s generation
                        </div>
                      </div>
                      <div className="w-px h-8 bg-[#1f1f23]" />
                      <div className="text-center">
                        <div className="text-xl font-semibold text-emerald-400 tracking-tight">
                          {benchResults.prompt_tok_s.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-[#52525B] mt-0.5 tracking-wide">
                          tok/s prompt
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {(completed || failed) && (
              <div className="animate-fade-in flex gap-2.5">
                <button
                  onClick={clearModel}
                  className="flex-1 py-2.5 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-xl hover:bg-[#1a1a1f] hover:border-[#2a2a30] hover:text-[#FAFAFA] transition-all duration-200"
                >
                  {failed ? "Try Again" : "Optimize Another"}
                </button>
                {completed && (
                  <button
                    onClick={() => {
                      window.location.hash = "#/run";
                    }}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-white bg-[#6366F1] rounded-xl hover:bg-[#818CF8] shadow-sm shadow-[#6366F1]/10 hover:shadow-md hover:shadow-[#6366F1]/20 transition-all duration-200"
                  >
                    Go to Chat
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
