import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { relativeTime, type Chat } from "@/lib/chat";

function snippet(text: string, query: string): string | null {
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return null;
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function SearchDialog({
  open,
  onOpenChange,
  chats,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chats: Chat[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return chats.slice(0, 8).map((chat) => ({ chat, snippet: null as string | null }));
    }
    return chats
      .flatMap((chat) => {
        const inTitle = chat.title.toLowerCase().includes(needle);
        const message = chat.messages.find((entry) => entry.content.toLowerCase().includes(needle));
        if (!inTitle && !message) return [];
        return [{ chat, snippet: message ? snippet(message.content, needle) : null }];
      })
      .slice(0, 12);
  }, [chats, query]);

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
                select(results[0].chat);
              }
            }}
            placeholder="Search chats"
            aria-label="Search query"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <DialogTitle className="sr-only">Search chats</DialogTitle>
        <DialogDescription id="search-description" className="sr-only">
          Find a saved chat by its title or by what was said in it.
        </DialogDescription>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              {query.trim() ? `No chats match “${query.trim()}”.` : "No saved chats yet."}
            </p>
          ) : (
            <ul>
              {results.map(({ chat, snippet: preview }) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => select(chat)}
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {chat.title || "New chat"}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-muted-foreground">
                        {relativeTime(chat.updated)}
                      </span>
                    </span>
                    {preview && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                        {preview}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/70 px-3.5 py-2 text-[10.5px] text-muted-foreground/80">
          Enter opens the first result · Esc closes
        </div>
      </DialogContent>
    </Dialog>
  );
}
