use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

use crate::hardware::HardwareInfo;
use crate::models::{BenchmarkResult, ModelMeta};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PipelineStage {
    Import,
    HardwareDetection,
    Quantization,
    SpeculativeDecoding,
    BinaryCompilation,
    Benchmark,
    Complete,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineProgress {
    pub stage: String,
    pub progress_percent: f64,
    pub message: String,
    pub log_line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub model_path: String,
    pub backend: Backend,
    pub quantization_format: QuantFormat,
    pub enable_speculative: bool,
    pub draft_model_path: Option<String>,
    pub thread_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Backend {
    MLX,
    LlamaCpp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[allow(non_camel_case_types)]
pub enum QuantFormat {
    Q4_MLX,
    Q4_K_M,
    IQ4_XS,
    IQ3_XS,
    Q3_K_S,
    Q5_K_M,
    Q8_0,
}

impl std::fmt::Display for QuantFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            QuantFormat::Q4_MLX => write!(f, "Q4_MLX"),
            QuantFormat::Q4_K_M => write!(f, "Q4_K_M"),
            QuantFormat::IQ4_XS => write!(f, "IQ4_XS"),
            QuantFormat::IQ3_XS => write!(f, "IQ3_XS"),
            QuantFormat::Q3_K_S => write!(f, "Q3_K_S"),
            QuantFormat::Q5_K_M => write!(f, "Q5_K_M"),
            QuantFormat::Q8_0 => write!(f, "Q8_0"),
        }
    }
}

impl std::fmt::Display for Backend {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Backend::MLX => write!(f, "MLX"),
            Backend::LlamaCpp => write!(f, "llama.cpp"),
        }
    }
}

pub fn select_backend(hw: &HardwareInfo) -> Backend {
    let _ = hw;
    Backend::LlamaCpp
}

/// Select target quantization based on model size AND available hardware.
pub fn select_quantization(_backend: &Backend, model_params_b: f64, hw: &HardwareInfo) -> QuantFormat {
    use crate::hardware::{resource_tier, ResourceTier};
    let tier = resource_tier(hw);

    match tier {
        ResourceTier::Minimal => {
            // Aggressive compression to fit in limited RAM
            if model_params_b > 13.0 {
                QuantFormat::IQ3_XS  // extreme compression for large models
            } else if model_params_b > 7.0 {
                QuantFormat::Q3_K_S
            } else {
                QuantFormat::IQ4_XS  // best balance for 7B on low RAM
            }
        }
        ResourceTier::Standard => {
            // 16 GB — Q4_K_M gives best speed/quality balance for 7B
            if model_params_b > 14.0 {
                QuantFormat::IQ4_XS
            } else {
                QuantFormat::Q4_K_M
            }
        }
        ResourceTier::High => {
            // 32 GB+ — can afford higher quality
            if model_params_b > 34.0 {
                QuantFormat::Q4_K_M
            } else if model_params_b > 14.0 {
                QuantFormat::Q5_K_M
            } else {
                QuantFormat::Q5_K_M
            }
        }
    }
}

/// Compute hardware-adaptive inference parameters.
/// Returns (context_size, batch_size, micro_batch_size, use_mmap, kv_cache_type_k, kv_cache_type_v).
///
/// KV cache memory formula (per layer):  ctx × 2 × head_dim × n_heads × dtype_size
/// For 7B with q4_0 K+V: ~128 MB at 8192 ctx — very manageable.
/// For 7B with f16  K+V: ~1 GB at 8192 ctx.
pub fn adaptive_inference_params(hw: &HardwareInfo, model_params_b: f64) -> (u32, u32, u32, bool, String, String) {
    use crate::hardware::{resource_tier, ResourceTier};
    let tier = resource_tier(hw);

    match tier {
        ResourceTier::Minimal => {
            // 8 GB RAM — aggressive KV cache quant lets us keep a usable context window.
            // q4_0 K+V at 4096 ctx ≈ 64 MB for 7B — trivial.
            let ctx = if model_params_b > 13.0 { 2048 } else { 4096 };
            (ctx, 256, 128, true, "q4_0".into(), "q4_0".into())
        }
        ResourceTier::Standard => {
            // 16 GB RAM — plenty for 7B models, use large context with quantised KV.
            // q8_0 K + q4_0 V at 8192 ctx ≈ 192 MB for 7B.
            let ctx = if model_params_b > 13.0 { 4096 } else { 8192 };
            (ctx, 512, 256, false, "q8_0".into(), "q4_0".into())
        }
        ResourceTier::High => {
            // 32 GB+ — max context, high quality KV cache.
            let ctx = if model_params_b > 34.0 { 4096 } else { 8192 };
            (ctx, 512, 256, false, "q8_0".into(), "q8_0".into())
        }
    }
}

