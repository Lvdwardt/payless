/** Body text sizes for the native reader (px). */
export const READER_FONT_SIZES = [12, 14, 16, 18, 20, 22] as const;

export type ReaderFontSize = (typeof READER_FONT_SIZES)[number];

export const DEFAULT_READER_FONT_SIZE: ReaderFontSize = 16;

export function clampReaderFontSize(value: number): ReaderFontSize {
  if ((READER_FONT_SIZES as readonly number[]).includes(value)) {
    return value as ReaderFontSize;
  }

  let nearest: ReaderFontSize = DEFAULT_READER_FONT_SIZE;
  let bestDistance = Infinity;
  for (const size of READER_FONT_SIZES) {
    const distance = Math.abs(size - value);
    if (distance < bestDistance) {
      nearest = size;
      bestDistance = distance;
    }
  }
  return nearest;
}

export function stepReaderFontSize(
  current: ReaderFontSize,
  direction: -1 | 1
): ReaderFontSize {
  const index = READER_FONT_SIZES.indexOf(current);
  const next = Math.min(
    READER_FONT_SIZES.length - 1,
    Math.max(0, index + direction)
  );
  return READER_FONT_SIZES[next];
}
