// ==================== TYPES ====================

export interface Customer {
  id: string;
  firebase_id?: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  whatsapp_number?: string;
  address?: string;
  city?: string;
  state?: string;
  vehicle_number: string;
  vehicle_model: string;
  created_at?: any;
  updated_at?: any;
}

export interface CustomerView extends Customer {
  products: ProductAssignmentView[];
  services: ServiceView[];
  logs: LogView[];
  total_products: number;
  total_services: number;
  total_logs: number;
  full_name: string;
}

export interface Product {
  id: string;
  firebase_id?: string;
  product_id: string;
  product_name: string;
  product_type: string;
  manufacturer?: string;
  warranty_period_months: number;
  default_service_cycle_days?: number;
  created_at?: any;
  updated_at?: any;
}

export interface ProductView extends Product {
  assignments: ProductAssignmentView[];
  services: ServiceView[];
  total_assignments: number;
  total_services: number;
}

export interface ProductAssignment {
  id: string;
  firebase_id?: string;
  customer_id: string;
  product_id: string;
  product_purchase_date: string;
  product_warranty_period: number;
  warranty_expiry_date: string;
  reminder_status: ReminderStatus;
  notes?: string;
  created_at?: any;
  updated_at?: any;
}

export interface ProductAssignmentView extends ProductAssignment {
  customer_details: Customer | {};
  product_details: Product | {};
  customer_name: string;
  product_name: string;
  vehicle_number: string;
  mobile_number: string;
  days_until_expiry: number | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
}

export interface ReminderStatus {
  rem_1_sent: boolean;
  rem_2_sent: boolean;
  rem_3_sent: boolean;
  renewal_sent: boolean;
  warranty_renewed: boolean;
}

export interface Service {
  id: string;
  firebase_id?: string;
  customer_id: string;
  product_id: string;
  service_date: string;
  service_type: string;
  service_status: string;
  service_notes?: string;
  next_service_date?: string;
  created_at?: any;
  updated_at?: any;
}

export interface ServiceView extends Service {
  customer_details: Customer | {};
  product_details: Product | {};
  customer_name: string;
  product_name: string;
  vehicle_number: string;
}

export interface Log {
  id: string;
  firebase_id?: string;
  customer_id: string;
  product_id: string;
  action: string;
  date: string;
  notes?: string;
  log_type: string;
  created_at?: any;
  updated_at?: any;
}

export interface LogView extends Log {
  customer_details: Customer | {};
  product_details: Product | {};
  customer_name: string;
  product_name: string;
  vehicle_number: string;
}

export interface ReminderView extends ProductAssignmentView {
  expiry_date: string;
  days_until_expiry: number;
  reminder_level: 'info' | 'warning' | 'critical';
  reminder_to_send: string | null;
  is_expiring_soon: boolean;
  is_expiring_this_week: boolean;
  is_expiring_today: boolean;
}

export interface RawData {
  customers: Customer[];
  products: Product[];
  mappings: ProductAssignment[];
  services: Service[];
  logs: Log[];
}

export interface ViewsData {
  customers: CustomerView[];
  products: ProductView[];
  assignments: ProductAssignmentView[];
  serviceHistory: ServiceView[];
  reminders: ReminderView[];
  activityLogs: LogView[];
}

export interface StatsData {
  totalCustomers: number;
  totalProducts: number;
  totalAssignments: number;
  totalServices: number;
  totalLogs: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  pendingServices: number;
  activeWarranties?: number;
  renewedWarranties?: number;
}

export interface MetaData {
  lastUpdated: string | null;
  isOnline: boolean;
  hasPendingChanges: boolean;
  dataVersion: number;
}

export interface UnifiedData {
  raw: RawData;
  views: ViewsData;
  stats: StatsData;
  meta: MetaData;
}

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  id?: string;
  item?: T;
}

export const COLLECTIONS = {
  CUSTOMERS: 'customers',
  PRODUCTS: 'products',
  MAPPINGS: 'mappings',
  SERVICES: 'services',
  LOGS: 'logs'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

export interface UnifiedDataContextValue {
  data: UnifiedData;
  loading: boolean;
  error: any;
  customers: CustomerView[];
  products: ProductView[];
  assignments: ProductAssignmentView[];
  services: ServiceView[];
  reminders: ReminderView[];
  logs: LogView[];
  stats: StatsData;
  meta: MetaData;
  addItem: (collectionName: CollectionName, itemData: any) => Promise<ApiResponse>;
  updateItem: (collectionName: CollectionName, id: string, updates: any) => Promise<ApiResponse>;
  deleteItem: (collectionName: CollectionName, id: string) => Promise<ApiResponse>;
  refreshData: () => void;
  clearCache: () => void;
  findCustomer: (id: string) => CustomerView | undefined;
  findProduct: (id: string) => ProductView | undefined;
  findAssignment: (id: string) => ProductAssignmentView | undefined;
  findService: (id: string) => ServiceView | undefined;
  getCustomerProducts: (customerId: string) => ProductAssignmentView[];
  getCustomerServices: (customerId: string) => ServiceView[];
  getCustomerLogs: (customerId: string) => LogView[];
  hasProductAssignment: (customerId: string, productId: string) => boolean;
}