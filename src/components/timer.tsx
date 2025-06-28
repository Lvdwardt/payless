import { useEffect, useState } from "react";
import { APP_CONFIG } from "@/lib/constants";

export default function Timer() {
  const timeBeforeRedirect =
    Number(import.meta.env.VITE_TIME_BEFORE_REDIRECT) ||
    APP_CONFIG.DEFAULT_TIME_BEFORE_REDIRECT;

  const [millis, setMillis] = useState(timeBeforeRedirect);

  // return a circular progress bar that counts down from 5 to 0, with the remaining time displayed in the middle of the circle

  useEffect(() => {
    if (millis === 0 || millis < 0) {
      return;
    }

    const interval = setInterval(() => {
      setMillis((millis) => millis - 10);
    }, 10);
    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percentage = 100 - (millis / timeBeforeRedirect) * 100;

  return (
    <div className="relative w-40 h-40 text-white">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle
          className="text-gray-200 stroke-current"
          stroke-width="10"
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
        ></circle>
        <circle
          className="text-indigo-500  progress-ring__circle stroke-current"
          stroke-width="10"
          stroke-linecap="round"
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          stroke-dashoffset={`calc(400 - (300 * ${percentage}) / 100)`}
        ></circle>

        <text
          x="50"
          y="50"
          fill="white"
          text-anchor="middle"
          alignment-baseline="middle"
        >
          {Math.round(millis / 1000)}
        </text>
      </svg>
    </div>
  );
}
