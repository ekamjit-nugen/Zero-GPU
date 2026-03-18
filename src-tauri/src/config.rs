use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    pub theme: String,
    pub model_storage_path: String,
    pub default_generation: GenerationDefaults,
    pub server: ServerDefaults,
    pub inference: InferenceDefaults,
    pub updates: UpdateDefaults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationDefaults {
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub max_tokens: u32,
    pub repeat_penalty: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerDefaults {
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub rate_limit_rpm: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceDefaults {
    pub thread_count: String,
    pub gpu_layers: String,
    pub context_length: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDefaults {
    pub auto_check: bool,
    pub channel: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let model_storage = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".zerogpu-forge")
            .join("models")
            .to_string_lossy()
            .to_string();

        Self {
            version: "1.0.0".to_string(),
            theme: "system".to_string(),
            model_storage_path: model_storage,
            default_generation: GenerationDefaults {
                temperature: 0.7,
                top_p: 0.9,
                top_k: 40,
                max_tokens: 2048,
                repeat_penalty: 1.1,
            },
            server: ServerDefaults {
                port: 8080,
                cors_origins: vec!["*".to_string()],
                rate_limit_rpm: 60,
            },
            inference: InferenceDefaults {
                thread_count: "auto".to_string(),
                gpu_layers: "auto".to_string(),
                context_length: 4096,
            },
            updates: UpdateDefaults {
                auto_check: true,
                channel: "stable".to_string(),
            },
        }
    }
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".zerogpu-forge")
        .join("config.json")
}

/// Load configuration from disk, returning defaults if not found.
pub fn load_config() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// Save configuration to disk.
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
}
