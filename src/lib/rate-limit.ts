// Limitador de tentativas em memória (por instância). Para múltiplas instâncias, use Redis.
type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function createLimiter(max: number, windowMs: number) {
  return {
    isBlocked(key: string): boolean {
      const e = buckets.get(key);
      if (!e) return false;
      if (Date.now() > e.resetAt) {
        buckets.delete(key);
        return false;
      }
      return e.count >= max;
    },
    hit(key: string) {
      const now = Date.now();
      const e = buckets.get(key);
      if (!e || now > e.resetAt) buckets.set(key, { count: 1, resetAt: now + windowMs });
      else e.count++;
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
      }
    },
    reset(key: string) {
      buckets.delete(key);
    },
  };
}

export const loginLimiter = createLimiter(5, 15 * 60 * 1000);
