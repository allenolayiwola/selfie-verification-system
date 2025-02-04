import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./schema";

// Configure WebSocket for Neon database
neonConfig.webSocketConstructor = ws;
// Disable WebSocket in production Azure environment
if (process.env.NODE_ENV === 'production') {
  neonConfig.wsProxy = undefined; // Use undefined instead of false to match the type
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the pool with SSL options for production
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Always enable SSL in production with proper error handling
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false, // Required for Azure PostgreSQL
    ssl: true,
    checkServerIdentity: () => undefined // Skip hostname checks
  } : undefined,
  // Add connection pool settings for better stability
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000 // Return an error after 2 seconds if connection could not be established
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });