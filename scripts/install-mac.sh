#!/bin/bash
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ZeroGPU Forge — macOS Installer
# Installs: Rust, builds ZeroGPU CLI (llama.cpp binaries pre-bundled)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BINARIES_DIR="$PROJECT_DIR/src-tauri/binaries"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  ZeroGPU Forge — macOS Installer             │"
echo "  └─────────────────────────────────────────────┘"
echo -e "${NC}"

# ── Check macOS ──────────────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}  This script is for macOS. Use install-ubuntu.sh for Linux.${NC}"
    exit 1
fi

ARCH=$(uname -m)
echo -e "  Platform: macOS $(sw_vers -productVersion) ($ARCH)"
if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${GREEN}  Apple Silicon detected — Metal GPU acceleration available.${NC}"
else
    echo -e "${YELLOW}  Intel Mac — CPU only, no Metal acceleration.${NC}"
fi
echo ""

# ── Check pre-bundled binaries ───────────────────────────────────────
echo -e "${CYAN}  [1/4] Checking llama.cpp binaries...${NC}"
if [[ -f "$BINARIES_DIR/llama-cli" ]] && file "$BINARIES_DIR/llama-cli" | grep -q "Mach-O"; then
    echo -e "${GREEN}  Pre-bundled macOS binaries found.${NC}"
    chmod +x "$BINARIES_DIR/llama-cli" "$BINARIES_DIR/llama-quantize" 2>/dev/null || true
else
    echo -e "${YELLOW}  No macOS llama-cli binary found. Building from source...${NC}"

    # Need Xcode CLI tools
    if ! xcode-select -p &>/dev/null; then
        echo "  Installing Xcode Command Line Tools..."
        xcode-select --install
        echo "  Please complete the Xcode install dialog, then re-run this script."
        exit 1
    fi

    LLAMA_CPP_DIR="$PROJECT_DIR/.llama-cpp-build"
    if [[ -d "$LLAMA_CPP_DIR" ]]; then
        cd "$LLAMA_CPP_DIR" && git pull --quiet
    else
        git clone --depth 1 https://github.com/ggerganov/llama.cpp "$LLAMA_CPP_DIR"
    fi

    cd "$LLAMA_CPP_DIR"
    CMAKE_ARGS="-DCMAKE_BUILD_TYPE=Release"
    [[ "$ARCH" == "arm64" ]] && CMAKE_ARGS="$CMAKE_ARGS -DGGML_METAL=ON"

    cmake -B build $CMAKE_ARGS
    cmake --build build --config Release -j$(sysctl -n hw.ncpu)

    mkdir -p "$BINARIES_DIR"
    cp build/bin/llama-cli "$BINARIES_DIR/"
    cp build/bin/llama-quantize "$BINARIES_DIR/"
    cp build/bin/llama-bench "$BINARIES_DIR/" 2>/dev/null || true

    # Copy Metal/dylib files
    find build -name "*.dylib" -exec cp {} "$BINARIES_DIR/" \; 2>/dev/null || true
    find build -name "*.metallib" -exec cp {} "$BINARIES_DIR/" \; 2>/dev/null || true

    echo -e "${GREEN}  llama.cpp built with Metal support.${NC}"
fi

# ── Install Rust ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [2/4] Setting up Rust...${NC}"
if command -v cargo &>/dev/null; then
    echo -e "${GREEN}  Rust already installed: $(rustc --version)${NC}"
elif [[ -f "$HOME/.cargo/bin/cargo" ]]; then
    echo -e "${GREEN}  Rust found at ~/.cargo/bin${NC}"
    export PATH="$HOME/.cargo/bin:$PATH"
else
    echo "  Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
    source "$HOME/.cargo/env"
    echo -e "${GREEN}  Rust installed: $(rustc --version)${NC}"
fi
source "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.cargo/bin:$PATH"

# ── Build ZeroGPU CLI ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  [3/4] Building ZeroGPU CLI...${NC}"
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
echo -e "${CYAN}  [4/4] Installing to PATH...${NC}"

# Try /usr/local/bin first (needs sudo), fall back to ~/.local/bin
if sudo ln -sf "$PROJECT_DIR/src-tauri/target/release/zerogpu" /usr/local/bin/zerogpu 2>/dev/null; then
    echo -e "${GREEN}  Installed to /usr/local/bin/zerogpu${NC}"
else
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    ln -sf "$PROJECT_DIR/src-tauri/target/release/zerogpu" "$INSTALL_DIR/zerogpu"

    if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
        SHELL_RC="$HOME/.zshrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
        export PATH="$HOME/.local/bin:$PATH"
        echo "  Added $INSTALL_DIR to PATH in $SHELL_RC"
    fi
    echo -e "${GREEN}  Installed to $INSTALL_DIR/zerogpu${NC}"
fi

# Also ensure cargo env is sourced
SHELL_RC="$HOME/.zshrc"
if ! grep -q "cargo/env" "$SHELL_RC" 2>/dev/null; then
    echo '. "$HOME/.cargo/env"' >> "$SHELL_RC"
fi

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
echo "    # Build GUI app (optional)"
echo "    cd $PROJECT_DIR && npm install && npm run tauri build"
echo ""
echo "  If 'zerogpu' is not found, run: source ~/.zshrc"
echo ""
