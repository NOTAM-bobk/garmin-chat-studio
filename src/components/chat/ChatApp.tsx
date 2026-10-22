import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Copy,
  Check,
  Menu,
  PanelLeft,
  SquarePen,
  Square,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { streamChat, loadPuter, type ChatMsg } from "@/lib/puter";

type Chat = { id: string; title: string; messages: ChatMsg[]; updated: number };

const MODELS = ["gpt-5.4-nano", "gpt-5-mini", "claude-sonnet-4", "gemini-2.5-flash"];
const SYSTEM =
  "You are Garmin Chat, a friendly fitness assistant. Help with workouts, sleep, recovery and training. Be concise and use markdown when it helps. Not medical advice.";
const SUGGESTIONS = [
  "Build me a 4-week 10K plan",
  "How can I improve my sleep score?",
  "What is a good HRV for my age?",
  "Explain training readiness",
];
const KEY = "garmin-chat:chats";

const uid = () => Math.random().toString(36).slice(2, 10);

export function ChatApp() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(MODELS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [desktopSidebar, setDesktopSidebar] = useState(true);
  const [garmin, setGarmin] = useState(false);
  useEffect(() => {
    setGarmin(localStorage.getItem("garmin-chat:connected") === "1");
  }, []);
  const toggleGarmin = () => {
    const next = !garmin;
    setGarmin(next);
    if (next) localStorage.setItem("garmin-chat:connected", "1");
    else localStorage.removeItem("garmin-chat:connected");
  };
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "[]") as Chat[];
      setChats(saved);
    } catch {}
    loadPuter().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(chats.slice(0, 50)));
  }, [chats]);

  const active = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  function newChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setSidebar(false);
    setError(null);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setInput("");
    let id = activeId;
    const userMsg: ChatMsg = { role: "user", content };
    let history: ChatMsg[];
    if (!id) {
      id = uid();
      history = [userMsg];
      const chat: Chat = { id, title: content.slice(0, 40), messages: [...history, { role: "assistant", content: "" }], updated: Date.now() };
      setChats((p) => [chat, ...p]);
      setActiveId(id);
    } else {
      history = [...(active?.messages ?? []), userMsg];
      setChats((p) =>
        p.map((c) => (c.id === id ? { ...c, messages: [...history, { role: "assistant", content: "" }], updated: Date.now() } : c)),
      );
    }
    const chatId = id;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      await streamChat([{ role: "system", content: SYSTEM }, ...history], model, (t) => {
        setChats((p) =>
          p.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (!last) return c;
            msgs[msgs.length - 1] = { role: last.role, content: last.content + t };
            return { ...c, messages: msgs };
          }),
        );
      }, ctrl.signal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { error?: { message?: string } })?.error?.message;
      setError(msg || "Something went wrong. Please try again.");
      setChats((p) =>
        p.map((c) => (c.id === chatId && !c.messages[c.messages.length - 1]?.content ? { ...c, messages: c.messages.slice(0, -1) } : c)),
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function deleteChat(id: string) {
    setChats((p) => p.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className="flex items-end gap-2 rounded-3xl border border-border bg-background p-2 pl-4 shadow-composer"
    >
      <textarea
        ref={taRef}
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send(input);
          }
        }}
        placeholder="Ask anything"
        className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground"
      />
      {busy ? (
        <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Square className="size-3.5 fill-current" />
        </button>
      ) : (
        <button type="submit" disabled={!input.trim()} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-25">
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      )}
    </form>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {sidebar && <div className="fixed inset-0 z-30 bg-foreground/20 md:hidden" onClick={() => setSidebar(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform md:static md:translate-x-0 ${
          sidebar ? "translate-x-0" : "-translate-x-full"
        } ${desktopSidebar ? "md:flex" : "md:hidden"}`}
      >
        <div className="flex items-center justify-between p-3">
          <button onClick={() => { setSidebar(false); setDesktopSidebar(false); }} aria-label="Close sidebar" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent">
            <PanelLeft className="size-5" />
          </button>
          <button onClick={newChat} aria-label="New chat" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent">
            <SquarePen className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {chats.length > 0 && <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">Chats</p>}
          {chats.map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent"}`}>
              <button onClick={() => { setActiveId(c.id); setSidebar(false); }} className="flex-1 truncate px-3 py-2 text-left text-sm">
                {c.title || "New chat"}
              </button>
              <button onClick={() => deleteChat(c.id)} aria-label="Delete chat" className="mr-1 grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">Guest session · no sign-in needed</div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <button onClick={() => setSidebar(true)} aria-label="Open sidebar" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:hidden">
            <Menu className="size-5" />
          </button>
          {!desktopSidebar && (
            <>
              <button onClick={() => setDesktopSidebar(true)} aria-label="Open sidebar" className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:grid">
                <PanelLeft className="size-5" />
              </button>
              <button onClick={newChat} aria-label="New chat" className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent md:grid">
                <SquarePen className="size-5" />
              </button>
            </>
          )}
          <label className="relative flex items-center rounded-lg px-2 py-1.5 hover:bg-accent">
            <span className="text-[17px] font-medium">Garmin Chat</span>
            <span className="ml-1.5 text-[15px] text-muted-foreground">{model}</span>
            <ChevronDown className="ml-1 size-4 text-muted-foreground" />
            <select value={model} onChange={(e) => setModel(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Model">
              {MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className="ml-auto md:hidden">
            <button onClick={newChat} aria-label="New chat" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent">
              <SquarePen className="size-5" />
            </button>
          </div>
        </header>

        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <h1 className="mb-4 text-center text-[28px] font-medium tracking-tight">Ask me about your data</h1>
            <button
              onClick={toggleGarmin}
              className={
                garmin
                  ? "mb-8 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  : "mb-8 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              }
            >
              {garmin ? "Disconnect Garmin" : "Connect Garmin"}
            </button>
            <div className="w-full max-w-3xl">{composer}</div>
            <div className="mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
                {active.messages.map((m, i) => (
                  <Message key={i} msg={m} pending={busy && i === active.messages.length - 1} />
                ))}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div ref={endRef} />
              </div>
            </div>
            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              {composer}
              <p className="mt-2 text-center text-xs text-muted-foreground">AI can make mistakes. Not medical advice.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Message({ msg, pending }: { msg: ChatMsg; pending: boolean }) {
  const [copied, setCopied] = useState(false);
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-secondary px-5 py-2.5 text-[15px]">{msg.content}</div>
      </div>
    );
  }
  if (!msg.content && pending) {
    return <div className="size-3 animate-pulse rounded-full bg-foreground" />;
  }
  return (
    <div className="group">
      <div className="prose-chat">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
      </div>
      {!pending && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(msg.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label="Copy"
          className="mt-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      )}
    </div>
  );
}
