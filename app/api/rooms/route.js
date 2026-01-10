import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// GET /api/rooms - List all public rooms
// GET /api/rooms - List all public rooms
export async function GET() {
    try {
        const rooms = await prisma.room.findMany({
            where: { isPublic: true },
            orderBy: [
                { memberCount: 'desc' },
                { lastActive: 'desc' }
            ],
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                iconUrl: true,
                bannerUrl: true,
                ircChannel: true,
                memberCount: true,
                lastActive: true,
                createdAt: true,
                shortSummary: true,
                activityScore: true,
                creatorId: true,
                currentVideoId: true,
                currentVideoTitle: true,
                tags: true
            }
        });

        // Computed metadata (Server-side heuristic)
        const creatorIds = [...new Set(rooms.map(r => r.creatorId).filter(Boolean))];
        const creators = creatorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: creatorIds } },
                select: { id: true, name: true, displayName: true }
            })
            : [];

        const creatorMap = new Map(creators.map(u => [u.id, u.displayName || u.name || 'Unknown']));

        const enrichedRooms = await Promise.all(rooms.map(async (room) => {
            const now = new Date();
            const lastActive = new Date(room.lastActive);
            const diffMins = (now - lastActive) / 1000 / 60;

            // Dynamic Activity Score: strict time-decay
            // Score drops to 0 after 10 minutes of inactivity
            let score = Math.max(0, 100 - Math.floor(diffMins * 10));

            // Boost score for member count ONLY if room is recently active
            if (score > 0 && room.memberCount > 0) {
                score = Math.min(100, score + (room.memberCount * 5));
            }

            let summary = room.shortSummary;

            // Always analyze chat history for sentiment and summary
            let sentiment = 'Quiet';

            // Fetch recent messages for analysis (always, not just when members online)
            const recentMessages = await prisma.chatMessage.findMany({
                where: { roomId: room.id, isWiped: false },
                orderBy: { timestamp: 'desc' },
                take: 20,
                select: { sender: true, text: true, timestamp: true }
            });

            if (recentMessages.length > 0) {
                // Sentiment Analysis
                let sentimentScore = 0;
                const positive = /(:D|:\)|lol|lmao|haha|love|nice|cool|🔥|❤️|✨|pog|based|goat|fire|lit|vibe)/i;
                const negative = /(:\(|sad|hate|bad|angry|ugh|🙄|cry|die|cringe|L|ratio|mid)/i;
                const chaotic = /(lmao|omg|wtf|bruh|dead|💀|😭|chaos)/i;

                recentMessages.forEach(m => {
                    if (positive.test(m.text)) sentimentScore++;
                    if (negative.test(m.text)) sentimentScore--;
                });

                // Count chaotic messages
                const chaoticCount = recentMessages.filter(m => chaotic.test(m.text)).length;

                if (chaoticCount > 5) sentiment = 'Chaotic 🌀';
                else if (sentimentScore > 4) sentiment = 'Hype 🔥';
                else if (sentimentScore > 1) sentiment = 'Positive ✨';
                else if (sentimentScore < -2) sentiment = 'Tense 🌩️';
                else if (recentMessages.length > 5) sentiment = 'Chill 😌';
                else sentiment = 'Quiet 🌙';

                // Generate summary if not already set
                if (!summary) {
                    const uniqueUsers = [...new Set(recentMessages.map(m => m.sender))];
                    // Filter out SimUsers and system messages for display
                    const realUsers = uniqueUsers.filter(u => !u.startsWith('SimUser') && u !== 'System');

                    if (realUsers.length > 0) {
                        const users = realUsers.slice(0, 2).join(' & ');
                        const extra = realUsers.length > 2 ? ` +${realUsers.length - 2}` : '';

                        // Check how recent the last message was
                        const lastMsg = recentMessages[0];
                        const timeDiff = Date.now() - new Date(lastMsg.timestamp).getTime();
                        const hours = Math.floor(timeDiff / (1000 * 60 * 60));

                        if (hours < 1) {
                            summary = `${users}${extra} chatting recently`;
                        } else if (hours < 24) {
                            summary = `${users}${extra} were here today`;
                        } else {
                            summary = `Last active: ${users}${extra}`;
                        }
                    } else {
                        // Extract keywords from message content for a topic-based summary
                        const allText = recentMessages.map(m => m.text).join(' ').toLowerCase();

                        // Topic detection
                        const topics = [];
                        if (/game|gaming|play|stream/.test(allText)) topics.push('gaming');
                        if (/music|song|listen|beat/.test(allText)) topics.push('music');
                        if (/anime|manga|watch|episode/.test(allText)) topics.push('anime');
                        if (/movie|film|watch|show/.test(allText)) topics.push('movies');
                        if (/code|dev|programming|bug/.test(allText)) topics.push('coding');
                        if (/art|draw|design|creative/.test(allText)) topics.push('art');
                        if (/lol|lmao|meme|funny/.test(allText)) topics.push('memes');
                        if (/chill|vibe|hang|relax/.test(allText)) topics.push('vibes');

                        if (topics.length > 0) {
                            summary = `Chatting about ${topics.slice(0, 2).join(' & ')}`;
                        } else if (recentMessages.length > 10) {
                            summary = `Active conversation (${recentMessages.length} recent msgs)`;
                        } else if (recentMessages.length > 0) {
                            summary = `${recentMessages.length} messages today`;
                        }
                    }
                }
            } else {
                // No messages yet - provide helpful fallback
                if (!summary) {
                    if (room.memberCount > 0) {
                        summary = `${room.memberCount} ${room.memberCount === 1 ? 'person' : 'people'} waiting to chat`;
                    } else {
                        summary = room.description || 'Be the first to say hi! 👋';
                    }
                }
                sentiment = 'Quiet 🌙';
            }

            return {
                ...room,
                activityScore: score,
                shortSummary: summary,
                sentiment,
                creatorName: room.creatorId ? (creatorMap.get(room.creatorId) || 'Unknown') : 'System'
            };
        }));

        return NextResponse.json(enrichedRooms);
    } catch (error) {
        console.error('[Rooms API] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
    }
}

