# ZeroGPU Forge

**Run any LLM at max speed on plain hardware — no cloud, no API keys, fully local.**

ZeroGPU Forge automatically detects your hardware, quantizes models to fit your RAM, offloads to GPU (Metal/CUDA), and tunes every parameter for maximum speed. Available as a desktop GUI app (macOS) and a CLI tool (macOS + Linux).

---

## Features

- **One-click model optimization** — drop a GGUF file and get a hardware-tuned model
- **Adaptive hardware detection** — auto-configures threads, GPU layers, context size, KV cache
- **Apple Metal GPU acceleration** — full GPU offload on M1/M2/M3/M4
- **NVIDIA CUDA support** — GPU acceleration on Linux with NVIDIA GPUs
- **KV cache quantization** — run 32K+ context on 8GB RAM
- **CLI + GUI** — terminal chat or full desktop app
- **Real-time system monitor** — CPU, RAM, GPU usage during inference
- **Model library** — manage multiple optimized models
- **File prompts** — send long prompts from files (no terminal buffer limits)

---

## Quick Start

### macOS (Apple Silicon or Intel)

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
bash scripts/install-mac.sh
```

### Ubuntu / Linux

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
bash scripts/install-ubuntu.sh
```

### Download a model

```bash
bash scripts/download-model.sh
```

### Optimize and chat

```bash
zerogpu --optimize ~/.zerogpu-forge/downloads/qwen2.5-coder-7b-instruct-q4_k_m.gguf
zerogpu --model qwen2.5
```

---

## Installation — macOS

### Prerequisites

- macOS 12+ (Monterey or later)
- Apple Silicon (M1/M2/M3/M4) recommended, Intel supported
- 8 GB RAM minimum, 16 GB recommended

### Automated Install

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
bash scripts/install-mac.sh
```

This will:
1. Check for pre-bundled llama.cpp binaries (included for macOS ARM)
2. Install Rust if not present
3. Build the `zerogpu` CLI binary
4. Add `zerogpu` to your PATH

### Manual Install

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 2. Clone the repo
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU

# 3. Build CLI
cd src-tauri
cargo build --bin zerogpu --release

# 4. Add to PATH
sudo ln -sf "$(pwd)/target/release/zerogpu" /usr/local/bin/zerogpu

# 5. Verify
zerogpu --help
```

### GUI App (optional)

```bash
# Install Node.js 20+ (via nvm)
nvm install 20
nvm use 20

# Install dependencies and run
cd Zero_CPU
npm install
npm run tauri dev      # development mode
npm run tauri build    # production build (.dmg)
```

---

## Installation — Ubuntu / Linux

### Prerequisites

- Ubuntu 20.04+ / Debian 11+ / any modern Linux
- 8 GB RAM minimum for 7B models
- NVIDIA GPU optional (CUDA support auto-detected)

### Automated Install

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
bash scripts/install-ubuntu.sh
```

This will:
1. Install system dependencies (`build-essential`, `cmake`, `git`)
2. Detect NVIDIA GPU and optionally build with CUDA
3. Build llama.cpp from source (CPU or CUDA)
4. Install Rust if not present
5. Build the `zerogpu` CLI binary
6. Add `zerogpu` to your PATH

### Manual Install

```bash
# 1. Install dependencies
sudo apt update
sudo apt install -y build-essential cmake git curl pkg-config libssl-dev

# 2. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 3. Clone the repo
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU

# 4. Build llama.cpp from source
git clone --depth 1 https://github.com/ggerganov/llama.cpp .llama-cpp-build
cd .llama-cpp-build

# CPU only:
cmake -B build -DCMAKE_BUILD_TYPE=Release
# OR with CUDA:
cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release -j$(nproc)

# 5. Copy binaries
cp build/bin/llama-cli ../src-tauri/binaries/
cp build/bin/llama-quantize ../src-tauri/binaries/
cd ..

# 6. Build CLI
cd src-tauri
cargo build --bin zerogpu --release

# 7. Install
sudo ln -sf "$(pwd)/target/release/zerogpu" /usr/local/bin/zerogpu

# 8. Verify
zerogpu --help
```

### With NVIDIA CUDA

```bash
# Install NVIDIA drivers + CUDA (if not already present)
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit

# Verify
nvidia-smi
nvcc --version

