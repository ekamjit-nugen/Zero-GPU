use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatToken {
    pub token: String,
    pub done: bool,
    pub tok_s: f64,
    pub tokens_generated: u32,
    pub prompt_tok_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatConfig {
    pub model_id: String,
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub max_tokens: u32,
    pub threads: usize,
    pub gpu_layers: u32,
    pub ctx_size: u32,
    pub batch_size: u32,
    pub ubatch_size: u32,
    pub use_mmap: bool,
    pub kv_cache_type_k: String,
    pub kv_cache_type_v: String,
}

impl Default for ChatConfig {
    fn default() -> Self {
        Self {
            model_id: String::new(),
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: 2048,
            threads: 8,
            gpu_layers: 33,
            ctx_size: 8192,
            batch_size: 512,
            ubatch_size: 256,
            use_mmap: false,
            kv_cache_type_k: "q8_0".to_string(),
            kv_cache_type_v: "q8_0".to_string(),
        }
    }
}

/// Managed state for the running inference process.
pub struct InferenceState {
    pub child: Option<Child>,
    pub model_id: String,
}

impl InferenceState {
    pub fn new() -> Self {
        Self {
            child: None,
            model_id: String::new(),
        }
    }

    pub fn kill(&mut self) {
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.child = None;
        self.model_id.clear();
    }
}

fn find_binaries_dir() -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));
        let resources_bin = exe_dir.parent().unwrap_or(exe_dir).join("Resources").join("binaries");
        if resources_bin.join("llama-cli").exists() {
            return Ok(resources_bin);
        }
        let sibling_bin = exe_dir.join("binaries");
        if sibling_bin.join("llama-cli").exists() {
            return Ok(sibling_bin);
        }
    }
    for p in &[PathBuf::from("binaries"), PathBuf::from("src-tauri/binaries")] {
        if p.join("llama-cli").exists() {
            return Ok(p.clone());
        }
    }
    let project_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    if project_bin.join("llama-cli").exists() {
        return Ok(project_bin);
    }
    Err("Could not find llama.cpp binaries.".to_string())
}

fn get_model_path(model_id: &str) -> Result<PathBuf, String> {
    let model_dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".zerogpu-forge")
        .join("models")
        .join(model_id)
        .join("model.gguf");
    if model_dir.exists() {
        Ok(model_dir)
    } else {
        Err(format!("Model not found: {}", model_id))
    }
}

/// Extract clean response text from llama-cli stdout.
///
/// With --no-display-prompt, llama-cli outputs only the generated text
/// followed by optional stats lines like `\n[...]` or `\nExiting...`.
/// We strip those trailing artifacts.
fn extract_response_text(full_output: &str) -> String {
    let mut clean = full_output.to_string();

    // Remove trailing stats line: "\n[ Prompt: ... ]" or "\n[end of text]"
    if let Some(pos) = clean.rfind("\n[") {
        // Only strip if it looks like a stats/info line (contains ']')
        if clean[pos..].contains(']') {
            clean.truncate(pos);
        }
    }

    // Remove "Exiting..." line
    if let Some(pos) = clean.rfind("\nExiting") {
        clean.truncate(pos);
    }

    // Also handle the case where the prompt marker "> " appears
    // (some llama-cli versions still echo it even with --no-display-prompt)
    if let Some(pos) = clean.find("\n> ") {
        let rest = &clean[pos + 3..];
        if let Some(nl) = rest.find('\n') {
            clean = rest[nl..].trim_start_matches('\n').to_string();
        }
    }

    clean.trim_end().to_string()
}

