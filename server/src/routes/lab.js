import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields, requirePositiveNumber } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

// Lab & radiology staff run the catalog and results; reception can raise
// walk-in orders and take payment for them; doctors get read access so they
// can check on tests they've sent a patient for.
const LAB_STAFF = ["lab_tech", "radiologist"];
const CAN_VIEW = allowRoles(...LAB_STAFF, "receptionist", "doctor", "nurse");
const CAN_ORDER = allowRoles(...LAB_STAFF, "receptionist");
const CAN_MANAGE_CATALOG = allowRoles(...LAB_STAFF);
const CAN_ENTER_RESULTS = allowRoles(...LAB_STAFF);

const ORDER_INCLUDE = {
  patient: { select: { id: true, name: true, patientId: true, phone: true, gender: true, dob: true } },
  orderedBy: { select: { id: true, name: true } },
  verifiedBy: { select: { id: true, name: true } },
  bill: { select: { id: true, invoiceNumber: true, status: true, amountPaid: true, balanceDue: true } },
  items: true,
};

router.get("/categories/:type", CAN_VIEW, asyncHandler(async (req, res) => res.json(serialize(await prisma.labCategory.findMany({ where: { type: req.params.type }, orderBy: { name: "asc" } })))));
router.post(
  "/categories",
  CAN_MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["name", "type"]);
    res.status(201).json(serialize(await prisma.labCategory.create({ data: { name: cleanString(req.body.name), type: req.body.type } })));
  })
);
router.delete(
  "/categories/:id",
  CAN_MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    await prisma.labCategory.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ message: "Deleted." });
  })
);

router.get(
  "/tests/:type",
  CAN_VIEW,
  asyncHandler(async (req, res) =>
    res.json(serialize(await prisma.labTest.findMany({ where: { type: req.params.type }, include: { category: { select: { id: true, name: true } } }, orderBy: { name: "asc" } })))
  )
);
router.post(
  "/tests",
  CAN_MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    const { category, ...rest } = req.body;
    requireFields(rest, ["name", "type", "price"]);
    const price = requirePositiveNumber(rest.price, "Price");
    res.status(201).json(serialize(await prisma.labTest.create({ data: { ...rest, name: cleanString(rest.name), price, categoryId: category || null } })));
  })
);
router.put(
  "/tests/:id",
  CAN_MANAGE_CATALOG,
  asyncHandler(async (req, res) => {
    const { category, ...rest } = req.body;
    const data = { ...rest };
    if (data.name !== undefined) {
      if (!cleanString(data.name)) {
        res.status(400);
        throw new Error("Test name is required.");
      }
      data.name = cleanString(data.name);
    }
    if (data.price !== undefined) data.price = requirePositiveNumber(data.price, "Price");
    if (category !== undefined) data.categoryId = category || null;
    res.json(serialize(await prisma.labTest.update({ where: { id: req.params.id }, data })));
  })
);
router.delete("/tests/:id", CAN_MANAGE_CATALOG, asyncHandler(async (req, res) => { await prisma.labTest.delete({ where: { id: req.params.id } }).catch(() => null); res.json({ message: "Deleted." }); }));

router.get(
  "/orders/:type",
  CAN_VIEW,
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const where = { type: req.params.type };
    if (status) where.status = status;
    const orders = await prisma.labOrder.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } });
    res.json(serialize(orders));
  })
);

