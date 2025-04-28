# Ghana NIA Verification System - Installation Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Starting the Application](#starting-the-application)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before installing the Ghana NIA Verification System, ensure you have the following prerequisites:

### System Requirements
- **Operating System**: Linux (recommended), macOS, or Windows
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: Minimum 10GB free space

### Software Requirements
- **Node.js**: v18.x or later
- **npm**: v9.x or later
- **PostgreSQL**: v14.x or later
- **Git**: Latest stable version

## Installation Steps

Follow these steps to install the Ghana NIA Verification System:

### 1. Clone the Repository

```bash
git clone https://github.com/your-organization/ghana-nia-verification.git
cd ghana-nia-verification
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment Configuration

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration (see [Environment Configuration](#environment-configuration) below).

### 4. Set Up the Database

```bash
# Create a PostgreSQL database
createdb ghana_nia_verification

# Apply the database schema
npm run db:push
```

### 5. Build the Application

```bash
npm run build
```

### 6. Start the Application

```bash
npm run start
```

The application should now be running on http://localhost:8080 (or the port you configured).

## Environment Configuration

Configure the following environment variables in your `.env` file:

### Server Configuration
```
PORT=8080
NODE_ENV=production
```

### Database Configuration
```
DATABASE_URL=postgres://username:password@localhost:5432/ghana_nia_verification
PGHOST=localhost
PGUSER=your_postgres_user
PGPASSWORD=your_postgres_password
PGDATABASE=ghana_nia_verification
PGPORT=5432
```

### Security Configuration
```
SESSION_SECRET=your_long_random_string_for_session_encryption
```

### Ghana NIA API Configuration
```
NIA_API_MERCHANT_KEY=5ce32d6e-2140-413a-935d-dbbb74c65439
```

## Database Setup

### Creating the First Admin User

After initial setup, you'll need to create an admin user:

1. Register a regular user through the application interface
2. Use the following SQL command to promote the user to admin:

```sql
UPDATE users 
SET role = 'admin', status = 'active' 
WHERE username = 'your_admin_username';
```

### Database Backups

Set up regular database backups:

```bash
# Create a backup script (backup.sh)
echo '#!/bin/bash
BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
pg_dump -Fc ghana_nia_verification > "$BACKUP_DIR/ghana_nia_verification_$TIMESTAMP.dump"
' > backup.sh

chmod +x backup.sh

# Add to crontab for daily backups at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

## Starting the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run start
```

### As a Service (Linux)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/ghana-nia-verification.service
```

Add the following content:

```
[Unit]
Description=Ghana NIA Verification System
After=network.target postgresql.service

[Service]
Type=simple
User=your_service_user
WorkingDirectory=/path/to/ghana-nia-verification
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable ghana-nia-verification
sudo systemctl start ghana-nia-verification
```

## Production Deployment

For production deployment, additional steps are recommended:

### 1. Set Up HTTPS

Use a reverse proxy like Nginx:

```bash
sudo apt install nginx
```

Create an Nginx configuration:

```
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Set Up Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3. Set Up Monitoring

Consider setting up monitoring with something like PM2:

```bash
npm install -g pm2
pm2 start npm --name "ghana-nia-verification" -- run start
pm2 save
pm2 startup
```

## Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to the database
**Solution**: 
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env`
- Ensure the database exists: `psql -l`

### Application Startup Issues

**Problem**: Application fails to start
**Solution**:
- Check logs: `npm run start > app.log 2>&1`
- Verify Node.js version: `node --version`
- Check for port conflicts: `sudo lsof -i :8080`

### Verification API Issues

**Problem**: Verification calls to Ghana NIA fail
**Solution**:
- Verify internet connectivity
- Check the NIA_API_MERCHANT_KEY in `.env`
- Ensure the format of the request is correct
- Check if Ghana NIA service is available

### Memory Issues

**Problem**: Application crashes with "out of memory" errors
**Solution**:
- Increase Node.js memory limit: `export NODE_OPTIONS=--max-old-space-size=4096`
- Check for memory leaks using Node.js profiler
- Consider upgrading server RAM

For additional assistance, refer to the [Admin Guide](ADMIN_GUIDE.md) or contact system support.