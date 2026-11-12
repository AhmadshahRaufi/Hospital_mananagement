import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";

const router = express.Router();
router.use(protect);
// Optical is run as a front-desk retail counter in this clinic.
router.use(allowRoles("receptionist"));

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const { lowStock } = req.query;
    let items = await prisma.opticalItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    if (lowStock === "true") items = items.filter((i) => i.quantity <= i.lowStockThreshold);
    res.json(serialize(items));
  })
);

router.post(
  "/items",
  asyncHandler(async (req, res) => {
    const item = await prisma.opticalItem.create({ data: req.body });
    await recordAudit({ user: req.user, action: "OPTICAL_ITEM_CREATE", module: "optical", targetId: item.id });
    res.status(201).json(serialize(item));
  })
);

router.put("/items/:id", asyncHandler(async (req, res) => res.json(serialize(await prisma.opticalItem.update({ where: { id: req.params.id }, data: req.body })))));
router.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    await prisma.opticalItem.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: "Item removed." });
  })
);

router.get(
  "/sales",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.opticalSale.findMany({
          include: { patient: { select: { id: true, name: true, patientId: true } }, items: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      )
    )
  )
);

router.post(
  "/sales",
  asyncHandler(async (req, res) => {
    const { patient, items, paymentMethod = "cash" } = req.body;
    if (!items?.length) {
      res.status(400);
      throw new Error("Add at least one item to the sale.");
    }

    let sale, bill;
    try {
      ({ sale, bill } = await prisma.$transaction(async (tx) => {
        let grandTotal = 0;
        const computed = [];
        for (const it of items) {
          const item = await tx.opticalItem.findUnique({ where: { id: it.item } });
          if (!item || item.quantity < it.quantity) {
            throw Object.assign(new Error(`Insufficient stock for ${item?.name || "item"}.`), { statusCode: 400 });
          }
          await tx.opticalItem.update({ where: { id: item.id }, data: { quantity: { decrement: it.quantity } } });
          const total = it.quantity * it.salePrice * (1 - (it.discountPercent || 0) / 100);
          grandTotal += total;
          computed.push({ itemId: it.item, name: item.name, quantity: it.quantity, salePrice: it.salePrice, discountPercent: it.discountPercent || 0, total });
        }
        const saleNumber = await nextSequence("OPTICAL", "OPT", 5);
        const createdBill = await tx.bill.create({
          data: {
            invoiceNumber: await nextSequence(`BILL-${new Date().getFullYear()}`, `INV-${new Date().getFullYear()}`, 5),
            patientId: patient || null,
            items: { create: computed.map((c) => ({ description: c.name, category: "optical", quantity: c.quantity, unitPrice: c.salePrice, discountPercent: c.discountPercent, total: c.total })) },
            subTotal: grandTotal,
            grandTotal,
            amountPaid: grandTotal,
            balanceDue: 0,
            paymentMethod,
            status: "paid",
            generatedById: req.user.id,
          },
        });
        const createdSale = await tx.opticalSale.create({
          data: {
            saleNumber,
            patientId: patient || null,
            grandTotal,
            paymentMethod,
            soldById: req.user.id,
            billId: createdBill.id,
            items: { create: computed.map((c) => ({ itemId: c.itemId, name: c.name, quantity: c.quantity, salePrice: c.salePrice, discountPercent: c.discountPercent, total: c.total })) },
          },
          include: { items: true },
        });
        return { sale: createdSale, bill: createdBill };
      }));
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }

    await recordAudit({ user: req.user, action: "OPTICAL_SALE", module: "optical", targetId: sale.id, description: `${sale.saleNumber} - ${sale.grandTotal}` });
    res.status(201).json(serialize({ sale, bill }));
  })
);

export default router;
