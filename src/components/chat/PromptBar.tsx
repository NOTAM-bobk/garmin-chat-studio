import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUp,
  ChevronDown,
  Dumbbell,
  ImagePlus,
  Lightbulb,
  Mic,
  Plug,
  Plus,
  Scale,
  Settings2,
  Square,
  SquarePen,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { TONES, type ToneId } from "@/lib/models";
import { cn } from "@/lib/utils";

type PanelId = "add" | "tone" | null;

export interface PromptBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop: () => void;
  busy: boolean;
  connected?: boolean;
  tools?: number;
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  image?: string | null | undefined;
  onPickImage?: ((file: File) => void) | undefined;
  onRemoveImage?: (() => void) | undefined;
  placeholder?: string;
  /** Open menus upward — the composer sits at the bottom of a conversation. */
  dropUp?: boolean;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  onConnect?: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}

const toneIcons: Record<ToneId, LucideIcon> = {
  coach: Dumbbell,
  analyst: Scale,
  explain: Lightbulb,
  straight: Zap,
};

/** Rotating hints under the caret: short, concrete, different shapes of ask. */
const HINTS = [
  "Ask anything",
  "Ask about your training",
  "Why is my readiness low this week?",
  "Chart my sleep against my load",
  "Drop a screenshot from your watch",
  "Plan my next training block",
];

type SpeechResultList = {
  length: number;
  [index: number]: { isFinal: boolean; 0?: { transcript?: string } };
};

