# Ghana NIA Verification System

A secure and intelligent ID verification application that integrates with Ghana's National Identification Authority (NIA) system. This application provides professional photo authentication through facial recognition technology with comprehensive security features and intuitive user interactions.

## Documentation

Comprehensive documentation is available in the `docs` directory:

- [User Guide](docs/USER_GUIDE.md) - For end users of the system
- [Admin Guide](docs/ADMIN_GUIDE.md) - For system administrators
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - For developers maintaining or extending the system
- [Installation Guide](docs/INSTALLATION.md) - For setting up the system
- [Documentation Overview](docs/README.md) - Summary of all documentation

## Features

- 📸 Advanced Face Detection & Liveness Checks using TensorFlow.js
- 🎯 Real-time Image Quality Analysis
  - Face positioning guidance
  - Lighting quality checks
  - Image sharpness detection
- 🔒 Secure Authentication System
- 📊 Comprehensive Verification Dashboard
- 🎓 Interactive Onboarding Tutorial
- 💻 Responsive Design for All Devices

## Technology Stack

- **Frontend**:
  - React with TypeScript
  - TensorFlow.js for face detection
  - TailwindCSS + shadcn/ui for styling
  - React Query for state management
  - Wouter for routing

- **Backend**:
  - Express.js server
  - PostgreSQL database with Drizzle ORM
  - Passport.js for authentication

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```env
   DATABASE_URL=your_postgresql_database_url
   ```

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000` in development mode, or `http://localhost:8080` in production mode

## Project Structure

```
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/   # Reusable React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions and configurations
│   │   └── pages/        # Application pages
├── server/               # Backend Express application
│   ├── routes.ts         # API routes
│   └── auth.ts          # Authentication setup
└── db/                  # Database configuration and schemas
```

## Features Overview

### Ghana NIA Verification Process
- Real-time face detection with bounding box display
- Liveness detection through motion analysis
- Image quality assessment including:
  - Face centering
  - Proper distance
  - Lighting conditions
  - Head positioning
- Ghana Card number validation
- Secure integration with Ghana NIA API
- Side-by-side display of captured and API response images
- Signature image display from Ghana NIA database

### User Dashboard
- Verification history tracking
- Status monitoring (pending/approved/rejected)
- Detailed verification results with NIA data
- Mobile-optimized verification workflow

### Admin Features
- Comprehensive verification management
- User activity monitoring and approval
- Verification statistics and analytics
- Detailed API response viewing
- Role-based access control

## Security Features

- Secure password hashing
- Session-based authentication
- Role-based access control
- Secure image handling and storage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.