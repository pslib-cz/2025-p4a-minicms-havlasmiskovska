import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginButton from "./login-button";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(errorCode: string | undefined) {
  if (!errorCode) return null;

  const knownMessages: Record<string, string> = {
    OAuthSignin: "GitHub sign-in could not be started. Check that GITHUB_ID and GITHUB_SECRET are configured correctly.",
    OAuthCallback: "OAuth callback failed. This usually means invalid GitHub credentials, a callback URL mismatch, or a database connection problem.",
    Callback: "Sign-in callback failed on the server. This often indicates a database connection issue (e.g. wrong credentials or DB is unreachable). Check application logs.",
    OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
    Configuration: "Authentication configuration is invalid on the server.",
    AccessDenied: "Access denied.",
    Verification: "Verification failed.",
    SessionError: "Could not verify your session due to a server error (likely a database connection issue). You are probably still logged in — the server just can't verify it right now.",
    DatabaseError: "The server cannot connect to the database. Authentication is unavailable until this is resolved.",
    Default: "Sign-in failed unexpectedly.",
  };

  return knownMessages[errorCode] ?? `${knownMessages.Default} (code: ${errorCode})`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  let session = null;
  let sessionError: string | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[LoginPage] Failed to get session:", error);
    const isPrismaError = error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string" && (error as { code: string }).code.startsWith("P");
    sessionError = isPrismaError
      ? "Database connection failed. Cannot verify your session. The database may be down or credentials may be misconfigured."
      : "An unexpected error occurred while checking your session.";
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const errorCode = resolvedSearchParams.error;
  const errorMessage = getErrorMessage(errorCode);

  if (session) {
    redirect("/private/dashboard");
  }

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="w-100 row justify-content-center m-0">
      <div className="col-12 col-sm-8 col-md-6 col-lg-5 p-0">
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5">
          <p className="text-uppercase text-primary fw-bold small mb-1 ls-1">Private Access</p>
          <h1 className="h3 fw-bold mb-2">Sign In</h1>
          <p className="text-muted mb-4">
            This section is private. After authentication, you will be redirected to your dashboard.
          </p>

          {sessionError && (
            <div className="alert alert-warning py-2 mb-4">
              <strong>Server Issue:</strong> {sessionError}
            </div>
          )}

          {errorMessage && (
            <div className="alert alert-danger py-2 mb-4">
              <div>{errorMessage}</div>
              {errorCode && (
                <div className="mt-1 small text-muted">Error code: {errorCode}</div>
              )}
            </div>
          )}

          <LoginButton />

          <hr className="my-4" />

          <div className="d-flex flex-column gap-2">
            <Link href="/register" className="btn btn-outline-secondary btn-sm">
              Go To Registration
            </Link>
            <Link href="/" className="btn btn-link btn-sm text-muted text-decoration-none">
              ← Back To Public Home
            </Link>
          </div>
        </div>
      </div>
      </div>
      </div>
    </main>
  );
}
