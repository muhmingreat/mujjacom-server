import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    service: "amanah-estates-api",
    status: databaseReady ? "healthy" : "database_disconnected",
    database: databaseReady ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

export default router;
