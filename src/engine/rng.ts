/**
 * Recovered Interstel DOS v2.05C PRNG recurrence (Microsoft C-style rand).
 * 32-bit internal state; unsigned arithmetic wraps after every draw.
 * The original seeding timestamp and full call schedule remain under study.
 *
 * Game interface returns a normalized [0,1) sample to existing rules.
 * Saving game.rng.seed preserves the complete generator state.
 */
export type RandomState = { seed:number; draws:number };
export function nextRandom(input:RandomState): { next:RandomState; value:number } {
  const state=(Math.imul(input.seed>>>0,0x343FD)+0x269EC3)>>>0;
  const raw=(state>>>16)&0x7FFF;
  return {next:{seed:state,draws:input.draws+1},value:raw/32768};
}
/** Exact 15-bit DOS generator output, useful for historical trace comparisons. */
export function nextRandom15(input:RandomState): {next:RandomState; value:number} {
  const state=(Math.imul(input.seed>>>0,0x343FD)+0x269EC3)>>>0;
  return {next:{seed:state,draws:input.draws+1},value:(state>>>16)&0x7FFF};
}
