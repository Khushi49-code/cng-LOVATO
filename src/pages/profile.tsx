import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import MainLayout from '../components/layouts/MainLayout';

const ProfilePage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Name
  const [newName, setNewName] = useState(user?.displayName ?? '');

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggle = (section: string) => {
    setActiveSection((prev) => (prev === section ? null : section));
    setMessage(null);
    if (section === 'password') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // ── Update Name ──────────────────────────────────────────────
  const handleUpdateName = async () => {
    if (!user || !newName.trim()) {
      showMessage('error', 'Please enter a valid name.');
      return;
    }
    
    setLoading(true);
    try {
      await updateProfile(user, { displayName: newName.trim() });
      await user.getIdToken(true);
      showMessage('success', 'Name updated successfully!');
      setActiveSection(null);
    } catch (error: any) {
      console.error('Name update error:', error);
      showMessage('error', error.message || 'Failed to update name.');
    } finally {
      setLoading(false);
    }
  };

  // ── Update Password with Auto Logout ──────────────────────────
  const handleUpdatePassword = async () => {
    if (!user) {
      showMessage('error', 'User not found. Please log in again.');
      return;
    }
    
    if (!currentPassword) {
      showMessage('error', 'Please enter your current password.');
      return;
    }
    
    if (!newPassword) {
      showMessage('error', 'Please enter a new password.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showMessage('error', 'New passwords do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters long.');
      return;
    }
    
    if (newPassword === currentPassword) {
      showMessage('error', 'New password must be different from current password.');
      return;
    }
    
    setLoading(true);
    
    try {
      const currentUser = user;
      const credential = EmailAuthProvider.credential(
        currentUser.email!,
        currentPassword
      );
      
      // Reauthenticate user first
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      // Show success message
      showMessage('success', 'Password changed successfully! You will be logged out now. Please login with your new password.');
      
      // Wait for 2 seconds so user can see the success message
      setTimeout(async () => {
        // Sign out the user
        await signOut(auth);
        // Redirect to login page with a message
        router.push('/login?message=Password updated successfully. Please login with your new password.');
      }, 2000);
      
      setActiveSection(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error: any) {
      console.error('Password update error:', error);
      
      switch (error.code) {
        case 'auth/wrong-password':
          showMessage('error', 'Current password is incorrect.');
          break;
        case 'auth/requires-recent-login':
          showMessage('error', 'For security, please log out and log in again before changing your password.');
          break;
        case 'auth/weak-password':
          showMessage('error', 'Password is too weak. Please use at least 6 characters.');
          break;
        default:
          showMessage('error', error.message || 'Failed to change password.');
      }
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 py-10 px-4">
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-sm p-8">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">Please log in to view your profile.</p>
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const avatar = user.displayName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-lg mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>

          {/* Avatar & Name Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3">
              {avatar}
            </div>
            <h1 className="text-xl font-semibold text-gray-800">{user.displayName ?? 'User'}</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            {!user.emailVerified && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-2">
                Email not verified
              </span>
            )}
          </div>

          {/* Toast Message */}
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-start gap-2 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <span className="mt-0.5">{message.type === 'success' ? '✓' : '✕'}</span>
              <span className="flex-1 whitespace-pre-line">{message.text}</span>
            </div>
          )}

          <div className="space-y-3">
            {/* ── Name Card (Update Option) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200">
              <button
                onClick={() => toggle('name')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Display Name</p>
                    <p className="text-sm text-gray-800 font-semibold">{user.displayName || 'Not set'}</p>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${activeSection === 'name' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeSection === 'name' && (
                <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3 animate-fadeIn">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new name"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggle('name')} 
                      className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleUpdateName} 
                      disabled={loading}
                      className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Email Card (VIEW ONLY - No Update Option) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email Address</p>
                    <p className="text-sm text-gray-800 font-semibold">{user.email}</p>
                  </div>
                </div>
                {/* Lock icon to show it's not editable */}
                <div className="w-5 h-5 text-gray-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              <div className="px-5 pb-4">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span>🔒</span> Email cannot be changed. Contact administrator for email updates.
                </p>
              </div>
            </div>

            {/* ── Password Card (Update Option with Auto Logout) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200">
              <button
                onClick={() => toggle('password')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Password</p>
                    <p className="text-sm text-gray-800 font-semibold">••••••••</p>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${activeSection === 'password' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeSection === 'password' && (
                <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3 animate-fadeIn">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min. 6 characters)"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-xs text-orange-800">
                      🔐 Password requirements:<br />
                      • Minimum 6 characters<br />
                      • Cannot be the same as current password<br />
                      • After changing password, you will be logged out automatically
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggle('password')} 
                      className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleUpdatePassword} 
                      disabled={loading}
                      className="flex-1 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Secure profile management powered by Firebase
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </MainLayout>
  );
};

export default ProfilePage;