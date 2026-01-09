import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

// Helper to check if user is room owner
async function isRoomOwner(roomId, userId) {
    const room = await prisma.room.findUnique({
        where: { slug: roomId },
        select: { creatorId: true }
    });
    return room?.creatorId === userId;
}

// POST: Add a moderator
export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { slug } = params;
        const body = await request.json();
        const { userId } = body; // Discord User ID to add

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Verify user is owner
        const isOwner = await isRoomOwner(slug, session.user.id);
        if (!isOwner) {
            return NextResponse.json({ error: 'Only the room owner can manage moderators' }, { status: 403 });
        }

        // Prevent adding self (owner is already admin)
        if (userId === session.user.id) {
            return NextResponse.json({ error: 'You are already the owner' }, { status: 400 });
        }

        // Check if room exists
        const room = await prisma.room.findUnique({ where: { slug } });
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Add moderator (upsert to handle existing)
        await prisma.roomModerator.upsert({
            where: {
                roomId_userId: {
                    roomId: room.id, // Use ID, not slug for relation
                    userId: userId
                }
            },
            update: {}, // Already exists, do nothing
            create: {
                roomId: room.id,
                userId: userId,
                role: 'MODERATOR'
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Room Moderators] Add error:', error);
        return NextResponse.json({ error: 'Failed to add moderator' }, { status: 500 });
    }
}

// DELETE: Remove a moderator
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { slug } = params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Verify user is owner
        const isOwner = await isRoomOwner(slug, session.user.id);
        if (!isOwner) {
            return NextResponse.json({ error: 'Only the room owner can manage moderators' }, { status: 403 });
        }

        // Check if room exists
        const room = await prisma.room.findUnique({ where: { slug } });
        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Remove moderator
        await prisma.roomModerator.deleteMany({
            where: {
                roomId: room.id,
                userId: userId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Room Moderators] Remove error:', error);
        return NextResponse.json({ error: 'Failed to remove moderator' }, { status: 500 });
    }
}
