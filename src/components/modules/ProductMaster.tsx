import React, { useState, useEffect, useMemo } from 'react';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';
import { COLLECTIONS } from '../../types';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ProductMaster: React.FC = () => {
  const { 
    products,
    addItem,
    updateItem,
    deleteItem,
    loading,
    refreshData
  } = useUnifiedData();

  const [formData, setFormData] = useState({
    id: '',
    product_id: '',
    product_name: '',
    product_type: '',
    manufacturer: '',
    warranty_period_months: 12,
    default_service_cycle_days: 180
  });

  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false); // Track just the operation loading

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil((products?.length || 0) / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const paginatedProducts = useMemo(() => {
    if (!products) return [];
    const start = (currentPage - 1) * pageSize;
    return [...products].slice(start, start + pageSize);
  }, [products, currentPage, pageSize]);

  const rangeStart = !products || products.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, products?.length || 0);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      if (!formData.product_id || !formData.product_name || !formData.product_type) {
        setMessage({ type: 'error', text: 'Please fill all required fields' });
        setSubmitting(false);
        return;
      }

      let result;

      if (isEditing) {
        result = await updateItem(COLLECTIONS.PRODUCTS, formData.id, {
          product_id: formData.product_id,
          product_name: formData.product_name,
          product_type: formData.product_type,
          manufacturer: formData.manufacturer,
          warranty_period_months: Number(formData.warranty_period_months),
          default_service_cycle_days: Number(formData.default_service_cycle_days)
        });
      } else {
        result = await addItem(COLLECTIONS.PRODUCTS, {
          product_id: formData.product_id,
          product_name: formData.product_name,
          product_type: formData.product_type,
          manufacturer: formData.manufacturer,
          warranty_period_months: Number(formData.warranty_period_months),
          default_service_cycle_days: Number(formData.default_service_cycle_days)
        });
      }

      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: isEditing ? 'Product updated successfully!' : 'Product added successfully!' 
        });

        resetForm();

        // Refresh data in background without showing full page loader
        await refreshData();

        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: `Error: ${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      id: product.id,
      product_id: product.product_id,
      product_name: product.product_name,
      product_type: product.product_type,
      manufacturer: product.manufacturer || '',
      warranty_period_months: product.warranty_period_months,
      default_service_cycle_days: product.default_service_cycle_days || 180
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this product?')) {
      setDeletingId(id);
      setOperationLoading(true);

      try {
        const result = await deleteItem(COLLECTIONS.PRODUCTS, id);

        if (result.success) {
          // Refresh data after deletion
          await refreshData();
          
          setMessage({ type: 'success', text: 'Product deleted successfully!' });
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
        setOperationLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      product_id: '',
      product_name: '',
      product_type: '',
      manufacturer: '',
      warranty_period_months: 12,
      default_service_cycle_days: 180
    });
    setIsEditing(false);
  };

  // Show loading only on initial load, not on refresh operations
  if (loading && products.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading product data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-0">
      <h1 className="text-xl md:text-3xl font-bold text-gray-800">Product Master</h1>

      {message && (
        <div className={`p-3 rounded-lg ${
          message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {message.text}
        </div>
      )}

      <Card title={isEditing ? 'Edit Product' : 'Add New Product'}>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input 
            label="Product ID" 
            name="product_id" 
            value={formData.product_id}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            required 
            disabled={submitting || operationLoading}
          />

          <Input 
            label="Product Name" 
            name="product_name" 
            value={formData.product_name}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            required 
            disabled={submitting || operationLoading}
          />

          <Input 
            label="Product Type" 
            name="product_type" 
            value={formData.product_type}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            required 
            disabled={submitting || operationLoading}
          />

          <Input 
            label="Manufacturer" 
            name="manufacturer" 
            value={formData.manufacturer}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            disabled={submitting || operationLoading}
          />

          <Input 
            label="Warranty Period (months)" 
            name="warranty_period_months"
            value={formData.warranty_period_months.toString()}
            onChange={(e) => setFormData({...formData, [e.target.name]: Number(e.target.value)})}
            required 
            type="number" 
            disabled={submitting || operationLoading}
          />

          <Input 
            label="Service Cycle (days)" 
            name="default_service_cycle_days"
            value={formData.default_service_cycle_days.toString()}
            onChange={(e) => setFormData({...formData, [e.target.name]: Number(e.target.value)})}
            type="number" 
            disabled={submitting || operationLoading}
          />

          <div className="md:col-span-3 flex justify-end space-x-3">
            <Button type="submit" color="blue" disabled={submitting || operationLoading}>
              {submitting ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  {isEditing ? 'Updating...' : 'Adding...'}
                </>
              ) : isEditing ? 'Update Product' : 'Add Product'}
            </Button>

            <Button type="button" onClick={resetForm} color="gray" disabled={submitting || operationLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Product List">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warranty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.warranty_period_months} months</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.assignments?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(product)}
                        disabled={deletingId === product.id || operationLoading}
                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id || operationLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === product.id ? (
                          <span className="inline-flex items-center">
                            <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></span>
                            Deleting...
                          </span>
                        ) : (
                          'Delete'
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No products found. Add your first product above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {products && products.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{rangeStart}</span>–
                <span className="font-semibold text-gray-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{products.length}</span>
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
    </div>
  );
};

export default ProductMaster;