// POST /api/rooms - Create a new room (Discord users only)
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        // Only authenticated Discord users can create rooms
        if (!session?.user?.id || session.user.isGuest) {
            return NextResponse.json(
                { error: 'Must be logged in with Discord to create rooms' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, description, bannerUrl, tags } = body;

        // Validate name
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 32) {
            return NextResponse.json(
                { error: 'Room name must be 2-32 characters' },
                { status: 400 }
            );
        }

        // Validate tags (optional array of strings)
        const validTags = Array.isArray(tags)
            ? tags.filter(t => typeof t === 'string' && t.length > 0).slice(0, 5).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
            : [];

        // Generate slug from name (lowercase, alphanumeric + hyphens)
        const slug = name.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 32);

        if (slug.length < 2) {
            return NextResponse.json(
                { error: 'Room name must contain at least 2 alphanumeric characters' },
                { status: 400 }
            );
        }

        // Check if slug already exists
        const existing = await prisma.room.findUnique({ where: { slug } });
        if (existing) {
            return NextResponse.json(
                { error: 'A room with this name already exists' },
                { status: 409 }
            );
        }

        // Create IRC channel name
        const ircChannel = `#camrooms-${slug}`;

        // Create the room
        const room = await prisma.room.create({
            data: {
                name: name.trim(),
                slug,
                description: description?.trim() || null,
                bannerUrl: bannerUrl?.trim() || null,
                ircChannel,
                creatorId: session.user.id,
                isPublic: true,
                memberCount: 0,
                tags: validTags
            }
        });

        console.log(`[Rooms] Created room: ${room.name} (${room.slug}) by ${session.user.name}`);

        return NextResponse.json(room, { status: 201 });
    } catch (error) {
        console.error('[Rooms API] POST error:', error);

        // Handle unique constraint violations
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'A room with this name already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }
}
