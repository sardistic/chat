
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
        const statusFilter = searchParams.get("status") || "";
        const sort = searchParams.get("sort") || "createdAt";
        const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
        const ipFilter = searchParams.get("ip") || "";

        const skip = (page - 1) * limit;

        // Helper: Build filter condition (supports ! prefix for exclusion)
        const buildFilter = (field, value) => {
            if (!value) return {};
            const isExclude = value.startsWith('!');
            const cleanValue = isExclude ? value.slice(1) : value;
            if (!cleanValue) return {};

            const condition = { contains: cleanValue, mode: 'insensitive' };
            return isExclude
                ? { NOT: { [field]: condition } }
                : { [field]: condition };
        };

        // 3. Build Where Clause
        const where = {
            AND: [
                // Search (Name, DisplayName, Email, ID)
                search ? (search.startsWith('!') ? {
                    NOT: {
                        OR: [
                            { name: { contains: search.slice(1), mode: 'insensitive' } },
                            { displayName: { contains: search.slice(1), mode: 'insensitive' } },
                            { discordId: { contains: search.slice(1) } },
                            { email: { contains: search.slice(1), mode: 'insensitive' } }
                        ]
                    }
                } : {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } },
                        { discordId: { contains: search } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                }) : {},
                // Role Filter
                roleFilter ? (roleFilter.startsWith('!')
                    ? { NOT: { role: roleFilter.slice(1).toUpperCase() } }
                    : { role: roleFilter.toUpperCase() }) : {},
                // Status Filter
                statusFilter === 'banned' ? { isBanned: true } :
                    statusFilter === '!banned' ? { isBanned: false } : {},
                // IP Filter
                buildFilter('ipAddress', ipFilter),
            ]
        };

        // Dynamic Sorting
        let orderBy = {};
        if (sort === 'createdAt') orderBy = { createdAt: dir };
        else if (sort === 'lastSeen') orderBy = { lastSeen: dir };
        else if (sort === 'name') orderBy = { name: dir };
        else if (sort === 'role') orderBy = { role: dir };
        else if (sort === 'ipAddress') orderBy = { ipAddress: dir };
        else orderBy = { createdAt: 'desc' }; // Default

        // 4. Fetch Data
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    image: true,
                    avatarUrl: true,
                    avatarSeed: true,
                    email: true,
                    role: true,
                    discordId: true,
                    isBanned: true,
                    isGuest: true,
                    ipAddress: true,
                    lastSeen: true,
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
