import { useState } from "react";
import {
  Search,
  LayoutGrid,
  List,
  Play,
  RotateCcw,
  Download,
  Trash2,
  HardDrive,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { ModelMeta, SpeedRating } from "../types";

const MOCK_MODELS: ModelMeta[] = [
  {
    id: "1",
    name: "Llama-3.1-8B-Instruct",
    format: "GGUF",
    param_count: "8B",
    size_bytes: 4_700_000_000,
    quantization: "Q4_K_M",
    path: "~/models/llama-3.1-8b-q4km.gguf",
    optimized_at: "2026-03-17",
    speed_rating: "blazing",
    benchmark: {
      tokens_per_second: 24.6,
      time_to_first_token_ms: 110,
      memory_usage_mb: 2100,
      prompt_tokens: 128,
      generated_tokens: 256,
    },
  },
  {
    id: "2",
    name: "Mistral-7B-Instruct-v0.3",
    format: "GGUF",
    param_count: "7B",
    size_bytes: 5_100_000_000,
    quantization: "Q5_K_M",
    path: "~/models/mistral-7b-q5km.gguf",
    optimized_at: "2026-03-15",
    speed_rating: "fast",
    benchmark: {
      tokens_per_second: 18.3,
      time_to_first_token_ms: 160,
      memory_usage_mb: 2800,
      prompt_tokens: 128,
      generated_tokens: 256,
    },
  },
  {
    id: "3",
    name: "Phi-3-mini-4k",
    format: "GGUF",
    param_count: "3.8B",
    size_bytes: 2_200_000_000,
    quantization: "Q8_0",
    path: "~/models/phi-3-mini-q8.gguf",
    optimized_at: "2026-03-14",
    speed_rating: "blazing",
    benchmark: {
      tokens_per_second: 38.1,
      time_to_first_token_ms: 65,
      memory_usage_mb: 1400,
      prompt_tokens: 128,
      generated_tokens: 256,
    },
  },
  {
    id: "4",
    name: "CodeLlama-13B",
    format: "GGUF",
    param_count: "13B",
    size_bytes: 7_400_000_000,
    quantization: "Q4_0",
    path: "~/models/codellama-13b-q4.gguf",
    optimized_at: "2026-03-10",
    speed_rating: "moderate",
    benchmark: {
      tokens_per_second: 9.2,
      time_to_first_token_ms: 340,
      memory_usage_mb: 4200,
      prompt_tokens: 128,
      generated_tokens: 256,
    },
  },
];

const SPEED_COLORS: Record<SpeedRating, { bg: string; text: string; dot: string }> = {
  blazing: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  fast: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  moderate: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  slow: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
};

function formatSize(bytes: number): string {
  const gb = bytes / 1_000_000_000;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(0)} MB`;
}

export default function LibraryPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const filtered = MOCK_MODELS.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "size") return b.size_bytes - a.size_bytes;
    if (sortBy === "speed") return (b.benchmark?.tokens_per_second ?? 0) - (a.benchmark?.tokens_per_second ?? 0);
    if (sortBy === "date") return (b.optimized_at ?? "").localeCompare(a.optimized_at ?? "");
    return 0;
  });

  const totalSize = MOCK_MODELS.reduce((s, m) => s + m.size_bytes, 0);
  const maxDisk = 50_000_000_000; // 50 GB mock

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#09090b]">
      {/* Toolbar */}
      <div className="glass-card mx-4 mt-4 mb-2 flex items-center gap-4 px-4 py-3 rounded-xl border border-[#1f1f23] shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-[#09090b]/60 border border-[#1f1f23] rounded-lg text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40 focus:border-[#6366F1] transition-all"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm bg-[#09090b]/60 border border-[#1f1f23] rounded-lg text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40 focus:border-[#6366F1] transition-all cursor-pointer"
        >
          <option value="name">Sort: Name</option>
          <option value="size">Sort: Size</option>
          <option value="speed">Sort: Speed</option>
          <option value="date">Sort: Date</option>
        </select>

        <div className="flex items-center bg-[#09090b]/60 border border-[#1f1f23] rounded-full p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              viewMode === "grid"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20"
                : "text-[#52525B] hover:text-[#A1A1AA]"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              viewMode === "list"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20"
                : "text-[#52525B] hover:text-[#A1A1AA]"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-[#141417] border border-[#1f1f23] flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-[#52525B]" />
            </div>
            <p className="text-sm font-medium text-[#A1A1AA]">No models found</p>
            <p className="text-xs text-[#52525B] mt-1">Try adjusting your search query</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((model, index) => (
              <ModelRow key={model.id} model={model} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Disk Usage */}
      <div className="glass-card mx-4 mb-4 mt-2 px-4 py-3 rounded-xl border border-[#1f1f23] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-[#818CF8]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#A1A1AA]">Disk Usage</span>
              <span className="text-xs text-[#52525B] font-mono">
                {formatSize(totalSize)} / {formatSize(maxDisk)}
              </span>
            </div>
            <div className="w-full h-1 bg-[#1f1f23] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] transition-all duration-500"
                style={{ width: `${(totalSize / maxDisk) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: ModelMeta }) {
  const speed = model.speed_rating ?? "moderate";
  const colors = SPEED_COLORS[speed];

  return (
    <div className="glass-card group relative rounded-xl border border-[#1f1f23] p-5 hover:border-[#6366F1]/30 transition-all duration-300 animate-fade-in overflow-hidden">
      {/* Gradient top border on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#6366F1]/0 to-transparent group-hover:via-[#818CF8]/60 transition-all duration-500" />

      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="text-sm font-semibold text-[#FAFAFA] truncate leading-tight">
            {model.name}
          </h3>
          <p className="text-xs text-[#52525B] mt-1">
            {model.param_count} parameters
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase shrink-0",
            colors.bg,
            colors.text
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
          {speed}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {model.quantization && (
          <span className="px-2 py-0.5 bg-[#6366F1]/10 text-[#818CF8] rounded-md text-[10px] font-semibold tracking-wide">
            {model.quantization}
          </span>
        )}
        <span className="text-[11px] text-[#A1A1AA] font-mono">
          {formatSize(model.size_bytes)}
        </span>
        {model.optimized_at && (
          <span className="text-[11px] text-[#52525B]">
            {model.optimized_at}
          </span>
        )}
      </div>

      {model.benchmark && (
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-lg font-bold text-[#FAFAFA] font-mono tabular-nums leading-none">
            {model.benchmark.tokens_per_second}
          </span>
          <span className="text-[10px] text-[#52525B] font-medium">tok/s</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-4 border-t border-[#1f1f23]">
        <button
          title="Run model"
          className="flex items-center justify-center w-8 h-8 text-white bg-[#6366F1] rounded-lg hover:bg-[#818CF8] transition-colors shadow-lg shadow-[#6366F1]/10"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          title="Benchmark"
          className="flex items-center justify-center w-8 h-8 text-[#A1A1AA] bg-[#09090b]/40 border border-[#1f1f23] rounded-lg hover:text-[#FAFAFA] hover:border-[#52525B] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          title="Export model"
          className="flex items-center justify-center w-8 h-8 text-[#A1A1AA] bg-[#09090b]/40 border border-[#1f1f23] rounded-lg hover:text-[#FAFAFA] hover:border-[#52525B] transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          title="Delete model"
          className="flex items-center justify-center w-8 h-8 text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ModelRow({ model, index }: { model: ModelMeta; index: number }) {
  const speed = model.speed_rating ?? "moderate";
  const colors = SPEED_COLORS[speed];

  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-xl px-5 py-3 transition-all duration-200 animate-fade-in group",
        index % 2 === 0
          ? "bg-[#141417]/50"
          : "bg-transparent",
        "hover:bg-[#141417] hover:border-[#1f1f23]",
        "border border-transparent"
      )}
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-[#FAFAFA] truncate">{model.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-[#52525B] font-mono">{model.param_count}</span>
          {model.quantization && (
            <span className="px-1.5 py-0.5 bg-[#6366F1]/10 text-[#818CF8] rounded-md text-[10px] font-semibold">
              {model.quantization}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase shrink-0",
          colors.bg,
          colors.text
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
        {speed}
      </span>

      <span className="text-xs text-[#A1A1AA] font-mono tabular-nums shrink-0 w-20 text-right">
        {model.benchmark?.tokens_per_second} <span className="text-[#52525B]">tok/s</span>
      </span>

      <span className="text-xs text-[#52525B] font-mono tabular-nums shrink-0 w-16 text-right">
        {formatSize(model.size_bytes)}
      </span>

      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          title="Run model"
          className="p-2 text-[#A1A1AA] hover:text-[#6366F1] rounded-lg hover:bg-[#6366F1]/10 transition-colors"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          title="Benchmark"
          className="p-2 text-[#A1A1AA] hover:text-[#818CF8] rounded-lg hover:bg-[#6366F1]/10 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          title="Export model"
          className="p-2 text-[#A1A1AA] hover:text-[#818CF8] rounded-lg hover:bg-[#6366F1]/10 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          title="Delete model"
          className="p-2 text-[#52525B] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
