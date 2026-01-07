import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
    // Enable Database Persistence
    adapter: PrismaAdapter(prisma),

    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "identify email",
                },
            },
            profile(profile) {
                return {
                    id: profile.id,
                    name: profile.global_name || profile.username,
                    email: profile.email,
                    image: profile.avatar
                        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
                        : null,
                    // Custom fields stored in User model
                    discordId: profile.id,
                    discordTag: `${profile.username}#${profile.discriminator || '0000'}`,

                    // We can map other profile fields here if strict schema matches, 
                    // but PrismaAdapter handles the core User fields automatically.
                };
            },
        }),
    ],
    session: {
        strategy: "database", // Use DB sessions instead of JWT
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async session({ session, user }) {
            // When using database strategy, 'user' object is populated from the DB
            if (session.user) {
                session.user.id = user.id;
                session.user.discordId = user.discordId;
                session.user.role = user.role;
                session.user.isBanned = user.isBanned;
                // Display name priority: DB displayName > Discord name > email prefix
                session.user.displayName = user.displayName;
                session.user.globalName = user.name; // Discord global name stored as 'name' in DB
            }
            return session;
        },
    },
    pages: {
        signIn: "/",
        error: "/auth/error",
    },
    debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
