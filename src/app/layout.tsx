import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const BASE_URL =
    process.env.NEXTAUTH_URL ?? "https://cms.144-91-77-107.sslip.io";

export const metadata: Metadata = {
    title: {
        default: "Mini CMS",
        template: "%s | Mini CMS",
    },
    description:
        "Mini CMS is a personal health snapshot dashboard for tracking stress, body battery, respiration, and important life events.",
    metadataBase: new URL(BASE_URL),
    openGraph: {
        siteName: "Mini CMS",
        type: "website",
        locale: "cs_CZ",
        url: BASE_URL,
        title: "Mini CMS",
        description:
            "Mini CMS is a personal health snapshot dashboard for tracking stress, body battery, respiration, and important life events.",
    },
    alternates: {
        canonical: BASE_URL,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                {children}
            </body>
        </html>
    );
}
