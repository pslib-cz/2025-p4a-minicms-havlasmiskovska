import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeRegistration } from "./actions";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) return null;

  const knownMessages: Record<string, string> = {
    InvalidProfilePK: "User Profile PK must be a positive number.",
    ProfileInUse: "This User Profile PK is already assigned to another user.",
    SaveFailed: "Could not save registration data. Please try again.",
    Default: "Registration failed.",
  };

  return knownMessages[errorCode] ?? knownMessages.Default;
}

function PageShell({ kicker, title, subtitle, children }: {
  kicker: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="w-100 row justify-content-center m-0">
      <div className="col-12 col-sm-9 col-md-7 col-lg-5 p-0">
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5">
          <p className="text-uppercase text-primary fw-bold small mb-1">{kicker}</p>
          <h1 className="h3 fw-bold mb-2">{title}</h1>
          <p className="text-muted mb-4">{subtitle}</p>
          {children}
        </div>
      </div>
      </div>
      </div>
    </main>
  );
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = (await searchParams) ?? {};

  if (!session) {
    return (
      <PageShell
        kicker="Registration"
        title="Sign In Required"
        subtitle="Please sign in with GitHub first, then complete registration."
      >
        <Link href="/login" className="btn btn-dark w-100">
          Go To Login
        </Link>
      </PageShell>
    );
  }

  const email = session.user?.email;
  if (!email) {
    return (
      <PageShell
        kicker="Registration"
        title="Email Not Available"
        subtitle="Your OAuth account did not provide an email address, so we cannot finish registration."
      >
        <Link href="/login?error=Callback" className="btn btn-outline-secondary w-100">
          Back To Login
        </Link>
      </PageShell>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, userProfilePK: true, email: true },
  });

  if (user?.userProfilePK !== null && user?.userProfilePK !== undefined) {
    redirect("/private/dashboard");
  }

  const errorCode = resolvedSearchParams.error;
  const errorMessage = getErrorMessage(errorCode);

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="w-100 row justify-content-center m-0">
      <div className="col-12 col-sm-9 col-md-7 col-lg-5 p-0">
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5">
          <p className="text-uppercase text-primary fw-bold small mb-1">Registration</p>
          <h1 className="h3 fw-bold mb-2">Complete Your Profile</h1>
          <p className="text-muted mb-3">
            Before entering dashboard pages, save your user profile id so your daily metrics can be linked to your account.
          </p>

          <div className="alert alert-secondary py-2 mb-4 small">
            {user?.email ?? "Signed user"}
          </div>

          {errorMessage && (
            <div className="alert alert-danger py-2 mb-4">
              <div>{errorMessage}</div>
              {errorCode && (
                <div className="mt-1 small text-muted">Error code: {errorCode}</div>
              )}
            </div>
          )}

          <form action={completeRegistration} className="d-flex flex-column gap-3">
            <div>
              <label className="form-label fw-semibold" htmlFor="name">
                Display Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={user?.name ?? ""}
                className="form-control"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="form-label fw-semibold" htmlFor="userProfilePK">
                User Profile PK
              </label>
              <input
                id="userProfilePK"
                name="userProfilePK"
                type="number"
                min={1}
                required
                className="form-control"
                placeholder="For example: 104768835"
              />
            </div>

            <button type="submit" className="btn btn-primary w-100 py-2">
              Save And Continue
            </button>
          </form>

          <hr className="my-3" />

          <Link href="/login" className="btn btn-link btn-sm text-muted text-decoration-none w-100">
            ← Back To Login
          </Link>
        </div>
      </div>
      </div>
      </div>
    </main>
  );
}
