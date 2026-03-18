"use client";

import { signOut } from "next-auth/react";
import styles from "./dashboard.module.css";

export default function SignOutButton() {
  return (
    <button
      type="button"
      className={styles.signOutButton}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign Out
    </button>
  );
}
