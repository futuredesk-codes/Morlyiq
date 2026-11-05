import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { stripeWebhook } from "./controllers/client/onboarding/onboardingController.js";
import { assertStediRuntimeSafety } from "./config/stediRuntime.js";

// Load environment variables
dotenv.config();

// Refuse unsafe mixed/test configuration before accepting healthcare traffic.
// The same application build is used in both environments; deployment env vars
// choose the Stedi mode and credentials.
assertStediRuntimeSafety();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Stripe signature verification requires the exact raw request body. This route
// must remain above express.json().
app.post(
  "/api/client-panel/onboarding/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Body parsers & Logger
// Patient imports send validated mapped rows as JSON. Keep the limit bounded;
// the import endpoint separately caps each request at 500 rows.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Welcome route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "MorlyIQ Backend API is running",
    documentation: "/api/health",
    version: "1.0.0",
  });
});

// Mount API routes
app.use("/api", apiRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 MorlyIQ Backend Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

export default app;
