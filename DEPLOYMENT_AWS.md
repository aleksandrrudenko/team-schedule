# AWS Deployment Guide - Team Schedule Application

This guide provides step-by-step instructions for deploying the Team Schedule application to AWS with PostgreSQL database, Google OAuth authentication, and custom domain setup.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [AWS Services Setup](#aws-services-setup)
4. [Database Setup (RDS PostgreSQL)](#database-setup-rds-postgresql)
5. [Application Deployment (Elastic Beanstalk)](#application-deployment-elastic-beanstalk)
6. [Alternative: ECS Fargate Deployment](#alternative-ecs-fargate-deployment)
7. [Alternative: EC2 Direct Deployment](#alternative-ec2-direct-deployment)
8. [Domain Registration & SSL](#domain-registration--ssl)
9. [Google OAuth Configuration](#google-oauth-configuration)
10. [Environment Variables](#environment-variables)
11. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
12. [Monitoring & Logging](#monitoring--logging)
13. [Backup & Recovery](#backup--recovery)
14. [Security Best Practices](#security-best-practices)
15. [Cost Optimization](#cost-optimization)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Route 53   │───▶│  CloudFront  │───▶│     ALB      │       │
│  │   (Domain)   │    │    (CDN)     │    │(Load Balancer)│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                 │                │
│                                                 ▼                │
│                                    ┌──────────────────────┐     │
│                                    │   ECS Fargate /      │     │
│                                    │   Elastic Beanstalk  │     │
│                                    │   (Node.js App)      │     │
│                                    └──────────────────────┘     │
│                                                 │                │
│                                                 ▼                │
│                                    ┌──────────────────────┐     │
│                                    │    RDS PostgreSQL    │     │
│                                    │     (Database)       │     │
│                                    └──────────────────────┘     │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Secrets     │    │  CloudWatch  │    │     ACM      │       │
│  │  Manager     │    │   (Logs)     │    │ (SSL Certs)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Access
- AWS account with administrative access
- AWS CLI installed and configured
- Git installed
- Node.js 18+ installed locally (for testing)
- Google Cloud Console access (for OAuth)

### Install AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### Configure AWS CLI

```bash
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., eu-central-1)
# - Default output format (json)
```

---

## AWS Services Setup

### 1. Create VPC (Virtual Private Cloud)

```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=team-schedule-vpc}]'

# Note the VPC ID from output (e.g., vpc-xxxxxxxxx)
```

Or use AWS Console:
1. Go to **VPC** → **Your VPCs** → **Create VPC**
2. Name: `team-schedule-vpc`
3. IPv4 CIDR: `10.0.0.0/16`
4. Click **Create VPC**

### 2. Create Subnets

Create at least 2 subnets in different Availability Zones for high availability:

```bash
# Public Subnet 1 (for ALB)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone eu-central-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=team-schedule-public-1}]'

# Public Subnet 2 (for ALB)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone eu-central-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=team-schedule-public-2}]'

# Private Subnet 1 (for App & DB)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.10.0/24 \
  --availability-zone eu-central-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=team-schedule-private-1}]'

# Private Subnet 2 (for DB)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.11.0/24 \
  --availability-zone eu-central-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=team-schedule-private-2}]'
```

### 3. Create Internet Gateway & NAT Gateway

```bash
# Create Internet Gateway
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=team-schedule-igw}]'

# Attach to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id igw-xxxxxxxxx \
  --vpc-id vpc-xxxxxxxxx

# Allocate Elastic IP for NAT Gateway
aws ec2 allocate-address --domain vpc

# Create NAT Gateway in public subnet
aws ec2 create-nat-gateway \
  --subnet-id subnet-public-1 \
  --allocation-id eipalloc-xxxxxxxxx
```

### 4. Configure Route Tables

```bash
# Create route table for public subnets
aws ec2 create-route-table \
  --vpc-id vpc-xxxxxxxxx \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=team-schedule-public-rt}]'

# Add route to Internet Gateway
aws ec2 create-route \
  --route-table-id rtb-public \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id igw-xxxxxxxxx

# Associate public subnets with public route table
aws ec2 associate-route-table --subnet-id subnet-public-1 --route-table-id rtb-public
aws ec2 associate-route-table --subnet-id subnet-public-2 --route-table-id rtb-public

# Create route table for private subnets
aws ec2 create-route-table \
  --vpc-id vpc-xxxxxxxxx \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=team-schedule-private-rt}]'

# Add route to NAT Gateway
aws ec2 create-route \
  --route-table-id rtb-private \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-xxxxxxxxx

# Associate private subnets
aws ec2 associate-route-table --subnet-id subnet-private-1 --route-table-id rtb-private
aws ec2 associate-route-table --subnet-id subnet-private-2 --route-table-id rtb-private
```

---

## Database Setup (RDS PostgreSQL)

### 1. Create Security Group for RDS

```bash
# Create security group
aws ec2 create-security-group \
  --group-name team-schedule-rds-sg \
  --description "Security group for Team Schedule RDS" \
  --vpc-id vpc-xxxxxxxxx

# Allow PostgreSQL access from application security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app-xxxxxxxxx
```

### 2. Create DB Subnet Group

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name team-schedule-db-subnet \
  --db-subnet-group-description "Subnet group for Team Schedule DB" \
  --subnet-ids subnet-private-1 subnet-private-2
```

### 3. Create RDS PostgreSQL Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier team-schedule-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-rds-xxxxxxxxx \
  --db-subnet-group-name team-schedule-db-subnet \
  --db-name team_schedule \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted \
  --no-publicly-accessible \
  --tags Key=Name,Value=team-schedule-db
```

**Important Parameters:**
| Parameter | Value | Description |
|-----------|-------|-------------|
| `db-instance-class` | `db.t3.micro` | Smallest instance (Free Tier eligible) |
| `allocated-storage` | `20` | 20 GB storage |
| `multi-az` | `true` | High availability (optional, adds cost) |
| `storage-encrypted` | `true` | Encrypt data at rest |
| `backup-retention-period` | `7` | Keep backups for 7 days |

### 4. Get Database Endpoint

```bash
aws rds describe-db-instances \
  --db-instance-identifier team-schedule-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Output example: `team-schedule-db.xxxxxxxxx.eu-central-1.rds.amazonaws.com`

### 5. Construct DATABASE_URL

```
DATABASE_URL=postgresql://postgres:YOUR_SECURE_PASSWORD@team-schedule-db.xxxxxxxxx.eu-central-1.rds.amazonaws.com:5432/team_schedule
```

---

## Application Deployment (Elastic Beanstalk)

### 1. Install EB CLI

```bash
pip install awsebcli --upgrade
```

### 2. Initialize Elastic Beanstalk

```bash
cd /path/to/team-schedule

# Initialize EB application
eb init

# Follow prompts:
# - Select region (e.g., eu-central-1)
# - Application name: team-schedule
# - Platform: Node.js
# - Platform version: Node.js 18
# - SSH: Yes (optional, for debugging)
```

### 3. Create Environment

Create `.ebextensions/nodecommand.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
```

Create `.ebextensions/https-redirect.config` (optional, for HTTPS):

```yaml
files:
  "/etc/nginx/conf.d/proxy.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      upstream nodejs {
        server 127.0.0.1:8080;
        keepalive 256;
      }
      server {
        listen 8080;
        if ($time_iso8601 ~ "^(\d{4})-(\d{2})-(\d{2})T(\d{2})") {
          set $year $1;
          set $month $2;
          set $day $3;
          set $hour $4;
        }
        access_log /var/log/nginx/healthd/application.log.$year-$month-$day-$hour healthd;
        access_log /var/log/nginx/access.log main;
        location / {
          proxy_pass http://nodejs;
          proxy_set_header Connection "";
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
        }
      }
```

### 4. Create Elastic Beanstalk Environment

```bash
eb create team-schedule-prod \
  --instance-type t3.micro \
  --single \
  --vpc.id vpc-xxxxxxxxx \
  --vpc.elbpublic \
  --vpc.publicip \
  --vpc.ec2subnets subnet-public-1,subnet-public-2 \
  --vpc.elbsubnets subnet-public-1,subnet-public-2 \
  --vpc.securitygroups sg-app-xxxxxxxxx
```

### 5. Set Environment Variables

```bash
eb setenv \
  NODE_ENV=production \
  PORT=8080 \
  DATABASE_URL="postgresql://postgres:PASSWORD@team-schedule-db.xxx.rds.amazonaws.com:5432/team_schedule" \
  GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="your-client-secret" \
  SESSION_SECRET="your-random-32-char-string" \
  CALLBACK_URL="https://schedule.yourdomain.com/auth/google/callback" \
  ALLOWED_USER_1="user1@company.com" \
  ALLOWED_USER_2="user2@company.com" \
  ALLOWED_USER_3="user3@company.com"
```

### 6. Deploy Application

```bash
eb deploy
```

### 7. Open Application

```bash
eb open
```

---

## Alternative: ECS Fargate Deployment

ECS Fargate provides serverless container deployment with more control than Elastic Beanstalk.

### 1. Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### 2. Create ECR Repository

```bash
# Create repository
aws ecr create-repository \
  --repository-name team-schedule \
  --image-scanning-configuration scanOnPush=true

# Get login command
aws ecr get-login-password --region eu-central-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com
```

### 3. Build and Push Docker Image

```bash
# Build image
docker build -t team-schedule .

# Tag image
docker tag team-schedule:latest \
  ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/team-schedule:latest

# Push to ECR
docker push ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/team-schedule:latest
```

### 4. Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name team-schedule-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### 5. Create Task Definition

Create `task-definition.json`:

```json
{
  "family": "team-schedule",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "team-schedule",
      "image": "ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/team-schedule:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:team-schedule/database-url"
        },
        {
          "name": "GOOGLE_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:team-schedule/google-client-id"
        },
        {
          "name": "GOOGLE_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:team-schedule/google-client-secret"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:team-schedule/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/team-schedule",
          "awslogs-region": "eu-central-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Register task definition:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

### 6. Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name team-schedule-alb \
  --subnets subnet-public-1 subnet-public-2 \
  --security-groups sg-alb-xxxxxxxxx \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name team-schedule-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxxxxxx \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Create listener (HTTP → HTTPS redirect)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"

# Create HTTPS listener (requires SSL certificate)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### 7. Create ECS Service

```bash
aws ecs create-service \
  --cluster team-schedule-cluster \
  --service-name team-schedule-service \
  --task-definition team-schedule:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-1,subnet-private-2],securityGroups=[sg-app-xxxxxxxxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=team-schedule,containerPort=3000"
```

---

## Alternative: EC2 Direct Deployment

For simpler setup or testing, deploy directly to EC2.

### 1. Launch EC2 Instance

```bash
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-group-ids sg-app-xxxxxxxxx \
  --subnet-id subnet-public-1 \
  --associate-public-ip-address \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=team-schedule-server}]'
```

Create `user-data.sh`:

```bash
#!/bin/bash
# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Create app directory
mkdir -p /opt/team-schedule
cd /opt/team-schedule

# Clone repository
git clone https://github.com/your-org/team-schedule.git .

# Install dependencies
npm ci --only=production

# Create systemd service
cat > /etc/systemd/system/team-schedule.service << 'EOF'
[Unit]
Description=Team Schedule Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/team-schedule
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/team-schedule/.env

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl daemon-reload
systemctl enable team-schedule
systemctl start team-schedule
```

### 2. Create .env File on Server

SSH into the instance and create `/opt/team-schedule/.env`:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:PASSWORD@team-schedule-db.xxx.rds.amazonaws.com:5432/team_schedule
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-random-32-char-string
CALLBACK_URL=https://schedule.yourdomain.com/auth/google/callback
ALLOWED_USER_1=user1@company.com
ALLOWED_USER_2=user2@company.com
```

---

## Domain Registration & SSL

### 1. Register Domain (Route 53)

If you need a new domain:

```bash
# Check domain availability
aws route53domains check-domain-availability \
  --domain-name schedule.yourdomain.com

# Register domain (if available)
aws route53domains register-domain \
  --domain-name yourdomain.com \
  --duration-in-years 1 \
  --admin-contact file://contact.json \
  --registrant-contact file://contact.json \
  --tech-contact file://contact.json
```

### 2. Create Hosted Zone

```bash
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)
```

### 3. Create SSL Certificate (ACM)

```bash
# Request certificate
aws acm request-certificate \
  --domain-name schedule.yourdomain.com \
  --validation-method DNS \
  --subject-alternative-names "*.yourdomain.com"

# Get certificate ARN and validation records
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:eu-central-1:ACCOUNT_ID:certificate/xxx
```

### 4. Validate Certificate with DNS

Add the CNAME record provided by ACM to your Route 53 hosted zone:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_xxxxxx.schedule.yourdomain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "_yyyyyy.acm-validations.aws."}]
      }
    }]
  }'
```

### 5. Create DNS Record for Application

Point your domain to the ALB:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "schedule.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "ALB_HOSTED_ZONE_ID",
          "DNSName": "team-schedule-alb-xxx.eu-central-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## Google OAuth Configuration

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: `team-schedule-prod`
3. Enable **Google+ API** and **Google Identity** API

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (for corporate Google Workspace) or **External**
3. Fill in:
   - App name: `Team Schedule`
   - User support email: your email
   - App logo: (optional)
   - App domain: `schedule.yourdomain.com`
   - Authorized domains: `yourdomain.com`
   - Developer contact: your email
4. Scopes: Add `email` and `profile`
5. Test users: Add users if External type

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Team Schedule Production`
5. Authorized JavaScript origins:
   - `https://schedule.yourdomain.com`
6. Authorized redirect URIs:
   - `https://schedule.yourdomain.com/auth/google/callback`
7. Click **Create**
8. Copy **Client ID** and **Client Secret**

### 4. Store Credentials Securely

Use AWS Secrets Manager:

```bash
# Store Google Client ID
aws secretsmanager create-secret \
  --name team-schedule/google-client-id \
  --secret-string "your-client-id.apps.googleusercontent.com"

# Store Google Client Secret
aws secretsmanager create-secret \
  --name team-schedule/google-client-secret \
  --secret-string "your-client-secret"

# Store Session Secret
aws secretsmanager create-secret \
  --name team-schedule/session-secret \
  --secret-string "$(openssl rand -base64 32)"

# Store Database URL
aws secretsmanager create-secret \
  --name team-schedule/database-url \
  --secret-string "postgresql://postgres:PASSWORD@team-schedule-db.xxx.rds.amazonaws.com:5432/team_schedule"
```

---

## Environment Variables

### Complete List of Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxx` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | `random-string-32-characters-min` |
| `CALLBACK_URL` | OAuth callback URL | `https://domain.com/auth/google/callback` |
| `ALLOWED_USER_1` | First allowed user email | `user1@company.com` |
| `ALLOWED_USER_2` | Second allowed user email | `user2@company.com` |
| ... | Up to 20 users supported | ... |

### Generate Session Secret

```bash
# Generate random 32-character string
openssl rand -base64 32
```

### Setting Variables in Different Environments

**Elastic Beanstalk:**
```bash
eb setenv KEY=value KEY2=value2
```

**ECS Task Definition:**
Use Secrets Manager references in task definition (see above).

**EC2:**
Add to `/opt/team-schedule/.env` file or use Parameter Store.

---

## CI/CD Pipeline Setup

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: eu-central-1
  ECR_REPOSITORY: team-schedule
  ECS_CLUSTER: team-schedule-cluster
  ECS_SERVICE: team-schedule-service

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build, tag, and push image to Amazon ECR
      id: build-image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
        echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

    - name: Update ECS service
      run: |
        aws ecs update-service \
          --cluster $ECS_CLUSTER \
          --service $ECS_SERVICE \
          --force-new-deployment
```

### Required GitHub Secrets

Add these secrets in GitHub repository settings:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Monitoring & Logging

### 1. CloudWatch Logs

Create log group:

```bash
aws logs create-log-group --log-group-name /ecs/team-schedule
aws logs put-retention-policy --log-group-name /ecs/team-schedule --retention-in-days 30
```

### 2. CloudWatch Alarms

```bash
# CPU Utilization Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name team-schedule-high-cpu \
  --alarm-description "High CPU utilization" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value=team-schedule-cluster Name=ServiceName,Value=team-schedule-service \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-central-1:ACCOUNT_ID:alerts

# Database Connections Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name team-schedule-db-connections \
  --alarm-description "High database connections" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value=team-schedule-db \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-central-1:ACCOUNT_ID:alerts
```

### 3. Application Health Endpoint

The application exposes `/health` endpoint that returns:

```json
{
  "status": "ok",
  "timestamp": "2024-01-26T10:00:00.000Z",
  "storage": "postgresql",
  "databaseConfigured": true
}
```

Use this for ALB health checks and monitoring.

---

## Backup & Recovery

### 1. RDS Automated Backups

Already configured with `--backup-retention-period 7` during RDS creation.

### 2. Manual Snapshot

```bash
aws rds create-db-snapshot \
  --db-instance-identifier team-schedule-db \
  --db-snapshot-identifier team-schedule-manual-$(date +%Y%m%d)
```

### 3. Restore from Snapshot

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier team-schedule-db-restored \
  --db-snapshot-identifier team-schedule-manual-20240126
```

### 4. Export Schedule Data

The application provides CSV export functionality via the web interface.

---

## Security Best Practices

### 1. Network Security

- ✅ Database in private subnet (no public access)
- ✅ Application security group restricts inbound traffic
- ✅ ALB security group allows only 80/443
- ✅ Use HTTPS everywhere

### 2. Data Security

- ✅ RDS encryption at rest enabled
- ✅ Use Secrets Manager for credentials
- ✅ Session cookies are HTTP-only and secure

### 3. Access Control

- ✅ Google OAuth with email whitelist
- ✅ IAM roles with least privilege
- ✅ No hardcoded credentials

### 4. Security Group Rules

**ALB Security Group (`sg-alb`):**
```
Inbound:
- 80 (HTTP) from 0.0.0.0/0
- 443 (HTTPS) from 0.0.0.0/0

Outbound:
- All traffic to sg-app
```

**Application Security Group (`sg-app`):**
```
Inbound:
- 3000 from sg-alb only

Outbound:
- 5432 to sg-rds
- 443 to 0.0.0.0/0 (for OAuth)
```

**RDS Security Group (`sg-rds`):**
```
Inbound:
- 5432 from sg-app only

Outbound:
- None required
```

---

## Cost Optimization

### Estimated Monthly Costs (eu-central-1)

| Service | Configuration | Est. Cost/Month |
|---------|--------------|-----------------|
| RDS PostgreSQL | db.t3.micro, 20GB | ~$15-25 |
| ECS Fargate | 0.25 vCPU, 0.5GB, 2 tasks | ~$20-30 |
| ALB | Standard | ~$20 |
| NAT Gateway | 1 gateway | ~$35 |
| Route 53 | Hosted zone + queries | ~$1-2 |
| CloudWatch | Logs & metrics | ~$5-10 |
| **Total** | | **~$100-120** |

### Cost Reduction Options

1. **Use Fargate Spot** for non-critical workloads (up to 70% savings)
2. **Single-AZ RDS** for dev/test environments
3. **Reserved Instances** for production (up to 40% savings)
4. **Remove NAT Gateway** if no outbound internet needed from private subnet

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

Check logs:
```bash
# ECS
aws logs tail /ecs/team-schedule --follow

# Elastic Beanstalk
eb logs
```

Common causes:
- Missing environment variables
- Database connection failed
- Port mismatch

#### 2. Database Connection Failed

Verify:
```bash
# Check security groups allow traffic
aws ec2 describe-security-groups --group-ids sg-rds-xxx

# Check RDS is available
aws rds describe-db-instances --db-instance-identifier team-schedule-db
```

#### 3. OAuth Callback Error

Verify:
- `CALLBACK_URL` matches Google OAuth settings exactly
- Domain has valid SSL certificate
- Google OAuth consent screen is configured

#### 4. 502 Bad Gateway

Causes:
- Application not running
- Health check failing
- Target group misconfigured

Check:
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

#### 5. Users Can't Login

Verify:
- User email is in `ALLOWED_USER_X` variables
- Email matches exactly (case-insensitive)
- Environment variables are set correctly

Check logs for authentication attempts:
```
🔍 Authentication attempt:
   User email: user@company.com
   Whitelist: ["user@company.com"]
```

---

## Quick Reference Commands

```bash
# Deploy new version (ECS)
aws ecs update-service --cluster team-schedule-cluster --service team-schedule-service --force-new-deployment

# View logs
aws logs tail /ecs/team-schedule --follow

# Check service status
aws ecs describe-services --cluster team-schedule-cluster --services team-schedule-service

# Restart RDS
aws rds reboot-db-instance --db-instance-identifier team-schedule-db

# Scale service
aws ecs update-service --cluster team-schedule-cluster --service team-schedule-service --desired-count 3

# Check database status
aws rds describe-db-instances --db-instance-identifier team-schedule-db --query 'DBInstances[0].DBInstanceStatus'
```

---

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Verify all environment variables are set
3. Check security group rules
4. Review this documentation

---

*Last updated: January 2024*
