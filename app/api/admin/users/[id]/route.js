import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);

    // 1. Authorization
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Allow Mods, Admins, Owners
    const userRole = session.user.role?.toUpperCase() || 'USER';
    if (!['ADMIN', 'MODERATOR', 'OWNER'].includes(userRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // 2. Fetch User & Stats
        const user = await prisma.user.findUnique({
            where: { id },
            include: { stats: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 3. Fetch Audit Logs where this user was the TARGET
        const auditLogsTarget = await prisma.auditLog.findMany({
            where: { targetId: id },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // 4. Manually resolve actors for the logs
        const logsWithActors = await Promise.all(auditLogsTarget.map(async log => {
            if (log.actorId) {
                const actor = await prisma.user.findUnique({
                    where: { id: log.actorId },
                    select: { name: true, image: true, role: true, displayName: true, avatarUrl: true }
                });
                return { ...log, actor };
            }
            return log;
        }));

        return NextResponse.json({
            user: {
                ...user,
                auditLogsTarget: logsWithActors
            }
        });

    } catch (error) {
        console.error("User Detail API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
