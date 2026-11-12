import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";
import { shapePatient } from "../utils/shape.js";

const router = express.Router();
router.use(protect);
router.use(allowRoles("accountant"));

const dateFilter = (req, field = "createdAt") => {
  const { from, to } = req.query;
  if (!from && !to) return {};
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  return { [field]: range };
};

router.get(
  "/finance",
  asyncHandler(async (req, res) => {
    const [bills, expenses, incomes] = await Promise.all([
      prisma.bill.findMany({ where: { ...dateFilter(req), status: { not: "cancelled" } } }),
      prisma.expense.findMany({ where: dateFilter(req, "date") }),
      prisma.income.findMany({ where: dateFilter(req, "date") }),
    ]);
    const revenue = bills.reduce((s, b) => s + b.grandTotal, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const otherIncome = incomes.reduce((s, i) => s + i.amount, 0);
    res.json({ revenue, otherIncome, expenseTotal, net: revenue + otherIncome - expenseTotal, billCount: bills.length });
  })
);

router.get(
  "/opd",
  asyncHandler(async (req, res) => {
    const visits = await prisma.oPDVisit.findMany({
      where: dateFilter(req, "visitDate"),
      include: { patient: { select: { id: true, name: true, patientId: true } }, doctor: { select: { id: true, name: true } } },
    });
    res.json(serialize(visits));
  })
);

router.get(
  "/pharmacy",
  asyncHandler(async (req, res) => {
    const sales = await prisma.pharmacySale.findMany({ where: dateFilter(req), include: { patient: { select: { id: true, name: true, patientId: true } } } });
    const total = sales.reduce((s, x) => s + x.grandTotal, 0);
    res.json({ sales: serialize(sales), total });
  })
);

router.get(
  "/pathology",
  asyncHandler(async (req, res) =>
    res.json(serialize(await prisma.labOrder.findMany({ where: { ...dateFilter(req, "orderDate"), type: "pathology" }, include: { patient: { select: { id: true, name: true, patientId: true } } } })))
  )
);
router.get(
  "/radiology",
  asyncHandler(async (req, res) =>
    res.json(serialize(await prisma.labOrder.findMany({ where: { ...dateFilter(req, "orderDate"), type: "radiology" }, include: { patient: { select: { id: true, name: true, patientId: true } } } })))
  )
);

router.get(
  "/patient",
  asyncHandler(async (req, res) => {
    const patients = await prisma.patient.findMany({ where: dateFilter(req), orderBy: { createdAt: "desc" } });
    res.json(serialize(patients.map(shapePatient)));
  })
);

router.get(
  "/log",
  allowRoles(),
  asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({ where: dateFilter(req), orderBy: { createdAt: "desc" }, take: 500 });
    res.json(serialize(logs));
  })
);

// Gap-fill: Birth/Death report. "Birth" here means new patient registrations
// in the range (the spec's OPD system has no maternity/delivery module, so
// "birth" = newly registered patients, which is the closest real signal available).
router.get(
  "/birth-death",
  asyncHandler(async (req, res) => {
    const [births, deaths] = await Promise.all([
      prisma.patient.findMany({ where: dateFilter(req), select: { id: true, patientId: true, name: true, gender: true, dob: true, createdAt: true } }),
      prisma.patient.findMany({ where: { dead: true, ...dateFilter(req, "deathDate") }, select: { id: true, patientId: true, name: true, gender: true, deathDate: true } }),
    ]);
    res.json({ births: serialize(births), deaths: serialize(deaths), birthCount: births.length, deathCount: deaths.length });
  })
);

router.get(
  "/tpa",
  asyncHandler(async (req, res) => {
    const patients = await prisma.patient.findMany({
      where: { tpaIsTPA: true, ...dateFilter(req) },
      select: { id: true, patientId: true, name: true, phone: true, tpaIsTPA: true, tpaProvider: true, tpaId: true, tpaValidity: true },
    });
    res.json(serialize(patients.map(shapePatient)));
  })
);

router.get(
  "/ot",
  asyncHandler(async (req, res) => {
    const records = await prisma.operationRecord.findMany({
      where: dateFilter(req, "date"),
      include: {
        patient: { select: { id: true, name: true, patientId: true } },
        operation: { select: { id: true, name: true } },
        surgeon: { select: { id: true, name: true } },
      },
    });
    const totalCharges = records.reduce((s, r) => s + (r.charge || 0), 0);
    res.json({ records: serialize(records), totalCharges });
  })
);

router.get(
  "/live-consultation",
  asyncHandler(async (req, res) => {
    const sessions = await prisma.liveConsultation.findMany({
      where: dateFilter(req, "scheduledAt"),
      include: { patient: { select: { id: true, name: true, patientId: true } }, doctor: { select: { id: true, name: true } } },
    });
    res.json(serialize(sessions));
  })
);

export default router;
