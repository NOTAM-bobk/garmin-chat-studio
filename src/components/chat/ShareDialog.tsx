import { useEffect, useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { haptic } from "@/lib/haptics";

const SHARE_TEXT = "Garmin Chat — ask your own Garmin data anything";

export function ShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (open) setUrl(window.location.origin);
  }, [open]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      haptic("done");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link", {
        description: "Select the address and copy it manually.",
      });
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: "Garmin Chat", text: SHARE_TEXT, url });
    } catch {
      // Dismissing the share sheet is not an error.
    }
  }

  const encoded = encodeURIComponent(`${SHARE_TEXT} ${url}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[430px] gap-0 overflow-hidden border-border p-0 shadow-xl sm:rounded-[22px]"
        aria-describedby="share-description"
      >
        <div className="border-b border-border/70 bg-gradient-to-br from-brand-soft to-background px-5 py-4">
          <DialogTitle className="text-[16px] font-semibold tracking-tight">
            Share Garmin Chat
          </DialogTitle>
          <DialogDescription
            id="share-description"
            className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground"
          >
            Send the link to a training partner. Nothing about your account is included.
          </DialogDescription>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-1.5 pl-2.5">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <input
              readOnly
              value={url}
              aria-label="Share link"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <a
              href={`mailto:?subject=${encodeURIComponent("Garmin Chat")}&body=${encoded}`}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Mail className="size-4" />
              Email
            </a>
            <a
              href={`https://wa.me/?text=${encoded}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
            {canNativeShare ? (
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Share2 className="size-4" />
                More
              </button>
            ) : (
              <a
                href={`https://twitter.com/intent/tweet?text=${encoded}`}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <span className="text-[15px] font-semibold leading-none">𝕏</span>
                Post
              </a>
            )}
          </div>

          <p className="mt-3 text-center text-[10.5px] text-muted-foreground/70">
            Opens in any browser. No sign-up needed to try it.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
