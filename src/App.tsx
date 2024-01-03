import Timer from "./components/timer";
import useLinkToArchive from "./hooks/useLinkToArchive";
import usePwa from "./hooks/usePwa";

export default function App() {
  const { isInstalled, hasQuery } = useLinkToArchive();
  const showAd = import.meta.env.VITE_SHOW_AD === "true";

  return (
    <div className="min-h-screen w-screen font-bold p-8 bg-[#1f295b] font-sans">
      <nav className="flex justify-between items-center pb-8">
        <img src="payless_small.png" alt="logo" className="w-20" />
      </nav>
      <div className="w-full lg:px-32">
        <h1 className="text-2xl sm:text-5xl">Welcome to PayLess!</h1>
        <h2 className="text-xl sm:text-3xl pt-4 pb-8">
          The easiest way to skip the paywall.
        </h2>

        {hasQuery && <div>Advertisement</div>}

        {hasQuery && showAd && (
          <p className="text-xl sm:text-3xl pt-4 pb-8">
            <Timer />
          </p>
        )}
        <div className="lg:hidden">
          {!isInstalled && !hasQuery && <DownloadPWA />}
          {isInstalled && !hasQuery && (
            <>
              <h3 className="text-lg sm:text-2xl pb-4">
                PayLess is installed! Here is how to use it:
              </h3>
              <ol className="text-base sm:text-xl pl-4">
                <li>1. go to the article you want to read.</li>
                <li>2. if you encounter a paywall, press the share button.</li>
                <li>3. find and tap the "PayLess" icon.</li>
                <li>4. read the article!</li>
              </ol>
              <p className="pt-2">
                If you don't see the PayLess button in the share menu, try
                installing PayLess inside the Google Chrome app. If you're
                already on Chrome, try refreshing the page. You might find the
                "install app" button by pressing the three dots in the top right
                corner of your screen.
              </p>
            </>
          )}
        </div>
        {!hasQuery && (
          <div className="hidden md:block pt-8">
            <h3 className="text-lg sm:text-2xl pb-4">how to install:</h3>
            <ol className="text-base sm:text-xl pl-4 pb-8">
              <li>
                <strong className="text-red-500">
                  1. Visit this page on your phone.
                </strong>{" "}
                Use Google Chrome for the best user experience.
              </li>
              <li className="flex flex-col">
                <p>clik on the install button.</p>
              </li>
              <li>3. Tap "Add to Home Screen".</li>
            </ol>
            <h3 className="text-lg sm:text-2xl pb-4">how to use:</h3>
            <ol className="text-base sm:text-xl pl-4">
              <li>1. go to the website you want to read.</li>
              <li>2. if you encounter a paywall, press the share button.</li>
              <li>3. find and tap the "PayLess" icon.</li>
              <li>4. read the article!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
export const DownloadPWA = () => {
  const { pwaCheckLoading, supportsPWA, onClick } = usePwa();

  if (!supportsPWA && !pwaCheckLoading) {
    return (
      <div>
        <p className="text-red-300">
          PayLess isn't supported by your browser. Please use Google chrome for
          the best experience
        </p>
        <button
          className="text-white my-4"
          onClick={() => {
            window.open("https://www.google.com/chrome/", "_blank");
          }}
        >
          Download Chrome here
        </button>
      </div>
    );
  } else {
    return (
      <div>
        <h3 className="text-lg sm:text-2xl pb-4">how to install:</h3>
        <ol className="text-base sm:text-xl pl-4 pb-8">
          <li>1. Visit this page on your phone.</li>
          <li className="flex flex-col">
            <p>
              clik on the button below. If you don't see the button, try
              installing PayLess while using the Google Chrome app.
            </p>
            <button
              className="my-2"
              id="setup_button"
              aria-label="Install app"
              title="Install app"
              onClick={onClick}
            >
              Install
            </button>
          </li>
          <li>3. Tap "Add to Home Screen".</li>
        </ol>
      </div>
    );
  }
};
