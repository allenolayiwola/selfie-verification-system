import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from "./schema";
import WebSocket from 'ws';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure WebSocket for all environments
neonConfig.webSocketConstructor = WebSocket;
neonConfig.useSecureWebSocket = true;

// Basic configuration with SSL for production
console.log('Initializing database connection pool...');

// Configure the pool with environment-specific settings
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : undefined
};

export const pool = new Pool(poolConfig);

// Enhanced error handling for pool events
pool.on('connect', (client) => {
  console.log('New client connected to database');
  client.on('error', (err) => {
    console.error('Client specific error:', err);
  });
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

pool.on('acquire', () => {
  console.log('Client acquired from pool');
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