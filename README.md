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

## Prerequisites

| Requirement | macOS | Ubuntu / Linux |
|---|---|---|
| OS | macOS 12+ (Monterey or later) | Ubuntu 20.04+ / Debian 11+ / any modern Linux |
| CPU | Apple Silicon (M1/M2/M3/M4) recommended, Intel supported | Any x86_64 or ARM64 |
| RAM | 8 GB minimum, 16 GB recommended | 8 GB minimum for 7B models |
| GPU | Metal (automatic on Apple Silicon) | NVIDIA GPU optional (CUDA auto-detected) |
| Tools | Xcode Command Line Tools (`xcode-select --install`) | `build-essential`, `cmake`, `git`, `curl`, `pkg-config`, `libssl-dev`, `libglib2.0-dev`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libjavascriptcoregtk-4.1-dev`, `libsoup-3.0-dev` |
| Rust | Installed automatically by the install script, or manually via [rustup](https://rustup.rs) | Same |
| Node.js | 20+ (only needed for the GUI app) | Same |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
```

### 2. Run the install script

**macOS:**
```bash
bash scripts/install-mac.sh
```

**Ubuntu / Linux:**
```bash
bash scripts/install-ubuntu.sh
```

The install script will:
1. Build **llama.cpp** from source (with Metal on macOS ARM, optional CUDA on Linux)
2. Place the compiled binaries into `src-tauri/binaries/`
3. Install **Rust** if not already present
4. Build the **zerogpu** CLI binary
5. Add `zerogpu` to your `PATH`

