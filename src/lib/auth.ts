import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";

function resolveGitHubCredentials() {
  const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
  const isLocal = nextAuthUrl.includes("localhost") || nextAuthUrl.includes("127.0.0.1");

  const clientId = isLocal
    ? process.env.GITHUB_ID
    : process.env.GITHUB_ID_PROD ?? process.env.GITHUB_ID;

  const clientSecret = isLocal
    ? process.env.GITHUB_SECRET
    : process.env.GITHUB_SECRET_PROD ?? process.env.GITHUB_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth credentials for the current environment.");
  }

  if (clientId === clientSecret) {
    throw new Error(
      "Invalid GitHub OAuth config: client secret must not be the same as client id."
    );
  }

  return { clientId, clientSecret };
}

const githubCredentials = resolveGitHubCredentials();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      clientId: githubCredentials.clientId,
      clientSecret: githubCredentials.clientSecret,
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
  },
};
