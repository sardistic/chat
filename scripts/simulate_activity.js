const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Creating simulated users...");

    // 1. Create 10 Users (Upsert to avoid dupes if run twice)
    const users = [];
    for (let i = 1; i <= 10; i++) {
        const user = await prisma.user.upsert({
            where: { email: `sim${i}@example.com` },
            update: {},
            create: {
                name: `SimUser_${i}`,
                displayName: `SimUser ${i}`,
                email: `sim${i}@example.com`,
                image: `https://api.dicebear.com/7.x/avataaars/svg?seed=Sim${i}`,
                isGuest: false,
                role: 'USER'
            }
        });
        users.push(user);
    }

    // 2. Target 'general' room or first available
    console.log("Locating room...");
    let room = await prisma.room.findFirst({ where: { slug: 'general' } });
    if (!room) {
        room = await prisma.room.findFirst(); // Fallback
    }
    if (!room) {
        console.error("No rooms found! Please create a room first.");
        return;
    }

    console.log(`Simulating activity in: ${room.name}`);

    // 3. Post hype messages
    const messages = [
        "This update is fire! 🔥",
        "Loving the new room browser :D",
        "Anyone want to watch a movie?",
        "Poggers!",
        "LMAO that video",
        "Wait, we can delete rooms now?",
        "Be careful with the delete button monkaS",
        "HYPE HYPE HYPE",
        "Lets gooooo",
        "Can I be mod?",
        "Testing the sentiment analysis...",
        "Looks good to me! ✨",
        "Is this live?",
        "Hello world",
        "Keep it up!"
    ];

    for (let i = 0; i < 25; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const text = messages[Math.floor(Math.random() * messages.length)];

        await prisma.chatMessage.create({
            data: {
                id: `msg_sim_${Date.now()}_${i}`,
                roomId: room.id,
                sender: randomUser.displayName || randomUser.name,
                text: text,
                timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 5)) // Random time in last 5 mins
            }
        });
    }

    // Update room stats to force high activity score
    await prisma.room.update({
        where: { id: room.id },
        data: {
            memberCount: Math.floor(Math.random() * 5) + 10, // 10-15 users
            lastActive: new Date(),
            activityScore: 85 // Force high score for demo
        }
    });

    console.log("Simulation complete: 10 users, 25 messages injected.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
