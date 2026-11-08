import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { relativeTime, type Chat } from "@/lib/chat";
import type { BlogPost } from "@/lib/blog";

function snippet(text: string, query: string): string | null {
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return null;
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

const SITE_PAGES = [
  { href: "/", title: "Chat", description: "Ask questions about your Garmin training data." },
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Review your training metrics and Garmin readings.",
  },
  {
    href: "/calendar",
    title: "Workout calendar",
    description: "View your Garmin workout calendar.",
  },
  {
    href: "/upgrade",
    title: "Get unlimited access",
    description: "Explore Garmin Chat plans and features.",
  },
  { href: "/blog", title: "Blog", description: "Read guides about Garmin metrics and training." },
];

type SearchResult =
  | { type: "chat"; id: string; title: string; preview: string | null; updated: number; chat: Chat }
  | { type: "page" | "blog"; id: string; title: string; preview: string; href: string };

export function SearchDialog({
  open,
  onOpenChange,
  chats,
  blogs = [],
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chats: Chat[];
  blogs?: BlogPost[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const results = useMemo((): SearchResult[] => {
    const needle = query.trim().toLowerCase();
    const pageResults = SITE_PAGES.flatMap((page): SearchResult[] => {
      const haystack = `${page.title} ${page.description}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return [];
      return [
        {
          type: "page",
          id: page.href,
          title: page.title,
          preview: page.description,
          href: page.href,
        },
      ];
    });
    const blogResults = blogs.flatMap((post): SearchResult[] => {
      const haystack =
        `${post.title} ${post.description} ${post.keywords.join(" ")} ${post.body}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return [];
      const match = needle
        ? snippet(`${post.title} — ${post.description} ${post.body}`, needle)
        : post.description;
      return [
        {
          type: "blog",
          id: `/blog/${post.slug}`,
          title: post.title,
          preview: match ?? post.description,
          href: `/blog/${post.slug}`,
        },
      ];
    });
    const chatResults = chats.flatMap((chat): SearchResult[] => {
      if (!needle) {
        return [
          {
            type: "chat",
            id: chat.id,
            title: chat.title || "New chat",
            preview: null,
            updated: chat.updated,
            chat,
          },
        ];
      }
      const message = chat.messages.find((entry) => entry.content.toLowerCase().includes(needle));
      const inTitle = chat.title.toLowerCase().includes(needle);
      if (!inTitle && !message) return [];
      return [
        {
          type: "chat",
          id: chat.id,
          title: chat.title || "New chat",
          preview: message ? snippet(message.content, needle) : null,
          updated: chat.updated,
          chat,
        },
      ];
    });
    return [...chatResults.slice(0, needle ? 12 : 6), ...pageResults, ...blogResults];
  }, [blogs, chats, query]);

  function select(chat: Chat) {
    onSelect(chat.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12%] max-w-[540px] translate-y-0 gap-0 overflow-hidden border-border p-0 shadow-xl sm:rounded-[20px]"
        aria-describedby="search-description"
      >
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                const first = results[0]!;
                if (first.type === "chat") select(first.chat);
                else {
                  window.location.assign(first.href);
                  onOpenChange(false);
                }
              }
            }}
            placeholder="Search chats, apps and guides"
            aria-label="Search query"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <DialogTitle className="sr-only">Search this site</DialogTitle>
        <DialogDescription id="search-description" className="sr-only">
          Search saved chats, app pages and training guides.
        </DialogDescription>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              No site results match “{query.trim()}”.
            </p>
          ) : (
            <ul>
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  {result.type === "chat" ? (
                    <button
                      type="button"
                      onClick={() => select(result.chat)}
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                          {result.title}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">
                          Chat · {relativeTime(result.updated)}
                        </span>
                      </span>
                      {result.preview && (
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                          {result.preview}
                        </span>
                      )}
                    </button>
                  ) : (
                    <a
                      href={result.href}
                      onClick={() => onOpenChange(false)}
                      className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                          {result.title}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">
                          {result.type === "blog" ? "Guide" : "App"}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                        {result.preview}
                      </span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/70 px-3.5 py-2 text-[10.5px] text-muted-foreground/80">
          Search chats, apps and guides · Enter opens the first result · Esc closes
        </div>
      </DialogContent>
    </Dialog>
  );
}
