import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchDialog } from "@/components/chat/SearchDialog";
import type { Chat } from "@/lib/chat";
import type { BlogPost } from "@/lib/blog";

const now = Date.now();
const chats: Chat[] = [
  {
    id: "sleep",
    title: "Sleep this week",
    updated: now,
    messages: [
      { id: "m1", role: "user", content: "How did I sleep after the hard session?", steps: [] },
    ],
  },
  {
    id: "marathon",
    title: "Marathon build",
    updated: now - 60_000,
    messages: [
      { id: "m2", role: "assistant", content: "Your long run was steady at 5:10/km.", steps: [] },
    ],
  },
];

const blogs: BlogPost[] = [
  {
    slug: "body-battery",
    title: "Garmin Body Battery explained",
    description: "Understand energy reserve estimates.",
    date: "2026-11-08",
    author: "Garmin Chat",
    keywords: ["recovery", "body battery"],
    faq: [],
    readingMinutes: 3,
    body: "Garmin calculates an estimate using sleep and stress.",
  },
];

describe("SearchDialog", () => {
  it("lists recent chats before typing", () => {
    render(<SearchDialog open onOpenChange={vi.fn()} chats={chats} onSelect={vi.fn()} />);

    expect(screen.getByText("Sleep this week")).toBeInTheDocument();
    expect(screen.getByText("Marathon build")).toBeInTheDocument();
  });

  it("finds a chat by what was said in it", () => {
    render(<SearchDialog open onOpenChange={vi.fn()} chats={chats} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Search query"), { target: { value: "steady" } });

    expect(screen.getByText("Marathon build")).toBeInTheDocument();
    expect(screen.queryByText("Sleep this week")).not.toBeInTheDocument();
    expect(screen.getByText(/long run was steady/)).toBeInTheDocument();
  });

  it("matches titles and reports a miss", () => {
    render(<SearchDialog open onOpenChange={vi.fn()} chats={chats} onSelect={vi.fn()} />);
    const input = screen.getByLabelText("Search query");

    fireEvent.change(input, { target: { value: "sleep" } });
    expect(screen.getByText("Sleep this week")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "cycling" } });
    expect(screen.getByText(/No site results match/)).toBeInTheDocument();
  });

  it("searches guide body and labels site results", () => {
    render(
      <SearchDialog open onOpenChange={vi.fn()} chats={[]} blogs={blogs} onSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Search query"), { target: { value: "stress" } });

    expect(screen.getByText("Garmin Body Battery explained")).toBeInTheDocument();
    expect(screen.getByText("Guide")).toBeInTheDocument();
    expect(screen.getByText(/calculates an estimate using sleep and stress/)).toBeInTheDocument();
  });

  it("opens the chosen chat and closes", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<SearchDialog open onOpenChange={onOpenChange} chats={chats} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Marathon build"));

    expect(onSelect).toHaveBeenCalledWith("marathon");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
