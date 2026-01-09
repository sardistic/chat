const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Setting active video for 'general' room...");

    const room = await prisma.room.findFirst({ where: { slug: 'general' } });
    if (!room) {
        console.error("Room 'general' not found.");
        return;
    }

    await prisma.room.update({
        where: { id: room.id },
        data: {
            currentVideoId: 'dQw4w9WgXcQ',
            currentVideoTitle: 'Rick Astley - Never Gonna Give You Up (Official Music Video)'
        }
    });

    console.log("Updated room 'general' with active video.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
