"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { BlogPost } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export default function BlogDetailPage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.slug) return;
    api
      .get(`/cms/blog/${params.slug}`)
      .then((res) => setPost(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-2xl mx-auto px-5">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm mb-10" style={{ color: "var(--color-accent)" }}>
            <ArrowLeft size={15} /> Back to blog
          </Link>

          {loading ? (
            <div style={{ color: "rgba(245,242,234,0.5)" }}>Loading…</div>
          ) : notFound || !post ? (
            <div style={{ color: "rgba(245,242,234,0.5)" }}>Post not found.</div>
          ) : (
            <article>
              <span className="text-xs font-mono-tabular" style={{ color: "var(--color-muted)" }}>
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
              </span>
              <h1 className="font-display text-3xl md:text-5xl mt-3 mb-8 leading-tight" style={{ color: "var(--color-surface)" }}>
                {post.title}
              </h1>
              <div
                className="prose text-base leading-relaxed whitespace-pre-wrap"
                style={{ color: "rgba(245,242,234,0.8)" }}
              >
                {post.content}
              </div>
            </article>
          )}
        </div>
      </section>
    </PageShell>
  );
}
