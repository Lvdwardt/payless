import useLocalStorageState from "use-local-storage-state";
import { Provider } from "@/types";

// @TODO: implement
const providers: Provider[] = [
  {
    archiveUrl: "https://archive.is/",
    uploadNewUrl: "https://archive.is/?run=1&",
  },
  {
    archiveUrl: "removepaywall.com",
  },
  {
    archiveUrl: "https://12ft.io/",
  },
];

export default function useSettings() {
  const [settings, setSettings] = useLocalStorageState("settings", {
    defaultValue: {
      provider: providers[0],
    },
  });

  return { settings, setSettings, providers };
}
