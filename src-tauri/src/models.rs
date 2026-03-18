use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMeta {
    pub id: String,
    pub name: String,
    pub original_format: String,
    pub quantization: String,
    pub backend: String,
    pub parameters: String,
    pub context_length: u32,
    pub file_size_bytes: u64,
    pub optimized_at: String,
    pub speculative_decoding: bool,
    pub draft_model: Option<String>,
    pub benchmark: Option<BenchmarkResult>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub prompt_tok_s: f64,
    pub generation_tok_s: f64,
    pub time_to_first_token_ms: f64,
    pub baseline_generation_tok_s: Option<f64>,
    pub speedup_factor: Option<f64>,
    pub run_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SpeedRating {
    Blazing,
    Fast,
    Moderate,
    Slow,
}

impl SpeedRating {
    pub fn from_tok_s(tok_s: f64) -> Self {
        if tok_s > 30.0 {
            SpeedRating::Blazing
        } else if tok_s > 20.0 {
            SpeedRating::Fast
        } else if tok_s < 15.0 {
            SpeedRating::Moderate
        } else {
            SpeedRating::Slow
        }
    }
}

pub struct ModelLibrary {
    base_path: PathBuf,
}

impl ModelLibrary {
    pub fn new() -> Self {
        let base_path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".zerogpu-forge")
            .join("models");
        Self { base_path }
    }

    /// Ensure the models directory exists.
    pub fn ensure_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.base_path)
            .map_err(|e| format!("Failed to create models directory: {}", e))
    }

    /// List all models by reading meta.json from each subdirectory.
    pub fn list_models(&self) -> Result<Vec<ModelMeta>, String> {
        self.ensure_dir()?;
        let mut models = Vec::new();

        let entries = fs::read_dir(&self.base_path)
            .map_err(|e| format!("Failed to read models directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let meta_path = entry.path().join("meta.json");
            if meta_path.exists() {
                match fs::read_to_string(&meta_path) {
                    Ok(content) => match serde_json::from_str::<ModelMeta>(&content) {
                        Ok(meta) => models.push(meta),
                        Err(e) => {
                            tracing::warn!("Failed to parse {:?}: {}", meta_path, e);
                        }
                    },
                    Err(e) => {
                        tracing::warn!("Failed to read {:?}: {}", meta_path, e);
                    }
                }
            }
        }

        Ok(models)
    }

    /// Get a single model by ID.
    pub fn get_model(&self, id: &str) -> Result<ModelMeta, String> {
        let meta_path = self.base_path.join(id).join("meta.json");
        let content = fs::read_to_string(&meta_path)
            .map_err(|e| format!("Model '{}' not found: {}", id, e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse model meta: {}", e))
    }

    /// Delete a model directory.
    pub fn delete_model(&self, id: &str) -> Result<(), String> {
        let model_path = self.base_path.join(id);
        if !model_path.exists() {
            return Err(format!("Model '{}' not found", id));
        }
        fs::remove_dir_all(&model_path)
            .map_err(|e| format!("Failed to delete model '{}': {}", id, e))
    }

    /// Save model metadata to its directory.
    pub fn save_model_meta(&self, meta: &ModelMeta) -> Result<(), String> {
        let model_dir = self.base_path.join(&meta.id);
        fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Failed to create model directory: {}", e))?;

        let meta_path = model_dir.join("meta.json");
        let content = serde_json::to_string_pretty(meta)
            .map_err(|e| format!("Failed to serialize model meta: {}", e))?;
        fs::write(&meta_path, content)
            .map_err(|e| format!("Failed to write model meta: {}", e))
    }
}
