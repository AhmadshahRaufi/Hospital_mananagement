import express from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { ROLE_LIST, hashPassword, verifyPassword, toSafeUser } from "../utils/userHelpers.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400);
      throw new Error("Username and password are required.");
    }
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });
    if (!user) {
      res.status(401);
      throw new Error("Invalid username or password.");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minsLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      res.status(423);
      throw new Error(`Account locked due to too many failed attempts. Try again in ${minsLeft} minute(s).`);
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } });
        res.status(423);
        throw new Error("Too many failed attempts. Account locked for 15 minutes.");
      }
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts } });
      res.status(401);
      throw new Error(`Invalid username or password (${MAX_ATTEMPTS - attempts} attempt(s) remaining).`);
    }
    if (!user.isActive) {
      res.status(403);
      throw new Error("This account has been deactivated. Contact an administrator.");
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await recordAudit({ user: updated, action: "LOGIN", module: "auth", description: "User logged in" });
    res.json({ token: signToken(updated), user: serialize(toSafeUser(updated)) });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    res.json(serialize(toSafeUser(req.user)));
  })
);

// POST /api/auth/change-password
router.post(
  "/change-password",
  protect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const valid = await verifyPassword(currentPassword, req.user.passwordHash);
    if (!valid) {
      res.status(400);
      throw new Error("Current password is incorrect.");
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400);
      throw new Error("New password must be at least 6 characters.");
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    await recordAudit({ user: req.user, action: "CHANGE_PASSWORD", module: "auth" });
    res.json({ message: "Password updated successfully." });
  })
);

// POST /api/auth/register-staff (admin only - creates staff + login)
router.post(
  "/register-staff",
  protect,
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { name, username, email, phone, password, role, department, designation, salary } = req.body;
    requireFields(req.body, ["name", "username", "role"]);
    if (!ROLE_LIST.includes(role)) {
      res.status(400);
      throw new Error("Invalid role.");
    }
    const cleanUsername = cleanString(username).toLowerCase();
    const exists = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (exists) {
      res.status(400);
      throw new Error("Username already taken.");
    }
    const staffId = await nextSequence("STAFF", "STF", 4);
    const passwordHash = await hashPassword(password || "changeme123");
    const user = await prisma.user.create({
      data: {
        staffId,
        name: cleanString(name),
        username: cleanUsername,
        email,
        phone,
        role,
        department,
        designation,
        salary: salary || 0,
        passwordHash,
      },
    });
    await recordAudit({ user: req.user, action: "STAFF_CREATE", module: "hr", targetId: user.id });
    res.status(201).json(serialize(toSafeUser(user)));
  })
);

router.get("/roles", protect, (req, res) => res.json(ROLE_LIST));

export default router;
