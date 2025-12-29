import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";

// Generate or retrieve guest user based on cookie
export async function POST(req) {
    try {
        const body = await req.json();
        const { guestToken, name, avatarSeed, avatarUrl } = body;

        // Get IP address for association
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown";

        let user;

        if (guestToken) {
            // Try to find existing guest
            user = await prisma.user.findUnique({
                where: { guestToken },
            });

            if (user) {
                // Update existing guest
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        displayName: name || user.displayName,
                        avatarSeed: avatarSeed ? (Number(avatarSeed) | 0) : user.avatarSeed,
                        avatarUrl: avatarUrl || user.avatarUrl,
                        lastSeen: new Date(),
                        ipAddress: ip,
                    },
                });
            }
        }

        if (!user) {
            // Create new guest
            const newToken = uuidv4();
            user = await prisma.user.create({
                data: {
                    guestToken: newToken,
                    displayName: name || `Guest_${Math.floor(Math.random() * 10000)}`,
                    avatarSeed: (avatarSeed ? Number(avatarSeed) : Math.floor(Math.random() * 2147483647)) | 0,
                    avatarUrl: avatarUrl,
                    isGuest: true,
                    ipAddress: ip,
                    role: "USER",
                },
            });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                guestToken: user.guestToken,
                displayName: user.displayName,
                avatarSeed: user.avatarSeed,
                avatarUrl: user.avatarUrl,
                isGuest: user.isGuest,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Guest registration error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to register guest" },
            { status: 500 }
        );
    }
}

// Get guest user by token
export async function GET(req) {
    try {
        const url = new URL(req.url);
        const guestToken = url.searchParams.get("token");

        if (!guestToken) {
            return NextResponse.json(
                { success: false, error: "No token provided" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { guestToken },
            select: {
                id: true,
                guestToken: true,
                displayName: true,
                avatarSeed: true,
                avatarUrl: true,
                isGuest: true,
                role: true,
                isBanned: true,
                banReason: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Guest not found" },
                { status: 404 }
            );
        }

        if (user.isBanned) {
            return NextResponse.json(
                { success: false, error: "User is banned", reason: user.banReason },
                { status: 403 }
            );
        }

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error("Guest lookup error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to lookup guest" },
            { status: 500 }
        );
    }
}