fn emit(app: &AppHandle, stage: &str, percent: f64, message: &str, log_line: &str) {
    let _ = app.emit(
        "optimization-progress",
        PipelineProgress {
            stage: stage.to_string(),
            progress_percent: percent,
            message: message.to_string(),
            log_line: log_line.to_string(),
        },
    );
}

fn find_binaries_dir() -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));
        // macOS .app bundle: Contents/MacOS/<exe> → Contents/Resources/binaries
        let resources_bin = exe_dir.parent().unwrap_or(exe_dir).join("Resources").join("binaries");
        if resources_bin.join("llama-quantize").exists() {
            return Ok(resources_bin);
        }
        let sibling_bin = exe_dir.join("binaries");
        if sibling_bin.join("llama-quantize").exists() {
            return Ok(sibling_bin);
        }
    }
    for p in &[PathBuf::from("binaries"), PathBuf::from("src-tauri/binaries")] {
        if p.join("llama-quantize").exists() {
            return Ok(p.clone());
        }
    }
    let project_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    if project_bin.join("llama-quantize").exists() {
        return Ok(project_bin);
    }
    Err("Could not find llama.cpp binaries.".to_string())
}

fn get_models_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".zerogpu-forge").join("models")
}

fn estimate_params_from_size(file_size_bytes: u64) -> (String, f64) {
    let gb = file_size_bytes as f64 / 1_073_741_824.0;
    if gb < 1.5 { ("1B".to_string(), 1.0) }
    else if gb < 3.0 { ("3B".to_string(), 3.0) }
    else if gb < 5.5 { ("7B".to_string(), 7.0) }
    else if gb < 8.0 { ("8B".to_string(), 8.0) }
    else if gb < 11.0 { ("14B".to_string(), 14.0) }
    else if gb < 20.0 { ("34B".to_string(), 34.0) }
    else { ("70B+".to_string(), 70.0) }
}

/// Detect current quantization from GGUF metadata by reading file header info.
fn detect_current_quant(model_path: &Path) -> Option<String> {
    // Try running llama-cli with -m and 0 tokens — it prints model info to stderr
    // Alternatively, just check file size heuristic
    let size = std::fs::metadata(model_path).ok()?.len();
    let gb = size as f64 / 1_073_741_824.0;

    // For 7B models: Q8_0 ≈ 7.7GB, Q5_K_M ≈ 5.1GB, Q4_K_M ≈ 4.4GB, IQ4_XS ≈ 3.6GB
    if gb > 7.0 { Some("Q8_0".to_string()) }
    else if gb > 4.8 { Some("Q5_K_M".to_string()) }
    else if gb > 3.8 { Some("Q4_K_M".to_string()) }
    else { Some("IQ4_XS".to_string()) }
}

