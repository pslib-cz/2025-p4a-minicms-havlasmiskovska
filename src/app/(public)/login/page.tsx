import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginButton from "./login-button";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) {
    return null;
  }

  const knownMessages: Record<string, string> = {
    OAuthSignin: "GitHub sign-in could not be started.",
    OAuthCallback:
      "OAuth callback failed. This usually means invalid GitHub credentials or callback mismatch.",
    Callback:
      "Sign-in callback failed on the server. Check application logs for the exact NextAuth error details.",
    OAuthAccountNotLinked:
      "This email is already linked to a different sign-in method.",
    Configuration: "Authentication configuration is invalid on the server.",
    AccessDenied: "Access denied.",
    Verification: "Verification failed.",
    Default: "Sign-in failed unexpectedly.",
  };

  return knownMessages[errorCode] ?? knownMessages.Default;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorCode = resolvedSearchParams.error;
  const errorMessage = getErrorMessage(errorCode);

  if (session) {
    redirect("/private/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Private Access</p>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.subtitle}>
          This section is private. After authentication, you will be redirected to your dashboard.
        </p>

        {errorMessage ? (
          <p className={styles.errorBox}>
            {errorMessage}
            {errorCode ? <span className={styles.errorCode}>Error code: {errorCode}</span> : null}
          </p>
        ) : null}

        <LoginButton />

        <Link href="/register" className={styles.backLink}>
          Go To Registration
        </Link>

        <Link href="/" className={styles.backLink}>
          Back To Public Home
        </Link>
      </section>
    </main>
  );
}
