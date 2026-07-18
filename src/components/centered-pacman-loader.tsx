import { PacmanLoader } from "react-spinners";

const DEFAULT_SIZE = 25;

/** Centers the Pacman character; dots trail to the right of screen center. */
export function CenteredPacmanLoader({
  color = "var(--primary)",
  size = DEFAULT_SIZE,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <div className="size-0">
      <PacmanLoader
        color={color}
        size={size}
        cssOverride={{
          display: "block",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}
