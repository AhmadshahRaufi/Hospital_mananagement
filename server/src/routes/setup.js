import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { nextSequence } from "../utils/counter.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";
import { serialize } from "../utils/serialize.js";

const router = express.Router();
router.use(protect);

// These are system lookup lists (vital types, symptom/finding pickers, custom
// fields) — anyone charting a visit needs to read them, but only an
// administrator should be able to add/rename/remove the options everyone sees.
const crud = (delegate, path) => {
  router.get(`/${path}`, asyncHandler(async (req, res) => res.json(serialize(await prisma[delegate].findMany()))));
  router.post(`/${path}`, allowRoles(), asyncHandler(async (req, res) => res.status(201).json(serialize(await prisma[delegate].create({ data: req.body })))));
  router.put(`/${path}/:id`, allowRoles(), asyncHandler(async (req, res) => res.json(serialize(await prisma[delegate].update({ where: { id: req.params.id }, data: req.body })))));
  router.delete(`/${path}/:id`, allowRoles(), asyncHandler(async (req, res) => {
    await prisma[delegate].delete({ where: { id: req.params.id } }).catch(() => null);
    res.json({ message: "Deleted." });
  }));
};

crud("vital", "vitals");
crud("symptom", "symptoms");
crud("finding", "findings");
crud("customField", "custom-fields");

/* ---------- Bulk Import (gap-fill: spec references CSV import but never
   specifies a format, so this accepts an already-parsed JSON array from the
   frontend, which does the CSV parsing client-side). ---------- */

const PATIENT_FIELDS = [
  "name", "gender", "dob", "age", "phone", "email", "address", "province", "city",
  "guardianName", "bloodGroup", "maritalStatus", "nationalId", "remarks",
];

router.post(
  "/import/patients",
  allowRoles("admin", "receptionist"),
  asyncHandler(async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      res.status(400);
      throw new Error("No rows to import.");
    }
    let created = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        if (!row.name || !row.phone || !row.gender) {
          failed++;
          errors.push(`Skipped row (missing name/phone/gender): ${JSON.stringify(row)}`);
          continue;
        }
        const patientId = await nextSequence("PATIENT", "PAT", 5);
        const data = { patientId };
        for (const f of PATIENT_FIELDS) if (row[f] !== undefined && row[f] !== "") data[f] = row[f];
        if (data.dob) data.dob = new Date(data.dob);
        if (data.age !== undefined) data.age = Number(data.age);
        await prisma.patient.create({ data });
        created++;
      } catch (err) {
        failed++;
        errors.push(err.message);
      }
    }
    await recordAudit({ user: req.user, action: "BULK_IMPORT_PATIENTS", module: "patient", description: `${created} created, ${failed} failed` });
    res.json({ created, failed, errors: errors.slice(0, 20) });
  })
);

router.post(
  "/import/medicines",
  allowRoles("admin", "pharmacist", "inventory_manager"),
  asyncHandler(async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      res.status(400);
      throw new Error("No rows to import.");
    }
    let created = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        if (!row.name) { failed++; continue; }
        const { category, batches, ...rest } = row;
        await prisma.medicine.create({ data: rest });
        created++;
      } catch (err) {
        failed++;
        errors.push(err.message);
      }
    }
    await recordAudit({ user: req.user, action: "BULK_IMPORT_MEDICINES", module: "pharmacy", description: `${created} created, ${failed} failed` });
    res.json({ created, failed, errors: errors.slice(0, 20) });
  })
);

router.post(
  "/import/charges",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      res.status(400);
      throw new Error("No rows to import.");
    }
    const result = await prisma.charge.createMany({ data: rows, skipDuplicates: true });
    res.json({ created: result.count });
  })
);

export default router;
