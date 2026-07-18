import useLocalStorageState from "use-local-storage-state";
import type { ReaderExperience } from "@/types/reader-experience";

const STORAGE_KEY = "readerExperience";

/** Thin wrapper around `useLocalStorageState` for the legacy/native reader toggle. */
export function useReaderExperience() {
  return useLocalStorageState<ReaderExperience>(STORAGE_KEY, {
    defaultValue: "legacy",
  });
}
