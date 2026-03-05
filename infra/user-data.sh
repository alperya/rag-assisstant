#!/bin/bash
# Cloud-init user data - runs automatically on first boot
set -e
exec > >(tee /var/log/rag-setup.log) 2>&1

echo "🚀 RAG Assistant - Auto Setup Starting..."

# --- 1. Install Docker ---
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu
echo "✅ Docker installed"

# --- 2. Install cloudflared ---
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb
rm cloudflared.deb
echo "✅ cloudflared installed"

# --- 3. Clone project ---
cd /opt
git clone https://github.com/alperya/rag-assisstant.git rag-assistant
chown -R ubuntu:ubuntu /opt/rag-assistant
cd /opt/rag-assistant

# --- 4. Configure environment ---
cp backend/.env.example backend/.env
sed -i "s|sk-ant-your-api-key-here|${anthropic_api_key}|g" backend/.env

# --- 5. Build and start ---
docker compose -f docker-compose.prod.yml up -d --build

# --- 6. Prepare cloudflared config template ---
mkdir -p /home/ubuntu/.cloudflared
cp deploy/cloudflared-config.yml /home/ubuntu/.cloudflared/config.yml
chown -R ubuntu:ubuntu /home/ubuntu/.cloudflared

echo ""
echo "============================================"
echo "✅ RAG Assistant is running on port 8000"
echo "============================================"
echo "Next: SSH in and run 'cloudflared tunnel login' to set up the tunnel"
echo ""
