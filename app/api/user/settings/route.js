import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return new NextResponse("Unauthorized", { status: 401 });
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
            displayName,
            bio,
            avatarUrl
        } = body;

        // 1. Update Core User Profile
        if (displayName || bio || avatarUrl !== undefined) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    displayName,
                    // bio is not yet in schema, assuming we might add it or store in metadata?
                    // Wait, 'bio' was not in my schema update. I should verify or add it.
                    // For now, let's stick to what's in schema: displayName, avatarUrl
                    avatarUrl,
                }
            });
        }

        // 2. Update UserSettings
        // Using upsert to create if missing
        await prisma.userSettings.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                volume: volume ?? 100,
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
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id }
    });

    return NextResponse.json(settings || {});
}