router.post(
  "/orders",
  CAN_ORDER,
  asyncHandler(async (req, res) => {
    const { type, patient, opdVisit, items } = req.body;
    if (!["pathology", "radiology"].includes(type)) {
      res.status(400);
      throw new Error("Invalid lab order type.");
    }
    if (!patient || !items?.length) {
      res.status(400);
      throw new Error("Patient and at least one test are required.");
    }
    const cleanItems = items.map((i) => ({
      test: i.test,
      name: cleanString(i.name),
      price: Number(i.price || 0),
      unit: cleanString(i.unit) || "",
      normalRange: cleanString(i.normalRange) || "",
    }));
    if (cleanItems.some((i) => !i.test || !i.name || !Number.isFinite(i.price) || i.price < 0)) {
      res.status(400);
      throw new Error("Each selected test must have a name and price.");
    }
    const prefix = type === "radiology" ? "RAD" : "LAB";
    const orderNumber = await nextSequence(prefix, prefix, 5);
    const order = await prisma.labOrder.create({
      data: {
        orderNumber,
        type,
        patientId: patient,
        opdVisitId: opdVisit || null,
        orderedById: req.user.id,
        items: {
          create: cleanItems.map((i) => ({
            testId: i.test,
            name: i.name,
            price: i.price,
            unit: i.unit || "",
            normalRange: i.normalRange || "",
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
    await recordAudit({ user: req.user, action: "LAB_ORDER_CREATE", module: "lab", targetId: order.id });
    res.status(201).json(serialize(order));
  })
);

// Accepts either a single-item update ({ itemId, result, resultNotes }) or a
// batch ({ items: [{ itemId, result, resultNotes }, ...] }) so the results
// entry screen can save an entire panel in one request.
router.put(
  "/orders/:id/result",
  CAN_ENTER_RESULTS,
  asyncHandler(async (req, res) => {
    const order = await prisma.labOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) {
      res.status(404);
      throw new Error("Order not found.");
    }
    const updates = Array.isArray(req.body.items) ? req.body.items : [req.body];
    if (updates.some((u) => !u.itemId || (!cleanString(u.result) && !cleanString(u.resultNotes)))) {
      res.status(400);
      throw new Error("Result value or notes are required for each item.");
    }
    await prisma.$transaction(
      updates
        .filter((u) => order.items.some((i) => i.id === u.itemId))
        .map((u) =>
          prisma.labOrderItem.update({
            where: { id: u.itemId },
            data: {
              ...(u.result !== undefined ? { result: cleanString(u.result) } : {}),
              ...(u.resultNotes !== undefined ? { resultNotes: cleanString(u.resultNotes) } : {}),
              status: "completed",
            },
          })
        )
    );
    const refreshedItems = await prisma.labOrderItem.findMany({ where: { labOrderId: order.id } });
    const data = {};
    if (refreshedItems.length && refreshedItems.every((i) => i.status === "completed")) {
      data.status = "completed";
      data.verifiedById = req.user.id;
      data.reportedAt = new Date();
    }
    const populated = await prisma.labOrder.update({ where: { id: order.id }, data, include: ORDER_INCLUDE });
    await recordAudit({ user: req.user, action: "LAB_RESULT_ENTRY", module: "lab", targetId: order.id });
    res.json(serialize(populated));
  })
);

// Generate a bill from a lab/radiology order
router.post(
  "/orders/:id/bill",
  CAN_ORDER,
  asyncHandler(async (req, res) => {
    const order = await prisma.labOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) {
      res.status(404);
      throw new Error("Order not found.");
    }
    if (order.billId) {
      res.status(400);
      throw new Error("This order has already been billed.");
    }
    const items = order.items.map((i) => ({
      description: i.name,
      category: order.type === "radiology" ? "radiology" : "lab",
      quantity: 1,
      unitPrice: i.price,
      taxPercent: 0,
      discountPercent: 0,
      total: i.price,
    }));
    const subTotal = items.reduce((s, i) => s + i.total, 0);
    const invoiceNumber = await nextSequence(`BILL-${new Date().getFullYear()}`, `INV-${new Date().getFullYear()}`, 5);
    const bill = await prisma.bill.create({
      data: {
        invoiceNumber,
        patientId: order.patientId,
        items: { create: items },
        subTotal,
        grandTotal: subTotal,
        balanceDue: subTotal,
        status: "unpaid",
        generatedById: req.user.id,
      },
      include: { items: true, patient: true, labOrders: { include: { items: true } } },
    });
    await prisma.labOrder.update({ where: { id: order.id }, data: { billId: bill.id, status: subTotal <= 0 ? "paid" : "pending" } });
    await recordAudit({ user: req.user, action: "LAB_ORDER_BILL", module: "lab", targetId: order.id });
    res.status(201).json(serialize(bill));
  })
);

export default router;
