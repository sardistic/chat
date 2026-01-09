import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

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
                iconUrl: true,
                bannerUrl: true,
                ircChannel: true,
                memberCount: true,
                lastActive: true,
                createdAt: true,
                isPublic: true,
                creatorId: true
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

// DELETE /api/rooms/[slug] - Delete a room (Owner only)
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { slug } = await params;

        const room = await prisma.room.findUnique({
            where: { slug },
            select: { id: true, creatorId: true }
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Only Creator can delete
        if (room.creatorId !== session.user.id) {
            return NextResponse.json({ error: 'Only the room owner can delete this room' }, { status: 403 });
        }

        await prisma.room.delete({
            where: { id: room.id }
        });

        console.log(`[Rooms] Room deleted: ${slug} by ${session.user.id}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Rooms API] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
    }
}
