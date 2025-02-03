import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { verifications, users, insertUserSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Register new user
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
          role: "user" // Default role for new registrations
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

  // Health check endpoint for Azure
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

  // Submit verification
  app.post("/api/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { merchantId, pinNumber, imageData } = req.body;

    try {
      const response = await fetch("https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          pin_number: pinNumber,
          image_data: imageData
        })
      });

      const apiResponse = await response.json();

      const [verification] = await db.insert(verifications).values({
        userId: req.user.id,
        merchantId,
        pinNumber,
        imageData,
        status: apiResponse.success ? "approved" : "rejected",
        response: JSON.stringify(apiResponse)
      }).returning();

      res.json(verification);
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ error: "Verification failed" });
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

    const { username, role } = req.body;
    // Only admins can change roles
    if (role && req.user.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const [updatedUser] = await db.update(users)
        .set({ 
          username: username,
          ...(role && { role }) // Only include role if it was provided
        })
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}