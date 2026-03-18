#!/bin/bash
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ZeroGPU Forge — Model Downloader
# Downloads popular GGUF models from HuggingFace
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MODELS_DIR="$HOME/.zerogpu-forge/downloads"
mkdir -p "$MODELS_DIR"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  ZeroGPU Forge — Model Downloader            │"
echo "  └─────────────────────────────────────────────┘"
echo -e "${NC}"

echo "  Available models:"
echo ""
echo "  #  Model                           Size     RAM Needed  Best For"
echo "  ── ──────────────────────────────  ───────  ──────────  ─────────────────"
echo "  1  Qwen2.5-Coder-7B (Q4_K_M)      4.4 GB   8 GB+      Coding, general"
echo "  2  Qwen2.5-Coder-1.5B (Q4_K_M)    1.0 GB   2 GB+      Low-RAM machines"
echo "  3  DeepSeek-R1-Distill-7B (Q4_K_M) 4.5 GB   8 GB+      Reasoning"
echo "  4  Phi-4-mini (Q4_K_M)            2.5 GB   4 GB+      Fast, small"
echo "  5  Llama-3.1-8B (Q4_K_M)          4.7 GB   8 GB+      General purpose"
echo "  6  Mistral-7B-v0.3 (Q4_K_M)       4.4 GB   8 GB+      General purpose"
echo ""

read -p "  Select model [1-6]: " choice

case "$choice" in
    1)
        URL="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf"
        FILENAME="qwen2.5-coder-7b-instruct-q4_k_m.gguf"
        ;;
    2)
        URL="https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf"
        FILENAME="qwen2.5-coder-1.5b-instruct-q4_k_m.gguf"
        ;;
    3)
        URL="https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf"
        FILENAME="DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf"
        ;;
    4)
        URL="https://huggingface.co/bartowski/phi-4-mini-instruct-GGUF/resolve/main/phi-4-mini-instruct-Q4_K_M.gguf"
        FILENAME="phi-4-mini-instruct-Q4_K_M.gguf"
        ;;
    5)
        URL="https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
        FILENAME="Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
        ;;
    6)
        URL="https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf"
        FILENAME="Mistral-7B-Instruct-v0.3-Q4_K_M.gguf"
        ;;
    *)
        echo "  Invalid choice."
        exit 1
        ;;
esac

DEST="$MODELS_DIR/$FILENAME"

if [[ -f "$DEST" ]]; then
    echo -e "${GREEN}  Already downloaded: $DEST${NC}"
else
    echo ""
    echo "  Downloading $FILENAME..."
    echo "  URL: $URL"
    echo ""
    curl -L -o "$DEST" --progress-bar "$URL"
    echo -e "${GREEN}  Downloaded: $DEST${NC}"
fi

echo ""
echo "  Next step — optimize the model:"
echo ""
echo "    zerogpu --optimize $DEST"
echo ""
