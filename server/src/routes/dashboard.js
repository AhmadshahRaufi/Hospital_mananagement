import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { ROLE_LIST } from "../utils/userHelpers.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";
import { medicineAvailableQty } from "../utils/shape.js";

const router = express.Router();
router.use(protect);

// Full clinic financials (revenue/expense/income) are management's business.
const FINANCE_VIEW = allowRoles("accountant");

router.get(
  "/summary",
  FINANCE_VIEW,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const todayStart = new Date(now.toDateString());

    const [monthlyBills, monthlyExpenses, monthlyIncome, yearlyBills, yearlyExpenses, yearlyIncome] = await Promise.all([
      prisma.bill.findMany({ where: { createdAt: { gte: monthStart }, status: { not: "cancelled" } }, include: { items: true } }),
      prisma.expense.findMany({ where: { date: { gte: monthStart } } }),
      prisma.income.findMany({ where: { date: { gte: monthStart } } }),
      prisma.bill.findMany({ where: { createdAt: { gte: yearStart }, status: { not: "cancelled" } } }),
      prisma.expense.findMany({ where: { date: { gte: yearStart } } }),
      prisma.income.findMany({ where: { date: { gte: yearStart } } }),
    ]);

    const sum = (arr, field) => arr.reduce((s, x) => s + (x[field] || 0), 0);
    const byCategory = (bills) =>
      bills.reduce((acc, bill) => {
        (bill.items || []).forEach((it) => {
          acc[it.category] = (acc[it.category] || 0) + it.total;
        });
        return acc;
      }, {});

    const monthlyRevenue = sum(monthlyBills, "grandTotal");
    const monthlyOtherIncome = sum(monthlyIncome, "amount");
    const monthlyExpenseTotal = sum(monthlyExpenses, "amount");
    const categoryRevenue = byCategory(monthlyBills);
    const monthlyNetIncome = monthlyRevenue + monthlyOtherIncome - monthlyExpenseTotal;

    const [totalPatients, newPatientsThisMonth, staffCounts, medicines, todaysBills, pendingVisitsToday] = await Promise.all([
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({ where: { isActive: true, createdAt: { gte: monthStart } } }),
      prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { role: true } }),
      prisma.medicine.findMany({ where: { isActive: true }, include: { batches: true } }),
      prisma.bill.findMany({ where: { createdAt: { gte: todayStart }, status: { not: "cancelled" } } }),
      prisma.oPDVisit.count({ where: { visitDate: { gte: todayStart }, status: { in: ["waiting", "in_consultation"] } } }),
    ]);

    const staffSummary = {};
    ROLE_LIST.forEach((r) => (staffSummary[r] = 0));
    staffCounts.forEach((c) => (staffSummary[c.role] = c._count.role));

    const lowStockCount = medicines.filter((m) => medicineAvailableQty(m) <= m.lowStockThreshold).length;

    res.json({
      monthlyRevenue,
      monthlyOtherIncome,
      monthlyExpense: monthlyExpenseTotal,
      monthlyNetIncome,
      profitMargin: monthlyRevenue + monthlyOtherIncome > 0 ? Math.round((monthlyNetIncome / (monthlyRevenue + monthlyOtherIncome)) * 1000) / 10 : 0,
      yearlyRevenue: sum(yearlyBills, "grandTotal"),
      yearlyOtherIncome: sum(yearlyIncome, "amount"),
      yearlyExpense: sum(yearlyExpenses, "amount"),
      revenueByCategory: categoryRevenue,
      todaysRevenue: sum(todaysBills, "grandTotal"),
      todaysBillCount: todaysBills.length,
      totalPatients,
      newPatientsThisMonth,
      staffSummary,
      lowStockCount,
      pendingVisitsToday,
    });
  })
);

// Shared helper: bucket rows by day or month key in JS (Postgres row counts
// for a single clinic are small enough that this is simpler and just as fast
// as a raw SQL date_trunc aggregation, and stays fully portable).
const bucketize = (rows, dateField, sumField, granularity) => {
  const map = {};
  for (const r of rows) {
    const d = new Date(r[dateField]);
    const key =
      granularity === "day"
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + (r[sumField] || 0);
  }
  return map;
};

const groupByKey = async (delegate, dateField, sumField, where, granularity) => {
  const rows = await prisma[delegate].findMany({ where, select: { [dateField]: true, [sumField]: true } });
  return bucketize(rows, dateField, sumField, granularity);
};

router.get(
  "/monthly-trend",
  FINANCE_VIEW,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [revMap, expMap, incMap] = await Promise.all([
      groupByKey("bill", "createdAt", "grandTotal", { createdAt: { gte: rangeStart }, status: { not: "cancelled" } }, "month"),
      groupByKey("expense", "date", "amount", { date: { gte: rangeStart } }, "month"),
      groupByKey("income", "date", "amount", { date: { gte: rangeStart } }, "month"),
    ]);

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      const revenue = revMap[key] || 0;
      const otherIncome = incMap[key] || 0;
      const expense = expMap[key] || 0;
      months.push({
        label: start.toLocaleString("default", { month: "short", year: "2-digit" }),
        revenue,
        otherIncome,
        expense,
        netIncome: revenue + otherIncome - expense,
      });
    }
    res.json(months);
  })
);

