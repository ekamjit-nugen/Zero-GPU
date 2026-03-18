use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub rate_limit_rpm: u32,
    pub api_key: Option<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            cors_origins: vec!["*".to_string()],
            rate_limit_rpm: 60,
            api_key: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub model_loaded: Option<String>,
    pub uptime_seconds: u64,
    pub requests_served: u64,
}

impl Default for ServerStatus {
    fn default() -> Self {
        Self {
            running: false,
            port: 8080,
            model_loaded: None,
            uptime_seconds: 0,
            requests_served: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    pub usage: ChatUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatMessage,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Server state manager (stub implementation).
pub struct ServerState {
    status: ServerStatus,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            status: ServerStatus::default(),
        }
    }

    /// Stub: Start the server.
    pub fn start(&mut self, config: &ServerConfig) -> Result<ServerStatus, String> {
        self.status.running = true;
        self.status.port = config.port;
        tracing::info!("Server started on port {}", config.port);
        Ok(self.status.clone())
    }

    /// Stub: Stop the server.
    pub fn stop(&mut self) -> Result<ServerStatus, String> {
        self.status.running = false;
        self.status.uptime_seconds = 0;
        self.status.requests_served = 0;
        self.status.model_loaded = None;
        tracing::info!("Server stopped");
        Ok(self.status.clone())
    }

    pub fn status(&self) -> ServerStatus {
        self.status.clone()
    }
}
