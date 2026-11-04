# MorlyIQ Backend API

Express and MongoDB backend service for the MorlyIQ platform.

## Features
- **Express.js (v5)** with ES Modules (`import/export`)
- **MongoDB & Mongoose (v9)** ODM with connection resilience
- **CORS** enabled for MorlyClient and Admin frontends
- **Modular Architecture**: separate `config`, `models`, `controllers`, `middlewares`, and `routes`
- **Morgan** HTTP request logger
- **Environment Configuration** via `dotenv`

---

## Directory Structure

```
backend/
├── .env                # Local environment variables
├── .env.example        # Template for environment variables
├── .gitignore          # Git ignore rules
├── package.json        # NPM scripts and dependencies
└── src/
    ├── config/
    │   └── db.js       # MongoDB connection configuration
    ├── controllers/
    │   ├── authController.js
    │   └── clientController.js
    ├── middlewares/
    │   └── errorHandler.js
    ├── models/
    │   ├── User.js
    │   └── Client.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── clientRoutes.js
    │   └── index.js    # Root API router & health check
    └── server.js       # Express server initialization
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and update your settings if needed:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/morlyiq_db
CLIENT_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Start Production Server
```bash
npm start
```

---

## API Endpoints

- `GET /` - Root API status message
- `GET /api/health` - Service health and uptime
- `POST /api/auth/login` - User sign-in
- `GET /api/auth/profile` - Current user profile
- `GET /api/clients` - List all client practices
- `POST /api/clients` - Create a new client practice
