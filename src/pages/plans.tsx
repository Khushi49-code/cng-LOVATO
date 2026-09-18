import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../components/layouts/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  doc,
} from 'firebase/firestore';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: string;
  durationMonths: number;
  features: string[];
  isActive: boolean;
  isPopular?: boolean;
  isFree?: boolean;
  createdAt: any;
  whatsappApi?: boolean;
  isCustom?: boolean;
  customFields?: string[];
  dataLimit?: string;
  userLimit?: string;
  extraUses?: number;
  annualMaintenance?: boolean;
  serviceHours?: string;
  afterFreeServiceCharge?: string;
}

// ── Static default plans based on WhatsApp image ────────────────────────────
const DEFAULT_PLANS: Plan[] = [
  {
    id: 'face-month',
    name: 'Face Month',
    price: 0,
    duration: 'monthly',
    durationMonths: 1,
    features: ['1 GB Data', '1 User', 'Mobile Facility', 'Basic Support'],
    isActive: true,
    isFree: true,
    isPopular: false,
    whatsappApi: false,
    isCustom: false,
    customFields: [],
    createdAt: null,
    dataLimit: '1 GB',
    userLimit: '1 user',
  },
  {
    id: '6-months',
    name: '6 Month Plan',
    price: 6999,
    duration: 'half-yearly',
    durationMonths: 6,
    features: [
      '3 GB Data',
      '5 Users',
      'Mobile Facility',
      'Extra User ₹300',
      'Annual Maintenance',
      'Priority Support'
    ],
    isActive: true,
    isFree: false,
    isPopular: false,
    whatsappApi: false,
    isCustom: false,
    customFields: [],
    createdAt: null,
    dataLimit: '3 GB',
    userLimit: '5 users',
    extraUses: 300,
    annualMaintenance: true,
  },
  {
    id: '1-year',
    name: '12 Month Plan',
    price: 9999,
    duration: 'yearly',
    durationMonths: 12,
    features: [
      '3 GB Data',
      '5 Users',
      'Mobile Facility',
      'Extra User ₹300',
      'Annual Maintenance',
      '24/7 Premium Support',
      'Custom Reports'
    ],
    isActive: true,
    isFree: false,
    isPopular: true,
    whatsappApi: false,
    isCustom: false,
    customFields: [],
    createdAt: null,
    dataLimit: '3 GB',
    userLimit: '5 users',
    extraUses: 300,
    annualMaintenance: true,
  },
];

// ── Custom Plan ────────────────────────────────────────────────────────────────
const CUSTOM_PLAN: Plan = {
  id: 'custom',
  name: 'Customers Plan',
  price: 0,
  duration: 'custom',
  durationMonths: 0,
  features: [
    'Your company name and logo in notebooks',
    'Space up to your requirement',
    'As per client Requirement and offers quotation',
    'Dedicated Account Manager',
    'Custom Integrations',
    'SLA Guarantee'
  ],
  isActive: true,
  isFree: false,
  isPopular: false,
  whatsappApi: true,
  isCustom: true,
  customFields: [],
  createdAt: null,
};

// ── Free Service Table Data ──────────────────────────────────────────────────
interface FreeServiceItem {
  id: string;
  name: string;
  hours: string;
  minutes: string;
  price: string;
  description: string;
}

const FREE_SERVICE_DATA: FreeServiceItem[] = [
  {
    id: 'new-client',
    name: 'New Client (Per Year)',
    hours: '6 hours',
    minutes: '360 minutes',
    price: 'Free',
    description: 'Complete service package for new clients'
  },
  {
    id: 'renewal-client',
    name: 'Renewal Client (Per Year)',
    hours: '6 hours',
    minutes: '360 minutes',
    price: 'Free',
    description: 'Complete service package for renewal clients'
  },
];

// ── After Free Service Charges Data ──────────────────────────────────────────
interface AfterServiceCharge {
  id: string;
  name: string;
  price: string;
  description: string;
}

const AFTER_SERVICE_CHARGES: AfterServiceCharge[] = [
  {
    id: 'half-day',
    name: 'Half Day Service',
    price: '₹1,500',
    description: 'After free service period expires - Half day support'
  },
  {
    id: 'full-day',
    name: 'Full Day Service',
    price: '₹2,500',
    description: 'After free service period expires - Full day support'
  },
];

