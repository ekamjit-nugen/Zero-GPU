// Hardware & Performance — matches Rust HardwareInfo struct
export interface HardwareInfo {
  os: string;
  arch: string;
  cpu_model: string;
  physical_cores: number;
  logical_cores: number;
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_features: string[];
  apple_silicon_gen: string | null;
}

export interface SystemStats {
  cpu_usage_percent: number;
  per_core_usage: number[];
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  swap_used_gb: number;
  swap_total_gb: number;
  gpu_mem_used_gb: number;
  gpu_mem_total_gb: number;
  gpu_percent: number;
  inference_active: boolean;
  inference_mem_mb: number;
  inference_cpu_percent: number;
}

export interface PerformanceEstimate {
  estimated_tok_s: number;
  recommended_quantization: string;
  fits_in_memory: boolean;
  recommended_threads: number;
}

// License
export type LicenseTier = "free" | "pro" | "team";

export interface LicenseInfo {
  tier: LicenseTier;
  is_active: boolean;
  key?: string;
  expires_at?: string;
  features: string[];
}

// Models
export interface ModelMeta {
  id: string;
  name: string;
  format: string;
  param_count: string;
  size_bytes: number;
  quantization?: string;
  path: string;
  optimized_at?: string;
  speed_rating?: SpeedRating;
  benchmark?: BenchmarkResult;
}

export interface BenchmarkResult {
  tokens_per_second: number;
  time_to_first_token_ms: number;
  memory_usage_mb: number;
  prompt_tokens: number;
  generated_tokens: number;
}

export type SpeedRating = "blazing" | "fast" | "moderate" | "slow";

// Pipeline
export type PipelineStage =
  | "import"
  | "hardware"
  | "quantize"
  | "spec_decode"
  | "compile"
  | "benchmark"
  | "done";

export interface PipelineProgress {
  stage: PipelineStage;
  progress: number;
  message: string;
  logs: string[];
}

export interface OptimizationConfig {
  model_path: string;
  backend: Backend;
  quant_format: QuantFormat;
  use_spec_decode: boolean;
  draft_model_path?: string;
  num_threads: number;
}

export type Backend = "llama_cpp" | "mlx" | "onnx" | "custom";

export type QuantFormat =
  | "Q4_0"
  | "Q4_K_M"
  | "Q5_K_M"
  | "Q6_K"
  | "Q8_0"
  | "F16"
  | "F32";

// Server
export interface ServerConfig {
  port: number;
  model_id: string;
  cors_enabled: boolean;
  rate_limit: number;
  api_key?: string;
}

export interface ServerStatus {
  is_running: boolean;
  port: number;
  model_id?: string;
  uptime_seconds: number;
  requests_served: number;
}

export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// App Config
export interface AppConfig {
  theme: "dark" | "light";
  model_storage_path: string;
  log_level: "debug" | "info" | "warn" | "error";
  auto_check_updates: boolean;
  generation_defaults: GenerationDefaults;
  server: ServerConfig;
}

export interface GenerationDefaults {
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
}

// Chat
export interface Conversation {
  id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessageEntry[];
}

export interface ChatMessageEntry {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  tokens?: number;
  tok_s?: number;
}
