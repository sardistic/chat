const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const IRCBridge = require("./lib/ircBridge");
const { PrismaClient } = require("@prisma/client");
const { RailwayBuildStream } = require("./lib/railwayLogs");
const ytsr = require("ytsr");
const fs = require('fs');
const path = require('path');
const valkey = require("./lib/valkey");
const { createAdapter } = require("@socket.io/redis-adapter");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const prisma = new PrismaClient();

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost"; // Keep simple for Next.js internal use
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active rooms and users
const rooms = new Map(); // roomId -> Set of { socketId, user }
let ircBridge = null; // IRC bridge instance

// IRC Connection Rate Limiter - prevents G-lines from excessive connections
const ircConnectionQueue = [];
const IRC_MAX_CONNECTIONS_PER_WINDOW = 3; // Max new connections
const IRC_RATE_WINDOW_MS = 15000; // Per 15 seconds
let recentIrcConnections = []; // Timestamps of recent connections

const canCreateIrcConnection = () => {
  const now = Date.now();
  // Clean old timestamps
  recentIrcConnections = recentIrcConnections.filter(t => now - t < IRC_RATE_WINDOW_MS);
  return recentIrcConnections.length < IRC_MAX_CONNECTIONS_PER_WINDOW;
};

const recordIrcConnection = () => {
  recentIrcConnections.push(Date.now());
};

const processIrcQueue = () => {
  if (ircConnectionQueue.length === 0) return;
  if (!canCreateIrcConnection()) {
    // Retry in a bit
    setTimeout(processIrcQueue, 2000);
    return;
  }

  const { socket, user, ircConfig, callback } = ircConnectionQueue.shift();
  recordIrcConnection();

  try {
    console.log(`[IRC Queue] Creating connection for ${user.name}`);
    const bridge = new IRCBridge(socket, ircConfig);
    bridge.connect();
    socket.data.ircBridge = bridge;
    if (callback) callback(null, bridge);
  } catch (err) {
    console.error('[IRC Queue] Failed:', err);
    if (callback) callback(err);
  }

  // Process next after a delay
  if (ircConnectionQueue.length > 0) {
    setTimeout(processIrcQueue, 1000);
  }
};

const queueIrcConnection = (socket, user, ircConfig, callback) => {
  ircConnectionQueue.push({ socket, user, ircConfig, callback });
  processIrcQueue();
};

// Store message history per room (limit 200)
let messageHistory = {}; // roomId -> Array

// Bundling Storage
const bundles = new Map(); // roomId -> { type: { id, users, timestamp } }

// Identity Persistence Cache
const lastKnownUsers = new Map(); // socket.id -> { user, roomId }

// Server-Authoritative Tube State (Per Room)
const tubeStates = new Map();

function getTubeState(roomId) {
  if (!tubeStates.has(roomId)) {
    tubeStates.set(roomId, {
      videoId: null,
      isPlaying: false,
      pausedAt: 0,
      playStartedAt: 0,
      title: null,
      thumbnail: null,
      ownerId: null,
      lastUpdate: 0,
      queue: [],
      history: []
    });
  }
  return tubeStates.get(roomId);
}

// Message Reactions Storage: messageId -> { emoji -> Set of userIds }
const messageReactions = new Map();

// === MODERATION STATE ===
// Shadow Muted Users: Set of userIds who are shadow muted (server-wide)
const shadowMutedUsers = new Set();

// Wiped Users: Set of userIds whose messages are hidden from non-admins
const wipedUsers = new Set();

// Cam Banned Users: Map of { oderId: { until: timestamp } }
// 'until: 0' means one-time forced down (can re-enable immediately)
const camBannedUsers = new Map();

// Helper to calculate current video position from server state
function getTubePosition(roomId) {
  const tubeState = getTubeState(roomId);
  if (!tubeState.isPlaying) {
    return tubeState.pausedAt;
  }
  return tubeState.pausedAt + (Date.now() - tubeState.playStartedAt) / 1000;
}

async function persistTubeState(roomId, videoId, title) {
  try {
    await prisma.room.update({
      where: { slug: roomId },
      data: { currentVideoId: videoId || null, currentVideoTitle: title || null }
    });
  } catch (e) {
    // Ignore errors (e.g. room deleted) to strictly avoid crashing socket loop
    console.error('[Tube] Failed to persist state:', e.message);
  }
}

// Helper to extract video ID from URL
function extractVideoId(input) {
  if (!input) return null;
  // Already a video ID (11 chars, alphanumeric + _ -)
  if (/^[\w-]{11}$/.test(input)) return input;

  // URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input; // Return as-is if no match
}

// Helper to fetch video info from YouTube
async function getYouTubeVideoInfo(videoIdOrUrl) {
  try {
    const videoId = extractVideoId(videoIdOrUrl);
    if (!videoId) return { title: 'Unknown', videoId: null };

    // Search for the video by ID
    const results = await ytsr(`https://www.youtube.com/watch?v=${videoId}`, { limit: 1 });
    const video = results.items.find(item => item.type === 'video');

    if (video) {
      return {
        videoId,
        title: video.title,
        author: video.author?.name || '',
        thumbnail: video.bestThumbnail?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: video.duration
      };
    }

    return {
      videoId,
      title: videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  } catch (err) {
    console.error('[YouTube] Failed to fetch video info:', err.message);
    const videoId = extractVideoId(videoIdOrUrl);
    return {
      videoId,
      title: videoId || 'Unknown',
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
    };
  }
}

function getBundle(roomId, type) {
  if (!bundles.has(roomId)) return null;
  const roomBundles = bundles.get(roomId);
  const bundle = roomBundles[type];
  if (!bundle) return null;
  // Check freshness (e.g. 1 hour)
  if (Date.now() - bundle.timestamp > 60 * 60 * 1000) {
    delete roomBundles[type];
    return null;
  }
  return bundle;
}

function setBundle(roomId, type, id, users) {
  if (!bundles.has(roomId)) bundles.set(roomId, {});
  const roomBundles = bundles.get(roomId);
  roomBundles[type] = { id, users, timestamp: Date.now() };
}

// Regex to strip ANSI escape codes from output
const stripAnsi = (str) => str ? str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '') : '';

// AUTOMOD: Basic Word Filter
const BANNED_WORDS = ['badword', 'spam', 'scam']; // Extend this list or load from DB
const filterProfanity = (text) => {
  if (!text) return text;
  let filtered = text;
  BANNED_WORDS.forEach(word => {
    const reg = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(reg, '*'.repeat(word.length));
  });
  return filtered;
};

// Load History from Database on Start
async function loadHistoryFromDB() {
  try {
    // Fetch all known rooms to load their history & tube state
    // Also explicitly include 'general' for legacy support/fallback
    const roomsInDb = await prisma.room.findMany({
      select: {
        slug: true,
        currentVideoId: true,
        currentVideoTitle: true,
        ircChannel: true
      }
    });

    const roomSlugs = new Set(roomsInDb.map(r => r.slug));
    roomSlugs.add('general');

    // Load ALL tube states from Valkey
    let valkeyStates = new Map();
    if (valkey.enabled) {
      valkeyStates = await valkey.getAllTubeStates();
      console.log(`[Startup] Loaded ${valkeyStates.size} tube states from Valkey.`);
    }

    console.log(`📚 Loading history and tube state for ${roomSlugs.size} rooms...`);

    // Pre-populate tube states (Valkey takes precedence over DB)
    roomsInDb.forEach(r => {
      const vState = valkeyStates.get(r.slug);
      if (vState) {
        tubeStates.set(r.slug, vState);
        console.log(`[Startup] Rehydrated tube from Valkey: ${r.slug}`);
      } else if (r.currentVideoId) {
        const state = getTubeState(r.slug);
        state.videoId = r.currentVideoId;
        state.title = r.currentVideoTitle;
        state.isPlaying = false;
        console.log(`[Startup] Rehydrated tube from DB: ${r.currentVideoId} in ${r.slug}`);
      }
    });

    for (const roomId of roomSlugs) {
      // Get the NEWEST 100 messages (order by desc, then reverse for display)
      const messages = await prisma.chatMessage.findMany({
        where: { roomId },
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: { reactions: true }
      });

      // Reverse to get chronological order for display
      messages.reverse();

      messageHistory[roomId] = messages.map(m => {
        // Populate messageReactions in-memory map
        if (m.reactions && m.reactions.length > 0) {
          if (!messageReactions.has(m.id)) {
            messageReactions.set(m.id, new Map());
          }
          const msgReactions = messageReactions.get(m.id);
          m.reactions.forEach(r => {
            if (!msgReactions.has(r.emoji)) {
              msgReactions.set(r.emoji, new Set());
            }
            msgReactions.get(r.emoji).add(r.userId);
          });
        }

        const meta = m.metadata || {};
        return {
          id: m.id,
          roomId: m.roomId,
          sender: m.sender,
          text: m.text,
          type: m.type,
          systemType: m.systemType,
          metadata: m.metadata,
          timestamp: m.timestamp.toISOString(),
          // Restore IRC-specific fields from metadata
          source: meta.source,
          senderColor: meta.senderColor,
          channel: meta.channel
        };
      });

      // RESTORE SERVER STATE FROM HISTORY
      // Prevent duplicate "Now Playing" messages by finding the last one and tracking it
      if (!global._lastTubeMsg) global._lastTubeMsg = {};

      const lastTubeMsg = [...messages].reverse().find(m =>
        m.systemType && m.systemType.startsWith('tube-')
      );

      if (lastTubeMsg) {
        const tubeMsgKey = `tube-${roomId}`;
        global._lastTubeMsg[tubeMsgKey] = lastTubeMsg.id;
        // console.log(`[Tube] Restored last tube message ID for ${roomId}: ${lastTubeMsg.id}`);
      }
    }

    // LOAD SHADOW MUTED USERS from database
    const shadowMutedFromDB = await prisma.user.findMany({
      where: { isShadowMuted: true },
      select: { id: true }
    });
    shadowMutedFromDB.forEach(u => shadowMutedUsers.add(u.id));
    console.log(`🔇 Loaded ${shadowMutedUsers.size} shadow muted users from database.`);

  } catch (err) {
    console.error('Failed to load chat history from DB:', err);
  }
}

// Save message to Database
async function saveMessageToDB(message) {
  try {
    await prisma.chatMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        roomId: message.roomId,
        sender: message.sender,
        text: message.text,
        type: message.type || 'user',
        systemType: message.systemType || null,
        metadata: {
          ...(message.metadata || {}),
          // Preserve IRC-specific fields in metadata
          source: message.source,
          senderColor: message.senderColor,
          channel: message.channel
        },
        timestamp: new Date(message.timestamp)
      },
      update: {
        text: message.text,
        systemType: message.systemType || null,
        metadata: message.metadata || null,
        timestamp: new Date(message.timestamp)
      }
    });
  } catch (err) {
    console.log('[DATABASE] >> Write failed:', err.message);
  }
}

// Log user session (join/leave) to database for analytics
async function logUserSession(socket, action, user, roomId) {
  try {
    // Extract IP from socket headers (Railway/Cloudflare)
    const forwarded = socket.handshake?.headers?.['x-forwarded-for'];
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : socket.handshake?.address;
    const userAgent = socket.handshake?.headers?.['user-agent'];

    await prisma.userSession.create({
      data: {
        userId: user?.id || null,
        displayName: user?.name || 'Unknown',
        discordId: user?.discordId || null,
        roomId: roomId,
        action: action, // 'join' or 'leave'
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        socketId: socket.id,
        metadata: {
          isGuest: user?.isGuest || false,
          role: user?.role || 'USER',
          avatarUrl: user?.avatarUrl || user?.image
        }
      }
    });
    console.log(`[Session] Logged ${action} for ${user?.name || 'Unknown'} in ${roomId} (IP: ${ipAddress?.substring(0, 16) || 'unknown'})`);
  } catch (err) {
    console.error('[Session] Failed to log:', err.message);
  }
}


