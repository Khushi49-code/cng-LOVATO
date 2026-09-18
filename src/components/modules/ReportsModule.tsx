import React, { useState, useEffect, useMemo } from 'react';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';
import * as XLSX from 'xlsx/xlsx.mjs';
import { formatDate } from '../../lib/utils';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ReportsModule: React.FC = () => {
  const { 
    customers,
    assignments,
    services,
    stats,
    loading,
    meta
  } = useUnifiedData();
  
  const [reportType, setReportType] = useState<'customerReport' | 'serviceReport' | 'warrantyReport'>('customerReport');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const exportToExcel = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    
    setIsExporting(true);
    
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      alert('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel');
    } finally {
      setIsExporting(false);
    }
  };
  
  const getCustomerReportData = () => {
    if (selectedCustomer) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (!customer) return [];
      
      return [{
        'Customer ID': customer.id,
        'Customer Name': `${customer.first_name} ${customer.last_name}`,
        'Mobile Number': customer.mobile_number,
        'Vehicle Number': customer.vehicle_number,
        'Vehicle Model': customer.vehicle_model,
        'Total Products': customer.products?.length || 0,
        'Total Services': customer.services?.length || 0,
        'City': customer.city || 'N/A',
        'State': customer.state || 'N/A',
        'Address': customer.address || 'N/A'
      }];
    }
    
    return customers.map(customer => ({
      'Customer ID': customer.id,
      'Customer Name': `${customer.first_name} ${customer.last_name}`,
      'Mobile Number': customer.mobile_number,
      'Vehicle Number': customer.vehicle_number,
      'Total Products': customer.products?.length || 0,
      'Total Services': customer.services?.length || 0,
      'City': customer.city || 'N/A',
      'State': customer.state || 'N/A'
    }));
  };
  
  const getServiceReportData = () => {
    const filteredServices = services.filter(service => {
      const serviceDate = new Date(service.service_date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return serviceDate >= start && serviceDate <= end;
    });
    
    return filteredServices.map(service => ({
      'Service ID': service.id,
      'Service Date': formatDate(service.service_date),
      'Customer Name': service.customer_name,
      'Vehicle Number': service.vehicle_number,
      'Product Name': service.product_name,
      'Service Type': service.service_type,
      'Service Status': service.service_status,
      'Service Notes': service.service_notes || 'N/A',
      'Next Service Date': formatDate(service.next_service_date || '')
    }));
  };
  
  const getWarrantyReportData = () => {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);
    
    return assignments
      .filter(assignment => {
        if (!assignment.warranty_expiry_date) return false;
        const expiryDate = new Date(assignment.warranty_expiry_date);
        return expiryDate >= today && expiryDate <= next30Days;
      })
      .map(assignment => ({
        'Customer Name': assignment.customer_name,
        'Mobile Number': assignment.mobile_number,
        'Vehicle Number': assignment.vehicle_number,
        'Product Name': assignment.product_name,
        'Purchase Date': formatDate(assignment.product_purchase_date),
        'Warranty Period': `${assignment.product_warranty_period} months`,
        'Expiry Date': formatDate(assignment.warranty_expiry_date),
        'Days Left': assignment.days_until_expiry,
        'Status': assignment.is_expired ? 'Expired' : 'Active'
      }));
  };
  
  const getReportData = () => {
    switch (reportType) {
      case 'customerReport':
        return getCustomerReportData();
      case 'serviceReport':
        return getServiceReportData();
      case 'warrantyReport':
        return getWarrantyReportData();
      default:
        return [];
    }
  };
  
  const getReportTitle = () => {
    switch (reportType) {
      case 'customerReport':
        return selectedCustomer ? 'Customer Detail Report' : 'Customer Summary Report';
      case 'serviceReport':
        return 'Service History Report';
      case 'warrantyReport':
        return 'Warranty Expiry Report';
      default:
        return 'Report';
    }
  };
  
  const customerOptions = customers.map(c => ({
    value: c.id,
    label: `${c.first_name} ${c.last_name} (${c.vehicle_number})`
  }));
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading report data...</p>
      </div>
    );
  }
  
  const reportData = getReportData();

  const totalPages = Math.max(1, Math.ceil(reportData.length / pageSize));

  // Reset to page 1 whenever the report changes shape (type, customer, date range, page size)
  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, selectedCustomer, startDate, endDate, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reportData.slice(start, start + pageSize);
  }, [reportData, currentPage, pageSize]);

  const rangeStart = reportData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, reportData.length);

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
  
  return (
    <div className="space-y-6 px-4 md:px-0">
      <h1 className="text-xl md:text-3xl font-bold text-gray-800">Reports Center</h1>
      
      {!meta.isOnline && (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-300">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>You are offline. Reports may not include latest data.</span>
          </div>
        </div>
      )}
      
      <Card title="Report Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-3">Report Type</h3>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reportType"
                  value="customerReport"
                  checked={reportType === 'customerReport'}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Customer Report</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reportType"
                  value="serviceReport"
                  checked={reportType === 'serviceReport'}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Service History Report</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reportType"
                  value="warrantyReport"
                  checked={reportType === 'warrantyReport'}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Warranty Expiry Report</span>
              </label>
            </div>
          </div>
          
          <div>
            {reportType === 'customerReport' && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Customer Selection</h3>
                <Select
                  label="Select Customer (Optional)"
                  name="selectedCustomer"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  options={[{ value: '', label: 'All Customers' }, ...customerOptions]}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Leave empty for all customers report
                </p>
              </div>
            )}
            
            {reportType === 'serviceReport' && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Date Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Date"
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    label="End Date"
                    name="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      <Card title={`${getReportTitle()} - ${reportData.length} Records`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">{getReportTitle()}</h3>
            <p className="text-sm text-gray-600">
              Generated on: {new Date().toLocaleDateString()}
            </p>
          </div>
          <Button
            onClick={() => exportToExcel(reportData, getReportTitle())}
            color="green"
            disabled={reportData.length === 0 || isExporting || !meta.isOnline}
          >
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
        </div>
        
        {reportData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No data found for the selected report criteria
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(reportData[0]).map((key, index) => (
                    <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {Object.values(row).map((value: any, colIndex) => (
                      <td key={colIndex} className="px-4 py-3 whitespace-nowrap text-sm">
                        {value || 'N/A'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>
                  Showing <span className="font-semibold text-gray-700">{rangeStart}</span>–
                  <span className="font-semibold text-gray-700">{rangeEnd}</span> of{' '}
                  <span className="font-semibold text-gray-700">{reportData.length}</span>
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
          </div>
        )}
      </Card>
      
      <Card title="Quick Statistics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCustomers}</div>
            <div className="text-sm text-gray-600">Total Customers</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.totalServices}</div>
            <div className="text-sm text-gray-600">Service Records</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.expiringThisMonth}</div>
            <div className="text-sm text-gray-600">Expiring This Month</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.pendingServices}</div>
            <div className="text-sm text-gray-600">Pending Services</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ReportsModule; // ✅ DEFAULT EXPORT