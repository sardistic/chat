import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const { targetId, action } = await req.json(); // action: 'block' or 'unblock'

        if (!targetId) return new NextResponse("Missing targetId", { status: 400 });

        if (action === 'block') {
            await prisma.block.create({
                data: {
                    blockerId: session.user.id,
                    blockedId: targetId
                }
            });
        } else if (action === 'unblock') {
            await prisma.block.delete({
                where: {
                    blockerId_blockedId: {
                        blockerId: session.user.id,
                        blockedId: targetId
                    }
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        // Ignore duplicate block errors
        if (error.code === 'P2002') return NextResponse.json({ success: true });

        console.error("Block API Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    // Return list of blocked IDs
    const blocks = await prisma.block.findMany({
        where: { blockerId: session.user.id },
        select: { blockedId: true }
    });

    return NextResponse.json(blocks.map(b => b.blockedId));
}
