import { NavLink } from "react-router-dom";
import {
  Zap,
  MessageSquare,
  Server,
  BookOpen,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";

const tabs = [
  { to: "/optimize", label: "Optimize", icon: Zap },
  { to: "/run", label: "Run", icon: MessageSquare },
  { to: "/monitor", label: "Monitor", icon: Activity },
  { to: "/server", label: "Server", icon: Server },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between h-11 px-4 bg-[#0c0c0e] border-b border-[#1f1f23] select-none shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366F1] to-[#818CF8] flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-white">
          ZeroGPU Forge
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150",
                isActive
                  ? "bg-[#6366F1]/12 text-[#818CF8]"
                  : "text-[#52525B] hover:text-[#A1A1AA] hover:bg-white/[0.03]"
              )
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Version badge */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
        <span className="text-[10px] text-[#52525B] font-mono">v1.0.0</span>
      </div>
    </nav>
  );
}
