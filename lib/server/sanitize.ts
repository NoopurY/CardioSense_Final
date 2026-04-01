export function sanitizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim();
}

export function sanitizeArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => sanitizeText(v)).filter(Boolean);
}
