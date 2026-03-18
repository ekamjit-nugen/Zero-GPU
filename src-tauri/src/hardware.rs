use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub os: String,
    pub arch: String,
    pub cpu_model: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_features: Vec<String>,
    pub apple_silicon_gen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResourceTier {
    /// ≤8 GB RAM, ≤4 cores — aggressive memory savings
    Minimal,
    /// 8–16 GB RAM — balanced
    Standard,
    /// >16 GB RAM — full quality
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceEstimate {
    pub estimated_tok_s: f64,
    pub recommended_quantization: String,
    pub fits_in_memory: bool,
    pub recommended_threads: usize,
    pub resource_tier: ResourceTier,
}

/// Classify the system into a resource tier based on TOTAL RAM (not available — that fluctuates).
pub fn resource_tier(hw: &HardwareInfo) -> ResourceTier {
    if hw.total_ram_gb <= 8.0 {
        ResourceTier::Minimal   // 8 GB machines
    } else if hw.total_ram_gb <= 16.0 {
        ResourceTier::Standard  // 16 GB machines (e.g. M1 Pro 16GB)
    } else {
        ResourceTier::High      // 32 GB+
    }
}

/// Detect hardware capabilities using sysinfo.
pub fn detect_hardware() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    let cpu_model = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let physical_cores = System::physical_core_count().unwrap_or(0);
    let logical_cores = sys.cpus().len();

    let total_ram_gb = sys.total_memory() as f64 / 1_073_741_824.0;
    let available_ram_gb = sys.available_memory() as f64 / 1_073_741_824.0;

    let cpu_features = detect_cpu_features(&os, &arch);
    let apple_silicon_gen = detect_apple_silicon_gen(&cpu_model);

    HardwareInfo {
        os,
        arch,
        cpu_model,
        physical_cores,
        logical_cores,
        total_ram_gb,
        available_ram_gb,
        cpu_features,
        apple_silicon_gen,
    }
}

/// Estimate performance for a given model size.
pub fn estimate_performance(hw: &HardwareInfo, model_params_b: f64) -> PerformanceEstimate {
    // Rough heuristic: Q4 uses ~0.5 GB per billion parameters
    let estimated_model_size_gb = model_params_b * 0.5;
    let fits_in_memory = estimated_model_size_gb < hw.available_ram_gb * 0.85;

    let recommended_threads = if hw.physical_cores > 2 {
        hw.physical_cores - 1
    } else {
        1
    };

    // Rough tok/s estimate based on hardware and model size
    let base_tok_s = if hw.apple_silicon_gen.is_some() {
        // Apple Silicon is generally faster for LLM inference via MLX
        match hw.apple_silicon_gen.as_deref() {
            Some("M4") => 45.0,
            Some("M3") => 35.0,
            Some("M2") => 28.0,
            Some("M1") => 20.0,
            _ => 15.0,
        }
    } else if hw.cpu_features.contains(&"AVX512".to_string()) {
        25.0
    } else if hw.cpu_features.contains(&"AVX2".to_string()) {
        18.0
    } else {
        10.0
    };

    // Scale inversely with model size (7B baseline)
    let estimated_tok_s = base_tok_s * (7.0 / model_params_b).sqrt();

    let tier = resource_tier(hw);
    let recommended_quantization = match tier {
        ResourceTier::Minimal => {
            if model_params_b > 7.0 { "IQ3_XS".to_string() }
            else { "IQ4_XS".to_string() }
        }
        ResourceTier::Standard => "Q4_K_M".to_string(),
        ResourceTier::High => "Q5_K_M".to_string(),
    };

    PerformanceEstimate {
        estimated_tok_s,
        recommended_quantization,
        fits_in_memory,
        recommended_threads,
        resource_tier: tier,
    }
}

fn detect_cpu_features(os: &str, arch: &str) -> Vec<String> {
    let mut features = Vec::new();

    match (os, arch) {
        ("macos", "aarch64") => {
            features.push("NEON".to_string());
            // M-series chips support AMX
            features.push("AMX".to_string());
        }
        ("linux", _) | ("windows", _) => {
            #[cfg(any(target_arch = "x86_64", target_arch = "x86"))]
            {
                if std::arch::is_x86_feature_detected!("avx2") {
                    features.push("AVX2".to_string());
                }
                if std::arch::is_x86_feature_detected!("avx512f") {
                    features.push("AVX512".to_string());
                }
            }
            #[cfg(target_arch = "aarch64")]
            {
                features.push("NEON".to_string());
            }
        }
        _ => {}
    }

    // Fallback: try reading /proc/cpuinfo on Linux
    #[cfg(target_os = "linux")]
    if features.is_empty() {
        if let Ok(cpuinfo) = std::fs::read_to_string("/proc/cpuinfo") {
            if cpuinfo.contains("avx2") {
                features.push("AVX2".to_string());
            }
            if cpuinfo.contains("avx512") {
                features.push("AVX512".to_string());
            }
        }
    }

    features
}

