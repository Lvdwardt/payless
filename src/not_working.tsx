import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./App.css";

type Page = {
  default: JSX.Element;
  path: string;
  Element: JSX.Element;
  loader?: () => Promise<{ default: React.ComponentType<unknown> }>;
  action?: () => Promise<unknown>;
  ErrorBoundary?: React.ComponentType<unknown>;
};

type Route = {
  path: string;
  Element: JSX.Element;
  errorElement?: JSX.Element;
  loader?: () => Promise<{ default: React.ComponentType<unknown> }>;
  action?: () => Promise<unknown>;
  ErrorBoundary?: React.ComponentType<unknown>;
};

const pages: Record<string, Page> = import.meta.glob("./pages/**/*.jsx", {
  eager: true,
});
const routes: Route[] = [];
for (const path of Object.keys(pages)) {
  const fileName = path.match(/\.\/pages\/(.*)\.jsx$/)?.[1];
  if (!fileName) {
    continue;
  }

  const normalizedPathName = fileName.includes("$")
    ? fileName.replace("$", ":")
    : fileName.replace(/\/index/, "");

  routes.push({
    path: fileName === "index" ? "/" : `/${normalizedPathName.toLowerCase()}`,
    Element: pages[path].default,
    loader: pages[path]?.loader,
    action: pages[path]?.action,
    ErrorBoundary: pages[path]?.ErrorBoundary,
  });
}

const router = createBrowserRouter(
  routes.map(({ Element, ErrorBoundary, ...rest }) => ({
    ...rest,
    element: Element,
    ...(ErrorBoundary && { errorElement: <ErrorBoundary /> }),
  }))
);

const App = () => {
  return <RouterProvider router={router} />;
};

export default App;
