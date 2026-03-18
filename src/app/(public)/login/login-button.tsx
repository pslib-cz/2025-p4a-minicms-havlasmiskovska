"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import styles from "./login.module.css";

export default function LoginButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    await signIn("github", { callbackUrl: "/dashboard" });
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className={styles.submitButton}
      disabled={loading}
    >
      {loading ? "Redirecting..." : "Continue With GitHub"}
    </button>
  );
}
