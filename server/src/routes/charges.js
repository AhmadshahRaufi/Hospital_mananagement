import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields, requirePositiveNumber } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    const where = { isActive: true };
    if (category) where.category = category;
    res.json(serialize(await prisma.charge.findMany({ where, orderBy: { name: "asc" } })));
  })
);

router.post("/", allowRoles("accountant"), asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "category", "standardCharge"]);
  const standardCharge = requirePositiveNumber(req.body.standardCharge, "Standard charge");
  res.status(201).json(serialize(await prisma.charge.create({ data: { ...req.body, name: cleanString(req.body.name), standardCharge, taxPercent: Number(req.body.taxPercent || 0) } })));
}));
router.put("/:id", allowRoles("accountant"), asyncHandler(async (req, res) => res.json(serialize(await prisma.charge.update({ where: { id: req.params.id }, data: req.body })))));
router.delete(
  "/:id",
  allowRoles("accountant"),
  asyncHandler(async (req, res) => {
    await prisma.charge.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: "Charge removed." });
  })
);

export default router;
