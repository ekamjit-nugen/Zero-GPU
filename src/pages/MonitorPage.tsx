import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  MemoryStick,
  MonitorDot,
  Zap,
  Activity,
  Gauge,
  ThermometerSun,
  HardDrive,
} from "lucide-react";
import { cn } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";
import type { SystemStats, HardwareInfo } from "../types";

/* ------------------------------------------------------------------ */
/*  Reusable SVG Ring Gauge                                           */
/* ------------------------------------------------------------------ */

interface GaugeRingProps {
  value: number;
  label: string;
  detail?: string;
  color: "indigo" | "emerald" | "purple";
}

const GAUGE_COLORS: Record<GaugeRingProps["color"], { from: string; to: string }> = {
  indigo: { from: "#6366F1", to: "#818CF8" },
  emerald: { from: "#10B981", to: "#34D399" },
  purple: { from: "#8B5CF6", to: "#A78BFA" },
};

function GaugeRing({ value, label, detail, color }: GaugeRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const gradientId = `gauge-grad-${color}`;
  const { from, to } = GAUGE_COLORS[color];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 100 100" className="w-[88px] h-[88px]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#1f1f23"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="transition-all duration-700 ease-out"
        />
        {/* Center value */}
        <text
          x="50"
          y="48"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[#FAFAFA] text-[18px] font-bold"
          style={{ fontSize: 18, fontWeight: 700 }}
        >
          {clamped.toFixed(0)}%
        </text>
      </svg>
      <span className="text-[11px] text-[#A1A1AA] font-medium tracking-wide uppercase">
        {label}
      </span>
      {detail && (
        <span className="text-[11px] text-[#52525B]">{detail}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini Spark Line (SVG polyline)                                    */
/* ------------------------------------------------------------------ */

interface SparkLineProps {
  data: number[];
  color: string;
  label: string;
  height?: number;
}

function SparkLine({ data, color, label, height = 80 }: SparkLineProps) {
  const width = 600;
  const padY = 6;
  const max = Math.max(...data, 1);

  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - padY - ((v / max) * (height - padY * 2));
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#A1A1AA] font-medium uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs font-semibold" style={{ color }}>
          {data.length > 0 ? `${data[data.length - 1].toFixed(1)}%` : "--"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`area-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={0}
            y1={height - padY - frac * (height - padY * 2)}
            x2={width}
            y2={height - padY - frac * (height - padY * 2)}
            stroke="#1f1f23"
            strokeWidth={1}
          />
        ))}
        {data.length > 1 && (
          <>
            <polygon
              points={areaPoints}
              fill={`url(#area-${label})`}
            />
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Monitor Page                                                 */
/* ------------------------------------------------------------------ */

export default function MonitorPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [hwInfo, setHwInfo] = useState<HardwareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cpuHistory = useRef<number[]>([]);
  const ramHistory = useRef<number[]>([]);
  const gpuHistory = useRef<number[]>([]);
  const MAX_HISTORY = 30;

  // Fetch hardware info once on mount
  useEffect(() => {
    invoke<HardwareInfo>("get_hardware_info")
      .then(setHwInfo)
      .catch((e) => console.warn("Failed to get hardware info:", e));
  }, []);

  // Poll system stats every 1.5s
  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const s = await invoke<SystemStats>("get_system_stats");
        if (!alive) return;
        setStats(s);
        setError(null);

        cpuHistory.current = [
          ...cpuHistory.current.slice(-(MAX_HISTORY - 1)),
          s.cpu_usage_percent,
        ];
        ramHistory.current = [
          ...ramHistory.current.slice(-(MAX_HISTORY - 1)),
          s.ram_percent,
        ];
        gpuHistory.current = [
          ...gpuHistory.current.slice(-(MAX_HISTORY - 1)),
          s.gpu_percent,
        ];
      } catch (e) {
        if (!alive) return;
        setError(String(e));
      }
    };

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const fmt = (n: number) => n.toFixed(1);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
        {/* -------- Header -------- */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#6366F1]/10 text-[#6366F1]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#FAFAFA] tracking-tight">
                System Monitor
              </h1>
              {hwInfo && (
                <p className="text-[11px] text-[#52525B] mt-0.5">
                  {hwInfo.cpu_model} &middot; {hwInfo.logical_cores} threads &middot;{" "}
                  {fmt(hwInfo.total_ram_gb)} GB RAM
                </p>
              )}
            </div>
          </div>

          {/* Inference status badge */}
          {stats && (
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border",
                stats.inference_active
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-[#141417] border-[#1f1f23] text-[#52525B]"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  stats.inference_active
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-[#52525B]"
                )}
              />
              {stats.inference_active ? "Inference Active" : "Idle"}
            </div>
          )}
        </div>

        {/* -------- Error banner -------- */}
        {error && (
          <div className="glass-card border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-3 text-xs text-red-400">
            Failed to fetch system stats: {error}
          </div>
        )}

        {/* -------- Top row: 4 stat cards -------- */}
        <div className="grid grid-cols-4 gap-4">
          {/* CPU */}
          <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 self-start">
              <Cpu className="w-3.5 h-3.5 text-[#6366F1]" />
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                CPU Usage
              </span>
            </div>
            <GaugeRing
              value={stats?.cpu_usage_percent ?? 0}
              label="Utilization"
              color="indigo"
            />
          </div>

          {/* RAM */}
          <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 self-start">
              <MemoryStick className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                RAM Usage
              </span>
            </div>
            <GaugeRing
              value={stats?.ram_percent ?? 0}
              label="Memory"
              detail={
                stats
                  ? `${fmt(stats.ram_used_gb)} / ${fmt(stats.ram_total_gb)} GB`
                  : "--"
              }
              color="emerald"
            />
          </div>

          {/* GPU */}
          <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 self-start">
              <MonitorDot className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                GPU Memory
              </span>
            </div>
            <GaugeRing
              value={stats?.gpu_percent ?? 0}
              label="VRAM"
              detail={
                stats
                  ? `${fmt(stats.gpu_mem_used_gb)} / ${fmt(stats.gpu_mem_total_gb)} GB`
                  : "--"
              }
              color="purple"
            />
          </div>

          {/* Inference Process */}
          <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                Inference Process
              </span>
            </div>

            {stats?.inference_active ? (
              <div className="flex-1 flex flex-col justify-center gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#52525B]">Memory</span>
                  <span className="text-sm font-semibold text-[#FAFAFA]">
                    {stats.inference_mem_mb.toFixed(0)}{" "}
                    <span className="text-[11px] text-[#52525B] font-normal">MB</span>
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1f1f23] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (stats.inference_mem_mb / (stats.ram_total_gb * 1024)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#52525B]">CPU</span>
                  <span className="text-sm font-semibold text-[#FAFAFA]">
                    {stats.inference_cpu_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1f1f23] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, stats.inference_cpu_percent)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-[#52525B]">No active inference</span>
              </div>
            )}
          </div>
        </div>

        {/* -------- CPU Cores Panel -------- */}
        <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-[#6366F1]" />
            <span className="text-sm font-medium text-[#FAFAFA]">CPU Cores</span>
            <span className="text-[11px] text-[#52525B] ml-auto">
              {stats?.per_core_usage.length ?? 0} threads
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.ceil((stats?.per_core_usage.length ?? 8) / 2)}, minmax(0, 1fr))`,
              gridTemplateRows: "repeat(2, 1fr)",
            }}
          >
            {(stats?.per_core_usage ?? []).map((usage, i) => {
              const pct = Math.min(100, Math.max(0, usage));
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-full h-16 rounded-md bg-[#09090b] border border-[#1f1f23] relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-b-md transition-all duration-700 ease-out"
                      style={{
                        height: `${pct}%`,
                        background:
                          pct > 80
                            ? "linear-gradient(to top, #ef4444, #f87171)"
                            : pct > 50
                              ? "linear-gradient(to top, #f59e0b, #fbbf24)"
                              : "linear-gradient(to top, #6366F1, #818CF8)",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[#FAFAFA]/80">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-[#52525B]">C{i}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* -------- Memory Breakdown -------- */}
        <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-[#FAFAFA]">Memory Breakdown</span>
          </div>

          {stats && (
            <div className="flex flex-col gap-4">
              {/* RAM bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#A1A1AA]">RAM</span>
                  <span className="text-[11px] text-[#52525B]">
                    {fmt(stats.ram_used_gb)} / {fmt(stats.ram_total_gb)} GB
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#09090b] border border-[#1f1f23] overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700 rounded-l-full"
                    style={{
                      width: `${stats.ram_percent}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#1f1f23] transition-all duration-700"
                    style={{
                      width: `${100 - stats.ram_percent}%`,
                    }}
                  />
                </div>
              </div>

              {/* Swap bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#A1A1AA]">Swap</span>
                  <span className="text-[11px] text-[#52525B]">
                    {fmt(stats.swap_used_gb)} / {fmt(stats.swap_total_gb)} GB
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#09090b] border border-[#1f1f23] overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-700 rounded-l-full"
                    style={{
                      width: `${
                        stats.swap_total_gb > 0
                          ? (stats.swap_used_gb / stats.swap_total_gb) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#1f1f23] transition-all duration-700"
                    style={{
                      width: `${
                        stats.swap_total_gb > 0
                          ? 100 - (stats.swap_used_gb / stats.swap_total_gb) * 100
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-[11px] text-[#A1A1AA]">RAM Used</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#1f1f23]" />
                  <span className="text-[11px] text-[#A1A1AA]">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
                  <span className="text-[11px] text-[#A1A1AA]">Swap Used</span>
                </div>
              </div>
            </div>
          )}

          {!stats && (
            <div className="flex items-center justify-center h-20">
              <span className="text-xs text-[#52525B]">Waiting for data...</span>
            </div>
          )}
        </div>

        {/* -------- Resource History -------- */}
        <div className="glass-card animate-fade-in border border-[#1f1f23] hover:border-[#2a2a30] transition rounded-xl bg-[#141417] p-5">
          <div className="flex items-center gap-2 mb-5">
            <ThermometerSun className="w-4 h-4 text-[#6366F1]" />
            <span className="text-sm font-medium text-[#FAFAFA]">Resource History</span>
            <span className="text-[11px] text-[#52525B] ml-auto">
              Last {MAX_HISTORY} samples &middot; 1.5 s interval
            </span>
          </div>

          <div className="flex flex-col gap-5">
            <SparkLine
              data={[...cpuHistory.current]}
              color="#6366F1"
              label="CPU"
            />
            <SparkLine
              data={[...ramHistory.current]}
              color="#10B981"
              label="RAM"
            />
            <SparkLine
              data={[...gpuHistory.current]}
              color="#8B5CF6"
              label="GPU"
            />
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}
