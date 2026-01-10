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

        // DIAGNOSTIC LOOPBACK: Return raw DB result
        return NextResponse.json(rooms);

        /*
        // ... (Disabled enrichment logic)
        // ...
        */


        // Code removed for diagnostic isolation

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
