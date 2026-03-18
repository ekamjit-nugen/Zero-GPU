use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<ChatMessageEntry>,
    pub created_at: String,
    pub updated_at: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageEntry {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub tokens_used: Option<u32>,
    pub generation_speed: Option<f64>,
}

fn conversations_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".zerogpu-forge")
        .join("conversations")
}

fn ensure_dir() -> Result<(), String> {
    fs::create_dir_all(conversations_dir())
        .map_err(|e| format!("Failed to create conversations directory: {}", e))
}

/// List all conversations.
pub fn list_conversations() -> Result<Vec<Conversation>, String> {
    ensure_dir()?;
    let dir = conversations_dir();
    let mut conversations = Vec::new();

    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read conversations dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<Conversation>(&content) {
                    Ok(conv) => conversations.push(conv),
                    Err(e) => {
                        tracing::warn!("Failed to parse {:?}: {}", path, e);
                    }
                },
                Err(e) => {
                    tracing::warn!("Failed to read {:?}: {}", path, e);
                }
            }
        }
    }

    // Sort by updated_at descending
    conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(conversations)
}

/// Get a single conversation by ID.
pub fn get_conversation(id: &str) -> Result<Conversation, String> {
    let path = conversations_dir().join(format!("{}.json", id));
    let content =
        fs::read_to_string(&path).map_err(|e| format!("Conversation '{}' not found: {}", id, e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse conversation: {}", e))
}

/// Save a conversation (create or update).
pub fn save_conversation(conversation: &Conversation) -> Result<(), String> {
    ensure_dir()?;
    let path = conversations_dir().join(format!("{}.json", conversation.id));
    let content = serde_json::to_string_pretty(conversation)
        .map_err(|e| format!("Failed to serialize conversation: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write conversation: {}", e))
}

/// Delete a conversation by ID.
pub fn delete_conversation(id: &str) -> Result<(), String> {
    let path = conversations_dir().join(format!("{}.json", id));
    if !path.exists() {
        return Err(format!("Conversation '{}' not found", id));
    }
    fs::remove_file(&path).map_err(|e| format!("Failed to delete conversation: {}", e))
}
