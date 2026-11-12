import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { shapeSetting } from "../utils/shape.js";

const router = express.Router();
router.use(protect);

// Doctors run consultations, reception schedules them for patients; anyone
// relevant (including lab/pharmacy checking a referral) can still view the list.
const CAN_SCHEDULE = allowRoles("doctor", "receptionist");

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, doctor } = req.query;
    const where = {};
    if (status) where.status = status;
    if (doctor) where.doctorId = doctor;
    const sessions = await prisma.liveConsultation.findMany({
      where,
      include: { patient: { select: { id: true, name: true, patientId: true } }, doctor: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
    res.json(serialize(sessions));
  })
);

router.post(
  "/",
  CAN_SCHEDULE,
  asyncHandler(async (req, res) => {
    // If Zoom isn't connected in Settings, we still create the session with a
    // manually-entered meetingLink so the feature works without the integration.
    const settings = await prisma.setting.findFirst();
    const { patient, doctor, ...rest } = req.body;
    const session = await prisma.liveConsultation.create({ data: { ...rest, patientId: patient, doctorId: doctor } });
    await recordAudit({ user: req.user, action: "LIVE_CONSULT_SCHEDULE", module: "telemedicine", targetId: session.id });
    res.status(201).json(serialize({ session, zoomConnected: !!settings?.zoomConnected }));
  })
);

router.put(
  "/:id",
  CAN_SCHEDULE,
  asyncHandler(async (req, res) => {
    const { patient, doctor, ...rest } = req.body;
    const data = { ...rest };
    if (patient !== undefined) data.patientId = patient;
    if (doctor !== undefined) data.doctorId = doctor;
    res.json(serialize(await prisma.liveConsultation.update({ where: { id: req.params.id }, data })));
  })
);
router.delete("/:id", CAN_SCHEDULE, asyncHandler(async (req, res) => {
  await prisma.liveConsultation.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ message: "Cancelled." });
}));

// Zoom connect/disconnect (Settings page uses this)
router.post(
  "/zoom/connect",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    let settings = await prisma.setting.findFirst();
    if (!settings) settings = await prisma.setting.create({ data: {} });
    const updated = await prisma.setting.update({
      where: { id: settings.id },
      data: {
        zoomAccountEmail: req.body.accountEmail,
        zoomApiKey: req.body.apiKey,
        zoomApiSecret: req.body.apiSecret,
        zoomConnected: true,
      },
    });
    res.json(shapeSetting(updated).zoom);
  })
);

router.post(
  "/zoom/disconnect",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const settings = await prisma.setting.findFirst();
    if (settings) {
      await prisma.setting.update({
        where: { id: settings.id },
        data: { zoomConnected: false, zoomAccountEmail: null, zoomApiKey: null, zoomApiSecret: null, zoomAccessToken: null },
      });
    }
    res.json({ message: "Zoom disconnected." });
  })
);

export default router;
