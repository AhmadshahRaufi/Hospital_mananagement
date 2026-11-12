import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_RETENTION = 1440;
const BACKUP_PREFIX = "clinic-backup-";
const BACKUP_SUFFIX = ".json";

const backupDir = process.env.BACKUP_DIR || path.resolve(__dirname, "../../backups");
const backupIntervalMs = Number(process.env.BACKUP_INTERVAL_MS || DEFAULT_INTERVAL_MS);
const backupRetention = Number(process.env.BACKUP_RETENTION_FILES || DEFAULT_RETENTION);

const timestampForFile = (date = new Date()) => date.toISOString().replace(/[:.]/g, "-");
const delegateNameForModel = (modelName) => `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`;

const getBackupFiles = async () => {
  const entries = await readdir(backupDir).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
      .map(async (name) => {
        const filePath = path.join(backupDir, name);
        const info = await stat(filePath).catch(() => null);
        return info ? { name, filePath, mtimeMs: info.mtimeMs } : null;
      })
  );
  return files.filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
};

const pruneOldBackups = async () => {
  if (!Number.isFinite(backupRetention) || backupRetention <= 0) return;
  const files = await getBackupFiles();
  await Promise.all(files.slice(backupRetention).map((file) => unlink(file.filePath).catch(() => null)));
};

export const createDatabaseBackup = async (prisma = new PrismaClient()) => {
  await mkdir(backupDir, { recursive: true });
  const createdAt = new Date();
  const data = {};

  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = prisma[delegateNameForModel(model.name)];
    if (!delegate?.findMany) continue;
    data[model.name] = await delegate.findMany();
  }

  const payload = {
    createdAt: createdAt.toISOString(),
    database: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@") : null,
    modelCount: Object.keys(data).length,
    data,
  };

  const finalPath = path.join(backupDir, `${BACKUP_PREFIX}${timestampForFile(createdAt)}${BACKUP_SUFFIX}`);
  const tempPath = `${finalPath}.tmp`;
  await writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await rename(tempPath, finalPath);
  await pruneOldBackups();
  return finalPath;
};

export const startAutomatedBackups = (prisma) => {
  if (process.env.BACKUP_ENABLED === "false") return null;
  if (!Number.isFinite(backupIntervalMs) || backupIntervalMs <= 0) return null;

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await createDatabaseBackup(prisma);
    } catch (err) {
      console.error("[Backup] Failed:", err.message);
    } finally {
      running = false;
    }
  };

  run();
  return setInterval(run, backupIntervalMs);
};
