import { ArrowLeft, Construction } from "lucide-react";

export function UnderDevelopment({ title }: { title: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center text-foreground">
      <div>
        <Construction className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">This page is still under development.</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to chat
        </a>
      </div>
    </div>
  );
}
