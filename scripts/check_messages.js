const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking messages for 'general' room...");

    // Check if room exists
    const room = await prisma.room.findUnique({ where: { slug: 'general' } });
    console.log("Room 'general':", room ? "Found" : "Not Found");

    // Count messages
    const count = await prisma.chatMessage.count({
        where: { roomId: 'general' }
    });
    console.log(`Total messages in 'general': ${count}`);

    // Get last 5 messages
    const messages = await prisma.chatMessage.findMany({
        where: { roomId: 'general' },
        orderBy: { timestamp: 'desc' },
        take: 5
    });

    console.log("Last 5 messages:");
    messages.forEach(m => {
        console.log(`[${m.timestamp.toISOString()}] ${m.sender}: ${m.text.substring(0, 50)}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
