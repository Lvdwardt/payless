import Loader from "./loader";
import Timer from "./timer";

interface LoadingStateProps {
  query: string;
  error?: string;
  showAd: boolean;
}

export default function LoadingState({
  query,
  error,
  showAd,
}: LoadingStateProps) {
  return (
    <div className="w-full lg:px-32">
      <h1 className="text-2xl sm:text-5xl">Welcome to PayLess!</h1>
      <h2 className="text-xl sm:text-3xl pt-4 pb-8">
        The easiest way to skip the paywall.
      </h2>

      <Loader />

      <div className="flex flex-col">
        <span className="text-balance text-sm mt-4">loading: {query}</span>
        <span className="text-sm mt-4">
          view on archive.is{" "}
          <a
            href={`https://archive.is/${query}`}
            className="underline hover:no-underline"
          >
            here
          </a>
        </span>
      </div>

      {error && <h2 className="text-red-400 mt-4">{error}</h2>}

      {showAd && (
        <p className="text-xl sm:text-3xl pt-4 pb-8">
          <Timer />
        </p>
      )}
    </div>
  );
}
