"use client";

import { signOut } from "next-auth/react";


export default function SignOutButton() {
  return (
    <button
      type="button"
      className="btn btn-outline-light mt-4 w-100"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign Out
    </button>
  );
}