router.get(
  "/daily-trend",
  FINANCE_VIEW,
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));

    const [revMap, expMap, incMap] = await Promise.all([
      groupByKey("bill", "createdAt", "grandTotal", { createdAt: { gte: rangeStart }, status: { not: "cancelled" } }, "day"),
      groupByKey("expense", "date", "amount", { date: { gte: rangeStart } }, "day"),
      groupByKey("income", "date", "amount", { date: { gte: rangeStart } }, "day"),
    ]);

    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + (days - 1 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const revenue = revMap[key] || 0;
      const otherIncome = incMap[key] || 0;
      const expense = expMap[key] || 0;
      out.push({
        label: d.toLocaleString("default", { month: "short", day: "numeric" }),
        date: key,
        revenue,
        otherIncome,
        expense,
        netIncome: revenue + otherIncome - expense,
      });
    }
    res.json(out);
  })
);

// A lighter, role-tailored "my workspace" snapshot shown on the dashboard
// for every role that isn't looking at the full financial command centre
// (receptionist/doctor/nurse/pharmacist/lab/radiology/inventory). Nothing
// here touches revenue or salaries — just today's operational counters.
router.get(
  "/workspace",
  asyncHandler(async (req, res) => {
    const role = req.user.role;
    const now = new Date();
    const todayStart = new Date(now.toDateString());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    if (role === "doctor") {
      const [myQueue, myCompletedToday, myTotalPatients] = await Promise.all([
        prisma.oPDVisit.findMany({
          where: { doctorId: req.user.id, visitDate: { gte: todayStart, lt: tomorrowStart }, status: { in: ["waiting", "in_consultation"] } },
          include: { patient: { select: { id: true, name: true, patientId: true, gender: true, age: true } } },
          orderBy: { visitDate: "asc" },
        }),
        prisma.oPDVisit.count({ where: { doctorId: req.user.id, visitDate: { gte: todayStart, lt: tomorrowStart }, status: "completed" } }),
        prisma.oPDVisit.count({ where: { doctorId: req.user.id } }),
      ]);
      return res.json(serialize({ role, myQueue, myCompletedToday, myTotalPatients, waitingCount: myQueue.length }));
    }

    if (role === "receptionist") {
      const [visitsToday, waiting, billsToday, patientsToday] = await Promise.all([
        prisma.oPDVisit.count({ where: { visitDate: { gte: todayStart, lt: tomorrowStart } } }),
        prisma.oPDVisit.count({ where: { visitDate: { gte: todayStart, lt: tomorrowStart }, status: "waiting" } }),
        prisma.bill.findMany({ where: { createdAt: { gte: todayStart, lt: tomorrowStart }, status: { not: "cancelled" } } }),
        prisma.patient.count({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
      ]);
      return res.json({
        role,
        visitsToday,
        waiting,
        collectionsToday: billsToday.reduce((s, b) => s + (b.amountPaid || 0), 0),
        unpaidBillsToday: billsToday.filter((b) => b.status !== "paid").length,
        patientsRegisteredToday: patientsToday,
      });
    }

    if (role === "nurse") {
      const [visitsToday, waiting] = await Promise.all([
        prisma.oPDVisit.count({ where: { visitDate: { gte: todayStart, lt: tomorrowStart } } }),
        prisma.oPDVisit.findMany({
          where: { visitDate: { gte: todayStart, lt: tomorrowStart }, status: "waiting" },
          include: { patient: { select: { id: true, name: true, patientId: true } }, doctor: { select: { id: true, name: true } } },
          orderBy: { visitDate: "asc" },
          take: 10,
        }),
      ]);
      return res.json(serialize({ role, visitsToday, waitingQueue: waiting }));
    }

    if (role === "pharmacist" || role === "inventory_manager") {
      const [medicines, salesToday, lowStockItems] = await Promise.all([
        prisma.medicine.findMany({ where: { isActive: true }, include: { batches: true } }),
        prisma.pharmacySale.findMany({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
        prisma.inventoryItem.findMany(),
      ]);
      const lowStockMedicines = medicines.filter((m) => medicineAvailableQty(m) <= m.lowStockThreshold).length;
      const lowStockInventory = lowStockItems.filter((i) => i.quantity <= i.lowStockThreshold).length;
      return res.json({
        role,
        lowStockMedicines,
        lowStockInventory,
        salesToday: salesToday.length,
        salesTotalToday: salesToday.reduce((s, x) => s + (x.grandTotal || 0), 0),
      });
    }

    if (role === "lab_tech" || role === "radiologist") {
      const type = role === "radiologist" ? "radiology" : "pathology";
      const [pending, completedToday] = await Promise.all([
        prisma.labOrder.count({ where: { type, status: { in: ["pending", "in_progress"] } } }),
        prisma.labOrder.count({ where: { type, status: "completed", updatedAt: { gte: todayStart, lt: tomorrowStart } } }),
      ]);
      return res.json({ role, pending, completedToday });
    }

    // Administrators/accountants land on the full financial dashboard
    // instead, but return something sane if this is ever called for them.
    res.json({ role, message: "Use /dashboard/summary for the full overview." });
  })
);

export default router;
