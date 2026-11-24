import app from "./app.js";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database.js";

let connectionPromise = null;

export default async function handler(req, res) {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!connectionPromise) {
        connectionPromise = connectDatabase().catch((error) => {
          connectionPromise = null;
          throw error;
        });
      }

      await connectionPromise;
    }

    return app(req, res);
  } catch (error) {
    console.error("Vercel API database connection failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      status: "database_disconnected"
    });
  }
}