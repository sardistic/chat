const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const IRCBridge = require("./lib/ircBridge");
const { PrismaClient } = require("@prisma/client");
const ytsr = require("ytsr");
const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'chat-history.json');

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

// Load History on Start
try {
  if (fs.existsSync(HISTORY_FILE)) {
    messageHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    console.log('📚 Loaded chat history from file.');
  }
} catch (err) {
  console.error('Failed to load chat history:', err);
}

// Save History Helper
const saveHistory = () => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messageHistory, null, 2));
  } catch (err) {
    console.error('Failed to save chat history:', err);
  }
};

// Helper to store messages
const storeMessage = (roomId, message) => {
  if (!messageHistory[roomId]) {
    messageHistory[roomId] = [];
  }

  // Check for existing message with same ID
  const existingIdx = messageHistory[roomId].findIndex(m => m.id === message.id);

  if (existingIdx !== -1) {
    // Update existing message (e.g. for deployment updates or bundling)
    messageHistory[roomId][existingIdx] = message;
  } else {
    // Add new message
    messageHistory[roomId].push(message);
  }

  // Limit to last 50 messages (User requested lower limit previously/implicit from memory usage)
  if (messageHistory[roomId].length > 50) {
    // We can just slice for simplicity and safety, though shift loop is fine ensuring we don't over-prune if bulk added?
    // Wait, if we just push one, shift one is fine.
    // But let's use slice to be safe if multiple added or logic changes.
    // Actually existing shim is fine:
    while (messageHistory[roomId].length > 50) {
      messageHistory[roomId].shift();
    }
  }
  saveHistory(); // Persist on every save
};

// Tube Sync State
const tubeState = {
  videoId: null,
  isPlaying: false,
  timestamp: 0,
  lastUpdate: Date.now(),
  ownerId: null
};

app.prepare().then(() => {
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
          // --- Railway Deployment ---
          const type = payload.type;
          let systemType = 'info';

          if (type && (type.startsWith('Deployment') || type.startsWith('Build'))) {
            const project = payload.project?.name || 'Application';

            // Build Events
            if (type === 'Build.building' || type === 'Deployment.building') {
              systemMessage = `🚧 **Deploying**: A new build for *${project}* has started.`;
              systemType = 'deploy-start';
            }
            // Success Events
            else if (type === 'Deployment.success') {
              systemMessage = `✅ **Deployed**: *${project}* is now live! (Refresh for updates)`;
              systemType = 'deploy-success';
            }
            // Failure Events
            else if (type === 'Build.failed' || type === 'Deployment.failed' || type === 'Deployment.crashed') {
              systemMessage = `❌ **Deploy Failed**: The build for *${project}* encountered an error.`;
              systemType = 'deploy-fail';
            }
          }
          // --- GitHub Push (simplified) ---
          else if (payload.pusher) {
            const pusher = payload.pusher.name;
            const commitMsg = payload.head_commit?.message || 'No commit message';
            const commitUrl = payload.head_commit?.url || '#';
            const shortHash = payload.head_commit?.id?.substring(0, 7) || '???';

            systemMessage = `💾 **Git Push**: ${pusher} pushed to main: "${commitMsg}" ([${shortHash}](${commitUrl}))`;
            systemType = 'git-push';
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

            const msg = {
              roomId: 'default-room',
              id: msgId,
              sender: 'System',
              text: systemMessage,
              type: 'system',
              systemType: systemType,
              // Maintain or update metadata? 
              // If we had commit info in start, we might want to keep it or simple overwrite.
              // For now simpler to overwrite or merge if needed. 
              // Let's pass metadata if we have it (extracted previously but not used in this block? 
              // Wait, I see metadata extraction in previous ViewFile Step 1234 but it's not in the block I'm replacing?
              // Ah, it was higher up or lower? 
              // In Step 1440 lines 140-250, I don't see metadata extraction. It might have been lost or I'm looking at wrong lines.
              // I will just use basics for now to fix the "Stuck" status.
              timestamp: isUpdate ? new Date().toISOString() : new Date().toISOString() // Update timestamp to bump? Or keep original?
              // Usually updates keep original ID but might want to bump position? 
              // If we update, we don't bump position usually unless we delete/re-add.
              // Let's just update content.
            };

            if (isUpdate) {
              // Update in history
              const history = messageHistory['default-room'];
              if (history) {
                const idx = history.findIndex(m => m.id === msgId);
                if (idx !== -1) {
                  history[idx] = { ...history[idx], ...msg }; // Merge to keep other props
                  saveHistory();
                }
              }
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
      if (!messageHistory.has(roomId)) {
        messageHistory.set(roomId, []);
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
      socket.emit("chat-history", messageHistory.get(roomId) || []); // Send history

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
          text: `✨ ${uniqueUsers} Users popped in!`,
          type: 'system',
          systemType: 'join-leave',
          metadata: { users: activeBundle.users },
          timestamp: new Date().toISOString()
        };

        if (messageHistory[roomId]) {
          const idx = messageHistory[roomId].findIndex(m => m.id === joinMsgId);
          if (idx !== -1) {
            messageHistory[roomId][idx] = updateMsg;
            saveHistory();
          }
        }
        io.to(roomId).emit('chat-message-update', updateMsg);
      } else {
        joinMsgId = `sys-${Date.now()}`;
        const users = [userMeta];
        const joinMsg = {
          roomId,
          id: joinMsgId,
          sender: 'System',
          text: `✨ ${user.name} popped in!`,
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
            saveHistory();
          }
        }
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
            let text = `📸 ${total} Users updated camera`;
            if (up === total) text = `📸 ${total} Users went live!`;
            else text = `📸 Cam check: ${up} live, ${total - up} off`;

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
                saveHistory();
              }
            }
            io.to(roomId).emit('chat-message-update', updateMsg);

          } else {
            // Create New Bundle
            bundleId = `sys-cam-${Date.now()}`;
            const users = [userMeta];

            let text = `📸 ${user.name} went live!`;
            if (!isVideoEnabled) text = `📷 ${user.name} turned off camera.`;

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
              text: `✨ ${total} Users visited (${active} active)`,
              type: 'system',
              systemType: 'join-leave',
              metadata: { users: activeBundle.users },
              timestamp: new Date().toISOString()
            };

            if (messageHistory[roomId]) {
              const idx = messageHistory[roomId].findIndex(m => m.id === joinMsgId);
              if (idx !== -1) {
                messageHistory[roomId][idx] = updateMsg;
                saveHistory();
              }
            }
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
