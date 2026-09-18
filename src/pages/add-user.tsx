import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import MainLayout from '../components/layouts/MainLayout';
import * as XLSX from 'xlsx';

// ✅ Already initialized Firebase app thi apiKey lo - no .env needed
const createUserViaRestAPI = async (email: string, password: string): Promise<string> => {
  const apiKey = auth.app.options.apiKey;
  if (!apiKey) throw new Error('Firebase API key maldi nahi. lib/firebase.ts check karo.');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.message || '';
    if (code.includes('EMAIL_EXISTS')) throw { code: 'auth/email-already-in-use' };
    if (code.includes('INVALID_EMAIL')) throw { code: 'auth/invalid-email' };
    if (code.includes('WEAK_PASSWORD')) throw { code: 'auth/weak-password' };
    throw new Error(data?.error?.message || 'User create karvama error');
  }
  return data.localId;
};

// ============================
// Types
// ============================
interface Permission {
  [key: string]: boolean;
}

interface UserData {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  permissions?: Permission;
}

// ============================
// Pages List
// ============================
const pagesList = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊', description: 'Main overview & stats' },
  { id: 'sales', name: 'Sales', icon: '💰', description: 'Sales orders & invoices' },
  { id: 'customers', name: 'Customers', icon: '👥', description: 'Customer management' },
  { id: 'products', name: 'Products', icon: '📦', description: 'Product catalog' },
  { id: 'services', name: 'Services', icon: '⚙️', description: 'Service management' },
  { id: 'reports', name: 'Reports', icon: '📈', description: 'Analytics & reports' },
  { id: 'addUser', name: 'Add User', icon: '👤', description: 'User management' },
 
];

// Default permissions per role
const getDefaultPermissions = (role: string): Permission => {
  const perms: Permission = {};
  pagesList.forEach(page => {
    if (role === 'admin') {
      perms[page.id] = true;
    } else if (role === 'manager') {
      perms[page.id] = ['dashboard', 'sales', 'customers', 'reports', 'products'].includes(page.id);
    } else if (role === 'user') {
      perms[page.id] = ['dashboard', 'sales'].includes(page.id);
    } else {
      // viewer
      perms[page.id] = page.id === 'dashboard';
    }
  });
  return perms;
};

