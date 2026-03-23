#!/bin/bash
set -euo pipefail

# EC2 Setup Script for t3.medium running Amazon Linux 2023
# Installs Docker, sets up directory structure, enables auto-start

echo "=== Updating system ==="
sudo dnf update -y

echo "=== Installing Docker & Git ==="
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

echo "=== Installing Docker Compose ==="
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

echo "=== Creating app directory ==="
sudo mkdir -p /opt/apps
sudo chown ec2-user:ec2-user /opt/apps

echo "=== Setting up systemd service ==="
sudo tee /etc/systemd/system/portfolio-apps.service > /dev/null <<'EOF'
[Unit]
Description=Portfolio Docker Compose Apps
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/apps
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable portfolio-apps

echo "=== Setup complete ==="
echo "Log out and back in for docker group, then:"
echo "  cd /opt/apps && docker-compose up --build -d"
