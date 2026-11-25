/**
 * Deep copy for plain JSON-shaped engine data (objects, arrays, primitives).
 * Copies every own enumerable key at every depth, in the same order, like
 * `structuredClone` does for this data, but without its generic serializer cost.
 * Not for Maps, Sets, Dates, class instances or cyclic data.
 */
export function clonePlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = clonePlain(value[i]);
    return out as T;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = clonePlain((value as Record<string, unknown>)[key]);
  return out as T;
}
