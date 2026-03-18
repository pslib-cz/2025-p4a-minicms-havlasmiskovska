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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = (await searchParams) ?? {};
  const oauthFailed = resolvedSearchParams.error === "OAuthCallback";

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

        {oauthFailed ? (
          <p className={styles.errorBox}>
            Login failed at OAuth callback. This usually means GitHub credentials are invalid for this environment.
          </p>
        ) : null}

        <LoginButton />

        <Link href="/" className={styles.backLink}>
          Back To Public Home
        </Link>
      </section>
    </main>
  );
}
