import { useState } from "react";
import {
  Palette,
  FolderOpen,
  Cpu,
  Server,
  KeyRound,
  RefreshCw,
  Wrench,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/utils";

function Section({
  icon: Icon,
  title,
  description,
  children,
  variant = "default",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const isDanger = variant === "danger";
  return (
    <div
      className={cn(
        "relative bg-[#141417] border border-[#1f1f23] rounded-xl p-6 animate-fade-in overflow-hidden",
        isDanger && "border-red-500/20"
      )}
    >
      {/* Left accent line */}
      <div
        className={cn(
          "absolute left-0 top-4 bottom-4 w-0.75 rounded-full",
          isDanger
            ? "bg-linear-to-b from-red-500 to-red-500/40"
            : "bg-linear-to-b from-[#6366F1] to-[#818CF8]/40"
        )}
      />
      <div className="ml-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Icon
            className={cn(
              "w-4.5 h-4.5",
              isDanger ? "text-red-400" : "text-[#818CF8]"
            )}
          />
          <h3 className="text-[13px] font-semibold text-[#FAFAFA] tracking-wide">
            {title}
          </h3>
        </div>
        <p className="text-[11px] text-[#52525B] mb-5 ml-7.5 leading-relaxed">
          {description}
        </p>
        <div className="space-y-4 ml-7.5">{children}</div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#A1A1AA] shrink-0">
        {label}
      </label>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [storagePath, setStoragePath] = useState("~/zerogpu-forge/models");
  const [threadCount, setThreadCount] = useState(8);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [serverPort, setServerPort] = useState(8421);
  const [corsEnabled, setCorsEnabled] = useState(true);
  const [rateLimit, setRateLimit] = useState(60);
  const [apiKey, setApiKey] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseActive, setLicenseActive] = useState(false);
  const [autoUpdates, setAutoUpdates] = useState(true);
  const [logLevel, setLogLevel] = useState("info");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  const inputClass =
    "w-full px-3 py-2 text-xs bg-[#0c0c0e] border border-[#1f1f23] rounded-lg text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#6366F1]/30 focus:border-[#6366F1]/50 transition-all duration-200";

  return (
    <div className="h-full overflow-y-auto p-8 bg-[#09090b]">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Appearance */}
        <Section
          icon={Palette}
          title="Appearance"
          description="Customize the look and feel of the application."
        >
          <FieldRow label="Theme">
            <button
              onClick={toggleTheme}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300",
                theme === "dark"
                  ? "bg-linear-to-r from-[#6366F1]/20 to-[#818CF8]/10 border border-[#6366F1]/30 text-[#818CF8] shadow-[0_0_12px_rgba(99,102,241,0.08)]"
                  : "bg-linear-to-r from-amber-500/20 to-amber-400/10 border border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
              )}
            >
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </FieldRow>
        </Section>

        {/* Storage */}
        <Section
          icon={FolderOpen}
          title="Storage"
          description="Configure where models and data are stored."
        >
          <FieldRow label="Model Storage Path">
            <div className="flex gap-2">
              <input
                value={storagePath}
                onChange={(e) => setStoragePath(e.target.value)}
                className={cn(inputClass, "flex-1")}
              />
              <button className="px-3.5 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1f1f23] hover:text-[#FAFAFA] transition-all duration-200 shrink-0">
                Browse
              </button>
            </div>
          </FieldRow>
        </Section>

        {/* Inference */}
        <Section
          icon={Cpu}
          title="Inference"
          description="Default parameters for model inference."
        >
          <FieldRow label="Thread Count">
            <input
              type="number"
              value={threadCount}
              onChange={(e) => setThreadCount(Number(e.target.value))}
              min={1}
              max={32}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="Temperature">
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              min={0}
              max={2}
              step={0.1}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="Top-P">
            <input
              type="number"
              value={topP}
              onChange={(e) => setTopP(Number(e.target.value))}
              min={0}
              max={1}
              step={0.05}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="Max Tokens">
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              min={64}
              max={8192}
              step={64}
              className={inputClass}
            />
          </FieldRow>
        </Section>

        {/* Server */}
        <Section
          icon={Server}
          title="Server"
          description="Configure the local API server."
        >
          <FieldRow label="Port">
            <input
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(Number(e.target.value))}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="CORS">
            <button
              onClick={() => setCorsEnabled(!corsEnabled)}
              className={cn(
                "relative w-10 h-5.5 rounded-full transition-all duration-300 ease-in-out",
                corsEnabled
                  ? "bg-linear-to-r from-[#6366F1] to-[#818CF8] shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                  : "bg-[#1f1f23]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.75 left-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300 ease-in-out shadow-sm",
                  corsEnabled && "translate-x-4.5"
                )}
              />
            </button>
          </FieldRow>
          <FieldRow label="Rate Limit (req/min)">
            <input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </FieldRow>
        </Section>

        {/* License */}
        <Section
          icon={KeyRound}
          title="License"
          description="Manage your ZeroGPU Forge license."
        >
          <FieldRow label="Status">
            <div className="flex items-center gap-2">
              {licenseActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Pro Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1f1f23] text-[#52525B] border border-[#1f1f23]">
                  <XCircle className="w-3 h-3" />
                  Free Tier
                </span>
              )}
            </div>
          </FieldRow>
          <FieldRow label="License Key">
            <input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className={inputClass}
            />
          </FieldRow>
          <div className="flex gap-2.5 justify-end pt-1">
            <button
              onClick={() => setLicenseActive(true)}
              className="px-4 py-2 text-xs font-medium text-white bg-linear-to-r from-[#6366F1] to-[#818CF8] rounded-lg hover:shadow-[0_0_16px_rgba(99,102,241,0.25)] hover:brightness-110 transition-all duration-300"
            >
              Activate
            </button>
            <button
              onClick={() => setLicenseActive(false)}
              className="px-4 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1f1f23] hover:text-[#FAFAFA] transition-all duration-200"
            >
              Deactivate
            </button>
          </div>
        </Section>

        {/* Updates */}
        <Section
          icon={RefreshCw}
          title="Updates"
          description="Keep ZeroGPU Forge up to date."
        >
          <FieldRow label="Auto-check for Updates">
            <button
              onClick={() => setAutoUpdates(!autoUpdates)}
              className={cn(
                "relative w-10 h-5.5 rounded-full transition-all duration-300 ease-in-out",
                autoUpdates
                  ? "bg-linear-to-r from-[#6366F1] to-[#818CF8] shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                  : "bg-[#1f1f23]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.75 left-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300 ease-in-out shadow-sm",
                  autoUpdates && "translate-x-4.5"
                )}
              />
            </button>
          </FieldRow>
          <div className="flex justify-end pt-1">
            <button className="px-4 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1f1f23] hover:text-[#FAFAFA] transition-all duration-200">
              Check Now
            </button>
          </div>
        </Section>

        {/* Advanced / Danger Zone */}
        <Section
          icon={Wrench}
          title="Advanced"
          description="Advanced configuration and debugging options."
          variant="danger"
        >
          <FieldRow label="Log Level">
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className={inputClass}
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </FieldRow>
          <div className="flex gap-2.5 justify-end pt-2">
            <button className="px-4 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1f1f23] hover:text-[#FAFAFA] transition-all duration-200">
              Export Settings
            </button>
            <button className="px-4 py-2 text-xs font-medium text-[#A1A1AA] bg-[#141417] border border-[#1f1f23] rounded-lg hover:bg-[#1f1f23] hover:text-[#FAFAFA] transition-all duration-200">
              Import Settings
            </button>
            <button className="px-4 py-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg hover:bg-red-500/20 hover:shadow-[0_0_12px_rgba(239,68,68,0.1)] transition-all duration-200">
              Reset to Defaults
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
