# Ghana NIA Verification System - User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles](#user-roles)
4. [Verification Process](#verification-process)
5. [Viewing Verification History](#viewing-verification-history)
6. [User Management (Admin)](#user-management-admin)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)
9. [Contact Support](#contact-support)

## Introduction

The Ghana NIA Verification System is a secure, modern platform designed to verify Ghanaian identity cards through facial recognition technology. This system connects directly to the National Identification Authority (NIA) database to authenticate individuals using their Ghana Card details and facial biometrics.

### Key Features

- Real-time identity verification through facial recognition
- Secure connection to the Ghana NIA database
- Comprehensive verification history tracking
- Role-based access control for enhanced security
- Mobile-compatible verification process
- Detailed verification results with biometric data display

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Edge, or Safari)
- Camera access (webcam or mobile camera)
- Internet connection
- Ghana Card (National ID)

### Logging In

1. Navigate to the application URL
2. Enter your username and password
3. Click "Login"

If you don't have an account, you can register by clicking "Register" on the login page. New accounts will initially have "guest" privileges until an administrator approves and potentially upgrades your account role.

## User Roles

The system supports three user roles, each with different permissions:

### Guest
- Can perform verifications
- Can view their own verification history

### User
- All Guest privileges
- Enhanced verification options

### Admin
- All User privileges
- User management (approve, suspend accounts)
- View all verification histories
- View detailed verification data including API responses
- Approve or reject verifications

## Verification Process

### Step 1: Navigate to Verification Page

Click on "Verify" in the main navigation menu.

### Step 2: Prepare for Capture

For successful verification:
- Ensure good lighting (natural light works best)
- Remove glasses, hats, or other facial obstructions
- Face the camera directly
- Maintain a neutral expression
- Position your face within the guideline overlay

The system will automatically detect:
- Face presence
- Proper lighting
- Liveness (to prevent photo-based fraud)
- Image quality

### Step 3: Capture Photo

1. Wait until all quality checks show green indicators
2. Click the "Capture Photo" button
3. Review the captured image
4. If satisfied, click "Use This Photo"; otherwise, click the X to retake

### Step 4: Enter Ghana Card Details

Enter your Ghana Card Number in the format: `GHA-XXXXXXXX-X`

### Step 5: Submit Verification

Click "Submit Verification" to send your data to the Ghana NIA system.

### Step 6: View Results

Results will be displayed immediately:
- Verification Status (Approved/Rejected)
- Verification Details (when available)

## Viewing Verification History

### Viewing Your History

1. Click on "History" in the main navigation
2. View a list of all your verification attempts
3. Click on any verification to view details

### For Admins: Viewing All History

1. Navigate to "Admin" → "Verification History"
2. Use filters to search by date, status, or user
3. Click on any entry to view complete details, including:
   - Verification images (captured and API response)
   - Full API response data
   - User information
   - Timestamp and status

## User Management (Admin)

### Approving New Users

1. Navigate to "Admin" → "User Management"
2. Find users with "pending" status
3. Click "Approve" to activate the account

### Changing User Roles

1. Navigate to "Admin" → "User Management"
2. Find the user you wish to modify
3. Click "Edit"
4. Change the role using the dropdown menu
5. Click "Save"

### Suspending Accounts

1. Navigate to "Admin" → "User Management"
2. Find the user you wish to suspend
3. Click "Suspend"
4. Confirm your action

## Troubleshooting

### Verification Fails

Common reasons for verification failure:
- Poor image quality
- Face not properly centered
- Incorrect Ghana Card number format
- Card not registered in NIA database
- Network connectivity issues

Solution:
1. Ensure good lighting
2. Position face properly within guidelines
3. Double-check Ghana Card number
4. Try again or contact support

### Camera Not Working

If your camera doesn't appear:
1. Check browser permissions for camera access
2. Ensure no other application is using the camera
3. Reload the page
4. Try a different browser

### Mobile Device Issues

For optimal mobile experience:
1. Use the device in portrait orientation
2. Ensure adequate lighting
3. Hold the device at arm's length
4. Keep steady when capturing

## Best Practices

### Security

- Never share your login credentials
- Log out when finished using the system
- Use the system on secure networks
- Regularly update your password

### Verification Quality

- Ensure good, even lighting on the face
- Remove glasses, hats, and facial coverings
- Use a neutral facial expression
- Position face appropriately in the frame
- Verify Ghana Card number before submission

## Contact Support

For assistance with the verification system:

- **Email**: support@example.com
- **Phone**: +233-XX-XXX-XXXX
- **Hours**: Monday-Friday, 8:00 AM - 5:00 PM GMT

When contacting support, please include:
- Your username
- Time of incident
- Description of the issue
- Screenshots if possible