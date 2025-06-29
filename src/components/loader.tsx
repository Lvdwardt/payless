import { COLORS } from "../lib/constants";

export default function Loader() {
  return (
    <div className="flex gap-2">
      <span className="sr-only">Loading...</span>
      <div
        className="h-8 w-8 rounded-full animate-bounce [animation-delay:-0.3s]"
        style={{ backgroundColor: COLORS.ACCENT }}
      ></div>
      <div
        className="h-8 w-8 rounded-full animate-bounce [animation-delay:-0.15s]"
        style={{ backgroundColor: COLORS.ACCENT }}
      ></div>
      <div
        className="h-8 w-8 rounded-full animate-bounce"
        style={{ backgroundColor: COLORS.ACCENT }}
      ></div>
    </div>
  );
}
