import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PromptBar from "@/components/chat/PromptBar";
import type { ToneId } from "@/lib/models";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function Harness({
  onSubmit,
  onPickImage,
  onRemoveImage,
  image,
}: {
  onSubmit: (text: string) => void;
  onPickImage?: ((file: File) => void) | undefined;
  onRemoveImage?: (() => void) | undefined;
  image?: string | null | undefined;
}) {
  const [value, setValue] = useState("");
  const [tone, setTone] = useState<ToneId>("coach");
  return (
    <>
      <PromptBar
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        onStop={() => undefined}
        busy={false}
        tone={tone}
        onToneChange={setTone}
        image={image}
        onPickImage={onPickImage}
        onRemoveImage={onRemoveImage}
      />
      <p data-testid="tone">{tone}</p>
    </>
  );
}

describe("PromptBar", () => {
  it("submits typed text with Enter", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText("Ask about your training");
    fireEvent.change(textarea, { target: { value: "How is my load?" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledWith("How is my load?");
  });

  it("handles an image from the plus menu", () => {
    const onPickImage = vi.fn();
    const onRemoveImage = vi.fn();
    const { rerender } = render(
      <Harness onSubmit={vi.fn()} onPickImage={onPickImage} onRemoveImage={onRemoveImage} />,
    );

    fireEvent.click(screen.getByLabelText("Add"));
    expect(screen.getByRole("option", { name: "Upload image" })).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["pixels"], "watch.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPickImage).toHaveBeenCalledWith(file);

    rerender(
      <Harness
        onSubmit={vi.fn()}
        onPickImage={onPickImage}
        onRemoveImage={onRemoveImage}
        image={PIXEL}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove image"));
    expect(onRemoveImage).toHaveBeenCalled();
  });

  it("sends with only an image attached", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} image={PIXEL} />);

    fireEvent.click(screen.getByLabelText("Send message"));

    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("keeps the tone pill and drops the old view controls", () => {
    render(<Harness onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Coach/ }));
    fireEvent.click(screen.getByRole("option", { name: "Analyst" }));
    expect(screen.getByTestId("tone").textContent).toBe("analyst");

    expect(screen.queryByLabelText("Quick prompts")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("View")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Accent colour")).not.toBeInTheDocument();
  });
});
