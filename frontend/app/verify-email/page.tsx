"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

function VerifyEmailBody() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    api.post("/auth/verify-email", { token })
      .then((r) => {
        setStatus("success");
        setMessage(r.data.message || "Email verified!");
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Verification failed. Please try again.";
        setStatus("error");
        setMessage(msg);
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(245,242,234,0.7)" }}>
        <Loader2 size={16} className="animate-spin shrink-0" />
        <span>Verifying your email…</span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(0,200,117,0.1)", color: "var(--color-accent)" }}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
        <Link href="/dashboard" className="px-5 py-3.5 rounded-sm font-medium text-sm text-center" style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 text-sm p-4 rounded-sm" style={{ background: "rgba(232,99,58,0.12)", color: "var(--color-alert)" }}>
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      <Link href="/dashboard" className="text-sm" style={{ color: "var(--color-accent)" }}>
        Go to dashboard — you can request a new link from your profile.
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-sm mx-auto px-5">
          <h1 className="font-display text-3xl md:text-4xl mb-2" style={{ color: "var(--color-surface)" }}>
            Verify your email
          </h1>
          <p className="text-sm mb-8" style={{ color: "rgba(245,242,234,0.6)" }}>
            Confirming your TaskEarn account.
          </p>
          <Suspense>
            <VerifyEmailBody />
          </Suspense>
        </div>
      </section>
    </PageShell>
  );
}
