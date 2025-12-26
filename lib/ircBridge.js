const IRC = require('irc-framework');

class IRCBridge {
    constructor(socket, userConfig, options = {}) {
        this.socket = socket;
        this.client = null;
        this.isConnected = false;
        this.onMessage = options.onMessage || null;

        // Merge defaults with user config, allow user to override
        this.config = {
            host: userConfig.host || process.env.IRC_HOST || 'irc.gamesurge.net',
            port: userConfig.port || process.env.IRC_PORT || 6667,
            nick: userConfig.nick || `Guest_${Math.floor(Math.random() * 1000)}`,
            username: userConfig.username || 'camrooms_user',
            gecos: 'CamRooms User',
            channel: userConfig.channel || '#camrooms',
        };

        // Ensure channel has #
        if (!this.config.channel.startsWith('#')) {
            this.config.channel = '#' + this.config.channel;
        }

        this.currentChannel = this.config.channel;
        this.channels = new Set();
    }

    connect() {
        console.log(`[IRC] Connecting ${this.config.nick} to ${this.config.host}:${this.config.port}`);

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
            if (event.command === 'ERROR') {
                console.error(`[IRC_ERROR] ${this.config.nick}:`, event);
                if (this.socket) this.socket.emit('irc-error', event);
            }
            // Handle Nickname In Use (433)
            if (event.command === '433') {
                console.warn(`[IRC] Nickname ${this.config.nick} is in use. Retrying...`);
                const newNick = this.config.nick + '_';
                this.config.nick = newNick;
                this.client.changeNick(newNick);
            }
        });

        // Handle successful connection
        this.client.on('registered', () => {
            console.log(`[IRC] ${this.config.nick} Registered!`);
            this.isConnected = true;
            this.client.join(this.config.channel);
            this.channels.add(this.config.channel);
            this.currentChannel = this.config.channel;

            if (this.socket) {
                this.socket.emit('irc-connected', {
                    nick: this.config.nick,
                    channel: this.config.channel
                });
            }
        });

        // Handle incoming messages
        this.client.on('privmsg', (event) => {
            if (event.target.startsWith('#')) {
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
                // Emit ONLY to ownership socket if exists
                if (this.socket) {
                    this.socket.emit('chat-message', message);
                }

                // Call callback if exists (for logging bot)
                if (this.onMessage) {
                    this.onMessage(message);
                }
            }
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Handle user joins
        this.client.on('join', (event) => {
            if (event.nick !== this.config.nick && this.socket) {
                this.socket.emit('irc-user-joined', {
                    nick: event.nick,
                    channel: event.channel,
                });
            }
        });

        // Handle user parts
        this.client.on('part', (event) => {
            this.socket.emit('irc-user-left', {
                nick: event.nick,
                channel: event.channel,
            });
        });

        // Handle user quits
        this.client.on('quit', (event) => {
            this.socket.emit('irc-user-left', { nick: event.nick });
        });

        // Handle nick changes
        this.client.on('nick', (event) => {
            this.socket.emit('irc-nick-change', {
                oldNick: event.nick,
                newNick: event.new_nick,
            });
        });

        // Handle channel user list
        this.client.on('userlist', (event) => {
            const users = event.users.map(u => ({
                nick: u.nick,
                modes: u.modes,
            }));
            this.socket.emit('irc-userlist', {
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
            this.socket.emit('irc-disconnected');
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
