import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files are written to <server>/uploads and served statically from /uploads
// (see index.js). Kept outside src/ so it survives regardless of how the
// server is started, and is easy to point a volume/backup at in production.
export const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeBase = (req.body?.purpose || "asset").toString().replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "asset";
    cb(null, `${safeBase}-${Date.now()}${ext || ".png"}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Only image files (PNG, JPG, WEBP, GIF, SVG) are allowed."));
  }
  cb(null, true);
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
