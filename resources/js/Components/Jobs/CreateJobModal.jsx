import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ConfirmActionModal from '../Common/ConfirmActionModal';
import CreateCustomerModal from '../Customers/CreateCustomerModal';
import { generateWhatsAppMessage, openWhatsApp } from '../../utils/WhatsAppHelper';
import { notifySuccess, notifyError } from '../../utils/toast';

const createDefaultProduct = (idx = 1) => ({
  id: Date.now() + Math.random(),
  product_name: '',
  brand: '',
  serial_no: '',
  power_rating: '',
  fault_description: '',
  customer_remark: '',
  priority: 'medium',
});

export default function CreateJobModal({ isOpen, onClose, onSuccess, tokenPreview, sanctumToken }) {
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [initialCustomerName, setInitialCustomerName] = useState('');

  const [receivedFrom, setReceivedFrom] = useState('self');
  const [inDate, setInDate] = useState(new Date().toISOString().split('T')[0]);
  const [globalPriority, setGlobalPriority] = useState('medium');
  const [productsList, setProductsList] = useState([createDefaultProduct(1)]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  const [tokenInfo, setTokenInfo] = useState({ prefix: 'SES', next_val: 1 });
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const fetchTokenPreview = async () => {
    setRefreshingToken(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.get('/api/v1/jobs/token-preview', { headers });
      if (res.data?.prefix && res.data?.next_val) {
        setTokenInfo({
          prefix: res.data.prefix,
          next_val: Number(res.data.next_val),
        });
      }
    } catch (err) {
      console.error('Failed to fetch token preview:', err);
    } finally {
      setRefreshingToken(false);
    }
  };

  // The modal never unmounts when closed (it just renders null), so its
  // state would otherwise survive across opens — a submitted or cancelled
  // form would still be sitting there filled in the next time it's opened.
  const resetForm = () => {
    setSelectedCustomerObj(null);
    setCustomerSearch('');
    setCustomerOptions([]);
    setIsSearchFocused(false);
    setReceivedFrom('self');
    setInDate(new Date().toISOString().split('T')[0]);
    setGlobalPriority('medium');
    setProductsList([createDefaultProduct(1)]);
    setErrors({});
    setShowConfirm(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchTokenPreview();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      searchCustomers(customerSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch, isOpen]);

  const getTokenForIndex = (index) => {
    const startVal = tokenInfo.next_val || 1;
    const prefix = tokenInfo.prefix || 'SES';
    return `${prefix}${startVal + index}`;
  };

  const searchCustomers = async (query = '') => {
    setSearchingCustomer(true);
    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.get(`/api/v1/customers?search=${encodeURIComponent(query)}&per_page=15`, { headers });
      setCustomerOptions(res.data?.data || []);
    } catch (err) {
      try {
        const resWeb = await axios.get(`/customers/search?search=${encodeURIComponent(query)}&per_page=15`);
        setCustomerOptions(resWeb.data?.data || []);
      } catch (webErr) {
        console.error('Failed to search customers:', webErr);
      }
    } finally {
      setSearchingCustomer(false);
    }
  };

  if (!isOpen) return null;

  // Add Dynamic Product (Up to 20)
  const handleAddProduct = () => {
    if (productsList.length >= 20) {
      notifyError('Maximum limit of 20 products reached per intake session.');
      return;
    }
    setProductsList((prev) => [...prev, createDefaultProduct(prev.length + 1)]);
  };

  // Remove Dynamic Product
  const handleRemoveProduct = (id) => {
    if (productsList.length <= 1) return;
    setProductsList((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle Product Field Change
  const handleProductChange = (id, field, value) => {
    setProductsList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomerObj) {
      setErrors({ customer_id: ['Please search and select a customer.'] });
      return;
    }

    // Validate that every product has a Product Name
    const newErrors = {};
    productsList.forEach((p, idx) => {
      if (!p.product_name || !p.product_name.trim()) {
        newErrors[`products.${idx}.product_name`] = `Product #${idx + 1} Name is required.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notifyError('Please fill in required Product Name for all items.');
      return;
    }

    setErrors({});
    setShowConfirm(true);
  };

  const executeJobCreation = async (withWhatsApp = false) => {
    setLoading(true);
    setErrors({});
    setShowConfirm(false);

    const payload = {
      customer_id: selectedCustomerObj.id,
      received_from: receivedFrom || 'self',
      in_date: inDate || new Date().toISOString().split('T')[0],
      products: productsList.map((p) => ({
        product_name: p.product_name.trim(),
        brand: p.brand?.trim() || null,
        serial_no: p.serial_no?.trim() || null,
        power_rating: p.power_rating?.trim() || null,
        fault_description: p.fault_description?.trim() || 'Initial inspection requested',
        customer_remark: p.customer_remark?.trim() || null,
        received_from: receivedFrom || 'self',
        priority: p.priority || 'medium',
      })),
      send_whatsapp: Boolean(withWhatsApp === true),
    };

    try {
      const headers = sanctumToken ? { Authorization: `Bearer ${sanctumToken}` } : {};
      const res = await axios.post('/api/v1/jobs', payload, { headers });
      setLoading(false);

      if (res && res.data) {
        const createdTokens = res.data?.tokens || [];
        const count = res.data?.count || productsList.length;
        const tokensStr = createdTokens.length > 0 ? createdTokens.map(t => '#' + t).join(', ') : '';

        // Send Summary WhatsApp Message if requested
        if (withWhatsApp === true && selectedCustomerObj?.mobile) {
          const productSummaryLines = productsList.map((p, i) => {
            const tok = createdTokens[i] ? `#${createdTokens[i]}` : '';
            return `• ${p.product_name} (${tok})`;
          }).join('\n');

          const msg = `Dear ${selectedCustomerObj.name},\n\nYour ${count} repair work orders have been registered successfully at Seekoji Electric.\n\nRegistered Products:\n${productSummaryLines}\n\nThank you for choosing Seekoji Electric!`;
          openWhatsApp({ mobile: selectedCustomerObj.mobile, message: msg });
        }

        notifySuccess(res.data?.message || `${count} Work Orders created successfully! (${tokensStr})`);
        onSuccess(res.data?.message || 'Jobs created successfully');
        onClose();
      }
    } catch (err) {
      setLoading(false);
      let errMsg = err.response?.data?.message || err.message;

      if (err.response?.status === 422 && err.response?.data?.errors) {
        const errorList = Object.values(err.response.data.errors).flat();
        if (errorList.length > 0) {
          errMsg = errorList.join(' ');
        }
        setErrors(err.response.data.errors);
      } else {
        setErrors({ general: errMsg || 'Failed to create work orders.' });
      }

      notifyError(errMsg || 'Failed to create work orders. Please check fields.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-4xl rounded-3xl bg-white border border-[#E5E5E5] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-[#0B0B0B]"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#f9f9f7]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#005ea4] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">bolt</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#0B0B0B]">
                  New Service Job Intake (Multi-Product)
                </h3>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <p className="text-xs text-[#666666]">
                    Adding {productsList.length} {productsList.length === 1 ? 'Product' : 'Products'}
                  </p>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#005ea4] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                    <span className="material-symbols-outlined text-xs">tag</span>
                    Tokens: #{getTokenForIndex(0)}
                    {productsList.length > 1 && ` to #${getTokenForIndex(productsList.length - 1)}`}
                  </span>
                  <button
                    type="button"
                    onClick={fetchTokenPreview}
                    disabled={refreshingToken}
                    className="p-1 text-slate-400 hover:text-[#005ea4] transition-colors cursor-pointer"
                    title="Sync Latest Token Counter"
                  >
                    <span className={`material-symbols-outlined text-sm ${refreshingToken ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-200 text-[#666666] flex items-center justify-center transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 thin-sb text-xs bg-[#f9f9f7]">

            {/* STEP 1: CUSTOMER SELECTION & INTAKE META */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E5E5] shadow-2xs space-y-4">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-3">
                <label className="font-bold uppercase tracking-wider text-[#666666] text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#005ea4]">person</span>
                  1. Customer Details *
                </label>

                <div className="flex items-center gap-2">
                  {selectedCustomerObj && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Selected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setInitialCustomerName(customerSearch || '');
                      setIsCreateCustomerOpen(true);
                    }}
                    className="text-xs text-[#005ea4] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>+ Create New Customer</span>
                  </button>
                </div>
              </div>

              {selectedCustomerObj ? (
                <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#005ea4] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#005ea4] text-white flex items-center justify-center font-bold text-sm">
                      {selectedCustomerObj.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0B0B0B]">{selectedCustomerObj.name}</p>
                      <p className="text-xs text-[#666666] font-mono">
                        ID: #{selectedCustomerObj.customer_code} • Mobile: {selectedCustomerObj.mobile}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerObj(null);
                      setCustomerSearch('');
                    }}
                    className="px-3 py-1.5 text-xs text-[#D03B3B] hover:bg-rose-50 rounded-lg border border-rose-200 font-bold transition-colors cursor-pointer"
                  >
                    Change Customer
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717783] text-base pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search customer by name, mobile number or customer code..."
                    value={customerSearch}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setIsSearchFocused(true);
                    }}
                    className="w-full pl-11 pr-10 py-2.5 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold outline-none focus:border-[#005ea4]"
                  />

                  {searchingCustomer && (
                    <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-[#005ea4] text-base animate-spin pointer-events-none">
                      sync
                    </span>
                  )}

                  {/* Dropdown Options */}
                  {(isSearchFocused || customerSearch.length > 0) && (() => {
                    const filteredCustomerOptions = customerOptions.filter((cust) => {
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase().trim();
                      return (
                        cust.name?.toLowerCase().includes(q) ||
                        cust.mobile?.toLowerCase().includes(q) ||
                        cust.customer_code?.toLowerCase().includes(q)
                      );
                    });

                    return (
                      <div className="absolute left-0 right-0 top-12 z-30 max-h-64 overflow-y-auto rounded-xl bg-white border border-[#E5E5E5] shadow-2xl divide-y divide-[#E5E5E5]">
                        {searchingCustomer ? (
                          <div className="p-3.5 text-center text-[#666666] text-xs font-medium flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm animate-spin text-[#005ea4]">sync</span>
                            Searching customer database...
                          </div>
                        ) : filteredCustomerOptions.length > 0 ? (
                          filteredCustomerOptions.map((cust) => (
                            <div
                              key={cust.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedCustomerObj(cust);
                                setIsSearchFocused(false);
                                setCustomerSearch('');
                                setErrors({ ...errors, customer_id: null });
                              }}
                              className="p-3 hover:bg-[#F0F7FF] cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div>
                                <span className="font-bold text-[#0B0B0B]">{cust.name}</span>
                                <span className="text-[#666666] ml-2 font-mono">({cust.mobile})</span>
                              </div>
                              <span className="sk-tok font-mono">#{cust.customer_code}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center space-y-2.5">
                            <p className="text-xs text-[#666666]">
                              No matching customer found {customerSearch ? `for "${customerSearch}"` : ''}.
                            </p>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setInitialCustomerName(customerSearch || '');
                                setIsCreateCustomerOpen(true);
                              }}
                              className="px-4 py-2 bg-[#005ea4] hover:bg-[#004278] text-white font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-base">person_add</span>
                              <span>+ Create New Customer {customerSearch ? `"${customerSearch}"` : ''}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              {errors.customer_id && <p className="text-rose-600 text-xs font-bold mt-1">{errors.customer_id[0] || errors.customer_id}</p>}

              {/* Global Intake Defaults */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E5E5E5]">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-[#666666] text-[10px] mb-1">
                    Received Through
                  </label>
                  <select
                    value={receivedFrom}
                    onChange={(e) => setReceivedFrom(e.target.value)}
                    className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                  >
                    <option value="self">Handover (Self)</option>
                    <option value="courier">Courier / Express</option>
                    <option value="bus">Bus Transport</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[#666666] text-[10px] mb-1">
                    Received Date
                  </label>
                  <input
                    type="date"
                    value={inDate}
                    onChange={(e) => setInDate(e.target.value)}
                    className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-[#666666] text-[10px] mb-1">
                    Intake Priority
                  </label>
                  <select
                    value={globalPriority}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGlobalPriority(val);
                      setProductsList((prev) => prev.map((p) => ({ ...p, priority: val })));
                    }}
                    className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                  >
                    <option value="medium">Normal / Medium</option>
                    <option value="high">High Priority (Urgent)</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 2: DYNAMIC PRODUCT ENTRIES (UP TO 20 PRODUCTS) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="font-bold uppercase tracking-wider text-[#666666] text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#005ea4]">inventory_2</span>
                  2. Product Details ({productsList.length} {productsList.length === 1 ? 'Product' : 'Products'})
                </label>
                <span className="text-[11px] font-bold text-[#666666]">
                  Add up to 20 products at a time
                </span>
              </div>

              {/* PRODUCT CARDS LIST */}
              {productsList.map((product, index) => {
                const nameErrKey = `products.${index}.product_name`;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-2xs space-y-4 relative group"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-center border-b border-[#E5E5E5] pb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#005ea4] text-white flex items-center justify-center text-xs font-black">
                            #{index + 1}
                          </span>
                          <span className="font-bold text-xs uppercase tracking-wider text-[#0B0B0B]">
                            Product Entry #{index + 1}
                          </span>
                        </div>

                        {/* PRE-ASSIGNED TOKEN BADGE */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                          <span className="material-symbols-outlined text-sm text-amber-700">label</span>
                          <span className="text-[11px] font-bold text-amber-900 font-mono">
                            Token: #{getTokenForIndex(index)}
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium hidden sm:inline">
                            (Write on product tag)
                          </span>
                        </div>
                      </div>

                      {productsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(product.id)}
                          className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                          title="Remove Product Entry"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Left Column: Specs */}
                      <div className="space-y-3">
                        <div>
                          <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. ABB ACS580 Drive, Submersible Pump..."
                            value={product.product_name}
                            onChange={(e) => handleProductChange(product.id, 'product_name', e.target.value)}
                            className={`w-full py-2 px-3 bg-[#f9f9f7] border rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4] ${errors[nameErrKey] ? 'border-rose-500 bg-rose-50/30' : 'border-[#E5E5E5]'
                              }`}
                          />
                          {errors[nameErrKey] && (
                            <p className="text-rose-600 text-[10px] font-bold mt-1">{errors[nameErrKey]}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                              Serial Number
                            </label>
                            <input
                              type="text"
                              placeholder="Found on product sticker"
                              value={product.serial_no}
                              onChange={(e) => handleProductChange(product.id, 'serial_no', e.target.value)}
                              className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                            />
                          </div>

                          <div>
                            <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                              Power (kW/HP)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 7.5 kW"
                              value={product.power_rating}
                              onChange={(e) => handleProductChange(product.id, 'power_rating', e.target.value)}
                              className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                              Brand / Make
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Microtek, Luminous, ABB"
                              value={product.brand}
                              onChange={(e) => handleProductChange(product.id, 'brand', e.target.value)}
                              className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                            />
                          </div>

                          <div>
                            <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                              Priority
                            </label>
                            <select
                              value={product.priority || 'medium'}
                              onChange={(e) => handleProductChange(product.id, 'priority', e.target.value)}
                              className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#0B0B0B] outline-none focus:border-[#005ea4]"
                            >
                              <option value="medium">Medium</option>
                              <option value="high">High (Urgent)</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Fault & Remarks */}
                      <div className="space-y-3">
                        <div>
                          <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                            Fault Description
                          </label>
                          <textarea
                            rows="3"
                            placeholder="Describe the visible issues reported by customer..."
                            value={product.fault_description}
                            onChange={(e) => handleProductChange(product.id, 'fault_description', e.target.value)}
                            className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4] resize-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold uppercase text-[#666666] text-[10px] mb-1">
                            Customer Remark
                          </label>
                          <textarea
                            rows="2"
                            placeholder="Any special instructions from customer..."
                            value={product.customer_remark}
                            onChange={(e) => handleProductChange(product.id, 'customer_remark', e.target.value)}
                            className="w-full py-2 px-3 bg-[#f9f9f7] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#0B0B0B] outline-none focus:border-[#005ea4] resize-none"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}

              {/* ADD MORE PRODUCTS BUTTON (UP TO 20) */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={productsList.length >= 20}
                  onClick={handleAddProduct}
                  className={`px-5 py-2.5 rounded-xl border-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${productsList.length >= 20
                      ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-[#005ea4] text-[#005ea4] bg-blue-50/50 hover:bg-[#005ea4] hover:text-white shadow-2xs'
                    }`}
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>+ Add More Products</span>
                </button>

                <span className="text-xs text-[#666666] font-medium">
                  Add up to 20 products at a time ({productsList.length} / 20 added)
                </span>
              </div>
            </div>

            {/* CONFIRMATION DIALOG FOR MULTI-JOB REGISTRATION */}
            {showConfirm && (
              <ConfirmActionModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={() => executeJobCreation(false)}
                onConfirmWhatsApp={() => executeJobCreation(true)}
                title={`Register ${productsList.length} Work ${productsList.length === 1 ? 'Order' : 'Orders'}?`}
                description={`Are you sure you want to register ${productsList.length} work order intake(s) for customer "${selectedCustomerObj?.name}"?`}
                customerName={selectedCustomerObj?.name}
                customerMobile={selectedCustomerObj?.mobile}
              />
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#E5E5E5] flex justify-end gap-3 bg-white -mx-6 -mb-6 p-6">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#E5E5E5] text-[#0B0B0B] hover:bg-gray-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#005ea4] hover:bg-[#004278] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
                  {loading ? 'sync' : 'save'}
                </span>
                <span>
                  {loading
                    ? 'Registering Work Order...'
                    : `Add Product (${productsList.length} ${productsList.length === 1 ? 'Item' : 'Items'})`}
                </span>
              </button>
            </div>

          </form>

          {/* NESTED CREATE CUSTOMER MODAL */}
          {isCreateCustomerOpen && (
            <CreateCustomerModal
              isOpen={isCreateCustomerOpen}
              onClose={() => setIsCreateCustomerOpen(false)}
              onSuccess={(msg, newCust) => {
                if (newCust) {
                  setSelectedCustomerObj(newCust);
                  setCustomerSearch('');
                  setIsSearchFocused(false);
                  setErrors({ ...errors, customer_id: null });
                }
                setIsCreateCustomerOpen(false);
              }}
              sanctumToken={sanctumToken}
              initialName={initialCustomerName}
            />
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
