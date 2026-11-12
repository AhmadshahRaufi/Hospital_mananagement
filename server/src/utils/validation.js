export const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

export const cleanString = (value) => (typeof value === "string" ? value.trim() : value);

export const requireFields = (body, fields) => {
  const missing = fields.filter((field) => isBlank(body?.[field]));
  if (missing.length) {
    const err = new Error(`Required field missing: ${missing.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
};

export const requirePositiveNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    const err = new Error(`${label} must be greater than 0.`);
    err.statusCode = 400;
    throw err;
  }
  return number;
};
