import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDay } from "./actions";
import { BSCard } from "@/components/BootstrapUI";

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
    <main className="min-vh-100 bg-light py-5">
      <div className="container">
        <header className="mb-5">
          <p className="text-uppercase text-primary fw-bold mb-1">Private</p>
          <h1 className="display-4 fw-bold">Add Day</h1>
          <p className="lead text-muted">
            Save one day of body battery, respiration, and stress values for your profile.
          </p>
        </header>

        {wasSaved ? <div className="alert alert-success">Day saved successfully.</div> : null}
        {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

        <form action={saveDay}>
          <BSCard className="mb-4 shadow-sm border-0">
            <h2 className="h4 mb-4">Shared</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Date *</label>
                <input name="pk_date" type="date" required className="form-control" />
              </div>
            </div>
          </BSCard>

          <BSCard className="mb-4 shadow-sm border-0">
            <h2 className="h4 mb-4">Body Battery</h2>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label d-block text-truncate">chargedValue</label><input name="chargedValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">drainedValue</label><input name="drainedValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">highest_statsValue</label><input name="highest_statsValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">lowest_statsValue</label><input name="lowest_statsValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">sleepend_statsValue</label><input name="sleepend_statsValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">sleepstart_statsValue</label><input name="sleepstart_statsValue" type="number" step="1" className="form-control" /></div>
              <div className="col-md-6"><label className="form-label d-block text-truncate">highest_statTimestamp</label><input name="highest_statTimestamp" type="datetime-local" className="form-control" /></div>
              <div className="col-md-6"><label className="form-label d-block text-truncate">lowest_statTimestamp</label><input name="lowest_statTimestamp" type="datetime-local" className="form-control" /></div>
              <div className="col-md-6"><label className="form-label d-block text-truncate">sleepend_statTimestamp</label><input name="sleepend_statTimestamp" type="datetime-local" className="form-control" /></div>
              <div className="col-md-6"><label className="form-label d-block text-truncate">sleepstart_statTimestamp</label><input name="sleepstart_statTimestamp" type="datetime-local" className="form-control" /></div>
            </div>
          </BSCard>

          <BSCard className="mb-4 shadow-sm border-0">
            <h2 className="h4 mb-4">Respiration</h2>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label d-block text-truncate">avgWakingRespirationValue</label><input name="avgWakingRespirationValue" type="number" step="0.01" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">highestRespirationValue</label><input name="highestRespirationValue" type="number" step="0.01" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">lowestRespirationValue</label><input name="lowestRespirationValue" type="number" step="0.01" className="form-control" /></div>
            </div>
          </BSCard>

          <BSCard className="mb-4 shadow-sm border-0">
            <h2 className="h4 mb-4">Stress</h2>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_averageStressLevel</label><input name="awake_averageStressLevel" type="number" step="0.01" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_averageStressLevelIntensity</label><input name="awake_averageStressLevelIntensity" type="number" step="0.01" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_highDuration</label><input name="awake_highDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_lowDuration</label><input name="awake_lowDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_maxStressLevel</label><input name="awake_maxStressLevel" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_mediumDuration</label><input name="awake_mediumDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_restDuration</label><input name="awake_restDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_stressDuration</label><input name="awake_stressDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_stressIntensityCount</label><input name="awake_stressIntensityCount" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_totalDuration</label><input name="awake_totalDuration" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_totalStressCount</label><input name="awake_totalStressCount" type="number" step="1" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label d-block text-truncate">awake_totalStressIntensity</label><input name="awake_totalStressIntensity" type="number" step="1" className="form-control" /></div>
            </div>
          </BSCard>

          <button type="submit" className="btn btn-primary btn-lg w-100 mt-2">
            Save Day
          </button>
        </form>
      </div>
    </main>
  );
}
