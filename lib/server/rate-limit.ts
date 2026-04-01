const attempts = new Map<string, number[]>();

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;

export function checkRateLimit(key: string) {
  const now = Date.now();
  const existing = attempts.get(key) ?? [];
  const recent = existing.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= LIMIT) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);
  return true;
}
