import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import styles from "./public-home.module.css";

export default async function PublicHomePage() {
    const session = await getServerSession(authOptions);

    if (session) {
        redirect("/private/dashboard");
    }

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <p className={styles.kicker}>Mini CMS</p>
                <h1 className={styles.title}>Health Snapshot Dashboard</h1>
                <p className={styles.subtitle}>
                    Sign in to access private anasaddaslytics and view your
                    latest stress trend.
                </p>

                <div className={styles.actions}>
                    <Link href="/login" className={styles.primaryAction}>
                        Go To Login
                    </Link>
                    <Link
                        href="/private/dashboard"
                        className={styles.secondaryAction}
                    >
                        Dashboard
                    </Link>
                    <Link
                        href="/published-days"
                        className={styles.secondaryAction}
                    >
                        Published Important Days
                    </Link>
                </div>
            </section>
        </main>
    );
}
