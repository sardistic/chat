import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "identify email guilds",
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // Store Discord-specific data
            if (account?.provider === "discord" && profile) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        discordId: profile.id,
                        discordTag: profile.username,
                        image: profile.avatar
                            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                            : null,
                        lastSeen: new Date(),
                    },
                });
            }
            return true;
        },
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                session.user.role = user.role;
                session.user.discordId = user.discordId;
                session.user.displayName = user.displayName || user.name;
                session.user.avatarSeed = user.avatarSeed;
                session.user.avatarUrl = user.avatarUrl;
                session.user.isBanned = user.isBanned;
                session.user.isGuest = user.isGuest;
            }
            return session;
        },
    },
    pages: {
        signIn: "/", // Use our custom entry screen
        error: "/auth/error",
    },
    events: {
        async signIn({ user }) {
            // Update last seen on sign in
            await prisma.user.update({
                where: { id: user.id },
                data: { lastSeen: new Date() },
            });
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
