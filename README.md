# PayLess

PayLess is a Progressive Web App (PWA) that allows users to access archived versions of web articles through [archive.is](https://archive.is/). It helps bypass paywalls and provides a better archive.is experience optimized for mobile devices. It's primary purpose is for bypassing paywalls on news sources in comination with the Google Discover Feed on Android.

## Features

- **Fetch Archived Articles**: Retrieve archived versions of web pages to bypass paywalls.
- **Share Target Integration**: Easily share articles to the pwa via the share target.
- **Mobile Friendly Design**: Optimized for mobile devices and the Google Discover Feed on Android.

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/LeonvdW/payless.git
```

2. Install dependencies:

```bash
bun install
```

3. Start the development server:

```bash
bun dev
```

4. Open the application in your browser:

```bash
open http://localhost:5173/
```

## Project Structure

- `src/` - Main source code directory.
  - `hooks/` - Custom React hooks.
  - `useLinkToArchive.tsx` - Hook for fetching and managing archived links.
  - `utils/` - Utility functions for interacting with the archive service.
  - `index.css` - Global styles using Tailwind CSS.
- `public/` - Static assets and icons.
- `vite.config.ts` - Vite configuration file.
- `tsconfig.json` - TypeScript configuration.

## Technologies Used

- **React** with **TypeScript**
- **Vite**
- **Tailwind CSS**
- **use-local-storage-state**

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

[![wakatime](https://wakatime.com/badge/user/2a79d314-d9db-4a38-95db-aa9731fb8118/project/018cc8c8-9434-453d-82af-73663eafc258.svg)](https://wakatime.com/badge/user/2a79d314-d9db-4a38-95db-aa9731fb8118/project/018cc8c8-9434-453d-82af-73663eafc258)
