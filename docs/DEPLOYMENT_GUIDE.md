# SmartHire AI Production Deployment Guide

## Local / Staging Deployment (Docker Compose)

1. Ensure Docker Desktop is installed and running.
2. Configure `.env` environment variables:
   ```env
   SECRET_KEY=production_secret_key_smarthire_2026
   POSTGRES_SERVER=postgres
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgrespassword2026
   POSTGRES_DB=smarthire_db
   OPENAI_API_KEY=sk-your-openai-api-key
   ```
3. Run container build:
   ```bash
   docker-compose up --build -d
   ```
4. Verify endpoints:
   - Client Web App: http://localhost:3001
   - FastAPI Docs: http://localhost:8000/api/v1/docs

## Production AWS EC2 + S3 Deployment

1. Provision an AWS EC2 instance (`t3.large` or GPU enabled `g4dn.xlarge` for local DeepFace/Whisper execution).
2. Install Docker & Docker Compose on instance.
3. Configure Nginx SSL termination with Let's Encrypt Certbot:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d smarthire.ai
   ```
4. Configure S3 Bucket for Resume PDF and session recording storage.
