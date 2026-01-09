const Redis = require('ioredis');

const REDIS_URL = process.env.VALKEY_URL || process.env.REDIS_URL || 'redis://localhost:6379';
let redis = null;
let subRedis = null;

if (process.env.REDIS_ENABLED === 'true' || process.env.VALKEY_URL || process.env.REDIS_URL) {
    try {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
        });

        subRedis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
        });

        redis.on('error', (err) => console.error('[Valkey/Redis] Error:', err.message));
        redis.on('connect', () => console.log('[Valkey/Redis] ✅ Connected to host'));
    } catch (err) {
        console.error('[Valkey/Redis] ❌ Could not initialize client:', err.message);
    }
}

/**
 * Shared state helpers. 
 * Falls back to local in-memory if Redis is unavailable.
 */
const valkey = {
    client: redis,
    subClient: subRedis,
    enabled: !!redis,

    // Tube State Management (Hashes)
    async setTubeState(roomId, state) {
        if (!redis) return;
        await redis.hset('tube_states', roomId, JSON.stringify({
            ...state,
            receivedAt: Date.now()
        }));
    },

    async getTubeState(roomId) {
        if (!redis) return null;
        const data = await redis.hget('tube_states', roomId);
        return data ? JSON.parse(data) : null;
    },

    async getAllTubeStates() {
        if (!redis) return new Map();
        const data = await redis.hgetall('tube_states');
        const map = new Map();
        for (const [id, json] of Object.entries(data)) {
            map.set(id, JSON.parse(json));
        }
        return map;
    },

    // Moderation (Sets)
    async addShadowMuted(userId) {
        if (!redis) return;
        await redis.sadd('shadow_muted', userId);
    },

    async isShadowMuted(userId) {
        if (!redis) return false;
        return await redis.sismember('shadow_muted', userId);
    },

    async wipeUserMessages(userId) {
        if (!redis) return;
        await redis.sadd('wiped_users', userId);
        // Auto-expire wipe flag after 24h to keep Redis clean
        await redis.expire(`wiped_user:${userId}`, 86400);
    },

    // IRC Rate Limiting (Strings with expiry)
    async checkIrcLimit(userId) {
        if (!redis) return true;
        const key = `irc_limit:${userId}`;
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, 60); // 1 connection per minute
        return count <= 1;
    }
};

module.exports = valkey;
