# TechWire Inventory & E-Commerce Backend

This repository contains the complete backend service for the TechWire Inventory and E-Commerce platform. It is built with Node.js, Express, Prisma, and PostgreSQL, and leverages Firebase for user authentication and AWS S3 for file storage.

The system is designed to manage a product catalog with complex variants, handle customer orders, process bulk data uploads, and provide a secure authentication layer for both administrators and clients.

## Table of Contents

1.  [System Architecture](#1-system-architecture)
    *   [Core Technologies](#core-technologies)
    *   [Database Schema](#database-schema)
    *   [Authentication Flow (Admin & Client)](#authentication-flow-admin--client)
    *   [File & Report Handling](#file--report-handling)
2.  [Prerequisites](#2-prerequisites)
3.  [Local Setup & Installation](#3-local-setup--installation)
    *   [Step 1: Clone the Repository](#step-1-clone-the-repository)
    *   [Step 2: Install Dependencies](#step-2-install-dependencies)
    *   [Step 3: Set Up Environment Variables (.env)](#step-3-set-up-environment-variables-env)
    *   [Step 4: Set Up the PostgreSQL Database](#step-4-set-up-the-postgresql-database)
    *   [Step 5: Set Up AWS S3 Bucket](#step-5-set-up-aws-s3-bucket)
    *   [Step 6: Run Database Migrations](#step-6-run-database-migrations)
    *   [Step 7: Seed the Super Admin](#step-7-seed-the-super-admin)
    *   [Step 8: Start the Server](#step-8-start-the-server)
4.  [Key Concepts & Business Logic](#4-key-concepts--business-logic)
    *   [Product & Variant Management](#product--variant-management)
    *   [Image Upload Workflows](#image-upload-workflows)
    *   [Order Processing](#order-processing)
    *   [Admin & Client Roles](#admin--client-roles)
5.  [API Endpoints Guide](#5-api-endpoints-guide)
    *   [Authentication Endpoints](#authentication-endpoints)
    *   [Admin Management Endpoints (Super Admin Only)](#admin-management-endpoints-super-admin-only)
    *   [Product Endpoints](#product-endpoints)
    *   [Upload Endpoints (Admin Only)](#upload-endpoints-admin-only)
    *   [Order Endpoints](#order-endpoints)
    *   [Client Endpoints](#client-endpoints)
    *   [Public Form Endpoints](#public-form-endpoints)
6.  [Testing Tools](#6-testing-tools)

---

## 1. System Architecture

### Core Technologies

*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: PostgreSQL
*   **ORM**: Prisma
*   **Authentication**: Firebase Authentication
*   **File Storage**: Amazon S3 (Simple Storage Service)
*   **Emailing**: Nodemailer (with Gmail)
*   **File Handling**: Multer (for uploads), Adm-Zip (for archives)

### Database Schema

The database schema is defined in `prisma/schema.prisma`. The key models are:

*   `Product` & `ProductVariant`: Manages the product catalog. Inventory is tracked at the `ProductVariant` level.
*   `Order`: Stores customer orders, linked to the `Client` who placed it.
*   `Admin`: Stores records for admin/super-admin users, linked to Firebase via `firebaseUid`.
*   `Client`: Stores records for registered customers, linked to Firebase via their `id` (UID).
*   `UploadJob`: Logs every bulk ZIP upload, storing the original filename, uploader's identity, status, and a link to the final CSV report on S3.
*   `CareerApplication` & `ContactInquiry`: Stores submissions from public web forms.

### Authentication Flow (Admin & Client)

The system uses a robust, decoupled authentication model powered by Firebase for both Admins and Clients.

1.  **Firebase is the "Identity Provider"**: It handles user sign-up (password hashing) and login, proving *who a user is*.
2.  **PostgreSQL is the "Authorization Source"**: Our `Admin` and `Client` tables store application-specific data and define *what a user can do*.
3.  **The Process**:
    *   A user signs up/logs in on the frontend, which communicates **directly with Firebase**.
    *   Firebase provides a **JWT (ID Token)** to the frontend.
    *   The frontend includes this token in the `Authorization: Bearer <token>` header for all API requests.
    *   Our backend middleware (`authenticateAdmin` or `authenticateClient`) verifies the token. If valid, the request proceeds.

### File & Report Handling

*   **Product Images**: Stored in a central AWS S3 bucket. Filenames are automatically made unique to prevent collisions.
*   **Bulk ZIP Upload Reports**: After a ZIP upload is processed, a CSV report is generated and uploaded to a `reports/` folder within the same S3 bucket, creating a permanent, auditable record for the admin dashboard.
*   **Career Resumes**: Handled as direct email attachments via Nodemailer. They are **not** stored on a server.
*   **Temporary Files**: The `uploads/` directory is used for temporarily storing uploaded ZIPs and CSVs before processing or deletion. This directory is in `.gitignore`.

---

## 2. Prerequisites

*   **Node.js** (v18.x or higher recommended)
*   **PostgreSQL** server, running and accessible.
*   **Firebase Project**: With Authentication enabled. You will need a service account JSON file for the backend.
*   **AWS Account**: An AWS account with:
    *   An **S3 bucket**.
    *   An **IAM user** with programmatic access credentials (Access Key & Secret Key) and permissions to manage objects in the S3 bucket.
*   **Gmail Account**: A Gmail account with an "App Password" generated for use with Nodemailer.

---

## 3. Local Setup & Installation

### Step 1: Clone the Repository

```sh
git clone <repository-url>
cd TechWire-Inventory-Backend
```

### Step 2: Install Dependencies

```sh
npm install
```

### Step 3: Set Up Environment Variables (.env)

Create a file named `.env` in the root of the project and fill in your credentials.

```env
# PostgreSQL Database
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public"

# Firebase Admin SDK Credentials (from your Firebase project's service account JSON file)
FIREBASE_TYPE="service_account"
FIREBASE_PROJECT_ID="..."
FIREBASE_PRIVATE_KEY_ID="..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_CLIENT_ID="..."
FIREBASE_AUTH_URI="..."
FIREBASE_TOKEN_URI="..."
FIREBASE_AUTH_PROVIDER_X509_CERT_URL="..."
FIREBASE_CLIENT_X509_CERT_URL="..."

# Super Admin Details (for the seed script)
USER_NAME="superadmin"
EMAIL="your-super-admin-email@example.com"
NAME="Super Admin"

# Frontend URL (for admin invitation emails)
FRONTEND_ADMIN_URL="http://localhost:5173/signup"

# Gmail Credentials (for sending emails)
# IMPORTANT: GMAIL_PASS should be an "App Password", not your regular password.
GMAIL_USER="your-gmail-address@gmail.com"
GMAIL_PASS="your-gmail-app-password"

# AWS S3 Configuration
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="your-s3-bucket-region" # e.g., ap-south-1
S3_BUCKET_NAME="your-unique-s3-bucket-name"
```

### Step 4: Set Up the PostgreSQL Database

Ensure your PostgreSQL server is running and create a new, empty database for this project.

### Step 5: Set Up AWS S3 Bucket

1.  Create a new S3 bucket in your AWS account.
2.  In the bucket's "Permissions" tab, **uncheck "Block all public access"**.
3.  Add the following **Bucket Policy**, replacing `your-bucket-name` with your actual bucket name. This makes objects publicly readable.
    ```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::your-bucket-name/*"
            }
        ]
    }
    ```

### Step 6: Run Database Migrations

This command will create all necessary tables in your database based on the Prisma schema.

```sh
npx prisma migrate dev
```

### Step 7: Seed the Super Admin

The first administrator account must be created via a seed script. This reads the details from your `.env` file.

```sh
node src/services/seedSuperAdmin.js
```
After this runs, you must **manually sign up** on the frontend using the exact same email to link the Firebase account to this local record.

### Step 8: Start the Server

This starts the development server with hot-reloading.

```sh
npm start
```

The server will be running on `http://localhost:5000`.

---

## 4. Key Concepts & Business Logic

### Product & Variant Management
Inventory is tracked at the `ProductVariant` level (e.g., by size). This allows for precise stock management for products with multiple options.

### Image Upload Workflows
*   **From Product Form**: Admins can upload images when creating a product. The backend streams these to S3 and stores the public URLs.
*   **Bulk ZIP Upload**: This is an **asynchronous** process. The admin uploads a ZIP, gets an immediate `202 Accepted` response, and the server processes it in the background. A record of the job is logged to the database, and the final CSV report is uploaded to S3. A notification email with a link to the report is sent upon completion.

### Order Processing
*   **Only authenticated clients can place orders.** The `POST /api/orders` endpoint is protected.
*   The API accepts user-friendly identifiers (`productId` and `size`) rather than internal database IDs.
*   The entire order creation process is **transactional** to ensure inventory levels are always accurate.

### Admin & Client Roles
*   **Clients**: Can sign up, log in, and place orders.
*   **Admins**: Can manage products, view orders, view the client list and view the bulk upload job dashboard.
*   **Super Admins**: Have all Admin powers, plus the ability to create/delete other Admins .

---

## 5. API Endpoints Guide

All endpoints are prefixed with `/api`.

*(Access: Public, Client, Admin, Super Admin)*

### Authentication Endpoints
*   `POST /auth/verify` (Access: Admin) - Verifies an admin's token.

### Admin Management Endpoints (Super Admin Only)
*   `POST /admin/create-admin` - Creates a new admin.
*   `DELETE /admin/delete-admin/:id` - Deletes an admin.
*   `GET /admin/admins` - Lists all non-super-admin users.

### Product Endpoints
*   `POST /products/add-product` (Access: Super Admin) - Creates a new product. Expects `multipart/form-data`.
*   `GET /products/all-products` (Access: Public) - Retrieves a paginated list of all products.
*   `GET /products/search?query=...` (Access: Public) - Searches products.
*   `GET /products/by-category/:categoryName` (Access: Public) - Retrieves products by category.
*   `PUT /products/:id` (Access: Super Admin) - Updates a product.
*   `DELETE /products/:id` (Access: Super Admin) - Deletes a product.

### Upload Endpoints (Admin Only)
*   `POST /uploads/zip` (Access: Super Admin) - Accepts a ZIP file for async bulk image processing.
*   `GET /uploads/jobs` (Access: Admin) - Retrieves a list of all past ZIP upload jobs for the dashboard.
*   `POST /products/upload` (Access: Super Admin) - Accepts a CSV for bulk product creation/updating.

### Order Endpoints
*   `POST /orders` (Access: Client) - Creates a new order.
*   `GET /orders` (Access: Admin) - Retrieves all orders.
*   `GET /orders/completed` (Access: Admin) - Retrieves completed orders.
*   `PATCH /orders/:orderId/status` (Access: Admin) - Updates order status.
*   `PATCH /orders/:orderId/details` (Access: Admin) - Updates order details.

### Client Endpoints
*   `POST /clients/register` (Access: Client) - Registers a new client's profile in the DB post-Firebase sign-up.
*   `GET /clients/list` (Access: Super Admin) - Retrieves a list of all registered clients.

### Public Form Endpoints
*   `POST /forms/apply` (Access: Public) - Submits a career application.
*   `POST /forms/contact` (Access: Public) - Submits a contact inquiry.

---

## 6. Testing Tools

The repository includes two HTML files for easy testing without a full frontend setup. Simply open them in your browser.

*   `getToken.html`: Use this to **log in** as an existing user (admin or client) and get their Firebase ID Token.
*   `signUpClient.html`: Use this to **sign up** a new client. It automates the full process of creating the user in Firebase and then registering them with the backend.
