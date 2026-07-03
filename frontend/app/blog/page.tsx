"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import api from "@/lib/api";
import { BlogPost } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/cms/blog")
      .then((res) => setPosts(res.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell>
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 mb-14">
          <div className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--color-accent)" }}>
            Blog
          </div>
          <h1 className="font-display text-4xl md:text-5xl" style={{ color: "var(--color-surface)" }}>
            Tips, updates, and earner stories.
          </h1>
        </div>

        <div className="max-w-3xl mx-auto px-5">
          {loading ? (
            <div className="text-center py-12" style={{ color: "rgba(245,242,234,0.5)" }}>Loading posts…</div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center ledger-row" style={{ color: "rgba(245,242,234,0.5)" }}>
              No posts published yet. Check back soon.
            </div>
          ) : (
            <div className="flex flex-col">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="ledger-row py-7 flex flex-col gap-2 group">
                  <span className="text-xs font-mono-tabular" style={{ color: "var(--color-muted)" }}>
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                  </span>
                  <h2 className="font-display text-2xl group-hover:opacity-80" style={{ color: "var(--color-surface)" }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm" style={{ color: "rgba(245,242,234,0.6)" }}>{post.excerpt}</p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-sm mt-1" style={{ color: "var(--color-accent)" }}>
                    Read post <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
