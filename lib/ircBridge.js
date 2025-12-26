const IRC = require('irc-framework');

class IRCBridge {
    constructor(io, messageHandler) {
        this.io = io;
        this.messageHandler = messageHandler;
        this.client = null;
        this.isConnected = false;
        this.currentChannel = '#camrooms';
        this.config = {
            host: process.env.IRC_HOST || 'irc.gamesurge.net',
            port: process.env.IRC_PORT || 6667,
            nick: process.env.IRC_NICK || 'CamRoomsBot',
            username: process.env.IRC_USERNAME || 'camrooms',
            gecos: process.env.IRC_GECOS || 'CamRooms WebRTC Chat Bridge',
            channel: process.env.IRC_CHANNEL || '#camrooms',
        };

        this.userMapping = new Map(); // socketId -> IRC nick
        this.ircToSocket = new Map(); // IRC nick -> socketId
        this.channels = new Set(); // Joined channels
        this.channelUsers = new Map(); // channel -> Set of users
    }

    connect() {
        console.log(`[IRC] Connecting to ${this.config.host}:${this.config.port} as ${this.config.nick}`);
        console.log(`[IRC] Channel: ${this.config.channel}, Username: ${this.config.username}`);

        this.client = new IRC.Client();

        this.client.connect({
            host: this.config.host,
            port: this.config.port,
            nick: this.config.nick,
            username: this.config.username,
            gecos: this.config.gecos,
        });

        // Debug: Log raw events to catch handshake issues
        this.client.on('raw', (event) => {
            // Only log errors or specific codes to avoid spam
            if (event.command === 'ERROR' || event.command === '433' || event.command === '432') {
                console.error('[IRC_RAW_ERROR]', event);
            }
        });

        // Handle successful connection
        this.client.on('registered', () => {
            console.log('[IRC] Connected and Registered!');
            this.isConnected = true;
            this.client.join(this.config.channel);
            this.channels.add(this.config.channel);
            this.currentChannel = this.config.channel;
        });

        // Handle incoming messages
        this.client.on('privmsg', (event) => {
            if (event.target.startsWith('#')) {
                // Channel message
                const message = {
                    id: Date.now() + Math.random(),
                    roomId: 'default-room',
                    text: event.message,
                    sender: event.nick,
                    senderColor: this.generateColorFromNick(event.nick),
                    timestamp: new Date().toISOString(),
                    source: 'irc',
                    channel: event.target,
                };

                // Persist the message if handler is provided
                if (this.messageHandler) {
                    this.messageHandler('default-room', message);
                }

                this.io.to('default-room').emit('chat-message', message);
            }
        });

        // Handle user joins
        this.client.on('join', (event) => {
            if (event.nick !== this.config.nick) {
                console.log(`IRC user joined ${event.channel}: ${event.nick}`);

                // Track channel users
                if (!this.channelUsers.has(event.channel)) {
                    this.channelUsers.set(event.channel, new Set());
                }
                this.channelUsers.get(event.channel).add(event.nick);

                // Notify web clients
                this.io.to('default-room').emit('irc-user-joined', {
                    nick: event.nick,
                    channel: event.channel,
                });
            }
        });

        // Handle user parts
        this.client.on('part', (event) => {
            console.log(`IRC user left ${event.channel}: ${event.nick}`);

            if (this.channelUsers.has(event.channel)) {
                this.channelUsers.get(event.channel).delete(event.nick);
            }

            this.io.to('default-room').emit('irc-user-left', {
                nick: event.nick,
                channel: event.channel,
            });
        });

        // Handle user quits
        this.client.on('quit', (event) => {
            console.log(`IRC user quit: ${event.nick}`);

            // Remove from all channels
            this.channelUsers.forEach((users) => {
                users.delete(event.nick);
            });
        });

        // Handle nick changes
        this.client.on('nick', (event) => {
            console.log(`IRC nick change: ${event.nick} -> ${event.new_nick}`);

            this.io.to('default-room').emit('irc-nick-change', {
                oldNick: event.nick,
                newNick: event.new_nick,
            });
        });

        // Handle channel user list
        this.client.on('userlist', (event) => {
            console.log(`User list for ${event.channel}:`, event.users.map(u => u.nick));

            const users = event.users.map(u => ({
                nick: u.nick,
                modes: u.modes,
            }));

            this.channelUsers.set(event.channel, new Set(users.map(u => u.nick)));

            this.io.to('default-room').emit('irc-userlist', {
                channel: event.channel,
                users,
            });
        });

        // Handle topic
        this.client.on('topic', (event) => {
            console.log(`Topic for ${event.channel}: ${event.topic}`);

            this.io.to('default-room').emit('irc-topic', {
                channel: event.channel,
                topic: event.topic,
            });
        });

        // Handle errors
        this.client.on('error', (err) => {
            console.error('IRC error:', err);
        });

        // Handle disconnection
        this.client.on('close', () => {
            console.log('Disconnected from IRC');
            this.isConnected = false;

            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                console.log('Attempting to reconnect to IRC...');
                this.connect();
            }, 5000);
        });
    }

    // Handle IRC commands from web clients (KiwiIRC-style)
    handleCommand(command, args, socketId) {
        if (!this.isConnected || !this.client) {
            return { success: false, error: 'Not connected to IRC' };
        }

        switch (command.toLowerCase()) {
            case 'join':
                if (args.length > 0) {
                    const channel = args[0].startsWith('#') ? args[0] : '#' + args[0];
                    this.client.join(channel);
                    this.channels.add(channel);
                    this.currentChannel = channel;
                    return { success: true, message: `Joining ${channel}...` };
                }
                return { success: false, error: 'Usage: /join #channel' };

            case 'part':
            case 'leave':
                const channel = args.length > 0 ? args[0] : this.currentChannel;
                this.client.part(channel);
                this.channels.delete(channel);
                return { success: true, message: `Left ${channel}` };

            case 'nick':
                if (args.length > 0) {
                    this.client.changeNick(args[0]);
                    return { success: true, message: `Changing nick to ${args[0]}...` };
                }
                return { success: false, error: 'Usage: /nick newnick' };

            case 'msg':
            case 'query':
                if (args.length >= 2) {
                    const target = args[0];
                    const message = args.slice(1).join(' ');
                    this.client.say(target, message);
                    return { success: true, message: `Message sent to ${target}` };
                }
                return { success: false, error: 'Usage: /msg nick message' };

            case 'me':
                if (args.length > 0) {
                    const action = args.join(' ');
                    this.client.action(this.currentChannel, action);
                    return { success: true };
                }
                return { success: false, error: 'Usage: /me action' };

            case 'topic':
                if (args.length > 0) {
                    const topic = args.join(' ');
                    this.client.setTopic(this.currentChannel, topic);
                    return { success: true, message: `Setting topic...` };
                } else {
                    // Just request current topic
                    this.client.raw('TOPIC', this.currentChannel);
                    return { success: true };
                }

            case 'names':
                const namesChannel = args.length > 0 ? args[0] : this.currentChannel;
                this.client.raw('NAMES', namesChannel);
                return { success: true };

            case 'whois':
                if (args.length > 0) {
                    this.client.whois(args[0]);
                    return { success: true, message: `Requesting WHOIS for ${args[0]}...` };
                }
                return { success: false, error: 'Usage: /whois nick' };

            case 'quit':
                const quitMsg = args.length > 0 ? args.join(' ') : 'Leaving';
                this.client.quit(quitMsg);
                return { success: true, message: 'Disconnecting...' };

            default:
                return { success: false, error: `Unknown command: /${command}` };
        }
    }

    // Send message from WebSocket to IRC
    sendToIRC(message) {
        if (this.isConnected && this.client) {
            // Check if it's a command
            if (message.text.startsWith('/')) {
                const parts = message.text.slice(1).split(' ');
                const command = parts[0];
                const args = parts.slice(1);

                const result = this.handleCommand(command, args, message.socketId);

                // Send result back to user
                this.io.to('default-room').emit('irc-command-result', result);

                return;
            }

            // Regular message
            const formattedMessage = `<${message.sender}> ${message.text}`;
            this.client.say(this.currentChannel, formattedMessage);
        }
    }

    // Generate consistent color from IRC nickname
    generateColorFromNick(nick) {
        let hash = 0;
        for (let i = 0; i < nick.length; i++) {
            hash = nick.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colors = [
            '#00f3ff', // cyan
            '#bc13fe', // purple
            '#ff0055', // pink
            '#00ff00', // green
            '#ffff00', // yellow
            '#ff6b35', // orange
            '#4ecdc4', // teal
            '#95e1d3', // mint
        ];

        return colors[Math.abs(hash) % colors.length];
    }

    disconnect() {
        if (this.client) {
            this.client.quit('Bridge shutting down');
            this.client = null;
            this.isConnected = false;
        }
    }
}

module.exports = IRCBridge;
