import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // stable user id
      if (token.sub) token.userId = token.sub;

      // ✅ store provider ("github" | "google") at sign-in time
      if (account?.provider) {
        token.provider = account.provider;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && (token as any).userId) {
        session.user.id = (token as any).userId;
      }

      // ✅ expose provider to the client
      (session.user as any).provider = (token as any).provider;

      return session;
    },
  },

};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };