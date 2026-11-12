import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";
import { shapePatient } from "../utils/shape.js";
import { cleanString, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

// Looking a patient up by name/phone/ID is needed across almost every module
// (pharmacy sale, lab order, billing, OPD), so reads stay open to any signed-in
// staff member. Only the front desk (plus admins) maintains the actual registry.
const CAN_MANAGE_PATIENTS = allowRoles("receptionist");

// Split any incoming { tpa: {...} } payload into the flat columns Prisma expects.
const flattenPatientInput = (body) => {
  const { tpa, _id, id, patientId, createdAt, updatedAt, mergedInto, ...rest } = body;
  const data = { ...rest };
  if (tpa) {
    if (tpa.isTPA !== undefined) data.tpaIsTPA = !!tpa.isTPA;
    if (tpa.provider !== undefined) data.tpaProvider = tpa.provider;
    if (tpa.tpaId !== undefined) data.tpaId = tpa.tpaId;
    if (tpa.validity !== undefined) data.tpaValidity = tpa.validity ? new Date(tpa.validity) : null;
  }
  if (data.dob) data.dob = new Date(data.dob);
  for (const key of ["name", "gender", "phone", "email", "address", "guardianName", "nationalId"]) {
    if (data[key] !== undefined) data[key] = cleanString(data[key]);
  }
  return data;
};

// GET /api/patients?q=&page=&limit=&view=active|disabled|dead|tpa
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 20, view = "active" } = req.query;
    const where = { mergedIntoId: null };
    if (view === "disabled") where.isActive = false;
    else if (view === "dead") where.dead = true;
    else if (view === "tpa") where.tpaIsTPA = true;
    else where.isActive = true;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { patientId: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q, mode: "insensitive" } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: Number(limit) }),
      prisma.patient.count({ where }),
    ]);
    res.json({
      patients: patients.map((p) => serialize(shapePatient(p))),
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!patient) {
      res.status(404);
      throw new Error("Patient not found.");
    }
    res.json(serialize(shapePatient(patient)));
  })
);

router.post(
  "/",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ["name", "gender", "phone"]);
    const patientId = await nextSequence("PATIENT", "PAT", 5);
    const patient = await prisma.patient.create({ data: { ...flattenPatientInput(req.body), patientId } });
    await recordAudit({ user: req.user, action: "PATIENT_CREATE", module: "patient", targetId: patient.id });
    res.status(201).json(serialize(shapePatient(patient)));
  })
);

router.put(
  "/:id",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    const data = flattenPatientInput(req.body);
    requireFields(data, ["name", "gender", "phone"]);
    const patient = await prisma.patient
      .update({ where: { id: req.params.id }, data })
      .catch(() => null);
    if (!patient) {
      res.status(404);
      throw new Error("Patient not found.");
    }
    await recordAudit({ user: req.user, action: "PATIENT_UPDATE", module: "patient", targetId: patient.id });
    res.json(serialize(shapePatient(patient)));
  })
);

router.delete(
  "/:id",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    const patient = await prisma.patient.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({ user: req.user, action: "PATIENT_DEACTIVATE", module: "patient", targetId: req.params.id });
    res.json({ message: "Patient deactivated.", patient: serialize(shapePatient(patient)) });
  })
);

// Gap-fill: bulk "delete selected" from the patient list (soft-delete / deactivate)
router.post(
  "/bulk-deactivate",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      res.status(400);
      throw new Error("No patients selected.");
    }
    await prisma.patient.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
    await recordAudit({ user: req.user, action: "PATIENT_BULK_DEACTIVATE", module: "patient", description: `${ids.length} patient(s) deactivated` });
    res.json({ message: `${ids.length} patient(s) deactivated.` });
  })
);

// Gap-fill: mark patient deceased (Birth/Death report reads this flag)
router.put(
  "/:id/mark-deceased",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    const { deathDate } = req.body;
    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: { dead: true, deathDate: deathDate ? new Date(deathDate) : new Date() },
    });
    await recordAudit({ user: req.user, action: "PATIENT_MARK_DECEASED", module: "patient", targetId: req.params.id });
    res.json(serialize(shapePatient(patient)));
  })
);

router.put(
  "/:id/reactivate",
  CAN_MANAGE_PATIENTS,
  asyncHandler(async (req, res) => {
    const patient = await prisma.patient.update({ where: { id: req.params.id }, data: { isActive: true } });
    await recordAudit({ user: req.user, action: "PATIENT_REACTIVATE", module: "patient", targetId: req.params.id });
    res.json(serialize(shapePatient(patient)));
  })
);

// Gap-fill: patient duplicate-merge workflow (spec listed this as missing/unknown)
router.post(
  "/:keepId/merge/:mergeId",
  allowRoles(),
  asyncHandler(async (req, res) => {
    const { keepId, mergeId } = req.params;
    if (keepId === mergeId) {
      res.status(400);
      throw new Error("Cannot merge a patient into itself.");
    }
    const [keep, merge] = await Promise.all([
      prisma.patient.findUnique({ where: { id: keepId } }),
      prisma.patient.findUnique({ where: { id: mergeId } }),
    ]);
    if (!keep || !merge) {
      res.status(404);
      throw new Error("One or both patients not found.");
    }
    await prisma.patient.update({ where: { id: mergeId }, data: { mergedIntoId: keepId, isActive: false } });
    await recordAudit({
      user: req.user,
      action: "PATIENT_MERGE",
      module: "patient",
      targetId: keepId,
      description: `Merged ${merge.patientId} into ${keep.patientId}`,
    });
    res.json({ message: "Patients merged.", keep: serialize(shapePatient(keep)) });
  })
);

export default router;
