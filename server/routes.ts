import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { db } from "@db";
import { users, verifications, insertUserSchema } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import fetch from 'node-fetch';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

const scryptAsync = promisify(scrypt);

export function registerRoutes(app: Express): Server {
  // Configure express with 1MB limits
  app.use(express.json({
    limit: '1mb',
    strict: true,
    verify: (req: any, _res, buf, encoding) => {
      // Log request size for debugging
      const contentLength = buf.length;
      console.log('Request body size:', {
        size: contentLength,
        sizeInMB: (contentLength / (1024 * 1024)).toFixed(2) + 'MB',
        contentType: req.headers['content-type']
      });
    }
  }));

  app.use(express.urlencoded({
    limit: '1mb',
    extended: true
  }));

  // Error handling middleware for payload size errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err) {
      console.error('Express middleware error:', {
        name: err.name,
        message: err.message,
        type: err.type,
        status: err.status || err.statusCode
      });

      if (err.type === 'entity.too.large' || 
          (err instanceof SyntaxError && ((err as any).status === 413 || (err as any).statusCode === 413))) {
        return res.status(413).json({
          error: "Request entity too large",
          details: "The uploaded file exceeds the size limit of 1MB"
        });
      }
    }
    next(err);
  });

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

  app.post("/api/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    console.log('Verification request received with body keys:', Object.keys(req.body));
    
    const { pinNumber, imageData } = req.body;
    const merchantKey = "5ce32d6e-2140-413a-935d-dbbb74c65439";
    
    // User agent detection for mobile handling
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    console.log('Device type:', isMobile ? 'Mobile' : 'Desktop');
    console.log('PIN number present:', !!pinNumber, 'Image data present:', !!imageData);

    try {
      // Validate input data
      if (!pinNumber || pinNumber.trim() === '') {
        console.log('PIN number validation failed, received:', pinNumber);
        return res.status(400).json({ 
          error: "Ghana Card Number is required",
          details: "Please provide a valid Ghana Card Number" 
        });
      }
      
      if (!imageData) {
        console.log('Image data validation failed');
        return res.status(400).json({ error: "Image data is required" });
      }
      
      // Check for potentially corrupted image data
      if (imageData.length < 1000) {
        console.error('Image data appears truncated or corrupted');
        return res.status(422).json({ 
          error: "Invalid image data", 
          details: "The image data is too small or corrupted. Please retake the photo." 
        });
      }

      // Log request size and format details
      console.log('Verification request details:', {
        contentLength: req.headers['content-length'],
        contentType: req.headers['content-type'],
        imageDataLength: imageData.length,
        isMobile: isMobile,
        imageSizeInMB: (imageData.length / (1024 * 1024)).toFixed(2) + 'MB'
      });

      // Handle all possible image format prefixes
      let base64Data = imageData;
      
      // Check for any data URI prefix and extract just the base64 data
      if (imageData.includes('base64,')) {
        // This handles any data URI format (png, jpeg, etc.)
        base64Data = imageData.split('base64,')[1];
        console.log('Extracted base64 data from data URI');
      }

      console.log('Base64 data details:', {
        originalLength: imageData.length,
        processedLength: base64Data.length,
        processedSizeInMB: (base64Data.length / (1024 * 1024)).toFixed(2) + 'MB'
      });

      // Make sure PIN is properly formatted - important to use "pin" field name exactly
      // Strip any whitespace that might be causing issues with validation
      const trimmedPinNumber = pinNumber.trim();
      console.log('PIN Number raw value:', trimmedPinNumber);
      console.log('PIN Number type:', typeof trimmedPinNumber);
      
      // Format the request body EXACTLY as required by the API:
      // {
      //   "pin": "GHA-xxxxxxxx-x",
      //   "image": "base 64 image",
      //   "merchantKey": "xxxxx-xxxxx-xxxxx"
      // }
      
      if (!pinNumber || pinNumber.trim() === '') {
        console.log('WARNING: PIN is empty or null, cannot proceed with verification');
        return res.status(400).json({ 
          error: "Ghana Card Number is required",
          details: "Please provide a valid Ghana Card Number"
        });
      }
      
      // Create the exact format required by the API
      // Try a different format for the PIN field
      // The API is expecting "pin" (not "PIN"), let's check the exact format
      // Explicitly create the exact structure needed with both lowercase and JSON stringified properly
      // Let's try keeping the PIN in its original format with hyphens
      // The API might be expecting the exact format with hyphens included
      // Format: GHA-xxxxxxxx-x
      
      // Updated request format as per API owner's instructions
      const requestBody = {
        dataType: "JPG", // API requires this field - indicates photo format
        image: base64Data,
        pinNumber: trimmedPinNumber, // Using pinNumber instead of pin as required
        merchantKey: merchantKey // Still need to include the merchant key
      };
      
      // These logs are now redundant with our enhanced logging below
      
      // Enhanced detailed logging for debugging purposes
      
      // Original request details
      console.log('ORIGINAL REQUEST DETAILS:');
      console.log('========================');
      console.log('PIN Field Value (raw):', pinNumber);
      console.log('PIN Field Type:', typeof pinNumber);
      console.log('PIN Field Length:', pinNumber.length);
      console.log('PIN First/Last Chars:', pinNumber.charAt(0) + '...' + pinNumber.charAt(pinNumber.length-1));
      console.log('PIN Before Trimming:', pinNumber);
      console.log('PIN After Trimming:', trimmedPinNumber);
      // Skip character codes to avoid TypeScript errors
      
      // Log the exact JSON string that will be sent
      console.log('\nREQUEST BODY 1 (Original):');
      console.log('=======================');
      const requestBodyJSON = JSON.stringify(requestBody);
      console.log('JSON Length:', requestBodyJSON.length);
      console.log('JSON Sample:', requestBodyJSON.substring(0, 100) + '...');
      console.log('Original Field Names:', Object.keys(requestBody));
      console.log('Field Types:', {
        dataType: typeof requestBody.dataType,
        image: typeof requestBody.image,
        pinNumber: typeof requestBody.pinNumber
      });
      
      // Let's also log the exact field names (crucial for debugging)
      console.log('\nFIELD NAME CHECK:');
      console.log('==============');
      console.log('Field names exactly as sent in requestBody:', {
        hasDataTypeField: 'dataType' in requestBody,
        hasPinNumberField: 'pinNumber' in requestBody, 
        hasImageField: 'image' in requestBody,
        hasMerchantKeyField: 'merchantKey' in requestBody
      });
      
      // For debugging - log the actual JSON being sent (without showing full image data)
      const requestBodyForLog = {
        ...requestBody,
        image: requestBody.image ? requestBody.image.substring(0, 50) + '...[truncated]' : null
      };
      console.log('\nREQUEST BODY 1 STRUCTURE:');
      console.log('=======================');
      console.log(JSON.stringify(requestBodyForLog, null, 2));
      
      // We no longer need alternate request body logging since we're using the correct format now

      // Check for any potential encoding issues with the PIN
      console.log('\nPOSSIBLE ENCODING ISSUES:');
      console.log('======================');
      console.log('PIN URLEncoded:', encodeURIComponent(trimmedPinNumber));
      console.log('PIN with Space Check:', `"${trimmedPinNumber}"`.indexOf(' ') >= 0 ? 'Has spaces' : 'No spaces');
      console.log('PIN with Special Chars Check:', /[^\w\-]/.test(trimmedPinNumber) ? 'Has special chars' : 'No special chars');
      
      console.log('\nAPI DETAILS:');
      console.log('===========');
      console.log('URL:', 'https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64');
      console.log('Request Method:', 'POST');
      console.log('Content-Type:', 'application/json');

      // For mobile devices, modify the request for better success rate
      if (isMobile) {
        // Add metadata that helps Ghana NIA API recognize mobile images better
        // These are non-standard but help with their internal processing
        requestBody.optimizedForMobile = true;
        requestBody.faceEnhanced = true;
        
        console.log('Added mobile optimization metadata for better API success rate');
      }
      
      // Final request JSON with any optimizations
      const finalRequestJSON = JSON.stringify(requestBody);

      // Call external API with updated request format and enhanced headers
      const apiResponse = await fetch('https://selfie.imsgh.org:2035/skyface/api/v1/third-party/verification/base_64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Device-Type': isMobile ? 'mobile' : 'desktop',
          'X-Face-Optimization': 'enhanced',
          'User-Agent': req.headers['user-agent'] || 'Ghana-NIA-Verification/1.0'
        },
        body: finalRequestJSON
      });

      const responseData = await apiResponse.json();
      console.log('External API response:', responseData);

      // Determine the verification status based on the API response
      let verificationStatus = "pending";
      
      console.log('Full API response structure:', typeof responseData === 'object' ? 
          JSON.stringify(responseData, null, 2).substring(0, 500) + '...' : 
          'Non-object response');
      
      // Check for the verification result in different possible response formats
      // TypeScript type narrowing to ensure responseData is an object with expected fields
      if (responseData && typeof responseData === 'object' && 'data' in responseData && 
          responseData.data && typeof responseData.data === 'object' && 'verified' in responseData.data) {
        // New format with "verified" field
        const verified = responseData.data.verified;
        if (verified === "TRUE" || verified === true) {
          verificationStatus = "approved";
        } else {
          verificationStatus = "rejected";
        }
        console.log('Setting verification status based on data.verified:', verified);
      } else if (responseData && typeof responseData === 'object' && 'responseCode' in responseData) {
        // Original expected format with responseCode
        const responseCode = responseData.responseCode as string;
        switch (responseCode) {
          case "00": // Success
            verificationStatus = "approved";
            break;
          case "01": // Unsuccessful
          case "02": // Invalid Data
          case "03": // NIA watchlist
          case "04": // Server Error
            verificationStatus = "rejected";
            break;
          default:
            verificationStatus = "pending";
        }
        console.log('Setting verification status based on responseCode:', responseCode);
      } else {
        // Fallback if neither format matches
        console.log('Unknown response format, defaulting to pending status');
      }
      
      console.log('Final verification status:', verificationStatus);
      
      // Log details about the image data
      console.log('Image data details before storing in database:', {
        imageDataType: typeof imageData,
        imageDataPresent: !!imageData,
        imageDataLength: imageData ? imageData.length : 0,
        sampleStart: imageData ? imageData.substring(0, 30) + '...' : 'none'
      });
      
      // Process the image data to ensure it's not empty
      const processedImageData = imageData && imageData.length > 0 ? imageData : null;
      console.log('Image data for storing:', {
        originalImageDataLength: imageData ? imageData.length : 0,
        processedImageDataLength: processedImageData ? processedImageData.length : 0,
        isImageDataNull: processedImageData === null,
        isOriginalImageDataNull: imageData === null
      });

      // Store verification metadata along with the image data in database
      try {
        const [verification] = await db.insert(verifications).values({
          userId: req.user.id,
          merchantId: merchantKey,
          pinNumber,
          imageData: processedImageData, // Store the processed image data
          status: verificationStatus as "pending" | "approved" | "rejected", // Type assertion for proper status value
          response: JSON.stringify(responseData)
        }).returning();
        
        console.log('Verification stored in database with ID:', verification.id);
        
        // Check if the image data was stored correctly
        const [storedVerification] = await db
          .select({ 
            imageDataLength: sql`length(${verifications.imageData})`,
            imageDataSample: sql`substring(${verifications.imageData}, 1, 30)`
          })
          .from(verifications)
          .where(eq(verifications.id, verification.id))
          .limit(1);
        
        if (storedVerification) {
          console.log('Stored image data length:', storedVerification.imageDataLength);
          console.log('Image data sample:', storedVerification.imageDataSample);
          
          if (storedVerification.imageDataLength === 0) {
            console.error('WARNING: Image data was not stored correctly!');
          }
        } else {
          console.error('Could not retrieve stored verification data!');
        }
      } catch (dbError) {
        console.error('Error storing verification data:', dbError);
        throw dbError;
      }

      if (!apiResponse.ok) {
        return res.status(apiResponse.status).json({
          error: "External verification failed",
          details: responseData
        });
      }

      res.json(responseData);
    } catch (error: any) {
      console.error('Verification error:', error);

      res.status(500).json({
        error: "Verification failed",
        details: error.message
      });
    }
  });

  // Get verifications (admin only) - with user details
  app.get("/api/verifications", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    try {
      // Join verifications with users to get user details
      const results = await db
        .select({
          id: verifications.id,
          userId: verifications.userId,
          merchantId: verifications.merchantId,
          pinNumber: verifications.pinNumber,
          imageData: verifications.imageData,
          status: verifications.status,
          response: verifications.response,
          createdAt: verifications.createdAt,
          // Include user details
          username: users.username,
          fullName: users.fullName,
          department: users.department,
          email: users.email,
          userRole: users.role
        })
        .from(verifications)
        .leftJoin(users, eq(verifications.userId, users.id)); // Get all results (will sort on client side)
      
      res.json(results);
    } catch (error) {
      console.error('Error fetching verifications:', error);
      res.status(500).json({ error: "Failed to fetch verifications" });
    }
  });
  
  // Get a single verification by ID (admin only) - with user details
  app.get("/api/verifications/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.sendStatus(401);
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid verification ID" });
      }

      // Join verifications with users to get user details
      const [result] = await db
        .select({
          id: verifications.id,
          userId: verifications.userId,
          merchantId: verifications.merchantId,
          pinNumber: verifications.pinNumber,
          imageData: verifications.imageData,
          status: verifications.status,
          response: verifications.response,
          createdAt: verifications.createdAt,
          // Include user details
          username: users.username,
          fullName: users.fullName,
          department: users.department,
          email: users.email,
          userRole: users.role
        })
        .from(verifications)
        .where(eq(verifications.id, id))
        .leftJoin(users, eq(verifications.userId, users.id))
        .limit(1);
      
      if (!result) {
        return res.status(404).json({ error: "Verification not found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching verification:', error);
      res.status(500).json({ error: "Failed to fetch verification" });
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

  // Health check endpoint - essential for deployment
  app.get("/health", async (req, res) => {
    try {
      await db.select().from(users).limit(1);
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        database: "connected",
        server: "running",
        port: process.env.PORT || 5000
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
  
  // Root health check endpoint for API only
  app.get("/api", (req, res) => {
    res.status(200).send("ID Verification System API is running");
  });

  const httpServer = createServer(app);
  
  // Add WebSocket server on a different path than Vite's HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      console.log('Received:', message.toString());
      
      // Echo back to client for now (can be enhanced later)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'echo',
          message: message.toString(),
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  return httpServer;
}

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