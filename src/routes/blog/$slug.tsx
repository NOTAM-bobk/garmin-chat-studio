import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BlogShell } from "@/components/blog/BlogShell";
import { JsonLd } from "@/components/seo/json-ld";
import { formatPostDate, getBlogPost } from "@/lib/blog";
import { SITE_NAME, siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return { meta: [{ title: `Post not found — ${SITE_NAME}` }], links: [] };
    const url = siteUrl(`/blog/${post.slug}`);
    return {
      meta: [
        { title: `${post.title} — ${SITE_NAME}` },
        { name: "description", content: post.description },
        ...(post.keywords.length ? [{ name: "keywords", content: post.keywords.join(", ") }] : []),
        { property: "og:type", content: "article" },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:url", content: url },
        { property: "article:published_time", content: post.date },
        { property: "article:author", content: post.author },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: BlogPostPage,
  notFoundComponent: MissingPost,
});

function MissingPost() {
  return (
    <BlogShell>
      <h1 className="text-[28px] font-semibold tracking-tight">That post doesn&apos;t exist</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">The link may be old or mistyped.</p>
      <a
        href="/blog"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background"
      >
        Browse all posts
        <ArrowUpRight className="size-3.5" />
      </a>
    </BlogShell>
  );
}

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const url = siteUrl(`/blog/${post.slug}`);

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: "en",
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        author: { "@type": "Person", name: post.author },
        publisher: { "@type": "Organization", name: SITE_NAME },
        ...(post.keywords.length ? { keywords: post.keywords.join(", ") } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: siteUrl("/blog") },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
      ...(post.faq.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: post.faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <BlogShell>
      <JsonLd data={data} />
      <article>
        <nav aria-label="Breadcrumb" className="text-[11.5px] text-muted-foreground">
          <a href="/" className="transition-colors hover:text-foreground">
            Home
          </a>
          <span aria-hidden="true" className="px-1.5">
            /
          </span>
          <a href="/blog" className="transition-colors hover:text-foreground">
            Blog
          </a>
        </nav>

        <h1 className="mt-3 text-[30px] font-semibold leading-[1.15] tracking-tight sm:text-[36px]">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{post.readingMinutes} min read</span>
          <span aria-hidden="true">·</span>
          <span>{post.author}</span>
        </div>

        <div className="prose-blog mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </div>

        {post.faq.length > 0 && (
          <section className="mt-10 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold tracking-tight">Quick answers</h2>
            <dl className="mt-3 space-y-3">
              {post.faq.map((item) => (
                <div key={item.q}>
                  <dt className="text-[13.5px] font-medium">{item.q}</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <aside className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[14px] font-semibold tracking-tight">Ask this of your own data</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Garmin Chat reads your sleep, readiness and activities through Garmin&apos;s MCP
              server and answers in plain language.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <MessageSquare className="size-3.5" />
            Open chat
          </a>
        </aside>
      </article>
    </BlogShell>
  );
}
