import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  COLLECTIONS, 
  CollectionName, 
  UnifiedData, 
  RawData, 
  StatsData,
  Customer,
  Product,
  ProductAssignment,
  Service,
  Log,
  UnifiedDataContextValue,
  ApiResponse
} from '../types';

// ==================== INITIAL STATE ====================
const initialUnifiedData: UnifiedData = {
  raw: {
    customers: [],
    products: [],
    mappings: [],
    services: [],
    logs: []
  },
  
  views: {
    customers: [],
    products: [],
    assignments: [],
    serviceHistory: [],
    reminders: [],
    activityLogs: []
  },
  
  stats: {
    totalCustomers: 0,
    totalProducts: 0,
    totalAssignments: 0,
    totalServices: 0,
    totalLogs: 0,
    expiringThisWeek: 0,
    expiringThisMonth: 0,
    pendingServices: 0
  },
  
  meta: {
    lastUpdated: null,
    isOnline: true,
    hasPendingChanges: false,
    dataVersion: 1
  }
};

// ==================== CONTEXT ====================
const UnifiedDataContext = createContext<UnifiedDataContextValue | undefined>(undefined);

interface UnifiedDataProviderProps {
  children: ReactNode;
}

const UnifiedDataProvider: React.FC<UnifiedDataProviderProps> = ({ children }) => {
  const [unifiedData, setUnifiedData] = useState<UnifiedData>(initialUnifiedData);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // ==================== PROCESS RAW DATA INTO VIEWS ====================
  const processData = useCallback((rawData: RawData): UnifiedData => {
    // Create customers view
    const customersView = rawData.customers.map(customer => ({
      ...customer,
      products: [],
      services: [],
      logs: [],
      total_products: 0,
      total_services: 0,
      total_logs: 0,
      full_name: `${customer.first_name} ${customer.last_name}`
    }));
    
    // Create products view
    const productsView = rawData.products.map(product => ({
      ...product,
      assignments: [],
      services: [],
      total_assignments: 0,
      total_services: 0
    }));
    
    // Create assignments view
    const assignmentsView = rawData.mappings.map(mapping => {
      const customer = rawData.customers.find(c => c.id === mapping.customer_id);
      const product = rawData.products.find(p => p.id === mapping.product_id);
      return {
        ...mapping,
        customer_details: customer || {},
        product_details: product || {},
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
        product_name: product ? product.product_name : 'Unknown',
        vehicle_number: customer?.vehicle_number || 'N/A',
        mobile_number: customer?.mobile_number || 'N/A',
        days_until_expiry: null,
        is_expired: false,
        is_expiring_soon: false
      };
    });
    
    // Create service history view
    const serviceHistoryView = rawData.services.map(service => {
      const customer = rawData.customers.find(c => c.id === service.customer_id);
      const product = rawData.products.find(p => p.id === service.product_id);
      return {
        ...service,
        customer_details: customer || {},
        product_details: product || {},
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
        product_name: product ? product.product_name : 'Unknown',
        vehicle_number: customer?.vehicle_number || 'N/A'
      };
    });
    
    // Create activity logs view
    const activityLogsView = rawData.logs.map(log => {
      const customer = rawData.customers.find(c => c.id === log.customer_id);
      const product = rawData.products.find(p => p.id === log.product_id);
      return {
        ...log,
        customer_details: customer || {},
        product_details: product || {},
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
        product_name: product ? product.product_name : 'Unknown',
        vehicle_number: customer?.vehicle_number || 'N/A'
      };
    });
    
    // Create reminders view
    const remindersView = rawData.mappings
      .filter(m => m.warranty_expiry_date)
      .map(mapping => {
        const customer = rawData.customers.find(c => c.id === mapping.customer_id);
        const product = rawData.products.find(p => p.id === mapping.product_id);
        return {
          ...mapping,
          customer_details: customer || {},
          product_details: product || {},
          customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown',
          product_name: product ? product.product_name : 'Unknown',
          vehicle_number: customer?.vehicle_number || 'N/A',
          mobile_number: customer?.mobile_number || 'N/A',
          expiry_date: mapping.warranty_expiry_date,
          days_until_expiry: 0,
          reminder_level: 'info' as const,
          reminder_to_send: null,
          is_expired: false,
          is_expiring_soon: false,
          is_expiring_this_week: false,
          is_expiring_today: false
        };
      });
    
    const stats: StatsData = {
      totalCustomers: rawData.customers.length,
      totalProducts: rawData.products.length,
      totalAssignments: rawData.mappings.length,
      totalServices: rawData.services.length,
      totalLogs: rawData.logs.length,
      expiringThisWeek: 0,
      expiringThisMonth: 0,
      pendingServices: rawData.services.filter(s => s.service_status === 'Pending').length
    };
    
    return {
      raw: rawData,
      views: {
        customers: customersView,
        products: productsView,
        assignments: assignmentsView,
        serviceHistory: serviceHistoryView,
        reminders: remindersView,
        activityLogs: activityLogsView
      },
      stats,
      meta: {
        lastUpdated: new Date().toISOString(),
        isOnline: navigator.onLine,
        hasPendingChanges: false,
        dataVersion: 1
      }
    };
  }, []);

  // ==================== LOAD DATA FROM FIREBASE ====================
  const loadAllData = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loading) {
      console.log('⏳ Already loading data, skipping...');
      return;
    }
    
    try {
      setLoading(true);
      console.log('📦 Fetching data from Firebase...');
      
      const [
        customersSnapshot,
        productsSnapshot,
        mappingsSnapshot,
        servicesSnapshot,
        logsSnapshot
      ] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.CUSTOMERS)),
        getDocs(collection(db, COLLECTIONS.PRODUCTS)),
        getDocs(collection(db, COLLECTIONS.MAPPINGS)),
        getDocs(collection(db, COLLECTIONS.SERVICES)),
        getDocs(collection(db, COLLECTIONS.LOGS))
      ]);
      
      console.log('✅ Data fetched successfully');
      
      const rawData: RawData = {
        customers: customersSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          firebase_id: doc.id,
          ...doc.data()
        } as Customer)),
        products: productsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          firebase_id: doc.id,
          ...doc.data()
        } as Product)),
        mappings: mappingsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          firebase_id: doc.id,
          ...doc.data()
        } as ProductAssignment)),
        services: servicesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          firebase_id: doc.id,
          ...doc.data()
        } as Service)),
        logs: logsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          firebase_id: doc.id,
          ...doc.data()
        } as Log))
      };
      
      const newUnifiedData = processData(rawData);
      
      setUnifiedData(newUnifiedData);
      
      // Cache data
      localStorage.setItem('unified_data_cache', JSON.stringify({
        data: newUnifiedData,
        timestamp: Date.now(),
        version: '2.0'
      }));
      
      console.log('✅ State updated with fresh data');
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error);
      
      // Try to load from cache
      try {
        const cached = localStorage.getItem('unified_data_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          setUnifiedData(parsed.data);
          console.log('📦 Loaded from cache');
        }
      } catch (e) {
        console.error('Cache error:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, processData]);

  // ==================== LOAD ON MOUNT AND REFRESH TRIGGER ====================
  useEffect(() => {
    loadAllData();
  }, [refreshTrigger]); // Add refreshTrigger to dependencies

  // ==================== ADD ITEM ====================
  const addItem = useCallback(async (collectionName: CollectionName, itemData: any): Promise<ApiResponse> => {
    try {
      setLoading(true); // Show loading state
      
      const docRef = await addDoc(collection(db, collectionName), {
        ...itemData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      console.log(`✅ Added document to ${collectionName} with ID: ${docRef.id}`);
      
      // Trigger refresh by incrementing refreshTrigger
      setRefreshTrigger(prev => prev + 1);
      
      return { 
        success: true, 
        id: docRef.id, 
        message: 'Added successfully' 
      };
    } catch (error: any) {
      console.error(`Error adding to ${collectionName}:`, error);
      setLoading(false);
      return { 
        success: false, 
        error: error.message,
        message: `Add failed: ${error.message}`
      };
    }
  }, []);

  // ==================== UPDATE ITEM ====================
  const updateItem = useCallback(async (collectionName: CollectionName, id: string, updates: any): Promise<ApiResponse> => {
    try {
      setLoading(true);
      
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...updates,
        updated_at: serverTimestamp()
      });
      
      console.log(`✅ Updated document in ${collectionName} with ID: ${id}`);
      
      // Trigger refresh by incrementing refreshTrigger
      setRefreshTrigger(prev => prev + 1);
      
      return { success: true, message: 'Updated successfully' };
    } catch (error: any) {
      console.error(`Error updating ${collectionName}:`, error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  }, []);

  // ==================== DELETE ITEM ====================
  const deleteItem = useCallback(async (collectionName: CollectionName, id: string): Promise<ApiResponse> => {
    try {
      setLoading(true);
      
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      
      console.log(`✅ Deleted document from ${collectionName} with ID: ${id}`);
      
      // Trigger refresh by incrementing refreshTrigger
      setRefreshTrigger(prev => prev + 1);
      
      return { success: true, message: 'Deleted successfully' };
    } catch (error: any) {
      console.error(`Error deleting from ${collectionName}:`, error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  }, []);

  // ==================== REFRESH DATA ====================
  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ==================== CLEAR CACHE ====================
  const clearCache = useCallback(() => {
    localStorage.removeItem('unified_data_cache');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ==================== CONTEXT VALUE ====================
  const value: UnifiedDataContextValue = {
    data: unifiedData,
    loading,
    error,
    customers: unifiedData.views.customers,
    products: unifiedData.views.products,
    assignments: unifiedData.views.assignments,
    services: unifiedData.views.serviceHistory,
    reminders: unifiedData.views.reminders,
    logs: unifiedData.views.activityLogs,
    stats: unifiedData.stats,
    meta: unifiedData.meta,
    addItem,
    updateItem,
    deleteItem,
    refreshData,
    clearCache,
    findCustomer: (id) => unifiedData.views.customers.find(c => c.id === id),
    findProduct: (id) => unifiedData.views.products.find(p => p.id === id),
    findAssignment: (id) => unifiedData.views.assignments.find(a => a.id === id),
    findService: (id) => unifiedData.views.serviceHistory.find(s => s.id === id),
    getCustomerProducts: (customerId) => 
      unifiedData.views.assignments.filter(a => a.customer_id === customerId),
    getCustomerServices: (customerId) => 
      unifiedData.views.serviceHistory.filter(s => s.customer_id === customerId),
    getCustomerLogs: (customerId) => 
      unifiedData.views.activityLogs.filter(l => l.customer_id === customerId),
    hasProductAssignment: (customerId, productId) => 
      unifiedData.views.assignments.some(a => 
        a.customer_id === customerId && a.product_id === productId
      )
  };

  return (
    <UnifiedDataContext.Provider value={value}>
      {children}
    </UnifiedDataContext.Provider>
  );
};

// ==================== ✅ NAMED EXPORT - CUSTOM HOOK ====================
export const useUnifiedData = (): UnifiedDataContextValue => {
  const context = useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedData must be used within UnifiedDataProvider');
  }
  return context;
};

// ==================== ✅ DEFAULT EXPORT - PROVIDER ====================
export default UnifiedDataProvider;