# Then run the install script — it will auto-detect CUDA
bash scripts/install-ubuntu.sh
```

---

## CLI Usage

### Commands

```
zerogpu --help                              Show help
zerogpu --list                              List optimized models
zerogpu --optimize <path.gguf>              Optimize/quantize a model
zerogpu --model <name>                      Interactive chat
zerogpu --model <name> --ctx 32768          Chat with custom context size
zerogpu --model <name> -sys "prompt"        Chat with system prompt
zerogpu --model <name> -f prompt.txt        One-shot: read prompt from file
zerogpu --model <name> -p "question"        One-shot: inline prompt
zerogpu --delete <name|#>                   Delete a model
zerogpu --delete-all                        Delete ALL models
```

### Examples

```bash
# Download and optimize a model
bash scripts/download-model.sh              # pick Qwen2.5-Coder-7B
zerogpu --optimize ~/.zerogpu-forge/downloads/qwen2.5-coder-7b-instruct-q4_k_m.gguf

# Interactive chat (model stays in memory between turns)
zerogpu --model qwen2.5

# With system prompt
zerogpu --model qwen2.5 -sys "You are a senior Python developer"

# Long prompt from file (no terminal truncation)
echo "Your long prompt here..." > prompt.txt
zerogpu --model qwen2.5 --ctx 32768 -f prompt.txt

# Quick one-liner
zerogpu --model qwen2.5 -p "Write a Python fibonacci function"

# Manage models
zerogpu --list
zerogpu --delete 3          # delete model #3
zerogpu --delete-all        # delete everything
```

### Context Size (--ctx)

Default context is auto-detected based on your RAM:

| RAM | Default Context | Max Recommended |
|-----|----------------|-----------------|
| 8 GB | 4096 | 16384 |
| 16 GB | 8192 | 32768 |
| 32 GB+ | 8192 | 65536 |

With quantized KV cache, the memory cost is small:

| Context | KV Cache Memory (7B) | Total RAM |
|---------|---------------------|-----------|
| 4096 | ~96 MB | ~5 GB |
| 8192 | ~192 MB | ~5.1 GB |
| 16384 | ~384 MB | ~5.3 GB |
| 32768 | ~768 MB | ~5.7 GB |

---

## GUI App (macOS)

The desktop app provides:
- **Optimize** — drag-and-drop model optimization with progress tracking
- **Run** — chat interface with streaming tokens
- **Monitor** — real-time CPU, RAM, GPU usage dashboard
- **Server** — local OpenAI-compatible API server
- **Library** — manage optimized models
- **Settings** — configure defaults

### Run in development

```bash
cd Zero_CPU
npm install
npm run tauri dev
```

### Build for production

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/dmg/ZeroGPU Forge.dmg
```

---

## Hardware Optimization

ZeroGPU automatically tunes all inference parameters based on your hardware:

### Resource Tiers

| Tier | RAM | Quantization | Context | KV Cache | GPU Layers | Memory |
|------|-----|-------------|---------|----------|------------|--------|
| Minimal | ≤8 GB | IQ4_XS / Q3_K_S | 4096 | q4_0/q4_0 | Partial | mmap |
| Standard | ≤16 GB | Q4_K_M | 8192 | q8_0/q4_0 | Full | mlock |
| High | >16 GB | Q5_K_M | 8192 | q8_0/q8_0 | Full | mlock |

### Expected Performance (7B Q4 model)

| Hardware | Generation Speed | Prompt Speed |
|----------|-----------------|--------------|
| Apple M1 | 8-12 tok/s | 60-80 tok/s |
| Apple M1 Pro | 10-15 tok/s | 80-120 tok/s |
| Apple M2 Pro | 15-20 tok/s | 100-150 tok/s |
| Apple M3 Pro | 20-30 tok/s | 120-180 tok/s |
| Apple M4 | 30-45 tok/s | 150-200 tok/s |
| Intel i7 (AVX2) | 3-5 tok/s | 15-25 tok/s |
| AMD Ryzen 7 | 4-7 tok/s | 20-30 tok/s |
| NVIDIA RTX 3060 | 30-50 tok/s | 200-400 tok/s |
| NVIDIA RTX 4090 | 80-120 tok/s | 500-1000 tok/s |
| NVIDIA A10G (AWS) | 40-80 tok/s | 300-500 tok/s |

---

## AWS Deployment

### Recommended Instances

| Use Case | Instance | RAM | Cost | Speed |
|----------|----------|-----|------|-------|
| Testing | `t3.large` | 8 GB | $58/mo | 3-5 tok/s |
| Production (CPU) | `c7g.xlarge` | 8 GB | $101/mo | 8-12 tok/s |
| Production (GPU) | `g5.xlarge` | 16 GB + A10G | $720/mo | 40-80 tok/s |
| Budget GPU | `g5.xlarge` spot | 16 GB + A10G | ~$220/mo | 40-80 tok/s |

### Quick Deploy (Ubuntu on AWS)

