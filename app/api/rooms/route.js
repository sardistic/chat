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
                creatorId: true
            }
        });

        // Computed metadata (Server-side heuristic)
        const enrichedRooms = await Promise.all(rooms.map(async (room) => {
            const now = new Date();
            const lastActive = new Date(room.lastActive);
            const diffMins = (now - lastActive) / 1000 / 60;

            // Dynamic Activity Score: High if active in last 15 mins
            // 100 if 0 mins, 0 if > 100 mins
            let score = Math.max(0, 100 - Math.floor(diffMins));

            // If member count is high, boost score
            if (room.memberCount > 0) score = Math.max(score, 50 + (room.memberCount * 10));

            let summary = room.shortSummary;

            // Generate heuristic summary if missing and room is active
            if (!summary && score > 20) {
                const recentMessages = await prisma.chatMessage.findMany({
                    where: { roomId: room.id, isWiped: false },
                    orderBy: { timestamp: 'desc' },
                    take: 3,
                    select: { sender: true, text: true }
                });

                if (recentMessages.length > 0) {
                    const users = [...new Set(recentMessages.map(m => m.sender))].slice(0, 2).join(' & ');
                    summary = `${users} are chatting`;
                }
            }

            return {
                ...room,
                activityScore: score,
                shortSummary: summary
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
        const { name, description, bannerUrl } = body;

        // Validate name
        if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 32) {
            return NextResponse.json(
                { error: 'Room name must be 2-32 characters' },
                { status: 400 }
            );
        }

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
                memberCount: 0
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
