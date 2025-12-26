import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

// Pure JWT-based authentication - no database required
// Database persistence can be added later once DB is confirmed working

export const authOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, profile }) {
            // On initial sign in, add profile data to token
            if (account && profile) {
                token.discordId = profile.id;
                token.name = profile.username || profile.global_name;
                token.image = profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                    : null;
                token.email = profile.email;
            }
            return token;
        },
        async session({ session, token }) {
            // Transfer JWT data to session
            if (session.user) {
                session.user.id = token.sub;
                session.user.discordId = token.discordId;
                session.user.name = token.name;
                session.user.image = token.image;
                session.user.email = token.email;
                session.user.isGuest = false;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: "/",
        error: "/auth/error",
    },
    debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
