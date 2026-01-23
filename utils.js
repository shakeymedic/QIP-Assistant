// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Auto-resize textarea based on content
 */
export function autoResizeTextarea(element) {
    if (!element || element.tagName !== 'TEXTAREA') return;
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight + 2) + 'px';
}

/**
 * Show toast notification
 */
export function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-slate-700',
        warning: 'bg-amber-500'
    };
    
    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };
    
    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0 max-w-sm`;
    toast.innerHTML = `
        <i data-lucide="${icons[type] || icons.info}" class="w-5 h-5 flex-shrink-0"></i>
        <span class="text-sm font-medium">${escapeHtml(msg)}</span>
    `;
    
    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: [toast] });
    }
    
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });
    
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (!indicator) return;
    if (navigator.onLine) {
        indicator.classList.add('hidden');
    } else {
        indicator.classList.remove('hidden');
    }
}

// ==========================================================================
// FORMATTERS
// ==========================================================================

export function formatDate(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB');
}

export function formatNumber(num, decimals = 2) {
    if (num === null || isNaN(num)) return '-';
    return Number(num).toFixed(decimals);
}
