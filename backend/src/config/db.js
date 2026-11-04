import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/morlyiq_db");
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.warn(`[MongoDB] Please ensure MongoDB is running locally at mongodb://127.0.0.1:27017 or provide a valid MONGODB_URI in backend/.env`);
    // Note: Do not exit process in dev so API endpoints and server can still function for testing
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] Disconnected from database.");
});

mongoose.connection.on("reconnected", () => {
  console.log("[MongoDB] Reconnected to database.");
});
