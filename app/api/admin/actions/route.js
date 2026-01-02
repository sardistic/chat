
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
    const session = await getServerSession(authOptions);

    // 1. Authorization
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const operatorRole = session.user.role?.toUpperCase() || 'USER';
    const allowedRoles = ['ADMIN', 'MODERATOR', 'OWNER'];

    if (!allowedRoles.includes(operatorRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { action, userId, value, reason } = await request.json();
        const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';

        if (!userId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Prevent self-actions (except maybe stepping down, but let's block for safety)
        if (userId === session.user.id) {
            return NextResponse.json({ error: "Cannot perform actions on yourself" }, { status: 400 });
        }

        // Fetch target user to check role hierarchy
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const targetRole = targetUser.role?.toUpperCase() || 'USER';

        // Hierarchy Check: Admins cannot act on Owners, Mods cannot act on Admins/Owners
        if (targetRole === 'OWNER') {
            return NextResponse.json({ error: "Cannot modify Owner" }, { status: 403 });
        }
        if (targetRole === 'ADMIN' && operatorRole !== 'OWNER') { // Only Owner can manage Admins
            return NextResponse.json({ error: "Insufficient permissions to modify Admin" }, { status: 403 });
        }
        if (targetRole === 'MODERATOR' && operatorRole === 'MODERATOR') {
            return NextResponse.json({ error: "Moderators cannot modify other Moderators" }, { status: 403 });
        }

        // 2. Perform Action
        let result;

        switch (action) {
            case 'BAN':
                // Update DB
                result = await prisma.user.update({
                    where: { id: userId },
                    data: { isBanned: value } // value: true/false
                });

                // Log Action
                await prisma.auditLog.create({
                    data: {
                        action: value ? 'USER_BANNED' : 'USER_UNBANNED',
                        details: { reason },
                        ipAddress: ip,
                        targetId: userId,
                        actorId: session.user.id
                    }
                });

                // Trigger socket disconnect (Force logout)
                try {
                    await fetch(`http://localhost:${process.env.PORT || 3000}/api/admin/socket-kick`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.NEXTAUTH_SECRET },
                        body: JSON.stringify({ userId, reason: reason || 'Account Banned', ban: true })
                    });
                } catch (e) {
                    console.error("Failed to trigger socket ban:", e.message);
                }
                break;

            case 'KICK':
                // Trigger socket disconnect
                try {
                    await fetch(`http://localhost:${process.env.PORT || 3000}/api/admin/socket-kick`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.NEXTAUTH_SECRET },
                        body: JSON.stringify({ userId, reason: reason || 'Kicked by Moderator', ban: false })
                    });
                } catch (e) {
                    console.error("Failed to trigger socket kick:", e.message);
                }

                await prisma.auditLog.create({
                    data: {
                        action: 'USER_KICKED',
                        details: { reason },
                        ipAddress: ip,
                        targetId: userId,
                        actorId: session.user.id
                    }
                });
                break;

            case 'SET_ROLE':
                if (operatorRole !== 'ADMIN' && operatorRole !== 'OWNER') {
                    return NextResponse.json({ error: "Only Admins can change roles" }, { status: 403 });
                }

                result = await prisma.user.update({
                    where: { id: userId },
                    data: { role: value } // value: 'USER', 'MODERATOR', 'ADMIN'
                });

                await prisma.auditLog.create({
                    data: {
                        action: 'ROLE_CHANGED',
                        details: { reason, newRole: value },
                        ipAddress: ip,
                        targetId: userId,
                        actorId: session.user.id
                    }
                });
                break;

            default:
                return NextResponse.json({ error: "Invalid Action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });

    } catch (error) {
        console.error("Admin Action Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
