import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { shapeMedicine } from "../utils/shape.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);
// The whole pharmacy counter — stock, purchases, and sales — is the
// pharmacist's / stock-keeper's scope. No other role needs write or read
// access here (doctors prescribe by free text, they don't touch stock).
router.use(allowRoles("pharmacist", "inventory_manager"));

/* ---------- Medicine Categories ---------- */
router.get("/categories", asyncHandler(async (req, res) => res.json(serialize(await prisma.medicineCategory.findMany({ orderBy: { name: "asc" } })))));
router.post("/categories", asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  res.status(201).json(serialize(await prisma.medicineCategory.create({ data: { name: cleanString(req.body.name) } })));
}));
router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    await prisma.medicineCategory.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ message: "Deleted." });
  })
);

/* ---------- Suppliers ---------- */
router.get(
  "/suppliers",
  asyncHandler(async (req, res) => {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    const grandTotalNetBalance = suppliers.reduce((s, x) => s + (x.netBalance || 0), 0);
    res.json({ suppliers: serialize(suppliers), grandTotalNetBalance });
  })
);
router.post("/suppliers", asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  res.status(201).json(serialize(await prisma.supplier.create({ data: { ...req.body, name: cleanString(req.body.name) } })));
}));
router.put(
  "/suppliers/:id",
  asyncHandler(async (req, res) => res.json(serialize(await prisma.supplier.update({ where: { id: req.params.id }, data: req.body }))))
);
router.delete(
  "/suppliers/:id",
  asyncHandler(async (req, res) => {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: "Supplier deactivated." });
  })
);

/* ---------- Medicines / Stock ---------- */
router.get(
  "/medicines",
  asyncHandler(async (req, res) => {
    const { q, lowStock } = req.query;
    const where = { isActive: true };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { composition: { contains: q, mode: "insensitive" } },
      ];
    }
    let medicines = await prisma.medicine.findMany({
      where,
      include: { category: { select: { id: true, name: true } }, batches: true },
      orderBy: { name: "asc" },
    });
    medicines = medicines.map(shapeMedicine);
    if (lowStock === "true") {
      medicines = medicines.filter((m) => m.availableQty <= m.lowStockThreshold);
    }
    res.json(serialize(medicines));
  })
);

router.get(
  "/medicines/:id",
  asyncHandler(async (req, res) => {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id }, include: { category: true, batches: true } });
    res.json(serialize(shapeMedicine(medicine)));
  })
);

router.post(
  "/medicines",
  asyncHandler(async (req, res) => {
    const { category, batches, ...rest } = req.body;
    requireFields(rest, ["name", "unit"]);
    const medicine = await prisma.medicine.create({
      data: {
        ...rest,
        name: cleanString(rest.name),
        unit: cleanString(rest.unit),
        lowStockThreshold: Number(rest.lowStockThreshold || 0),
        categoryId: category || null,
      },
    });
    await recordAudit({ user: req.user, action: "MEDICINE_CREATE", module: "pharmacy", targetId: medicine.id });
    res.status(201).json(serialize(shapeMedicine({ ...medicine, batches: [] })));
  })
);

router.put(
  "/medicines/:id",
  asyncHandler(async (req, res) => {
    const { category, batches, ...rest } = req.body;
    const data = { ...rest };
    if (data.name !== undefined) {
      if (!cleanString(data.name)) {
        res.status(400);
        throw new Error("Medicine name is required.");
      }
      data.name = cleanString(data.name);
    }
    if (category !== undefined) data.categoryId = category || null;
    const medicine = await prisma.medicine.update({
      where: { id: req.params.id },
      data,
      include: { category: true, batches: true },
    });
    res.json(serialize(shapeMedicine(medicine)));
  })
);

router.delete(
  "/medicines/:id",
  asyncHandler(async (req, res) => {
    await prisma.medicine.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({ user: req.user, action: "MEDICINE_DELETE", module: "pharmacy", targetId: req.params.id });
    res.json({ message: "Medicine removed from active stock list." });
  })
);

/* ---------- Purchases (stock-in) ---------- */
router.get(
  "/purchases",
  asyncHandler(async (req, res) => {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(serialize(purchases));
  })
);