> **Note:** The `src-tauri/binaries/` directory is not included in the git repository. The install script builds these binaries from source for your specific platform and hardware. See [Building llama.cpp Binaries](#building-llamacpp-binaries) for manual instructions.

### 3. Download a model

```bash
bash scripts/download-model.sh
```

### 4. Optimize and chat

```bash
zerogpu --optimize ~/.zerogpu-forge/downloads/qwen2.5-coder-7b-instruct-q4_k_m.gguf
zerogpu --model qwen2.5
```

---

## Building llama.cpp Binaries

The llama.cpp binaries (`llama-cli`, `llama-quantize`, `llama-bench`) are **not included in the repository** — they must be built from source for your platform. The install scripts handle this automatically, but you can also build them manually.

### macOS (Apple Silicon — with Metal)

```bash
# Install Xcode CLI tools if not present
xcode-select --install

# Clone and build llama.cpp
git clone --depth 1 https://github.com/ggerganov/llama.cpp .llama-cpp-build
cd .llama-cpp-build
cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=ON
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Copy binaries into the project
mkdir -p ../src-tauri/binaries
cp build/bin/llama-cli ../src-tauri/binaries/
cp build/bin/llama-quantize ../src-tauri/binaries/
cp build/bin/llama-bench ../src-tauri/binaries/
find build -name "*.dylib" -exec cp {} ../src-tauri/binaries/ \;
find build -name "*.metallib" -exec cp {} ../src-tauri/binaries/ \;
cd ..
```

### macOS (Intel — CPU only)

```bash
git clone --depth 1 https://github.com/ggerganov/llama.cpp .llama-cpp-build
cd .llama-cpp-build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

mkdir -p ../src-tauri/binaries
cp build/bin/llama-cli ../src-tauri/binaries/
cp build/bin/llama-quantize ../src-tauri/binaries/
cp build/bin/llama-bench ../src-tauri/binaries/
find build -name "*.dylib" -exec cp {} ../src-tauri/binaries/ \;
cd ..
```

### Ubuntu / Linux (CPU only)

```bash
sudo apt update
sudo apt install -y build-essential cmake git

git clone --depth 1 https://github.com/ggerganov/llama.cpp .llama-cpp-build
cd .llama-cpp-build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc)

mkdir -p ../src-tauri/binaries
cp build/bin/llama-cli ../src-tauri/binaries/
cp build/bin/llama-quantize ../src-tauri/binaries/
cp build/bin/llama-bench ../src-tauri/binaries/
find build -name "*.so" -exec cp {} ../src-tauri/binaries/ \;
cd ..
```

### Ubuntu / Linux (with NVIDIA CUDA)

```bash
# Install NVIDIA drivers + CUDA toolkit if not present
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit

# Verify GPU is visible
nvidia-smi
nvcc --version

# Build llama.cpp with CUDA
git clone --depth 1 https://github.com/ggerganov/llama.cpp .llama-cpp-build
cd .llama-cpp-build
cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc)

mkdir -p ../src-tauri/binaries
cp build/bin/llama-cli ../src-tauri/binaries/
cp build/bin/llama-quantize ../src-tauri/binaries/
cp build/bin/llama-bench ../src-tauri/binaries/
find build -name "*.so" -exec cp {} ../src-tauri/binaries/ \;
cd ..
```

### Verify binaries

After building, your `src-tauri/binaries/` directory should contain at minimum:

```
src-tauri/binaries/
├── llama-cli          # Main inference binary
├── llama-quantize     # Model quantization tool
├── llama-bench        # Benchmarking tool (optional)
├── *.dylib            # macOS shared libraries (Metal, BLAS, etc.)
└── *.so               # Linux shared libraries (if applicable)
```

---

## Manual Installation (without install script)

### macOS

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 2. Clone the repo
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU

# 3. Build llama.cpp binaries (see section above)

# 4. Build the ZeroGPU CLI
cd src-tauri
cargo build --bin zerogpu --release

# 5. Add to PATH
sudo ln -sf "$(pwd)/target/release/zerogpu" /usr/local/bin/zerogpu

# 6. Verify
zerogpu --help
```

### Ubuntu / Linux

```bash
# 1. Install system dependencies
sudo apt update
sudo apt install -y build-essential cmake git curl pkg-config libssl-dev \
    libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev libpango1.0-dev libatk1.0-dev libgdk-pixbuf-2.0-dev

# 2. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 3. Clone the repo
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU

# 4. Build llama.cpp binaries (see section above)

# 5. Build the ZeroGPU CLI
cd src-tauri
cargo build --bin zerogpu --release

# 6. Add to PATH
sudo ln -sf "$(pwd)/target/release/zerogpu" /usr/local/bin/zerogpu

# 7. Verify
zerogpu --help
```

### GUI App (optional — macOS)

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

## Run on Ubuntu (Step-by-Step)

### Step 1: Install system dependencies

```bash
sudo apt update
sudo apt install -y build-essential cmake git curl pkg-config libssl-dev \
    libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev libpango1.0-dev libatk1.0-dev libgdk-pixbuf-2.0-dev
```

### Step 2: (Optional) Install NVIDIA CUDA for GPU acceleration

Skip this step if you don't have an NVIDIA GPU.

```bash
# Install NVIDIA drivers + CUDA toolkit
sudo apt install -y nvidia-driver-535 nvidia-cuda-toolkit

# Verify GPU is visible
nvidia-smi
nvcc --version
```

### Step 3: Clone the repository

```bash
git clone https://github.com/yourusername/Zero_CPU.git
cd Zero_CPU
```

### Step 4: Run the install script

```bash
bash scripts/install-ubuntu.sh
```

This will:
1. Install system dependencies
2. Install Rust (if not already installed)
3. Build llama.cpp from source (auto-detects NVIDIA GPU for CUDA)
4. Build the `zerogpu` CLI binary
5. Add `zerogpu` to your PATH (`~/.local/bin`)

After installation, reload your shell:

```bash
source ~/.bashrc
```

### Step 5: Download a model

```bash
bash scripts/download-model.sh
```

### Step 6: Optimize and run

```bash
# Optimize the model for your hardware
zerogpu --optimize ~/.zerogpu-forge/downloads/qwen2.5-coder-7b-instruct-q4_k_m.gguf

# Start chatting
zerogpu --model qwen2.5
```

### Step 7: (Optional) Start the API server

```bash
zerogpu --serve --port 8080
```

### Quick reference

```bash
zerogpu --help              # Show all commands
zerogpu --list              # List optimized models
zerogpu --model qwen2.5 --ctx 32768 -f prompt.txt   # Long prompt from file
zerogpu --serve --port 3001 --api-key "sk-xxx"       # API server with auth
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
zerogpu --serve                             Start OpenAI-compatible API server
zerogpu --serve --port 3001                 API server on custom port
zerogpu --serve --api-key "sk-xxx"          API server with auth
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

## API Server

ZeroGPU Forge includes a built-in **OpenAI-compatible API server** that you can use to connect your Node.js (or any) backend to locally-running LLMs.

### Start the server

```bash
# Default: port 8080, no auth
zerogpu --serve

# Custom port
zerogpu --serve --port 3001

# With API key authentication
zerogpu --serve --port 3001 --api-key "my-secret-key"
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | Chat completion (OpenAI-compatible) |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Health check |

### API Examples

**Chat completion:**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Write a hello world in Python"}
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

**Streaming:**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5",
    "messages": [{"role": "user", "content": "Explain recursion"}],
    "stream": true
  }'
```

**List models:**
```bash
curl http://localhost:8080/v1/models
```

**With API key:**
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key" \
  -d '{"model": "qwen2.5", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## Connecting to Node.js Backend

The API server is **OpenAI-compatible**, so you can use the official `openai` npm package or plain `fetch`.

### Option 1: Using the OpenAI SDK (recommended)

```bash
npm install openai
```

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'my-secret-key', // or any string if no auth
});

