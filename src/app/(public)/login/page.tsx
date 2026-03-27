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
    OAuthSignin: "GitHub sign-in could not be started.",
    OAuthCallback: "OAuth callback failed. This usually means invalid GitHub credentials or callback mismatch.",
    Callback: "Sign-in callback failed on the server. Check application logs for the exact NextAuth error details.",
    OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
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
