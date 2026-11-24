import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"])
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

async function start() {
  try {
    await connectDatabase();
    app.listen(env.port, () => {
      console.log(`AMANAH ESTATES API listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

start();
