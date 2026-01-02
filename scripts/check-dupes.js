const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Checking for duplicate messages in the database...");

    // 1. Check for Duplicate IDs (Should be impossible with Primary Key, but good sanity check)
    const messages = await prisma.chatMessage.findMany({
        select: { id: true, text: true, sender: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        take: 100 // Just check recent ones
    });

    const ids = new Set();
    const dupes = [];

    // Manual content check
    // Key: sender + text + timestamp (approx)
    const contentMap = new Map();

    messages.forEach(m => {
        // ID Check
        if (ids.has(m.id)) {
            console.log(`❌ Duplicate ID found: ${m.id}`);
        } else {
            ids.add(m.id);
        }

        // Content Check
        const key = `${m.sender}-${m.text}`; // Simple key
        if (contentMap.has(key)) {
            const existing = contentMap.get(key);
            // Check if timestamps are super close (e.g. within 1s)
            const t1 = new Date(m.timestamp).getTime();
            const t2 = new Date(existing.timestamp).getTime();
            if (Math.abs(t1 - t2) < 2000) {
                dupes.push({ original: existing, dupe: m });
            }
        } else {
            contentMap.set(key, m);
        }
    });

    if (dupes.length > 0) {
        console.log(`\n⚠️ Found ${dupes.length} potential content duplicates (same sender, text, ~time):`);
        dupes.forEach(d => {
            console.log(`\n1. [${d.original.id}] ${d.original.sender}: ${d.original.text}`);
            console.log(`2. [${d.dupe.id}] ${d.dupe.sender}: ${d.dupe.text}`);
        });
    } else {
        console.log("\n✅ No obvious content duplicates found in the last 100 messages.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
