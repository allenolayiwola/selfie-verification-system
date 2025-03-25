import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { db } from "@db";
import { users, verifications, insertUserSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import fetch from 'node-fetch';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return hashedBuf.equals(suppliedBuf);
}

export function registerRoutes(app: Express): Server {
  // Configure express to handle larger payloads up to 5MB
  app.use(express.json({ limit: '5mb', strict: true }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  // Passport configuration
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Update the registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, result.data.username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Create new user with hashed password
      const [user] = await db
        .insert(users)
        .values({
          ...result.data,
          password: await hashPassword(result.data.password),
          role: "guest", // Set default role to guest
          status: "active"  // Guests are automatically activated
        })
        .returning();

      // Log the user in after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to log in after registration" });
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login error" });
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user (admin only or self)
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = parseInt(req.params.id);
    // Only allow admins to update other users, or users to update themselves
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res.sendStatus(403);
    }

    const { username, role, fullName, email, department } = req.body;
    // Only admins can change roles
    if (role && req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const [updatedUser] = await db.update(users)
        .set({
          ...(username && { username }),
          ...(role && { role }),
          ...(fullName && { fullName }),
          ...(email && { email }),
          ...(department && { department })
        })
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    const userId = parseInt(req.params.id);
    // Prevent deleting your own account
    if (req.user.id === userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    try {
      const [deletedUser] = await db.delete(users)
        .where(eq(users.id, userId))
        .returning();

      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(deletedUser);
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Update user status
  app.patch("/api/users/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    const userId = parseInt(req.params.id);
    const { status } = req.body;

    // Validate status
    if (!["active", "suspended", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      const [updatedUser] = await db
        .update(users)
        .set({ status })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });


  // Update verification status (admin only)
  app.patch("/api/verifications/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    const verificationId = parseInt(req.params.id);
    const { status, response } = req.body;

    // Validate status
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      const [updatedVerification] = await db
        .update(verifications)
        .set({
          status,
          response: response || null
        })
        .where(eq(verifications.id, verificationId))
        .returning();

      if (!updatedVerification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      res.json(updatedVerification);
    } catch (error) {
      console.error('Error updating verification:', error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  // Update submit verification endpoint
  app.post("/api/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { pinNumber, imageData } = req.body;
    const merchantId = "5ce32d6e-2140-413a-935d-dbbb74c65439";

    try {
      // Store verification attempt in database before external API call
      const [verification] = await db.insert(verifications).values({
        userId: req.user.id,
        merchantId,
        pinNumber,
        imageData, // Store the raw base64 data
        status: "pending", // Use a valid status from the schema
        response: null
      }).returning();

      console.log('Sending verification to external API:', {
        url: 'https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64',
        merchant_id: merchantId,
        imageSize: imageData.length
      });

      // Call external API
      const apiResponse = await fetch('https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          pin_number: pinNumber,
          image_data: imageData // Send the base64 data directly
        })
      });

      const responseData = await apiResponse.json();
      console.log('External API response:', responseData);

      // Update verification with API response
      await db.update(verifications)
        .set({
          status: apiResponse.ok ? "pending" : "rejected",
          response: JSON.stringify(responseData)
        })
        .where(eq(verifications.id, verification.id));

      // Return the API response to client
      if (!apiResponse.ok) {
        return res.status(apiResponse.status).json({
          error: "External verification failed",
          details: responseData
        });
      }

      res.json(responseData);
    } catch (error: any) { // Type assertion to avoid TS error
      console.error('Verification error:', error);

      // Update verification with error if it exists
      res.status(500).json({
        error: "Verification failed",
        details: error.message
      });
    }
  });

  // Get verifications (admin only)
  app.get("/api/verifications", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    try {
      const results = await db.select().from(verifications);
      res.json(results);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      res.status(500).json({ error: "Failed to fetch verifications" });
    }
  });

  // Get user verifications
  app.get("/api/user/verifications", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const results = await db.select()
        .from(verifications)
        .where(eq(verifications.userId, req.user.id));
      res.json(results);
    } catch (error) {
      console.error('Error fetching user verifications:', error);
      res.status(500).json({ error: "Failed to fetch user verifications" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout error" });
      }
      res.sendStatus(200);
    });
  });

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      await db.select().from(users).limit(1);
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        database: "connected",
        server: "running"
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: "unhealthy",
        error: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}