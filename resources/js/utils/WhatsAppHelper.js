/**
 * Formats WhatsApp text messages for various actions and generates wa.me links.
 */

export const generateWhatsAppMessage = ({ type, customerName, tokenNo, mobile, extra = {} }) => {
  let message = '';

  switch (type) {
    case 'customer_register':
      message = `Hello ${customerName || 'Customer'}, welcome to Seekoji Electric! Your Customer ID is #${extra.customerCode || 'ID'}. We look forward to serving your repair needs.`;
      break;

    case 'intake_entry':
      message = `Hello ${customerName || 'Customer'}, your repair job for "${extra.productName || 'Equipment'}" has been registered successfully. Token No: #${tokenNo}. Stage: NEW INTAKE.`;
      break;

    case 'assign_tester':
      message = `Hello ${customerName || 'Customer'}, your job #${tokenNo} (${extra.productName || 'Equipment'}) has been assigned to inspection and testing.`;
      break;

    case 'fault_found':
      message = `Hello ${customerName || 'Customer'}, inspection complete for job #${tokenNo}. Estimated Budget: ₹${extra.estimatedBudget || 0}. Please approve to begin repair.`;
      break;

    case 'approve':
      message = `Hello ${customerName || 'Customer'}, budget approved for job #${tokenNo}! Our technician has started repair work.`;
      break;

    case 'work_done':
      message = `Hello ${customerName || 'Customer'}, repair work for job #${tokenNo} is complete! Final Amount: ₹${extra.finalAmount || 0}.`;
      break;

    case 'deliver':
      message = `Hello ${customerName || 'Customer'}, job #${tokenNo} has been delivered successfully. Thank you for choosing Seekoji Electric!`;
      break;

    case 'cancel':
      message = `Hello ${customerName || 'Customer'}, job #${tokenNo} has been cancelled per request.`;
      break;

    case 'not_repairable':
      message = `Hello ${customerName || 'Customer'}, job #${tokenNo} has been marked as Not Repairable. Inspection fee: ₹${extra.fee || 250}.`;
      break;

    default:
      message = `Hello ${customerName || 'Customer'}, update on job #${tokenNo}: Stage changed to ${extra.stage || 'PROCESSING'}.`;
      break;
  }

  return message;
};

export const openWhatsApp = ({ mobile, message }) => {
  if (!mobile) return;
  const cleanMobile = mobile.replace(/[^0-9]/g, '');
  const fullMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
  const encodedText = encodeURIComponent(message);
  window.open(`https://wa.me/${fullMobile}?text=${encodedText}`, '_blank');
};
