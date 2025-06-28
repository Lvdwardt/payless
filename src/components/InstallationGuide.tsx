import usePwa from "@/hooks/usePwa";
import { COLORS } from "@/lib/constants";

interface InstallationGuideProps {
  isInstalled: boolean;
}

export default function InstallationGuide({
  isInstalled,
}: InstallationGuideProps) {
  const { onClick } = usePwa();

  if (isInstalled) {
    return (
      <div className="lg:hidden">
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
          If you don't see the PayLess button in the share menu, try installing
          PayLess inside the Google Chrome app. If you're already on Chrome, try
          refreshing the page. You might find the "install app" button by
          pressing the three dots in the top right corner of your screen.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg sm:text-2xl pb-4">how to install:</h3>
      <ol className="text-base sm:text-xl pl-4 pb-8">
        <li>1. On your phone, open this page in the Google Chrome browser</li>
        <li className="flex flex-col">
          <p>2. click on the button below.</p>
          <button
            className="my-2 text-white px-4 py-2 rounded-lg w-fit"
            style={{ backgroundColor: COLORS.ACCENT }}
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