router.post(
  "/purchases",
  asyncHandler(async (req, res) => {
    const { supplier, items, amountPaid = 0 } = req.body;
    if (!items?.length) {
      res.status(400);
      throw new Error("Add at least one medicine line item.");
    }
    let subTotal = 0,
      taxTotal = 0;
    const computedItems = items.map((it) => {
      const lineTotal = it.quantity * it.purchasePrice;
      const tax = (lineTotal * (it.taxPercent || 0)) / 100;
      subTotal += lineTotal;
      taxTotal += tax;
      return { ...it, total: Math.round((lineTotal + tax) * 100) / 100 };
    });
    const grandTotal = Math.round((subTotal + taxTotal) * 100) / 100;
    const purchaseNumber = await nextSequence("PURCHASE", "PO", 5);

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplier,
          subTotal,
          taxTotal,
          grandTotal,
          amountPaid,
          createdById: req.user.id,
          items: {
            create: computedItems.map((it) => ({
              medicineId: it.medicine,
              batchNumber: it.batchNumber,
              quantity: it.quantity,
              purchasePrice: it.purchasePrice,
              salePrice: it.salePrice,
              taxPercent: it.taxPercent || 0,
              expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
              total: it.total,
            })),
          },
        },
        include: { items: true },
      });

      // Stock-in: create a new batch per item (gap-fill: batch & expiry tracking)
      for (const it of computedItems) {
        await tx.medicineBatch.create({
          data: {
            medicineId: it.medicine,
            batchNumber: it.batchNumber || `B-${Date.now()}`,
            quantity: it.quantity,
            purchasePrice: it.purchasePrice,
            salePrice: it.salePrice,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
            supplierId: supplier,
          },
        });
      }

      // Update supplier balance (unpaid portion becomes payable)
      const unpaid = grandTotal - amountPaid;
      if (unpaid > 0) {
        await tx.supplier.update({ where: { id: supplier }, data: { netBalance: { increment: unpaid } } });
      }
      return created;
    });

    await recordAudit({ user: req.user, action: "PURCHASE_CREATE", module: "pharmacy", targetId: purchase.id, description: `${purchaseNumber} - ${grandTotal}` });
    res.status(201).json(serialize(purchase));
  })
);

/* ---------- Purchase Returns ---------- */
router.get(
  "/purchase-returns",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.purchaseReturn.findMany({
          include: {
            supplier: { select: { id: true, name: true } },
            purchase: { select: { id: true, purchaseNumber: true } },
            items: true,
          },
          orderBy: { createdAt: "desc" },
        })
      )
    )
  )
);

router.post(
  "/purchase-returns",
  asyncHandler(async (req, res) => {
    const { purchase, supplier, items } = req.body;
    let totalAmount = 0;
    const computed = items.map((it) => {
      const base = it.returnQty * it.purchasePrice;
      const tax = (base * (it.taxPercent || 0)) / 100;
      const amount = base + tax;
      totalAmount += amount;
      return { ...it, amount };
    });
    const returnNumber = await nextSequence("PRETURN", "PRET", 5);

    const ret = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseId: purchase || null,
          supplierId: supplier || null,
          totalAmount,
          items: {
            create: computed.map((it) => ({
              medicineId: it.medicine || null,
              batchNumber: it.batchNumber,
              returnQty: it.returnQty,
              purchasePrice: it.purchasePrice,
              taxPercent: it.taxPercent,
              amount: it.amount,
            })),
          },
        },
        include: { items: true },
      });

      // Deduct returned qty from the matching batch
      for (const it of computed) {
        if (!it.medicine || !it.batchNumber) continue;
        const batch = await tx.medicineBatch.findFirst({ where: { medicineId: it.medicine, batchNumber: it.batchNumber } });
        if (batch) {
          await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: it.returnQty } } });
        }
      }
      if (supplier) {
        await tx.supplier.update({ where: { id: supplier }, data: { netBalance: { decrement: totalAmount } } });
      }
      return created;
    });

    await recordAudit({ user: req.user, action: "PURCHASE_RETURN", module: "pharmacy", targetId: ret.id });
    res.status(201).json(serialize(ret));
  })
);

