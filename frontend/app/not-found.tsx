import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <PageShell>
      <section className="py-28 md:py-40">
        <div className="max-w-lg mx-auto px-5 text-center">
          <div className="font-mono-tabular text-7xl mb-6" style={{ color: "var(--color-accent)" }}>
            404
          </div>
          <h1 className="font-display text-3xl mb-4" style={{ color: "var(--color-surface)" }}>
            This task doesn&apos;t exist.
          </h1>
          <p className="text-base mb-10" style={{ color: "rgba(245,242,234,0.6)" }}>
            The page you&apos;re looking for may have been moved or never existed. Let&apos;s get you
            back to something useful.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-sm font-medium"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            Back to home <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
