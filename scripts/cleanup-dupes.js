const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Cleaning up duplicate messages...");

    // Get all messages
    const messages = await prisma.chatMessage.findMany({
        orderBy: { timestamp: 'desc' },
        take: 500 // Safety limit
    });

    const seen = new Set();
    let deleted = 0;

    for (const msg of messages) {
        // Fingerprint: Sender + Text + Approx Time (ignore ID)
        // We ignore ID because we suspect different IDs for same content
        const timeKey = Math.floor(new Date(msg.timestamp).getTime() / 2000); // 2-second bucket
        const key = `${msg.sender}:${msg.text}:${timeKey}`;

        if (seen.has(key)) {
            console.log(`🗑️ Deleting duplicate: [${msg.id}] ${msg.text}`);
            await prisma.chatMessage.delete({ where: { id: msg.id } });
            deleted++;
        } else {
            seen.add(key);
        }
    }

    console.log(`\n✅ Cleanup complete. Removed ${deleted} duplicates.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
