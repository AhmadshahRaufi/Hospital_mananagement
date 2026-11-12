import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

// Everyone can read notices/complaints relevant to them; front desk is the
// one that typically logs patient complaints, posts notices and sends out
// messages, so writes are scoped there (admins always pass regardless).
const CAN_COMMUNICATE = allowRoles("receptionist");

/* ---------- Notice Board ---------- */
router.get(
  "/notices",
  asyncHandler(async (req, res) => {
    const notices = await prisma.notice.findMany({
      where: { OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: req.user.role } }] },
      include: { postedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(serialize(notices));
  })
);

router.post(
  "/notices",
  CAN_COMMUNICATE,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["title", "message"]);
    const notice = await prisma.notice.create({ data: { ...req.body, title: cleanString(req.body.title), message: cleanString(req.body.message), postedById: req.user.id } });
    await recordAudit({ user: req.user, action: "NOTICE_POST", module: "communications", targetId: notice.id });
    res.status(201).json(serialize(notice));
  })
);

router.delete(
  "/notices/:id",
  CAN_COMMUNICATE,
  asyncHandler(async (req, res) => {
    await prisma.notice.delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ message: "Notice removed." });
  })
);

/* ---------- Complaints ---------- */
router.get("/complaints", asyncHandler(async (req, res) => res.json(serialize(await prisma.complaint.findMany({ orderBy: { createdAt: "desc" } })))));
router.post("/complaints", CAN_COMMUNICATE, asyncHandler(async (req, res) => {
  requireFields(req.body, ["complaint"]);
  res.status(201).json(serialize(await prisma.complaint.create({ data: { ...req.body, complaint: cleanString(req.body.complaint) } })));
}));
router.put("/complaints/:id/status", CAN_COMMUNICATE, asyncHandler(async (req, res) => res.json(serialize(await prisma.complaint.update({ where: { id: req.params.id }, data: { status: req.body.status } })))));
router.delete("/complaints/:id", CAN_COMMUNICATE, asyncHandler(async (req, res) => {
  await prisma.complaint.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ message: "Deleted." });
}));

/* ---------- Content Library ---------- */
router.get(
  "/content",
  asyncHandler(async (req, res) =>
    res.json(serialize(await prisma.content.findMany({ include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } })))
  )
);
router.post(
  "/content",
  allowRoles(),
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["title", "type"]);
    const content = await prisma.content.create({ data: { ...req.body, title: cleanString(req.body.title), uploadedById: req.user.id } });
    await recordAudit({ user: req.user, action: "CONTENT_UPLOAD", module: "communications", targetId: content.id });
    res.status(201).json(serialize(content));
  })
);
router.delete("/content/:id", allowRoles(), asyncHandler(async (req, res) => {
  await prisma.content.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ message: "Deleted." });
}));

/* ---------- Email / SMS composer ----------
   NOTE: no external provider is wired up yet. This records the message so the
   UI is fully functional end-to-end; to actually deliver mail/SMS, plug a
   provider (SendGrid, Twilio, etc.) into the block marked below. */
router.get(
  "/messages",
  asyncHandler(async (req, res) =>
    res.json(serialize(await prisma.message.findMany({ include: { sentBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 })))
  )
);

router.post(
  "/messages",
  CAN_COMMUNICATE,
  asyncHandler(async (req, res) => {
    const { channel, recipientType, recipients, subject, body } = req.body;
    if (!recipients?.length || !cleanString(body)) {
      res.status(400);
      throw new Error("Recipients and message body are required.");
    }

    // ---- Provider integration point ----
    // e.g. for email: await sgMail.send({ to: recipients, subject, text: body });
    // e.g. for sms:   await twilioClient.messages.create({ to: recipients, body });
    // Left unimplemented on purpose (no provider credentials configured).
    const status = "queued";

    const message = await prisma.message.create({ data: { channel, recipientType, recipients, subject, body: cleanString(body), sentById: req.user.id, status } });
    await recordAudit({ user: req.user, action: "MESSAGE_QUEUE", module: "communications", targetId: message.id, description: `${channel} to ${recipients.length} recipient(s)` });
    res.status(201).json(serialize(message));
  })
);

export default router;
