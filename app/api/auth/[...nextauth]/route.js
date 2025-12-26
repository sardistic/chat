import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

// Pure JWT-based authentication - no database required
// Database persistence can be added later once DB is confirmed working

export const authOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: {
                params: {
                    // Request identify scope for full profile data
                    scope: "identify email",
                },
            },
            profile(profile) {
                // Discord profile object includes:
                // id, username, global_name, avatar, banner, accent_color, email, etc.
                return {
                    id: profile.id,
                    name: profile.global_name || profile.username,
                    email: profile.email,
                    image: profile.avatar
                        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
                        : null,
                    // Custom fields
                    discordId: profile.id,
                    username: profile.username,
                    globalName: profile.global_name,
                    discriminator: profile.discriminator,
                    banner: profile.banner
                        ? `https://cdn.discordapp.com/banners/${profile.id}/${profile.banner}.${profile.banner.startsWith('a_') ? 'gif' : 'png'}?size=600`
                        : null,
                    accentColor: profile.accent_color,
                    premiumType: profile.premium_type, // 0=none, 1=Nitro Classic, 2=Nitro, 3=Nitro Basic
                    publicFlags: profile.public_flags,
                    verified: profile.verified,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, profile }) {
            // On initial sign-in, store all Discord profile data in JWT
            if (account && profile) {
                token.discordId = profile.id;
                token.username = profile.username;
                token.globalName = profile.global_name;
                token.name = profile.global_name || profile.username;
                token.discriminator = profile.discriminator;
                token.email = profile.email;
                token.verified = profile.verified;
                token.image = profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
                    : null;
                token.banner = profile.banner
                    ? `https://cdn.discordapp.com/banners/${profile.id}/${profile.banner}.${profile.banner.startsWith('a_') ? 'gif' : 'png'}?size=600`
                    : null;
                token.accentColor = profile.accent_color;
                token.premiumType = profile.premium_type;
                token.publicFlags = profile.public_flags;
            }
            return token;
        },
        async session({ session, token }) {
            // Transfer all JWT data to session for client access
            if (session.user) {
                session.user.id = token.sub;
                session.user.discordId = token.discordId;
                session.user.username = token.username;
                session.user.globalName = token.globalName;
                session.user.name = token.name;
                session.user.discriminator = token.discriminator;
                session.user.email = token.email;
                session.user.verified = token.verified;
                session.user.image = token.image;
                session.user.banner = token.banner;
                session.user.accentColor = token.accentColor;
                session.user.premiumType = token.premiumType;
                session.user.publicFlags = token.publicFlags;
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
