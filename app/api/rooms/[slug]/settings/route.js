import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

// Helper to check if user is room owner or moderator
async function isRoomAdmin(roomId, userId) {
    // Check if user is creator
    const room = await prisma.room.findUnique({
        where: { slug: roomId },
        select: { creatorId: true }
    });

    if (room?.creatorId === userId) return 'OWNER';

    // Check if user is a moderator
    const mod = await prisma.roomModerator.findUnique({
        where: {
            roomId_userId: { roomId, userId }
        }
    });

    return mod?.role || null;
}

// PATCH: Update room settings
export async function PATCH(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { slug } = params;
        const body = await request.json();
        const { name, description, iconUrl } = body;

        // Check permissions
        const role = await isRoomAdmin(slug, session.user.id);
        if (!role) {
            return NextResponse.json({ error: 'Not authorized to modify this room' }, { status: 403 });
        }

        // Build update data
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (iconUrl !== undefined) updateData.iconUrl = iconUrl || null;

        // Update room
        const room = await prisma.room.update({
            where: { slug },
            data: updateData,
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                iconUrl: true,
                ircChannel: true,
                creatorId: true,
                memberCount: true,
                lastActive: true
            }
        });

        return NextResponse.json(room);
    } catch (error) {
        console.error('[Room Settings] Error:', error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Room name already exists' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
    }
}

// GET: Get room with moderation info
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const { slug } = params;

        const room = await prisma.room.findUnique({
            where: { slug },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                iconUrl: true,
                ircChannel: true,
                creatorId: true,
                memberCount: true,
                isPublic: true,
                createdAt: true,
                lastActive: true,
                moderators: {
                    select: {
                        userId: true,
                        role: true
                    }
                }
            }
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Check if current user can edit
        let canEdit = false;
        if (session?.user?.id) {
            if (room.creatorId === session.user.id) {
                canEdit = true;
            } else {
                canEdit = room.moderators.some(m => m.userId === session.user.id);
            }
        }

        return NextResponse.json({
            ...room,
            canEdit,
            isOwner: room.creatorId === session?.user?.id
        });
    } catch (error) {
        console.error('[Room Settings] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
    }
}
