import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function RenameDialog({
  open,
  initialTitle,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string) => void;
}) {
  const [draft, setDraft] = useState(initialTitle);

  useEffect(() => {
    if (open) setDraft(initialTitle);
  }, [open, initialTitle]);

  const trimmed = draft.trim();

  function submit() {
    if (!trimmed) return;
    onSave(trimmed.slice(0, 80));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] gap-0 border-border p-0 shadow-xl">
        <div className="border-b border-border/70 px-4 py-3">
          <DialogTitle className="text-[14.5px] font-semibold tracking-tight">
            Rename chat
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[11.5px] text-muted-foreground">
            Only the sidebar label changes.
          </DialogDescription>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="px-4 py-4"
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            maxLength={80}
            placeholder="Chat name"
            aria-label="Chat name"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-foreground/25"
          />
          <div className="mt-3 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
