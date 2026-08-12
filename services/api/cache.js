let redis = null;
const memoryCache = new Map();

async function initCache() {
  if (process.env.BOTGUARD_MEMORY_MODE === "1" || process.env.REDIS_URL === "memory") {
    return { mode: "memory" };
  }
  try {
    const Redis = require("ioredis");
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
    return { mode: "redis" };
  } catch {
    redis = null;
    return { mode: "memory" };
  }
}

async function getCachedCredential(address) {
  const key = `cred:${address.toLowerCase()}`;
  if (!redis) {
    const hit = memoryCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return { ...hit.value, source: "redis" };
  }
  const raw = await redis.get(key);
  if (!raw) return null;
  return { ...JSON.parse(raw), source: "redis" };
}

async function setCachedCredential(address, value, ttlSeconds = 3) {
  const key = `cred:${address.toLowerCase()}`;
  if (!redis) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return;
  }
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

async function invalidateCredential(address) {
  const key = `cred:${address.toLowerCase()}`;
  if (!redis) {
    memoryCache.delete(key);
    return;
  }
  await redis.del(key);
}

module.exports = {
  initCache,
  getCachedCredential,
  setCachedCredential,
  invalidateCredential,
};
