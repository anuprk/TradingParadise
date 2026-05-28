import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module')
  );
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);

    // If it's a chunk load error (stale deploy), force a full page reload
    if (isChunkLoadError(error)) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // For chunk errors, show a brief message while reload happens
      if (this.state.error && isChunkLoadError(this.state.error)) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="text-center p-6">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                A new version is available. Reloading...
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="text-center p-6 max-w-md">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
