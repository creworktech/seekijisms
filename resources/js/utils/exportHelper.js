import { formatCurrency, formatDate } from './formatters';

function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) {
      resolve(window.html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('Failed to load html2pdf script'));
    document.body.appendChild(script);
  });
}

export function exportToCSV(jobs, filename = 'service_jobs_export.csv') {
  if (!jobs || jobs.length === 0) {
    alert('No job data available to export.');
    return;
  }

  const headers = [
    'Token No',
    'Customer Name',
    'Mobile',
    'Product Name',
    'Brand',
    'Serial No',
    'Power Rating',
    'Stage',
    'Outcome',
    'Priority',
    'Payable Amount (INR)',
    'In Date',
  ];

  const rows = jobs.map((job) => [
    `"${job.token_no || ''}"`,
    `"${(job.customer?.name || job.customer_name || '').replace(/"/g, '""')}"`,
    `"${job.customer?.mobile || job.customer_mobile || ''}"`,
    `"${(job.product_name || '').replace(/"/g, '""')}"`,
    `"${(job.brand || '').replace(/"/g, '""')}"`,
    `"${job.serial_no || ''}"`,
    `"${job.power_rating || ''}"`,
    `"${(job.stage || '').toUpperCase()}"`,
    `"${(job.outcome || '-').toUpperCase()}"`,
    `"${(job.priority || '').toUpperCase()}"`,
    `"${job.payable_amount || 0}"`,
    `"${job.in_date || formatDate(job.created_at)}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(jobs, title = 'Service Jobs Report', filename = 'service_jobs_report.pdf') {
  if (!jobs || jobs.length === 0) {
    alert('No job data available to export.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tableRows = jobs
    .map(
      (job, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">#${job.token_no}</td>
        <td style="padding: 6px 8px;">
          <strong>${job.product_name}</strong><br/>
          <span style="font-size: 10px; color: #64748b;">${job.brand || '-'} (SN: ${job.serial_no || '-'})</span>
        </td>
        <td style="padding: 6px 8px;">
          <strong>${job.customer?.name || job.customer_name || '-'}</strong><br/>
          <span style="font-size: 10px; color: #64748b;">${job.customer?.mobile || '-'}</span>
        </td>
        <td style="padding: 6px 8px; text-transform: uppercase; font-weight: bold; font-size: 10px;">${job.stage}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #005ea4;">₹${job.payable_amount || 0}</td>
        <td style="padding: 6px 8px; font-size: 10px; color: #64748b;">${formatDate(job.in_date || job.created_at)}</td>
      </tr>
    `
    )
    .join('');

  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Inter, sans-serif';
  container.style.color = '#0f172a';
  container.style.fontSize = '11px';

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #005ea4; padding-bottom: 10px; margin-bottom: 15px;">
      <div>
        <h1 style="margin: 0; color: #005ea4; font-size: 18px; font-weight: 800;">Seekoji Electric</h1>
        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px;">${title} • Total Records: ${jobs.length}</p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #64748b;">
        <p style="margin:0;">Generated: ${dateStr}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 9px; font-weight: 700;">
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center; width: 30px;">#</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 80px;">Token No</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Product Details</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Customer</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 90px;">Stage</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 90px;">Payable (₹)</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 80px;">In Date</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: right;">
      Seekoji Electric Service Management System
    </div>
  `;

  try {
    const html2pdf = await loadHtml2Pdf();
    const opt = {
      margin:       8,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    await html2pdf().set(opt).from(container).save();
  } catch (err) {
    // Fallback direct download
    const htmlBlob = new Blob([`<html><body>${container.innerHTML}</body></html>`], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(htmlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export function exportCustomersToCSV(customers, filename = 'customers_directory_export.csv') {
  if (!customers || customers.length === 0) {
    alert('No customer data available to export.');
    return;
  }

  const headers = [
    'Customer Code',
    'Full Name',
    'Mobile Number',
    'Address',
    'Status',
    'Registered On',
  ];

  const rows = customers.map((c) => [
    `"${c.customer_code || ''}"`,
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${c.mobile || ''}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    `"${c.is_active ? 'ACTIVE' : 'INACTIVE'}"`,
    `"${c.registered_on || formatDate(c.created_at)}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportCustomersToPDF(customers, title = 'Customer Directory Report', filename = 'customers_directory_report.pdf') {
  if (!customers || customers.length === 0) {
    alert('No customer data available to export.');
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tableRows = customers
    .map(
      (c, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">#${c.customer_code}</td>
        <td style="padding: 6px 8px;"><strong>${c.name}</strong></td>
        <td style="padding: 6px 8px; font-family: monospace;">${c.mobile || '-'}</td>
        <td style="padding: 6px 8px;">${c.address || '-'}</td>
        <td style="padding: 6px 8px; font-weight: bold; font-size: 10px; color: ${c.is_active ? '#047857' : '#b91c1c'};">${c.is_active ? 'ACTIVE' : 'INACTIVE'}</td>
        <td style="padding: 6px 8px; font-size: 10px; color: #64748b;">${c.registered_on || formatDate(c.created_at)}</td>
      </tr>
    `
    )
    .join('');

  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Inter, sans-serif';
  container.style.color = '#0f172a';
  container.style.fontSize = '11px';

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #005ea4; padding-bottom: 10px; margin-bottom: 15px;">
      <div>
        <h1 style="margin: 0; color: #005ea4; font-size: 18px; font-weight: 800;">Seekoji Electric</h1>
        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px;">${title} • Total Customers: ${customers.length}</p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #64748b;">
        <p style="margin:0;">Generated: ${dateStr}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 9px; font-weight: 700;">
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center; width: 30px;">#</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 100px;">Code</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Name</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 100px;">Mobile</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Address</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 70px;">Status</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; width: 90px;">Registered</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: right;">
      Seekoji Electric Service Management System
    </div>
  `;

  try {
    const html2pdf = await loadHtml2Pdf();
    const opt = {
      margin:       8,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    await html2pdf().set(opt).from(container).save();
  } catch (err) {
    // Fallback direct download
    const htmlBlob = new Blob([`<html><body>${container.innerHTML}</body></html>`], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(htmlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
