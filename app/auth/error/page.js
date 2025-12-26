"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    const errorMessages = {
        Configuration: "There's a problem with the server configuration. Please contact the administrator.",
        AccessDenied: "You do not have permission to sign in.",
        Verification: "The verification link has expired or has already been used.",
        OAuthSignin: "Error starting the OAuth sign in flow.",
        OAuthCallback: "Error during the OAuth callback. This usually means the database isn't set up yet.",
        OAuthCreateAccount: "Could not create user account.",
        EmailCreateAccount: "Could not create email account.",
        Callback: "Error during the callback. The database may not be configured correctly.",
        OAuthAccountNotLinked: "This email is already associated with another account.",
        EmailSignin: "Error sending the email.",
        CredentialsSignin: "Sign in failed. Check the details you provided are correct.",
        SessionRequired: "Please sign in to access this page.",
        Default: "Unable to sign in.",
    };

    const errorMessage = errorMessages[error] || errorMessages.Default;

    return (
        <div style={{
            minHeight: "100vh",
            background: "#0a0a0a",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
        }}>
            <div style={{
                background: "rgba(255,255,255,0.05)",
                padding: "32px",
                borderRadius: "16px",
                maxWidth: "400px",
                textAlign: "center"
            }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
                <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" }}>
                    Authentication Error
                </h1>
                <p style={{ color: "#888", marginBottom: "24px", fontSize: "14px" }}>
                    {errorMessage}
                </p>
                {error === "Callback" && (
                    <div style={{
                        background: "rgba(255,200,0,0.1)",
                        border: "1px solid rgba(255,200,0,0.3)",
                        padding: "12px",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "12px",
                        color: "#ffc800"
                    }}>
                        <strong>Admin Note:</strong> Run <code>npx prisma db push</code> to create database tables.
                    </div>
                )}
                <a
                    href="/"
                    style={{
                        display: "inline-block",
                        background: "#6366F1",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontSize: "14px"
                    }}
                >
                    ← Back to Home
                </a>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }}></div>}>
            <ErrorContent />
        </Suspense>
    );
}
