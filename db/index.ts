import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure WebSocket for Azure environment
if (process.env.NODE_ENV === 'production') {
  neonConfig.webSocketConstructor = require('ws');
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineTLS = true;
  neonConfig.pipelineConnect = true;
  neonConfig.wsProxy = (host) => {
    console.log('WebSocket proxy host:', host);
    return host;
  };
}

// Configure the pool with proper settings for serverless environment
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Lower max connections for serverless
  idleTimeoutMillis: 15000, // Close idle clients after 15 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false, // Required for Azure PostgreSQL
  } : undefined
};

console.log('Initializing database connection pool...');

export const pool = new Pool(poolConfig);

// Enhanced error handling for pool events
pool.on('connect', () => {
  console.log('New client connected to database');
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down database pool...');
  pool.end(() => {
    console.log('Database pool has ended');
    process.exit(0);
  });
});