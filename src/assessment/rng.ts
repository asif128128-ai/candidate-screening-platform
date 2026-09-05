// Deterministic seeded RNG for the assessment bank (ASSESSMENT_DESIGN.md
// §4.1): "generate draws every parameter from rng (SplitMix64 seeded by
// session.seed ⊕ hash(template_id, position))". Pure, no I/O. The same
// seed always produces the same sequence, which is what makes a session
// reproducible on refresh/reconnect and what makes the bank audit and
// snapshot tests possible.

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;

/** FNV-1a 64-bit hash of a string, used to fold template_id/position into a seed. */
export function fnv1a64(input: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & MASK64;
  }
  return hash;
}

/** session.seed ⊕ hash(template_id, position) — the per-item seed derivation named in ASSESSMENT_DESIGN.md §4.1. */
export function deriveItemSeed(sessionSeed: bigint, templateId: string, position: number): bigint {
  const h = fnv1a64(`${templateId}#${position}`);
  return (sessionSeed ^ h) & MASK64;
}

/** Derive an independent sub-stream seed from a parent seed + a label (e.g. "options" vs "values"). */
export function deriveSubSeed(seed: bigint, label: string): bigint {
  return (seed ^ fnv1a64(label) ^ GOLDEN) & MASK64;
}

export class Rng {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = seed & MASK64;
  }

  /** Raw 64-bit SplitMix64 output. */
  private nextRaw(): bigint {
    this.state = (this.state + GOLDEN) & MASK64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
    z = z ^ (z >> 31n);
    return z & MASK64;
  }

  /** Float in [0, 1). */
  next(): number {
    // Top 53 bits for full double precision.
    const bits = this.nextRaw() >> 11n;
    return Number(bits) / Number(1n << 53n);
  }

  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error("nextInt: maxExclusive must be > 0");
    return Math.floor(this.next() * maxExclusive);
  }

  /** Integer in [min, maxInclusive]. */
  nextIntBetween(min: number, maxInclusive: number): number {
    if (maxInclusive < min) throw new Error("nextIntBetween: max < min");
    return min + this.nextInt(maxInclusive - min + 1);
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick: empty array");
    const v = arr[this.nextInt(arr.length)];
    if (v === undefined) throw new Error("pick: index out of range");
    return v;
  }

  /** Fisher-Yates shuffle, returns a new array (does not mutate input). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  /** n distinct elements drawn from arr, order randomized. */
  sample<T>(arr: readonly T[], n: number): T[] {
    if (n > arr.length) throw new Error("sample: n larger than population");
    return this.shuffle(arr).slice(0, n);
  }

  /** Boolean with the given probability of true (default 0.5). */
  chance(p = 0.5): boolean {
    return this.next() < p;
  }

  /** A deterministic child Rng, independent-looking but reproducible from this stream + a label. */
  fork(label: string): Rng {
    return new Rng(deriveSubSeed(this.nextRaw(), label));
  }
}

export function createRng(seed: bigint): Rng {
  return new Rng(seed);
}
