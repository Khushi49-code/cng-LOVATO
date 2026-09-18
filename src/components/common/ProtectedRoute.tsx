import { useEffect, ReactNode, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import Card from './Card';

interface ProtectedRouteProps {
  children: ReactNode;
  pageName?: string;
  requiredPermissions?: string[];
}

export default function ProtectedRoute({
  children,
  pageName,
  requiredPermissions
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login');
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userPermissions = userData.pageAccess || [];
          const userRole = userData.role || 'user';
          const status = userData.status || 'active';

          // Kick out inactive users even mid-session
          if (status === 'inactive') {
            await signOut(auth);
            router.replace('/login?message=Your account has been deactivated. Please contact your administrator.');
            setLoading(false);
            return;
          }

          if (userRole === 'admin') {
            setIsAuthorized(true);
            setLoading(false);
            return;
          }

          if (!pageName && (!requiredPermissions || requiredPermissions.length === 0)) {
            setIsAuthorized(true);
            setLoading(false);
            return;
          }

          if (pageName) {
            const hasAccess = userPermissions.includes(pageName);
            if (!hasAccess) {
              setIsAuthorized(false);
              setLoading(false);
              return;
            }
          }

          if (requiredPermissions && requiredPermissions.length > 0) {
            const hasAllPermissions = requiredPermissions.every(perm =>
              userPermissions.includes(perm)
            );
            if (!hasAllPermissions) {
              setIsAuthorized(false);
              setLoading(false);
              return;
            }
          }

          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, pageName, requiredPermissions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}