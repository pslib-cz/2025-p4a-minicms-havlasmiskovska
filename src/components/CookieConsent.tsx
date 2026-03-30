"use client";

import { useState } from "react";

function hasConsent() {
    if (typeof document === "undefined") return true;
    return document.cookie
        .split("; ")
        .some((row) => row.startsWith("analytics_consent="));
}

export default function CookieConsent() {
    const [visible, setVisible] = useState(() => !hasConsent());

    function respond(granted: boolean) {
        const value = granted ? "granted" : "denied";
        document.cookie = `analytics_consent=${value}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        setVisible(false);

        if (granted) {
            window.location.reload();
        }
    }

    if (!visible) return null;

    return (
        <div
            className="position-fixed bottom-0 start-0 end-0 bg-dark text-white p-3 shadow-lg"
            style={{ zIndex: 9999 }}
        >
            <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
                <p className="mb-0 small">
                    We use cookies for analytics to improve your experience. You
                    can accept or decline.
                </p>
                <div className="d-flex gap-2 flex-shrink-0">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-light"
                        onClick={() => respond(false)}
                    >
                        Decline
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => respond(true)}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