// Helper to store messages (in-memory + DB)
const storeMessage = (roomId, message) => {
  if (!messageHistory[roomId]) {
    messageHistory[roomId] = [];
  }

  // Check for existing message with same ID
  const existingIdx = messageHistory[roomId].findIndex(m => m.id === message.id);

  if (existingIdx !== -1) {
    // Update existing message
    messageHistory[roomId][existingIdx] = message;
  } else {
    // Add new message
    messageHistory[roomId].push(message);
  }

  // Limit in-memory to last 100 messages
  if (messageHistory[roomId].length > 100) {
    while (messageHistory[roomId].length > 100) {
      messageHistory[roomId].shift();
    }
  }

  // Async save to DB (don't block)
  saveMessageToDB(message);
};

// Backfill build logs on startup
async function checkAndBackfillLogs(io) {
  const deploymentId = process.env.RAILWAY_DEPLOYMENT_ID;
  const apiToken = process.env.RAILWAY_API_TOKEN;

  if (!deploymentId || !apiToken) {
    console.log('[Backfill] Skipping: No Deployment ID or API Token');
    return;
  }

  console.log(`[Backfill] Checking logs for deployment: ${deploymentId}`);

  try {
    // 1. Find existing Deployment Message
    const recentMessages = await prisma.chatMessage.findMany({
      where: { roomId: 'general', systemType: { in: ['deploy-start', 'deploy-success', 'deploy-fail'] } },
      take: 20,
      orderBy: { timestamp: 'desc' }
    });

    // Find matching deployment ID (manual filter for safety)
    let deploymentMsg = recentMessages.find(m => m.metadata?.deploymentId === deploymentId);

    if (!deploymentMsg) {
      console.log('[Backfill] Parent deployment message not found. Skipping.');
      return;
    }

    // 2. Fetch remote logs
    const stream = new RailwayBuildStream(apiToken);
    const logs = await stream.fetchBuildLogs(deploymentId);

    if (!logs || logs.length === 0) return;

    const existingLogsSet = new Set(deploymentMsg.metadata?.logs || []);
    const newLogs = [];

    // Filter duplicates
    for (const log of logs) {
      // Keep indentation, don't strip ANSI
      const line = (log.message || '').trimEnd();
      if (!line.trim() || existingLogsSet.has(line)) continue;

      newLogs.push(line);
      existingLogsSet.add(line);
    }

    if (newLogs.length > 0) {
      // Update message
      const currentLogs = Array.isArray(deploymentMsg.metadata?.logs) ? deploymentMsg.metadata.logs : [];
      const updatedMetadata = { ...deploymentMsg.metadata, logs: [...currentLogs, ...newLogs] };

      // Update DB
      await prisma.chatMessage.update({
        where: { id: deploymentMsg.id },
        data: { metadata: updatedMetadata }
      });

      // Broadcast Update
      const updatedMsg = {
        ...deploymentMsg,
        metadata: updatedMetadata,
        timestamp: new Date(deploymentMsg.timestamp).toISOString()
      };

      // Update Memory
      if (typeof messageHistory !== 'undefined' && messageHistory['general']) {
        const idx = messageHistory['general'].findIndex(m => m.id === deploymentMsg.id);
        if (idx !== -1) messageHistory['general'][idx] = updatedMsg;
      }

      if (io) io.to('general').emit('chat-message-update', updatedMsg);

      console.log(`[Backfill] Appended ${newLogs.length} logs to message ${deploymentMsg.id}`);
    } else {
      console.log('[Backfill] Logs up to date.');
    }

  } catch (err) {
    console.error('[Backfill] Error:', err);
  }
}

// Tube Sync State is now defined globally at the top of the file

