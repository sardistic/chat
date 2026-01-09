import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rooms/[slug] - Get a single room by slug
export async function GET(request, { params }) {
    try {
        const { slug } = await params;

        const room = await prisma.room.findUnique({
            where: { slug },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                ircChannel: true,
                memberCount: true,
                lastActive: true,
                createdAt: true,
                isPublic: true
            }
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        if (!room.isPublic) {
            return NextResponse.json({ error: 'Room is private' }, { status: 403 });
        }

        return NextResponse.json(room);
    } catch (error) {
        console.error('[Rooms API] GET slug error:', error);
        return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
    }
}