type SpeechEvent = { resultIndex: number; results: SpeechResultList };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function speechConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as SpeechWindow;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export default function PromptBar({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  connected = false,
  tools = 0,
  tone,
  onToneChange,
  image = null,
  onPickImage,
  onRemoveImage,
  placeholder = "Ask about your training",
  dropUp = false,
  onNewChat,
  onOpenSettings,
  onConnect,
  textareaRef,
  className,
}: PromptBarProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [hintLeaving, setHintLeaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const [sending, setSending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = textareaRef ?? localTextareaRef;

  valueRef.current = value;

  const hints = useMemo(
    () => [
      placeholder,
      ...HINTS.filter((hint) => hint.toLowerCase() !== placeholder.toLowerCase()),
    ],
    [placeholder],
  );

  // Swap hints on a timer: the current one blurs out, the next blurs in.
  useEffect(() => {
    if (value || image || hints.length < 2) return;
    const leave = window.setTimeout(() => setHintLeaving(true), 4200);
    const swap = window.setTimeout(() => {
      setHintIndex((index) => (index + 1) % hints.length);
      setHintLeaving(false);
    }, 4620);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(swap);
    };
  }, [value, image, hintIndex, hints.length]);

  useEffect(() => {
    setCanDictate(!!speechConstructor());
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPanel(null);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const togglePanel = (id: PanelId) => setOpenPanel((current) => (current === id ? null : id));

  const handleSubmit = () => {
    if (busy) {
      onStop();
      return;
    }
    if (!value.trim() && !image) return;
    onSubmit(value.trim());
    setSending(true);
    setTimeout(() => setSending(false), 350);
  };

  const appendTranscript = useCallback(
    (transcript: string) => {
      const base = valueRef.current.trimEnd();
      onChange(base ? `${base} ${transcript}` : transcript);
    },
    [onChange],
  );

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const Recognition = speechConstructor();
    if (!Recognition) return;
    try {
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-US";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          if (result?.isFinal) transcript += result[0]?.transcript ?? "";
        }
        if (transcript.trim()) appendTranscript(transcript.trim());
      };
      recognition.onend = () => setRecording(false);
      recognition.onerror = () => setRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [appendTranscript]);

  const ModeIcon = toneIcons[tone];
  const canSend = busy || value.trim().length > 0 || !!image;

  return (
    <div
      ref={rootRef}
      className={cn("prompt-bar-glow relative w-full rounded-[24px] bg-muted p-[2px]", className)}
    >
      <div className="rounded-[22px] bg-muted p-4 pb-3 sm:p-5 sm:pb-4">
        <div className="relative mb-6">
          <textarea
            ref={fieldRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            rows={1}
            aria-label={placeholder}
            className="max-h-[220px] w-full resize-none bg-transparent text-base leading-relaxed text-foreground focus:outline-none"
          />
          {!value && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 select-none overflow-hidden whitespace-nowrap text-base leading-relaxed text-muted-foreground"
            >
              <span
                key={hintIndex}
                className={cn("inline-block", hintLeaving ? "hint-out" : "hint-in")}
              >
                {hints[hintIndex]}
              </span>
            </span>
          )}
        </div>

        {image && (
          <div className="mb-4 flex items-center gap-3">
            <div className="relative">
              <img
                src={image}
                alt="Attached"
                className="h-16 w-16 rounded-xl object-cover ring-1 ring-border"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onRemoveImage?.()}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={11} />
              </button>
            </div>
            <span className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">
              Image attached — ask what you want read from it.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="relative">
              <BarButton
                label="Add"
                expanded={openPanel === "add"}
                onClick={() => togglePanel("add")}
              >
                <Plus size={20} />
              </BarButton>
              {openPanel === "add" && (
                <Menu side={dropUp ? "up" : "down"}>
                  <MenuItem
                    icon={ImagePlus}
                    label="Upload image"
                    onClick={() => {
                      setOpenPanel(null);
                      fileRef.current?.click();
                    }}
                  />
                  <MenuItem
                    icon={SquarePen}
                    label="New chat"
                    onClick={() => {
                      setOpenPanel(null);
                      onNewChat?.();
                    }}
                  />
                  {!connected && (
                    <MenuItem
                      icon={Plug}
                      label="Connect Garmin"
                      onClick={() => {
                        setOpenPanel(null);
                        onConnect?.();
                      }}
                    />
                  )}
                  <MenuItem
                    icon={Settings2}
                    label="Settings"
                    onClick={() => {
                      setOpenPanel(null);
                      onOpenSettings?.();
                    }}
                  />
                </Menu>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPickImage?.(file);
              }}
            />

            {connected && (
              <span className="ml-1 hidden items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Garmin live
                <span className="text-muted-foreground/70">· {tools} tools</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={openPanel === "tone"}
                onClick={() => togglePanel("tone")}
                className="mx-1 flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ModeIcon size={14} />
                {TONES.find((option) => option.id === tone)?.label ?? "Coach"}
                <ChevronDown size={15} />
              </button>
              {openPanel === "tone" && (
                <Menu align="right" side={dropUp ? "up" : "down"} role="listbox" minWidth={170}>
                  {TONES.map((option) => {
                    const Icon = toneIcons[option.id];
                    return (
                      <MenuItem
                        key={option.id}
                        icon={Icon}
                        label={option.label}
                        selected={option.id === tone}
                        onClick={() => {
                          onToneChange(option.id);
                          setOpenPanel(null);
                        }}
                      />
                    );
                  })}
                </Menu>
              )}
            </div>

            <BarButton
              label={recording ? "Stop dictation" : "Dictate"}
              pressed={recording}
              disabled={!canDictate}
              onClick={() => (recording ? stopRecording() : startRecording())}
              className={cn(
                recording &&
                  "bg-destructive/10 text-destructive [animation:pb-mic-pulse_1.2s_ease-out_infinite]",
              )}
            >
              <Mic size={18} />
            </BarButton>

            <button
              type="button"
              aria-label={busy ? "Stop generating" : "Send message"}
              onClick={handleSubmit}
              disabled={!canSend}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                canSend
                  ? "bg-foreground text-background"
                  : "bg-foreground/15 text-foreground opacity-60",
                sending ? "scale-90" : "scale-100",
              )}
            >
              {busy ? <Square size={12} className="fill-current" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarButton({
  label,
  expanded,
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  expanded?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Menu({
  align = "left",
  side = "down",
  minWidth = 190,
  role,
  children,
}: {
  align?: "left" | "right";
  side?: "up" | "down";
  minWidth?: number;
  role?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      data-side={side}
      style={{ minWidth }}
      className={cn(
        "absolute z-20 rounded-2xl bg-popover p-1.5 shadow-lg ring-1 ring-border",
        side === "up" ? "bottom-11" : "top-11",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  selected,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
