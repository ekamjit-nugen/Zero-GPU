mod commands;
mod config;
mod conversations;
mod hardware;
mod inference;
mod license;
mod models;
mod optimizer;
mod server;

use commands::ManagedServerState;
use server::ServerState;
use std::sync::Mutex;

/// Ensure the ~/.zerogpu-forge/ directory structure exists.
fn ensure_app_directories() {
    let base = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".zerogpu-forge");

    let dirs = [
        base.clone(),
        base.join("models"),
        base.join("conversations"),
    ];

    for dir in &dirs {
        if let Err(e) = std::fs::create_dir_all(dir) {
            eprintln!("Failed to create directory {:?}: {}", dir, e);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    // Ensure app directories exist
    ensure_app_directories();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ManagedServerState(Mutex::new(ServerState::new())))
        .invoke_handler(tauri::generate_handler![
            commands::get_hardware_info,
            commands::get_system_stats,
            commands::validate_license,
            commands::get_license_status,
            commands::get_models,
            commands::delete_model,
            commands::get_config,
            commands::save_config,
            commands::start_optimization,
            commands::get_server_status,
            commands::toggle_server,
            commands::get_conversations,
            commands::save_conversation,
            commands::delete_conversation,
            commands::send_chat_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
