export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (!navigator.onLine) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') icon = `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-500"></i>`;
    if (type === 'error') icon = `<i data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>`;
    if (type === 'info') icon = `<i data-lucide="info" class="w-5 h-5 text-blue-500"></i>`;

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
