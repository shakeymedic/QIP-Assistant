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

// ==========================================================================
// DIALOG UTILITIES — replaces browser alert/confirm/prompt
// ==========================================================================

window.hideConfirmDialog = function() {
    const m = document.getElementById('confirm-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
};

window.hideInputModal = function() {
    const m = document.getElementById('input-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
};

/**
 * Show a confirmation dialog instead of browser confirm()
 * @param {string} message - The confirmation message
 * @param {function} onConfirm - Called if user confirms
 * @param {string} dangerLabel - Button label (default: 'Delete')
 * @param {string} title - Dialog title (default: 'Confirm')
 */
export function showConfirmDialog(message, onConfirm, dangerLabel = 'Delete', title = 'Confirm') {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
        // Fallback in case modal not in DOM
        if (confirm(message)) onConfirm();
        return;
    }
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl   = document.getElementById('confirm-modal-message');
    const oldBtn  = document.getElementById('confirm-modal-btn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;

    // Clone button to strip old listeners
    const btn = oldBtn.cloneNode(true);
    btn.textContent = dangerLabel;
    oldBtn.parentNode.replaceChild(btn, oldBtn);

    btn.onclick = () => {
        window.hideConfirmDialog();
        onConfirm();
    };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
window.showConfirmDialog = showConfirmDialog;

/**
 * Show an input form modal instead of browser prompt()
 * @param {string} title - Modal heading
 * @param {Array}  fields - [{id, label, type, placeholder, value, required}]
 * @param {function} onSubmit - Called with {fieldId: value} map
 * @param {string} submitLabel - Submit button text (default: 'Add')
 */
export function showInputModal(title, fields, onSubmit, submitLabel = 'Add') {
    const modal    = document.getElementById('input-modal');
    const titleEl  = document.getElementById('input-modal-title');
    const fieldsEl = document.getElementById('input-modal-fields');
    const oldBtn   = document.getElementById('input-modal-submit');
    if (!modal) return;

    if (titleEl) titleEl.textContent = title;

    fieldsEl.innerHTML = fields.map(f => `
        <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
                ${escapeHtml(f.label)}${f.required ? ' <span class="text-red-500">*</span>' : ''}
            </label>
            ${f.type === 'textarea'
                ? `<textarea id="imodal-${f.id}" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent outline-none resize-none" rows="3" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(f.value || '')}</textarea>`
                : `<input id="imodal-${f.id}" type="${f.type || 'text'}" class="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent outline-none" placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value || '')}">`
            }
        </div>
    `).join('');

    const btn = oldBtn.cloneNode(true);
    btn.textContent = submitLabel;
    oldBtn.parentNode.replaceChild(btn, oldBtn);

    const doSubmit = () => {
        const data = {};
        let valid = true;
        fields.forEach(f => {
            const el = document.getElementById(`imodal-${f.id}`);
            const val = el ? el.value.trim() : '';
            data[f.id] = val;
            if (f.required && !val) {
                valid = false;
                if (el) el.classList.add('border-red-400', 'ring-1', 'ring-red-400');
            } else if (el) {
                el.classList.remove('border-red-400', 'ring-1', 'ring-red-400');
            }
        });
        if (!valid) return;
        window.hideInputModal();
        onSubmit(data);
    };

    btn.onclick = doSubmit;

    // Allow Enter on single-line inputs to submit
    fields.forEach(f => {
        if (f.type !== 'textarea') {
            const el = document.getElementById(`imodal-${f.id}`);
            if (el) el.onkeydown = (e) => { if (e.key === 'Enter') doSubmit(); };
        }
    });

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Focus first field
    setTimeout(() => {
        const first = document.getElementById(`imodal-${fields[0].id}`);
        if (first) first.focus();
    }, 50);
}
window.showInputModal = showInputModal;
