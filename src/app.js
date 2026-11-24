// import dns from "node:dns";
// dns.setServers(["8.8.8.8", "8.8.4.4"])
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import healthRoutes from "./routes/healthRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import savedPropertyRoutes from "./routes/savedPropertyRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import adminPropertyRoutes from './routes/adminPropertyRoutes.js'
import adminEstateRoutes from "./routes/adminEstateRoutes.js";
import publicEstateRoutes from "./routes/publicEstateRoutes.js";
import adminApplicationRoutes from "./routes/adminApplicationRoutes.js";
import adminMemberRoutes from "./routes/adminMemberRoutes.js";
import adminTransactionRoutes from './routes/adminTransactionRoutes.js'
import transactionRoutes from "./routes/transactionRoutes.js";
import transactionPaymentRoutes from "./routes/transactionPaymentRoutes.js";
import propertyDueDiligenceRoutes from "./routes/propertyDueDiligenceRoutes.js";


const app = express();

app.use(helmet());
app.use(cors({
  origin: env.clientOrigin.split(",").map(value => value.trim()),
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (env.nodeEnv !== "test") app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ success: true, name: "AMANAH ESTATES API",
     docs: "API documentation will be added in a later phase." });
});

app.use("/api/health", healthRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/saved-properties", savedPropertyRoutes);
app.use("/api/applications", applicationRoutes)
app.use("/api/admin/properties", adminPropertyRoutes);
app.use("/api/admin/estates", adminEstateRoutes);
app.use("/api/estates", publicEstateRoutes);
app.use("/api/admin/applications", adminApplicationRoutes);
app.use("/api/admin/members", adminMemberRoutes);
app.use('/api/admin/transactions',adminTransactionRoutes )
app.use("/api/transactions", transactionRoutes);
app.use("/api/transaction-payments", transactionPaymentRoutes);
app.use("/api/due-diligence", propertyDueDiligenceRoutes);


app.use("/api/auth", authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;


