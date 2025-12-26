import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// Middleware to check admin access
async function requireAdmin(req) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return { error: "Unauthorized", status: 401 };
    }

    if (session.user.role !== "ADMIN") {
        return { error: "Forbidden - Admin access required", status: 403 };
    }

    return { user: session.user };
}

// GET: List all users with pagination and search
export async function GET(req) {
    const auth = await requireAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role");
    const isGuest = url.searchParams.get("isGuest");

    const where = {};

    if (search) {
        where.OR = [
            { displayName: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { discordTag: { contains: search, mode: "insensitive" } },
        ];
    }

    if (role) {
        where.role = role;
    }

    if (isGuest !== null && isGuest !== undefined) {
        where.isGuest = isGuest === "true";
    }

    try {
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    email: true,
                    image: true,
                    avatarUrl: true,
                    avatarSeed: true,
                    role: true,
                    isGuest: true,
                    isBanned: true,
                    banReason: true,
                    banExpires: true,
                    discordId: true,
                    discordTag: true,
                    createdAt: true,
                    lastSeen: true,
                },
                orderBy: { lastSeen: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);

        return NextResponse.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Admin users list error:", error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}

// POST: Create a new user (manual admin creation)
export async function POST(req) {
    const auth = await requireAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await req.json();
        const { displayName, email, role, avatarSeed } = body;

        const user = await prisma.user.create({
            data: {
                displayName,
                email,
                role: role || "USER",
                avatarSeed: avatarSeed || Date.now(),
                isGuest: false,
            },
        });

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error("Admin user create error:", error);
        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}
