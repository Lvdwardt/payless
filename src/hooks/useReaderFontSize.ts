import useLocalStorageState from "use-local-storage-state";
import {
  clampReaderFontSize,
  DEFAULT_READER_FONT_SIZE,
  type ReaderFontSize,
} from "@/lib/reader-font";

const STORAGE_KEY = "readerFontSize";

/** Persisted body font size (px) for the native reader. */
export function useReaderFontSize() {
  return useLocalStorageState<ReaderFontSize>(STORAGE_KEY, {
    defaultValue: DEFAULT_READER_FONT_SIZE,
    serializer: {
      stringify: (value) => String(value),
      parse: (value) => clampReaderFontSize(Number(value)),
    },
  });
}
