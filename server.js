const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const IRCBridge = require("./lib/ircBridge");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active rooms and users
const rooms = new Map(); // roomId -> Set of { socketId, user }
let ircBridge = null; // IRC bridge instance

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

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

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

      // Initialize Per-User IRC Bridge
      if (ircConfig && ircConfig.useIRC) {
        try {
          console.log(`[Server] Initializing IRC Bridge for ${user.name}`);
          const bridge = new IRCBridge(socket, ircConfig);
          bridge.connect();
          socket.data.ircBridge = bridge;
        } catch (err) {
          console.error('[Server] Failed to init IRC bridge:', err);
          socket.emit('irc-error', { message: 'Failed to initialize bridge' });
        }
      }

      console.log(`✅ ${user.name} joined room. Total users: ${room.size}`);
    });

    // Handle Leave
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);

      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(roomId);
      }

      socket.to(roomId).emit("user-left", { socketId: socket.id });
      socket.to(roomId).emit("user-disconnected", socket.id);

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

    // Chat Messages
    socket.on('chat-message', (message) => {
      if (!message.timestamp) message.timestamp = new Date().toISOString();

      storeMessage(message.roomId, message);
      io.to(message.roomId).emit('chat-message', message);

      if (socket.data.ircBridge) {
        socket.data.ircBridge.sendToIRC(message);
      }
    });

    // Typing
    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("user-typing", { user });
    });

    socket.on("stop-typing", ({ roomId }) => {
      socket.to(roomId).emit("user-stop-typing", { user: socket.data.user?.name });
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
        if (user) console.log(`User left room ${roomId}:`, user.name);
      }

      // Cleanup IRC
      if (socket.data.ircBridge) {
        console.log(`[Server] Disconnecting IRC Bridge for ${user?.name}`);
        socket.data.ircBridge.disconnect();
        socket.data.ircBridge = null;
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

