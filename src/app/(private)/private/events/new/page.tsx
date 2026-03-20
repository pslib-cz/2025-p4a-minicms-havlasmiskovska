import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createImportantEvent } from "./actions";
import EventEditor from "./event-editor";
import styles from "./event-form.module.css";

type NewEventPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) {
    return null;
  }

  const known: Record<string, string> = {
    InvalidInput: "Please fill event name and valid dates.",
    InvalidRange: "End date cannot be before start date.",
    EmptyDescription: "Description is too short.",
    Default: "Could not save the event.",
  };

  return known[errorCode] ?? known.Default;
}

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
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
    select: { userProfilePK: true },
  });

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Important Days</p>
          <h1 className={styles.title}>Create Important Day</h1>
          <p className={styles.subtitle}>
            Add a one-day or multi-day event and describe what happened.
          </p>
        </header>

        {errorMessage ? <p className={styles.errorBox}>{errorMessage}</p> : null}

        <form action={createImportantEvent} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Event Name *</span>
                <input name="name" required placeholder="Exam week" />
              </label>

              <label className={styles.field}>
                <span>Tags (comma separated)</span>
                <input name="tags" placeholder="school, work, family" />
              </label>

              <label className={styles.field}>
                <span>Start Date *</span>
                <input name="startDate" type="date" required />
              </label>

              <label className={styles.field}>
                <span>End Date</span>
                <input name="endDate" type="date" />
              </label>
            </div>

            <fieldset className={styles.impactFieldset}>
              <legend>I think it will affect me:</legend>
              <label>
                <input type="radio" name="expectedEffect" value="POSITIVE" /> Positive
              </label>
              <label>
                <input type="radio" name="expectedEffect" value="NEGATIVE" defaultChecked /> Negative
              </label>
            </fieldset>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>What Happened</h2>
            <p className={styles.editorHint}>
              Supported: H1, H2, list, links, images and file attachments.
            </p>
            <EventEditor name="descriptionHtml" />
          </section>

          <div className={styles.actions}>
            <button type="submit" className={styles.submitButton}>Save Important Day</button>
            <Link href="/private/events" className={styles.backLink}>Back To Events</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