const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration: 'monthly',
    durationMonths: 1,
    features: '',
    isActive: true,
    isPopular: false,
    isFree: false,
    whatsappApi: false,
    isCustom: false,
    customFields: '',
    dataLimit: '',
    userLimit: '',
    extraUses: '',
    annualMaintenance: false,
    serviceHours: '',
    afterFreeServiceCharge: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // WhatsApp modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@gmail.com';

  // ── Fetch Plans ──────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const snap = await getDocs(query(collection(db, 'plans'), orderBy('price', 'asc')));
      const list: Plan[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Plan));
      setPlans(list);
    } catch (err) {
      console.error(err);
      setError('Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ── Helpers ──────────────────────────────────────────────────
  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
  };

  const getDurationLabel = (duration: string, months: number) => {
    if (duration === 'free') return 'Free Trial';
    if (duration === 'half-yearly') return '6 Months';
    if (duration === 'yearly') return '1 Year';
    if (duration === 'custom') return 'Custom';
    return duration;
  };

  // ── Form helpers ─────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      duration: 'monthly',
      durationMonths: 1,
      features: '',
      isActive: true,
      isPopular: false,
      isFree: false,
      whatsappApi: false,
      isCustom: false,
      customFields: '',
      dataLimit: '',
      userLimit: '',
      extraUses: '',
      annualMaintenance: false,
      serviceHours: '',
      afterFreeServiceCharge: '',
    });
    setEditingPlan(null);
    setShowForm(false);
    setFormLoading(false);
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price.toString(),
      duration: plan.duration,
      durationMonths: plan.durationMonths || 1,
      features: plan.features.join(', '),
      isActive: plan.isActive,
      isPopular: plan.isPopular || false,
      isFree: plan.isFree || false,
      whatsappApi: plan.whatsappApi || false,
      isCustom: plan.isCustom || false,
      customFields: plan.customFields ? plan.customFields.join(', ') : '',
      dataLimit: plan.dataLimit || '',
      userLimit: plan.userLimit || '',
      extraUses: plan.extraUses?.toString() || '',
      annualMaintenance: plan.annualMaintenance || false,
      serviceHours: plan.serviceHours || '',
      afterFreeServiceCharge: plan.afterFreeServiceCharge || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) { setError('You do not have permission to manage plans.'); return; }
    setFormLoading(true);
    setError(null);
    try {
      const featuresArray = formData.features.split(',').map(f => f.trim()).filter(Boolean);
      const customFieldsArray = formData.customFields.split(',').map(f => f.trim()).filter(Boolean);
      const priceValue = formData.isFree ? 0 : parseFloat(formData.price);
      const planData = {
        name: formData.name,
        price: priceValue,
        duration: formData.duration,
        durationMonths: formData.durationMonths,
        features: featuresArray,
        isActive: formData.isActive,
        isPopular: formData.isPopular,
        isFree: formData.isFree,
        whatsappApi: formData.whatsappApi,
        isCustom: formData.isCustom,
        customFields: customFieldsArray,
        dataLimit: formData.dataLimit,
        userLimit: formData.userLimit,
        extraUses: formData.extraUses ? parseInt(formData.extraUses) : undefined,
        annualMaintenance: formData.annualMaintenance,
        serviceHours: formData.serviceHours,
        afterFreeServiceCharge: formData.afterFreeServiceCharge,
        updatedAt: serverTimestamp(),
      };
      if (editingPlan) {
        await updateDoc(doc(db, 'plans', editingPlan.id), planData);
      } else {
        await addDoc(collection(db, 'plans'), { ...planData, createdAt: serverTimestamp() });
      }
      resetForm();
      fetchPlans();
    } catch (err) {
      console.error(err);
      setError('Failed to save plan. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!isAdmin) { setError('No permission.'); return; }
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try { await deleteDoc(doc(db, 'plans', planId)); fetchPlans(); }
    catch (err) { setError('Failed to delete plan.'); }
  };

  // ── WhatsApp ─────────────────────────────────────────────────
  const handleWhatsAppConnect = (plan: Plan) => {
    setSelectedPlan(plan);
    setWhatsappNumber('');
    setWhatsappMessage(
      plan.isCustom
        ? `Hi, I am interested in a Custom Plan. Please contact me to discuss my requirements and get a custom quote.`
        : `Hi, I want to subscribe to ${plan.name} - ${formatPrice(plan.price)} for ${getDurationLabel(plan.duration, plan.durationMonths)}`
    );
    setShowWhatsAppModal(true);
  };

  const handleWhatsAppSubmit = () => {
    if (!whatsappNumber) { alert('Please enter your WhatsApp number'); return; }
    const num = whatsappNumber.replace(/[^0-9]/g, '');
    const finalNum = num.startsWith('91') ? num : `91${num}`;
    window.open(`https://wa.me/${finalNum}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
    setShowWhatsAppModal(false);
    setWhatsappNumber('');
  };

  // All plans in one list - combine all plan types
  const allPlans = plans.length > 0 ? plans : [...DEFAULT_PLANS, CUSTOM_PLAN];

  // ── Plan Card ────────────────────────────────────────────────
  const PlanCard = ({ plan }: { plan: Plan }) => {
    const isFree = plan.isFree || plan.price === 0;
    const isCustomPlan = plan.isCustom || plan.id === 'custom';
    // Don't show badges for Customers Plan
    const showBadges = !isCustomPlan;

    return (
      <div className={`relative bg-white rounded-2xl shadow-md overflow-hidden border border-blue-500 ring-2 ring-blue-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col`}>

        {/* Badge - Only show for non-custom plans */}
        {showBadges && plan.isPopular && (
          <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded-bl-xl">⭐ POPULAR</div>
        )}
        {showBadges && isFree && !plan.isPopular && (
          <div className="absolute top-0 left-0 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded-br-xl">FREE</div>
        )}
        {showBadges && isCustomPlan && !plan.isPopular && (
          <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded-bl-xl">CUSTOM</div>
        )}

        {/* Header */}
        <div className="px-6 pt-8 pb-5 bg-blue-50">
          <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>

          <div className="mt-3 flex items-end gap-1">
            {isCustomPlan ? (
              <div>
                <span className="text-2xl font-bold text-blue-600">Custom Pricing</span>
                <p className="text-xs text-gray-500 mt-1">Based on your requirements</p>
              </div>
            ) : isFree ? (
              <span className="text-4xl font-extrabold text-blue-600">FREE</span>
            ) : (
              <>
                <span className="text-4xl font-extrabold text-blue-600">{formatPrice(plan.price)}</span>
              </>
            )}
          </div>

          {!isCustomPlan && (
            <p className="text-sm text-gray-500 mt-1">
              {getDurationLabel(plan.duration, plan.durationMonths)}
              {!isFree && plan.durationMonths > 0 && ` · ${plan.durationMonths} Month${plan.durationMonths > 1 ? 's' : ''}`}
            </p>
          )}
          {isCustomPlan && (
            <p className="text-sm text-gray-500 mt-1">Tailored to your business needs</p>
          )}

          {/* Plan details from WhatsApp image */}
          {plan.dataLimit && (
            <p className="text-sm text-gray-600 mt-2 font-semibold">📊 {plan.dataLimit}</p>
          )}
          {plan.userLimit && (
            <p className="text-sm text-gray-600">👤 {plan.userLimit}</p>
          )}
          {plan.extraUses && (
            <p className="text-sm text-gray-600 font-semibold">➕ Extra User: ₹{plan.extraUses}</p>
          )}
          {plan.annualMaintenance && (
            <p className="text-sm text-gray-600">🔧 Annual Maintenance</p>
          )}
        </div>

        {/* Features */}
        <div className="px-6 py-5 flex-1">
          <ul className="space-y-2.5">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          {/* Custom add-ons */}
          {plan.customFields && plan.customFields.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-semibold text-blue-600 mb-2">Custom Add-ons</p>
              <ul className="space-y-2">
                {plan.customFields.map((field, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mobile Facility tag */}
          {plan.features.some(f => f.includes('Mobile Facility')) && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full w-fit">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mobile Facility Included
            </div>
          )}

          {/* WhatsApp API tag */}
          {plan.whatsappApi && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full w-fit">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp API Not Included
            </div>
          )}
          
          {/* Custom plan note about pricing */}
          {isCustomPlan && (
            <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <p className="font-medium text-gray-700">💡 Custom pricing based on:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-600">
                <li>Number of users</li>
                <li>Specific features required</li>
                <li>Integration complexity</li>
                <li>Support level needed</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        <div className="px-6 pb-6 mt-auto">
          <button
            onClick={() => handleWhatsAppConnect(plan)}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isFree ? 'Start Free Trial' : isCustomPlan ? 'Get Custom Quote' : 'Buy Now'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-500 mt-1 text-sm">Choose the perfect plan for your business</p>
          </div>
          {isAdmin && !showForm && (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Plan
            </button>
          )}
          {isAdmin && showForm && (
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-800">← Cancel</button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {/* ── Add/Edit Form ── */}
        {showForm && isAdmin && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">{editingPlan ? 'Edit Plan' : 'Add New Plan'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Basic Plan"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (INR)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} min="0" placeholder="0 for free" disabled={formData.isFree}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select name="duration" value={formData.duration} onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="half-yearly">6 Months</option>
                    <option value="yearly">1 Year</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration in Months</label>
                  <input type="number" name="durationMonths" value={formData.durationMonths} onChange={handleChange} min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                {/* WhatsApp Image specific fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Limit</label>
                  <input type="text" name="dataLimit" value={formData.dataLimit} onChange={handleChange} placeholder="e.g., 1 GB, 3 GB"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Limit</label>
                  <input type="text" name="userLimit" value={formData.userLimit} onChange={handleChange} placeholder="e.g., 1 user, 5 users"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extra User (₹)</label>
                  <input type="number" name="extraUses" value={formData.extraUses} onChange={handleChange} placeholder="e.g., 300"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Hours</label>
                  <input type="text" name="serviceHours" value={formData.serviceHours} onChange={handleChange} placeholder="e.g., 6 hours (360 minutes)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">After Free Service Charge</label>
                  <input type="text" name="afterFreeServiceCharge" value={formData.afterFreeServiceCharge} onChange={handleChange} placeholder="e.g., ₹1500 half day"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
                  <input type="text" name="features" value={formData.features} onChange={handleChange} placeholder="e.g., 5 Users, 100GB Storage, Premium Support"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Fields (comma-separated)</label>
                  <input type="text" name="customFields" value={formData.customFields} onChange={handleChange} placeholder="e.g., Extra Storage, Dedicated Support"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-5">
                  {[
                    { name: 'isActive', label: 'Active' },
                    { name: 'isPopular', label: 'Popular' },
                    { name: 'whatsappApi', label: 'WhatsApp API' },
                    { name: 'isCustom', label: 'Custom Plan' },
                    { name: 'annualMaintenance', label: 'Annual Maintenance' },
                  ].map(cb => (
                    <label key={cb.name} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" name={cb.name} checked={(formData as any)[cb.name]} onChange={handleChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                      {cb.label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" name="isFree" checked={formData.isFree}
                      onChange={e => setFormData(prev => ({ ...prev, isFree: e.target.checked, price: e.target.checked ? '0' : prev.price }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                    Free Plan
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={resetForm} className="px-5 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {formLoading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Add Plan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-10 bg-gray-200 rounded w-1/2 mb-6" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(j => <div key={j} className="h-4 bg-gray-200 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Plans Grid ── */}
        {!loading && !showForm && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Subscription Plans</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {allPlans.map((plan, i) => <PlanCard key={plan.id || i} plan={plan} />)}
            </div>

            {/* ── Free Service Table ── */}
            <div className="mt-12">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Free Service</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hours</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Minutes</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {FREE_SERVICE_DATA.map((service) => (
                        <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{service.name}</td>
                          <td className="px-6 py-4 text-gray-600">{service.hours}</td>
                          <td className="px-6 py-4 text-gray-600">{service.minutes}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {service.price}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{service.description}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const dummyPlan: Plan = {
                                  id: service.id,
                                  name: service.name,
                                  price: 0,
                                  duration: 'yearly',
                                  durationMonths: 12,
                                  features: [service.description, `${service.hours} Service`, `${service.minutes} Support`],
                                  isActive: true,
                                  isFree: true,
                                  isPopular: false,
                                  whatsappApi: false,
                                  isCustom: false,
                                  customFields: [],
                                  createdAt: null,
                                  serviceHours: `${service.hours} (${service.minutes})`,
                                };
                                handleWhatsAppConnect(dummyPlan);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                            >
                              Contact
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── After Free Service Charges Table ── */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">After Free Service Charges</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-yellow-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {AFTER_SERVICE_CHARGES.map((charge) => (
                        <tr key={charge.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{charge.name}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              charge.id === 'full-day' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {charge.price}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-sm">{charge.description}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const chargePlan: Plan = {
                                  id: charge.id,
                                  name: charge.name,
                                  price: charge.id === 'full-day' ? 2500 : 1500,
                                  duration: 'custom',
                                  durationMonths: 0,
                                  features: [
                                    charge.description,
                                    'Priority Support',
                                    'Dedicated Assistance'
                                  ],
                                  isActive: true,
                                  isFree: false,
                                  isPopular: false,
                                  whatsappApi: false,
                                  isCustom: true,
                                  customFields: ['24/7 Support', 'Fast Response'],
                                  createdAt: null,
                                  afterFreeServiceCharge: charge.price,
                                };
                                handleWhatsAppConnect(chargePlan);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                            >
                              Contact
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Footer Note */}
              <p className="text-xs text-gray-400 mt-3 text-center">
                * Free service includes basic support. Additional charges apply after free service period expires.
              </p>
            </div>

            {/* Bottom note */}
            <p className="text-center text-xs text-gray-400 mt-8">
              All plans include basic warranty & service management. Prices are inclusive of taxes.
            </p>
          </>
        )}

        {/* ── WhatsApp Modal ── */}
        {showWhatsAppModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Connect via WhatsApp</h2>
                <button onClick={() => setShowWhatsAppModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your WhatsApp Number *</label>
                  <input type="tel" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="e.g., 9876543210"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Enter without +91</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowWhatsAppModal(false)} className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button onClick={handleWhatsAppSubmit} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Send via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};

export default PlansPage;