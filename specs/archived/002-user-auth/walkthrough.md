# Walkthrough: User Authentication Module

## Overview

This document summarizes the implementation of the **User Authentication** feature for Sync ERP. The module provides secure user registration, login, session management, and logout functionality.

## Features Implemented

### 1. Backend Architecture (`apps/api`)

- **Database Models**: Added `User` and `Session` models to Prisma schema.
- **Security**:
  - Bcrypt password hashing.
  - HttpOnly, Secure, SameSite cookies for session management.
  - Strict `authMiddleware` enforcing Session validity and Company membership.
- **Services**:
  - `authService`: Handles business logic for Register and Login.
  - `sessionService`: Manages session creation and validation.
- **Routes**:
  - `POST /api/auth/register`: Creates new user and session.
  - `POST /api/auth/login`: Authenticates user and creates session.
  - `POST /api/auth/logout`: Destroys session.
  - `GET /api/auth/me`: Retrieves current user context.

### 2. Frontend Integration (`apps/web`)

- **Auth Context**: Global `AuthProvider` to manage authentication state (`user`, `isAuthenticated`).
- **Services**: Typed `authService` client interacting with the backend API.
- **Pages**:
  - `RegisterPage`: User sign-up form.
  - `LoginPage`: User sign-in form.
- **Components**:
  - `ProtectedRoute`: Guards authenticated routes and redirects to login.
  - `Layout`: Updated header to include **User Name** and **Logout Button**.
- **Persistence**:
  - `CompanyProvider`: Logic to persist selected company ID to `localStorage` and restore on reload.
  - `CompanySwitcher`: Updated to handle loading states.

### 3. Bug Fixes

- **Suppliers Page**:
  - Fixed issue where data wasn't refreshing when switching companies.
  - Added `currentCompany` context dependency to data fetching effect.

## Verification Results

- **Backend Build**: Passed (`tsc --noEmit`).
- **Frontend Build**: Passed (`tsc --noEmit`).
- **Linting**: Resolved all reported `any` type warnings and correct `Response` typing.

## Usage

1.  **Register**: Go to `/register` to create a new account.
2.  **Login**: Go to `/login` with existing credentials.
3.  **Logout**: Click the "Logout" button in the top navigation bar.
