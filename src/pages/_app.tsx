import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import UnifiedDataProvider from '../contexts/UnifiedDataContext';
import { AuthProvider } from '../contexts/AuthContext';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && router.pathname !== '/login') {
        router.replace('/login');
      } else if (user && router.pathname === '/login') {
        router.replace('/dashboard');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <UnifiedDataProvider>
          <Component {...pageProps} />
        </UnifiedDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp;