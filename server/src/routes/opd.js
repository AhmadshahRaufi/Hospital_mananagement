import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { shapeMedicine } from "../utils/shape.js";

const router = express.Router();
router.use(protect);

// Front desk books/queues visits and can see the list to manage the queue;
// clinical staff (doctor/nurse) work the visit itself. Everyone else (lab,
// pharmacy, accounts, inventory) has no business in clinical visit notes.
const CAN_VIEW_VISITS = allowRoles("receptionist", "doctor", "nurse");
const CAN_BOOK_VISIT = allowRoles("receptionist", "doctor");
const CAN_TREAT_VISIT = allowRoles("doctor", "nurse");

const VISIT_LIST_INCLUDE = {
  patient: { select: { id: true, name: true, patientId: true, phone: true, gender: true, age: true } },
  doctor: { select: { id: true, name: true } },
};
const VISIT_FULL_INCLUDE = {
  patient: true,
  doctor: { select: { id: true, name: true } },
  bill: true,
  labOrders: true,
  vitals: true,
  prescription: true,
};

const medicineStockSummary = (medicine) => {
  const shaped = shapeMedicine(medicine);
  return {
    id: shaped.id,
    name: shaped.name,
    company: shaped.company,
    composition: shaped.composition,
    unit: shaped.unit,
    availableQty: shaped.availableQty,
  };
};

const createConsultationBill = async ({ visit, user }) => {
  const settings = (await prisma.setting.findFirst()) || { invoicePrefix: "INV", currency: "AFN" };
  const year = new Date().getFullYear();
  const consultationFee = Number(visit.consultationFee || 0);
  const invoiceNumber = await nextSequence(`BILL-${year}`, `${settings.invoicePrefix || "INV"}-${year}`, 5);
  const bill = await prisma.bill.create({
    data: {
      invoiceNumber,
      patientId: visit.patientId,
      items: {
        create: [
          {
            description: "OPD Consultation",
            category: "opd",
            quantity: 1,
            unitPrice: consultationFee,
            taxPercent: 0,
            discountPercent: 0,
            total: consultationFee,
          },
        ],
      },
      subTotal: consultationFee,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: consultationFee,
      amountPaid: 0,
      balanceDue: consultationFee,
      status: consultationFee > 0 ? "unpaid" : "paid",
      generatedById: user.id,
      notes: `Consultation bill for ${visit.visitNumber}`,
    },
  });
  await prisma.oPDVisit.update({ where: { id: visit.id }, data: { billId: bill.id } });
  await recordAudit({
    user,
    action: "BILL_CREATE",
    module: "billing",
    targetId: bill.id,
    description: `OPD invoice ${invoiceNumber} - ${consultationFee} ${settings.currency || "AFN"}`,
  });
  return bill;
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
        status: "booked",
        visitNumber: visit.visitNumber,
        sourceBillId: bill?.id || "",
        invoiceNumber: bill?.invoiceNumber || "",
        sourceOpdVisitId: visit.id,
      },
    },
  });
};

router.get(
  "/",
  CAN_VIEW_VISITS,
  asyncHandler(async (req, res) => {
    const { status, doctor, date, patient, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (doctor) where.doctorId = doctor;
    if (patient) where.patientId = patient;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.visitDate = { gte: start, lt: end };
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [visits, total] = await Promise.all([
      prisma.oPDVisit.findMany({ where, include: VISIT_LIST_INCLUDE, orderBy: { visitDate: "desc" }, skip, take: Number(limit) }),
      prisma.oPDVisit.count({ where }),
    ]);
    res.json({ visits: serialize(visits), total, page: Number(page), pages: Math.ceil(total / limit) });
  })
);

router.get(
  "/medicine-stock",
  CAN_VIEW_VISITS,
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const where = { isActive: true };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { composition: { contains: q, mode: "insensitive" } },
      ];
    }
    const medicines = await prisma.medicine.findMany({
      where,
      include: { batches: true },
      orderBy: { name: "asc" },
      take: 200,
    });
    res.json(serialize(medicines.map(medicineStockSummary)));
  })
);

router.get(
  "/:id",
  CAN_VIEW_VISITS,
  asyncHandler(async (req, res) => {
    const visit = await prisma.oPDVisit.findUnique({ where: { id: req.params.id }, include: VISIT_FULL_INCLUDE });
    if (!visit) {
      res.status(404);
      throw new Error("Visit not found.");
    }
    res.json(serialize(visit));
  })
);

