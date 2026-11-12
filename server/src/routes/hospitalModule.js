import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { cleanString, isBlank, requireFields } from "../utils/validation.js";

const router = express.Router();
router.use(protect);

// Allowed module types — anything else is a 400. This whitelist is the
// single source of truth; the frontend HospitalModule.jsx must use one of
// these keys (it already does — see the MODULES map there).
const ALLOWED_TYPES = new Set([
  "appointments",
  "ipd",
  "emergency",
  "emr",
  "nursing",
  "documents",
  "insurance",
  "ot",
  "diagnostics",
  "print",
]);

const REQUIRED_FIELDS = {
  appointments: ["patient", "doctor", "department", "date", "time"],
  ipd: ["patient", "consultant", "ward", "room", "bed", "admissionDate"],
  emergency: ["patient", "assignedDoctor", "chiefComplaint", "triageLevel"],
  emr: ["patient", "doctor", "noteType", "diagnosis"],
  nursing: ["patient", "ward", "task", "priority", "dueAt"],
  documents: ["patient", "documentType", "title"],
  insurance: ["patient", "provider", "policyNumber", "claimAmount"],
  ot: ["patient", "operation", "surgeon", "scheduledAt"],
  diagnostics: ["patient", "orderType", "sampleId", "status"],
  print: ["patient", "document", "template", "status"],
};

const cleanRecord = (body = {}) => {
  const data = { ...body };
  delete data.id;
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") data[key] = cleanString(value);
  }
  return data;
};

// GET /api/hospital-module/:type
// Returns all records of the given type, newest first. Optional `?q=`
// does a case-insensitive substring search across the JSON data — useful
// for the "Search records" box in HospitalModule.jsx.
router.get(
  "/:type",
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    if (!ALLOWED_TYPES.has(type)) {
      res.status(400);
      throw new Error(`Unknown hospital module type: ${type}`);
    }
    const rows = await prisma.hospitalModuleRecord.findMany({
      where: { type },
      orderBy: { createdAt: "desc" },
    });
    // The frontend expects each row to look like a flat object with the
    // fields it saved (patient, doctor, status, etc.) plus id + createdAt.
    // We stored those fields inside `data`, so flatten them out here.
    const flat = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...(r.data || {}),
    }));

    // Optional client-side substring filter (cheap for typical clinic volumes).
    const q = (req.query.q || "").toLowerCase().trim();
    if (q) {
      const filtered = flat.filter((row) =>
        Object.values(row).some((v) => String(v || "").toLowerCase().includes(q))
      );
      return res.json(filtered);
    }
    res.json(flat);
  })
);

// POST /api/hospital-module/:type
// Body: the record fields (any JSON shape). Returns the created row with
// id + createdAt filled in.
router.post(
  "/:type",
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    if (!ALLOWED_TYPES.has(type)) {
      res.status(400);
      throw new Error(`Unknown hospital module type: ${type}`);
    }
    const data = cleanRecord(req.body);
    requireFields(data, REQUIRED_FIELDS[type] || []);
    if (Object.values(data).every(isBlank)) {
      res.status(400);
      throw new Error("At least one field is required.");
    }
    const created = await prisma.hospitalModuleRecord.create({
      data: { type, data },
    });
    await recordAudit({
      user: req.user,
      action: "HOSPITAL_MODULE_CREATE",
      module: `hospital_${type}`,
      targetId: created.id,
    });
    res.status(201).json({
      id: created.id,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      ...(created.data || {}),
    });
  })
);

// PUT /api/hospital-module/:type/:id
// Body: partial fields to merge into the stored JSON.
router.put(
  "/:type/:id",
  asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    if (!ALLOWED_TYPES.has(type)) {
      res.status(400);
      throw new Error(`Unknown hospital module type: ${type}`);
    }
    const existing = await prisma.hospitalModuleRecord.findUnique({ where: { id } });
    if (!existing || existing.type !== type) {
      res.status(404);
      throw new Error("Record not found");
    }
    const merged = cleanRecord({ ...(existing.data || {}), ...(req.body || {}) });
    requireFields(merged, REQUIRED_FIELDS[type] || []);
    // Don't let callers overwrite id/createdAt via the data blob.
    delete merged.id;
    delete merged.createdAt;
    delete merged.updatedAt;
    const updated = await prisma.hospitalModuleRecord.update({
      where: { id },
      data: { data: merged },
    });
    await recordAudit({
      user: req.user,
      action: "HOSPITAL_MODULE_UPDATE",
      module: `hospital_${type}`,
      targetId: id,
    });
    res.json({
      id: updated.id,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ...(updated.data || {}),
    });
  })
);

// DELETE /api/hospital-module/:type/:id
router.delete(
  "/:type/:id",
  allowRoles(), // admin-only
  asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    if (!ALLOWED_TYPES.has(type)) {
      res.status(400);
      throw new Error(`Unknown hospital module type: ${type}`);
    }
    const existing = await prisma.hospitalModuleRecord.findUnique({ where: { id } });
    if (!existing || existing.type !== type) {
      res.status(404);
      throw new Error("Record not found");
    }
    await prisma.hospitalModuleRecord.delete({ where: { id } });
    await recordAudit({
      user: req.user,
      action: "HOSPITAL_MODULE_DELETE",
      module: `hospital_${type}`,
      targetId: id,
    });
    res.json({ ok: true });
  })
);

export default router;