// ============================
// Main Component
// ============================
const AddUserPage = () => {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Excel Import State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Access Modal
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedRoleForAccess, setSelectedRoleForAccess] = useState('user');
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<UserData | null>(null);
  const [permissions, setPermissions] = useState<Permission>(getDefaultPermissions('user'));
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const isAdmin = currentUser?.email === 'admin@gmail.com';

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [currentUser]);

  // Load permissions when modal opens
  useEffect(() => {
    if (!showAccessModal) return;
    if (selectedUserForAccess) {
      loadPermissionsForUser(selectedUserForAccess);
    } else {
      loadPermissionsForRole(selectedRoleForAccess);
    }
  }, [showAccessModal, selectedUserForAccess, selectedRoleForAccess]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserData));
      setUsers(list);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadPermissionsForRole = async (role: string) => {
    setLoadingPermissions(true);
    try {
      const permDoc = await getDoc(doc(db, 'permissions', role));
      if (permDoc.exists()) {
        setPermissions(permDoc.data().pages || getDefaultPermissions(role));
      } else {
        setPermissions(getDefaultPermissions(role));
      }
    } catch (err) {
      console.error('Error loading role permissions:', err);
      setPermissions(getDefaultPermissions(role));
    } finally {
      setLoadingPermissions(false);
    }
  };

  const loadPermissionsForUser = async (user: UserData) => {
    setLoadingPermissions(true);
    try {
      if (user.permissions && Object.keys(user.permissions).length > 0) {
        setPermissions(user.permissions);
      } else {
        await loadPermissionsForRole(user.role);
      }
    } catch (err) {
      console.error('Error loading user permissions:', err);
      setPermissions(getDefaultPermissions(user.role));
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handlePermissionChange = (pageId: string) => {
    setPermissions(prev => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  const handleSelectAll = (value: boolean) => {
    const all: Permission = {};
    pagesList.forEach(p => { all[p.id] = value; });
    setPermissions(all);
  };

  const savePermissions = async () => {
    setSavingPermissions(true);
    try {
      if (selectedUserForAccess) {
        // Individual user permissions
        await updateDoc(doc(db, 'users', selectedUserForAccess.id), {
          permissions,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.uid,
        });
        showMessage('success', `✅ ${selectedUserForAccess.displayName} na permissions save thaya!`);
      } else {
        // Role-based permissions
        await setDoc(doc(db, 'permissions', selectedRoleForAccess), {
          role: selectedRoleForAccess,
          pages: permissions,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.uid,
        });
        showMessage('success', `✅ ${selectedRoleForAccess.toUpperCase()} role na permissions save thaya!`);
      }
      setShowAccessModal(false);
      setSelectedUserForAccess(null);
      loadUsers();
    } catch (err) {
      console.error('Error saving permissions:', err);
      showMessage('error', '❌ Permissions save karvama error aavyo.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ✅ FIX 2: Secondary auth use karo - admin logout nahi thay
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.displayName) {
      showMessage('error', '⚠️ Badha fields bharva jaruri che.');
      return;
    }
    if (formData.password.length < 6) {
      showMessage('error', '⚠️ Password ochama 6 characters no hovo joiye.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showMessage('error', '⚠️ Valid email address nakho.');
      return;
    }

    setLoading(true);

    try {
      // ✅ REST API thi user banavo - admin logout nahi thay, no recaptcha!
      const newUid = await createUserViaRestAPI(formData.email, formData.password);

      // Role permissions fetch karo
      const permDoc = await getDoc(doc(db, 'permissions', formData.role));
      const rolePermissions = permDoc.exists()
        ? permDoc.data().pages
        : getDefaultPermissions(formData.role);

      // Firestore ma user save karo
      const userData = {
        uid: newUid,
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'system',
        isActive: true,
        permissions: rolePermissions,
      };

      await setDoc(doc(db, 'users', newUid), userData);

      showMessage('success', `✅ User "${formData.displayName}" successfully create thayo!`);
      setFormData({ email: '', password: '', displayName: '', role: 'user' });
      loadUsers();

    } catch (error: any) {
      console.error('Error creating user:', error);
      const msgs: { [key: string]: string } = {
        'auth/email-already-in-use': '⚠️ Aa email pahela thi registered che.',
        'auth/invalid-email': '⚠️ Email format invalid che.',
        'auth/weak-password': '⚠️ Password nbaadu che. Ochama 6 characters vaporao.',
      };
      showMessage('error', msgs[error.code] || error.message || 'User create karvama fail thayun.');
    } finally {
      setLoading(false);
    }
  };

  // ============================
  // Excel Import Handler
  // ============================
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    setImporting(true);
    setImportProgress({ current: 0, total: 0 });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        showMessage('error', '⚠️ Excel file ma koi data nathi.');
        setImporting(false);
        return;
      }

      setImportProgress({ current: 0, total: rows.length });

      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setImportProgress({ current: i + 1, total: rows.length });

        const email = String(row.email || row.Email || '').trim();
        const password = String(row.password || row.Password || '').trim();
        const displayName = String(row.displayName || row.name || row.Name || row.display_name || '').trim();
        const role = String(row.role || row.Role || 'user').trim().toLowerCase();

        if (!email || !password || !displayName) {
          failCount++;
          errors.push(`Row ${i + 2}: Missing email/password/displayName`);
          continue;
        }

        if (password.length < 6) {
          failCount++;
          errors.push(`Row ${i + 2}: Password too short (min 6)`);
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          failCount++;
          errors.push(`Row ${i + 2}: Invalid email (${email})`);
          continue;
        }

        const validRoles = ['user', 'manager', 'admin', 'viewer'];
        const finalRole = validRoles.includes(role) ? role : 'user';

        try {
          const newUid = await createUserViaRestAPI(email, password);

          const permDoc = await getDoc(doc(db, 'permissions', finalRole));
          const rolePermissions = permDoc.exists()
            ? permDoc.data().pages
            : getDefaultPermissions(finalRole);

          const userData = {
            uid: newUid,
            email,
            displayName,
            role: finalRole,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || 'system',
            isActive: true,
            permissions: rolePermissions,
          };

          await setDoc(doc(db, 'users', newUid), userData);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errMsg = err?.code === 'auth/email-already-in-use'
            ? 'Email already exists'
            : err?.message || 'Unknown error';
          errors.push(`Row ${i + 2} (${email}): ${errMsg}`);
        }
      }

      loadUsers();

      if (failCount === 0) {
        showMessage('success', `✅ Badha ${successCount} users successfully import thaya!`);
      } else {
        showMessage(
          'error',
          `⚠️ ${successCount} success, ${failCount} fail. ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ' ...' : ''}`
        );
      }
    } catch (err) {
      console.error('Excel import error:', err);
      showMessage('error', '❌ Excel file read karvama error aavyo.');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  // ============================
  // Download Sample Excel Template
  // ============================
  const downloadSampleExcel = () => {
    const sampleData = [
      {
        displayName: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'user',
      },
      {
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'manager',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, 'sample_users.xlsx');
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`"${userEmail}" ne delete karva sure cho? Aa action undo nahi thay.`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      showMessage('success', `✅ User "${userEmail}" delete thayo!`);
      loadUsers();
    } catch {
      showMessage('error', '❌ User delete karvama error.');
    }
  };

  const handleManageAccess = (user: UserData) => {
    setSelectedUserForAccess(user);
    setSelectedRoleForAccess(user.role);
    setShowAccessModal(true);
  };

  const openRoleAccessModal = () => {
    setSelectedUserForAccess(null);
    setSelectedRoleForAccess('user');
    setShowAccessModal(true);
  };

  // ============================
  // Access Denied Screen
  // ============================
  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-500 mb-6">Tamne users add karvani permission nathi.</p>
            <button onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Dashboard par jao
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ============================
  // Counts
  // ============================
  const activeCount = permissions ? Object.values(permissions).filter(Boolean).length : 0;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
              ← Back
            </button>
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                <p className="text-sm text-gray-500 mt-1">Add New User and manage existing  </p>
              </div>
              <button
                onClick={openRoleAccessModal}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
              >
                🔐 Role Access Modifier
              </button>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium border ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Add User Form */}
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
            <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-gray-800">➕ Add New User</h2>

              {/* Excel Import Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={downloadSampleExcel}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                >
                  📥 Sample Excel
                </button>

                <label className={`flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium cursor-pointer ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {importing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {importProgress.total > 0
                        ? `Importing ${importProgress.current}/${importProgress.total}...`
                        : 'Importing...'}
                    </>
                  ) : (
                    <>📤 Import Excel</>
                  )}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelImport}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Excel Format Hint */}
            <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <strong>Excel Format:</strong> Columns — <code className="bg-blue-100 px-1 rounded">displayName</code>, <code className="bg-blue-100 px-1 rounded">email</code>, <code className="bg-blue-100 px-1 rounded">password</code>, <code className="bg-blue-100 px-1 rounded">role</code> (user/manager/admin/viewer)
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} required
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Full name nakho" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Ochama 6 characters" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Role <span className="text-red-500">*</span></label>
                  <select name="role" value={formData.role} onChange={handleChange} required
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button"
                  onClick={() => setFormData({ email: '', password: '', displayName: '', role: 'user' })}
                  className="px-5 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                  Clear
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : '✅ Create User'}
                </button>
              </div>
            </form>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Registered Users</h2>
                <p className="text-sm text-gray-500">{users.length} users registered</p>
              </div>
              <button onClick={loadUsers} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                🔄 Refresh
              </button>
            </div>

            {loadingUsers ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="mt-3 text-gray-500 text-sm">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">👥</div>
                <p className="text-gray-500">No User foud. Create new User!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pages Access</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(user => {
                      const userPageCount = user.permissions
                        ? Object.values(user.permissions).filter(Boolean).length
                        : null;
                      return (
                        <tr key={user.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 font-bold text-sm">
                                  {user.displayName?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{user.displayName}</div>
                                <div className="text-xs text-gray-400">{user.uid?.slice(0, 8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                              user.role === 'viewer' ? 'bg-gray-100 text-gray-600' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {(user.role || 'user').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {userPageCount !== null ? (
                              <span className="text-sm font-medium text-indigo-600">
                                {userPageCount} / {pagesList.length} pages
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Role default</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-xs">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => handleManageAccess(user)}
                                className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition font-medium">
                                🔐 Access
                              </button>
                              <button onClick={() => handleDeleteUser(user.id, user.email)}
                                className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium">
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================
          🔐 Access Modifier Modal
      ============================ */}
      {showAccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-start bg-purple-50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  🔐 Access Modifier
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedUserForAccess
                    ? `User: ${selectedUserForAccess.displayName} (${selectedUserForAccess.role})`
                    : `Role: ${selectedRoleForAccess.charAt(0).toUpperCase() + selectedRoleForAccess.slice(1)}`}
                </p>
              </div>
              <button
                onClick={() => { setShowAccessModal(false); setSelectedUserForAccess(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-0.5"
              >×</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* Role Selector (only when not user-specific) */}
              {!selectedUserForAccess && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2"> Select
                    Role </label>
                  <div className="flex gap-2 flex-wrap">
                    {['user', 'manager', 'admin', 'viewer'].map(role => (
                      <button key={role}
                        onClick={() => setSelectedRoleForAccess(role)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                          selectedRoleForAccess === role
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">Page Access Permissions</h3>
                    <p className="text-xs text-gray-400">
                      {activeCount} / {pagesList.length} pages enabled
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleSelectAll(true)} className="text-xs text-purple-600 hover:underline font-medium">
                      Select All
                    </button>
                    <button onClick={() => handleSelectAll(false)} className="text-xs text-gray-500 hover:underline font-medium">
                      Clear All
                    </button>
                  </div>
                </div>

                {loadingPermissions ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading permissions...</div>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden">
                    {pagesList.map(page => (
                      <label key={page.id}
                        className="flex items-center justify-between p-3 hover:bg-purple-50 cursor-pointer transition">
                        <div className="flex items-center gap-3">
                          <span className="text-xl w-7 text-center">{page.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-800">{page.name}</div>
                            <div className="text-xs text-gray-400">{page.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <span className={`text-xs font-medium ${permissions[page.id] ? 'text-green-600' : 'text-gray-400'}`}>
                            {permissions[page.id] ? 'ON' : 'OFF'}
                          </span>
                          <div
                            onClick={() => handlePermissionChange(page.id)}
                            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                              permissions[page.id] ? 'bg-purple-600' : 'bg-gray-200'
                            }`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              permissions[page.id] ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end rounded-b-2xl">
              <button
                onClick={() => { setShowAccessModal(false); setSelectedUserForAccess(null); }}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 transition text-sm">
                Cancel
              </button>
              <button onClick={savePermissions} disabled={savingPermissions}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium flex items-center gap-2 disabled:opacity-60">
                {savingPermissions ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : '💾 Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AddUserPage;