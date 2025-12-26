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

    // Join room
    socket.on("join-room", ({ roomId, user }) => {
      console.log(`👤 User ${user.name} (${socket.id}) joining room ${roomId}`);

      // Join the Socket.IO room
      socket.join(roomId);

      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      // Ensure history exists (handled by storeMessage, but good for empty rooms)
      if (!messageHistory.has(roomId)) {
        messageHistory.set(roomId, []);
      }

      const room = rooms.get(roomId);

      // Get existing users in room before adding new user
      const existingUsers = Array.from(room.entries()).map(([socketId, userData]) => ({
        socketId,
        user: userData
      }));

      console.log(`📋 Sending ${existingUsers.length} existing users to ${user.name}`);

      // Add user to room
      room.set(socket.id, user);

      // Send existing users to the new user
      socket.emit("existing-users", { users: existingUsers });

      // Send chat history to the new user
      const history = messageHistory.get(roomId) || [];
      socket.emit("chat-history", history);

      // Notify existing users about new user
      socket.to(roomId).emit("user-joined", { socketId: socket.id, user });

      console.log(`✅ ${user.name} joined room. Total users in room: ${room.size}`);

      // Store current room in socket data
      socket.data.roomId = roomId;
      socket.data.user = user;
    });

    // Leave room
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room ${roomId}`);

      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
          // Optional: clear history when room is empty? 
          // Keeping it for now so re-joining persistence works comfortably.
        }
      }

      socket.to(roomId).emit("user-left", { socketId: socket.id });
    });

    // WebRTC signaling
    socket.on("signal", (data) => {
      // data = { target: socketId, payload: ... }
      io.to(data.target).emit("signal", {
        sender: socket.id,
        payload: data.payload
      });
    });

    // Chat messages
    socket.on("chat-message", (message) => {
      // Store in history
      storeMessage(message.roomId, message);

      // Broadcast to everyone in the room including sender
      io.to(message.roomId).emit("chat-message", message);

      // Relay to IRC if bridge is connected and message is not from IRC
      if (ircBridge && !message.source) {
        ircBridge.sendToIRC(message);
      }
    });

    // Typing indicators
    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("user-typing", { user });
    });

    socket.on("stop-typing", ({ roomId }) => {
      socket.to(roomId).emit("user-stop-typing", { user: socket.data.user?.name });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

      // Remove from all rooms
      const roomId = socket.data.roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            rooms.delete(roomId);
          }
        }

        // Notify room members
        socket.to(roomId).emit("user-left", { socketId: socket.id });
      }
    });
  });

  // Initialize IRC bridge
  ircBridge = new IRCBridge(io, storeMessage);
  ircBridge.connect();
  console.log('IRC bridge initialized');

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

