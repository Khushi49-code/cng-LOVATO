import React, { useState, useEffect } from "react";
import { useUnifiedData } from "../../contexts/UnifiedDataContext";
import { COLLECTIONS } from "../../types";
import { formatDate } from "../../lib/utils";
import Card from "../common/Card";
import Button from "../common/Button";

const AdminDashboard: React.FC = () => {
  const { reminders, stats, meta, updateItem, loading, refreshData } = useUnifiedData();

  const [filterDays, setFilterDays] = useState<number>(30);
  
  // ── Pagination State ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // ── Auto-refresh on mount / when page becomes visible again ───
  useEffect(() => {
    refreshData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WhatsApp Message Send (Gujarati) ───────────────────────────
  const sendWhatsAppReminder = (customerName: string, vehicleNumber: string, expiryDate: string, productName: string) => {
    const message = `પ્રિય ${customerName},

તમારી ${productName} (વાહન નંબર: ${vehicleNumber}) ની વોરંટી ${formatDate(expiryDate)} ના રોજ સમાપ્ત થાય છે.

કૃપા કરીને નવીકરણ (renewal) અથવા સર્વિસ માટે અમારી મુલાકાત લો.

આભાર,
Tank Testing Plant`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // ── Send Reminder with Database Update ──────────────────────
  const handleSendReminder = async (mappingId: string, customerName: string, vehicleNumber: string, expiryDate: string, productName: string) => {
    if (window.confirm(`Send WhatsApp reminder to ${customerName}?`)) {
      try {
        const result = await updateItem(COLLECTIONS.MAPPINGS, mappingId, {
          "reminder_status.renewal_sent": true,
          "reminder_status.whatsapp_sent": true,
          "reminder_status.sent_at": new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (result.success) {
          sendWhatsAppReminder(customerName, vehicleNumber, expiryDate, productName);
          alert(`✅ WhatsApp reminder sent successfully to ${customerName}`);
          await refreshData();
          alert(`📊 Data refreshed successfully!`);
        } else {
          alert("❌ Error updating reminder status");
        }
      } catch (error) {
        console.error("Error sending reminder:", error);
        alert("❌ Error sending reminder");
      }
    }
  };

  // ── Reset to page 1 when filter changes ──────────────────────
  const handleFilterChange = (days: number) => {
    setFilterDays(days);
    setCurrentPage(1);
  };

  // ✅ Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6 px-4 md:px-0">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800">
          Admin Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-xl shadow-lg animate-pulse"
            >
              <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 bg-gray-100 rounded animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Filter Reminders ───────────────────────────────────────────
  const filteredReminders = reminders.filter(
    (reminder) => reminder.days_until_expiry <= filterDays
  );

  // ── Pagination Logic ───────────────────────────────────────────
  const totalItems = filteredReminders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReminders = filteredReminders.slice(indexOfFirstItem, indexOfLastItem);

  // ── Page Navigation ────────────────────────────────────────────
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // ── Generate Page Numbers ─────────────────────────────────────
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(currentPage - halfVisible, 1);
      let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);

      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(endPage - maxVisiblePages + 1, 1);
      }

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  return (
    <div className="space-y-6 px-4 md:px-0">
      <h1 className="text-xl md:text-3xl font-bold text-gray-800">
        Admin Dashboard
      </h1>

      {!meta.isOnline && (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg border border-yellow-300">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>You are offline. Showing cached data.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {stats.totalCustomers}
          </div>
          <div className="text-gray-600">Total Customers</div>
        </Card>

        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {stats.totalAssignments}
          </div>
          <div className="text-gray-600">Active Warranties</div>
        </Card>

        <Card className="text-center">
          <div className="text-3xl font-bold text-red-600">
            {stats.expiringThisWeek}
          </div>
          <div className="text-gray-600">Expiring This Week</div>
        </Card>

        <Card className="text-center">
          <div className="text-3xl font-bold text-purple-600">
            {stats.pendingServices}
          </div>
          <div className="text-gray-600">Pending Services</div>
        </Card>
      </div>

      <Card title="Warranty Expiry Reminders">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold">
            Reminders for next {filterDays} days
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredReminders.length} reminders)
            </span>
          </h3>

          <div className="flex space-x-2">
            <Button
              onClick={() => handleFilterChange(7)}
              color={filterDays === 7 ? "blue" : "gray"}
              className="text-xs"
            >
              7 Days
            </Button>

            <Button
              onClick={() => handleFilterChange(15)}
              color={filterDays === 15 ? "blue" : "gray"}
              className="text-xs"
            >
              15 Days
            </Button>

            <Button
              onClick={() => handleFilterChange(30)}
              color={filterDays === 30 ? "blue" : "gray"}
              className="text-xs"
            >
              30 Days
            </Button>
          </div>
        </div>

        {filteredReminders.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No warranties expiring in the next {filterDays} days
          </div>
        ) : (
          <>
            {/* ── Table ─────────────────────────────────────────── */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Expiry Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Days Left
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {currentReminders.map((reminder) => (
                    <tr key={reminder.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>{reminder.customer_name}</div>
                        <div className="text-xs text-gray-500">
                          {reminder.vehicle_number}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {reminder.product_name}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(reminder.expiry_date)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            reminder.days_until_expiry <= 1
                              ? "bg-red-100 text-red-800"
                              : reminder.days_until_expiry <= 7
                              ? "bg-orange-100 text-orange-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {reminder.days_until_expiry} days
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {reminder.reminder_to_send ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Reminder due
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            Monitoring
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <Button
                          onClick={() =>
                            handleSendReminder(
                              reminder.id,
                              reminder.customer_name,
                              reminder.vehicle_number,
                              reminder.expiry_date,
                              reminder.product_name
                            )
                          }
                          color="blue"
                          className="text-xs py-1 px-2 flex items-center gap-1"
                          disabled={!meta.isOnline}
                        >
                          <svg 
                            className="w-4 h-4" 
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          {meta.isOnline ? "Send Reminder" : "Offline"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination Controls ──────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
                {/* Info: Showing X to Y of Z */}
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, totalItems)}
                  </span>{' '}
                  of <span className="font-medium">{totalItems}</span> reminders
                </div>

                {/* Pagination Buttons */}
                <div className="flex items-center gap-1">
                  {/* Previous Button */}
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md border ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((page, index) => (
                    <button
                      key={index}
                      onClick={() => typeof page === 'number' && goToPage(page)}
                      className={`px-3 py-1 rounded-md border ${
                        page === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : typeof page === 'number'
                          ? 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                          : 'bg-white text-gray-700 border-transparent cursor-default'
                      }`}
                      disabled={typeof page !== 'number'}
                    >
                      {page}
                    </button>
                  ))}

                  {/* Next Button */}
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md border ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Page Info (Mobile) */}
                <div className="text-xs text-gray-500 sm:hidden">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;