import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PrivateSidebar from "./private-sidebar";
import styles from "./private-shell.module.css";

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className={styles.shell}>
      <PrivateSidebar email={session.user?.email ?? "Signed user"} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
