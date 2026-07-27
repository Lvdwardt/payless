import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <>
          <title>PayLess - Error</title>
          <meta name="robots" content="noindex" />

          <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
            <div className="max-w-md text-center space-y-4">
              <h1 className="text-2xl font-bold font-sans">
                Oops! Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We&apos;re sorry for the inconvenience. Please try again or go
                back to the homepage.
              </p>

              <div className="space-y-3">
                <Button className="w-full" onClick={this.handleRetry}>
                  Try Again
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  Go to Homepage
                </Button>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Error Details (Development only)
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}
