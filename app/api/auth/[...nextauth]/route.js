import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Check if database is available
let adapter;
try {
    adapter = PrismaAdapter(prisma);
} catch (e) {
    console.error("[NextAuth] Prisma adapter failed to initialize:", e);
    adapter = undefined;
}

export const authOptions = {
    adapter,
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "identify email",
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // If no adapter (database unavailable), still allow sign in
            if (!adapter) {
                console.warn("[NextAuth] No adapter available, skipping user update");
                return true;
            }

            // Store Discord-specific data
            if (account?.provider === "discord" && profile) {
                try {
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
                } catch (err) {
                    console.error("[NextAuth] Failed to update user:", err);
                    // Still allow sign in even if update fails
                }
            }
            return true;
        },
        async session({ session, user, token }) {
            // Support both database sessions and JWT
            if (session.user) {
                if (user) {
                    // Database session
                    session.user.id = user.id;
                    session.user.role = user.role;
                    session.user.discordId = user.discordId;
                    session.user.displayName = user.displayName || user.name;
                    session.user.avatarSeed = user.avatarSeed;
                    session.user.avatarUrl = user.avatarUrl;
                    session.user.isBanned = user.isBanned;
                    session.user.isGuest = user.isGuest;
                } else if (token) {
                    // JWT session fallback
                    session.user.id = token.sub;
                }
            }
            return session;
        },
        async jwt({ token, user, account, profile }) {
            // Only used if no adapter
            if (user) {
                token.id = user.id;
            }
            if (profile) {
                token.discordId = profile.id;
                token.name = profile.username;
                token.image = profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                    : null;
            }
            return token;
        },
    },
    // Use JWT strategy if no database adapter is available
    session: {
        strategy: adapter ? "database" : "jwt",
    },
    pages: {
        signIn: "/",
        error: "/auth/error",
    },
    debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
