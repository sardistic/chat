const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const IRCBridge = require("./lib/ircBridge");
const { PrismaClient } = require("@prisma/client");

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
const messageHistory = new Map(); // roomId -> Array of messages

// Helper to store messages
const storeMessage = (roomId, message) => {
  if (!messageHistory.has(roomId)) {
    messageHistory.set(roomId, []);
  }
  const history = messageHistory.get(roomId);
  history.push(message);

  // Limit to last 200 messages
  if (history.length > 200) {
    history.shift(); // Remove oldest
  }
};

// Tube Sync State
const tubeState = {
  videoId: null,
  isPlaying: false,
  timestamp: 0,
  lastUpdate: Date.now()
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
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
      const joinMsg = {
        roomId,
        id: `sys-${Date.now()}`,
        sender: 'System',
        text: `✨ ${user.name} popped in!`,
        type: 'system',
        timestamp: new Date().toISOString()
      };
      storeMessage(roomId, joinMsg);
      io.to(roomId).emit('chat-message', joinMsg);

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

      queueIrcConnection(socket, user, userIrcConfig, (err, bridge) => {
        if (err) {
          console.error(`[IRC] Failed to create bridge for ${user.name}:`, err);
          socket.emit('irc-error', { message: 'IRC connection queued - please wait' });
        } else {
          console.log(`[IRC] ✅ Bridge created for ${user.name}`);
        }
      }, bridgeOptions);

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
      const leaveMsg = {
        roomId,
        id: `sys-${Date.now()}`,
        sender: 'System',
        text: `💨 ${userName} floated away...`,
        type: 'system',
        timestamp: new Date().toISOString()
      };
      storeMessage(roomId, leaveMsg);
      io.to(roomId).emit('chat-message', leaveMsg);

      // Cleanup IRC
      if (socket.data.ircBridge) {
        socket.data.ircBridge.disconnect();
        socket.data.ircBridge = null;
      }
    });

    // Update User Status (Audio/Video/Deaf)
    socket.on('update-user', (updates) => {
      const { roomId, user } = socket.data;
      if (!roomId || !rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      if (room && room.has(socket.id)) {
        const currentUser = room.get(socket.id);
        const updatedUser = { ...currentUser, ...updates };
        room.set(socket.id, updatedUser);
        socket.data.user = updatedUser; // Update socket data too

        socket.to(roomId).emit('user-updated', { socketId: socket.id, user: updatedUser });
      }
    });

    // WebRTC Signaling
    socket.on("signal", (data) => {
      io.to(data.target).emit("signal", {
        sender: socket.id,
        payload: data.payload
      });
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
      socket.emit('tube-state', tubeState);
    });

    socket.on('tube-update', (newState) => {
      // Merge state
      if (newState.videoId !== undefined) tubeState.videoId = newState.videoId;
      if (newState.isPlaying !== undefined) tubeState.isPlaying = newState.isPlaying;
      if (newState.timestamp !== undefined) tubeState.timestamp = newState.timestamp;
      tubeState.lastUpdate = Date.now();

      // Broadcast to everyone in room including sender (to confirm sync)
      io.to(roomId).emit('tube-state', tubeState);
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
      const { roomId, user } = socket.data;

      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) rooms.delete(roomId);
        }
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        socket.to(roomId).emit("user-disconnected", socket.id);

        // System Message: Disconnect
        if (user) {
          console.log(`User left room ${roomId}:`, user.name);
          const leaveMsg = {
            roomId,
            id: `sys-${Date.now()}`,
            sender: 'System',
            text: `💨 ${user.name} floated away...`,
            type: 'system',
            timestamp: new Date().toISOString()
          };
          storeMessage(roomId, leaveMsg);
          io.to(roomId).emit('chat-message', leaveMsg);
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

