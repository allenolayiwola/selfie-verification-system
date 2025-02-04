import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db, pool } from "@db";
import { users } from "@db/schema";
import pgSession from "connect-pg-simple";
import passport from "passport";

// Set default NODE_ENV if not provided
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable trust proxy for Azure
app.set('trust proxy', 1);

// Configure session middleware
const PostgresqlStore = pgSession(session);
app.use(session({
  store: new PostgresqlStore({
    pool,
    createTableIfMissing: true,
    // Add error handler for session store
    errorLog: (err) => {
      console.error('Session store error:', err);
    }
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

// Database connection retry logic
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function connectWithRetry(retryCount = 0): Promise<void> {
  try {
    console.log(`Attempting database connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    // Test database connection using a simple query
    const dbTest = await db.select().from(users).limit(1);
    console.log('Database connection successful');
    return;
  } catch (error) {
    console.error(`Database connection attempt ${retryCount + 1} failed:`, error);

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(retryCount + 1);
    }

    throw error;
  }
}

// Application startup
(async () => {
  try {
    console.log(`Starting application in ${process.env.NODE_ENV} mode...`);
    console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password

    await connectWithRetry();

    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || '8080');

    // In production, we let Azure handle SSL termination
    // Just use the basic HTTP server
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port} in ${process.env.NODE_ENV} mode`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('Application startup error:', error);
    process.exit(1);
  }
})();