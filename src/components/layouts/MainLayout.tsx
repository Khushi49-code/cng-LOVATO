// src/components/layouts/MainLayout.tsx
import React, { useState, useEffect, ReactNode, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import Button from '../common/Button';
import ProtectedRoute from '../common/ProtectedRoute';

interface MainLayoutProps {
  children: ReactNode;
}

// All possible nav pages (Plans is NOT here — it lives only in the profile dropdown)
const ALL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'sales',     label: 'Sales',     href: '/sales' },
  { id: 'customers', label: 'Customers', href: '/customers' },
  { id: 'products',  label: 'Products',  href: '/products' },
  { id: 'services',  label: 'Services',  href: '/services' },
  { id: 'reports',   label: 'Reports',   href: '/reports' },
];

// ============================================================
// SUPPORT FORM INTERFACE
// ============================================================
interface SupportFormData {
  name: string;
  phone: string;
  email: string;
  location: string;
  time: string;
  date: string;
  message: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<{ [key: string]: boolean } | null>(null);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  
  // ============================================================
  // SUPPORT BUTTON STATE
  // ============================================================
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportForm, setSupportForm] = useState<SupportFormData>({
    name: '',
    phone: '',
    email: '',
    location: '',
    time: '',
    date: '',
    message: '',
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();

  // ── Online/offline ──────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ── Close profile dropdown on outside click ─────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load permissions & user name from Firestore ─────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const loadUserData = async () => {
      setLoadingPerms(true);
      try {
        const isAdmin = user.email === 'admin@gmail.com';

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Set user display name
          if (data.name) {
            setUserDisplayName(data.name);
          } else if (user.displayName) {
            setUserDisplayName(user.displayName);
          } else {
            setUserDisplayName(user.email?.split('@')[0] || 'User');
          }
          
          // Set user email
          setUserEmail(user.email || data.email || '');
          
          // Set user phone if available
          if (data.phone) {
            setUserPhone(data.phone);
          }
        } else {
          // Fallback to auth data
          setUserDisplayName(user.displayName || user.email?.split('@')[0] || 'User');
          setUserEmail(user.email || '');
        }

        if (isAdmin) {
          const allTrue: { [k: string]: boolean } = {};
          ALL_NAV_ITEMS.forEach(p => { allTrue[p.id] = true; });
          allTrue['addUser'] = true;
          setUserPermissions(allTrue);
          return;
        }

        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.permissions && Object.keys(data.permissions).length > 0) {
            setUserPermissions(data.permissions);
          } else {
            const role = data.role || 'user';
            const roleDoc = await getDoc(doc(db, 'permissions', role));
            if (roleDoc.exists()) {
              setUserPermissions(roleDoc.data().pages || {});
            } else {
              setUserPermissions({ dashboard: true });
            }
          }
        }
      } catch (err) {
        console.error('Permission load error:', err);
        setUserPermissions({ dashboard: true });
      } finally {
        setLoadingPerms(false);
      }
    };

    loadUserData();
  }, [user?.uid]);

  // ── Auto-fill support form when user data loads ─────────────────
  useEffect(() => {
    if (userDisplayName && userEmail) {
      setSupportForm(prev => ({
        ...prev,
        name: userDisplayName,
        email: userEmail,
        phone: userPhone || prev.phone, // Keep existing phone if userPhone is empty
      }));
    }
  }, [userDisplayName, userEmail, userPhone]);

  // ── Permission check helper ──────────────────────────────────────
  const canAccess = (pageId: string): boolean => {
    if (!userPermissions) return false;
    return userPermissions[pageId] === true;
  };

  const isAdmin = user?.email === 'admin@gmail.com';

  // ── Allowed nav items ─────────────────────────────────────────────
  const allowedNavItems = ALL_NAV_ITEMS.filter(item => canAccess(item.id));

  // ── Route protection: redirect if no access ──────────────────────
  useEffect(() => {
    if (loadingPerms || !userPermissions) return;

    if (router.pathname === '/plans') return;

    const currentPageId = ALL_NAV_ITEMS.find(
      item => router.pathname === item.href || router.pathname.startsWith(item.href + '/')
    )?.id;

    if (currentPageId && !canAccess(currentPageId)) {
      router.replace('/dashboard');
    }

    if (router.pathname === '/add-user' && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [router.pathname, userPermissions, loadingPerms]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // ============================================================
  // SUPPORT FORM HANDLERS - WITH FIREBASE SAVE
  // ============================================================
  const handleSupportChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSupportForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Prepare data with timestamp and user info
      const supportData = {
        ...supportForm,
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || supportForm.email || 'anonymous',
        userName: userDisplayName || supportForm.name || 'anonymous',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      console.log('📞 Saving support data:', supportData);

      // ✅ Save to Firebase Firestore
      const docRef = await addDoc(collection(db, 'support'), supportData);
      console.log('✅ Support request saved with ID:', docRef.id);

      alert('✅ Your support request has been submitted successfully! We will get back to you soon.');

      // Reset form but keep name, email, phone
      setSupportForm({
        name: userDisplayName || '',
        phone: userPhone || '',
        email: userEmail || '',
        location: '',
        time: '',
        date: '',
        message: '',
      });
      setIsSupportOpen(false);

    } catch (error) {
      console.error('❌ Error saving support request:', error);
      alert('❌ Failed to submit support request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── NavItem component ─────────────────────────────────────────────
  const NavItem = ({ href, children }: { href: string; children: ReactNode }) => {
    const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);
    return (
      <Link href={href} passHref legacyBehavior>
        <Button
          onClick={() => setIsMobileMenuOpen(false)}
          color={isActive ? 'blue' : 'gray'}
          className="w-full justify-center"
        >
          {children}
        </Button>
      </Link>
    );
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 font-sans antialiased flex flex-col">

        <header className="bg-white shadow-md sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">

            <Link href="/dashboard" className="flex items-center space-x-2 md:space-x-3">
              <img 
                src="/logo1.png"
                alt="Clarivo Logo" 
                className="h-10 w-auto md:h-14 lg:h-16" 
              />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-2">
              <nav className="flex space-x-2">
                {loadingPerms ? (
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-20 h-9 bg-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  allowedNavItems.map(item => (
                    <NavItem key={item.id} href={item.href}>{item.label}</NavItem>
                  ))
                )}
              </nav>

              {/* Profile Dropdown */}
              <div className="relative ml-2" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                    <Link href="/profile" onClick={() => setIsProfileOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </Link>

                    <Link href="/plans" onClick={() => setIsProfileOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Plans
                    </Link>

                    {isAdmin && (
                      <Link href="/add-user" onClick={() => setIsProfileOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Add User
                      </Link>
                    )}

                    <hr className="my-1 border-gray-100" />
                    <button onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Hamburger */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-white border-t shadow-lg">
              <div className="px-4 py-3 space-y-2">
                {loadingPerms ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  allowedNavItems.map(item => (
                    <NavItem key={item.id} href={item.href}>{item.label}</NavItem>
                  ))
                )}

                <hr className="border-gray-200 my-2" />

                <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </Link>

                <Link href="/plans" onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center px-3 py-2 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors font-medium">
                  <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Plans
                </Link>

                {isAdmin && (
                  <Link href="/add-user" onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium">
                    <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Add User
                  </Link>
                )}

                <button onClick={handleLogout}
                  className="flex items-center justify-center w-full px-3 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="max-w-7xl mx-auto py-4 md:py-8 px-2 sm:px-4 md:px-6 lg:px-8 w-full flex-grow">
          {children}
        </main>

        {/* Footer */}
        <footer className="w-full bg-gray-800 text-white text-center p-3 md:p-4 text-xs mt-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <p>Clarivo - Powered by Dcodes Technologies</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mt-2 md:mt-0">
              <Link href="/privacy-policy" className="hover:text-blue-400 transition-colors duration-200">
                Privacy Policy
              </Link>
              <span className="text-gray-500">|</span>
              <Link href="/terms" className="hover:text-blue-400 transition-colors duration-200">
                Terms & Conditions
              </Link>
            </div>

            <div className="mt-2 md:mt-0 flex items-center space-x-2">
              <span>Status:</span>
              <div className={`flex items-center ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs">{isOnline ? 'Connected' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </footer>

        {/* ============================================================ */}
        {/* ✅ GLOBAL SUPPORT BUTTON - Icon Only (Blue Circle) */}
        {/* ============================================================ */}
        <button
          onClick={() => setIsSupportOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            backgroundColor: '#007bff',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '28px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0, 123, 255, 0.5)',
            zIndex: 999999,
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0056b3';
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 25px rgba(0, 123, 255, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#007bff';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 123, 255, 0.5)';
          }}
        >
          💬
        </button>

        {/* ============================================================ */}
        {/* ✅ SUPPORT POPUP WITH FULL FORM - SAVES TO FIREBASE */}
        {/* ============================================================ */}
        {isSupportOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999999,
              backdropFilter: 'blur(5px)',
            }}
            onClick={() => setIsSupportOpen(false)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '35px',
                borderRadius: '16px',
                width: '500px',
                maxWidth: '92%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                animation: 'slideUp 0.3s ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  borderBottom: '2px solid #e2e8f0',
                  paddingBottom: '15px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: '#1e293b',
                    fontSize: '22px',
                    fontWeight: '700',
                  }}
                >
                  📞 Support Center
                </h3>
                <button
                  onClick={() => setIsSupportOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  ✕
                </button>
              </div>

              <p
                style={{
                  color: '#64748b',
                  marginBottom: '20px',
                  fontSize: '14px',
                }}
              >
                Please fill in the details below and we'll get back to you shortly.
              </p>

              {/* ===== FORM ===== */}
              <form onSubmit={handleSupportSubmit}>
                {/* 1. Name - Auto-filled */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '5px',
                    }}
                  >
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={supportForm.name}
                    onChange={handleSupportChange}
                    placeholder="Enter your full name"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: supportForm.name ? '#f0f4ff' : 'white',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                  {supportForm.name && (
                    <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                      ✓ Auto-filled from your profile
                    </div>
                  )}
                </div>

                {/* 2. Phone */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '5px',
                    }}
                  >
                    Phone Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={supportForm.phone}
                    onChange={handleSupportChange}
                    placeholder="Enter your phone number"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: supportForm.phone ? '#f0f4ff' : 'white',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                  {supportForm.phone && (
                    <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                      ✓ Auto-filled from your profile
                    </div>
                  )}
                </div>

                {/* 3. Email - Auto-filled */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '5px',
                    }}
                  >
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={supportForm.email}
                    onChange={handleSupportChange}
                    placeholder="Enter your email address"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: supportForm.email ? '#f0f4ff' : 'white',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                  {supportForm.email && (
                    <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                      ✓ Auto-filled from your profile
                    </div>
                  )}
                </div>

                {/* 4. Location */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '5px',
                    }}
                  >
                    Location <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={supportForm.location}
                    onChange={handleSupportChange}
                    placeholder="Enter your location"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                </div>

                {/* 5. Date & Time (2 columns) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '5px',
                      }}
                    >
                      Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={supportForm.date}
                      onChange={handleSupportChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '5px',
                      }}
                    >
                      Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="time"
                      name="time"
                      value={supportForm.time}
                      onChange={handleSupportChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                    />
                  </div>
                </div>

                {/* 6. Message */}
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '5px',
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    value={supportForm.message}
                    onChange={handleSupportChange}
                    placeholder="Describe your issue or message..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'Arial, sans-serif',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
                  />
                </div>

                {/* Info note about auto-fill */}
                <div
                  style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#0369a1',
                  }}
                >
                  ℹ️ Name and email are automatically filled from your profile. You can edit them if needed.
                </div>

                {/* Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '20px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsSupportOpen(false)}
                    style={{
                      backgroundColor: '#e2e8f0',
                      color: '#1e293b',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      backgroundColor: isSubmitting ? '#94a3b8' : '#007bff',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 28px',
                      borderRadius: '8px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.backgroundColor = '#0056b3';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting) {
                        e.currentTarget.style.backgroundColor = '#007bff';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '⏳ Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ANIMATION STYLES */}
        {/* ============================================================ */}
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(30px) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }
          div[style*="max-height: 90vh"]::-webkit-scrollbar {
            width: 6px;
          }
          div[style*="max-height: 90vh"]::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          div[style*="max-height: 90vh"]::-webkit-scrollbar-thumb {
            background: #007bff;
            border-radius: 10px;
          }
          div[style*="max-height: 90vh"]::-webkit-scrollbar-thumb:hover {
            background: #0056b3;
          }
        `}</style>

      </div>
    </ProtectedRoute>
  );
};

export default MainLayout;