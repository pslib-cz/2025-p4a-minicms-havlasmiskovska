"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
    return (
        <button
            type="button"
            className="btn btn-dark btn-lg w-100"
            onClick={() =>
                signIn("github", { callbackUrl: "/private/dashboard" })
            }
        >
            Sign in with GitHub
        </button>
    );
}
