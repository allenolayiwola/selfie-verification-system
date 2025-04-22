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
// Note: JSON and URL-encoded middleware are configured in routes.ts with size limits

// Set trust proxy for production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Enhanced connection retry for production
const MAX_RETRIES = process.env.NODE_ENV === 'production' ? 5 : 3;
const RETRY_DELAY = 2000; // 2 seconds

async function connectWithRetry(retryCount = 0): Promise<void> {
  try {
    console.log(`Attempting database connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    console.log(`Database connection details: host=${process.env.PGHOST}, port=${process.env.PGPORT}, database=${process.env.PGDATABASE}, user=${process.env.PGUSER}`);

    // Test database connection
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

    // Use port 8080 for production (Digital Ocean) and 5000 for development
    const port = parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '8080' : '5000'));
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port} in ${process.env.NODE_ENV} mode`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('Application startup error:', error);
    process.exit(1);
  }
})();