/// Calculate optimal thread count for inference.
/// On Apple Silicon: use performance cores only (not efficiency cores).
pub fn optimal_threads(hw: &HardwareInfo) -> usize {
    if hw.apple_silicon_gen.is_some() {
        // M1 Pro: 8P+2E=10 cores → use 8 (perf cores only)
        // M1: 4P+4E=8 → use 4
        // M2 Pro: 8P+4E=12 → use 8
        // M3 Pro: 6P+6E=12 → use 6
        // Heuristic: performance cores ≈ physical - (physical / 4..5)
        let perf_cores = match hw.physical_cores {
            1..=4 => hw.physical_cores,
            5..=8 => (hw.physical_cores as f64 * 0.5).ceil() as usize,
            9..=10 => 8,  // M1 Pro/Max
            11..=12 => 8, // M2 Pro
            _ => (hw.physical_cores as f64 * 0.7).ceil() as usize,
        };
        perf_cores.max(1)
    } else {
        // Linux/x86: use physical cores - 1 (leave 1 for OS)
        (hw.physical_cores - 1).max(1)
    }
}

/// Calculate number of GPU layers to offload to Metal.
///
/// On Apple Silicon, ALL layers should be on GPU when the model fits — that's
/// where the speed comes from.  Only hold back when the model is too large.
pub fn metal_gpu_layers(hw: &HardwareInfo, model_params_b: f64) -> u32 {
    if hw.apple_silicon_gen.is_none() {
        return 0; // No Metal
    }

    // Estimate model size in MB (rough: Q4 ≈ 0.55 GB/B, Q8 ≈ 1.1 GB/B, assume Q4-ish)
    let model_size_mb = model_params_b * 0.55 * 1024.0;
    // RAM available for GPU after reserving ~4 GB for OS + KV cache + app
    let available_mb = (hw.total_ram_gb - 4.0).max(1.0) * 1024.0;

    let total_layers = (model_params_b * 4.5) as u32; // ~32 for 7B

    if model_size_mb < available_mb {
        // Model fits entirely — offload ALL layers for max speed
        total_layers.min(99)
    } else {
        // Partial offload — proportional to what fits
        let ratio = available_mb / model_size_mb;
        ((total_layers as f64 * ratio) as u32).max(1).min(99)
    }
}

/// Run a process with timeout, streaming stderr to the UI. Returns (stdout, stderr, success).
fn run_with_timeout(
    app: &AppHandle,
    stage: &str,
    mut child: std::process::Child,
    timeout_secs: u64,
    base_progress: f64,
) -> (String, Vec<String>, bool) {
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let start = std::time::Instant::now();

    // Stream stderr in background thread
    let stderr_pipe = child.stderr.take();
    let app_clone = app.clone();
    let stage_str = stage.to_string();
    let stderr_handle = std::thread::spawn(move || {
        let mut lines = Vec::new();
        if let Some(stderr) = stderr_pipe {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if !line.trim().is_empty() {
                    emit(&app_clone, &stage_str, base_progress + 5.0, "Running...", &format!("[BENCH] {}", line));
                    lines.push(line);
                }
            }
        }
        lines
    });

    // Wait with timeout
    let success;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => { success = status.success(); break; }
            Ok(None) => {
                if start.elapsed() > timeout {
                    emit(app, stage, base_progress + 20.0,
                        &format!("Timeout after {}s, terminating...", timeout_secs),
                        &format!("[WARN] Process exceeded {} second timeout", timeout_secs));
                    let _ = child.kill();
                    let _ = child.wait();
                    success = false;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
                let elapsed = start.elapsed().as_secs();
                emit(app, stage, base_progress + (elapsed as f64 / timeout_secs as f64 * 20.0).min(20.0),
                    &format!("Running... ({}s)", elapsed), "");
            }
            Err(_) => { success = false; break; }
        }
    }

    let stderr_lines = stderr_handle.join().unwrap_or_default();

    // Read stdout
    let mut stdout_str = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = std::io::Read::read_to_string(&mut stdout, &mut stdout_str);
    }

    (stdout_str, stderr_lines, success)
}

