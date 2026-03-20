import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeRegistration } from "./actions";
import styles from "./register.module.css";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) {
    return null;
  }

  const knownMessages: Record<string, string> = {
    InvalidProfilePK: "User Profile PK must be a positive number.",
    ProfileInUse: "This User Profile PK is already assigned to another user.",
    SaveFailed: "Could not save registration data. Please try again.",
    Default: "Registration failed.",
  };

  return knownMessages[errorCode] ?? knownMessages.Default;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const email = session.user?.email;
  if (!email) {
    redirect("/login?error=Callback");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      name: true,
      userProfilePK: true,
      email: true,
    },
  });

  if (user?.userProfilePK !== null && user?.userProfilePK !== undefined) {
    redirect("/private/dashboard");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorCode = resolvedSearchParams.error;
  const errorMessage = getErrorMessage(errorCode);

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Registration</p>
        <h1 className={styles.title}>Complete Your Profile</h1>
        <p className={styles.subtitle}>
          Before entering dashboard pages, save your user profile id so your daily metrics can be linked to your account.
        </p>

        <p className={styles.account}>{user?.email ?? "Signed user"}</p>

        {errorMessage ? (
          <p className={styles.errorBox}>
            {errorMessage}
            {errorCode ? <span className={styles.errorCode}>Error code: {errorCode}</span> : null}
          </p>
        ) : null}

        <form action={completeRegistration} className={styles.form}>
          <label className={styles.label} htmlFor="name">
            Display Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={user?.name ?? ""}
            className={styles.input}
            placeholder="Your name"
          />

          <label className={styles.label} htmlFor="userProfilePK">
            User Profile PK
          </label>
          <input
            id="userProfilePK"
            name="userProfilePK"
            type="number"
            min={1}
            required
            className={styles.input}
            placeholder="For example: 104768835"
          />

          <button type="submit" className={styles.submitButton}>
            Save And Continue
          </button>
        </form>

        <Link href="/login" className={styles.backLink}>
          Back To Login
        </Link>
      </section>
    </main>
  );
}
