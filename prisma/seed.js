const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding rooms...');

    // Create General room (default)
    const generalRoom = await prisma.room.upsert({
        where: { slug: 'general' },
        update: {},
        create: {
            name: 'General',
            slug: 'general',
            description: 'Main chat room for everyone',
            ircChannel: '#camrooms-general',
            isPublic: true,
            memberCount: 0
        }
    });

    console.log('Created room:', generalRoom.name);
    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
