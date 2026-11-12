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

// Billing is a front-desk/accounts function. Clinical and stock roles create
// bills indirectly through their own modules (OPD/pharmacy/lab/optical),
// which call prisma.bill.create() directly rather than hitting this router.
router.use(allowRoles("receptionist", "accountant"));

const BILL_DETAIL_INCLUDE = {
  patient: true,
  generatedBy: { select: { id: true, name: true } },
  opdVisit: {
    select: {
      id: true,
      visitNumber: true,
      visitType: true,
      visitDate: true,
      status: true,
      doctorId: true,
      doctor: { select: { id: true, name: true, department: true } },
      patient: { select: { id: true, name: true, patientId: true, phone: true } },
    },
  },
  items: true,
  labOrders: {
    include: {
      patient: { select: { id: true, name: true, patientId: true, phone: true, gender: true, dob: true } },
      items: true,
    },
  },
};

const billItemType = (category) => (category === "radiology" ? "radiology" : category === "lab" ? "pathology" : null);
const hasOpdItems = (items = []) => items.some((item) => item.category === "opd");

const findOrCreateBillTest = async (tx, item, type) => {
  const name = cleanString(item.description) || (type === "radiology" ? "Radiology service" : "Laboratory test");
  const existing = await tx.labTest.findFirst({ where: { type, name: { equals: name, mode: "insensitive" } } });
  if (existing) return existing;
  return tx.labTest.create({
    data: {
      name,
      type,
      price: Number(item.unitPrice || item.total || 0),
      sampleType: type === "radiology" ? "Imaging" : "",
    },
  });
};

const createLabOrdersForPaidBill = async (billId, userId) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true, labOrders: true },
  });
  if (!bill || bill.status !== "paid" || !bill.patientId || bill.labOrders.length) return;

  const grouped = bill.items.reduce((acc, item) => {
    const type = billItemType(item.category);
    if (!type) return acc;
    (acc[type] = acc[type] || []).push(item);
    return acc;
  }, {});
  const entries = Object.entries(grouped).filter(([, items]) => items.length);
  if (!entries.length) return;

  for (const [type, items] of entries) {
    const prefix = type === "radiology" ? "RAD" : "LAB";
    const orderNumber = await nextSequence(prefix, prefix, 5);
    await prisma.$transaction(async (tx) => {
      const tests = [];
      for (const item of items) {
        tests.push(await findOrCreateBillTest(tx, item, type));
      }
      await tx.labOrder.create({
        data: {
          orderNumber,
          type,
          patientId: bill.patientId,
          orderedById: userId,
          billId: bill.id,
          status: "pending",
          items: {
            create: items.map((item, index) => ({
              testId: tests[index].id,
              name: cleanString(item.description) || tests[index].name,
              price: Number(item.unitPrice || 0),
              unit: tests[index].unit || "",
              normalRange: tests[index].normalRange || "",
            })),
          },
        },
      });
    });
  }
};

const assertDoctor = async (doctorId) => {
  if (!doctorId) {
    const err = new Error("Doctor is required for OPD invoices.");
    err.statusCode = 400;
    throw err;
  }
  const doctor = await prisma.user.findFirst({ where: { id: doctorId, role: "doctor", isActive: true } });
  if (!doctor) {
    const err = new Error("Selected doctor was not found.");
    err.statusCode = 400;
    throw err;
  }
  return doctor;
};

const appointmentDateParts = (date) => {
  const d = new Date(date);
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  };
};

const createAppointmentForVisit = async ({ visit, patient, doctor, bill }) => {
  if (!visit || !patient || !doctor) return;
  const { date, time } = appointmentDateParts(visit.visitDate);
  await prisma.hospitalModuleRecord.create({
    data: {
      type: "appointments",
      data: {
        patient: patient.id,
        patientName: patient.name,
        patientCode: patient.patientId,
        patientPhone: patient.phone || "",
        doctor: doctor.id,
        doctorName: doctor.name,
        doctorCode: doctor.staffId || "",
        department: doctor.department || "OPD",
        date,
        time,
        status: visit.status === "waiting_payment" ? "booked" : "arrived",
        visitNumber: visit.visitNumber,
        sourceBillId: bill?.id || "",
        invoiceNumber: bill?.invoiceNumber || "",
        sourceOpdVisitId: visit.id,
      },
    },
  });
};

