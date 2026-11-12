import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB, prisma } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { UPLOADS_DIR } from "./middleware/upload.js";
import { startAutomatedBackups } from "./utils/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import authRoutes from "./routes/auth.js";
import uploadsRoutes from "./routes/uploads.js";
import patientRoutes from "./routes/patients.js";
import opdRoutes from "./routes/opd.js";
import billingRoutes from "./routes/billing.js";
import pharmacyRoutes from "./routes/pharmacy.js";
import labRoutes from "./routes/lab.js";
import inventoryRoutes from "./routes/inventory.js";
import financeRoutes from "./routes/finance.js";
import hrRoutes from "./routes/hr.js";
import dashboardRoutes from "./routes/dashboard.js";
import settingsRoutes from "./routes/settings.js";
import chargesRoutes from "./routes/charges.js";
import reportsRoutes from "./routes/reports.js";
import notificationRoutes from "./routes/notifications.js";
import calendarRoutes from "./routes/calendar.js";
import setupRoutes from "./routes/setup.js";
import opticalRoutes from "./routes/optical.js";
import operationsRoutes from "./routes/operations.js";
import communicationsRoutes from "./routes/communications.js";
import liveConsultationRoutes from "./routes/liveconsultation.js";
import hospitalModuleRoutes from "./routes/hospitalModule.js";

await connectDB();

const backupTimer = startAutomatedBackups(prisma);

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true,
}));

app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", async (req, res) => {
  res.json({
    status: "ok",
    time: new Date(),
    db: "postgresql",
  });
});

// Static uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/opd", opdRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/charges", chargesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/setup", setupRoutes);
app.use("/api/optical", opticalRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/live-consultation", liveConsultationRoutes);
app.use("/api/hospital-module", hospitalModuleRoutes);

// ===============================
// Serve React Frontend
// ===============================

const clientPath = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(clientPath, "index.html"));
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
});

// Shutdown
const shutdown = async () => {
  console.log("\n[Server] Shutting down...");

  if (backupTimer) clearInterval(backupTimer);

  server.close();

  await prisma.$disconnect();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);