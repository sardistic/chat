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
        // 2. Fetch User Details & Audit Logs
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                // Include stats/settings if needed
                stats: true,
                // Include Audit Logs where this user was the TARGET (e.g. they were banned)
                auditLogsTarget: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        actor: { select: { name: true, image: true, role: true } }
                    }
                },
                // Include Audit Logs where this user was the ACTOR (if they are staff)
                auditLogsActor: {
                    orderBy: { createdAt: 'desc' },
                    take: 50 // Limit actor logs
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });

    } catch (error) {
        console.error("User Detail API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
