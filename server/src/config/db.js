import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the whole app. Prisma manages its own
// connection pool to Postgres, so we don't need a manual connect step like
// mongoose.connect() -- the client lazily connects on first query.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("[DB] Connected to PostgreSQL via Prisma");
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }
};
