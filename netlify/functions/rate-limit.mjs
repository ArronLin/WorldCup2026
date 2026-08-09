const DAY_SECONDS = 86_400;

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function command(command) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const response = await fetch(`${base.replace(/\/$/, '')}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`rate store HTTP ${response.status}`);
  const payload = await response.json();
  return payload.result;
}

async function increment(key, ttl) {
  const count = await command(['incr', key]);
  if (count === 1) await command(['expire', key, String(ttl)]);
  return count;
}

/**
 * Uses Upstash Redis when configured. A missing/unavailable store intentionally
 * fails open: availability of the public site is preserved and the caller logs
 * a safe operational warning instead of retaining user content.
 */
export async function checkRateLimit(ip, { perIpCap, globalCap }) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { limited: false, durable: false };
  }
  const day = dayKey();
  const safeIp = String(ip || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '_');
  try {
    const [ipCount, globalCount] = await Promise.all([
      increment(`wc2026:chat:ip:${day}:${safeIp}`, DAY_SECONDS),
      increment(`wc2026:chat:global:${day}`, DAY_SECONDS),
    ]);
    if (globalCount > globalCap) return { limited: true, retryAfter: 3600, durable: true };
    if (ipCount > perIpCap) return { limited: true, retryAfter: 3600, durable: true };
    return { limited: false, durable: true };
  } catch (error) {
    console.warn('[chat] rate store unavailable', { message: error?.message || 'unknown' });
    return { limited: false, durable: false };
  }
}
