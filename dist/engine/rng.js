export function nextRandom(input) {
    let x = input.seed >>> 0;
    if (x === 0)
        x = 0x6D2B79F5;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return { next: { seed: x, draws: input.draws + 1 }, value: x / 4294967296 };
}
