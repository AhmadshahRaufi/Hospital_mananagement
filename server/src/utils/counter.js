import { prisma } from "../config/db.js";

// Atomically increments a named counter and returns a padded, prefixed
// sequence string, e.g. nextSequence("INVOICE", "INV", 5) -> "INV-00001".
export async function nextSequence(key, prefix, padLength = 5) {
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { seq: { increment: 1 } },
    create: { key, seq: 1 },
  });
  const num = String(counter.seq).padStart(padLength, "0");
  return prefix ? `${prefix}-${num}` : num;
}
