import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";

const router = express.Router();
router.use(protect);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notes = await prisma.notification.findMany({
      where: {
        OR: [
          { recipientId: req.user.id },
          { recipientId: null, OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: req.user.role } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(serialize(notes));
  })
);

router.post("/", asyncHandler(async (req, res) => res.status(201).json(serialize(await prisma.notification.create({ data: req.body })))));

router.put("/:id/read", asyncHandler(async (req, res) => res.json(serialize(await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } })))));

router.put(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { recipientId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ message: "All marked as read." });
  })
);

router.delete(
  "/clear-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.deleteMany({ where: { recipientId: req.user.id } });
    res.json({ message: "All notifications cleared." });
  })
);

export default router;
