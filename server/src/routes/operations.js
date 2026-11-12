import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

const CAN_VIEW = allowRoles("doctor", "nurse", "receptionist");
const CAN_RECORD = allowRoles("doctor", "nurse");

// The OT form sends `date` as a date-only string ("2026-07-29") from an
// <input type="date">. Prisma's DateTime validator rejects bare date strings
// ("premature end of input. Expected ISO-8601 DateTime"), so coerce to a JS
// Date object, which Prisma always accepts. Also normalises datetime-local
// values ("2026-07-29T14:30") the hospital-module OT scheduler uses.
const toDate = (value) => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// Operation/procedure catalog — administrative setup, like the charge sheet.
router.get("/", CAN_VIEW, asyncHandler(async (req, res) => res.json(serialize(await prisma.operation.findMany({ orderBy: { name: "asc" } })))));
router.post("/", allowRoles(), asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  res.status(201).json(serialize(await prisma.operation.create({ data: { ...req.body, name: cleanString(req.body.name) } })));
}));
router.put("/:id", allowRoles(), asyncHandler(async (req, res) => res.json(serialize(await prisma.operation.update({ where: { id: req.params.id }, data: req.body })))));
router.delete("/:id", allowRoles(), asyncHandler(async (req, res) => {
  await prisma.operation.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ message: "Deleted." });
}));

router.get(
  "/records",
  CAN_VIEW,
  asyncHandler(async (req, res) => {
    const records = await prisma.operationRecord.findMany({
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        operation: { select: { id: true, name: true } },
        surgeon: { select: { id: true, name: true } },
        bill: true,
      },
      orderBy: { date: "desc" },
    });
    res.json(serialize(records));
  })
);

// Every operation/procedure performed is a chargeable service — create the
// record and, if a fee is set, immediately raise a bill for it, the same way
// an OPD consultation or lab order does.
router.post(
  "/records",
  CAN_RECORD,
  asyncHandler(async (req, res) => {
    const { patient, operation, surgeon, date, ...rest } = req.body;
    requireFields(req.body, ["patient", "operation", "date"]);
    const recordNumber = await nextSequence("OT", "OT", 5);
    const charge = Number(rest.charge || 0);
    if (!Number.isFinite(charge) || charge < 0) {
      res.status(400);
      throw new Error("Valid operation charge is required.");
    }
    const operationDate = toDate(date);
    if (!operationDate) {
      res.status(400);
      throw new Error("Valid operation date is required.");
    }

    let bill = null;
    let billId = null;
    if (patient) {
      const settings = (await prisma.setting.findFirst()) || { invoicePrefix: "INV", currency: "AFN" };
      const year = new Date().getFullYear();
      const invoiceNumber = await nextSequence(`BILL-${year}`, `${settings.invoicePrefix || "INV"}-${year}`, 5);
      const operationDoc = operation ? await prisma.operation.findUnique({ where: { id: operation } }) : null;
      bill = await prisma.bill.create({
        data: {
          invoiceNumber,
          patientId: patient,
          items: {
            create: [
              {
                description: operationDoc ? `Procedure: ${operationDoc.name}` : "Operation / Procedure",
                category: "operation",
                quantity: 1,
                unitPrice: charge,
                taxPercent: 0,
                discountPercent: 0,
                total: charge,
              },
            ],
          },
          subTotal: charge,
          grandTotal: charge,
          balanceDue: charge,
          status: charge > 0 ? "unpaid" : "paid",
          generatedById: req.user.id,
          notes: `Operation record ${recordNumber}`,
        },
      });
      billId = bill.id;
    }

    const record = await prisma.operationRecord.create({
      data: { ...rest, recordNumber, patientId: patient, operationId: operation, surgeonId: surgeon || null, billId, date: operationDate },
    });

    await recordAudit({ user: req.user, action: "OT_RECORD_CREATE", module: "operations", targetId: record.id });
    res.status(201).json(serialize({ ...record, bill }));
  })
);

router.put(
  "/records/:id",
  CAN_RECORD,
  asyncHandler(async (req, res) => {
    const { patient, operation, surgeon, date, ...rest } = req.body;
    const data = { ...rest };
    if (patient !== undefined) data.patientId = patient;
    if (operation !== undefined) data.operationId = operation;
    if (surgeon !== undefined) data.surgeonId = surgeon || null;
    if (date !== undefined) data.date = toDate(date);
    res.json(serialize(await prisma.operationRecord.update({ where: { id: req.params.id }, data })));
  })
);

export default router;
