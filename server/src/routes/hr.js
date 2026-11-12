import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { ROLE_LIST, toSafeUser } from "../utils/userHelpers.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { shapeUser } from "../utils/shape.js";
import { requireFields, requirePositiveNumber } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

router.get(
  "/staff",
  asyncHandler(async (req, res) => {
    const { role, department, q } = req.query;
    const where = {};
    if (role) where.role = role;
    if (department) where.department = department;
    if (q) where.name = { contains: q, mode: "insensitive" };
    const staff = await prisma.user.findMany({ where, orderBy: { name: "asc" } });
    res.json(serialize(staff.map((u) => shapeUser(toSafeUser(u)))));
  })
);

router.get(
  "/staff/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    res.json(serialize(shapeUser(toSafeUser(user))));
  })
);

router.put(
  "/staff/:id",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    const staff = await prisma.user.update({ where: { id: req.params.id }, data: rest });
    await recordAudit({ user: req.user, action: "STAFF_UPDATE", module: "hr", targetId: req.params.id });
    res.json(serialize(shapeUser(toSafeUser(staff))));
  })
);

router.delete(
  "/staff/:id",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({ user: req.user, action: "STAFF_DEACTIVATE", module: "hr", targetId: req.params.id });
    res.json({ message: "Staff deactivated." });
  })
);

router.get(
  "/staff-summary",
  asyncHandler(async (req, res) => {
    const counts = await prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { role: true } });
    const summary = {};
    ROLE_LIST.forEach((r) => (summary[r] = 0));
    counts.forEach((c) => (summary[c.role] = c._count.role));
    res.json(summary);
  })
);

/* Attendance */
router.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const { date, staff } = req.query;
    const where = {};
    if (staff) where.staffId = staff;
    if (date) {
      const start = new Date(date),
        end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.date = { gte: start, lt: end };
    }
    res.json(serialize(await prisma.attendance.findMany({ where, include: { staff: { select: { id: true, name: true, role: true } } } })));
  })
);

router.post(
  "/attendance",
  asyncHandler(async (req, res) => {
    const { staff, date, status, checkIn, checkOut, notes } = req.body;
    requireFields(req.body, ["staff", "date", "status"]);
    const day = new Date(date);
    if (Number.isNaN(day.getTime())) {
      res.status(400);
      throw new Error("Valid attendance date is required.");
    }
    const record = await prisma.attendance.upsert({
      where: { staffId_date: { staffId: staff, date: day } },
      update: { status, checkIn: checkIn ? new Date(checkIn) : null, checkOut: checkOut ? new Date(checkOut) : null, notes },
      create: { staffId: staff, date: day, status, checkIn: checkIn ? new Date(checkIn) : null, checkOut: checkOut ? new Date(checkOut) : null, notes },
    });
    res.json(serialize(record));
  })
);

/* Leave */
router.get("/leave-types", asyncHandler(async (req, res) => res.json(serialize(await prisma.leaveType.findMany({ orderBy: { name: "asc" } })))));
router.post(
  "/leave-types",
  allowRoles(),
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["name"]);
    res.status(201).json(serialize(await prisma.leaveType.create({ data: { name: req.body.name.trim() } })));
  })
);

router.get(
  "/leaves",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.leave.findMany({
          include: { staff: { select: { id: true, name: true } }, leaveType: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        })
      )
    )
  )
);
router.post(
  "/leaves",
  asyncHandler(async (req, res) => {
    const { staff, leaveType, fromDate, toDate, reason } = req.body;
    requireFields(req.body, ["staff", "fromDate", "toDate"]);
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      res.status(400);
      throw new Error("Valid leave dates are required.");
    }
    const leave = await prisma.leave.create({
      data: { staffId: staff, leaveTypeId: leaveType || null, fromDate: start, toDate: end, reason },
    });
    res.status(201).json(serialize(leave));
  })
);
router.put(
  "/leaves/:id/status",
  allowRoles(),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const leave = await prisma.leave.update({ where: { id: req.params.id }, data: { status, approvedById: req.user.id } });
    await recordAudit({ user: req.user, action: `LEAVE_${status?.toUpperCase()}`, module: "hr", targetId: req.params.id });
    res.json(serialize(leave));
  })
);

/* Payslips */
router.get(
  "/payslips",
  asyncHandler(async (req, res) => {
    const { staff } = req.query;
    const where = {};
    if (staff) where.staffId = staff;
    res.json(serialize(await prisma.payslip.findMany({ where, include: { staff: { select: { id: true, name: true } } }, orderBy: [{ year: "desc" }, { month: "desc" }] })));
  })
);

router.post(
  "/payslips",
  allowRoles("admin", "accountant"),
  asyncHandler(async (req, res) => {
    const { staff, month, year, basicSalary = 0, allowances = 0, deductions = 0, paymentMode } = req.body;
    requireFields(req.body, ["staff", "month", "year", "basicSalary"]);
    const basic = requirePositiveNumber(basicSalary, "Basic salary");
    const monthNum = Number(month);
    const yearNum = Number(year);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 || !Number.isInteger(yearNum) || yearNum < 2000) {
      res.status(400);
      throw new Error("Valid payroll month and year are required.");
    }
    const netSalary = basic + Number(allowances || 0) - Number(deductions || 0);
    const payslipNumber = await nextSequence("PAYSLIP", "PSL", 5);
    const payslip = await prisma.payslip.create({
      data: { payslipNumber, staffId: staff, month: monthNum, year: yearNum, basicSalary: basic, allowances: Number(allowances || 0), deductions: Number(deductions || 0), netSalary, paymentMode },
    });
    await recordAudit({ user: req.user, action: "PAYSLIP_CREATE", module: "hr", targetId: payslip.id });
    res.status(201).json(serialize(payslip));
  })
);

router.put(
  "/payslips/:id/pay",
  allowRoles("admin", "accountant"),
  asyncHandler(async (req, res) => {
    const payslip = await prisma.payslip.update({ where: { id: req.params.id }, data: { status: "paid", paidDate: new Date() } });
    res.json(serialize(payslip));
  })
);

export default router;
