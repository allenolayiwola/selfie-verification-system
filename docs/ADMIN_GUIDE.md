# Ghana NIA Verification System - Admin Guide

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Server Configuration](#server-configuration)
4. [Database Management](#database-management)
5. [User Management](#user-management)
6. [Ghana NIA API Integration](#ghana-nia-api-integration)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)
10. [System Updates](#system-updates)

## Introduction

This guide provides technical documentation for administrators responsible for maintaining and managing the Ghana NIA Verification System. It covers system architecture, configuration, security, and maintenance procedures.

## System Architecture

The Ghana NIA Verification System consists of:

### Frontend
- React.js application with TypeScript
- TensorFlow.js for client-side face detection
- React Webcam for image capture
- Tailwind CSS for responsive UI

### Backend
- Node.js with Express.js API server
- PostgreSQL database for data storage
- Drizzle ORM for database operations
- Passport.js for authentication

### External Integration
- Ghana NIA verification API

### Application Flow
1. User authentication
2. Webcam image capture with quality checks
3. Secure transmission to backend
4. API call to Ghana NIA verification endpoint
5. Response processing and storage
6. Result display to user

## Server Configuration

### Production Environment Requirements
- Node.js v18+ recommended
- PostgreSQL 14+
- 4GB RAM minimum (8GB recommended)
- 10GB storage (plus database growth)

### Environment Variables

The application requires the following environment variables:

```
# Server configuration
PORT=8080
NODE_ENV=production

# Database configuration
DATABASE_URL=postgres://username:password@host:port/database
PGHOST=your-postgres-host
PGUSER=your-postgres-user
PGPASSWORD=your-postgres-password
PGDATABASE=your-postgres-database
PGPORT=5432

# Session and security
SESSION_SECRET=your-long-secure-random-string

# Ghana NIA API
NIA_API_MERCHANT_KEY=5ce32d6e-2140-413a-935d-dbbb74c65439
```

### Setting Up Production Server

1. Clone the repository
2. Install dependencies with `npm install`
3. Set all environment variables
4. Run database migrations with `npm run db:push`
5. Build the application with `npm run build`
6. Start the server with `npm run start`

## Database Management

### Schema Overview

The system uses two primary tables:

1. **users**
   - User account information
   - Authentication credentials
   - Role management

2. **verifications**
   - Verification requests and results
   - Image data
   - Ghana NIA API responses
   - Status tracking

### Backup Procedures

1. **Daily Automated Backups**
   ```bash
   pg_dump -Fc -v -h [host] -U [user] -d [database] > backup-$(date +%Y%m%d).dump
   ```

2. **Restoration Procedure**
   ```bash
   pg_restore -v -h [host] -U [user] -d [database] [backup-file]
   ```
   
### Database Maintenance

1. Regular vacuuming:
   ```sql
   VACUUM ANALYZE;
   ```

2. Clearing verification history (if needed):
   ```sql
   -- Clear all verifications older than 90 days
   DELETE FROM verifications WHERE created_at < NOW() - INTERVAL '90 days';
   
   -- Alternative: archive them first
   CREATE TABLE verification_archive AS 
   SELECT * FROM verifications WHERE created_at < NOW() - INTERVAL '90 days';
   ```

## User Management

### Managing Administrator Accounts

The first admin account must be created manually in the database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'desired_admin_username';
```

### Account Policies

1. **Password Requirements**
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers, and symbols
   
2. **Account Lockout**
   - Accounts are locked after 5 failed login attempts
   - Admin must manually unlock accounts

3. **Session Management**
   - Sessions expire after 24 hours of inactivity
   - Configurable in the SESSION_MAX_AGE environment variable

## Ghana NIA API Integration

### API Configuration

The system integrates with the Ghana NIA verification API:

- **Endpoint**: `https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64`
- **Method**: POST
- **Format**: JSON
- **Authentication**: Merchant Key in request body

### Request Format

```json
{
  "dataType": "JPG",
  "image": "[base64 image data]",
  "pinNumber": "GHA-XXXXXXXX-X",
  "merchantKey": "5ce32d6e-2140-413a-935d-dbbb74c65439"
}
```

### Response Handling

The system processes responses from the Ghana NIA API:

1. Success response:
   - verified: "TRUE"
   - Contains person data with photo and signature

2. Failure response:
   - verified: "FALSE"
   - Contains error details

### Handling API Outages

The system implements:
1. Request timeout after 30 seconds
2. Automatic retry (up to 3 attempts)
3. Graceful failure with appropriate user messaging

## Security Considerations

### Data Protection

1. **Personal Data**
   - All verification data is encrypted at rest
   - Personal information is subject to data protection regulations

2. **Image Data**
   - Facial images should be handled according to privacy laws
   - Consider implementing automatic data retention policies

3. **API Credentials**
   - Ghana NIA merchant key must be securely stored
   - Rotate keys periodically if supported by Ghana NIA

### Network Security

1. **HTTPS**
   - Always use HTTPS in production
   - Configure strong cipher suites

2. **Firewall**
   - Restrict server access to necessary ports only
   - Implement IP allowlisting for admin interfaces

3. **Rate Limiting**
   - Prevent abuse with rate limiting on all endpoints
   - Special consideration for verification endpoint

## Monitoring & Maintenance

### Application Monitoring

1. **Log Monitoring**
   - Application logs stored in `/var/log/ghana-verify/`
   - Verification failures logged with request data
   - User actions logged for audit purposes

2. **Performance Metrics**
   - Monitor server resource usage
   - Track API response times
   - Watch database query performance

### Health Checks

The system provides a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-04-28T15:35:12.619Z",
  "database": "connected",
  "server": "running",
  "port": 8080
}
```

## Troubleshooting

### Common Issues

1. **Verification Failures**
   - Check Ghana NIA API status
   - Validate image quality parameters
   - Verify Ghana Card number format

2. **Performance Degradation**
   - Check database connection pool
   - Verify database indexes
   - Monitor memory usage

3. **Database Connection Issues**
   - Verify PostgreSQL service status
   - Check connection string
   - Validate user permissions

### Error Logs

Important error logs to monitor:

1. `Failed to connect to Ghana NIA API` - Connectivity issue with external API
2. `Verification failed with status code 4XX/5XX` - API rejection
3. `Database query error in verification storage` - DB issues

## System Updates

### Update Process

1. **Preparation**
   ```bash
   # Backup database
   pg_dump -Fc -v -h [host] -U [user] -d [database] > pre-update-backup.dump
   
   # Backup application
   tar -zcvf app-backup.tar.gz /path/to/application
   ```

2. **Deployment**
   ```bash
   # Pull latest code
   git pull origin main
   
   # Install dependencies
   npm install
   
   # Run migrations if needed
   npm run db:push
   
   # Build application
   npm run build
   
   # Restart service
   systemctl restart ghana-verify
   ```

3. **Verification**
   - Check application logs for startup errors
   - Verify health check endpoint
   - Test basic functionality

### Rollback Procedure

If update fails:

```bash
# Restore code
tar -zxvf app-backup.tar.gz -C /path/to/application

# Restore database if needed
pg_restore -v -h [host] -U [user] -d [database] pre-update-backup.dump

# Restart service
systemctl restart ghana-verify
```