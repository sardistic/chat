import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { targetId, action } = await req.json(); // action: 'mute' or 'unmute'

        if (!targetId) return NextResponse.json({ error: "Missing targetId" }, { status: 400 });

        if (action === 'mute') {
            await prisma.mute.create({
                data: {
                    muterId: session.user.id,
                    mutedId: targetId
                }
            });
        } else if (action === 'unmute') {
            await prisma.mute.delete({
                where: {
                    muterId_mutedId: {
                        muterId: session.user.id,
                        mutedId: targetId
                    }
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error.code === 'P2002') return NextResponse.json({ success: true });
        console.error("Mute API Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mutes = await prisma.mute.findMany({
        where: { muterId: session.user.id },
        select: { mutedId: true }
    });

    return NextResponse.json(mutes.map(m => m.mutedId));
}
