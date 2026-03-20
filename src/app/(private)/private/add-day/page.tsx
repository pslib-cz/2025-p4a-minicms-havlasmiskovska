import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDay } from "./actions";
import styles from "./add-day.module.css";

type AddDayPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) {
    return null;
  }

  if (errorCode === "InvalidDate") {
    return "Please enter a valid date.";
  }

  return "Could not save this day. Please check your values and try again.";
}

export default async function AddDayPage({ searchParams }: AddDayPageProps) {
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
  const wasSaved = resolvedSearchParams.success === "1";
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Private</p>
          <h1 className={styles.title}>Add Day</h1>
          <p className={styles.subtitle}>
            Save one day of body battery, respiration, and stress values for your profile.
          </p>
        </header>

        {wasSaved ? <p className={styles.successBox}>Day saved successfully.</p> : null}
        {errorMessage ? <p className={styles.errorBox}>{errorMessage}</p> : null}

        <form action={saveDay} className={styles.form}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Shared</h2>
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span>Date *</span>
                <input name="pk_date" type="date" required />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Body Battery</h2>
            <div className={styles.grid3}>
              <label className={styles.field}><span>chargedValue</span><input name="chargedValue" type="number" step="1" /></label>
              <label className={styles.field}><span>drainedValue</span><input name="drainedValue" type="number" step="1" /></label>
              <label className={styles.field}><span>highest_statsValue</span><input name="highest_statsValue" type="number" step="1" /></label>
              <label className={styles.field}><span>lowest_statsValue</span><input name="lowest_statsValue" type="number" step="1" /></label>
              <label className={styles.field}><span>sleepend_statsValue</span><input name="sleepend_statsValue" type="number" step="1" /></label>
              <label className={styles.field}><span>sleepstart_statsValue</span><input name="sleepstart_statsValue" type="number" step="1" /></label>
              <label className={styles.field}><span>highest_statTimestamp</span><input name="highest_statTimestamp" type="datetime-local" /></label>
              <label className={styles.field}><span>lowest_statTimestamp</span><input name="lowest_statTimestamp" type="datetime-local" /></label>
              <label className={styles.field}><span>sleepend_statTimestamp</span><input name="sleepend_statTimestamp" type="datetime-local" /></label>
              <label className={styles.field}><span>sleepstart_statTimestamp</span><input name="sleepstart_statTimestamp" type="datetime-local" /></label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Respiration</h2>
            <div className={styles.grid3}>
              <label className={styles.field}><span>avgWakingRespirationValue</span><input name="avgWakingRespirationValue" type="number" step="0.01" /></label>
              <label className={styles.field}><span>highestRespirationValue</span><input name="highestRespirationValue" type="number" step="0.01" /></label>
              <label className={styles.field}><span>lowestRespirationValue</span><input name="lowestRespirationValue" type="number" step="0.01" /></label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Stress</h2>
            <div className={styles.grid3}>
              <label className={styles.field}><span>awake_averageStressLevel</span><input name="awake_averageStressLevel" type="number" step="0.01" /></label>
              <label className={styles.field}><span>awake_averageStressLevelIntensity</span><input name="awake_averageStressLevelIntensity" type="number" step="0.01" /></label>
              <label className={styles.field}><span>awake_highDuration</span><input name="awake_highDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_lowDuration</span><input name="awake_lowDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_maxStressLevel</span><input name="awake_maxStressLevel" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_mediumDuration</span><input name="awake_mediumDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_restDuration</span><input name="awake_restDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_stressDuration</span><input name="awake_stressDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_stressIntensityCount</span><input name="awake_stressIntensityCount" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_totalDuration</span><input name="awake_totalDuration" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_totalStressCount</span><input name="awake_totalStressCount" type="number" step="1" /></label>
              <label className={styles.field}><span>awake_totalStressIntensity</span><input name="awake_totalStressIntensity" type="number" step="1" /></label>
            </div>
          </section>

          <button type="submit" className={styles.submitButton}>
            Save Day
          </button>
        </form>
      </section>
    </main>
  );
}
