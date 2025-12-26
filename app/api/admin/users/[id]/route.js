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

// GET: Get single user by ID
export async function GET(req, { params }) {
    const auth = await requireAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                accounts: {
                    select: {
                        provider: true,
                        providerAccountId: true,
                    },
                },
                sessions: {
                    select: {
                        expires: true,
                    },
                    orderBy: { expires: "desc" },
                    take: 5,
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error("Admin user get error:", error);
        return NextResponse.json(
            { error: "Failed to fetch user" },
            { status: 500 }
        );
    }
}

// PATCH: Update user
export async function PATCH(req, { params }) {
    const auth = await requireAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const { displayName, role, isBanned, banReason, banExpires } = body;

        const updateData = {};

        if (displayName !== undefined) updateData.displayName = displayName;
        if (role !== undefined) updateData.role = role;
        if (isBanned !== undefined) updateData.isBanned = isBanned;
        if (banReason !== undefined) updateData.banReason = banReason;
        if (banExpires !== undefined) updateData.banExpires = banExpires ? new Date(banExpires) : null;

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error("Admin user update error:", error);
        return NextResponse.json(
            { error: "Failed to update user" },
            { status: 500 }
        );
    }
}

// DELETE: Delete user
export async function DELETE(req, { params }) {
    const auth = await requireAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    try {
        await prisma.user.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin user delete error:", error);
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
}
