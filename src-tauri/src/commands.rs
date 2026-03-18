use crate::config as app_config;
use crate::config::AppConfig;
use crate::conversations::{self, Conversation};
use crate::hardware::{self, HardwareInfo, SystemStats};
use crate::inference;
use crate::license::{self, LicenseInfo, LicenseTier};
use crate::models::{ModelLibrary, ModelMeta};
use crate::optimizer;
use crate::server::{ServerConfig, ServerState, ServerStatus};
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Managed state for the server.
pub struct ManagedServerState(pub Mutex<ServerState>);

#[tauri::command]
pub fn get_hardware_info() -> HardwareInfo {
    hardware::detect_hardware()
}

#[tauri::command]
pub async fn get_system_stats() -> SystemStats {
    tokio::task::spawn_blocking(hardware::get_system_stats)
        .await
        .unwrap_or_else(|_| hardware::SystemStats {
            cpu_usage_percent: 0.0,
            per_core_usage: vec![],
            ram_used_gb: 0.0,
            ram_total_gb: 0.0,
            ram_percent: 0.0,
            swap_used_gb: 0.0,
            swap_total_gb: 0.0,
            gpu_mem_used_gb: 0.0,
            gpu_mem_total_gb: 0.0,
            gpu_percent: 0.0,
            inference_active: false,
            inference_mem_mb: 0.0,
            inference_cpu_percent: 0.0,
        })
}

#[tauri::command]
pub fn validate_license(key: String) -> Result<LicenseInfo, String> {
    let tier = license::validate_license_key(&key)?;
    license::save_license(&key)?;

    let now = chrono::Utc::now().to_rfc3339();
    Ok(LicenseInfo {
        tier,
        key_masked: license::mask_key(&key),
        activated_at: Some(now),
    })
}

#[tauri::command]
pub fn get_license_status() -> LicenseInfo {
    match license::load_license() {
        Some(key) => {
            let tier = license::validate_license_key(&key).unwrap_or(LicenseTier::Free);
            LicenseInfo {
                tier,
                key_masked: license::mask_key(&key),
                activated_at: None,
            }
        }
        None => LicenseInfo {
            tier: LicenseTier::Free,
            key_masked: String::new(),
            activated_at: None,
        },
    }
}

#[tauri::command]
pub fn get_models() -> Result<Vec<ModelMeta>, String> {
    let library = ModelLibrary::new();
    library.list_models()
}

#[tauri::command]
pub fn delete_model(id: String) -> Result<(), String> {
    let library = ModelLibrary::new();
    library.delete_model(&id)
}

#[tauri::command]
pub fn get_config() -> AppConfig {
    app_config::load_config()
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    app_config::save_config(&config)
}

#[tauri::command]
pub async fn start_optimization(app: AppHandle, model_path: String) -> Result<String, String> {
    // Run the pipeline in a blocking thread to not block the main thread
    let result = tokio::task::spawn_blocking(move || {
        let hw = hardware::detect_hardware();
        let backend = optimizer::select_backend(&hw);
        let quant = optimizer::select_quantization(&backend, 7.0, &hw);

        let config = optimizer::OptimizationConfig {
            model_path,
            backend,
            quantization_format: quant,
            enable_speculative: false,
            draft_model_path: None,
            thread_count: hw.physical_cores.max(1),
        };

        let meta = optimizer::run_pipeline(&app, config, &hw)?;
        let id = meta.id.clone();

        // Save the model metadata
        let library = ModelLibrary::new();
        library.save_model_meta(&meta)?;

        Ok::<String, String>(id)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}

#[tauri::command]
pub fn get_server_status(state: State<'_, ManagedServerState>) -> ServerStatus {
    let server = state.0.lock().unwrap();
    server.status()
}

#[tauri::command]
pub fn toggle_server(
    enabled: bool,
    state: State<'_, ManagedServerState>,
) -> Result<ServerStatus, String> {
    let mut server = state.0.lock().unwrap();
    if enabled {
        let config = ServerConfig::default();
        server.start(&config)
    } else {
        server.stop()
    }
}

#[tauri::command]
pub fn get_conversations() -> Result<Vec<Conversation>, String> {
    conversations::list_conversations()
}

#[tauri::command]
pub fn save_conversation(conversation: Conversation) -> Result<(), String> {
    conversations::save_conversation(&conversation)
}

#[tauri::command]
pub fn delete_conversation(id: String) -> Result<(), String> {
    conversations::delete_conversation(&id)
}

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    model_id: String,
    prompt: String,
    system_prompt: String,
    temperature: f64,
    top_p: f64,
    top_k: u32,
    max_tokens: u32,
) -> Result<(), String> {
    let hw = hardware::detect_hardware();

    // Read actual model parameters from meta.json instead of hardcoding 7.0
    let library = ModelLibrary::new();
    let model_meta = library.get_model(&model_id).ok();
    let params_b = model_meta
        .as_ref()
        .and_then(|m| {
            m.parameters
                .trim_end_matches('B')
                .trim_end_matches('+')
                .parse::<f64>()
                .ok()
        })
        .unwrap_or(7.0);

    let threads = crate::optimizer::optimal_threads(&hw);
    let gpu_layers = crate::optimizer::metal_gpu_layers(&hw, params_b);
    let (ctx_size, batch_size, ubatch_size, use_mmap, kv_cache_type_k, kv_cache_type_v) =
        crate::optimizer::adaptive_inference_params(&hw, params_b);

    let config = inference::ChatConfig {
        model_id,
        temperature,
        top_p,
        top_k,
        max_tokens,
        threads,
        gpu_layers,
        ctx_size,
        batch_size,
        ubatch_size,
        use_mmap,
        kv_cache_type_k,
        kv_cache_type_v,
    };

    tokio::task::spawn_blocking(move || {
        inference::run_chat(&app, &prompt, &system_prompt, &config)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