```bash
# SSH into your EC2 instance
ssh -i key.pem ubuntu@your-instance-ip

# Clone and install
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
bash scripts/install-ubuntu.sh

# Download and optimize a model
bash scripts/download-model.sh
zerogpu --optimize ~/.zerogpu-forge/downloads/qwen2.5-coder-7b-instruct-q4_k_m.gguf

# Run
zerogpu --model qwen2.5
```

---

## Supported Models

Any GGUF format model works. Tested with:

| Model | Parameters | Q4 Size | Notes |
|-------|-----------|---------|-------|
| Qwen2.5-Coder | 0.5B / 1.5B / 7B | 0.4-4.4 GB | Best for coding |
| Qwen2.5 | 7B / 14B / 32B | 4.4-20 GB | General purpose |
| DeepSeek-R1-Distill | 7B / 14B | 4.5-8.5 GB | Reasoning/thinking |
| Llama 3.1 | 8B / 70B | 4.7-40 GB | General purpose |
| Mistral | 7B | 4.4 GB | General purpose |
| Phi-4-mini | 3.8B | 2.5 GB | Fast, small |
| CodeLlama | 7B / 13B / 34B | 4.4-20 GB | Code generation |
| Gemma 2 | 9B / 27B | 5.5-16 GB | Google's model |

### Where to get GGUF models

- **HuggingFace**: Search for "GGUF" — e.g. [TheBloke](https://huggingface.co/TheBloke), [bartowski](https://huggingface.co/bartowski)
- **Ollama**: `ollama pull qwen2.5-coder:7b` then find the blob in `~/.ollama/models/blobs/`
- **Download script**: `bash scripts/download-model.sh`

---

## Project Structure

```
Zero_CPU/
├── src/                          # React frontend (GUI)
│   ├── pages/
│   │   ├── OptimizePage.tsx      # Model optimization pipeline
│   │   ├── RunPage.tsx           # Chat interface
│   │   ├── MonitorPage.tsx       # System resource monitor
│   │   ├── ServerPage.tsx        # Local API server
│   │   ├── LibraryPage.tsx       # Model library
│   │   └── SettingsPage.tsx      # App settings
│   ├── components/
│   │   └── Navigation.tsx
│   └── types/index.ts
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs               # App entry + Tauri setup
│   │   ├── commands.rs           # Tauri IPC commands
│   │   ├── inference.rs          # LLM inference engine
│   │   ├── optimizer.rs          # Quantization pipeline
│   │   ├── hardware.rs           # Hardware detection + resource monitoring
│   │   ├── config.rs             # App configuration
│   │   ├── models.rs             # Model library management
│   │   ├── server.rs             # API server
│   │   ├── conversations.rs      # Chat history
│   │   ├── license.rs            # License validation
│   │   └── bin/
│   │       └── zerogpu.rs        # CLI binary
│   ├── binaries/                 # llama.cpp executables + libraries
│   └── Cargo.toml
├── scripts/
│   ├── install-mac.sh            # macOS installer
│   ├── install-ubuntu.sh         # Ubuntu/Linux installer
│   └── download-model.sh         # Model downloader
├── package.json
└── README.md
```

---

## Troubleshooting

### "command not found: zerogpu"

```bash
# macOS
source ~/.zshrc

# Linux
source ~/.bashrc

# Or use full path
./src-tauri/target/release/zerogpu --help
```

### "Could not find llama-cli binary"

Run from the project directory, or make sure binaries are at `src-tauri/binaries/llama-cli`.

On Linux, you need to build llama.cpp first:
```bash
bash scripts/install-ubuntu.sh
```

### "quantized V cache was requested, but this requires Flash Attention"

This is fixed in the latest version. The CLI now uses `--flash-attn on` (not `auto`).

### Context size errors

Increase context with `--ctx`:
```bash
zerogpu --model qwen2.5 --ctx 32768
```

### Long prompts get truncated when pasting

Save the prompt to a file and use `-f`:
```bash
zerogpu --model qwen2.5 --ctx 32768 -f prompt.txt
```

### High RAM usage

- Re-optimize the model: `zerogpu --delete-all && zerogpu --optimize model.gguf`
- The optimizer auto-selects quantization and KV cache settings for your RAM
- Use `--ctx` with a smaller value to reduce KV cache memory

### Slow generation

- Make sure all GPU layers are offloaded (check the config box on launch)
- On macOS: Apple Silicon is required for Metal GPU acceleration
- On Linux: NVIDIA GPU + CUDA build gives 5-10x speedup over CPU
- Consider a smaller model (1.5B or 3B) for faster responses

---

## License

MIT
