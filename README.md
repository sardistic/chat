# CamRooms - Next-Gen WebRTC & IRC Chat

A high-fidelity, Discord-inspired video chat application blending WebRTC peer-to-peer streaming with a robust IRC bridge. Built for performance, aesthetics, and community management.

## ✨ Features

### 🎥 Core Communications
- **WebRTC Video/Audio**: Low-latency mesh network for video/audio.
- **IRC Bridge**: Seamless integration with IRC (e.g., GameSurge) for text chat.
- **YouTube Sync**: Watch videos together in real-time (synced playback).
- **Screen Sharing**: Broadcast your screen to the room.

### 🛡️ Moderation & Safety (Mission Control)
- **Role System**: Owner, Admin, Moderator, User, Guest.
- **Actions**: Kick, Ban, Shadow Mute, Message Wiping.
- **Camera Control**: Moderators can force-disable cameras or ban broadcasting for specific users.
- **Safety Tools**: IP tracking, alt-detection, and block lists.

### 🎨 Immersive UI/UX
- **Interactive Backgrounds**:
  - **StarMap**: 3D WebGL galaxy with mouse interaction (Three.js).
  - **Fluid DotGrid**: Reactive particle systems.
  - **Performance Mode**: Low-resource static option.
- **Framer Motion**: Smooth entry/exit animations and draggable windows.
- **Glassmorphism**: Premium dark UI with blur effects.
- **Mobile Optimized**: Responsive layout with swipe/drag gestures.

### 👤 Identity & Customization
- **Profiles**: Custom avatars, banners, and bios.
- **Discord Integration**: Login with Discord to sync avatar and badges.
- **Room Settings**: Customize room name, icon, and banner.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Animations**: Framer Motion, Three.js, Vanta.js
- **Real-time**: Socket.IO + Redis Adapter
- **Database**: PostgreSQL (via Prisma ORM)
- **Styling**: TailwindCSS + CSS Modules
- **WebRTC**: SimplePeer
- **IRC**: irc-framework

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file with:
   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_SECRET="supersecret"
   DISCORD_CLIENT_ID="..."
   DISCORD_CLIENT_SECRET="..."
   IRC_HOST="irc.gamesurge.net"
   IRC_CHANNEL="#camrooms"
   ```

3. **Database**
   ```bash
   npx prisma db push
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## 🎮 IRC Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/join` | `/join #channel` | Join an IRC channel |
| `/nick` | `/nick Name` | Change your display name |
| `/me` | `/me waves` | Send an action message |
| `/msg` | `/msg User Hi` | Send private message (IRC only) |
| `/clear`| `/clear` | Clear local chat history |
| `/topic`| `/topic New Topic`| Set the channel topic |

## 📂 Architecture

The application uses a hybrid approach:
- **Signaling Server**: Socket.IO handles WebRTC handshakes and chat messages.
- **Mesh Topology**: Video/Audio is P2P (User-to-User).
- **Persistence**: Prisma/Postgres stores users, rooms, and moderation logs.
- **IRC Bot**: A server-side bot bridges socket messages to the IRC network.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT
