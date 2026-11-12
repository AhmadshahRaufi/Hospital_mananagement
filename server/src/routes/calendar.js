import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

router.get("/", asyncHandler(async (req, res) => res.json(serialize(await prisma.calendarEvent.findMany({ orderBy: { start: "asc" } })))));
router.post("/", asyncHandler(async (req, res) => {
  requireFields(req.body, ["title", "start"]);
  const start = new Date(req.body.start);
  const end = req.body.end ? new Date(req.body.end) : null;
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    res.status(400);
    throw new Error("Valid event date is required.");
  }
  res.status(201).json(serialize(await prisma.calendarEvent.create({ data: { ...req.body, title: cleanString(req.body.title), start, end, createdById: req.user.id } })));
}));
router.put("/:id", asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.title !== undefined) {
    if (!cleanString(data.title)) {
      res.status(400);
      throw new Error("Title is required.");
    }
    data.title = cleanString(data.title);
  }
  if (data.start) data.start = new Date(data.start);
  if (data.end) data.end = new Date(data.end);
  res.json(serialize(await prisma.calendarEvent.update({ where: { id: req.params.id }, data })));
}));
router.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.calendarEvent.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ message: "Deleted." });
}));

export default router;
