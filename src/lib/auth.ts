import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";

type GitHubCredentials = {
    clientId: string;
    clientSecret: string;
};

function shouldPreferLocalGitHubCredentials() {
    const rawUrl = process.env.NEXTAUTH_URL;
    if (!rawUrl) {
        return process.env.NODE_ENV !== "production";
    }

    try {
        const hostname = new URL(rawUrl).hostname;
        return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
        return process.env.NODE_ENV !== "production";
    }
}

function shouldAllowLocalEmailAccountLinking() {
    if (process.env.NEXTAUTH_ALLOW_DANGEROUS_EMAIL_LINKING === "1") {
        return true;
    }

    return shouldPreferLocalGitHubCredentials();
}

function resolveGitHubCredentials() {
    const localPair = {
        name: "GITHUB_ID/GITHUB_SECRET",
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
    };

    const productionPair = {
        name: "GITHUB_ID_PROD/GITHUB_SECRET_PROD",
        clientId: process.env.GITHUB_ID_PROD,
        clientSecret: process.env.GITHUB_SECRET_PROD,
    };

    const candidatePairs: Array<{
        name: string;
        clientId?: string;
        clientSecret?: string;
    }> = shouldPreferLocalGitHubCredentials()
        ? [localPair, productionPair]
        : [productionPair, localPair];

    for (const pair of candidatePairs) {
        if (!pair.clientId && !pair.clientSecret) {
            continue;
        }

        if (!pair.clientId || !pair.clientSecret) {
            console.warn(
                `Incomplete GitHub OAuth pair detected for ${pair.name}.`,
            );
            continue;
        }

        if (pair.clientId === pair.clientSecret) {
            console.warn(
                `Invalid GitHub OAuth pair for ${pair.name}: id and secret are identical.`,
            );
            continue;
        }

        return {
            clientId: pair.clientId,
            clientSecret: pair.clientSecret,
        } satisfies GitHubCredentials;
    }

    return null;
}

const githubCredentials = resolveGitHubCredentials();
const providers = githubCredentials
    ? [
          GitHubProvider({
              clientId: githubCredentials.clientId,
              clientSecret: githubCredentials.clientSecret,
              allowDangerousEmailAccountLinking:
                  shouldAllowLocalEmailAccountLinking(),
          }),
      ]
    : [];

if (!githubCredentials) {
    console.warn(
        "GitHub OAuth credentials are not configured. NextAuth provider is disabled until valid env vars are set.",
    );
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers,
    session: {
        strategy: "database",
    },
    pages: {
        signIn: "/login",
    },
    logger: {
        error(code, metadata) {
            console.error("[next-auth][error]", code, metadata);
        },
        warn(code) {
            console.warn("[next-auth][warn]", code);
        },
    },
};
