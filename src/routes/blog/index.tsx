import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";

import { BlogShell } from "@/components/blog/BlogShell";
import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_POSTS, formatPostDate } from "@/lib/blog";
import { SITE_NAME, siteUrl } from "@/lib/seo";

const TITLE = "Garmin training blog — sleep, readiness and training load";
const DESCRIPTION =
  "Plain-language guides to the Garmin metrics that matter: training readiness, sleep score, HRV baseline, and acute versus chronic load — and how to act on them.";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: siteUrl("/blog") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: siteUrl("/blog") }],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE_NAME} blog`,
    description: DESCRIPTION,
    url: siteUrl("/blog"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: BLOG_POSTS.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: siteUrl(`/blog/${post.slug}`),
        name: post.title,
      })),
    },
  };

  return (
    <BlogShell>
      <JsonLd data={data} />
      <header>
        <p className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          <BookOpen className="size-3" />
          Blog
        </p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight sm:text-[38px]">
          Training data, read properly
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Short, practical explanations of the recovery, sleep and load metrics your watch already
          records — what they mean, what they don&apos;t, and when to change the plan.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        {BLOG_POSTS.map((post) => (
          <a
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/40"
          >
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingMinutes} min read</span>
            </div>
            <h2 className="mt-1.5 text-[19px] font-semibold tracking-tight group-hover:underline">
              {post.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {post.description}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-ink">
              Read post
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
        ))}
      </div>
    </BlogShell>
  );
}
