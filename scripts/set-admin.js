const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("\n❌ Error: Please provide an email address.");
        console.log("Usage: node scripts/set-admin.js <email>\n");
        process.exit(1);
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            console.error(`\n❌ User not found: ${email}`);
            process.exit(1);
        }

        const updated = await prisma.user.update({
            where: { email },
            data: { role: 'ADMIN' }
        });

        console.log(`\n✅ Success! User '${updated.name}' (${updated.email}) is now an ADMIN.`);
        console.log("👉 You may need to sign out and back in for changes to take effect.\n");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