// Non-streaming
async function chat(userMessage) {
  const response = await client.chat.completions.create({
    model: 'qwen2.5',      // must match a model name from `zerogpu --list`
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return response.choices[0].message.content;
}

// Streaming
async function chatStream(userMessage) {
  const stream = await client.chat.completions.create({
    model: 'qwen2.5',
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(delta);
    fullResponse += delta;
  }
  return fullResponse;
}
```

### Option 2: Using fetch (no dependencies)

```javascript
async function chat(userMessage) {
  const response = await fetch('http://localhost:8080/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer my-secret-key', // omit if no auth
    },
    body: JSON.stringify({
      model: 'qwen2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Option 3: Streaming with fetch (SSE)

```javascript
async function chatStream(userMessage, onToken) {
  const response = await fetch('http://localhost:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5',
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;

      const chunk = JSON.parse(data);
      const token = chunk.choices[0]?.delta?.content;
      if (token) onToken(token);
    }
  }
}

// Usage
chatStream('Explain async/await', (token) => process.stdout.write(token));
```

### Express.js Integration Example

```javascript
import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

const llm = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'my-secret-key',
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const response = await llm.chat.completions.create({
      model: 'qwen2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    res.json({
      reply: response.choices[0].message.content,
      usage: response.usage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Streaming endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [] } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await llm.chat.completions.create({
      model: 'qwen2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...history,
        { role: 'user', content: message },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(3000, () => {
  console.log('Backend running on http://localhost:3000');
  console.log('Make sure zerogpu --serve is running on port 8080');
});
```

### Quick Start: Backend + ZeroGPU

```bash
# Terminal 1: Start ZeroGPU API server
zerogpu --serve --port 8080 --api-key "my-secret-key"

# Terminal 2: Start your Node.js backend
cd your-backend
npm install openai express
node server.js
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
│   ├── binaries/                 # llama.cpp executables + libraries (not in git — built locally)
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

The llama.cpp binaries are not included in the git repository — they must be built for your platform. Run the install script to build them automatically:

```bash
# macOS
bash scripts/install-mac.sh

# Linux
bash scripts/install-ubuntu.sh
```

Or build manually — see [Building llama.cpp Binaries](#building-llamacpp-binaries). Verify the binaries exist at `src-tauri/binaries/llama-cli`.

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
