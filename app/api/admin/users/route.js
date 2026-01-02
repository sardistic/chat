
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request) {
    const session = await getServerSession(authOptions);

    // 1. Authorization
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Role (Allow 'ADMIN' or 'MODERATOR')
    // Assuming role is stored as a string or enum in DB and passed to session
    const allowedRoles = ['ADMIN', 'MODERATOR', 'OWNER'];
    const userRole = session.user.role?.toUpperCase() || 'USER';

    if (!allowedRoles.includes(userRole)) {
        return NextResponse.json({ error: "Forbidden: Insufficient Permissions" }, { status: 403 });
    }

    try {
        // 2. Query Parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const roleFilter = searchParams.get("role") || "";
        const statusFilter = searchParams.get("status") || ""; // banned, muted, online

        const skip = (page - 1) * limit;

        // 3. Build Where Clause
        const where = {
            AND: [
                // Search (Name or ID)
                search ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { discordId: { contains: search } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                } : {},
                // Role Filter
                roleFilter ? { role: roleFilter } : {},
                // Status Filter
                statusFilter === 'banned' ? { isBanned: true } : {},
                // statusFilter === 'muted' ? { mutes: { some: {} } } : {} // Complex, skip for now
            ]
        };

        // 4. Fetch Data
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }, // Newest first
                select: {
                    id: true,
                    name: true,
                    image: true,
                    email: true,
                    role: true,
                    discordId: true,
                    isBanned: true,
                    createdAt: true,
                }
            }),
            prisma.user.count({ where })
        ]);

        return NextResponse.json({
            users,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Admin Users API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
