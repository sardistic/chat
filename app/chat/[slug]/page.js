import ClientApp from "@/components/ClientApp";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export const metadata = {
    title: 'Cam Rooms',
};

export default async function RoomPage({ params }) {
    const { slug } = await params;

    const room = await prisma.room.findUnique({
        where: { slug }
    });

    if (!room) {
        return notFound();
    }

    // Serialize dates for Client Component
    const serializedRoom = {
        ...room,
        createdAt: room.createdAt.toISOString(),
        lastActive: room.lastActive.toISOString(),
    };

    return <ClientApp initialRoom={serializedRoom} />;
}
