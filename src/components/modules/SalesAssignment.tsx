import React, { useState, useEffect, useMemo } from 'react';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';
import { COLLECTIONS, Customer, Product, ProductAssignment } from '../../types';
import { calculateExpiryDate, formatDate } from '../../lib/utils';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';

interface CustomerFormData {
  first_name: string;
  last_name: string;
  mobile_number: string;
  whatsapp_number: string;
  address: string;
  city: string;
  state: string;
  vehicle_number: string;
  vehicle_model: string;
}

interface MappingFormData {
  product_id: string;
  product_purchase_date: string;
  product_warranty_period: number;
  warranty_expiry_date?: string;
  notes: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const SalesAssignment: React.FC = () => {
  const { 
    customers, 
    products, 
    assignments,
    addItem,
    updateItem,
    deleteItem,
    loading,
    meta,
    refreshData
  } = useUnifiedData();
  
  const [customerType, setCustomerType] = useState<'new' | 'existing'>('new');
  const [customerData, setCustomerData] = useState<CustomerFormData>({
    first_name: '', last_name: '', mobile_number: '', whatsapp_number: '',
    address: '', city: '', state: '', vehicle_number: '', vehicle_model: ''
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [mappingData, setMappingData] = useState<MappingFormData & { warranty_expiry_date?: string }>({
    product_id: '',
    product_purchase_date: new Date().toISOString().split('T')[0],
    product_warranty_period: 12,
    notes: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<ProductAssignment | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  useEffect(() => {
    const purchaseDate = mappingData.product_purchase_date;
    const warrantyMonths = mappingData.product_warranty_period;

    if (purchaseDate && warrantyMonths) {
      const expiryDate = calculateExpiryDate(purchaseDate, warrantyMonths);
      setMappingData(prev => ({
        ...prev,
        warranty_expiry_date: expiryDate || undefined,
      }));
    } else {
      setMappingData(prev => ({
        ...prev,
        warranty_expiry_date: undefined,
      }));
    }
  }, [mappingData.product_purchase_date, mappingData.product_warranty_period]);

  const orderedAssignments = useMemo(() => [...assignments].reverse(), [assignments]);

  const totalPages = Math.max(1, Math.ceil(orderedAssignments.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orderedAssignments.slice(start, start + pageSize);
  }, [orderedAssignments, currentPage, pageSize]);

  const rangeStart = orderedAssignments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, orderedAssignments.length);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const delta = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis');
      }
    }
    return pages;
  }, [totalPages, currentPage]);

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(clamped);
  };
  
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerData({ ...customerData, [e.target.name]: e.target.value });
  };
  
  const handleMappingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newMappingData = { ...mappingData, [name]: value };

    if (name === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        newMappingData.product_warranty_period = selectedProduct.warranty_period_months || 12;
      }
    }
    setMappingData(newMappingData);
  };
  
  const handleEditAssignment = (assignment: ProductAssignment) => {
    setEditingAssignment(assignment);
    setMappingData({
      product_id: assignment.product_id,
      product_purchase_date: assignment.product_purchase_date,
      product_warranty_period: assignment.product_warranty_period,
      warranty_expiry_date: assignment.warranty_expiry_date,
      notes: assignment.notes || ''
    });
    
    // Set customer type to existing and select the customer
    setCustomerType('existing');
    setSelectedCustomerId(assignment.customer_id);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDeleteAssignment = async (id: string, customerName: string, productName: string) => {
    if (window.confirm(`Delete assignment for ${customerName} - ${productName}?`)) {
      setDeletingId(id);
      setMessage(null);
      
      try {
        const result = await deleteItem(COLLECTIONS.MAPPINGS, id);
        
        if (result.success) {
          await refreshData();
          setMessage({ type: 'success', text: 'Assignment deleted successfully!' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage({ type: 'error', text: `Error: ${result.error}` });
          setTimeout(() => setMessage(null), 3000);
        }
      } catch (error: any) {
        setMessage({ type: 'error', text: `Error: ${error.message}` });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setDeletingId(null);
      }
    }
  };
  
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    
    let finalCustomerId = selectedCustomerId;
    let customerName = '';
    
    try {
      if (customerType === 'new') {
        if (!customerData.first_name || !customerData.mobile_number || !customerData.vehicle_number) {
          setMessage({ type: 'error', text: 'Please fill all required customer fields.' });
          setIsSubmitting(false);
          return;
        }
        
        const result = await addItem(COLLECTIONS.CUSTOMERS, {
          ...customerData,
          created_at: new Date().toISOString()
        });
        
        if (!result.success) throw new Error(result.error);
        
        finalCustomerId = result.id!;
        customerName = customerData.first_name;
      } else {
        if (!selectedCustomerId) {
          setMessage({ type: 'error', text: 'Please select an existing customer.' });
          setIsSubmitting(false);
          return;
        }
        const existingCustomer = customers.find(c => c.id === selectedCustomerId);
        if (!existingCustomer) {
          setMessage({ type: 'error', text: 'Selected customer not found.' });
          setIsSubmitting(false);
          return;
        }
        customerName = existingCustomer.first_name || 'Existing Customer';
      }
      
      if (!mappingData.product_id || !mappingData.product_purchase_date) {
        setMessage({ type: 'error', text: 'Please fill all required product fields.' });
        setIsSubmitting(false);
        return;
      }
      
      const mappingToSave = {
        customer_id: finalCustomerId,
        product_id: mappingData.product_id,
        product_purchase_date: mappingData.product_purchase_date,
        product_warranty_period: mappingData.product_warranty_period,
        warranty_expiry_date: mappingData.warranty_expiry_date || '',
        reminder_status: {
          rem_1_sent: false,
          rem_2_sent: false,
          rem_3_sent: false,
          renewal_sent: false,
          warranty_renewed: false
        },
        notes: mappingData.notes || '',
        created_at: new Date().toISOString()
      };
      
      let result;
      if (editingAssignment) {
        // Update existing assignment
        result = await updateItem(COLLECTIONS.MAPPINGS, editingAssignment.id, mappingToSave);
        if (result.success) {
          setMessage({ type: 'success', text: `Assignment updated successfully for ${customerName}!` });
        }
      } else {
        // Create new assignment
        result = await addItem(COLLECTIONS.MAPPINGS, mappingToSave);
        if (result.success) {
          setMessage({ type: 'success', text: `Success! ${customerName}'s assignment saved.` });
        }
      }
      
      if (!result.success) throw new Error(result.error);
      
      await refreshData();
      setTimeout(() => setMessage(null), 3000);
      
      // Reset form
      setCustomerData({
        first_name: '', last_name: '', mobile_number: '', whatsapp_number: '',
        address: '', city: '', state: '', vehicle_number: '', vehicle_model: ''
      });
      setSelectedCustomerId('');
      setMappingData({
        product_id: '',
        product_purchase_date: new Date().toISOString().split('T')[0],
        product_warranty_period: 12,
        notes: ''
      });
      setEditingAssignment(null);
      setCustomerType('new');
      
    } catch (error: any) {
      console.error("Error saving sales assignment:", error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCancelEdit = () => {
    setEditingAssignment(null);
    setCustomerData({
      first_name: '', last_name: '', mobile_number: '', whatsapp_number: '',
      address: '', city: '', state: '', vehicle_number: '', vehicle_model: ''
    });
    setSelectedCustomerId('');
    setMappingData({
      product_id: '',
      product_purchase_date: new Date().toISOString().split('T')[0],
      product_warranty_period: 12,
      notes: ''
    });
    setCustomerType('new');
  };
  
  // Show loading only on initial load
  if (loading && customers.length === 0 && products.length === 0 && assignments.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading data...</p>
      </div>
    );
  }
  
  const productOptions = products.map(p => ({ 
    value: p.id, 
    label: `${p.product_name || 'N/A'} (${p.product_type || 'N/A'} - ${p.warranty_period_months || 12}M)` 
  }));
  
  const customerOptions = customers.map(c => ({ 
    value: c.id, 
    label: `${c.first_name || ''} ${c.last_name || ''} (${c.vehicle_number || 'N/A'})` 
  }));
  
  // Helper function to get customer and product names
  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown Customer';
  };
  
  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product ? product.product_name : 'Unknown Product';
  };
  
  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      <h1 className="text-xl md:text-3xl font-bold text-gray-800">
        {editingAssignment ? 'Edit Assignment' : 'New Sales Assignment'}
      </h1>
      
      {!meta.isOnline && (
        <div className="p-3 bg-yellow-100 text-yellow-800 rounded-lg flex items-center">
          <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">You are offline. Data will sync when connection is restored.</span>
        </div>
      )}
      
      {message && (
        <div className={`p-3 md:p-4 rounded-lg font-medium text-sm break-words ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSaveAssignment} className="space-y-4 md:space-y-6">
        <Card title="Customer Identification" className="!p-4 md:!p-6">
          <div className="flex flex-col md:flex-row md:space-x-6 space-y-3 md:space-y-0">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="new"
                checked={customerType === 'new'}
                onChange={() => { 
                  setCustomerType('new'); 
                  setSelectedCustomerId('');
                }}
                disabled={isSubmitting || editingAssignment !== null}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
              />
              <span className="text-gray-700 font-medium text-sm md:text-base">New Customer</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="customerType"
                value="existing"
                checked={customerType === 'existing'}
                onChange={() => { 
                  setCustomerType('existing'); 
                  setCustomerData({
                    first_name: '', last_name: '', mobile_number: '', whatsapp_number: '',
                    address: '', city: '', state: '', vehicle_number: '', vehicle_model: ''
                  });
                }}
                disabled={isSubmitting || editingAssignment !== null}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
              />
              <span className="text-gray-700 font-medium text-sm md:text-base">Existing Customer</span>
            </label>
          </div>
        </Card>
        
        <Card title={customerType === 'new' ? "New Customer Details" : "Select Existing Customer"} className="!p-4 md:!p-6">
          {customerType === 'new' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <Input 
                label="First Name" 
                name="first_name" 
                value={customerData.first_name} 
                onChange={handleCustomerChange} 
                required 
                disabled={isSubmitting}
              />
              <Input 
                label="Last Name" 
                name="last_name" 
                value={customerData.last_name} 
                onChange={handleCustomerChange} 
                required 
                disabled={isSubmitting}
              />
              <Input 
                label="Mobile Number" 
                name="mobile_number" 
                value={customerData.mobile_number} 
                onChange={handleCustomerChange} 
                required 
                disabled={isSubmitting}
              />
              <Input 
                label="Vehicle Number" 
                name="vehicle_number" 
                value={customerData.vehicle_number} 
                onChange={handleCustomerChange} 
                required 
                disabled={isSubmitting}
              />
              <Input 
                label="Vehicle Model" 
                name="vehicle_model" 
                value={customerData.vehicle_model} 
                onChange={handleCustomerChange} 
                required 
                disabled={isSubmitting}
              />
              <Input 
                label="WhatsApp Number" 
                name="whatsapp_number" 
                value={customerData.whatsapp_number} 
                onChange={handleCustomerChange} 
                disabled={isSubmitting}
              />
              <Input 
                label="City" 
                name="city" 
                value={customerData.city} 
                onChange={handleCustomerChange} 
                disabled={isSubmitting}
              />
              <Input 
                label="State" 
                name="state" 
                value={customerData.state} 
                onChange={handleCustomerChange} 
                disabled={isSubmitting}
              />
              <div className="sm:col-span-2 md:col-span-3">
                <Input 
                  label="Address" 
                  name="address" 
                  value={customerData.address} 
                  onChange={handleCustomerChange} 
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : (
            <Select
              label="Select Customer"
              name="selected_customer_id"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              options={customerOptions}
              required
              disabled={isSubmitting}
            />
          )}
        </Card>
        
        <Card title="Product Assignment" className="!p-4 md:!p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <Select 
              label="Product" 
              name="product_id" 
              value={mappingData.product_id} 
              onChange={handleMappingChange} 
              options={productOptions} 
              required 
              disabled={isSubmitting}
            />
            <Input 
              label="Purchase Date" 
              name="product_purchase_date" 
              value={mappingData.product_purchase_date} 
              onChange={handleMappingChange} 
              required 
              type="date" 
              disabled={isSubmitting}
            />
            <Input 
              label="Warranty Period (Months)" 
              name="product_warranty_period" 
              value={mappingData.product_warranty_period.toString()} 
              onChange={handleMappingChange} 
              required 
              type="number" 
              disabled={isSubmitting}
            />
            <Input 
              label="Warranty Expiry Date" 
              name="warranty_expiry_date" 
              value={formatDate(mappingData.warranty_expiry_date || '')} 
              disabled 
            />
            <div className="sm:col-span-2 md:col-span-2">
              <Input 
                label="Notes" 
                name="notes" 
                value={mappingData.notes} 
                onChange={handleMappingChange} 
                disabled={isSubmitting}
              />
            </div>
          </div>
        </Card>
        
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:space-x-4">
          <Button 
            type="submit" 
            color="blue" 
            className="w-full sm:w-64 py-3 text-base md:text-lg font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                {editingAssignment ? 'Updating...' : 'Saving...'}
              </>
            ) : editingAssignment ? 'Update Assignment' : `Save ${customerType === 'new' ? 'New Customer' : 'Assignment'}`}
          </Button>
          
          {editingAssignment && (
            <Button 
              type="button" 
              color="gray" 
              className="w-full sm:w-64 py-3 text-base md:text-lg font-bold"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
            >
              Cancel Edit
            </Button>
          )}
        </div>
      </form>
      
      {/* Recent Assignments Table */}
      <Card title="Product Assignments" className="!p-4 md:!p-6">
        {/* ── Desktop Table View ─────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warranty Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAssignments.length > 0 ? (
                paginatedAssignments.map((assignment) => {
                  const isExpired = new Date(assignment.warranty_expiry_date) < new Date();
                  const isExpiringSoon = !isExpired && new Date(assignment.warranty_expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const customerName = getCustomerName(assignment.customer_id);
                  const productName = getProductName(assignment.product_id);
                  
                  return (
                    <tr key={assignment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {productName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(assignment.product_purchase_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-medium ${
                          isExpired ? 'text-red-600' : 
                          isExpiringSoon ? 'text-orange-600' : 
                          'text-green-600'
                        }`}>
                          {formatDate(assignment.warranty_expiry_date)}
                          {isExpired && ' (Expired)'}
                          {isExpiringSoon && !isExpired && ' (Expiring soon)'}
                        </span>
                       </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isExpired ? 'bg-red-100 text-red-800' : 
                          isExpiringSoon ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-green-100 text-green-800'
                        }`}>
                          {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                        </span>
                       </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditAssignment(assignment)}
                            disabled={deletingId === assignment.id || isSubmitting}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id, customerName, productName)}
                            disabled={deletingId === assignment.id || isSubmitting}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === assignment.id ? (
                              <span className="inline-flex items-center">
                                <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></span>
                                Deleting...
                              </span>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                       </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No assignments found. Create your first assignment above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Card View ──────────────────────────────── */}
        <div className="md:hidden space-y-3">
          {paginatedAssignments.length > 0 ? (
            paginatedAssignments.map((assignment) => {
              const isExpired = new Date(assignment.warranty_expiry_date) < new Date();
              const isExpiringSoon = !isExpired && new Date(assignment.warranty_expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              const customerName = getCustomerName(assignment.customer_id);
              const productName = getProductName(assignment.product_id);

              return (
                <div key={assignment.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  {/* Header: Customer + Status Badge */}
                  <div className="flex justify-between items-start gap-2 mb-3 pb-3 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {customerName}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        📦 {productName}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0 ${
                      isExpired ? 'bg-red-100 text-red-800' : 
                      isExpiringSoon ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-green-100 text-green-800'
                    }`}>
                      {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring' : 'Active'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Purchase</div>
                      <div className="text-gray-800 font-semibold">
                        {formatDate(assignment.product_purchase_date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Expiry</div>
                      <div className={`font-semibold ${
                        isExpired ? 'text-red-600' : 
                        isExpiringSoon ? 'text-orange-600' : 
                        'text-green-600'
                      }`}>
                        {formatDate(assignment.warranty_expiry_date)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEditAssignment(assignment)}
                      disabled={deletingId === assignment.id || isSubmitting}
                      className="flex-1 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id, customerName, productName)}
                      disabled={deletingId === assignment.id || isSubmitting}
                      className="flex-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
                    >
                      {deletingId === assignment.id ? (
                        <span className="inline-flex items-center justify-center">
                          <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></span>
                          Deleting...
                        </span>
                      ) : (
                        '🗑️ Delete'
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              No assignments found. Create your first assignment above.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {orderedAssignments.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs md:text-sm text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{rangeStart}</span>–
                <span className="font-semibold text-gray-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{orderedAssignments.length}</span>
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-gray-200 rounded-lg text-xs md:text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {pageNumbers.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`ellipsis-${i}`} className="px-1 md:px-2 text-gray-400 select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`min-w-[32px] h-8 md:min-w-[36px] md:h-9 px-2 rounded-lg text-xs md:text-sm font-bold transition-colors ${
                      p === currentPage
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SalesAssignment;