router.post(
  "/",
  CAN_BOOK_VISIT,
  asyncHandler(async (req, res) => {
    const visitNumber = await nextSequence("OPD", "OPD", 5);
    const { patient, doctor, symptoms = [], findings = [], ...rest } = req.body;
    const visit = await prisma.oPDVisit.create({
      data: {
        ...rest,
        visitNumber,
        patientId: patient,
        doctorId: doctor,
        symptoms,
        findings,
      },
    });
    const bill = await createConsultationBill({ visit, user: req.user });
    const [patientRow, doctorRow] = await Promise.all([
      prisma.patient.findUnique({ where: { id: visit.patientId } }),
      prisma.user.findUnique({ where: { id: visit.doctorId } }),
    ]);
    await createAppointmentForVisit({ visit, patient: patientRow, doctor: doctorRow, bill });
    await recordAudit({ user: req.user, action: "OPD_CREATE", module: "opd", targetId: visit.id });
    res.status(201).json(serialize({ ...visit, bill }));
  })
);

router.put(
  "/:id",
  CAN_TREAT_VISIT,
  asyncHandler(async (req, res) => {
    const { vitals, prescription, patient, doctor, ...rest } = req.body;

    const visit = await prisma.$transaction(async (tx) => {
      if (vitals !== undefined) {
        await tx.oPDVisitVital.deleteMany({ where: { opdVisitId: req.params.id } });
      }
      if (prescription !== undefined) {
        await tx.oPDVisitPrescriptionItem.deleteMany({ where: { opdVisitId: req.params.id } });
      }
      const data = { ...rest };
      if (vitals !== undefined) {
        data.vitals = {
          create: vitals.map((v) => ({ vitalId: v.vital || null, name: v.name, value: v.value, unit: v.unit })),
        };
      }
      if (prescription !== undefined) {
        data.prescription = {
          create: prescription.map((p) => ({
            medicineName: p.medicineName,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration,
            instructions: p.instructions,
          })),
        };
      }
      return tx.oPDVisit.update({ where: { id: req.params.id }, data, include: VISIT_FULL_INCLUDE }).catch(() => null);
    });

    if (!visit) {
      res.status(404);
      throw new Error("Visit not found.");
    }
    await recordAudit({ user: req.user, action: "OPD_UPDATE", module: "opd", targetId: visit.id });
    res.json(serialize(visit));
  })
);

router.post(
  "/:id/complete",
  allowRoles("doctor"),
  asyncHandler(async (req, res) => {
    // When a visit is completed, deduct prescribed medicines from pharmacy
    // stock. The prescription is keyed by `medicineName` (a string the
    // doctor typed — the OPD prescription screen uses a datalist, not a
    // bound select, so the name might not exactly match any Medicine row).
    // For each line we try: (1) an exact name match, (2) a case-insensitive
    // contains match. If found, decrement from the soonest-expiring batch
    // (FIFO). If not found, skip silently — the doctor can still complete
    // the visit, we just don't deduct stock we can't identify.
    const visit = await prisma.$transaction(async (tx) => {
      const freshVisit = await tx.oPDVisit.findUnique({
        where: { id: req.params.id },
        include: { prescription: true, patient: true },
      });

      for (const item of freshVisit.prescription || []) {
        // Try exact match first, then contains (case-insensitive).
        let med = await tx.medicine.findFirst({
          where: { name: { equals: item.medicineName, mode: "insensitive" } },
          include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
        });
        if (!med) {
          med = await tx.medicine.findFirst({
            where: { name: { contains: item.medicineName, mode: "insensitive" } },
            include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
          });
        }
        if (!med) continue; // unknown medicine — skip, don't block visit completion

        // We don't know how many units the prescription represents (it's
        // "1 tablet × 3 times a day × 5 days" = 15 units, but we don't
        // parse free-text dosage here). For stock visibility we deduct a
        // nominal 1 unit per prescription line — the pharmacist still has
        // to confirm actual dispense quantity at the counter, but this
        // prevents the same batch from being sold twice to two patients.
        const toDeduct = 1;
        let remaining = toDeduct;
        for (const batch of med.batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.quantity, remaining);
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: { quantity: { decrement: take } },
          });
          remaining -= take;
        }
        // Note: we deliberately don't write a PharmacySale record here —
        // that's a separate workflow at the pharmacy counter. This
        // deduction is informational: "the doctor prescribed this, so the
        // pharmacist knows it's reserved for this patient."
      }

      return tx.oPDVisit.update({
        where: { id: req.params.id },
        data: { status: "completed" },
      });
    });

    await recordAudit({ user: req.user, action: "OPD_COMPLETE", module: "opd", targetId: req.params.id, description: "Visit completed; prescription medicines deducted from pharmacy stock." });
    res.json(serialize(visit));
  })
);

export default router;
