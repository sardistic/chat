# CamRooms - WebRTC Video Chat with IRC Integration

A modern, Discord-style video chat application with WebRTC peer-to-peer connections and IRC bridge integration.

## Features

- 🎥 **WebRTC Video/Audio** - Peer-to-peer video and audio streaming
- 💬 **Real-time Chat** - Socket.IO powered messaging
- 🌐 **IRC Bridge** - Connect to GameSurge IRC network
- 🎨 **Modern UI** - Glassmorphism design with smooth animations
- 🎛️ **Media Controls** - Mute/unmute, video toggle, leave room
- 👥 **User Presence** - Online status and participant tracking
- ⌨️ **IRC Commands** - KiwiIRC-style command support

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

Open http://localhost:3000 in your browser.

## IRC Commands

The chat supports KiwiIRC-style IRC commands:

### Channel Commands
- `/join #channel` - Join an IRC channel
- `/part [#channel]` - Leave current or specified channel
- `/topic [new topic]` - View or set channel topic
- `/names [#channel]` - List users in channel

### Messaging Commands
- `/msg nick message` - Send private message to user
- `/me action` - Send action message (e.g., `/me waves`)

### User Commands
- `/nick newnick` - Change your nickname
- `/whois nick` - Get information about a user
- `/quit [message]` - Disconnect from IRC

### Examples

```
/join #camrooms
/nick MyNewNick
/me is testing the chat
/msg SomeUser Hello there!
/topic Welcome to CamRooms!
```

## IRC Configuration

By default, the app connects to:
- **Server**: irc.gamesurge.net
- **Port**: 6667
- **Channel**: #camrooms

You can customize these via environment variables:

```bash
IRC_HOST=irc.gamesurge.net
IRC_PORT=6667
IRC_CHANNEL=#camrooms
IRC_NICK=CamRoomsBot
```

## Architecture

### Frontend
- **Next.js 16** - React framework
- **React 19** - UI library
- **SimplePeer** - WebRTC wrapper
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - Server runtime
- **Socket.IO** - WebSocket server
- **irc-framework** - IRC client library

### WebRTC Flow

```
User A                    Server                    User B
  |                         |                         |
  |--- join-room ---------->|                         |
  |<-- existing-users -------|                         |
  |                         |<------- join-room ------|
  |<-- user-joined ---------|--------- user-joined -->|
  |                         |                         |
  |--- signal (offer) ------>|                         |
  |                         |------- signal (offer) -->|
  |                         |<-- signal (answer) ------|
  |<-- signal (answer) ------|                         |
  |                         |                         |
  |<========= WebRTC P2P Connection ================>|
```

### IRC Bridge Flow

```
Web Chat                IRC Bridge              GameSurge IRC
   |                         |                         |
   |--- chat-message ------->|                         |
   |                         |--- PRIVMSG ------------>|
   |                         |<-- PRIVMSG -------------|
   |<-- chat-message --------|                         |
   |                         |                         |
   |--- /join #test -------->|                         |
   |                         |--- JOIN #test --------->|
   |<-- irc-command-result --|                         |
```

## File Structure

```
chat/
├── app/
│   ├── page.js           # Main application
│   ├── layout.js         # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── VideoGrid.js      # Video tile grid
│   ├── ChatPanel.js      # Chat interface
│   ├── MediaControls.js  # Audio/video controls
│   ├── EntryScreen.js    # Join screen
│   └── Sidebar.js        # User list sidebar
├── hooks/
│   ├── useWebRTC.js      # WebRTC hook
│   └── useChat.js        # Chat hook
├── lib/
│   ├── socket.js         # Socket.IO context
│   ├── webrtc.js         # Peer manager
│   └── ircBridge.js      # IRC bridge
└── server.js             # Express + Socket.IO server
```

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari (macOS/iOS)
- ⚠️ Opera (Partial support)

## Known Limitations

1. **Mesh Topology**: Works best with 2-8 users. For larger groups, consider implementing an SFU (like Janus).
2. **STUN Only**: Uses public STUN servers. Add TURN servers for better NAT traversal in production.
3. **Single Room**: Currently supports one default room. Multi-room support planned.

## Development

### Adding New IRC Commands

Edit `lib/ircBridge.js` and add to the `handleCommand` method:

```javascript
case 'mycommand':
  if (args.length > 0) {
    // Your command logic
    return { success: true, message: 'Command executed' };
  }
  return { success: false, error: 'Usage: /mycommand args' };
```

### Customizing UI

Edit `app/globals.css` to modify colors, animations, and layout.

## License

MIT

## Credits

Built with:
- [SimplePeer](https://github.com/feross/simple-peer)
- [Socket.IO](https://socket.io/)
- [irc-framework](https://github.com/kiwiirc/irc-framework)
- [Next.js](https://nextjs.org/)
