// Fixed-window in-memory rate limiter.
export function makeLimiter(max, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return (id) => {
    const t = now();
    const e = hits.get(id);
    if (!e || t - e.start >= windowMs) { hits.set(id, { start: t, n: 1 }); return true; }
    e.n += 1;
    return e.n <= max;
  };
}