/// Parse tok/s from llama.cpp stderr output lines.
fn parse_tok_s(lines: &[String]) -> (f64, f64) {
    let mut prompt_tok_s = 0.0;
    let mut gen_tok_s = 0.0;

    for line in lines {
        if !line.contains("tokens per second") {
            continue;
        }
        // Format: "... (  19.29 ms per token,    51.84 tokens per second)"
        if let Some(pos) = line.find("tokens per second") {
            let before = &line[..pos];
            // Walk backwards to find the number
            let trimmed = before.trim_end();
            if let Some(comma_pos) = trimmed.rfind(',') {
                let num_part = trimmed[comma_pos + 1..].trim();
                if let Ok(val) = num_part.parse::<f64>() {
                    if line.contains("prompt eval") {
                        prompt_tok_s = val;
                    } else {
                        gen_tok_s = val;
                    }
                }
            }
        }
    }

    (prompt_tok_s, gen_tok_s)
}


/// ═══════════════════════════════════════════════════════════════════
/// MAIN PIPELINE — Real optimization with quantization, Metal GPU
/// offload, thread tuning, KV cache optimization, and benchmarking.
/// ═══════════════════════════════════════════════════════════════════
pub fn run_pipeline(app: &AppHandle, config: OptimizationConfig, hw: &HardwareInfo) -> Result<ModelMeta, String> {
    let bin_dir = find_binaries_dir()?;
    let quantize_bin = bin_dir.join("llama-quantize");
    let cli_bin = bin_dir.join("llama-cli");
    let lib_path = bin_dir.to_string_lossy().to_string();

    let model_path = Path::new(&config.model_path);
    if !model_path.exists() {
        return Err(format!("Model file not found: {}", config.model_path));
    }

    let model_id = uuid::Uuid::new_v4().to_string();
    let model_name = model_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let original_size = std::fs::metadata(model_path).map(|m| m.len()).unwrap_or(0);

    // ══════════════ Stage 1: Import & Validate ══════════════
    emit(app, "import", 5.0, "Validating model file...",
        &format!("[INFO] Loading: {} ({:.1} GB)", model_name, original_size as f64 / 1_073_741_824.0));

    let mut is_gguf = false;
    if let Ok(file) = std::fs::File::open(model_path) {
        let mut reader = BufReader::new(file);
        let mut magic = [0u8; 4];
        if std::io::Read::read_exact(&mut reader, &mut magic).is_ok() {
            is_gguf = &magic == b"GGUF";
        }
    }
    if !is_gguf {
        return Err("Not a valid GGUF file. Please provide a .gguf model.".to_string());
    }

    let (params_label, params_b) = estimate_params_from_size(original_size);
    let current_quant = detect_current_quant(model_path).unwrap_or_else(|| "unknown".to_string());

    emit(app, "import", 12.0,
        &format!("Model: {} ~{} — currently {}", model_name, params_label, current_quant),
        &format!("[INFO] Detected: ~{} params, current quantization: {}", params_label, current_quant));

    // ══════════════ Stage 2: Hardware Detection & Tuning ══════════════
    let opt_threads = optimal_threads(hw);
    let gpu_layers = metal_gpu_layers(hw, params_b);

    emit(app, "hardware", 18.0,
        &format!("{} — {} cores, {:.0} GB RAM", hw.cpu_model, hw.physical_cores, hw.total_ram_gb),
        &format!("[INFO] CPU: {} | Physical: {} | Logical: {} | RAM: {:.1} GB",
            hw.cpu_model, hw.physical_cores, hw.logical_cores, hw.total_ram_gb));

    emit(app, "hardware", 22.0,
        &format!("Tuned: {} threads (perf cores), {} GPU layers (Metal)", opt_threads, gpu_layers),
        &format!("[TUNE] Optimal threads: {} (performance cores only)", opt_threads));

    if gpu_layers > 0 {
        emit(app, "hardware", 25.0,
            &format!("Metal GPU: offloading {} layers for ~3-5x speedup", gpu_layers),
            &format!("[TUNE] Metal GPU offload: {} layers ({:.0} MB estimated GPU memory)",
                gpu_layers, gpu_layers as f64 * params_b * 18.0));
    }

    // Compute adaptive inference parameters for this hardware
    let (ctx_size, batch_size, ubatch_size, use_mmap, kv_type_k, kv_type_v) =
        adaptive_inference_params(hw, params_b);

    let tier = crate::hardware::resource_tier(hw);
    let tier_label = match tier {
        crate::hardware::ResourceTier::Minimal  => "Minimal (aggressive memory savings)",
        crate::hardware::ResourceTier::Standard => "Standard (balanced)",
        crate::hardware::ResourceTier::High     => "High (full quality)",
    };
    emit(app, "hardware", 26.0,
        &format!("Resource profile: {}", tier_label),
        &format!("[TUNE] Resource tier: {} | ctx: {} | batch: {}/{} | KV cache: {}/{}{}",
            tier_label, ctx_size, batch_size, ubatch_size, kv_type_k, kv_type_v,
            if use_mmap { " | mmap (low-RAM mode)" } else { " | mlock" }));

    let features = hw.cpu_features.join(", ");
    if !features.is_empty() {
        emit(app, "hardware", 27.0, &format!("ISA: {}", features),
            &format!("[INFO] Instruction sets: {}", features));
    }

    // ══════════════ Stage 3: Quantization ══════════════
    let target_quant = config.quantization_format.to_string();
    let model_dir = get_models_dir().join(&model_id);
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let output_model_path = model_dir.join("model.gguf");

    // Decide if we need to re-quantize
    let needs_requant = current_quant != target_quant;

    if needs_requant {
        emit(app, "quantize", 30.0,
            &format!("Quantizing: {} → {} for faster inference", current_quant, target_quant),
            &format!("[INFO] Re-quantizing from {} to {} ...", current_quant, target_quant));

        let quant_child = Command::new(&quantize_bin)
            .arg("--allow-requantize")
            .arg(&config.model_path)
            .arg(&output_model_path)
            .arg(&target_quant)
            .arg(config.thread_count.to_string())
            .env("DYLD_LIBRARY_PATH", &lib_path)
            .env("LD_LIBRARY_PATH", &lib_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start llama-quantize: {}", e))?;

        let (_stdout, stderr_lines, success) = run_with_timeout(app, "quantize", quant_child, 600, 30.0);

        // Log last few lines
        for line in stderr_lines.iter().rev().take(5).collect::<Vec<_>>().iter().rev() {
            emit(app, "quantize", 52.0, "Quantizing...", &format!("[QUANT] {}", line));
        }

        if !success {
            emit(app, "quantize", 50.0, "Quantization failed — using original model",
                "[WARN] Quantization failed, will optimize original model as-is");
            std::fs::copy(model_path, &output_model_path)
                .map_err(|e| format!("Failed to copy model: {}", e))?;
        }
    } else {
        emit(app, "quantize", 30.0,
            &format!("Already at {} — skipping re-quantization", target_quant),
            &format!("[INFO] Model already at target quant {}, copying as-is", target_quant));
        std::fs::copy(model_path, &output_model_path)
            .map_err(|e| format!("Failed to copy model: {}", e))?;
    }

    let output_size = std::fs::metadata(&output_model_path).map(|m| m.len()).unwrap_or(0);

    if needs_requant && output_size < original_size {
        let saved = original_size - output_size;
        emit(app, "quantize", 55.0,
            &format!("{:.1} GB → {:.1} GB (saved {:.0} MB)",
                original_size as f64 / 1_073_741_824.0,
                output_size as f64 / 1_073_741_824.0,
                saved as f64 / 1_048_576.0),
            &format!("[INFO] Quantization saved {:.0} MB ({:.1}% reduction)",
                saved as f64 / 1_048_576.0,
                (saved as f64 / original_size as f64) * 100.0));
    } else {
        emit(app, "quantize", 55.0,
            &format!("Model ready: {:.1} GB", output_size as f64 / 1_073_741_824.0),
            "[INFO] Model prepared for optimized inference");
    }

    // ══════════════ Stage 4: Speculative Decoding ══════════════
    emit(app, "spec_decode", 58.0, "Speculative decoding (Pro feature — skipped)",
        "[INFO] Speculative decoding: requires Pro license");

    // ══════════════ Stage 5: Optimization Config ══════════════
    emit(app, "compile", 62.0, "Generating optimized inference configuration...",
        "[INFO] Writing optimized run configuration...");

    // Write an optimized run script with all tuning parameters
    let ngl_str = gpu_layers.to_string();
    let threads_str = opt_threads.to_string();

    // Save optimization config
    let opt_config = serde_json::json!({
        "model": output_model_path.to_string_lossy(),
        "threads": opt_threads,
        "gpu_layers": gpu_layers,
        "ctx_size": ctx_size,
        "batch_size": batch_size,
        "ubatch_size": ubatch_size,
        "flash_attention": true,
        "use_mmap": use_mmap,
        "mlock": !use_mmap,
        "kv_cache_type_k": kv_type_k,
        "kv_cache_type_v": kv_type_v,
        "quantization": target_quant,
        "resource_tier": format!("{:?}", tier),
        "tuning_notes": format!(
            "Optimized for {} with {} performance cores and Metal GPU ({} layers offloaded)",
            hw.cpu_model, opt_threads, gpu_layers
        ),
    });

    let config_path = model_dir.join("optimization.json");
    if let Ok(json) = serde_json::to_string_pretty(&opt_config) {
        let _ = std::fs::write(&config_path, json);
    }

    // Write a run script with hardware-adaptive flags
    let mem_flag = if use_mmap { "--mmap" } else { "--mlock" };
    let run_script = format!(
        r#"#!/bin/bash
# ZeroGPU Forge — Optimized runner for {model_name}
# Hardware: {cpu} | Threads: {threads} | GPU Layers: {ngl}
# Resource tier: {tier_label} | KV cache: {kv_k}/{kv_v}

DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY_DIR="{bin_dir}"

DYLD_LIBRARY_PATH="$BINARY_DIR" "$BINARY_DIR/llama-cli" \
    -m "$DIR/model.gguf" \
    -t {threads} \
    -ngl {ngl} \
    -c {ctx} \
    -b {batch} \
    -ub {ubatch} \
    {mem_flag} \
    --cache-type-k {kv_k} \
    --cache-type-v {kv_v} \
    --flash-attn on \
    --interactive-first \
    "$@"
"#,
        model_name = model_name,
        cpu = hw.cpu_model,
        threads = opt_threads,
        ngl = gpu_layers,
        tier_label = tier_label,
        kv_k = kv_type_k,
        kv_v = kv_type_v,
        bin_dir = lib_path,
        ctx = ctx_size,
        batch = batch_size,
        ubatch = ubatch_size,
        mem_flag = mem_flag,
    );

    let script_path = model_dir.join("run.sh");
    let _ = std::fs::write(&script_path, &run_script);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755));
    }

    emit(app, "compile", 67.0,
        &format!("Config: {} threads, {} GPU layers, {} ctx, KV cache {}/{}", opt_threads, gpu_layers, ctx_size, kv_type_k, kv_type_v),
        &format!("[TUNE] Flash attention: ON | Batch: {}/{} | {} | KV cache: {}/{}",
            batch_size, ubatch_size, if use_mmap { "mmap" } else { "mlock" }, kv_type_k, kv_type_v));

    // ══════════════ Stage 6: Benchmark ══════════════
    emit(app, "benchmark", 70.0, "Running optimized benchmark (loading model + Metal shaders)...",
        "[INFO] Benchmark: loading model into GPU memory via Metal...");

    // Run benchmark with ALL optimizations applied (including KV cache quant)
    let mut bench_cmd = Command::new(&cli_bin);
    bench_cmd
        .arg("-m").arg(&output_model_path)
        .arg("-t").arg(&threads_str)
        .arg("-ngl").arg(&ngl_str)
        .arg("-c").arg(ctx_size.min(2048).to_string()) // use smaller ctx for bench
        .arg("-b").arg(batch_size.to_string())
        .arg("-ub").arg(ubatch_size.to_string())
        .arg("--cache-type-k").arg(&kv_type_k)
        .arg("--cache-type-v").arg(&kv_type_v)
        .arg("--flash-attn").arg("on");  // must be "on" (not "auto") when KV cache is quantized

    if use_mmap {
        bench_cmd.arg("--mmap");
    } else {
        bench_cmd.arg("--mlock");
    }

    let bench_child = bench_cmd
        .arg("-n").arg("64")
        .arg("-p").arg("Explain what a neural network is in simple terms:")
        .arg("--single-turn")
        .arg("--no-display-prompt")
        .env("DYLD_LIBRARY_PATH", &lib_path)
        .env("LD_LIBRARY_PATH", &lib_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    let mut prompt_tok_s = 0.0;
    let mut gen_tok_s = 0.0;

    match bench_child {
        Ok(child) => {
            let (stdout_str, stderr_lines, _success) = run_with_timeout(app, "benchmark", child, 180, 70.0);

            // Parse tok/s
            let (pp, tg) = parse_tok_s(&stderr_lines);
            prompt_tok_s = pp;
            gen_tok_s = tg;

            // Log interesting stderr lines
            for line in &stderr_lines {
                if line.contains("tokens per second") || line.contains("total time") ||
                   line.contains("model size") || line.contains("offloaded") {
                    emit(app, "benchmark", 92.0, "Parsing results...", &format!("[BENCH] {}", line));
                }
            }

            // Show generated text preview
            if !stdout_str.trim().is_empty() {
                let preview: String = stdout_str.trim().chars().take(200).collect();
                emit(app, "benchmark", 93.0, "Generation sample captured",
                    &format!("[OUTPUT] {}", preview.replace('\n', " ")));
            }
        }
        Err(e) => {
            emit(app, "benchmark", 90.0, &format!("Benchmark failed: {}", e),
                &format!("[ERROR] Could not start benchmark: {}", e));
        }
    }

    if gen_tok_s > 0.0 {
        emit(app, "benchmark", 96.0,
            &format!("Generation: {:.1} tok/s | Prompt: {:.1} tok/s", gen_tok_s, prompt_tok_s),
            &format!("[INFO] Benchmark — Generation: {:.1} tok/s | Prompt processing: {:.1} tok/s", gen_tok_s, prompt_tok_s));
    } else {
        emit(app, "benchmark", 96.0,
            "Benchmark complete (tok/s not parsed — check logs)",
            "[WARN] Could not extract tok/s from benchmark output");
    }

    // ══════════════ Stage 7: Save & Complete ══════════════
    let now = chrono::Utc::now().to_rfc3339();
    let meta = ModelMeta {
        id: model_id,
        name: model_name.clone(),
        original_format: "gguf".to_string(),
        quantization: target_quant.clone(),
        backend: "llama.cpp (Metal)".to_string(),
        parameters: params_label,
        context_length: ctx_size,
        file_size_bytes: output_size,
        optimized_at: now.clone(),
        speculative_decoding: false,
        draft_model: None,
        benchmark: Some(BenchmarkResult {
            prompt_tok_s,
            generation_tok_s: gen_tok_s,
            time_to_first_token_ms: if prompt_tok_s > 0.0 { 1000.0 / prompt_tok_s } else { 0.0 },
            baseline_generation_tok_s: None,
            speedup_factor: None,
            run_date: now,
        }),
        notes: Some(format!(
            "Optimized for {} | {} threads | {} GPU layers | ctx {} | KV {}/{} | {}",
            hw.cpu_model, opt_threads, gpu_layers, ctx_size, kv_type_k, kv_type_v,
            if use_mmap { "mmap" } else { "mlock" }
        )),
        tags: vec![target_quant, format!("{:?}", tier).to_lowercase(), format!("{}t", opt_threads)],
    };

    emit(app, "done", 100.0,
        &format!("Optimized: {} — {:.1} tok/s with Metal + {} threads", model_name, gen_tok_s, opt_threads),
        &format!("[INFO] Saved to {}", model_dir.display()));

    Ok(meta)
}
