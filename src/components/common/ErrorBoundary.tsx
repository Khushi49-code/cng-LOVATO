import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error in component:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    try {
      if (typeof window !== 'undefined') {
        const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        errors.push({
          timestamp: new Date().toISOString(),
          error: error.toString(),
          errorInfo: errorInfo.componentStack
        });
        localStorage.setItem('app_errors', JSON.stringify(errors.slice(-10)));
      }
    } catch (e) {
      console.error('Error saving error log:', e);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-red-600 mb-2">Application Error</h2>
              <p className="text-gray-600 mb-4">Sorry, something went wrong</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Error Message:</p>
              <code className="text-xs text-red-500 break-words">
                {this.state.error?.toString()}
              </code>
            </div>
            
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium transition duration-150"
              >
                Reload Application
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('unified_data_cache');
                  localStorage.removeItem('app_errors');
                  window.location.reload();
                }}
                className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium transition duration-150"
              >
                Clear Cache and Reload
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                If problem persists, please contact support
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;