"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Offcanvas } from "react-bootstrap";

const NAV_ITEMS = [
    { href: "/private/dashboard", label: "Dashboard" },
    { href: "/private/events", label: "Important Days" },
    { href: "/private/stress", label: "Stress" },
    { href: "/private/body-battery", label: "Body Battery" },
    { href: "/private/respiration", label: "Respiration" },
];

type PrivateSidebarProps = {
    email: string;
};

function NavLinks({
    pathname,
    onNavigate,
}: {
    pathname: string;
    onNavigate?: () => void;
}) {
    return (
        <nav
            className="nav flex-column gap-2 mb-auto"
            aria-label="Private sections"
        >
            {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={
                            isActive
                                ? "nav-link p-2 rounded bg-primary text-white"
                                : "nav-link p-2 rounded text-white-50"
                        }
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export default function PrivateSidebar({ email }: PrivateSidebarProps) {
    const pathname = usePathname();
    const [show, setShow] = useState(false);

    return (
        <>
            <aside className="d-none d-md-flex flex-column bg-dark text-white p-4 vh-100 sticky-top col-md-5 col-lg-3">
                <div>
                    <p className="text-uppercase text-secondary small fw-bold mb-1">
                        Private
                    </p>
                    <p className="fs-4 fw-bold text-white mb-4">
                        Health Snapshot
                    </p>
                </div>

                <p
                    className="text-white mb-4 pb-3 border-bottom border-secondary text-truncate"
                    title={email}
                >
                    {email}
                </p>

                <NavLinks pathname={pathname} />

                <button
                    type="button"
                    className="btn btn-outline-light mt-4 w-100"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    Sign Out
                </button>
            </aside>

            <nav
                className="d-flex d-md-none bg-dark text-white px-3 py-2 align-items-center justify-content-between"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1030,
                }}
            >
                <div className="d-flex flex-column lh-1">
                    <span className="text-uppercase text-secondary small">
                        Private
                    </span>
                    <span className="fw-bold text-white">Health Snapshot</span>
                </div>
                <button
                    type="button"
                    className="btn btn-sm bg-transparent border-0 text-white p-1 lh-1"
                    onClick={() => setShow(true)}
                    aria-label="Open menu"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path
                            fillRule="evenodd"
                            d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"
                        />
                    </svg>
                </button>
            </nav>

            <Offcanvas
                show={show}
                onHide={() => setShow(false)}
                placement="end"
                className="bg-dark text-white w-auto"
            >
                <Offcanvas.Header
                    closeButton
                    closeVariant="white"
                    className="border-bottom border-secondary"
                >
                    <Offcanvas.Title className="text-white">
                        <span className="text-uppercase text-secondary small d-block">
                            Private
                        </span>
                        Health Snapshot
                    </Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body className="d-flex flex-column p-3">
                    <p
                        className="d-md-block d-lg-none text-white mb-4 pb-3 border-bottom border-secondary text-truncate"
                        title={email}
                        style={{ fontSize: "0.65rem" }}
                    >
                        {email}
                    </p>

                    <p
                        className="d-none d-lg-block text-white small mb-4 pb-3 border-bottom border-secondary text-truncate"
                        title={email}
                    >
                        {email}
                    </p>

                    <NavLinks
                        pathname={pathname}
                        onNavigate={() => setShow(false)}
                    />

                    <button
                        type="button"
                        className="btn btn-outline-light mt-4 w-100"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        Sign Out
                    </button>
                </Offcanvas.Body>
            </Offcanvas>
        </>
    );
}
