#!/bin/bash
# =============================================================
# RAG Assistant - EC2 Setup Script
# Run this on a fresh Amazon Linux 2023 / Ubuntu 22.04 EC2 instance
# =============================================================
set -e

echo "🚀 RAG Assistant - EC2 Setup Starting..."

# --- 1. Install Docker ---
echo "📦 Installing Docker..."
if command -v apt-get &> /dev/null; then
    # Ubuntu / Debian
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
elif command -v yum &> /dev/null; then
    # Amazon Linux
    sudo yum update -y
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    # Install Docker Compose plugin
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

sudo usermod -aG docker $USER
echo "✅ Docker installed"

# --- 2. Install Cloudflare Tunnel (cloudflared) ---
echo "📦 Installing cloudflared..."
if command -v apt-get &> /dev/null; then
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
else
    curl -L --output cloudflared.rpm https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
    sudo yum localinstall -y cloudflared.rpm
    rm cloudflared.rpm
fi
echo "✅ cloudflared installed"

# --- 3. Clone the project ---
echo "📦 Cloning RAG Assistant..."
cd /opt
sudo git clone https://github.com/alperya/rag-assisstant.git rag-assistant || true
sudo chown -R $USER:$USER /opt/rag-assistant
cd /opt/rag-assistant

# --- 4. Configure environment ---
echo "⚙️ Setting up environment..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and set your ANTHROPIC_API_KEY"
    echo "   Run: nano /opt/rag-assistant/backend/.env"
    echo ""
fi

echo ""
echo "============================================"
echo "✅ EC2 Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Log out and back in (for Docker group):"
echo "   exit && ssh <your-ec2>"
echo ""
echo "2. Set your Anthropic API key:"
echo "   nano /opt/rag-assistant/backend/.env"
echo ""
echo "3. Build and start the app:"
echo "   cd /opt/rag-assistant"
echo "   docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "4. Set up Cloudflare Tunnel:"
echo "   cloudflared tunnel login"
echo "   cloudflared tunnel create rag-assistant"
echo "   cp deploy/cloudflared-config.yml ~/.cloudflared/config.yml"
echo "   # Edit config.yml and set your tunnel ID"
echo "   cloudflared tunnel route dns rag-assistant rag.alperyasemin.com"
echo "   sudo cloudflared service install"
echo "   sudo systemctl start cloudflared"
echo ""
echo "5. Your app will be live at: https://rag.alperyasemin.com"
echo ""
