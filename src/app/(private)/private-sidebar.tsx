"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./private-shell.module.css";

const NAV_ITEMS = [
  { href: "/private/dashboard", label: "Dashboard" },
  { href: "/private/stress", label: "Stress" },
  { href: "/private/body-battery", label: "Body Battery" },
  { href: "/private/respiration", label: "Respiration" },
];

type PrivateSidebarProps = {
  email: string;
};

export default function PrivateSidebar({ email }: PrivateSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div>
        <p className={styles.brandKicker}>Private</p>
        <p className={styles.brandTitle}>Health Snapshot</p>
      </div>

      <p className={styles.account}>{email}</p>

      <nav className={styles.nav} aria-label="Private sections">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const linkClass = isActive
            ? `${styles.navLink} ${styles.navLinkActive}`
            : styles.navLink;

          return (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className={styles.signOutButton}
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sign Out
      </button>
    </aside>
  );
}
