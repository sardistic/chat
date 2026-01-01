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
let messageHistory = {}; // roomId -> Array of messages (Changed to Object for JSON serialization)

// Bundling Storage
const bundles = new Map(); // roomId -> { type: { id, users, timestamp } }

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

// Load History from Database on Start
async function loadHistoryFromDB() {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: 'default-room' },
      orderBy: { timestamp: 'asc' },
      take: 100 // Last 100 messages
    });

    messageHistory['default-room'] = messages.map(m => ({
      id: m.id,
      roomId: m.roomId,
      sender: m.sender,
      text: m.text,
      type: m.type,
      systemType: m.systemType,
      metadata: m.metadata,
      timestamp: m.timestamp.toISOString()
    }));

    console.log(`📚 Loaded ${messages.length} messages from database.`);
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
        metadata: message.metadata || null,
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
    console.error('Failed to save message to DB:', err.message);
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
      where: { roomId: 'default-room', systemType: { in: ['deploy-start', 'deploy-success', 'deploy-fail'] } },
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
      if (typeof messageHistory !== 'undefined' && messageHistory['default-room']) {
        const idx = messageHistory['default-room'].findIndex(m => m.id === deploymentMsg.id);
        if (idx !== -1) messageHistory['default-room'][idx] = updatedMsg;
      }

      if (io) io.to('default-room').emit('chat-message-update', updatedMsg);

      console.log(`[Backfill] Appended ${newLogs.length} logs to message ${deploymentMsg.id}`);
    } else {
      console.log('[Backfill] Logs up to date.');
    }

  } catch (err) {
    console.error('[Backfill] Error:', err);
  }
}

