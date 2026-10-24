export function nextRandom15(input) {
    const state = (Math.imul(input.seed >>> 0, 0x343FD) + 0x269EC3) >>> 0;
    return { next: { seed: state, draws: input.draws + 1 }, value: (state >>> 16) & 0x7FFF };
}
export function nextRandom(input) {
    const result = nextRandom15(input);
    return { next: result.next, value: result.value / 32768 };
}