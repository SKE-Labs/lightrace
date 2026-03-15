import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth;
      const isLoginPage = nextUrl.pathname === "/login";
      const isPublicApi = nextUrl.pathname.startsWith("/api/public/");
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth/");

      // Allow public API (SDK ingestion) and auth routes through
      if (isPublicApi || isAuthApi) return true;

      // Redirect to login if not authenticated
      if (!isLoggedIn && !isLoginPage) return false;

      return true;
    },
  },
} satisfies NextAuthConfig;
