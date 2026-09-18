import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PermissionContextType {
  hasAccess: (pageName: string) => boolean;
  userPermissions: { [key: string]: boolean };
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) throw new Error('usePermissions must be used within PermissionProvider');
  return context;
};

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setUserPermissions({});
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      setLoading(true);
      try {
        // Admin ne badhu access
        if (user.email === 'admin@gmail.com') {
          setUserPermissions({
            dashboard: true, sales: true, customers: true,
            products: true, services: true, reports: true, addUser: true,
          });
          return;
        }

        // Firestore thi user document lo
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();

          if (data.permissions && Object.keys(data.permissions).length > 0) {
            // Individual user permissions
            setUserPermissions(data.permissions);
          } else {
            // Role-based permissions fallback
            const role = data.role || 'user';
            const roleDoc = await getDoc(doc(db, 'permissions', role));
            if (roleDoc.exists()) {
              setUserPermissions(roleDoc.data().pages || {});
            } else {
              setUserPermissions({ dashboard: true });
            }
          }
        } else {
          setUserPermissions({ dashboard: true });
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        setUserPermissions({ dashboard: true });
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user?.uid]);

  const hasAccess = (pageName: string): boolean => {
    if (user?.email === 'admin@gmail.com') return true;
    return userPermissions[pageName] === true;
  };

  return (
    <PermissionContext.Provider value={{ hasAccess, userPermissions, loading }}>
      {children}
    </PermissionContext.Provider>
  );
};