app.prepare().then(async () => {
  // Load chat history from database
  await loadHistoryFromDB();

  const httpServer = createServer((req, res) => {
    // --- Parse incoming URL ---
    const parsedUrl = parse(req.url, true);

    // --- DEPLOYMENT WEBHOOK HANDLER ---
    if (parsedUrl.pathname === '/api/webhooks/deploy' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          // 1. Verify Secret
          // Check Query Param first (Reliable), then Headers
          const querySecret = parsedUrl.query.secret;
          const headerSecret = req.headers['authorization'] || req.headers['x-deployment-secret'];
          const signature = querySecret || headerSecret;
          const expectedSecret = process.env.DEPLOY_WEBHOOK_SECRET;

          // Cinematic-style logging (sanitized)
          console.log('[WEBHOOK] >> Incoming signal detected');
          console.log('[WEBHOOK] >> Auth verification:', signature === expectedSecret ? 'AUTHORIZED' : 'CHECKING...');

          if (!expectedSecret || signature !== expectedSecret) {
            console.log('[WEBHOOK] >> ACCESS DENIED');
            // TEMPORARY: Allow if Env Var is missing (first deploy race condition)
            if (!expectedSecret) {
              console.log('[WEBHOOK] >> Override: Security key pending initialization');
            } else {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
          }

          const payload = JSON.parse(body);
          // Sanitized logging - only log type and safe identifiers
          const safeType = payload.type || payload.action || 'unknown';
          console.log(`[WEBHOOK] >> Signal type: ${safeType}`);

          let systemMessage = null;
          let metadata = {};
          // --- Railway Deployment ---
          const type = payload.type;
          let systemType = 'info';

          // Extract commit info from Railway payload (if available)
          const details = payload.details || {};
          const commitHash = details.commitHash?.substring(0, 7) || payload.deployment?.meta?.commit?.id?.substring(0, 7);
          const commitMessage = details.message || payload.deployment?.meta?.commit?.message;
          const commitAuthor = details.author || payload.deployment?.meta?.commit?.author?.name;
          const serviceName = details.serviceName || payload.project?.name || 'Chat';


          if (type && (type.startsWith('Deployment') || type.startsWith('Build'))) {
            // Extract deployment ID for log streaming
            const deploymentId = details.id || payload.resource?.deployment?.id || details.deploymentId || payload.deployment?.id;

            metadata = { commitHash, commitMessage, commitAuthor, serviceName, deploymentId };

            // Build Events - Streams real-time logs via Railway GraphQL API
            if (type === 'Build.building' || type === 'Deployment.building') {
              let text = `**Building** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              if (commitAuthor) text += ` by ${commitAuthor}`;
              systemMessage = text;
              systemType = 'deploy-start';

              // Start streaming build logs if we have a deployment ID and API token
              console.log(`[Railway] Stream attempt - DeployID: ${deploymentId}, Token: ${!!process.env.RAILWAY_API_TOKEN}`);

              if (deploymentId && process.env.RAILWAY_API_TOKEN && io) {
                let logBuffer = [];
                let lastEmit = 0;
                const THROTTLE_MS = 200; // Emit batch faster (200ms)

                const flushLogs = () => {
                  if (logBuffer.length === 0) return;

                  // Keep ANSI codes for frontend rendering
                  const lines = logBuffer
                    .filter(l => l && l.trim().length > 0);

                  logBuffer = [];

                  if (lines.length === 0) return;

                  // Find the active deployment message
                  let msgId = activeDeployments.get(deploymentId);

                  if (msgId) {
                    const history = messageHistory['general'];
                    const idx = history?.findIndex(m => m.id === msgId);

                    if (idx !== -1) {
                      const msg = history[idx];
                      const newLogs = [...(msg.metadata?.logs || []), ...lines];

                      // Detect build phase from logs (Strip ANSI for check)
                      const cleanLogs = stripAnsi(lines.join('\n').toLowerCase());
                      let phase = msg.metadata?.phase;

                      if (cleanLogs.includes('npm install') || cleanLogs.includes('yarn install')) phase = 'INSTALLING DEPENDENCIES';
                      else if (cleanLogs.includes('build') || cleanLogs.includes('completing build')) phase = 'BUILDING';
                      else if (cleanLogs.includes('docker-image') || cleanLogs.includes('exporting')) phase = 'PACKAGING CONTAINER';
                      else if (cleanLogs.includes('npm run start') || cleanLogs.includes('starting')) phase = 'STARTING APP';
                      else if (cleanLogs.includes('upload')) phase = 'UPLOADING';
                      const updatedMsg = {
                        ...msg,
                        metadata: { ...msg.metadata, logs: newLogs, phase: phase || msg.metadata?.phase }
                      };

                      history[idx] = updatedMsg;
                      saveMessageToDB(updatedMsg);
                      io.to('general').emit('chat-message-update', updatedMsg);
                    }
                  }
                };

                const buildStream = new RailwayBuildStream(
                  process.env.RAILWAY_API_TOKEN,
                  // onLog callback - buffer and throttle
                  (message, severity) => {
                    console.log(`[Railway] Log received: ${message?.substring(0, 50)}...`); // DEBUG
                    const trimmed = message?.trim();
                    if (!trimmed || trimmed.length < 3) return;

                    // Add to buffer
                    logBuffer.push(trimmed);

                    // Throttle emissions
                    const now = Date.now();
                    if (now - lastEmit >= THROTTLE_MS) {
                      lastEmit = now;
                      flushLogs();
                    }
                  },
                  // onComplete callback
                  () => {
                    flushLogs(); // Final flush
                    console.log('[Railway] Build log stream completed');
                  },
                  // onError callback
                  (err) => {
                    console.error('[Railway] Build log stream error:', err);
                    if (err.errors) console.error('[Railway] GraphQL Errors:', JSON.stringify(err.errors, null, 2));
                  }
                );

                // Connect and subscribe
                buildStream.connect().then(connected => {
                  if (connected) {
                    console.log(`[Railway] Connected. Subscribing to Build and Deploy logs for ${deploymentId}`);
                    // Subscribe to BOTH to ensure we catch output (build logs might be skipped if cached)
                    buildStream.subscribeToBuildLogs(deploymentId);
                    buildStream.subscribeToDeployLogs(deploymentId);

                    // Auto-cleanup after 10 minutes max
                    setTimeout(() => {
                      flushLogs();
                      buildStream.disconnect();
                    }, 10 * 60 * 1000);
                  }
                });
              }
            }
            // Success Events
            else if (type === 'Deployment.success') {
              let text = `**Deployed** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              if (commitHash) text += ` \`${commitHash}\``;
              text += ' — Refresh for updates!';
              systemMessage = text;
              systemType = 'deploy-success';
            }
            // Failure Events
            else if (type === 'Build.failed' || type === 'Deployment.failed' || type === 'Deployment.crashed') {
              let text = `**Deploy Failed** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              systemMessage = text;
              systemType = 'deploy-fail';
            }
          }
          // --- GitHub Deployment Status (sent by Railway via GitHub) ---
          else if (payload.deployment_status && payload.action === 'created') {
            const status = payload.deployment_status;
            const state = status.state; // 'success', 'failure', 'in_progress', 'pending'
            const environment = status.environment || payload.deployment?.environment || 'production';
            const targetUrl = status.target_url || '';
            const deploymentId = payload.deployment?.id?.toString();

            console.log(`[Webhook] GitHub Deployment Status: ${state} for ${environment}`);

            if (state === 'success') {
              let text = `**Deployed** *${environment}*`;
              text += ' — Refresh for updates!';
              systemMessage = text;
              systemType = 'deploy-success';
              metadata = { deploymentId, environment, targetUrl };
            } else if (state === 'failure' || state === 'error') {
              let text = `**Deploy Failed** *${environment}*`;
              systemMessage = text;
              systemType = 'deploy-fail';
              metadata = { deploymentId, environment, targetUrl };
            }
            // 'in_progress' and 'pending' are ignored (we use Railway's deploy-start instead)
          }
          // --- GitHub Push ---
          else if (payload.pusher) {
            const pusher = payload.pusher.name;
            const commitMsg = payload.head_commit?.message?.split('\n')[0] || 'No commit message'; // First line only
            const commitUrl = payload.head_commit?.url || '#';
            const shortHash = payload.head_commit?.id?.substring(0, 7) || '???';
            const branch = payload.ref?.replace('refs/heads/', '') || 'main';
            const totalCommits = payload.commits?.length || 1;

            // Deduplicate: Check if we already processed this exact commit recently
            const pushKey = `${shortHash}-${branch}`;
            const recentPushes = global._recentPushes || new Map();
            const now = Date.now();

            // Clean old entries (older than 2 minutes)
            for (const [key, time] of recentPushes) {
              if (now - time > 120000) recentPushes.delete(key);
            }

            if (recentPushes.has(pushKey)) {
              console.log(`[Webhook] Duplicate git-push detected for ${pushKey}, ignoring.`);
            } else {
              recentPushes.set(pushKey, now);
              global._recentPushes = recentPushes;

              let text = `**${pusher}** pushed ${totalCommits > 1 ? `${totalCommits} commits` : ''} to \`${branch}\``;
              text += `: "${commitMsg}" [\`${shortHash}\`](${commitUrl})`;
              systemMessage = text;
              systemType = 'git-push';
              metadata = { pusher, commitMsg, branch, commitUrl, shortHash, totalCommits };

              // Cinematic Code Update: Fetch Diff
              try {
                const { stdout } = await exec(`git show ${shortHash} --no-color`);
                if (stdout) {
                  const lines = stdout.split('\n');
                  // Limit to 150 lines for UX
                  const diffLines = lines.slice(0, 150);
                  if (lines.length > 150) diffLines.push(`... and ${lines.length - 150} more lines`);
                  metadata.logs = diffLines;
                }
              } catch (e) {
                console.log('[Git Diff] Failed to fetch:', e.message);
              }
            }
          }
          // --- Generic Text Fallback ---
          else if (type && type.startsWith('VolumeAlert')) {
            // Enable for testing connectivity - TEMPORARILY
            // systemMessage = `📢 **Test Notification**: Volume Alert (${payload.severity || 'test'})`; 
            // systemType = 'info';
          }
          else if (payload.message) {
            systemMessage = `**System**: ${payload.message}`;
            systemType = 'info';
          }

          // 2. Broadcast to Chat
          if (systemMessage) {
            // Broadcast to all active rooms + general
            const targetRooms = new Set(rooms.keys());
            targetRooms.add('general');

            for (const roomId of targetRooms) {
              // Ensure unique ID per room for DB constraints
              let msgId = `sys-${Date.now()}-${roomId}`;

              let isUpdate = false;
              let existingStartMsg = null;
              const compositeKey = metadata?.deploymentId ? `${metadata.deploymentId}:${roomId}` : null;

              // Attempt to find existing "Deploying" message to update
              if (systemType === 'deploy-success' || systemType === 'deploy-fail') {
                // 1. Try Map lookup
                if (compositeKey && activeDeployments.has(compositeKey)) {
                  msgId = activeDeployments.get(compositeKey);
                  existingStartMsg = messageHistory[roomId]?.find(m => m.id === msgId);
                  isUpdate = !!existingStartMsg;
                }
                // 2. Fallback to heuristic
                if (!isUpdate && messageHistory[roomId]) {
                  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
                  existingStartMsg = messageHistory[roomId]
                    .slice()
                    .reverse()
                    .find(m =>
                      m.systemType === 'deploy-start' &&
                      new Date(m.timestamp).getTime() > thirtyMinutesAgo
                    );
                  if (existingStartMsg) {
                    msgId = existingStartMsg.id;
                    isUpdate = true;
                  }
                }
              }

              // Preserve logs if updating
              let existingLogs = [];
              if (isUpdate && existingStartMsg?.metadata?.logs) {
                existingLogs = existingStartMsg.metadata.logs;
              } else if (!isUpdate && (!existingLogs || existingLogs.length === 0) && (metadata.commitMsg || metadata.shortHash)) {
                existingLogs = [
                  `> Initializing deployment...`,
                  `> Commit: ${metadata.shortHash || 'Unknown'}`,
                  `> Subject: ${metadata.commitMsg || 'No message'}`
                ];
              }

              const msg = {
                roomId,
                id: msgId,
                sender: 'System',
                text: systemMessage,
                type: 'system',
                systemType: systemType,
                metadata: { ...metadata, logs: existingLogs },
                timestamp: new Date().toISOString()
              };

              // Clean up phase on success/fail
              if (systemType === 'deploy-success') msg.metadata.phase = null;
              if (systemType === 'deploy-fail') msg.metadata.phase = 'FAILED';

              // Track active deployment message
              if (systemType === 'deploy-start' && compositeKey) {
                activeDeployments.set(compositeKey, msgId);
              }

              if (isUpdate) {
                // Update in history
                const history = messageHistory[roomId];
                if (history) {
                  const idx = history.findIndex(m => m.id === msgId);
                  if (idx !== -1) {
                    history[idx] = { ...history[idx], ...msg };
                  }
                }
                // Use saveMessageToDB (Upsert/Update logic) if it exists, or re-use storeMessage for insert-only?
                // Assuming saveMessageToDB handles updates based on ID
                if (typeof saveMessageToDB === 'function') {
                  saveMessageToDB(msg);
                } else {
                  // Fallback: This might fail if ID exists
                  console.warn('saveMessageToDB not defined, skipping DB update');
                }

                io.to(roomId).emit('chat-message-update', msg);
                // console.log(`[Webhook] 🔄 Updated message ${msgId} in ${roomId}`);
              } else {
                storeMessage(roomId, msg);
                io.to(roomId).emit('chat-message', msg);
                // console.log(`[Webhook] 📢 Broadcasted to ${roomId}`);
              }
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));

        } catch (err) {
          console.error('[Webhook] ❌ Error processing:', err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Payload' }));
        }
      });
      return;
    }

    // --- SOCKET ADMIN API (Internal) ---
    // Allows Next.js API to trigger socket actions (Kick/Ban enforcement)
    // This must be protected or only callable from localhost
    if (parsedUrl.pathname === '/api/admin/socket-kick' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          // Simple local auth check or shared secret
          if (req.headers['x-admin-secret'] !== process.env.NEXTAUTH_SECRET) {
            // Allow development bypass if needed, but strictly enforce in prod
            if (process.env.NODE_ENV === 'production') {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
          }

          const { userId, reason, ban } = JSON.parse(body);
          if (!userId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing userId' }));
            return;
          }

          console.log(`[SocketAdmin] Force disconnecting user ${userId} (Reason: ${reason})`);

          let kickCount = 0;
          io.sockets.sockets.forEach((socket) => {
            if (socket.data.user && socket.data.user.id === userId) {
              // Notify client
              socket.emit('force-disconnect', { reason, ban });
              // Force disconnect
              socket.disconnect(true);
              kickCount++;
            }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, kicked: kickCount }));

        } catch (e) {
          console.error('[SocketAdmin] Error:', e);
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Default Next.js Handler
    handle(req, res, parsedUrl);
  });

  // --- Stats Tracking Logic ---
  const updateStats = async () => {
    // Collect active users based on room presence
    const activeUserIds = new Set();
    const videoUserIds = new Set();

    rooms.forEach((room) => {
      room.forEach((user) => {
        if (user.id) {
          activeUserIds.add(user.id);
          if (user.isVideoEnabled) {
            videoUserIds.add(user.id);
          }
        }
      });
    });

    if (activeUserIds.size === 0) return;

    try {
      // Award 1 point per minute for being online
      await prisma.userStats.updateMany({
        where: { userId: { in: Array.from(activeUserIds) } },
        data: {
          timeOnSiteSeconds: { increment: 60 },
          chatPoints: { increment: 1 }
        }
      });

      // Award additional 2 points per minute for broadcasting (total 3)
      if (videoUserIds.size > 0) {
        await prisma.userStats.updateMany({
          where: { userId: { in: Array.from(videoUserIds) } },
          data: {
            camTimeSeconds: { increment: 60 },
            chatPoints: { increment: 2 }
          }
        });
      }

      // Ensure stats exist for active users who might not have them
      for (const userId of activeUserIds) {
        await prisma.userStats.upsert({
          where: { userId },
          create: { userId, timeOnSiteSeconds: 60, chatPoints: 1 },
          update: {} // Handled by updateMany above generally, but upsert ensures row creation
        });
      }
    } catch (e) {
      console.error("[Stats] Error updating stats:", e.message);
    }
  };

  // Run stats update every 60 seconds
  setInterval(updateStats, 60000);

  // --- Smart Bundling State ---
  // Store active bundles: { roomId: { join: { id, timestamp, users: [] }, cam: { ... } } }
  const messageBundles = new Map();
  // Store active deployment messages: { deploymentId: messageId }
  const activeDeployments = new Map();

  // Rehydrate active deployments from DB (Post-Server Restart)
  const rehydrateDeployments = async () => {
    try {
      const recent = await prisma.chatMessage.findMany({
        where: {
          systemType: 'deploy-start',
          timestamp: { gt: new Date(Date.now() - 30 * 60 * 1000) }
        },
        take: 5
      });
      for (const msg of recent) {
        if (msg.systemType === 'deploy-start' && msg.metadata?.deploymentId) {
          activeDeployments.set(`${msg.metadata.deploymentId}:${msg.roomId}`, msg.id);
          console.log(`[Startup] Rehydrated active deployment: ${msg.metadata.deploymentId} in ${msg.roomId}`);
        }
      }
    } catch (e) {
      console.log('[Startup] Failed to rehydrate deployments:', e.message);
    }
  };
  await rehydrateDeployments();

  const getBundle = (roomId, type) => {
    if (!messageBundles.has(roomId)) messageBundles.set(roomId, {});
    const roomBundles = messageBundles.get(roomId);

    const bundle = roomBundles[type];
    if (bundle) {
      const now = Date.now();
      if (now - bundle.timestamp < 900000) { // 15 minute window
        return bundle;
      }
      // Expired
      delete roomBundles[type];
    }
    return null;
  };

  const setBundle = (roomId, type, id, users) => {
    if (!messageBundles.has(roomId)) messageBundles.set(roomId, {});
    messageBundles.get(roomId)[type] = {
      id,
      timestamp: Date.now(),
      users // Array of user objects
    };
  };

  const io = new Server(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // --- VALKEY / REDIS ADAPTER ---
  if (valkey.enabled) {
    console.log('[Socket.IO] 🔄 Using Redis Adapter for horizontal scaling');
    io.adapter(createAdapter(valkey.client, valkey.subClient));
  }

  // --- Backfill Build Logs (if missed during restart) ---
  checkAndBackfillLogs(io);

  // --- HistoryBot: Single IRC connection that logs all messages to DB ---
  // Dynamically joins channels as rooms become active
  const historyBot = new IRCBridge(null, {
    nick: 'ChatLogBot',
    username: 'chatlogbot',
    channel: '#camrooms-general',
    isBot: true
  }, {
    io: io,
    onRegistered: async () => {
      console.log('[IRC] HistoryBot registered. Joining all rooms...');
      try {
        const allRooms = await prisma.room.findMany({ select: { slug: true, ircChannel: true } });
        allRooms.forEach(r => {
          const channel = r.ircChannel || `#camrooms-${r.slug}`;
          console.log(`[Startup] HistoryBot joining ${channel} for ${r.slug}`);
          historyBot.joinChannel(channel, r.slug);
        });
      } catch (e) {
        console.error('[Startup] Failed to join rooms:', e.message);
      }
    },
    onMessage: (message) => {
      // Persist IRC messages to database
      storeMessage(message.roomId, message);
    },
    shouldIgnoreSender: (senderNick, ircChannel) => {
      // Ignore messages from the bot itself
      if (senderNick === 'ChatLogBot' || senderNick.startsWith('ChatLogBot')) return true;

      // Find which room this channel belongs to
      const roomId = historyBot.getRoomId(ircChannel);
      const room = rooms.get(roomId);
      if (!room) return false;

      const normalizedSender = senderNick.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check against connected web users in that specific room
      for (const [socketId, user] of room) {
        if (!user.name) continue;
        const normalizedUser = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Match exact, or if IRC nick is "User_" when web is "User" (collision handling)
        if (normalizedSender === normalizedUser ||
          (normalizedSender.startsWith(normalizedUser) && normalizedSender.length <= normalizedUser.length + 3)) {
          return true;
        }
      }
      return false;
    }
  });
  historyBot.connect();

  // --- Server-Authoritative Tube Sync Interval (Per Room) ---
  // Broadcasts sync updates every 2 seconds when video is playing
  setInterval(async () => {
    // Optional: Load tube states from Valkey if we're not the "owner" process?
    // For now, we trust the local map but keep it synced.

    for (const [roomId, tubeState] of tubeStates.entries()) {
      if (tubeState.videoId && tubeState.isPlaying) {
        // Broadcast sync to everyone (Adapter handles cross-instance)
        io.to(roomId).emit('tube-sync', {
          videoId: tubeState.videoId,
          isPlaying: tubeState.isPlaying,
          currentPosition: getTubePosition(roomId),
          serverTime: Date.now()
        });

        // Periodic sync to Valkey for rehydration on restart
        if (valkey.enabled && Math.random() < 0.2) { // Throttle Valkey writes
          valkey.setTubeState(roomId, {
            ...tubeState,
            playbackPosition: getTubePosition(roomId)
          });
        }
      }
    }
  }, 2000);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send current IRC userlist if HistoryBot is active
    if (historyBot && historyBot.isConnected) {
      const users = Array.from(historyBot.userList.values());
      socket.emit('irc-userlist', {
        channel: historyBot.currentChannel,
        users
      });
    }

    // Explicit History Request (Fix for Room Switch / Reload)
    socket.on('get-history', ({ roomId }) => {
      console.log(`📜 [History] Manual request for ${roomId} from ${socket.id}`);
      if (!roomId) return;

      const rawHistory = messageHistory[roomId] || [];
      const isUserMod = socket.data.user && ['ADMIN', 'MODERATOR', 'OWNER'].includes(socket.data.user.role);

      const filteredHistory = rawHistory.filter(msg => {
        if (msg.isWiped && !isUserMod) return false;
        return true;
      });

      const historyWithReactions = filteredHistory.map(msg => {
        const reactionsMap = messageReactions.get(msg.id);
        let reactions = {};
        if (reactionsMap) {
          for (const [emoji, users] of reactionsMap.entries()) {
            reactions[emoji] = {
              count: users.size,
              users: Array.from(users),
              hasReacted: socket.data.user ? users.has(socket.data.user.id) : false
            };
          }
        }
        return { ...msg, reactions };
      });

      socket.emit("chat-history", historyWithReactions);
    });

    // Handle room joining (Unified)
    socket.on('join-room', async ({ roomId, user, ircConfig }) => {
      console.log(`👤 User ${user.name} (${socket.id}) joining room ${roomId}`);

      socket.join(roomId);

      // Store user data on socket
      if (!user.role) user.role = 'USER'; // Robustness: Ensure role exists
      socket.data.user = user;
      socket.data.roomId = roomId;
      lastKnownUsers.set(socket.id, { user, roomId });

      // Initialize room logic
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      if (!messageHistory[roomId]) {
        messageHistory[roomId] = [];
      }

      // Standardize IRC channel for this room
      let targetIrcChannel = ircConfig?.channel;

      // Force standardization if not explicitly provided or if it's the old hardcoded one
      if (!targetIrcChannel || targetIrcChannel === '#camsrooms') {
        const slug = roomId.toLowerCase().replace(/[^a-z0-9]/g, '-');
        targetIrcChannel = `#camrooms-${slug}`;
      }

      // Store on socket for the bridge creation later in this flow
      socket.data.targetIrcChannel = targetIrcChannel;

      if (historyBot && historyBot.isConnected) {
        console.log(`[IRC] HistoryBot joining ${targetIrcChannel} for room ${roomId}`);
        historyBot.joinChannel(targetIrcChannel, roomId);
      }

      const room = rooms.get(roomId);

      // Notify existing users
      const existingUsers = Array.from(room.entries()).map(([socketId, userData]) => ({
        socketId,
        user: userData
      }));

      // Add user to room map
      room.set(socket.id, user);

      // Log session for analytics
      logUserSession(socket, 'join', user, roomId);

      // Send initial data to joining user
      socket.emit("existing-users", { users: existingUsers });

      // Prepare history with reactions, filtering wiped messages for non-mods
      const rawHistory = messageHistory[roomId] || [];
      const isModUser = ['ADMIN', 'MODERATOR', 'OWNER'].includes(user.role);

      const filteredHistory = await Promise.all(rawHistory.map(async (msg) => {
        // Show all messages to mods, hide wiped for regular users
        if (msg.isWiped && !isModUser) return null;

        // Also hide messages from shadow-muted users for regular users
        if (!isModUser && msg.senderId) {
          const muted = await valkey.isShadowMuted(msg.senderId);
          if (muted) return null;
        }

        return msg;
      }));

      const cleanHistory = filteredHistory.filter(Boolean);

      const historyWithReactions = cleanHistory.map(msg => {
        const reactionsMap = messageReactions.get(msg.id);
        let reactions = {};
        if (reactionsMap) {
          for (const [emoji, users] of reactionsMap.entries()) {
            reactions[emoji] = {
              count: users.size,
              users: Array.from(users),
              hasReacted: users.has(user.id)
            };
          }
        }
        return { ...msg, reactions };
      });
      socket.emit("chat-history", historyWithReactions);

      // Notify others
      socket.to(roomId).emit("user-joined", { socketId: socket.id, user });
      socket.to(roomId).emit("user-connected", { socketId: socket.id, user }); // Keep compatibility

      // System Message: Join
      // System Message: Join (Smart Bundling)
      // System Message: Join (Smart Bundling)
      let activeBundle = getBundle(roomId, 'join');

      // Attempt rehydration from history (Fix for server restarts/refresh creating duplicates)
      if (!activeBundle && messageHistory[roomId] && messageHistory[roomId].length > 0) {
        const lastMsg = messageHistory[roomId][messageHistory[roomId].length - 1];
        if (lastMsg.systemType === 'join-leave') {
          const logTime = new Date(lastMsg.timestamp).getTime();
          if (Date.now() - logTime < 120000) { // 2 minute window for rehydration
            console.log(`[SmartBundle] Rehydrating join bundle ${lastMsg.id} from history`);
            const rawUsers = lastMsg.metadata?.users || [];
            // Deduplicate rehydrated users by name just in case
            const cleanUsers = [];
            const seenNames = new Set();
            rawUsers.forEach(u => {
              if (u && u.name && !seenNames.has(u.name)) {
                cleanUsers.push(u);
                seenNames.add(u.name);
              }
            });
            setBundle(roomId, 'join', lastMsg.id, cleanUsers);
            activeBundle = getBundle(roomId, 'join');
          }
        }
      }
      let joinMsgId;
      const userMeta = { ...user, action: 'joined', timestamp: Date.now() };

      if (activeBundle) {
        joinMsgId = activeBundle.id;
        // Strictly deduplicate by name or ID, and update latest info (avatar/role)
        const existingIdx = activeBundle.users.findIndex(u => (u.id && u.id === user.id) || u.name === user.name);

        if (existingIdx !== -1) {
          // Update existing entry with freshest info
          activeBundle.users[existingIdx] = { ...activeBundle.users[existingIdx], ...userMeta };
        } else {
          activeBundle.users.push(userMeta);
        }

        const total = activeBundle.users.length;
        const activeCount = activeBundle.users.filter(u => u.action === 'joined').length;

        const updateMsg = {
          id: joinMsgId,
          roomId,
          sender: 'System',
          text: total === 1 && activeCount === 1
            ? `${activeBundle.users[0].name} popped in!`
            : `${total} Users visited (${activeCount} active)`,
          type: 'system',
          systemType: 'join-leave',
          metadata: { users: [...activeBundle.users] },
          timestamp: new Date().toISOString()
        };

        if (messageHistory[roomId]) {
          const idx = messageHistory[roomId].findIndex(m => m.id === joinMsgId);
          if (idx !== -1) {
            messageHistory[roomId][idx] = updateMsg;
          }
        }
        saveMessageToDB(updateMsg);
        io.to(roomId).emit('chat-message-update', updateMsg);
      } else {
        // Check if user already joined recently (prevent duplicate "popped in" on refresh)
        // If there's an active bundle, we might want to just update it even if it's "expired" for new users?
        // Better: Check if THIS user is already in the last join message if it's recent enough to be relevant.
        // Actually, just expanding the bundle logic is safer.

        joinMsgId = `sys-${Date.now()}`;
        const users = [userMeta];
        const joinMsg = {
          roomId,
          id: joinMsgId,
          sender: 'System',
          text: `${user.name || user.displayName || 'A user'} popped in!`,
          type: 'system',
          systemType: 'join-leave',
          metadata: { users },
          timestamp: new Date().toISOString()
        };
        setBundle(roomId, 'join', joinMsgId, users);
        storeMessage(roomId, joinMsg);
        io.to(roomId).emit('chat-message', joinMsg);
      }

      socket.data.joinMsgId = joinMsgId;

      // Create per-user IRC connection via rate-limited queue
      // Each user gets their own IRC connection like KiwiIRC/Twitch
      const derivedNick = user.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 15);

      // Update user with their IRC nick for filtering duplicates
      user.ircNick = derivedNick;
      room.set(socket.id, user); // Update room with new field

      const userIrcConfig = {
        nick: derivedNick,
        username: 'camrooms_' + (user.name || 'user').slice(0, 8).replace(/[^a-zA-Z0-9]/g, ''),
        channel: socket.data.targetIrcChannel || targetIrcChannel,
        useIRC: true
      };

      const bridgeOptions = {
        shouldIgnoreSender: (senderNick) => {
          // Ignore messages from anyone currently connected to this room via Web
          const r = rooms.get(roomId);
          if (!r) return false;
          for (const u of r.values()) {
            if (u.ircNick && u.ircNick.toLowerCase() === senderNick.toLowerCase()) return true;
          }
          return false;
        }
      };

      // Create per-user IRC bridge
      queueIrcConnection(socket, user, userIrcConfig, (err, bridge) => {
        if (err) {
          console.error(`[IRC] Failed to create bridge for ${user.name}:`, err);
        } else {
          console.log(`[IRC] ✅ Bridge created for ${user.name} in ${targetIrcChannel}`);
        }
      }, bridgeOptions);

      console.log(`✅ ${user.name} joined room ${roomId}. Total users: ${room.size}`);

      // Update room member count in database
      try {
        await prisma.room.update({
          where: { slug: roomId },
          data: {
            memberCount: room.size,
            lastActive: new Date()
          }
        });
      } catch (e) {
        // Room might not exist in DB (e.g., old "default-room"), ignore
        console.log(`[Room] Could not update member count for ${roomId}:`, e.message);
      }
    });

    // Request streams from broadcasters (new user wants to receive existing broadcasts)
    socket.on("request-streams", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Find all users who are currently broadcasting video
      const broadcasters = [];
      room.forEach((userData, socketId) => {
        if (socketId !== socket.id && userData.isVideoEnabled) {
          broadcasters.push(socketId);
        }
      });

      if (broadcasters.length > 0) {
        console.log(`📡 ${socket.id} requesting streams from ${broadcasters.length} broadcasters`);
        // Tell each broadcaster to initiate a peer connection to the new user
        broadcasters.forEach(broadcasterId => {
          io.to(broadcasterId).emit("connect-to-peer", { peerId: socket.id });
        });
      }
    });

    // Handle Leave
    socket.on("leave-room", async (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);

      const room = rooms.get(roomId);
      // Get username from room map first, then socket.data as fallback
      const fallback = lastKnownUsers.get(socket.id);
      let userName = socket.data.user?.name || fallback?.user?.name || 'Someone';
      if (room) {
        const u = room.get(socket.id);
        if (u?.name) userName = u.name;

        // Log session for analytics (before deletion)
        logUserSession(socket, 'leave', socket.data.user || { name: userName }, roomId);

        room.delete(socket.id);

        // Update room member count in database
        try {
          await prisma.room.update({
            where: { slug: roomId },
            data: { memberCount: room.size }
          });
        } catch (e) {
          // Room might not exist in DB, ignore
        }

        if (room.size === 0) rooms.delete(roomId);
      }

      socket.to(roomId).emit("user-left", { socketId: socket.id });
      socket.to(roomId).emit("user-disconnected", socket.id);

      // System Message: Leave
      // System Message: Leave (Smart Bundling)
      const activeBundle = getBundle(roomId, 'leave');
      let leaveMsgId;
      const userMeta = { name: userName, action: 'left', timestamp: Date.now() };

      if (activeBundle) {
        leaveMsgId = activeBundle.id;
        activeBundle.users.push(userMeta);
        const uniqueUsers = activeBundle.users.length;

        let text = `💨 ${uniqueUsers} Users floated away...`;
        // Optional: List names if small count? "A, B left..." - User asked to match join style "X Users..."

        const updateMsg = {
          id: leaveMsgId,
          roomId,
          sender: 'System',
          text,
          type: 'system',
          systemType: 'join-leave',
          metadata: { users: activeBundle.users },
          timestamp: new Date().toISOString()
        };

        if (messageHistory[roomId]) {
          const idx = messageHistory[roomId].findIndex(m => m.id === leaveMsgId);
          if (idx !== -1) {
            messageHistory[roomId][idx] = updateMsg;
          }
        }
        saveMessageToDB(updateMsg);
        io.to(roomId).emit('chat-message-update', updateMsg);
      } else {
        leaveMsgId = `sys-${Date.now()}`;
        const users = [userMeta];
        const leaveMsg = {
          roomId,
          id: leaveMsgId,
          sender: 'System',
          text: `💨 ${userName || 'A user'} floated away...`,
          type: 'system',
          systemType: 'join-leave',
          metadata: { users },
          timestamp: new Date().toISOString()
        };
        setBundle(roomId, 'leave', leaveMsgId, users);
        storeMessage(roomId, leaveMsg);
        io.to(roomId).emit('chat-message', leaveMsg);
      }

      // Cleanup IRC
      if (socket.data.ircBridge) {
        socket.data.ircBridge.disconnect();
        socket.data.ircBridge = null;
      }
    });

    // WebRTC Signaling
    socket.on("signal", (data) => {
      io.to(data.target).emit("signal", {
        sender: socket.id,
        payload: data.payload
      });
    });

    // Change Nickname (/nick command)
    socket.on('change-nick', async ({ newNick }) => {
      const user = socket.data.user;
      const roomId = socket.data.roomId;
      if (!user || !roomId) return;

      const oldName = user.name;
      console.log(`[Nick] ${oldName} changing nick to ${newNick}`);

      // Update socket data
      user.name = newNick;
      socket.data.user = user;

      // Update room map
      const room = rooms.get(roomId);
      if (room) {
        room.set(socket.id, user);
      }

      // Persist to database if user has an ID (registered user)
      if (user.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { displayName: newNick }
          });
          console.log(`[Nick] Persisted displayName for ${user.id}: ${newNick}`);
        } catch (e) {
          console.error(`[Nick] Failed to persist displayName:`, e.message);
        }
      }

      // Change IRC nick if bridge exists
      if (socket.data.ircBridge) {
        socket.data.ircBridge.client.changeNick(newNick);
      }

      // Broadcast nick change to room
      io.to(roomId).emit('user-updated', { socketId: socket.id, user });

      // Send system message about nick change
      const sysMsg = {
        id: `nick-${Date.now()}`,
        roomId,
        text: `**${oldName}** is now known as **${newNick}**`,
        sender: 'System',
        type: 'system',
        systemType: 'nick-change',
        timestamp: new Date().toISOString()
      };
      storeMessage(roomId, sysMsg);
      io.to(roomId).emit('chat-message', sysMsg);

      // Emit nick-changed to sender so they can update local state
      socket.emit('nick-changed', { newNick });
    });

    // Handle User Updates (e.g. formatting, cam status)
    socket.on('update-user', (updates) => {
      const { roomId, user } = socket.data;
      if (!roomId || !rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      const userData = room.get(socket.id);

      if (userData) {
        // Check for Cam Toggle
        const wasVideoEnabled = userData.isVideoEnabled;
        const isVideoEnabled = updates.isVideoEnabled;
        const camToggled = (isVideoEnabled !== undefined) && (isVideoEnabled !== wasVideoEnabled);

        // Apply Updates
        Object.assign(userData, updates);
        room.set(socket.id, userData); // Update map

        // Broadcast Update to others
        socket.to(roomId).emit('user-updated', { socketId: socket.id, user: userData });

        // --- Smart Bundling: CAM ---
        if (camToggled) {
          const action = isVideoEnabled ? 'cam-up' : 'cam-down';
          const activeBundle = getBundle(roomId, 'cam');
          let bundleId;

          const userMeta = { ...user, action, timestamp: Date.now() };

          if (activeBundle) {
            // Update Bundle
            bundleId = activeBundle.id;
            const userInBundle = activeBundle.users.find(u => u.name === user.name);
            if (userInBundle) {
              // Overwrite previous action if recent? OR append?
              // "A started... and stopped" -> action: 'cam-flash'
              if (userInBundle.action !== action) {
                // E.g. cam-up + cam-down = cam-flash?
                // Or just update to latest state?
                userInBundle.action = action; // Just update to latest
              }
            } else {
              activeBundle.users.push(userMeta);
            }

            const total = activeBundle.users.length;
            const up = activeBundle.users.filter(u => u.action === 'cam-up').length;

            // Text Logic: "3 Users updated camera" or "3 Users live!"
            let text = `${total} Users updated camera`;
            if (up === total) text = `${total} Users went live!`;
            else text = `Cam check: ${up} live, ${total - up} off`;

            const updateMsg = {
              id: bundleId,
              roomId,
              sender: 'System',
              text,
              type: 'system',
              systemType: 'join-leave', // Use same minimal style
              metadata: { users: activeBundle.users },
              timestamp: new Date().toISOString()
            };

            if (messageHistory[roomId]) {
              const idx = messageHistory[roomId].findIndex(m => m.id === bundleId);
              if (idx !== -1) {
                messageHistory[roomId][idx] = updateMsg;
              }
            }
            saveMessageToDB(updateMsg);
            io.to(roomId).emit('chat-message-update', updateMsg);

          } else {
            // Create New Bundle
            bundleId = `sys-cam-${Date.now()}`;
            const users = [userMeta];

            let text = `${user.name} went live!`;
            if (!isVideoEnabled) text = `${user.name} turned off camera.`;

            const camMsg = {
              roomId,
              id: bundleId,
              sender: 'System',
              text,
              type: 'system',
              systemType: 'join-leave', // Use minimal style
              metadata: { users },
              timestamp: new Date().toISOString()
            };

            setBundle(roomId, 'cam', bundleId, users);
            storeMessage(roomId, camMsg);
            io.to(roomId).emit('chat-message', camMsg);
          }
        }
      }
    });

    // Chat Messages
    socket.on('chat-message', (message) => {
      if (!message.timestamp) message.timestamp = new Date().toISOString();

      const user = socket.data.user;
      const roomId = message.roomId || socket.data.roomId;
      const text = message.text || '';

      // 0. Build State Override (Failsafe)
      if (text.toLowerCase() === '/clearbuild' && user && (user.role === 'ADMIN' || user.role === 'OWNER')) {
        console.log(`[Admin] Building state cleared by ${user.name}`);
        const clearMsg = {
          id: `clear-${Date.now()}`,
          roomId,
          sender: 'System',
          text: `**Build state manually cleared** by ${user.name}`,
          type: 'system',
          systemType: 'deploy-success',
          timestamp: new Date().toISOString()
        };
        storeMessage(roomId, clearMsg);
        io.to(roomId).emit('chat-message', clearMsg);
        return;
      }

      // Automod Filter
      if (message.text) {
        message.text = filterProfanity(message.text);
      }

      const senderId = socket.data.user?.id;
      const senderName = socket.data.user?.name || message.sender;
      // Check shadow mute by ID or by name key (for IRC users)
      const isShadowMuted = (senderId && shadowMutedUsers.has(senderId)) ||
        (senderName && shadowMutedUsers.has(`name:${senderName}`));

      if (isShadowMuted) {
        // Shadow muted: Only send to mods with indicator
        const mutedMessage = { ...message, shadowMuted: true };

        // Find all mod sockets in this room
        const room = rooms.get(message.roomId);
        if (room) {
          room.forEach((user, socketId) => {
            const userRole = (user.role || '').toUpperCase();
            if (['ADMIN', 'MODERATOR', 'OWNER'].includes(userRole)) {
              io.to(socketId).emit('chat-message', mutedMessage);
            }
          });
        }
        // Do NOT store or broadcast to others
        console.log(`[Mod] Shadow muted message from ${senderName} blocked`);
        return;
      }

      storeMessage(message.roomId, message);
      io.to(message.roomId).emit('chat-message', message);

      if (socket.data.ircBridge) {
        socket.data.ircBridge.sendToIRC(message);
      }

      // Track Message Stats
      if (socket.data.user && socket.data.user.id) {
        prisma.userStats.upsert({
          where: { userId: socket.data.user.id },
          create: { userId: socket.data.user.id, messagesSent: 1, chatPoints: 1 },
          update: { messagesSent: { increment: 1 }, chatPoints: { increment: 1 } }
        }).catch(e => console.error("[Stats] Failed to track message:", e.message));
      }
    });

    // Typing
    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("user-typing", { user });
    });

    socket.on("stop-typing", ({ roomId }) => {
      socket.to(roomId).emit("user-stop-typing", { user: socket.data.user?.name });
    });

    // Manual History Request
    socket.on('get-history', ({ roomId }) => {
      const history = messageHistory[roomId] || [];
      socket.emit('chat-history', history);
    });

    // Reactions
    socket.on("reaction", ({ roomId, targetId, emoji }) => {
      // Broadcast to everyone in the room (including sender, simplifies logic)
      io.to(roomId).emit("reaction", {
        senderId: socket.id,
        targetId, // If null, it's a general room reaction? For now, we assume user-specific.
        emoji,
        timestamp: Date.now()
      });

      // Track Reaction Stats
      if (socket.data.user && socket.data.user.id) {
        // Giver
        prisma.userStats.upsert({
          where: { userId: socket.data.user.id },
          create: { userId: socket.data.user.id, emotesGiven: 1, chatPoints: 1 },
          update: { emotesGiven: { increment: 1 }, chatPoints: { increment: 1 } }
        }).catch(e => console.error("[Stats] Failed to track reaction give:", e.message));
      }

      // Receiver (Find user by socket/targetId?)
      // targetId is likely a socketId or userId. The reaction event assumes socketId usually.
      // We need to resolve targetId to a user ID.
      // Since rooms map stores users by socketId, we can look it up.
      const room = rooms.get(roomId);
      if (room && targetId && room.has(targetId)) {
        const targetUser = room.get(targetId);
        if (targetUser && targetUser.id) {
          prisma.userStats.upsert({
            where: { userId: targetUser.id },
            create: { userId: targetUser.id, emotesReceived: 1, chatPoints: 1 },
            update: { emotesReceived: { increment: 1 }, chatPoints: { increment: 1 } }
          }).catch(e => console.error("[Stats] Failed to track reaction receive:", e.message));
        }
      }
    });

    // === MESSAGE REACTIONS (Discord-style) ===
    socket.on('message-react', ({ messageId, emoji }) => {
      const roomId = socket.data.roomId || 'general';
      const userId = socket.data.user?.id || socket.id;
      const userName = socket.data.user?.name || 'Someone';

      if (!messageId || !emoji) return;

      // Initialize reaction storage for this message
      if (!messageReactions.has(messageId)) {
        messageReactions.set(messageId, new Map());
      }

      const msgReactions = messageReactions.get(messageId);

      // Initialize this emoji's set if needed
      if (!msgReactions.has(emoji)) {
        msgReactions.set(emoji, new Set());
      }

      // Add user's reaction
      msgReactions.get(emoji).add(userId);

      // Persist to DB (fire and forget)
      prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji
        }
      }).catch(err => {
        // Ignore unique constraint violations (already reacted)
        if (err.code !== 'P2002') {
          console.error('[Reactions] Failed to persist reaction:', err.message);
        }
      });

      console.log(`[Reactions] ${userName} reacted ${emoji} to message ${messageId}`);

      // Build reaction summary to broadcast
      const reactionSummary = {};
      for (const [e, users] of msgReactions.entries()) {
        reactionSummary[e] = {
          count: users.size,
          users: Array.from(users),
          hasReacted: users.has(userId) // Did current user react with this emoji
        };
      }

      // Broadcast to room
      io.to(roomId).emit('message-reactions-update', { messageId, reactions: reactionSummary });
    });

    socket.on('message-unreact', ({ messageId, emoji }) => {
      const roomId = socket.data.roomId || 'general';
      const userId = socket.data.user?.id || socket.id;
      const userName = socket.data.user?.name || 'Someone';

      if (!messageId || !emoji) return;

      const msgReactions = messageReactions.get(messageId);
      if (!msgReactions || !msgReactions.has(emoji)) return;

      // Remove user's reaction
      msgReactions.get(emoji).delete(userId);

      // Clean up empty emoji sets
      if (msgReactions.get(emoji).size === 0) {
        msgReactions.delete(emoji);
      }

      // Persist removal to DB
      prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId,
          emoji
        }
      }).catch(err => {
        console.error('[Reactions] Failed to persist unreact:', err.message);
      });

      console.log(`[Reactions] ${userName} removed ${emoji} from message ${messageId}`);

      // Build reaction summary to broadcast
      const reactionSummary = {};
      for (const [e, users] of msgReactions.entries()) {
        reactionSummary[e] = {
          count: users.size,
          users: Array.from(users),
          hasReacted: users.has(userId)
        };
      }

      // Broadcast to room
      io.to(roomId).emit('message-reactions-update', { messageId, reactions: reactionSummary });
    });

    // Tube Sync Handlers
    socket.on('tube-request-state', () => {
      const roomId = socket.data.roomId || 'general';
      const tubeState = getTubeState(roomId);

      // If there's no owner, and we have a video, requester can be owner
      if (!tubeState.ownerId && tubeState.videoId) {
        tubeState.ownerId = socket.id;
      }
      // Include currentPosition for immediate sync on join
      socket.emit('tube-state', {
        ...tubeState,
        serverTime: Date.now(),
        currentPosition: getTubePosition(roomId)
      });
    });

    socket.on('tube-update', (payload) => {
      const roomId = payload.roomId || socket.data.roomId || 'general';
      const tubeState = getTubeState(roomId);
      const newState = payload;

      console.log(`[Tube] tube-update received:`, { videoId: newState.videoId, isPlaying: newState.isPlaying, type: newState.type, action: newState.action });

      // Extract video ID early for consistent comparison
      const incomingVideoId = newState.videoId ? extractVideoId(newState.videoId) : null;

      // EARLY DEDUP: If this is a new video request, check if we JUST processed this video
      if (incomingVideoId) {
        const lastProcessedVideo = global._lastProcessedTubeVideo || {};
        const lastVideoKey = lastProcessedVideo[roomId];
        const lastVideoTime = global._lastProcessedTubeVideoTime?.[roomId] || 0;

        // If same video was processed within last 5 seconds, skip ENTIRELY
        if (lastVideoKey === incomingVideoId && (Date.now() - lastVideoTime) < 5000) {
          console.log(`[Tube] Skipping duplicate videoId: ${incomingVideoId}`);
          // Still broadcast state but skip the system message
          io.to(roomId).emit('tube-state', {
            ...tubeState,
            serverTime: Date.now(),
            currentPosition: getTubePosition(roomId)
          });
          return;
        }

        // Record this video as being processed (use extracted ID)
        if (!global._lastProcessedTubeVideo) global._lastProcessedTubeVideo = {};
        if (!global._lastProcessedTubeVideoTime) global._lastProcessedTubeVideoTime = {};
        global._lastProcessedTubeVideo[roomId] = incomingVideoId;
        global._lastProcessedTubeVideoTime[roomId] = Date.now();
      }

      if (!tubeState.ownerId) {
        tubeState.ownerId = socket.id;
      }

      const fallback = lastKnownUsers.get(socket.id);
      const userName = socket.data.user?.name || fallback?.user?.name || 'Someone';
      let systemMsg = null;
      let shouldUpdateExisting = false;

      // Track the last tube message ID for updates
      const tubeMsgKey = `tube-${roomId}`;
      let lastTubeMsgId = global._lastTubeMsg?.[tubeMsgKey];

      // Build message payload - ALWAYS UPDATE existing message if it exists
      let msgPayload = null;
      let isUpdate = !!lastTubeMsgId;

      // --- PLAYBACK CONTROL ACTIONS (Next/Prev) ---
      // incomingVideoId is null when action is sent without a videoId
      if (!incomingVideoId && newState.action) {
        // NEXT Action: Explicitly Advance Queue
        if (newState.action === 'next') {
          console.log(`[Tube] Action: NEXT triggered by ${userName}`);

          // Push current to history if playing
          if (tubeState.videoId) {
            tubeState.history.push({
              videoId: tubeState.videoId,
              title: tubeState.title,
              thumbnail: tubeState.thumbnail,
              startedBy: tubeState.ownerId
            });
            if (tubeState.history.length > 20) tubeState.history.shift();
          }

          if (tubeState.queue.length > 0) {
            const nextVideo = tubeState.queue.shift();
            tubeState.videoId = nextVideo.videoId;
            tubeState.title = nextVideo.title;
            tubeState.thumbnail = nextVideo.thumbnail;
            tubeState.isPlaying = true;
            tubeState.playStartedAt = Date.now();
            tubeState.pausedAt = 0;

            // Update System Message to "Now Playing"
            // Build text with title if available, and include who queued it
            const hasTitle = nextVideo.title && !nextVideo.title.startsWith('Video:');
            const titleText = hasTitle
              ? `**Now Playing**: [${nextVideo.title}](https://youtu.be/${nextVideo.videoId}) (queued by ${nextVideo.startedBy || 'Someone'})`
              : `**Now Playing** (queued by ${nextVideo.startedBy || 'Someone'})`;

            msgPayload = {
              id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
              roomId,
              text: titleText,
              sender: 'System',
              type: 'system',
              systemType: 'tube-now-playing',
              metadata: {
                kicker: 'ON AIR',
                videoId: nextVideo.videoId,
                title: nextVideo.title,
                thumbnail: nextVideo.thumbnail,
                startedBy: nextVideo.startedBy
              },
              timestamp: new Date().toISOString()
            };
          } else {
            // Stop if queue empty
            tubeState.isPlaying = false;
            tubeState.videoId = null;
            tubeState.title = null;
            tubeState.thumbnail = null;

            msgPayload = {
              id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
              roomId,
              text: `**Playback Stopped**`,
              sender: 'System',
              type: 'system',
              systemType: 'tube-stopped',
              metadata: { kicker: 'OFF AIR' },
              timestamp: new Date().toISOString()
            };
          }

          io.to(roomId).emit('tube-state', {
            ...tubeState,
            serverTime: Date.now(),
            currentPosition: getTubePosition(roomId)
          });

          persistTubeState(roomId, tubeState.videoId, tubeState.title);

          // Trigger Async Title Fetch for the new video
          if (tubeState.videoId && (!tubeState.title || tubeState.title.startsWith('Video:'))) {
            getYouTubeVideoInfo(tubeState.videoId).then(info => {
              if (info && info.title) {
                console.log(`[Tube] NEXT Action - Fetched title: ${info.title}`);
                tubeState.title = info.title;
                tubeState.thumbnail = info.thumbnail || tubeState.thumbnail;
                // Update message
                if (msgPayload) {
                  // We have to emit the update because msgPayload might have been sent already? 
                  // No, msgPayload is stored at end of function. 
                  // But this async block runs later.
                  // So we need to emit an update.
                  const updatedMsg = {
                    ...msgPayload,
                    text: `**Now Playing**: [${info.title}](https://youtu.be/${tubeState.videoId})`,
                    metadata: { ...msgPayload.metadata, title: info.title, thumbnail: tubeState.thumbnail }
                  };
                  io.to(roomId).emit('chat-message-update', updatedMsg);
                }
                io.to(roomId).emit('tube-state', { ...tubeState, serverTime: Date.now(), currentPosition: getTubePosition(roomId) });
                persistTubeState(roomId, tubeState.videoId, info.title);
              }
            });
          }

          // CRITICAL: Store and emit the message before returning
          if (msgPayload) {
            console.log(`[Tube] NEXT: Emitting message to room '${roomId}':`, msgPayload.text, `isUpdate:${isUpdate}`);
            storeMessage(roomId, msgPayload);
            // Use update event for existing messages, new event for first message
            if (isUpdate) {
              io.to(roomId).emit('chat-message-update', msgPayload);
            } else {
              io.to(roomId).emit('chat-message', msgPayload);
            }
            // Track this as the last tube message for updates
            if (!global._lastTubeMsg) global._lastTubeMsg = {};
            global._lastTubeMsg[`tube-${roomId}`] = msgPayload.id;
          } else {
            console.log(`[Tube] NEXT: No msgPayload to emit!`);
          }

          return; // Exit after handling action to prevent fall-through
        }

        // PREVIOUS Action: Pop history -> Queue Current -> Play History
        if (newState.action === 'prev') {
          console.log(`[Tube] Action: PREVIOUS triggered by ${userName}`);
          if (tubeState.history.length > 0) {
            const prevVideo = tubeState.history.pop();

            // If currently playing something, push it to QUEUE FRONT
            if (tubeState.videoId) {
              const currentAsQueue = {
                videoId: tubeState.videoId,
                title: tubeState.title || `Video: ${tubeState.videoId}`,
                thumbnail: tubeState.thumbnail,
                startedBy: tubeState.ownerId, // or keep original startedBy?
                tstamp: Date.now()
              };
              tubeState.queue.unshift(currentAsQueue);
            }

            // Force play the previous video
            tubeState.videoId = prevVideo.videoId;
            tubeState.title = prevVideo.title;
            tubeState.thumbnail = prevVideo.thumbnail;
            tubeState.isPlaying = true;
            tubeState.playStartedAt = Date.now();
            tubeState.pausedAt = 0;

            // Emit Now Playing for the historical video
            msgPayload = {
              id: `sys-tube-${Date.now()}`, // New ID to force a new message (or reuse global if needed, but history jump usually warrants new context)
              roomId,
              text: `**Now Playing** (History)`,
              sender: 'System',
              type: 'system',
              systemType: 'tube-now-playing',
              metadata: {
                kicker: 'REWIND',
                videoId: prevVideo.videoId,
                title: prevVideo.title,
                thumbnail: prevVideo.thumbnail,
                startedBy: prevVideo.startedBy
              },
              timestamp: new Date().toISOString()
            };
            storeMessage(roomId, msgPayload);
            io.to(roomId).emit('chat-message', msgPayload);

            // Emit update immediately
            io.to(roomId).emit('tube-state', {
              ...tubeState,
              serverTime: Date.now(),
              currentPosition: 0
            });

            persistTubeState(roomId, tubeState.videoId, tubeState.title);
            return; // Done
          }
        }
      }

      // Detect Changes for System Messages & History Tracking
      if (incomingVideoId && incomingVideoId !== tubeState.videoId) {
        // ... (rest of existing logic)


        // HISTORY LOGIC: Before switching, push CURRENT video to history
        if (tubeState.videoId) {
          tubeState.history.push({
            videoId: tubeState.videoId,
            title: tubeState.title,
            thumbnail: tubeState.thumbnail,
            startedBy: tubeState.ownerId // effectively who queued it
          });
          // Limit history size
          if (tubeState.history.length > 20) tubeState.history.shift();
        }

        // QUEUE LOGIC: If a video is ALREADY playing, add to queue instead of interrupting
        if (tubeState.videoId) {
          // Prevent duplicates in queue
          if (tubeState.queue.some(q => q.videoId === incomingVideoId)) {
            console.log(`[Tube] Ignoring duplicate queue request for ${incomingVideoId}`);
            return;
          }

          const queueItem = {
            videoId: incomingVideoId,
            title: `Video: ${incomingVideoId}`,
            thumbnail: `https://img.youtube.com/vi/${incomingVideoId}/mqdefault.jpg`,
            startedBy: userName,
            tstamp: Date.now()
          };
          tubeState.queue.push(queueItem);

          // Emit "Queued" message (New message)
          const queueMsg = {
            id: `sys-queue-${Date.now()}`,
            roomId,
            text: `**Queued**: ${queueItem.title}`,
            sender: 'System',
            type: 'system',
            systemType: 'tube-queue',
            metadata: {
              kicker: 'UP NEXT',
              videoId: incomingVideoId,
              title: queueItem.title,
              startedBy: userName
            },
            timestamp: new Date().toISOString()
          };
          storeMessage(roomId, queueMsg);
          io.to(roomId).emit('chat-message', queueMsg);

          // Async fetch title for the queued item and update the message
          getYouTubeVideoInfo(incomingVideoId).then(info => {
            if (info && info.title) {
              console.log(`[Tube] Fetched title for queued video: ${info.title}`);
              // Update the queue item in memory
              queueItem.title = info.title;
              queueItem.thumbnail = info.thumbnail || queueItem.thumbnail;

              // Update the queue message with real title
              const updatedQueueMsg = {
                ...queueMsg,
                text: `**Queued by ${userName}**: ${info.title}`,
                metadata: {
                  ...queueMsg.metadata,
                  title: info.title
                }
              };
              storeMessage(roomId, updatedQueueMsg); // Persist to DB
              io.to(roomId).emit('chat-message-update', updatedQueueMsg);
            }
          }).catch(err => console.error('[Tube] Queue title fetch error:', err));

          // Broadcast state update (queue changed)
          io.to(roomId).emit('tube-state', {
            ...tubeState,
            serverTime: Date.now(),
            currentPosition: getTubePosition(roomId)
          });
          return; // EXIT EARLY - Do not change current video
        }

        // NEW VIDEO (Immediate Play) - update or create the tube message
        const videoId = incomingVideoId;
        const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        // Update state
        tubeState.videoId = videoId;
        tubeState.title = `Video: ${videoId}`;
        tubeState.thumbnail = thumbnail;
        tubeState.pausedAt = 0;
        tubeState.isPlaying = true; // Always auto-play new video
        tubeState.playStartedAt = Date.now();
        tubeState.startedBy = userName; // Track who started this video

        // 1. YouTube Commands (Now Playing / Queue / Search)
        // Update/Create "Now Playing" Message (initially with placeholder, async update will add title)
        const msgId = isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`;
        msgPayload = {
          id: msgId,
          roomId,
          text: `**Now Playing** (queued by ${userName})`,
          sender: 'System',
          type: 'system',
          systemType: 'tube-now-playing',
          metadata: {
            kicker: 'ON AIR',
            videoId,
            title: `Video: ${videoId}`,
            thumbnail,
            startedBy: userName
          },
          timestamp: new Date().toISOString()
        };

        // Store and emit immediately with placeholder
        persistTubeState(roomId, videoId, `Video: ${videoId}`);
        storeMessage(roomId, msgPayload);
        io.to(roomId).emit('chat-message', msgPayload);
        if (!global._lastTubeMsg) global._lastTubeMsg = {};
        global._lastTubeMsg[`tube-${roomId}`] = msgId;

        // Async fetch title and update message
        getYouTubeVideoInfo(videoId).then(info => {
          if (info && info.title) {
            console.log(`[Tube] Direct Play - Fetched title: ${info.title}`);
            tubeState.title = info.title;
            tubeState.thumbnail = info.thumbnail || tubeState.thumbnail;

            // Update the Now Playing message with real title
            const updatedMsg = {
              ...msgPayload,
              text: `**Now Playing**: [${info.title}](https://youtu.be/${videoId}) (queued by ${userName})`,
              metadata: {
                ...msgPayload.metadata,
                title: info.title,
                thumbnail: tubeState.thumbnail
              }
            };
            storeMessage(roomId, updatedMsg); // Persist to DB
            io.to(roomId).emit('chat-message-update', updatedMsg);
            io.to(roomId).emit('tube-state', { ...tubeState, serverTime: Date.now(), currentPosition: getTubePosition(roomId) });
            persistTubeState(roomId, videoId, info.title);
          }
        }).catch(err => console.error('[Tube] Direct play title fetch error:', err));

        // Emit initial tube state
        io.to(roomId).emit('tube-state', {
          ...tubeState,
          serverTime: Date.now(),
          currentPosition: getTubePosition(roomId)
        });
        return; // Exit - message already emitted above

      } else if (newState.type === 'ended' || (newState.videoId === null && tubeState.videoId)) {
        // STOPPED / ENDED / EJECTED

        // Check Queue
        if (tubeState.queue.length > 0) {
          // PLAY NEXT FROM QUEUE
          const nextVideo = tubeState.queue.shift();

          tubeState.videoId = nextVideo.videoId;
          tubeState.title = nextVideo.title;
          tubeState.thumbnail = nextVideo.thumbnail;
          tubeState.pausedAt = 0;
          tubeState.isPlaying = true;
          tubeState.playStartedAt = Date.now();

          // Re-use the existing Now Playing message logic to update it
          msgPayload = {
            id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
            roomId,
            text: `**Now Playing**`,
            sender: 'System',
            type: 'system',
            systemType: 'tube-now-playing',
            metadata: {
              kicker: 'ON AIR',
              videoId: nextVideo.videoId,
              title: nextVideo.title,
              thumbnail: nextVideo.thumbnail,
              startedBy: nextVideo.startedBy
            },
            timestamp: new Date().toISOString()
          };

        } else {
          // EMPTY QUEUE - REALLY STOP
          tubeState.isPlaying = false;
          tubeState.playStartedAt = 0;
          tubeState.pausedAt = 0;
          if (newState.videoId === null) {
            tubeState.videoId = null; // Clear video if explicitly ejected
            tubeState.title = null;
            tubeState.thumbnail = null;
          }
          persistTubeState(roomId, null, null);

          msgPayload = {
            id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
            roomId,
            text: `**Playback Stopped**`,
            sender: 'System',
            type: 'system',
            systemType: 'tube-stopped',
            metadata: { kicker: 'OFF AIR' },
            timestamp: new Date().toISOString()
          };
        }

        // Emit Tube State Update
        io.to(roomId).emit('tube-state', {
          ...tubeState,
          serverTime: Date.now(),
          currentPosition: getTubePosition(roomId)
        });

        // 5. Async Title Fetching (Fire and Forget)
        if (tubeState.videoId && (!tubeState.title || tubeState.title.startsWith('Video:'))) {
          getYouTubeVideoInfo(tubeState.videoId).then(info => {
            if (info && info.title) {
              console.log(`[Tube] Fetched title for ${tubeState.videoId}: ${info.title}`);
              tubeState.title = info.title;
              tubeState.thumbnail = info.thumbnail || tubeState.thumbnail;

              // Update the system message if it exists
              if (systemMsg) {
                systemMsg.text = `**Now Playing**: [${info.title}](https://youtu.be/${tubeState.videoId})`;
                if (systemMsg.metadata) {
                  systemMsg.metadata.title = info.title;
                  systemMsg.metadata.thumbnail = tubeState.thumbnail;
                }
                // Emit update for the message
                io.to(roomId).emit('chat-message-update', systemMsg);
              }

              // Broadcast state update with new title
              io.to(roomId).emit('tube-state', {
                ...tubeState,
                serverTime: Date.now(),
                currentPosition: getTubePosition(roomId)
              });
            }
          }).catch(err => console.error("Title fetch error:", err));
        }

        // 6. Queue Title Fetching (Process new queue items)
        tubeState.queue.forEach(item => {
          if (!item.title || item.title.startsWith('Video:')) {
            getYouTubeVideoInfo(item.videoId).then(info => {
              if (info && info.title) {
                item.title = info.title;
                item.thumbnail = info.thumbnail || item.thumbnail;
              }
            });
          }
        });

      } else if (newState.isPlaying !== undefined && newState.isPlaying !== tubeState.isPlaying) {
        // PLAY/PAUSE toggle - update the existing message
        if (newState.isPlaying) {
          msgPayload = {
            id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
            roomId,
            text: `**${userName}** resumed playback`,
            sender: 'System',
            type: 'system',
            systemType: 'tube-resumed',
            metadata: {
              kicker: 'PLAYING',
              videoId: tubeState.videoId,
              title: tubeState.title || `Video: ${tubeState.videoId}`,
              thumbnail: tubeState.thumbnail,
              startedBy: userName
            },
            timestamp: new Date().toISOString()
          };
          tubeState.isPlaying = true;
          if (newState.timestamp !== undefined) {
            tubeState.pausedAt = newState.timestamp;
          }
          tubeState.playStartedAt = Date.now();
        } else {
          msgPayload = {
            id: isUpdate ? lastTubeMsgId : `sys-tube-${Date.now()}`,
            roomId,
            text: `**${userName}** paused`,
            sender: 'System',
            type: 'system',
            systemType: 'tube-paused',
            metadata: {
              kicker: 'PAUSED',
              videoId: tubeState.videoId,
              title: tubeState.title || `Video: ${tubeState.videoId}`,
              thumbnail: tubeState.thumbnail,
              startedBy: userName
            },
            timestamp: new Date().toISOString()
          };
          tubeState.isPlaying = false;
          tubeState.pausedAt = getTubePosition();
          tubeState.playStartedAt = 0;
        }
      }

      // Emit message if we have one
      if (msgPayload) {
        console.log(`[Tube] ${isUpdate ? 'UPDATING' : 'CREATING'} message: ${msgPayload.systemType}`);

        if (isUpdate) {
          // Update existing message in history
          if (messageHistory[roomId]) {
            const idx = messageHistory[roomId].findIndex(m => m.id === lastTubeMsgId);
            if (idx !== -1) {
              messageHistory[roomId][idx] = msgPayload;
            }
          }
          io.to(roomId).emit('chat-message-update', msgPayload);
        } else {
          // Create new message
          storeMessage(roomId, msgPayload);
          io.to(roomId).emit('chat-message', msgPayload);
        }

        // Track this message ID
        if (!global._lastTubeMsg) global._lastTubeMsg = {};
        global._lastTubeMsg[tubeMsgKey] = msgPayload.id;
      }

      tubeState.lastUpdate = Date.now();

      // Broadcast tube-state with server-calculated position
      io.to(roomId).emit('tube-state', {
        ...tubeState,
        serverTime: Date.now(),
        currentPosition: getTubePosition(roomId)
      });
    });

    // Handle Tube Search
    socket.on("tube-search", async ({ query }, callback) => {
      try {
        console.log(`[Tube] Searching for: ${query}`);
        const searchResults = await ytsr(query, { limit: 10 });
        // Filter only videos
        const videos = searchResults.items
          .filter(item => item.type === 'video')
          .map(item => ({
            title: item.title,
            url: item.url,
            thumbnail: item.bestThumbnail.url,
            duration: item.duration,
            author: item.author.name
          }));

        if (callback) callback({ success: true, videos });
      } catch (err) {
        console.error('[Tube] Search failed:', err);
        if (callback) callback({ success: false, error: 'Search failed' });
      }
    });

    // Fetch Profile Stats
    socket.on("fetch-profile-stats", async ({ userId }, callback) => {
      try {
        if (!userId) {
          callback({ error: "No User ID" });
          return;
        }

        const stats = await prisma.userStats.findUnique({
          where: { userId }
        });

        // Also calculate connection status
        let isOnline = false;
        let isIdle = true;
        let lastSeen = null; // Could fetch from User table if needed

        // Check if online in any room
        for (const room of rooms.values()) {
          for (const u of room.values()) {
            if (u.id === userId) {
              isOnline = true;
              isIdle = false; // Simplified; real idle tracking requires more state
              break;
            }
          }
          if (isOnline) break;
        }

        callback({
          stats: stats || { chatPoints: 0, timeOnSiteSeconds: 0, camTimeSeconds: 0, messagesSent: 0, emotesGiven: 0, emotesReceived: 0 },
          status: { isOnline, isIdle }
        });
      } catch (e) {
        console.error("Error fetching stats:", e);
        callback({ error: "Server Error" });
      }
    });

    // === MODERATION EVENTS ===

    // Shadow Mute: Toggle shadow mute for a user (PERSISTENT for DB users, in-memory for IRC)
    socket.on('mod-shadow-mute', async ({ targetUserId, targetUserName, mute }) => {
      console.log(`[Mod-Debug] mod-shadow-mute received. targetUserId: ${targetUserId}, targetUserName: ${targetUserName}, mute: ${mute}`);
      const modUser = socket.data.user;
      console.log(`[Mod-Debug] modUser:`, modUser?.name, 'role:', modUser?.role);
      if (!modUser || !['ADMIN', 'MODERATOR', 'OWNER'].includes(modUser.role)) {
        console.log(`[Mod] Unauthorized shadow-mute attempt by ${modUser?.name} (role: ${modUser?.role})`);
        return;
      }

      // Use ID if available, otherwise use name (for IRC/guest users)
      const muteKey = targetUserId || `name:${targetUserName}`;

      // Update Valkey state
      if (mute) {
        await valkey.addShadowMuted(muteKey);
        console.log(`[Mod] ${modUser.name} shadow muted user ${muteKey} (Valkey)`);
      } else {
        if (valkey.enabled) await valkey.client.srem('shadow_muted', muteKey);
        console.log(`[Mod] ${modUser.name} removed shadow mute from user ${muteKey} (Valkey)`);
      }

      // PERSIST to database (only if we have a user ID)
      if (targetUserId) {
        try {
          await prisma.user.update({
            where: { id: targetUserId },
            data: { isShadowMuted: mute }
          });
          console.log(`[Mod] Shadow mute persisted to database for ${targetUserId}`);
        } catch (e) {
          console.error(`[Mod] Failed to persist shadow mute:`, e.message);
        }
      }

      // Notify all mods about the mute status change
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (room) {
        room.forEach((user, socketId) => {
          if (['ADMIN', 'MODERATOR', 'OWNER'].includes(user.role)) {
            io.to(socketId).emit('mod-mute-status', {
              targetUserId: muteKey,
              targetUserName,
              isMuted: mute
            });
          }
        });
      }
    });

    // Wipe Messages: Mark user's messages as hidden for non-admins (PERSISTENT)
    socket.on('mod-wipe-messages', async ({ targetUserId, targetUserName }) => {
      console.log(`[Mod-Debug] mod-wipe-messages received. targetUserId: ${targetUserId}, targetUserName: ${targetUserName}`);
      const modUser = socket.data.user;
      console.log(`[Mod-Debug] modUser:`, modUser?.name, 'role:', modUser?.role);
      if (!modUser || !['ADMIN', 'MODERATOR', 'OWNER'].includes(modUser.role)) {
        console.log(`[Mod] Unauthorized wipe-messages attempt by ${modUser?.name} (role: ${modUser?.role})`);
        return;
      }

      const roomId = socket.data.roomId || 'general';
      const wipeKey = targetUserId || `name:${targetUserName}`;
      wipedUsers.add(wipeKey);
      console.log(`[Mod] ${modUser.name} wiped messages from user ${wipeKey}`);

      // Use provided targetUserName or find it from room
      let userName = targetUserName;
      if (!userName && targetUserId) {
        const room = rooms.get(roomId);
        if (room) {
          for (const [_, userData] of room) {
            if (userData.id === targetUserId) {
              userName = userData.name;
              break;
            }
          }
        }
      }

      // Collect message IDs to hide (check senderId, sender.id, or sender name)
      const messagesToHide = (messageHistory[roomId] || [])
        .filter(m => {
          if (targetUserId && m.senderId === targetUserId) return true;
          if (targetUserId && m.sender?.id === targetUserId) return true;
          if (userName && m.sender === userName) return true;
          return false;
        })
        .map(m => m.id);

      console.log(`[Mod] Wipe: Found ${messagesToHide.length} messages to hide for user ${wipeKey} (${userName})`);

      // PERSIST to database - mark messages as wiped
      if (messagesToHide.length > 0) {
        try {
          await prisma.chatMessage.updateMany({
            where: { id: { in: messagesToHide } },
            data: { isWiped: true }
          });
          console.log(`[Mod] Wipe persisted to database: ${messagesToHide.length} messages`);
        } catch (e) {
          console.error(`[Mod] Failed to persist wipe:`, e.message);
        }
      }

      // Also mark in memory history
      (messageHistory[roomId] || []).forEach(m => {
        if (messagesToHide.includes(m.id)) {
          m.isWiped = true;
        }
      });

      // Broadcast wipe command to room (clients will hide matching messages)
      io.to(roomId).emit('mod-messages-wiped', {
        targetUserId,
        messageIds: messagesToHide
      });
    });

    // Force Cam Down: Force user to stop broadcasting
    socket.on('mod-force-cam-down', ({ targetSocketId, banMinutes = 0 }) => {
      const modUser = socket.data.user;
      if (!modUser || !['ADMIN', 'MODERATOR', 'OWNER'].includes(modUser.role)) {
        return;
      }

      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room) return;

      const targetUser = room.get(targetSocketId);
      if (!targetUser) return;

      console.log(`[Mod] ${modUser.name} forced cam down on ${targetUser.name} (ban: ${banMinutes}m)`);

      // Set cam ban if banMinutes > 0
      if (banMinutes > 0 && targetUser.id) {
        const banUntil = Date.now() + (banMinutes * 60 * 1000);
        camBannedUsers.set(targetUser.id, { until: banUntil });
      }

      // Send force-cam-down to target socket
      io.to(targetSocketId).emit('force-cam-down', {
        banMinutes,
        reason: 'Moderator action'
      });

      // Update user state in room
      targetUser.isVideoEnabled = false;
      room.set(targetSocketId, targetUser);

      // Broadcast user update
      io.to(roomId).emit('user-updated', { socketId: targetSocketId, user: targetUser });
    });

    // Check cam ban status (called by client before enabling cam)
    socket.on('check-cam-ban', (callback) => {
      const userId = socket.data.user?.id;
      if (!userId) return callback({ banned: false });

      const ban = camBannedUsers.get(userId);
      if (!ban) return callback({ banned: false });

      if (ban.until > Date.now()) {
        const remainingMs = ban.until - Date.now();
        callback({ banned: true, remainingSeconds: Math.ceil(remainingMs / 1000) });
      } else {
        // Ban expired, remove it
        camBannedUsers.delete(userId);
        callback({ banned: false });
      }
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);
      const fallback = lastKnownUsers.get(socket.id);
      const { roomId, user, joinMsgId } = {
        roomId: socket.data.roomId || fallback?.roomId,
        user: socket.data.user || fallback?.user,
        joinMsgId: socket.data.joinMsgId
      };

      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(socket.id);

          // Update room member count in database
          try {
            await prisma.room.update({
              where: { slug: roomId },
              data: { memberCount: room.size }
            });
          } catch (e) {
            // Room might not exist in DB, ignore
          }

          const tubeState = getTubeState(roomId);

          if (room.size === 0) {
            rooms.delete(roomId);
            if (tubeState) tubeState.ownerId = null;
          } else if (tubeState && tubeState.ownerId === socket.id) {
            const nextOwnerId = room.keys().next().value;
            tubeState.ownerId = nextOwnerId;
            console.log(`[Tube] Handed over ownership to ${nextOwnerId}`);
            io.to(roomId).emit('tube-state', {
              ...tubeState,
              serverTime: Date.now(),
              currentPosition: getTubePosition(roomId)
            });
          }
        }
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        socket.to(roomId).emit("user-disconnected", socket.id);

        // System Message: Disconnect (Smart Bundling)
        if (user) {
          const activeBundle = getBundle(roomId, 'join');

          if (activeBundle && joinMsgId && activeBundle.id === joinMsgId) {
            // Update Bundle
            const userInBundle = activeBundle.users.find(u => u.name === user.name);
            if (userInBundle) {
              userInBundle.action = 'joined-left';
            } else {
              activeBundle.users.push({ ...user, action: 'left', timestamp: Date.now() });
            }

            const total = activeBundle.users.length;
            const active = activeBundle.users.filter(u => u.action === 'joined').length;

            const updateMsg = {
              id: joinMsgId,
              roomId,
              sender: 'System',
              text: `${total} Users visited (${active} active)`,
              type: 'system',
              systemType: 'join-leave',
              metadata: { users: activeBundle.users },
              timestamp: new Date().toISOString()
            };

            if (messageHistory[roomId]) {
              const idx = messageHistory[roomId].findIndex(m => m.id === joinMsgId);
              if (idx !== -1) {
                messageHistory[roomId][idx] = updateMsg;
              }
            }
            saveMessageToDB(updateMsg);
            io.to(roomId).emit('chat-message-update', updateMsg);

          } else {
            // Minimal fallback - skip explicit message for old sessions
            console.log(`User left room ${roomId}:`, user.name);
          }
        }
      }

      // Cleanup IRC
      if (socket.data.ircBridge) {
        console.log(`[Server] Disconnecting IRC Bridge for ${user?.name}`);
        socket.data.ircBridge.disconnect();
        socket.data.ircBridge = null;
      }

      // Cleanup persistence cache
      setTimeout(() => {
        lastKnownUsers.delete(socket.id);
      }, 5000); // 5s grace period for re-joins/updates
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);

    // HistoryBot is initialized earlier (after io setup) - no duplicate needed here
  });
});
