#!/bin/bash
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ZeroGPU Forge — Ubuntu/Linux Installer
# Installs: Rust, llama.cpp (CPU or CUDA), ZeroGPU CLI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BINARIES_DIR="$PROJECT_DIR/src-tauri/binaries"
LLAMA_CPP_DIR="$PROJECT_DIR/.llama-cpp-build"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  ZeroGPU Forge — Ubuntu/Linux Installer      │"
echo "  └─────────────────────────────────────────────┘"
echo -e "${NC}"

# ── Detect GPU ───────────────────────────────────────────────────────
USE_CUDA=false
if command -v nvidia-smi &>/dev/null; then
    echo -e "${GREEN}  NVIDIA GPU detected.${NC}"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || true
    echo ""
    read -p "  Build with CUDA GPU support? [Y/n]: " cuda_choice
    if [[ "$cuda_choice" != "n" && "$cuda_choice" != "N" ]]; then
        USE_CUDA=true
        echo -e "${GREEN}  → CUDA support enabled${NC}"
    fi
else
    echo -e "${YELLOW}  No NVIDIA GPU detected. Building CPU-only.${NC}"
fi
echo ""

# ── Install system dependencies ──────────────────────────────────────
echo -e "${CYAN}  [1/5] Installing system dependencies...${NC}"
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential cmake git pkg-config libssl-dev curl \
    libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev libpango1.0-dev libatk1.0-dev libgdk-pixbuf-2.0-dev

if $USE_CUDA; then
    if ! command -v nvcc &>/dev/null; then
        echo -e "${YELLOW}  Installing CUDA toolkit...${NC}"
        sudo apt-get install -y -qq nvidia-cuda-toolkit
    else
        echo -e "${GREEN}  CUDA toolkit already installed: $(nvcc --version | grep release)${NC}"
    fi
fi

# ── Install Rust ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [2/5] Setting up Rust...${NC}"
if command -v cargo &>/dev/null; then
    echo -e "${GREEN}  Rust already installed: $(rustc --version)${NC}"
else
    echo "  Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
    source "$HOME/.cargo/env"
    echo -e "${GREEN}  Rust installed: $(rustc --version)${NC}"
fi
source "$HOME/.cargo/env" 2>/dev/null || true

# ── Build llama.cpp ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [3/5] Building llama.cpp from source...${NC}"

if [[ -f "$BINARIES_DIR/llama-cli" ]] && file "$BINARIES_DIR/llama-cli" | grep -q "ELF"; then
    echo -e "${GREEN}  llama.cpp Linux binaries already exist. Skipping build.${NC}"
    echo "  (Delete $BINARIES_DIR/llama-cli to force rebuild)"
else
    # Clone or update llama.cpp
    if [[ -d "$LLAMA_CPP_DIR" ]]; then
        echo "  Updating llama.cpp..."
        cd "$LLAMA_CPP_DIR" && git pull --quiet
    else
        echo "  Cloning llama.cpp..."
        git clone --depth 1 https://github.com/ggerganov/llama.cpp "$LLAMA_CPP_DIR"
    fi

    cd "$LLAMA_CPP_DIR"

    # Build
    CMAKE_ARGS=""
    if $USE_CUDA; then
        CMAKE_ARGS="-DGGML_CUDA=ON"
        echo "  Building with CUDA support..."
    else
        echo "  Building CPU-only..."
    fi

    cmake -B build $CMAKE_ARGS -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release -j$(nproc)

    # Copy binaries
    mkdir -p "$BINARIES_DIR"

    # Back up macOS binaries if they exist
    if [[ -f "$BINARIES_DIR/llama-cli" ]] && file "$BINARIES_DIR/llama-cli" | grep -q "Mach-O"; then
        echo "  Backing up macOS binaries to $BINARIES_DIR/macos-backup/"
        mkdir -p "$BINARIES_DIR/macos-backup"
        cp "$BINARIES_DIR"/llama-cli "$BINARIES_DIR/macos-backup/" 2>/dev/null || true
        cp "$BINARIES_DIR"/llama-quantize "$BINARIES_DIR/macos-backup/" 2>/dev/null || true
        cp "$BINARIES_DIR"/llama-bench "$BINARIES_DIR/macos-backup/" 2>/dev/null || true
    fi

    cp build/bin/llama-cli "$BINARIES_DIR/"
    cp build/bin/llama-quantize "$BINARIES_DIR/"
    cp build/bin/llama-server "$BINARIES_DIR/" 2>/dev/null || true
    cp build/bin/llama-bench "$BINARIES_DIR/" 2>/dev/null || true

    # Copy shared libraries if they exist
    find build -name "*.so" -exec cp {} "$BINARIES_DIR/" \; 2>/dev/null || true

    echo -e "${GREEN}  llama.cpp built and installed to $BINARIES_DIR/${NC}"
fi

# ── Build ZeroGPU CLI ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [4/5] Building ZeroGPU CLI...${NC}"
cd "$PROJECT_DIR/src-tauri"
cargo build --bin zerogpu --release 2>&1 | grep -E "Compiling zerogpu|Finished|error" || true

if [[ -f "$PROJECT_DIR/src-tauri/target/release/zerogpu" ]]; then
    echo -e "${GREEN}  ZeroGPU CLI built successfully.${NC}"
else
    echo -e "${RED}  Build failed. Check errors above.${NC}"
    exit 1
fi

# ── Install to PATH ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [5/5] Installing to PATH...${NC}"

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"
ln -sf "$PROJECT_DIR/src-tauri/target/release/zerogpu" "$INSTALL_DIR/zerogpu"

# Ensure ~/.local/bin is in PATH
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    SHELL_RC="$HOME/.bashrc"
    [[ -f "$HOME/.zshrc" ]] && SHELL_RC="$HOME/.zshrc"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
    export PATH="$HOME/.local/bin:$PATH"
    echo "  Added $INSTALL_DIR to PATH in $SHELL_RC"
fi

echo -e "${GREEN}  Installed: $(which zerogpu 2>/dev/null || echo "$INSTALL_DIR/zerogpu")${NC}"

# ── Create app directories ───────────────────────────────────────────
mkdir -p "$HOME/.zerogpu-forge/models"
mkdir -p "$HOME/.zerogpu-forge/conversations"

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ┌─────────────────────────────────────────────┐"
echo "  │  Installation complete!                      │"
echo "  └─────────────────────────────────────────────┘${NC}"
echo ""
echo "  Quick start:"
echo ""
echo "    # List models"
echo "    zerogpu --list"
echo ""
echo "    # Optimize a model"
echo "    zerogpu --optimize /path/to/model.gguf"
echo ""
echo "    # Chat"
echo "    zerogpu --model <name>"
echo ""
echo "    # Chat with file prompt"
echo "    zerogpu --model <name> --ctx 32768 -f prompt.txt"
echo ""
if ! $USE_CUDA; then
    echo -e "  ${YELLOW}Note: Built CPU-only. For GPU support, re-run with NVIDIA drivers installed.${NC}"
fi
echo ""
echo "  If 'zerogpu' is not found, run: source ~/.bashrc"
echo ""
