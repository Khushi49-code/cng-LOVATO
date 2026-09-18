import React, { useState, useMemo, useEffect } from 'react';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';
import { COLLECTIONS, Customer } from '../../types';
import { formatDate } from '../../lib/utils';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';

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

const initialFormData: CustomerFormData = {
  first_name: '',
  last_name: '',
  mobile_number: '',
  whatsapp_number: '',
  address: '',
  city: '',
  state: '',
  vehicle_number: '',
  vehicle_model: ''
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const CustomerManagement: React.FC = () => {
  const { 
    customers,
    deleteItem,
    addItem,
    updateItem,
    getCustomerProducts,
    getCustomerServices,
    loading,
    stats,
    refreshData
  } = useUnifiedData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.first_name.toLowerCase().includes(term) ||
      c.last_name.toLowerCase().includes(term) ||
      c.mobile_number.includes(term) ||
      c.vehicle_number.toLowerCase().includes(term) ||
      c.vehicle_model.toLowerCase().includes(term)
    );
  }, [customers, searchTerm]);

  // Reset to page 1 whenever the search term or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  // Clamp current page if data shrinks (e.g. after a delete)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const rangeStart = filteredCustomers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredCustomers.length);

  // Build a compact page number list with ellipses
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

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      mobile_number: customer.mobile_number || '',
      whatsapp_number: customer.whatsapp_number || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      vehicle_number: customer.vehicle_number || '',
      vehicle_model: customer.vehicle_model || ''
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOperationLoading(true);
    setMessage(null);

    try {
      let result;
      if (editingCustomer) {
        result = await updateItem(COLLECTIONS.CUSTOMERS, editingCustomer.id, formData);
      } else {
        result = await addItem(COLLECTIONS.CUSTOMERS, {
          ...formData,
          created_at: new Date().toISOString()
        });
      }

      if (result.success) {
        await refreshData();
        setMessage({ 
          type: 'success', 
          text: `Customer ${editingCustomer ? 'updated' : 'added'} successfully!` 
        });
        setIsModalOpen(false);
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setOperationLoading(false);
    }
  };

  const handleViewDetails = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(`${customer.first_name} ${customer.last_name}`);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };
  
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (window.confirm(`Delete customer ${name}? This will also delete all related assignments and services!`)) {
      setDeletingId(id);
      setOperationLoading(true);
      setMessage(null);

      try {
        const result = await deleteItem(COLLECTIONS.CUSTOMERS, id);
        
        if (result.success) {
          await refreshData();
          setMessage({ type: 'success', text: `Customer ${name} deleted successfully!` });
          setTimeout(() => setMessage(null), 3000);
          
          if (selectedCustomerId === id) {
            setSelectedCustomerId(null);
            setSelectedCustomerName('');
          }
        } else {
          setMessage({ type: 'error', text: `Error: ${result.error}` });
          setTimeout(() => setMessage(null), 3000);
        }
      } catch (error: any) {
        setMessage({ type: 'error', text: `Error: ${error.message}` });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setDeletingId(null);
        setOperationLoading(false);
      }
    }
  };
  
  if (loading && customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
        <p className="mt-4 text-gray-600 font-medium animate-pulse">Loading dynamic customer database...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Customer Management</h1>
          <p className="text-gray-500 mt-1">Manage and track your customer relationships dynamically.</p>
        </div>
        <Button 
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Customer
        </Button>
      </div>
      
      {message && (
        <div className={`p-4 rounded-xl shadow-sm border animate-in slide-in-from-top-2 duration-300 ${
          message.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-green-50 border-green-100 text-green-800'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: stats.totalCustomers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Assignments', value: stats.totalAssignments, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Service Records', value: stats.totalServices, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Expiring This Month', value: stats.expiringThisMonth, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <Card key={i} className="relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full ${stat.bg} opacity-50 group-hover:scale-110 transition-transform`}></div>
            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-gray-500 font-medium text-sm mt-1">{stat.label}</div>
          </Card>
        ))}
      </div>
      
      <Card className="border-none shadow-xl shadow-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Customer Database
          </h2>
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search by name, phone or vehicle..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Name & Contact</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Vehicle Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((customer, idx) => (
                  <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner group-hover:scale-110 transition-transform">
                          {customer.first_name[0]}{customer.last_name[0]}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {customer.mobile_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-800">{customer.vehicle_number}</div>
                      <div className="text-xs text-gray-500 uppercase">{customer.vehicle_model}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {customer.products?.length || 0} Products
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                          {customer.services?.length || 0} Services
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(customer)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(customer)}
                          className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer.id, customer.first_name)}
                          disabled={deletingId === customer.id}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Customer"
                        >
                          {deletingId === customer.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center">
                      <div className="bg-gray-100 p-4 rounded-full mb-4">
                        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No customers found matching your search.</p>
                      <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-600 font-bold hover:underline">Clear Search</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredCustomers.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 pt-6 mt-2 border-t border-gray-100">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{rangeStart}</span>–
                <span className="font-semibold text-gray-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{filteredCustomers.length}</span>
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Previous page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {pageNumbers.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-bold transition-colors ${
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
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
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
      
      {selectedCustomerId && (
        <Card title={`Customer Insights: ${selectedCustomerName}`} className="border-l-4 border-l-blue-600 animate-in slide-in-from-bottom-8 duration-500 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-50 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Assigned Products
              </h3>
              {getCustomerProducts(selectedCustomerId).length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {getCustomerProducts(selectedCustomerId).map(product => (
                    <div key={product.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="font-bold text-blue-900">{product.product_name}</div>
                      <div className="grid grid-cols-2 mt-2 gap-2">
                        <div className="text-xs text-gray-500">
                          <div className="font-medium text-gray-400">PURCHASED</div>
                          <div className="font-bold">{formatDate(product.product_purchase_date)}</div>
                        </div>
                        <div className="text-xs text-gray-500">
                          <div className="font-medium text-gray-400">EXPIRY</div>
                          <div className="font-bold text-amber-600">{formatDate(product.warranty_expiry_date)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 italic">No products assigned to this customer yet.</div>
              )}
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Service History
              </h3>
              {getCustomerServices(selectedCustomerId).length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {getCustomerServices(selectedCustomerId).map(service => (
                    <div key={service.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-green-900">{service.service_type}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          service.service_status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {service.service_status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span className="font-bold">{formatDate(service.service_date)}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span>{service.product_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 italic">No service history records found.</div>
              )}
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
            >
              Close Details
            </button>
          </div>
        </Card>
      )}

      {/* Dynamic Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? "Edit Customer Details" : "Register New Customer"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              name="first_name" 
              value={formData.first_name} 
              onChange={handleInputChange} 
              required 
            />
            <Input 
              label="Last Name" 
              name="last_name" 
              value={formData.last_name} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Mobile Number" 
              name="mobile_number" 
              value={formData.mobile_number} 
              onChange={handleInputChange} 
              required 
            />
            <Input 
              label="WhatsApp Number" 
              name="whatsapp_number" 
              value={formData.whatsapp_number} 
              onChange={handleInputChange} 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Vehicle Number" 
              name="vehicle_number" 
              value={formData.vehicle_number} 
              onChange={handleInputChange} 
              required 
            />
            <Input 
              label="Vehicle Model" 
              name="vehicle_model" 
              value={formData.vehicle_model} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="City" 
              name="city" 
              value={formData.city} 
              onChange={handleInputChange} 
            />
            <Input 
              label="State" 
              name="state" 
              value={formData.state} 
              onChange={handleInputChange} 
            />
          </div>
          <Input 
            label="Full Address" 
            name="address" 
            value={formData.address} 
            onChange={handleInputChange} 
          />
          
          <div className="pt-4 flex gap-3">
            <Button 
              type="submit" 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg"
              disabled={operationLoading}
            >
              {operationLoading ? 'Processing...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
            </Button>
            <Button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default CustomerManagement;