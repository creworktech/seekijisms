import React, { useRef } from 'react';
import { formatDate } from '../../utils/formatters';

export default function TestReportModal({ job, isOpen, onClose }) {
  const printRef = useRef(null);

  if (!isOpen || !job) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Grab all active document stylesheet links and inline style blocks (Tailwind, Fonts, etc.)
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((s) => s.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Report #${job.token_no}</title>
          ${styleTags}
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            html, body { background: #ffffff !important; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; }
            .print-wrapper { width: 100%; max-width: 820px; margin: 0 auto; padding: 10px; box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* MODAL HEADER / TOOLBAR */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#005ea4] text-xl">description</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Job Test Report Sheet</h3>
              <p className="text-[11px] text-slate-500 font-mono">Token #{job.token_no}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="sk-btn sk-btn-primary cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Report Sheet
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE REPORT CONTENT AREA */}
        <div className="p-5 overflow-y-auto flex-1 text-slate-800 text-xs font-sans">
          <div ref={printRef} className="border-1.5 border-[#005ea4] p-6 rounded-lg bg-white shadow-xs">

            {/* COMPANY HEADER WITH LOGO TOP LEFT */}
            <div className="relative flex items-center justify-center pb-3 border-b-2 border-[#005ea4] mb-4 text-center min-h-[52px]">
              <img src="/images/logo.png" alt="Seekoji Logo" className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-auto object-contain" />
              <div>
                <h1 className="text-2xl font-black text-[#005ea4] uppercase tracking-wide m-0">Seekoji Electric Pvt. Ltd.</h1>
                <p className="text-xs text-slate-500 font-semibold mt-0.5 mb-0">www.seekojielectric.com</p>
              </div>
            </div>

            {/* REPORT TITLE BAR */}
            <div className="bg-slate-100 text-center py-1.5 font-extrabold text-sm uppercase tracking-wider text-slate-900 mb-4 rounded border border-slate-200">
              Test Report
            </div>

            {/* MAIN TEST REPORT GRID */}
            <div className="grid grid-cols-3 gap-5">

              {/* LEFT 2 COLUMNS: PRE-FILLED JOB DATA */}
              <div className="col-span-2 space-y-2">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700 w-36">SES No.</td>
                      <td className="py-1.5 font-mono font-bold text-[#005ea4]">#{job.token_no}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Date</td>
                      <td className="py-1.5 font-semibold text-slate-800">{formatDate(job.in_date || job.created_at)}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Customer ID / Name</td>
                      <td className="py-1.5 font-semibold text-slate-900">
                        {job.customer?.customer_code ? `${job.customer.customer_code} - ` : ''}{job.customer?.name || 'Walk-in'}
                      </td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Brand</td>
                      <td className="py-1.5 font-semibold text-slate-800">{job.brand || 'N/A'}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Power Rating</td>
                      <td className="py-1.5 font-semibold text-slate-800">{job.power_rating || 'N/A'}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Product Name</td>
                      <td className="py-1.5 font-bold text-slate-900">{job.product_name}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Serial NO.</td>
                      <td className="py-1.5 font-mono font-semibold text-slate-800">{job.serial_no || 'N/A'}</td>
                    </tr>

                    <tr className="border-b border-dashed border-slate-200">
                      <td className="py-1.5 font-bold text-slate-700">Fault Description</td>
                      <td className="py-1.5 text-slate-800 italic">"{job.fault_description || 'N/A'}"</td>
                    </tr>
                  </tbody>
                </table>

                {/* TESTER REMARK BOX (EMPTY SHADED BOX) */}
                <div className="mt-3 pt-1">
                  <div className="font-extrabold text-[11px] text-slate-900 mb-1">Tester Remark</div>
                  <div className="border border-slate-300 rounded bg-slate-50 h-24 p-2 text-slate-400 italic">

                  </div>
                  <div className="text-right mt-2 text-slate-500 font-bold text-[10px]">
                    Signature ____________________
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: BLANK TESTING CHECKMARKS */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 text-[11px] uppercase tracking-wider">
                  Testing Checklist
                </div>

                {[
                  'Phase Missing',
                  'No Power',
                  'No Output',
                  'Short',
                  'Not Running',
                  'On/Off',
                  'Motor Vibrate'
                ].map((item) => (
                  <div key={item} className="flex items-center justify-between text-[11px] font-semibold text-slate-700 py-0.5">
                    <span>• {item}</span>
                    <span className="w-7 h-4 border-1.5 border-slate-400 rounded-full inline-block bg-white shadow-2xs"></span>
                  </div>
                ))}
              </div>

            </div>

            {/* SERVICE SECTION (EMPTY FOR HAND-WRITING) */}
            <div className="mt-5 pt-2 border-t border-slate-300">
              <div className="bg-slate-100 text-center py-1.5 font-bold text-xs uppercase tracking-wider text-slate-900 rounded border border-slate-200 mb-3.5">
                Service
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold text-slate-700">Work Done:</span>
                    <span className="border-b border-slate-400 flex-1 h-5 inline-block"></span>
                    <span className="font-bold text-slate-700">Date:</span>
                    <span className="border-b border-slate-400 w-28 h-5 inline-block"></span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold text-slate-700">Note:</span>
                    <span className="border-b border-slate-400 flex-1 h-5 inline-block"></span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-700 text-[11px] mb-1">Technician Remark</div>
                    <div className="border border-slate-300 rounded bg-slate-50 h-20 p-2 text-slate-400 italic">

                    </div>
                  </div>
                </div>

                {/* SERVICE CHECKMARKS & SIGNATURE */}
                <div className="bg-slate-50/80 border border-slate-200 rounded p-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {['Done', 'Pending', 'Reject'].map((item) => (
                      <div key={item} className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                        <span>• {item}</span>
                        <span className="w-7 h-4 border-1.5 border-slate-400 rounded-full inline-block bg-white"></span>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-500 pt-2 border-t border-slate-200">
                    Signature ____________
                  </div>
                </div>
              </div>
            </div>

            {/* FOR OFFICE WORK SECTION */}
            <div className="mt-5 pt-2 border-t border-slate-300">
              <div className="bg-slate-100 text-center py-1.5 font-bold text-xs uppercase tracking-wider text-slate-900 rounded border border-slate-200 mb-3.5">
                For Office Work
              </div>

              <div className="grid grid-cols-2 gap-5 text-xs">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 w-32">Customer Number:</span>
                    <span className="border-b border-slate-400 flex-1 h-5 inline-block"></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 w-32">Assign To:</span>
                    <span className="border-b border-slate-400 flex-1 h-5 inline-block"></span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">• Customer Approval</span>
                    <span className="w-7 h-4 border-1.5 border-slate-400 rounded-full inline-block bg-white"></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">• Amount:</span>
                    <span className="border-b border-slate-400 flex-1 h-5 inline-block"></span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
