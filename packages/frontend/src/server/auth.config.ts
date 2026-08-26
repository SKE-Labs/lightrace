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
      const isAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/register";
      const isPublicApi = nextUrl.pathname.startsWith("/api/public/");
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth/");
      const isWsAuthApi = nextUrl.pathname.startsWith("/api/ws-auth");
      const isTrpcApi = nextUrl.pathname.startsWith("/api/trpc");
      const isStaticAsset = /\.(svg|png|ico|jpg|jpeg|webp|gif|css|js|woff2?)$/.test(
        nextUrl.pathname,
      );

      // Allow public API, auth routes, WS auth + tRPC (they handle 401 JSON themselves), and static assets
      if (isPublicApi || isAuthApi || isWsAuthApi || isTrpcApi || isStaticAsset) return true;

      // Redirect to login if not authenticated
      if (!isLoggedIn && !isAuthPage) return false;

      return true;
    },
  },
} satisfies NextAuthConfig;
