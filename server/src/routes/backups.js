import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { getBackupStatus, runTrackedBackup } from "../utils/backup.js";

const router = express.Router();

router.use(protect, allowRoles("admin"));

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.json(await getBackupStatus());
  })
);

router.post(
  "/manual",
  asyncHandler(async (req, res) => {
    await runTrackedBackup(prisma, "manual");
    res.status(201).json(await getBackupStatus());
  })
);

export default router;