/// Real-time system resource stats for the monitoring panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage_percent: f64,
    pub per_core_usage: Vec<f64>,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub ram_percent: f64,
    pub swap_used_gb: f64,
    pub swap_total_gb: f64,
    /// Estimated GPU memory usage (Apple Silicon shared memory heuristic)
    pub gpu_mem_used_gb: f64,
    pub gpu_mem_total_gb: f64,
    pub gpu_percent: f64,
    /// Whether an inference process (llama-cli) is currently running
    pub inference_active: bool,
    /// RSS of the inference process in MB (0 if not running)
    pub inference_mem_mb: f64,
    /// CPU% of the inference process (0 if not running)
    pub inference_cpu_percent: f64,
}

/// Collect real-time system resource stats.
pub fn get_system_stats() -> SystemStats {
    let mut sys = System::new_all();
    sys.refresh_all();
    // Small sleep to let CPU counters settle, then refresh CPU again
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_all();

    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>()
        / sys.cpus().len().max(1) as f64;
    let per_core: Vec<f64> = sys.cpus().iter().map(|c| c.cpu_usage() as f64).collect();

    let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let ram_used = (sys.total_memory() - sys.available_memory()) as f64 / 1_073_741_824.0;
    let ram_percent = if ram_total > 0.0 { (ram_used / ram_total) * 100.0 } else { 0.0 };

    let swap_total = sys.total_swap() as f64 / 1_073_741_824.0;
    let swap_used = sys.used_swap() as f64 / 1_073_741_824.0;

    // Find llama-cli process for inference-specific stats
    let mut inference_active = false;
    let mut inference_mem_mb = 0.0;
    let mut inference_cpu_percent = 0.0;

    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("llama-cli") || name.contains("llama_cli") {
            inference_active = true;
            inference_mem_mb = process.memory() as f64 / 1_048_576.0;
            inference_cpu_percent = process.cpu_usage() as f64;
            break;
        }
    }

    // GPU memory estimate for Apple Silicon (shared memory architecture)
    // Heuristic: GPU uses a portion of RAM, estimated from inference process footprint
    let gpu_mem_total = ram_total * 0.65; // shared memory pool
    let gpu_mem_used = if inference_active {
        // Rough: ~60% of inference process memory is on GPU when Metal is active
        (inference_mem_mb / 1024.0) * 0.6
    } else {
        0.0
    };
    let gpu_percent = if gpu_mem_total > 0.0 { (gpu_mem_used / gpu_mem_total) * 100.0 } else { 0.0 };

    SystemStats {
        cpu_usage_percent: cpu_usage,
        per_core_usage: per_core,
        ram_used_gb: ram_used,
        ram_total_gb: ram_total,
        ram_percent,
        swap_used_gb: swap_used,
        swap_total_gb: swap_total,
        gpu_mem_used_gb: gpu_mem_used,
        gpu_mem_total_gb: gpu_mem_total,
        gpu_percent,
        inference_active,
        inference_mem_mb,
        inference_cpu_percent,
    }
}

fn detect_apple_silicon_gen(cpu_model: &str) -> Option<String> {
    let model_lower = cpu_model.to_lowercase();
    // Match "apple m1", "apple m2", etc. — check longer variants first to avoid
    // "m1" matching inside unrelated substrings. Use word-boundary-like checks.
    for gen in ["m4", "m3", "m2", "m1"] {
        // Match patterns like "apple m1", "apple m1 pro", "apple m1 max", "apple m1 ultra"
        if model_lower.contains(&format!("apple {gen}")) {
            return Some(gen.to_uppercase());
        }
    }

    // Fallback: use macOS sysctl for reliable detection
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("sysctl")
            .args(["-n", "machdep.cpu.brand_string"])
            .output()
        {
            let brand = String::from_utf8_lossy(&output.stdout).to_lowercase();
            for gen in ["m4", "m3", "m2", "m1"] {
                if brand.contains(&format!("apple {gen}")) {
                    return Some(gen.to_uppercase());
                }
            }
        }
    }

    None
}