/// Run a single chat completion: send prompt, stream tokens back via events, return stats.
pub fn run_chat(
    app: &AppHandle,
    prompt: &str,
    system_prompt: &str,
    config: &ChatConfig,
) -> Result<(), String> {
    let bin_dir = find_binaries_dir()?;
    let cli_bin = bin_dir.join("llama-cli");
    let lib_path = bin_dir.to_string_lossy().to_string();
    let model_path = get_model_path(&config.model_id)?;

    // Build prompt — llama-cli applies the model's chat template automatically
    // in conversation mode, so we just pass user text via -p
    let full_prompt = prompt.to_string();

    let mut cmd = Command::new(&cli_bin);
    cmd.arg("-m").arg(&model_path)
        .arg("-t").arg(config.threads.to_string())
        .arg("-ngl").arg(config.gpu_layers.to_string())
        .arg("-c").arg(config.ctx_size.to_string())
        .arg("-n").arg(config.max_tokens.to_string())
        .arg("--temp").arg(format!("{:.2}", config.temperature))
        .arg("--top-p").arg(format!("{:.2}", config.top_p))
        .arg("--top-k").arg(config.top_k.to_string())
        .arg("-p").arg(&full_prompt)
        .arg("--single-turn")
        .arg("--simple-io")          // cleaner IO for subprocess piping
        .arg("--no-display-prompt")  // don't echo prompt — cleaner streaming
        .arg("-b").arg(config.batch_size.to_string())
        .arg("-ub").arg(config.ubatch_size.to_string())
        .arg("--cache-type-k").arg(&config.kv_cache_type_k)
        .arg("--cache-type-v").arg(&config.kv_cache_type_v)
        .arg("--flash-attn").arg("on");

    // Set system prompt via --chat-template-kwargs or -sys if the model supports it
    if !system_prompt.is_empty() {
        cmd.arg("-sys").arg(system_prompt);
    }

    if config.use_mmap {
        cmd.arg("--mmap");
    } else {
        cmd.arg("--mlock");
    }

    let mut child = cmd
        .env("DYLD_LIBRARY_PATH", &lib_path)
        .env("LD_LIBRARY_PATH", &lib_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start inference: {}", e))?;

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let stderr = child.stderr.take();

    // Read stderr in background to capture perf stats
    let perf_data = Arc::new(Mutex::new((0.0_f64, 0.0_f64)));
    let perf_clone = perf_data.clone();

    let stderr_handle = std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if line.contains("tokens per second") {
                    if let Some(pos) = line.find("tokens per second") {
                        let before = &line[..pos].trim_end();
                        if let Some(comma_pos) = before.rfind(',') {
                            let num_part = before[comma_pos + 1..].trim();
                            if let Ok(val) = num_part.parse::<f64>() {
                                let mut data = perf_clone.lock().unwrap();
                                if line.contains("prompt eval") {
                                    data.0 = val;
                                } else {
                                    data.1 = val;
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // With --no-display-prompt, stdout contains only generated tokens.
    // Stream chunks directly as they arrive — much more reliable across
    // different llama-cli versions than trying to parse conversation UI.
    let mut reader = BufReader::new(stdout);
    let mut buf = [0u8; 128];
    let mut raw_output = String::new();
    let mut token_count: u32 = 0;
    let start_time = std::time::Instant::now();

    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                raw_output.push_str(&chunk);

                // Skip known artifacts that may still appear
                // (stats lines, exit messages)
                if chunk.starts_with("\n[") || chunk.starts_with("Exiting") {
                    continue;
                }

                token_count += chunk.split_whitespace().count() as u32;
                let elapsed = start_time.elapsed().as_secs_f64();
                let current_tok_s = if elapsed > 0.5 {
                    token_count as f64 / elapsed
                } else {
                    0.0
                };

                let _ = app.emit("chat-token", ChatToken {
                    token: chunk,
                    done: false,
                    tok_s: current_tok_s,
                    tokens_generated: token_count,
                    prompt_tok_s: 0.0,
                });
            }
            Err(_) => break,
        }
    }

    // Wait for process and stderr to finish
    let _ = child.wait();
    let _ = stderr_handle.join();

    let perf = perf_data.lock().unwrap();
    let final_gen_tok_s = if perf.1 > 0.0 {
        perf.1
    } else {
        let elapsed = start_time.elapsed().as_secs_f64();
        if elapsed > 0.1 { token_count as f64 / elapsed } else { 0.0 }
    };

    let _ = app.emit("chat-token", ChatToken {
        token: String::new(),
        done: true,
        tok_s: final_gen_tok_s,
        tokens_generated: token_count,
        prompt_tok_s: perf.0,
    });

    Ok(())
}
