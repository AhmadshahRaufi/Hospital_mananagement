import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authenticated. Please log in.");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      res.status(401);
      throw new Error("Account not found or inactive.");
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Session invalid or expired. Please log in again.");
  }
});

// Role-based permission gating. "super_admin" and "admin" always have full
// system access (they are the two administrator tiers); every other role is
// only let through if it's explicitly listed by the route.
const FULL_ACCESS_ROLES = ["super_admin", "admin"];

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Not authenticated.");
  }
  if (FULL_ACCESS_ROLES.includes(req.user.role) || roles.includes(req.user.role)) {
    return next();
  }
  res.status(403);
  throw new Error("You do not have permission to perform this action.");
};

// True if the user's role is one of the given roles (or an administrator).
export const roleAllowed = (user, ...roles) =>
  !!user && (FULL_ACCESS_ROLES.includes(user.role) || roles.includes(user.role));