const createOpdVisitForBill = async (billId, doctorId, userId) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      patient: true,
      items: true,
      opdVisit: true,
    },
  });
  if (!bill || !bill.patientId || bill.opdVisit || !hasOpdItems(bill.items)) return bill?.opdVisit || null;

  const doctor = await assertDoctor(doctorId);
  const opdItems = bill.items.filter((item) => item.category === "opd");
  const consultationFee = opdItems.reduce((sum, item) => sum + Number(item.total || item.unitPrice || 0), 0);
  const visitNumber = await nextSequence("OPD", "OPD", 5);
  const visit = await prisma.oPDVisit.create({
    data: {
      visitNumber,
      patientId: bill.patientId,
      doctorId: doctor.id,
      visitType: opdItems.some((item) => /follow/i.test(item.description || "")) ? "follow_up" : "new",
      visitDate: new Date(),
      status: bill.status === "paid" ? "waiting" : "waiting_payment",
      consultationFee,
      billId: bill.id,
      notes: `Created from invoice ${bill.invoiceNumber}.`,
    },
  });
  await createAppointmentForVisit({ visit, patient: bill.patient, doctor, bill });
  await recordAudit({ user: { id: userId }, action: "OPD_CREATE_FROM_BILL", module: "opd", targetId: visit.id, description: `Created from invoice ${bill.invoiceNumber}` });
  return visit;
};

export const computeTotals = (items) => {
  let subTotal = 0,
    taxTotal = 0,
    discountTotal = 0;
  const computedItems = items.map((it) => {
    const lineBase = it.quantity * it.unitPrice;
    const discount = (lineBase * (it.discountPercent || 0)) / 100;
    const taxable = lineBase - discount;
    const tax = (taxable * (it.taxPercent || 0)) / 100;
    const total = taxable + tax;
    subTotal += lineBase;
    discountTotal += discount;
    taxTotal += tax;
    return { ...it, total: Math.round(total * 100) / 100 };
  });
  const grandTotal = Math.round((subTotal - discountTotal + taxTotal) * 100) / 100;
  return { computedItems, subTotal, taxTotal, discountTotal, grandTotal };
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, patient, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (patient) where.patientId = patient;
    const skip = (Number(page) - 1) * Number(limit);
    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: { patient: { select: { id: true, name: true, patientId: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.bill.count({ where }),
    ]);
    res.json({ bills: serialize(bills), total, page: Number(page), pages: Math.ceil(total / limit) });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const [unpaid, paid, partial] = await Promise.all([
      prisma.bill.count({ where: { status: "unpaid" } }),
      prisma.bill.count({ where: { status: "paid" } }),
      prisma.bill.count({ where: { status: "partially_paid" } }),
    ]);
    res.json({ unpaid, paid, partial });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: BILL_DETAIL_INCLUDE,
    });
    if (!bill) {
      res.status(404);
      throw new Error("Bill not found.");
    }
    res.json(serialize(bill));
  })
);

// Create a bill from arbitrary line items (used by OPD/Pharmacy/Lab/Optical flows)
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { patient, opdVisit, doctor, items, paymentMethod = "cash", amountPaid = 0, notes } = req.body;
    if (!patient) {
      res.status(400);
      throw new Error("Patient is required.");
    }
    if (!items || !items.length) {
      res.status(400);
      throw new Error("At least one bill item is required.");
    }
    const cleanItems = items.map((it) => ({
      description: cleanString(it.description),
      category: it.category || "other",
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice),
      taxPercent: Number(it.taxPercent) || 0,
      discountPercent: Number(it.discountPercent) || 0,
    }));
    if (cleanItems.some((it) => !it.description || !Number.isFinite(it.unitPrice) || it.unitPrice <= 0 || it.quantity <= 0)) {
      res.status(400);
      throw new Error("Each bill item must have a description, quantity, and price.");
    }
    const needsDoctor = hasOpdItems(cleanItems) && !opdVisit;
    if (needsDoctor) await assertDoctor(doctor);
    const settings = (await prisma.setting.findFirst()) || { invoicePrefix: "INV" };
    const year = new Date().getFullYear();
    const invoiceNumber = await nextSequence(`BILL-${year}`, `${settings.invoicePrefix}-${year}`, 5);
    const paid = Number(amountPaid) || 0;
    const { computedItems, subTotal, taxTotal, discountTotal, grandTotal } = computeTotals(cleanItems);
    const balanceDue = Math.max(grandTotal - paid, 0);
    const status = paid <= 0 ? "unpaid" : balanceDue <= 0 ? "paid" : "partially_paid";

    const bill = await prisma.bill.create({
      data: {
        invoiceNumber,
        patientId: patient,
        items: {
          create: computedItems.map((it) => ({
            description: it.description,
            category: it.category || "other",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxPercent: it.taxPercent || 0,
            discountPercent: it.discountPercent || 0,
            total: it.total,
          })),
        },
        subTotal,
        taxTotal,
        discountTotal,
        grandTotal,
        amountPaid: paid,
        balanceDue,
        paymentMethod,
        status,
        generatedById: req.user.id,
        notes,
      },
      include: { items: true },
    });
    if (opdVisit) {
      await prisma.oPDVisit.update({ where: { id: opdVisit }, data: { billId: bill.id } });
    } else if (needsDoctor) {
      await createOpdVisitForBill(bill.id, doctor, req.user.id);
    }
    if (status === "paid") {
      await createLabOrdersForPaidBill(bill.id, req.user.id);
    }
    await recordAudit({ user: req.user, action: "BILL_CREATE", module: "billing", targetId: bill.id, description: `Invoice ${invoiceNumber} - ${grandTotal} ${settings.currency || "AFN"}` });
    const populated = await prisma.bill.findUnique({ where: { id: bill.id }, include: BILL_DETAIL_INCLUDE });
    res.status(201).json(serialize(populated));
  })
);

