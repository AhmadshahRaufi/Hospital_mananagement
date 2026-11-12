// The React client was originally built against Mongoose/MongoDB responses
// and reads `_id` all over the place. Rather than touch ~20 client files,
// we keep every Prisma record's `id` field but also mirror it as `_id`
// (recursively, including nested relations) so the client keeps working
// unmodified. New client code can use either `id` or `_id`.
export function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serialize(val);
    }
    if (typeof out.id === "string") out._id = out.id;
    return out;
  }
  return value;
}
