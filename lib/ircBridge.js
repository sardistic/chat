const IRC = require('irc-framework');

class IRCBridge {
    constructor(socket, userConfig, options = {}) {
        this.socket = socket;
        this.io = options.io || null; // For broadcasting to all clients
        this.client = null;
        this.isConnected = false;
        this.onMessage = options.onMessage || null;
        this.shouldIgnoreSender = options.shouldIgnoreSender || null;

        // Merge defaults with user config, allow user to override
        this.config = {
            host: userConfig.host || process.env.IRC_HOST || 'testnet.ergo.chat',
            port: userConfig.port || process.env.IRC_PORT || 6697,
            nick: userConfig.nick || `Guest_${Math.floor(Math.random() * 1000)}`,
            username: userConfig.username || 'camrooms_user',
            gecos: 'CamRooms User',
            channel: userConfig.channel || '#camrooms-general',
            tls: userConfig.tls !== undefined ? userConfig.tls : true,
            isBot: userConfig.isBot || false
        };

        // Ensure channel has #
        if (!this.config.channel.startsWith('#')) {
            this.config.channel = '#' + this.config.channel;
        }

        this.currentChannel = this.config.channel;
        this.channels = new Set(); // Set of joined channels
        this.channelToRoom = new Map(); // IRC channel -> roomId mapping
        this.userList = new Map(); // nick -> { nick, modes }
    }

    // Join an IRC channel and map it to a room
    joinChannel(ircChannel, roomId) {
        if (!this.isConnected || !this.client) {
            console.log(`[IRC] Cannot join ${ircChannel} - not connected`);
            return false;
        }

        // Normalize channel name
        if (!ircChannel.startsWith('#')) {
            ircChannel = '#' + ircChannel;
        }

        if (this.channels.has(ircChannel)) {
            console.log(`[IRC] Already in ${ircChannel}`);
            // Update mapping in case roomId changed
            this.channelToRoom.set(ircChannel.toLowerCase(), roomId);
            return true;
        }

        console.log(`[IRC] Joining channel ${ircChannel} for room ${roomId}`);
        this.client.join(ircChannel);
        this.channels.add(ircChannel);
        this.channelToRoom.set(ircChannel.toLowerCase(), roomId);
        return true;
    }

    // Get roomId from IRC channel
    getRoomId(ircChannel) {
        return this.channelToRoom.get(ircChannel.toLowerCase()) || 'general';
    }

    connect() {
        console.log(`[IRC-LINK] >> Establishing uplink to ${this.config.host}...`);

        this.client = new IRC.Client();

        this.client.connect({
            host: this.config.host,
            port: this.config.port,
            nick: this.config.nick,
            username: this.config.username,
            gecos: this.config.gecos,
            tls: this.config.tls,
        });

        // Debug: Log raw events to catch handshake issues
        this.client.on('raw', (event) => {
            if (event.command === 'ERROR') {
                console.log('[IRC-LINK] >> Connection error');
                if (this.socket) this.socket.emit('irc-error', event);
            }
            // Handle Nickname In Use (433)
            if (event.command === '433') {
                console.log('[IRC-LINK] >> Nick collision - rotating...');
                const newNick = this.config.nick + '_';
                if (this.socket && this.socket.data && this.socket.data.user) {
                    this.socket.data.user.ircNick = newNick;
                }
                this.config.nick = newNick;
                this.client.changeNick(newNick);
            }
        });

        // Handle successful connection
        this.client.on('registered', () => {
            console.log(`[IRC-LINK] >> Uplink established - ${this.config.nick} online`);
            this.isConnected = true;

            // Join initial channel
            this.client.join(this.config.channel);
            this.channels.add(this.config.channel);
            this.channelToRoom.set(this.config.channel.toLowerCase(), 'general');
            this.currentChannel = this.config.channel;

            if (this.socket) {
                this.socket.emit('irc-connected', {
                    nick: this.config.nick,
                    channel: this.config.channel
                });
            }
        });

        this.client.on('privmsg', (event) => {
            if (this.shouldIgnoreSender && this.shouldIgnoreSender(event.nick, event.target)) {
                return;
            }

            if (event.target.startsWith('#')) {
                // Look up the roomId for this IRC channel
                const roomId = this.getRoomId(event.target);

                const message = {
                    id: `irc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    roomId: roomId,
                    text: event.message,
                    sender: event.nick,
                    senderColor: this.generateColorFromNick(event.nick),
                    timestamp: new Date().toISOString(),
                    source: 'irc',
                    channel: event.target,
                };

                // Broadcast to correct room
                if (this.config.isBot && this.io) {
                    console.log(`[IRC] Broadcasting message from ${event.nick} in ${event.target} to room ${roomId}`);
                    this.io.to(roomId).emit('chat-message', message);
                } else if (this.socket) {
                    this.socket.emit('chat-message', message);
                }

                // Call callback for DB persistence (used by HistoryBot)
                if (this.onMessage) {
                    this.onMessage(message);
                }
            }
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const emit = (event, data) => {
            if (this.socket) {
                console.log(`[IRC] 📡 Emitting ${event} to socket`);
                this.socket.emit(event, data);
            } else if (this.io) {
                console.log(`[IRC] 📢 Broadcasting ${event} to all clients`);
                this.io.emit(event, data);
            } else {
                console.log(`[IRC] ⚠️ No socket or io available for ${event}`);
            }
        };

        // Handle user joins
        this.client.on('join', (event) => {
            if (event.nick !== this.config.nick) {
                this.userList.set(event.nick, { nick: event.nick, modes: [] });
                emit('irc-user-joined', {
                    nick: event.nick,
                    channel: event.channel,
                });
            }
        });

        // Handle user parts
        this.client.on('part', (event) => {
            this.userList.delete(event.nick);
            emit('irc-user-left', {
                nick: event.nick,
                channel: event.channel,
            });
        });

        // Handle user quits
        this.client.on('quit', (event) => {
            this.userList.delete(event.nick);
            emit('irc-user-left', { nick: event.nick });
        });

        // Handle nick changes
        this.client.on('nick', (event) => {
            const userData = this.userList.get(event.nick);
            if (userData) {
                this.userList.delete(event.nick);
                this.userList.set(event.new_nick, { ...userData, nick: event.new_nick });
            }
            emit('irc-nick-change', {
                oldNick: event.nick,
                newNick: event.new_nick,
            });
        });

        // Handle channel user list
        this.client.on('userlist', (event) => {
            console.log(`[IRC] 📋 Received userlist for ${event.channel}: ${event.users.length} users`);
            const users = event.users.map(u => ({
                nick: u.nick,
                modes: u.modes,
            }));

            // Sync local map
            this.userList.clear();
            users.forEach(u => this.userList.set(u.nick, u));

            emit('irc-userlist', {
                channel: event.channel,
                users,
            });
        });

        // Handle errors
        this.client.on('error', (err) => {
            console.error('[IRC_CLIENT_ERROR]', err);
        });

        // Handle disconnection
        this.client.on('close', () => {
            this.isConnected = false;
            emit('irc-disconnected');
        });
    }

    // Handle IRC commands from web clients
    handleCommand(command, args) {
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
                if (this.client) this.client.quit(quitMsg);
                return { success: true, message: 'Disconnecting...' };

            default:
                // Pass raw command
                this.client.raw(command, ...args);
                return { success: true, message: `Command ${command} sent` };
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

                const result = this.handleCommand(command, args);

                // Send result back to user
                this.socket.emit('irc-command-result', result);

                return;
            }

            // Regular message
            this.client.say(this.currentChannel, message.text);
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
