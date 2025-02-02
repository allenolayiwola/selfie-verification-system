import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { verifications, users } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Get verifications (admin only)
  app.get("/api/verifications", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    const results = await db.select().from(verifications);
    res.json(results);
  });

  // Get user verifications
  app.get("/api/user/verifications", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const results = await db.select()
      .from(verifications)
      .where(eq(verifications.userId, req.user.id));
    res.json(results);
  });

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    const allUsers = await db.select().from(users);
    res.json(allUsers);
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
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}