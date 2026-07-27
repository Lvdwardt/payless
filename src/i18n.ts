import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

const resources = {
  en: {
    translation: {
      // Install Dialog
      "install.title": "Install Payless",
      "install.description":
        "Install this app on your device for a better experience. You'll get faster access and can use it offline.",
      "install.button": "Install App",
      "install.installing": "Installing...",
      "install.later": "Maybe later",
      "install.ios.instructions":
        'To install this app on your iOS device:\n\n1. Tap the Share button at the bottom of the screen\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to confirm',
      "install.macos.instructions":
        'To install this app on your Mac:\n\n1. Click the Share button in the Safari toolbar\n2. Click "Add to Dock" or "Add to Home Screen"\n3. Follow the prompts to complete installation',
      "install.android.instructions":
        'To install this app on your Android device:\n\n1. Tap the menu button (three dots) in your browser\n2. Look for "Install app" or "Add to Home screen"\n3. Tap it and follow the prompts',
      "install.generic.instructions":
        "To install this app:\n\nLook for the install button in your browser's address bar or menu, or check your browser's settings for \"Install app\" option.",
      "install.failed":
        "Installation failed. Please try again or check your browser settings.",

      // Introduction Card
      "intro.title": "Payless - Skip Paywalls",
      "intro.description":
        "A PWA that helps you bypass paywalls by sharing articles through this app",
      "intro.howItWorks": "How it works:",
      "intro.step1.title": "Install this PWA",
      "intro.step1.description":
        "Add this app to your home screen for easy access",
      "intro.step2.title": "Find a paywalled article",
      "intro.step2.description":
        "Browse any website with a paywall you want to read",
      "intro.step3.title": "Share the article with Payless",
      "intro.step3.description":
        "Use your device's share function to send the article to this app",

      // Captcha gate
      "captcha.title": "Quick check required",
      "captcha.description":
        "The archive is asking for a CAPTCHA before we can show the cleaned article. Solve it in the Live View window to continue here, or read the archive page instead.",
      "captcha.open": "Solve CAPTCHA",
      "captcha.retry": "I've finished — try again",
      "captcha.readOnArchive": "Read on archive.ph instead",
      "captcha.hint":
        "Solve CAPTCHA opens a secure Live View to unlock the cleaned article here. “Read on archive.ph instead” opens the archive itself.",

      // Reader experience toggle
      "reader.legacy": "Classic",
      "reader.native": "Native",
      "reader.experienceToggleLabel": "Reader mode",
      "reader.nativeFallbackNote":
        "This site isn't available in Native mode yet, so we're showing the Classic reader instead.",
      "reader.bylinePrefix": "By",
      "reader.fontSizeLabel": "Font size",
      "reader.fontSizeDecrease": "Decrease font size",
      "reader.fontSizeIncrease": "Increase font size",
    },
  },
  nl: {
    translation: {
      // Install Dialog
      "install.title": "Payless installeren",
      "install.description":
        "Installeer deze app op je apparaat voor een betere ervaring. Je krijgt snellere toegang en kunt het offline gebruiken.",
      "install.button": "App installeren",
      "install.installing": "Installeren...",
      "install.later": "Misschien later",
      "install.ios.instructions":
        'Om deze app op je iOS-apparaat te installeren:\n\n1. Tik op de Deel-knop onderaan het scherm\n2. Scroll naar beneden en tik op "Toevoegen aan beginscherm"\n3. Tik op "Toevoegen" om te bevestigen',
      "install.macos.instructions":
        'Om deze app op je Mac te installeren:\n\n1. Klik op de Deel-knop in de Safari-werkbalk\n2. Klik op "Toevoegen aan Dock" of "Toevoegen aan beginscherm"\n3. Volg de instructies om de installatie te voltooien',
      "install.android.instructions":
        'Om deze app op je Android-apparaat te installeren:\n\n1. Tik op de menuknop (drie puntjes) in je browser\n2. Zoek naar "App installeren" of "Toevoegen aan beginscherm"\n3. Tik erop en volg de instructies',
      "install.generic.instructions":
        'Om deze app te installeren:\n\nZoek naar de installatieknop in de adresbalk of het menu van je browser, of controleer de browserinstellingen voor de optie "App installeren".',
      "install.failed":
        "Installatie mislukt. Probeer opnieuw of controleer je browserinstellingen.",

      // Introduction Card
      "intro.title": "Payless - Skip Paywalls",
      "intro.description":
        "Een PWA die je helpt paywalls te omzeilen door artikelen via deze app te delen",
      "intro.howItWorks": "Hoe het werkt:",
      "intro.step1.title": "Installeer deze PWA",
      "intro.step1.description":
        "Voeg deze app toe aan je beginscherm voor eenvoudige toegang",
      "intro.step2.title": "Vind een artikel met paywall",
      "intro.step2.description":
        "Blader door elke website met een paywall die je wilt lezen",
      "intro.step3.title": "Deel het artikel met Payless",
      "intro.step3.description":
        "Gebruik de deel-functie van je apparaat om het artikel naar deze app te sturen",

      // Captcha gate
      "captcha.title": "Even een check",
      "captcha.description":
        "Het archief vraagt om een CAPTCHA voordat we het schone artikel kunnen tonen. Los die op in het Live View-venster om hier verder te gaan, of lees de archiefpagina zelf.",
      "captcha.open": "CAPTCHA oplossen",
      "captcha.retry": "Klaar — probeer opnieuw",
      "captcha.readOnArchive": "Lees in plaats daarvan op archive.ph",
      "captcha.hint":
        "CAPTCHA oplossen opent een beveiligde Live View om hier het schone artikel te ontgrendelen. “Lees in plaats daarvan op archive.ph” opent het archief zelf.",

      // Reader experience toggle
      "reader.legacy": "Klassiek",
      "reader.native": "Native",
      "reader.experienceToggleLabel": "Leesmodus",
      "reader.nativeFallbackNote":
        "Deze site is nog niet beschikbaar in Native-modus, dus we tonen de klassieke lezer.",
      "reader.bylinePrefix": "Door",
      "reader.fontSizeLabel": "Tekstgrootte",
      "reader.fontSizeDecrease": "Tekst verkleinen",
      "reader.fontSizeIncrease": "Tekst vergroten",
    },
  },
};

i18n
  .use(initReactI18next)
  .use(Backend)
  .use(LanguageDetector)
  .init({
    resources,
    interpolation: {
      escapeValue: false,
    },
  });

// Export function to change language
export const changeLanguage = (language: string) => {
  i18n.changeLanguage(language);
};

export default i18n;
