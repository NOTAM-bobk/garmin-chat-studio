import { useEffect, useRef, useState } from "react";

/**
 * Reveal streaming text at a steady rate.
 *
 * Providers deliver tokens in uneven bursts; rendering them as they arrive makes
 * the answer jump and stutter. This keeps a constant baseline speed and only
 * accelerates when the buffer gets far ahead, finishing smoothly if the stream
 * ends while text is still queued.
 */
export function useSteadyReveal(target: string, streaming: boolean): string {
  const [visible, setVisible] = useState(streaming ? 0 : target.length);
  const visibleRef = useRef(visible);
  const targetRef = useRef(target);
  const streamingRef = useRef(streaming);
  targetRef.current = target;
  streamingRef.current = streaming;

  useEffect(() => {
    if (!streamingRef.current && visibleRef.current >= target.length) return;

    let frame = 0;
    let last = performance.now();
    let painted = last;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 128);
      last = now;
      const total = targetRef.current.length;
      const backlog = total - visibleRef.current;

      if (backlog > 0) {
        const rate = streamingRef.current ? Math.min(2400, 320 + backlog * 3) : 4200; // finishing flush when the stream has already closed
        const step = Math.max(1, Math.round((rate * dt) / 1000));
        const next = Math.min(total, visibleRef.current + step);
        if (next !== visibleRef.current) {
          visibleRef.current = next;
          // Repaint at ~30fps; markdown re-parsing every frame is wasteful.
          if (next >= total || now - painted >= 32) {
            painted = now;
            setVisible(next);
          }
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [streaming, target.length]);

  if (!streaming && visible >= target.length) return target;
  return target.slice(0, Math.min(visible, target.length));
}