router.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const { amount, paymentMethod = "cash", doctor } = req.body;
    const paymentAmount = requirePositiveNumber(amount, "Payment amount");
    const bill = await prisma.bill.findUnique({ where: { id: req.params.id }, include: { items: true, opdVisit: true } });
    if (!bill) {
      res.status(404);
      throw new Error("Bill not found.");
    }
    if (bill.status === "cancelled") {
      res.status(400);
      throw new Error("Cannot record payment on a cancelled bill.");
    }
    const amountPaid = bill.amountPaid + paymentAmount;
    const balanceDue = Math.max(bill.grandTotal - amountPaid, 0);
    const status = balanceDue <= 0 ? "paid" : "partially_paid";
    if (status === "paid" && hasOpdItems(bill.items) && !bill.opdVisit) {
      await assertDoctor(doctor);
    }
    const updated = await prisma.bill.update({
      where: { id: req.params.id },
      data: { amountPaid, balanceDue, status, paymentMethod },
      include: BILL_DETAIL_INCLUDE,
    });
    if (status === "paid") {
      await createLabOrdersForPaidBill(bill.id, req.user.id);
      if (hasOpdItems(bill.items)) {
        if (bill.opdVisit) {
          await prisma.oPDVisit.updateMany({ where: { id: bill.opdVisit.id, status: "waiting_payment" }, data: { status: "waiting" } });
        } else {
          await createOpdVisitForBill(bill.id, doctor, req.user.id);
        }
      }
    }
    await recordAudit({ user: req.user, action: "BILL_PAYMENT", module: "billing", targetId: bill.id, description: `Payment of ${amount} recorded` });
    const populated = await prisma.bill.findUnique({ where: { id: bill.id }, include: BILL_DETAIL_INCLUDE });
    res.json(serialize(populated || updated));
  })
);

router.post(
  "/:id/cancel",
  allowRoles(),
  asyncHandler(async (req, res) => {
    // Voiding a bill isn't just a financial reversal — the bill is the
    // link that connects a patient encounter to the lab orders, pharmacy
    // sales, optical sales, and operation records it generated. Cancelling
    // it must cascade so that:
    //   • lab orders aren't left in "verified" state when their bill was voided
    //   • pharmacy stock decrements are reversed (medicine put back on the shelf)
    //   • the OPD visit's bill reference is cleared so a new one can be issued
    // All in a Prisma transaction so a partial failure doesn't leave the
    // system half-rolled-back (e.g. lab cancelled but stock not restocked).
    const bill = await prisma.$transaction(async (tx) => {
      // 1. Reverse pharmacy stock for any linked sales.
      const pharmacySales = await tx.pharmacySale.findMany({
        where: { billId: req.params.id },
        include: { items: true },
      });
      for (const sale of pharmacySales) {
        for (const item of sale.items) {
          if (item.batchId) {
            // Put the medicine back on the batch it was deducted from.
            await tx.medicineBatch.update({
              where: { id: item.batchId },
              data: { quantity: { increment: item.quantity } },
            });
          }
        }
      }

      // 2. Mark linked lab orders as cancelled too — they're no longer
      // billable and the lab tech shouldn't keep working on them.
      await tx.labOrder.updateMany({
        where: { billId: req.params.id },
        data: { status: "cancelled" },
      });

      // 3. Mark linked operation records as cancelled.
      await tx.operationRecord.updateMany({
        where: { billId: req.params.id },
        data: { status: "cancelled" },
      });

      // 4. Mark linked optical sales as cancelled. (Optical stock isn't
      // auto-restocked here — optical returns are handled in their own
      // flow — but at least the sale stops appearing as "completed".)
      // 5. Clear the OPD visit's bill reference so a new invoice can be
      // generated if needed. (Don't touch the visit status — that's a
      // clinical decision, not a billing one.)
      await tx.oPDVisit.updateMany({
        where: { billId: req.params.id },
        data: { billId: null },
      });

      // 6. Finally mark the bill itself as cancelled.
      return tx.bill.update({
        where: { id: req.params.id },
        data: { status: "cancelled" },
        include: BILL_DETAIL_INCLUDE,
      });
    });

    await recordAudit({ user: req.user, action: "BILL_CANCEL", module: "billing", targetId: req.params.id, description: "Cascade cancel: lab orders, pharmacy sales, opd visit link cleared, stock restocked." });
    res.json(serialize(bill));
  })
);

export default router;
