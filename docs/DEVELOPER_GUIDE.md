# Ghana NIA Verification System - Developer Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Project Structure](#project-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Authentication System](#authentication-system)
9. [Verification Process](#verification-process)
10. [Testing](#testing)
11. [Contributing Guidelines](#contributing-guidelines)

## Introduction

This guide is intended for developers who need to maintain, extend, or troubleshoot the Ghana NIA Verification System. It provides detailed technical information about the system architecture, code organization, and development practices.

## Development Environment Setup

### Prerequisites

- Node.js v18+ (LTS recommended)
- PostgreSQL 14+
- Git
- npm or yarn

### Local Setup

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd ghana-nia-verification
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. Setup the database:
   ```bash
   # Create PostgreSQL database
   createdb ghana_verify
   
   # Apply schema
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`.

## Project Structure

```
/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions and helpers
│   │   ├── pages/          # Page components
│   │   ├── App.tsx         # Main application component
│   │   └── main.tsx        # Application entry point
│   └── ...                 # Other frontend configuration files
├── db/                     # Database schema and configuration
│   ├── index.ts            # Database connection setup
│   └── schema.ts           # Drizzle ORM schema definitions
├── server/                 # Backend Express server
│   ├── auth.ts             # Authentication configuration
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API route definitions
│   └── vite.ts             # Vite development server integration
├── docs/                   # Documentation
└── ...                     # Configuration files
```

## Frontend Architecture

### Technology Stack

- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **TanStack Query**: Data fetching and caching
- **Zod**: Schema validation
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library
- **Vite**: Build tool and development server
- **TensorFlow.js**: Face detection and analysis

### Key Components

#### Webcam Capture Component
Located at `client/src/components/webcam-capture.tsx`, this component:
- Handles camera initialization and image capture
- Performs face detection using TensorFlow.js
- Applies quality control checks (lighting, face position, etc.)
- Processes captured images for optimal Ghana NIA API compatibility

#### Verification Form
Located at `client/src/components/verification-form.tsx`, this component:
- Manages the verification form state
- Validates Ghana Card number format
- Submits verification data to the backend

#### Authentication Hook
Located at `client/src/hooks/use-auth.tsx`, this hook:
- Manages user authentication state
- Provides login, logout, and registration functions
- Handles authentication errors

### Routing

The application uses `wouter` for routing with the following structure:
- `/` - Home page (protected)
- `/auth` - Authentication page (login/register)
- `/verification` - Verification page
- `/history` - Verification history
- `/admin/*` - Admin pages (user management, verification history)

## Backend Architecture

### Technology Stack

- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **TypeScript**: Type-safe JavaScript
- **Passport.js**: Authentication middleware
- **Drizzle ORM**: Database ORM
- **PostgreSQL**: Database
- **node-fetch**: API requests to Ghana NIA

### Key Modules

#### Authentication
Located at `server/auth.ts`, this module:
- Configures Passport.js for local authentication
- Implements password hashing and verification
- Manages user sessions

#### API Routes
Located at `server/routes.ts`, this module:
- Defines all API endpoints
- Implements verification logic
- Handles Ghana NIA API communication
- Manages user and verification data

#### Database Connection
Located at `db/index.ts`, this module:
- Establishes PostgreSQL connection
- Configures connection pooling
- Sets up Drizzle ORM

## Database Schema

The database has two primary tables:

### Users Table
```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user", "guest"] }).default("guest").notNull(),
  status: text("status", { enum: ["active", "suspended", "pending"] }).default("pending").notNull(),
  fullName: text("full_name"),
  department: text("department"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Verifications Table
```typescript
export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  merchantId: text("merchant_id").notNull(),
  pinNumber: text("pin_number").notNull(),
  imageData: text("image_data"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Relations
```typescript
export const userRelations = relations(users, ({ many }) => ({
  verifications: many(verifications),
}));

export const verificationRelations = relations(verifications, ({ one }) => ({
  user: one(users, { fields: [verifications.userId], references: [users.id] }),
}));
```

## API Documentation

### Authentication Endpoints

#### POST /api/login
- **Description**: Authenticates a user
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**: User object

#### POST /api/register
- **Description**: Registers a new user
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string",
    "fullName": "string",
    "email": "string",
    "department": "string"
  }
  ```
- **Response**: User object

#### POST /api/logout
- **Description**: Logs out the current user
- **Response**: Status 200

#### GET /api/user
- **Description**: Gets the current user
- **Response**: User object

### Verification Endpoints

#### POST /api/verify
- **Description**: Performs a verification against Ghana NIA API
- **Request Body**:
  ```json
  {
    "pinNumber": "string",
    "imageData": "string"
  }
  ```
- **Response**: Verification result

#### GET /api/verifications
- **Description**: Gets all verifications (admin only)
- **Response**: Array of verification objects

#### GET /api/verifications/:id
- **Description**: Gets a specific verification (admin only)
- **Response**: Verification object

#### GET /api/user/verifications
- **Description**: Gets the current user's verifications
- **Response**: Array of verification objects

### User Management Endpoints

#### GET /api/users
- **Description**: Gets all users (admin only)
- **Response**: Array of user objects

#### PATCH /api/users/:id
- **Description**: Updates a user (admin only)
- **Request Body**:
  ```json
  {
    "username": "string",
    "role": "string",
    "fullName": "string",
    "email": "string",
    "department": "string"
  }
  ```
- **Response**: Updated user object

#### PATCH /api/users/:id/status
- **Description**: Updates a user's status (admin only)
- **Request Body**:
  ```json
  {
    "status": "active | suspended | pending"
  }
  ```
- **Response**: Updated user object

## Authentication System

The system uses a session-based authentication system:

1. **Password Hashing**: Passwords are hashed using scrypt with a unique salt for each user.
2. **Session Management**: Express sessions with PostgreSQL store.
3. **Role-Based Access**: Access control based on user roles (admin, user, guest).

Authentication flow:
1. User submits login credentials
2. Server verifies username and password
3. If valid, a session is created
4. Session ID is stored in a cookie
5. Subsequent requests include the cookie for authentication

## Verification Process

The verification process includes these steps:

1. **Image Capture**:
   - Client-side face detection with TensorFlow.js
   - Quality checks (lighting, position, etc.)
   - Image preprocessing to meet Ghana NIA requirements

2. **Data Submission**:
   - Ghana Card number validation
   - Base64 encoding of image
   - Submission to backend API

3. **NIA API Integration**:
   - Backend formats request for Ghana NIA API
   - Adds merchant authentication
   - Sends request to NIA endpoint
   - Parses and processes response

4. **Result Processing**:
   - Store verification results in database
   - Extract verification status
   - Format response data for client

5. **Result Display**:
   - Display verification status to user
   - Show details for admins

## Testing

### Unit Testing

Run unit tests with:
```bash
npm run test
```

### Integration Testing

Run integration tests with:
```bash
npm run test:integration
```

### Manual Testing Checklist

1. **Authentication**
   - [ ] User registration
   - [ ] User login
   - [ ] Password validation
   - [ ] Role-based access

2. **Verification**
   - [ ] Camera initialization
   - [ ] Face detection
   - [ ] Image quality checks
   - [ ] Ghana Card validation
   - [ ] API submission
   - [ ] Result display

3. **Admin Functions**
   - [ ] User management
   - [ ] Verification history
   - [ ] Detailed verification views

## Contributing Guidelines

### Code Style

This project follows a consistent code style:
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Use functional components for React
- Document complex functions and components

### Git Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

### Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Get at least one code review
4. Ensure CI/CD pipeline passes

### Common Development Tasks

#### Adding a New Component
1. Create component in `client/src/components/`
2. Export from appropriate index file
3. Add tests if needed

#### Adding a New API Endpoint
1. Add route in `server/routes.ts`
2. Implement controller logic
3. Add authentication if needed
4. Update API documentation

#### Modifying Database Schema
1. Update schema in `db/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update affected API endpoints