import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";

type GitHubCredentials = {
    clientId: string;
    clientSecret: string;
};

function shouldPreferLocalGitHubCredentials() {
    if (process.env.NODE_ENV === "production") {
        return false;
    }

    const rawUrl = process.env.NEXTAUTH_URL;
    if (!rawUrl) {
        return true;
    }

    try {
        const hostname = new URL(rawUrl).hostname;
        return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
        return true;
    }
}

if (process.env.NODE_ENV === "production") {
    const rawUrl = process.env.NEXTAUTH_URL;
    if (!rawUrl) {
        console.warn(
            "NEXTAUTH_URL is not set in production. OAuth callback may fail.",
        );
    } else {
        try {
            const hostname = new URL(rawUrl).hostname;
            if (hostname === "localhost" || hostname === "127.0.0.1") {
                console.warn(
                    "NEXTAUTH_URL points to localhost in production. Set NEXTAUTH_URL to your public HTTPS domain.",
                );
            }
        } catch {
            console.warn(
                "NEXTAUTH_URL is not a valid URL in production. OAuth callback may fail.",
            );
        }
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
        error: "/login",
    },
    callbacks: {
        async signIn({ user, account }) {
            if (!account) {
                console.error("[next-auth][signIn] No account in callback");
                return false;
            }
            console.log(
                `[next-auth][signIn] provider=${account.provider} user=${user.email ?? user.id}`,
            );
            return true;
        },
    },
    logger: {
        error(code, metadata) {
            const msg =
                metadata && typeof metadata === "object" && "message" in metadata
                    ? (metadata as { message?: string }).message
                    : "";
            console.error("[next-auth][error]", code, msg, metadata);
        },
        warn(code) {
            console.warn("[next-auth][warn]", code);
        },
    },
};
