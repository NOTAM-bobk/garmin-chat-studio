/**
 * Blog posts live as markdown files in /blogs at the repository root.
 *
 * Drop a new `.md` file in that folder and it appears here on the next dev
 * reload or build — no registry to edit. Frontmatter fields: title,
 * description, date (YYYY-MM-DD), author, keywords (comma separated) and an
 * optional `faq` JSON array of { q, a } objects.
 */

export type BlogFaq = { q: string; a: string };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  keywords: string[];
  faq: BlogFaq[];
  readingMinutes: number;
  body: string;
};

const files = import.meta.glob("/blogs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseFaq(raw: string | undefined): BlogFaq[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): BlogFaq[] => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const q = typeof record["q"] === "string" ? record["q"].trim() : "";
      const a = typeof record["a"] === "string" ? record["a"].trim() : "";
      return q && a ? [{ q, a }] : [];
    });
  } catch {
    return [];
  }
}

function parseFrontmatter(source: string): { data: Record<string, string>; body: string } {
  const text = source.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return { data: {}, body: text.trim() };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: text.trim() };

  const data: Record<string, string> = {};
  for (const line of text.slice(3, end).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match?.[1]) continue;
    data[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "").trim();
  }
  return { data, body: text.slice(end + 4).trim() };
}

function toPost(path: string, source: string): BlogPost {
  const { data, body } = parseFrontmatter(source);
  const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: data["title"] ?? slug.replace(/-/g, " "),
    description: data["description"] ?? "",
    date: data["date"] ?? "1970-01-01",
    author: data["author"] ?? "Sawyer Schulz",
    keywords: (data["keywords"] ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    faq: parseFaq(data["faq"]),
    readingMinutes: Math.max(1, Math.round(words / 220)),
    body,
  };
}

export const BLOG_POSTS: BlogPost[] = Object.entries(files)
  .map(([path, source]) => toPost(path, source))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function formatPostDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
