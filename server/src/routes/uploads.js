import express from "express";
import asyncHandler from "express-async-handler";
import { uploadImage } from "../middleware/upload.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { recordAudit } from "../middleware/audit.js";

const router = express.Router();
router.use(protect);

// Generic image upload used by Settings (clinic logo, lab report header/footer
// banners, etc). Restricted to administrators since it writes branding that
// appears on every printed document. Returns a relative URL the client can
// save straight into a Setting field and the <img> print templates.
router.post(
  "/image",
  allowRoles(),
  uploadImage.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded. Attach an image under the 'file' field.");
    }
    const url = `/uploads/${req.file.filename}`;
    await recordAudit({
      user: req.user,
      action: "IMAGE_UPLOAD",
      module: "settings",
      description: `${req.body?.purpose || "asset"} -> ${req.file.filename}`,
    });
    res.status(201).json({ url, filename: req.file.filename });
  })
);

// Multer errors (bad file type, too large) come back as regular Error
// instances thrown from the fileFilter/limits — surface them as 400s instead
// of falling through to the generic 500 handler.
router.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({ message: err.message || "Upload failed." });
    return;
  }
  next();
});

export default router;
