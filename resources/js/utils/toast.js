export function showToast(message, type = 'success') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
  }
}

export function notifySuccess(message) {
  showToast(message, 'success');
}

export function notifyError(message) {
  showToast(message, 'error');
}
