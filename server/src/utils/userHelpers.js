import bcrypt from "bcryptjs";

export const ROLE_LIST = [
  "super_admin",
  "admin",
  "receptionist",
  "doctor",
  "pharmacist",
  "lab_tech",
  "radiologist",
  "accountant",
  "inventory_manager",
  "nurse",
];

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const toSafeUser = (user) => {
  if (!user) return user;
  const { passwordHash, ...safe } = user;
  return safe;
};
