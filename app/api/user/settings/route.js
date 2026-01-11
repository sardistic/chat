import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const {
            // User Settings
            volume,
            autoDeafen,
            hideMuted,
            theme,
            dmEnabled,
            // User Profile
            nickname, // Mapping from SettingsModal
            avatarSeed,
            avatarUrl
        } = body;

        // 1. Update Core User Profile
        const updateData = {};
        if (nickname !== undefined) updateData.displayName = nickname;
        if (avatarSeed !== undefined) updateData.avatarSeed = avatarSeed;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

        // If we have profile data to update
        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: updateData
            });
        }

        // 2. Update UserSettings
        await prisma.userSettings.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                volume: volume ?? 1.0,
                autoDeafen: autoDeafen ?? false,
                hideMuted: hideMuted ?? true,
                theme: theme ?? "dark",
                dmEnabled: dmEnabled ?? true,
            },
            update: {
                volume,
                autoDeafen,
                hideMuted,
                theme,
                dmEnabled
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Settings Update Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { settings: true }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Flatten data for frontend
    const responseData = {
        userId: user.id,
        nickname: user.displayName || user.name,
        avatarSeed: user.avatarSeed,
        avatarUrl: user.avatarUrl,
        ...(user.settings || {})
    };

    return NextResponse.json(responseData);
}
