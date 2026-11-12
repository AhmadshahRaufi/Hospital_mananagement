import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);
router.use(allowRoles("inventory_manager"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { lowStock } = req.query;
    let items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
    if (lowStock === "true") items = items.filter((i) => i.quantity <= i.lowStockThreshold);
    res.json(serialize(items));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["name", "unit"]);
    const quantity = Number(req.body.quantity || 0);
    const lowStockThreshold = Number(req.body.lowStockThreshold || 0);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      res.status(400);
      throw new Error("Quantity and reorder level must be valid numbers.");
    }
    const item = await prisma.inventoryItem.create({
      data: {
        ...req.body,
        name: cleanString(req.body.name),
        unit: cleanString(req.body.unit),
        quantity,
        lowStockThreshold,
      },
    });
    await recordAudit({ user: req.user, action: "INVENTORY_ADD", module: "inventory", targetId: item.id });
    res.status(201).json(serialize(item));
  })
);

router.put("/:id", asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.name !== undefined) {
    if (!cleanString(data.name)) {
      res.status(400);
      throw new Error("Item name is required.");
    }
    data.name = cleanString(data.name);
  }
  res.json(serialize(await prisma.inventoryItem.update({ where: { id: req.params.id }, data })));
}));
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.inventoryItem.delete({ where: { id: req.params.id } }).catch(() => null);
    await recordAudit({ user: req.user, action: "INVENTORY_DELETE", module: "inventory", targetId: req.params.id });
    res.json({ message: "Deleted." });
  })
);

router.post(
  "/:id/adjust",
  asyncHandler(async (req, res) => {
    const { delta, reason } = req.body;
    const amount = Number(delta);
    if (!Number.isFinite(amount) || amount === 0) {
      res.status(400);
      throw new Error("Adjustment amount is required.");
    }
    const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404);
      throw new Error("Inventory item not found.");
    }
    if (existing.quantity + amount < 0) {
      res.status(400);
      throw new Error("Stock cannot be negative.");
    }
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: { quantity: { increment: amount } } });
    await recordAudit({ user: req.user, action: "INVENTORY_ADJUST", module: "inventory", targetId: req.params.id, description: `${amount > 0 ? "+" : ""}${amount} (${reason || "no reason given"})` });
    res.json(serialize(item));
  })
);

export default router;
