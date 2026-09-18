import React, { useState, useEffect, useMemo } from 'react';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';
import { COLLECTIONS } from '../../types';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import * as XLSX from 'xlsx';

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
  const [operationLoading, setOperationLoading] = useState(false);

  // Excel Import State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

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

  // ============================
  // Excel Import Handler
  // ============================
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    setMessage(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        setMessage({ type: 'error', text: '⚠️ Excel file ma koi data nathi.' });
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

        const productId = String(row.product_id || row.productId || row.ProductID || row.id || '').trim();
        const productName = String(row.product_name || row.productName || row.ProductName || row.name || '').trim();
        const productType = String(row.product_type || row.productType || row.ProductType || row.type || '').trim();
        const manufacturer = String(row.manufacturer || row.Manufacturer || row.brand || '').trim();
        const warrantyPeriod = Number(row.warranty_period_months || row.warrantyPeriod || row.warranty || 12);
        const serviceCycle = Number(row.default_service_cycle_days || row.serviceCycle || row.service_cycle_days || 180);

        if (!productId || !productName || !productType) {
          failCount++;
          errors.push(`Row ${i + 2}: Missing required fields (product_id, product_name, product_type)`);
          continue;
        }

        try {
          const result = await addItem(COLLECTIONS.PRODUCTS, {
            product_id: productId,
            product_name: productName,
            product_type: productType,
            manufacturer,
            warranty_period_months: isNaN(warrantyPeriod) ? 12 : warrantyPeriod,
            default_service_cycle_days: isNaN(serviceCycle) ? 180 : serviceCycle,
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            errors.push(`Row ${i + 2} (${productName}): ${result.error || 'Unknown error'}`);
          }
        } catch (err: any) {
          failCount++;
          errors.push(`Row ${i + 2} (${productName}): ${err?.message || 'Unknown error'}`);
        }
      }

      await refreshData();

      if (failCount === 0) {
        setMessage({ type: 'success', text: `✅ Badha ${successCount} products successfully import thaya!` });
      } else {
        setMessage({
          type: 'error',
          text: `⚠️ ${successCount} success, ${failCount} fail. ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ' ...' : ''}`
        });
      }
    } catch (err) {
      console.error('Excel import error:', err);
      setMessage({ type: 'error', text: '❌ Excel file read karvama error aavyo.' });
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
        product_id: 'PROD001',
        product_name: 'Tank Testing Kit',
        product_type: 'Testing Equipment',
        manufacturer: 'Tank Corp',
        warranty_period_months: 12,
        default_service_cycle_days: 180,
      },
      {
        product_id: 'PROD002',
        product_name: 'Pressure Gauge',
        product_type: 'Instrument',
        manufacturer: 'Gauge Ltd',
        warranty_period_months: 24,
        default_service_cycle_days: 365,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'sample_products.xlsx');
  };

  if (loading && products.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading product data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800">Product Master</h1>

        {/* Excel Import Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadSampleExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs sm:text-sm font-medium"
          >
            📥 <span>Sample</span>
          </button>

          <label className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium cursor-pointer ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {importing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {importProgress.total > 0
                  ? `${importProgress.current}/${importProgress.total}`
                  : 'Importing...'}
              </>
            ) : (
              <>📤 <span>Import</span></>
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

      {message && (
        <div className={`p-3 rounded-lg text-sm break-words ${
          message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Excel Format Hint */}
      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 break-words">
        <strong>Excel Format:</strong> Columns — <code className="bg-blue-100 px-1 rounded">product_id</code>, <code className="bg-blue-100 px-1 rounded">product_name</code>, <code className="bg-blue-100 px-1 rounded">product_type</code>, <code className="bg-blue-100 px-1 rounded">manufacturer</code>, <code className="bg-blue-100 px-1 rounded">warranty_period_months</code>, <code className="bg-blue-100 px-1 rounded">default_service_cycle_days</code>
      </div>

      <Card title={isEditing ? 'Edit Product' : 'Add New Product'} className="!p-4 md:!p-6">
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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

          <div className="md:col-span-3 flex flex-col sm:flex-row sm:justify-end gap-3">
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

      <Card title="Product List" className="!p-4 md:!p-6">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {paginatedProducts.length > 0 ? (
            paginatedProducts.map((product) => (
              <div key={product.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      ID: {product.product_id}
                    </div>
                  </div>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                    {product.assignments?.length || 0} assign
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <div className="text-gray-400 font-medium uppercase">Type</div>
                    <div className="text-gray-700 font-semibold truncate">{product.product_type}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 font-medium uppercase">Warranty</div>
                    <div className="text-gray-700 font-semibold">{product.warranty_period_months} months</div>
                  </div>
                  {product.manufacturer && (
                    <div className="col-span-2">
                      <div className="text-gray-400 font-medium uppercase">Manufacturer</div>
                      <div className="text-gray-700 font-semibold truncate">{product.manufacturer}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(product)}
                    disabled={deletingId === product.id || operationLoading}
                    className="flex-1 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id || operationLoading}
                    className="flex-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
                  >
                    {deletingId === product.id ? (
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
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              No products found. Add your first product above.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {products && products.length > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 text-xs md:text-sm text-gray-500">
              <span>
                Showing <span className="font-semibold text-gray-700">{rangeStart}</span>–
                <span className="font-semibold text-gray-700">{rangeEnd}</span> of{' '}
                <span className="font-semibold text-gray-700">{products.length}</span>
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

export default ProductMaster;