/* ---------- Pharmacy Sales (counter sale, generates a Bill) ---------- */
router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const where = q
      ? {
          OR: [
            { saleNumber: { contains: q, mode: "insensitive" } },
            { patient: { name: { contains: q, mode: "insensitive" } } },
            { patient: { patientId: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};
    res.json(
      serialize(
        await prisma.pharmacySale.findMany({
          where,
          include: {
            patient: { select: { id: true, name: true, patientId: true } },
            items: { include: { medicine: { select: { id: true, name: true, unit: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      )
    );
  })
);

router.post(
  "/sales",
  asyncHandler(async (req, res) => {
    const { patient, items, paymentMethod = "cash" } = req.body;
    if (!items?.length) {
      res.status(400);
      throw new Error("Add at least one medicine to the sale.");
    }

    let sale, bill;
    try {
      ({ sale, bill } = await prisma.$transaction(async (tx) => {
      let subTotal = 0,
        discountTotal = 0;
      const computed = [];
      for (const it of items) {
        const medicine = await tx.medicine.findUnique({ where: { id: it.medicine }, include: { batches: true } });
        if (!medicine) continue;
        // FIFO deduction across batches, oldest expiry first
        let remaining = it.quantity;
        const sorted = [...medicine.batches].sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0));
        const available = sorted.reduce((s, b) => s + b.quantity, 0);
        if (available < it.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${medicine.name}. Available: ${available}`), { statusCode: 400 });
        }
        for (const batch of sorted) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.quantity, remaining);
          if (deduct > 0) {
            await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: { decrement: deduct } } });
          }
          remaining -= deduct;
        }
        const lineBase = it.quantity * it.salePrice;
        const discount = (lineBase * (it.discountPercent || 0)) / 100;
        subTotal += lineBase;
        discountTotal += discount;
        computed.push({ ...it, name: medicine.name, total: lineBase - discount });
      }
      const grandTotal = subTotal - discountTotal;
      const saleNumber = await nextSequence("PHSALE", "PS", 5);

      // Auto-generate a paid Bill for the sale
      const createdBill = await tx.bill.create({
        data: {
          invoiceNumber: await nextSequence(`BILL-${new Date().getFullYear()}`, `INV-${new Date().getFullYear()}`, 5),
          patientId: patient || null,
          items: {
            create: computed.map((c) => ({
              description: c.name || "Medicine sale",
              category: "pharmacy",
              quantity: c.quantity,
              unitPrice: c.salePrice,
              discountPercent: c.discountPercent || 0,
              total: c.total,
            })),
          },
          subTotal,
          discountTotal,
          taxTotal: 0,
          grandTotal,
          amountPaid: grandTotal,
          balanceDue: 0,
          paymentMethod,
          status: "paid",
          generatedById: req.user.id,
        },
      });

      const createdSale = await tx.pharmacySale.create({
        data: {
          saleNumber,
          patientId: patient || null,
          subTotal,
          discountTotal,
          grandTotal,
          paymentMethod,
          soldById: req.user.id,
          billId: createdBill.id,
          items: {
            create: computed.map((c) => ({
              medicineId: c.medicine,
              batchId: c.batchId || null,
              quantity: c.quantity,
              salePrice: c.salePrice,
              discountPercent: c.discountPercent || 0,
              total: c.total,
            })),
          },
        },
        include: { items: true },
      });

      return { sale: createdSale, bill: createdBill };
      }));
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }

    await recordAudit({ user: req.user, action: "PHARMACY_SALE", module: "pharmacy", targetId: sale.id, description: `${sale.saleNumber} - ${sale.grandTotal}` });
    res.status(201).json(serialize({ sale, bill }));
  })
);

/* ---------- Sale Returns (patient returns purchased medicine) ---------- */
router.get(
  "/sale-returns",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.pharmacySaleReturn.findMany({
          include: {
            patient: { select: { id: true, name: true, patientId: true } },
            sale: { select: { id: true, saleNumber: true } },
            items: { include: { medicine: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      )
    )
  )
);

router.post(
  "/sale-returns",
  asyncHandler(async (req, res) => {
    const { sale, patient, items, refundMethod = "cash" } = req.body;
    if (!items?.length) {
      res.status(400);
      throw new Error("Add at least one medicine line item to return.");
    }

    let totalAmount = 0;
    const computed = items
      .filter((it) => it.medicine && Number(it.quantity) > 0)
      .map((it) => {
        const quantity = Number(it.quantity);
        const salePrice = Number(it.salePrice) || 0;
        const amount = Math.round(quantity * salePrice * 100) / 100;
        totalAmount += amount;
        return { ...it, quantity, salePrice, amount };
      });
    if (!computed.length) {
      res.status(400);
      throw new Error("Add at least one medicine line item to return.");
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    const returnNumber = await nextSequence("SALERETURN", "SRET", 5);

    const ret = await prisma.$transaction(async (tx) => {
      const created = await tx.pharmacySaleReturn.create({
        data: {
          returnNumber,
          saleId: sale || null,
          patientId: patient || null,
          totalAmount,
          refundMethod,
          createdById: req.user.id,
          items: {
            create: computed.map((it) => ({
              medicineId: it.medicine,
              batchId: it.batchId || null,
              quantity: it.quantity,
              salePrice: it.salePrice,
              amount: it.amount,
            })),
          },
        },
        include: { items: true },
      });

      // Restock: put the returned quantity back into stock.
      for (const it of computed) {
        let batch = it.batchId ? await tx.medicineBatch.findUnique({ where: { id: it.batchId } }) : null;
        if (!batch) {
          batch = await tx.medicineBatch.findFirst({ where: { medicineId: it.medicine }, orderBy: { receivedDate: "desc" } });
        }
        if (batch) {
          await tx.medicineBatch.update({ where: { id: batch.id }, data: { quantity: { increment: it.quantity } } });
        } else {
          // No existing batch for this medicine (e.g. fully sold out) — create one to hold the returned stock.
          await tx.medicineBatch.create({
            data: {
              medicineId: it.medicine,
              batchNumber: `RET-${Date.now()}`,
              quantity: it.quantity,
              purchasePrice: 0,
              salePrice: it.salePrice,
            },
          });
        }
      }
      return created;
    });

    await recordAudit({ user: req.user, action: "PHARMACY_SALE_RETURN", module: "pharmacy", targetId: ret.id, description: `${returnNumber} - ${totalAmount}` });
    res.status(201).json(serialize(ret));
  })
);

export default router;
