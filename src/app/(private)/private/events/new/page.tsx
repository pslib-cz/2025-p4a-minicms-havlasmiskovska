import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BootstrapEventForm from "./BootstrapEventForm";

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

export default async function NewEventPage({
    searchParams,
}: NewEventPageProps) {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    const resolvedSearchParams = (await searchParams) ?? {};
    const errorMessage = getErrorMessage(resolvedSearchParams.error);

    return (
        <main className="min-vh-100 bg-light py-5">
            <section className="">
                <header className="mb-5">
                    <p className="text-uppercase text-primary fw-bold mb-1">
                        Important Days
                    </p>
                    <h1 className="display-5 fw-bold mb-3">
                        Create Important Day
                    </h1>
                    <p className="lead text-muted">
                        Add a one-day or multi-day event and describe what
                        happened.
                    </p>
                </header>

                {errorMessage ? (
                    <p className="errorBox">{errorMessage}</p>
                ) : null}

                <BootstrapEventForm />
            </section>
        </main>
    );
}
