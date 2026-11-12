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
router.use(allowRoles("accountant"));

router.get("/income-heads", asyncHandler(async (req, res) => res.json(serialize(await prisma.incomeHead.findMany({ orderBy: { name: "asc" } })))));
router.post("/income-heads", asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  res.status(201).json(serialize(await prisma.incomeHead.create({ data: { name: cleanString(req.body.name) } })));
}));
router.get("/expense-heads", asyncHandler(async (req, res) => res.json(serialize(await prisma.expenseHead.findMany({ orderBy: { name: "asc" } })))));
router.post("/expense-heads", asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  res.status(201).json(serialize(await prisma.expenseHead.create({ data: { name: cleanString(req.body.name) } })));
}));

router.get(
  "/income",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.income.findMany({
          include: { incomeHead: { select: { id: true, name: true } }, generatedBy: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        })
      )
    )
  )
);
router.post(
  "/income",
  asyncHandler(async (req, res) => {
    const { incomeHead, ...rest } = req.body;
    requireFields(rest, ["name", "amount"]);
    const amount = requirePositiveNumber(rest.amount, "Amount");
    const invoiceNumber = await nextSequence("INCOME", "INC", 5);
    const income = await prisma.income.create({ data: { ...rest, name: cleanString(rest.name), amount, incomeHeadId: incomeHead || null, invoiceNumber, generatedById: req.user.id } });
    await recordAudit({ user: req.user, action: "INCOME_ADD", module: "finance", targetId: income.id });
    res.status(201).json(serialize(income));
  })
);
router.delete(
  "/income/:id",
  asyncHandler(async (req, res) => {
    await prisma.income.delete({ where: { id: req.params.id } }).catch(() => null);
    await recordAudit({ user: req.user, action: "INCOME_DELETE", module: "finance", targetId: req.params.id });
    res.json({ message: "Deleted." });
  })
);

router.get(
  "/expense",
  asyncHandler(async (req, res) =>
    res.json(
      serialize(
        await prisma.expense.findMany({
          include: { expenseHead: { select: { id: true, name: true } }, generatedBy: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        })
      )
    )
  )
);
router.post(
  "/expense",
  asyncHandler(async (req, res) => {
    const { expenseHead, ...rest } = req.body;
    requireFields(rest, ["name", "amount"]);
    const amount = requirePositiveNumber(rest.amount, "Amount");
    const voucherNumber = await nextSequence("EXPENSE", "EXP", 5);
    const expense = await prisma.expense.create({ data: { ...rest, name: cleanString(rest.name), amount, expenseHeadId: expenseHead || null, voucherNumber, generatedById: req.user.id } });
    await recordAudit({ user: req.user, action: "EXPENSE_ADD", module: "finance", targetId: expense.id });
    res.status(201).json(serialize(expense));
  })
);
router.delete(
  "/expense/:id",
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: req.params.id } }).catch(() => null);
    await recordAudit({ user: req.user, action: "EXPENSE_DELETE", module: "finance", targetId: req.params.id });
    res.json({ message: "Deleted." });
  })
);

export default router;
