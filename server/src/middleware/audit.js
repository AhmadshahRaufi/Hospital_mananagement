import { prisma } from "../config/db.js";

// Gap-fill: easy helper to record audit trail entries for destructive/important actions.
export const recordAudit = async ({ user, action, module, targetId, description, ipAddress }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id,
        userName: user?.name,
        action,
        module,
        targetId,
        description,
        ipAddress,
      },
    });
  } catch (err) {
    console.error("[Audit] Failed to record:", err.message);
  }
};
