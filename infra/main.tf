terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Variables ---
variable "aws_region" {
  description = "AWS region"
  default     = "eu-central-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t2.micro" # Free Tier
}

variable "key_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
}

# --- Data Sources ---
# Latest Ubuntu 22.04 AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- Security Group ---
resource "aws_security_group" "rag_assistant" {
  name        = "rag-assistant-sg"
  description = "Security group for RAG Assistant - SSH only (Cloudflare Tunnel handles HTTP)"

  # SSH
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "rag-assistant-sg"
    Project = "rag-assistant"
  }
}

# --- EC2 Instance ---
resource "aws_instance" "rag_assistant" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.rag_assistant.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    anthropic_api_key = var.anthropic_api_key
  })

  tags = {
    Name    = "rag-assistant"
    Project = "rag-assistant"
  }
}

# --- Outputs ---
output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.rag_assistant.id
}

output "public_ip" {
  description = "EC2 Public IP"
  value       = aws_instance.rag_assistant.public_ip
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.rag_assistant.public_ip}"
}

output "next_steps" {
  description = "Next steps after provisioning"
  value       = <<-EOT
    
    ✅ EC2 is provisioning! It will take ~5 minutes for the app to be ready.
    
    1. SSH into the instance:
       ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.rag_assistant.public_ip}
    
    2. Check cloud-init progress:
       tail -f /var/log/cloud-init-output.log
    
    3. Once ready, set up Cloudflare Tunnel:
       cloudflared tunnel login
       cloudflared tunnel create rag-assistant
       nano ~/.cloudflared/config.yml   # Set tunnel ID
       cloudflared tunnel route dns rag-assistant rag.alperyasemin.com
       sudo cloudflared service install
       sudo systemctl start cloudflared
    
    4. Visit: https://rag.alperyasemin.com
  EOT
}
