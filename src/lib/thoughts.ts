/**
 * Wording for the thinking rows in the answer trace.
 *
 * One fixed label ("Reading your question") made a long turn read like a script,
 * so each turn draws a shuffled set: the first row comes from the question
 * phrasings, later rows from the follow-up phrasings, and a shuffle means two
 * nearby rounds never say the same thing.
 */

export const FIRST_THOUGHTS = [
  "Reading your question",
  "Working out what you need",
  "Sizing up the question",
  "Finding the right angle",
  "Checking what's being asked",
  "Mapping the question",
  "Picking a place to start",
  "Getting your question straight",
] as const;

export const NEXT_THOUGHTS = [
  "Reviewing your data",
  "Connecting the numbers",
  "Digging one level deeper",
  "Cross-checking the readings",
  "Weighing what I have",
  "Looking at the next layer",
  "Following the thread",
  "Checking the other signals",
  "Comparing against your baseline",
] as const;

/** Fisher–Yates on a copy; the input array is never mutated. */
export function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/**
 * One label per round. Rounds beyond the vocabulary wrap around, which only
 * happens if someone raises the tool-round budget above the word lists.
 */
export function thoughtPlan(rounds: number, random: () => number = Math.random): string[] {
  const first = shuffled(FIRST_THOUGHTS, random);
  const next = shuffled(NEXT_THOUGHTS, random);
  return Array.from({ length: Math.max(1, rounds) }, (_, round) =>
    round === 0 ? first[0]! : next[(round - 1) % next.length]!,
  );
}
