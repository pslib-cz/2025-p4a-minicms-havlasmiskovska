import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PrivateSidebar from "./private-sidebar";

function isDatabaseError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    return code === "P1000" || code === "P1001" || code === "P1002" || code === "P1003" || code === "P1008" || code === "P1017";
  }
  return false;
}

function DatabaseErrorPage({ message }: { message: string }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <div className="col-12 col-sm-8 col-md-6 col-lg-5">
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 p-md-5 text-center">
            <h1 className="h3 fw-bold text-danger mb-3">Database Error</h1>
            <p className="text-muted mb-3">
              The application cannot connect to the database. This is a server-side issue, not an authentication problem.
            </p>
            <div className="alert alert-danger text-start mb-4">
              <code className="small">{message}</code>
            </div>
            <p className="small text-muted">
              If this persists, please contact the administrator. Check that the database is running and credentials are correct.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[PrivateLayout] Failed to get session:", error);
    if (isDatabaseError(error)) {
      return <DatabaseErrorPage message={String((error as Error).message ?? error)} />;
    }
    redirect("/login?error=SessionError");
  }

  if (!session) {
    redirect("/login");
  }

  const email = session.user?.email;
  if (!email) {
    redirect("/login?error=Callback");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: { userProfilePK: true },
    });
  } catch (error) {
    console.error("[PrivateLayout] Failed to query user:", error);
    if (isDatabaseError(error)) {
      return <DatabaseErrorPage message={String((error as Error).message ?? error)} />;
    }
    throw error;
  }

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  return (
    <div className="d-flex flex-column flex-md-row vh-100 overflow-hidden bg-light">
      <PrivateSidebar email={session.user?.email ?? "Signed user"} />
      <div className="flex-grow-1 overflow-auto px-3 px-md-4 py-3 py-md-4">
        <div className="container-xxl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
