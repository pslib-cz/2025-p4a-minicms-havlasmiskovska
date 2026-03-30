import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginButton from "./login-button";

export default async function LoginPage() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect("/private/dashboard");
    }

    return (
        <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
            <div className="w-100 row justify-content-center m-0">
                <div className="col-12 col-sm-9 col-md-6 col-lg-4 p-0">
                    <div className="card border-0 shadow-sm text-center">
                        <div className="card-body p-4 p-md-5">
                            <p className="text-uppercase text-primary fw-bold small mb-1">
                                Mini CMS
                            </p>
                            <h1 className="h2 fw-bold mb-3">
                                Health Snapshot Dashboard
                            </h1>
                            <p className="text-muted mb-4">
                                Sign in to access your private analytics
                                dashboard.
                            </p>
                            <LoginButton />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
