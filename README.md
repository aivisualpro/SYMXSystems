# SYMX Systems

## Overview

SYMX Systems ERP Dashboard — a sleek and modern dashboard built with Next.js 16, Shadcn UI, and MongoDB. It features a responsive design with support for both light and dark modes, along with a customizable theme selector.

## Getting Started

### Installation

To begin, install the required dependencies using the following command:

```bash
npm install
```

### Development Server

After installing the dependencies, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
MONGODB_URI="your_mongodb_connection_string"
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
SUPER_ADMIN_EMAIL="your_super_admin_email"
SUPER_ADMIN_PASSWORD="your_super_admin_password"
JWT_SECRET="your_jwt_secret"
JWT_EXPIRES_IN="1d"
JWT_COOKIE_EXPIRES_IN=1
NODE_ENV="development"
```

For production (e.g., Vercel), simply set the `MONGODB_URI` environment variable to your production database connection string.
