import type { ReactNode } from "react";
import { BookOpen, HeartPulse } from "lucide-react";

import { APP_VERSION, BUILDER } from "@/lib/app-meta";

export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight"
          >
            <HeartPulse className="size-4 text-brand" strokeWidth={2.2} />
            Garmin Chat
          </a>
          <a
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <BookOpen className="size-3.5" />
            Blog
          </a>
          <a
            href="/"
            className="ml-auto rounded-lg bg-foreground px-3 py-1.5 text-[12.5px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Open chat
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-2 px-4 py-6 text-[11.5px] text-muted-foreground">
          <span>Built by {BUILDER}</span>
          <span aria-hidden="true">·</span>
          <a href="/blog" className="transition-colors hover:text-foreground">
            All posts
          </a>
          <span className="ml-auto font-mono">v{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