// Tube Sync State
const tubeState = {
  videoId: null,
  isPlaying: false,
  timestamp: 0,
  lastUpdate: Date.now(),
  ownerId: null
};

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
      req.on('end', () => {
        try {
          // 1. Verify Secret
          // Check Query Param first (Reliable), then Headers
          const querySecret = parsedUrl.query.secret;
          const headerSecret = req.headers['authorization'] || req.headers['x-deployment-secret'];
          const signature = querySecret || headerSecret;
          const expectedSecret = process.env.DEPLOY_WEBHOOK_SECRET;

          // DEBUG LOGGING
          console.log('[Webhook] 🔍 Debug Auth:');
          console.log(`- Query Param 'secret': ${querySecret ? 'Present' : 'Missing'}`);
          console.log(`- Header 'authorization': ${req.headers['authorization'] ? 'Present' : 'Missing'}`);
          console.log(`- Header 'x-deployment-secret': ${req.headers['x-deployment-secret'] ? 'Present' : 'Missing'}`);
          console.log(`- Env Var 'DEPLOY_WEBHOOK_SECRET': ${expectedSecret ? 'Set' : 'MISSING (Check Railway Variables)'}`);
          if (signature && expectedSecret) {
            console.log(`- Match: ${signature === expectedSecret ? 'YES' : 'NO'}`);
            console.log(`- Sig Len: ${signature.length}, Exp Len: ${expectedSecret.length}`);
          }

          if (!expectedSecret || signature !== expectedSecret) {
            console.warn('[Webhook] ⛔ Unauthorized access attempt');
            // TEMPORARY: Allow if Env Var is missing (first deploy race condition)
            if (!expectedSecret) {
              console.warn('[Webhook] ⚠️ Allowing request because DEPLOY_WEBHOOK_SECRET is not set yet.');
            } else {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }
          }

          const payload = JSON.parse(body);
          console.log('[Webhook] 📨 Received payload:', payload);

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
              let text = `🚧 **Building** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              if (commitAuthor) text += ` by ${commitAuthor}`;
              systemMessage = text;
              systemType = 'deploy-start';

              // Start streaming build logs if we have a deployment ID and API token
              console.log(`[Railway] Stream attempt - DeployID: ${deploymentId}, Token: ${!!process.env.RAILWAY_API_TOKEN}`);

              if (deploymentId && process.env.RAILWAY_API_TOKEN && io) {
                let logBuffer = [];
                let lastEmit = 0;
                const THROTTLE_MS = 800; // Emit batch every 800ms max

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
                    const history = messageHistory['default-room'];
                    const idx = history?.findIndex(m => m.id === msgId);

                    if (idx !== -1) {
                      const msg = history[idx];
                      const newLogs = [...(msg.metadata?.logs || []), ...lines];

                      const updatedMsg = {
                        ...msg,
                        metadata: { ...msg.metadata, logs: newLogs }
                      };

                      history[idx] = updatedMsg;
                      saveMessageToDB(updatedMsg);
                      io.to('default-room').emit('chat-message-update', updatedMsg);
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
              let text = `✅ **Deployed** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              if (commitHash) text += ` \`${commitHash}\``;
              text += ' — Refresh for updates!';
              systemMessage = text;
              systemType = 'deploy-success';
            }
            // Failure Events
            else if (type === 'Build.failed' || type === 'Deployment.failed' || type === 'Deployment.crashed') {
              let text = `❌ **Deploy Failed** *${serviceName}*`;
              if (commitMessage) text += `: "${commitMessage}"`;
              systemMessage = text;
              systemType = 'deploy-fail';
            }
          }
          // --- GitHub Push ---
          else if (payload.pusher) {
            const pusher = payload.pusher.name;
            const commitMsg = payload.head_commit?.message?.split('\n')[0] || 'No commit message'; // First line only
            const commitUrl = payload.head_commit?.url || '#';
            const shortHash = payload.head_commit?.id?.substring(0, 7) || '???';
            const branch = payload.ref?.replace('refs/heads/', '') || 'main';
            const totalCommits = payload.commits?.length || 1;

            let text = `💾 **${pusher}** pushed ${totalCommits > 1 ? `${totalCommits} commits` : ''} to \`${branch}\``;
            text += `: "${commitMsg}" [\`${shortHash}\`](${commitUrl})`;
            systemMessage = text;
            systemType = 'git-push';
            metadata = { pusher, commitMsg, branch, commitUrl, shortHash, totalCommits };
          }
          // --- Generic Text Fallback ---
          else if (type && type.startsWith('VolumeAlert')) {
            // Enable for testing connectivity - TEMPORARILY
            // systemMessage = `📢 **Test Notification**: Volume Alert (${payload.severity || 'test'})`; 
            // systemType = 'info';
          }
          else if (payload.message) {
            systemMessage = `📢 **System**: ${payload.message}`;
            systemType = 'info';
          }

          // 2. Broadcast to Chat
          if (systemMessage) {
            let msgId = `sys-${Date.now()}`;
            let isUpdate = false;

            // Attempt to find existing "Deploying" message to update
            if (systemType === 'deploy-success' || systemType === 'deploy-fail') {
              // Searching for a "deploy-start" message within the last 30 minutes
              // that matches this project/environment?
              // Actually just searched for the last "deploy-start" message?
              // Let's filter by project name if possible, or just take the last system message of that type.
              const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
              const existingStartMsg = messageHistory['default-room']
                ?.slice()
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

            // Preserve logs if updating
            let existingLogs = [];
            if (isUpdate && existingStartMsg?.metadata?.logs) {
              existingLogs = existingStartMsg.metadata.logs;
            }

            const msg = {
              roomId: 'default-room',
              id: msgId,
              sender: 'System',
              text: systemMessage,
              type: 'system',
              systemType: systemType,
              metadata: { ...metadata, logs: existingLogs },
              timestamp: new Date().toISOString()
            };

            // Track active deployment message for log appending
            if (systemType === 'deploy-start' && metadata?.deploymentId) {
              activeDeployments.set(metadata.deploymentId, msgId);
            }

            if (isUpdate) {
              // Update in history
              const history = messageHistory['default-room'];
              if (history) {
                const idx = history.findIndex(m => m.id === msgId);
                if (idx !== -1) {
                  history[idx] = { ...history[idx], ...msg }; // Merge to keep other props
                }
              }
              saveMessageToDB(msg); // Persist to DB
              if (io) io.to('default-room').emit('chat-message-update', msg);
              console.log(`[Webhook] 🔄 Updated message ${msgId}:`, systemMessage);
            } else {
              storeMessage('default-room', msg);
              if (io) io.to('default-room').emit('chat-message', msg);
              console.log('[Webhook] 📢 Broadcasted:', systemMessage);
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

  const getBundle = (roomId, type) => {
    if (!messageBundles.has(roomId)) messageBundles.set(roomId, {});
    const roomBundles = messageBundles.get(roomId);

    const bundle = roomBundles[type];
    if (bundle) {
      const now = Date.now();
      if (now - bundle.timestamp < 60000) { // 60s window
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

  // --- Backfill Build Logs (if missed during restart) ---
  checkAndBackfillLogs(io);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Handle room joining (Unified)
    socket.on('join-room', ({ roomId, user, ircConfig }) => {
      console.log(`👤 User ${user.name} (${socket.id}) joining room ${roomId}`);

      socket.join(roomId);

      // Store user data on socket
      socket.data.user = user;
      socket.data.roomId = roomId;

      // Initialize room logic
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      if (!messageHistory[roomId]) {
        messageHistory[roomId] = [];
      }

      const room = rooms.get(roomId);

      // Notify existing users
      const existingUsers = Array.from(room.entries()).map(([socketId, userData]) => ({
        socketId,
        user: userData
      }));

      // Add user to room map
      room.set(socket.id, user);

      // Send initial data to joining user
      socket.emit("existing-users", { users: existingUsers });
      socket.emit("chat-history", messageHistory[roomId] || []); // Send history

      // Notify others
      socket.to(roomId).emit("user-joined", { socketId: socket.id, user });
      socket.to(roomId).emit("user-connected", { socketId: socket.id, user }); // Keep compatibility

      // System Message: Join
      // System Message: Join (Smart Bundling)
      const activeBundle = getBundle(roomId, 'join');
      let joinMsgId;
      const userMeta = { ...user, action: 'joined', timestamp: Date.now() };

      if (activeBundle) {
        joinMsgId = activeBundle.id;
        if (!activeBundle.users.some(u => u.name === user.name)) {
          activeBundle.users.push(userMeta);
        }
        const uniqueUsers = activeBundle.users.length;

        const updateMsg = {
          id: joinMsgId,
          roomId,
          sender: 'System',
          text: `${uniqueUsers} Users popped in!`,
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
        joinMsgId = `sys-${Date.now()}`;
        const users = [userMeta];
        const joinMsg = {
          roomId,
          id: joinMsgId,
          sender: 'System',
          text: `${user.name} popped in!`,
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
        username: 'camrooms_' + user.name.slice(0, 8),
        channel: '#camsrooms',
        useIRC: true
      };

      const bridgeOptions = {
        shouldIgnoreSender: (senderNick) => {
          // Ignore messages from anyone currently connected to this room via Web
          const r = rooms.get(roomId);
          if (!r) return false;
          for (const u of r.values()) {
            if (u.ircNick === senderNick) return true;
          }
          return false;
        }
      };

      /* 
      // DISABLED: User IRC connections now handled client-side to prevent G-lines
      queueIrcConnection(socket, user, userIrcConfig, (err, bridge) => {
        if (err) {
          console.error(`[IRC] Failed to create bridge for ${user.name}:`, err);
          socket.emit('irc-error', { message: 'IRC connection queued - please wait' });
        } else {
          console.log(`[IRC] ✅ Bridge created for ${user.name}`);
        }
      }, bridgeOptions);
      */

      console.log(`✅ ${user.name} joined room. Total users: ${room.size}`);
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
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);

      const room = rooms.get(roomId);
      let userName = 'Someone';
      if (room) {
        const u = room.get(socket.id);
        if (u) userName = u.name;
        room.delete(socket.id);
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
          text: `💨 ${userName} floated away...`,
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

    // Tube Sync Handlers
    socket.on('tube-request-state', () => {
      // If there's no owner, and we have a video, requester can be owner
      if (!tubeState.ownerId && tubeState.videoId) {
        tubeState.ownerId = socket.id;
      }
      socket.emit('tube-state', { ...tubeState, serverTime: Date.now() });
    });

    socket.on('tube-update', (newState) => {
      // Security: Only the owner should be able to update progress heartbeats,
      // but anyone can change the video or toggle play/pause (Collaborative DJ).
      // If there's no owner, the first person to update takes it.
      if (!tubeState.ownerId) {
        tubeState.ownerId = socket.id;
      }

      if (newState.videoId !== undefined) tubeState.videoId = newState.videoId;
      if (newState.isPlaying !== undefined) tubeState.isPlaying = newState.isPlaying;
      if (newState.timestamp !== undefined) tubeState.timestamp = newState.timestamp;

      // If the update includes an ownerId, only respect it if intentionally handed over
      // For now, we allow anyone to become owner if they send an update and CURRENT owner is missing.

      tubeState.lastUpdate = Date.now();
      // Broadcast with server's current clock to allow drift calculation
      io.to(roomId).emit('tube-state', { ...tubeState, serverTime: Date.now() });
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

    // Disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      const { roomId, user, joinMsgId } = socket.data;

      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            rooms.delete(roomId);
            tubeState.ownerId = null;
          } else if (tubeState.ownerId === socket.id) {
            const nextOwnerId = room.keys().next().value;
            tubeState.ownerId = nextOwnerId;
            console.log(`[Tube] Handed over ownership to ${nextOwnerId}`);
            io.to(roomId).emit('tube-state', { ...tubeState, serverTime: Date.now() });
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
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);

    // --- History Bot Implementation ---
    // Connects to IRC to log messages for history buffering.
    // Wrapped in try-catch to prevent crashes if IRC is unreachable.
    try {
      console.log('[HistoryBot] Initializing...');
      const historyConfig = {
        nick: 'ChatLogBot',
        username: 'cr_logger',
        channel: '#camsrooms',
        useIRC: true
      };

      const historyBridge = new IRCBridge(null, historyConfig, {
        io, // Broadcast IRC events to all connected clients
        onMessage: (message) => {
          let isWebUser = false;
          for (const room of rooms.values()) {
            for (const userData of room.values()) {
              if (userData.name === message.sender) {
                isWebUser = true;
                break;
              }
            }
            if (isWebUser) break;
          }

          if (isWebUser) {
            console.log(`[HistoryBot] 🛑 Filtered duplicate from Web User: ${message.sender}`);
            return;
          }

          if (!message.timestamp) message.timestamp = new Date().toISOString();
          console.log(`[HistoryBot] 💾 STORING IRC message from ${message.sender}: ${message.text}`);
          storeMessage('default-room', message);

          // Also broadcast IRC messages to all web clients
          io.emit('chat-message', message);
        }
      });

      historyBridge.connect();

      // Auto-Reconnect Logic for History Bot (only if client exists)
      if (historyBridge.client) {
        historyBridge.client.on('close', () => {
          console.warn('[HistoryBot] 🔴 Disconnected. Reconnecting in 10s...');
          setTimeout(() => {
            console.log('[HistoryBot] 🔄 Reconnecting...');
            try { historyBridge.connect(); } catch (e) { console.error('[HistoryBot] Reconnect failed:', e); }
          }, 10000);
        });

        historyBridge.client.on('error', (err) => {
          console.error('[HistoryBot] ⚠️ Error:', err);
        });
      }
    } catch (err) {
      console.error('[HistoryBot] ❌ Failed to initialize (non-fatal):', err);
    }
  });
});
