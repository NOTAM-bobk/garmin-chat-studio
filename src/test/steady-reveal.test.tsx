import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSteadyReveal } from "@/lib/useSteadyReveal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useSteadyReveal", () => {
  it("stops scheduling frames when the visible text catches up", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockReturnValue(0);

    const { result } = renderHook(() => useSteadyReveal("done", true));
    expect(frames).toHaveLength(1);

    act(() => {
      frames.shift()?.(1000);
    });

    expect(result.current).toBe("done");
    expect(frames).toHaveLength(0);
  });

  it("does not keep an animation frame alive while waiting for stream data", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockReturnValue(0);

    renderHook(() => useSteadyReveal("", true));
    act(() => {
      frames.shift()?.(16);
    });

    expect(frames).toHaveLength(0);
  });
});
