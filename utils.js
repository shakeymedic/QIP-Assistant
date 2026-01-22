// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
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
 * @param {HTMLTextAreaElement} element 
 */
export function autoResizeTextarea(element) {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

/**
 * Show toast notification
 * @param {string} msg - Message to display
 * @param {string} type - Type: 'success', 'error', 'info', 'warning'
 */
export function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
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
    
    // Initialize icon
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: [toast] });
    }
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Update online/offline status indicator
 */
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
// VALIDATION HELPERS
// ==========================================================================

/**
 * Validate a date string
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} - True if valid
 */
export function isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

/**
 * Validate a numeric value
 * @param {any} value - Value to validate
 * @param {object} options - Validation options
 * @returns {object} - { valid: boolean, value: number|null, error: string|null }
 */
export function validateNumber(value, options = {}) {
    const {
        min = -Infinity,
        max = Infinity,
        allowNegative = true,
        allowDecimal = true,
        required = false
    } = options;
    
    // Handle empty values
    if (value === '' || value === null || value === undefined) {
        if (required) {
            return { valid: false, value: null, error: 'Value is required' };
        }
        return { valid: true, value: null, error: null };
    }
    
    // Parse the value
    const parsed = parseFloat(value);
    
    // Check if it's a valid number
    if (isNaN(parsed)) {
        return { valid: false, value: null, error: 'Must be a valid number' };
    }
    
    // Check for negative values
    if (!allowNegative && parsed < 0) {
        return { valid: false, value: null, error: 'Negative values not allowed' };
    }
    
    // Check for decimals
    if (!allowDecimal && !Number.isInteger(parsed)) {
        return { valid: false, value: null, error: 'Must be a whole number' };
    }
    
    // Check range
    if (parsed < min) {
        return { valid: false, value: null, error: `Must be at least ${min}` };
    }
    
    if (parsed > max) {
        return { valid: false, value: null, error: `Must be no more than ${max}` };
    }
    
    return { valid: true, value: parsed, error: null };
}

/**
 * Validate a text string
 * @param {string} text - Text to validate
 * @param {object} options - Validation options
 * @returns {object} - { valid: boolean, value: string|null, error: string|null }
 */
export function validateText(text, options = {}) {
    const {
        minLength = 0,
        maxLength = Infinity,
        required = false,
        pattern = null,
        patternMessage = 'Invalid format'
    } = options;
    
    // Handle empty values
    if (!text || text.trim() === '') {
        if (required) {
            return { valid: false, value: null, error: 'This field is required' };
        }
        return { valid: true, value: '', error: null };
    }
    
    const trimmed = text.trim();
    
    // Check length
    if (trimmed.length < minLength) {
        return { valid: false, value: null, error: `Must be at least ${minLength} characters` };
    }
    
    if (trimmed.length > maxLength) {
        return { valid: false, value: null, error: `Must be no more than ${maxLength} characters` };
    }
    
    // Check pattern
    if (pattern && !pattern.test(trimmed)) {
        return { valid: false, value: null, error: patternMessage };
    }
    
    return { valid: true, value: trimmed, error: null };
}

/**
 * Validate a date range
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {object} - { valid: boolean, error: string|null }
 */
export function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
        return { valid: false, error: 'Both dates are required' };
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
        return { valid: false, error: 'Invalid start date' };
    }
    
    if (isNaN(end.getTime())) {
        return { valid: false, error: 'Invalid end date' };
    }
    
    if (end < start) {
        return { valid: false, error: 'End date must be after start date' };
    }
    
    return { valid: true, error: null };
}

/**
 * Sanitize input for safe storage
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
    if (!input) return '';
    
    // Remove any potential script tags
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
}

// ==========================================================================
// FORMAT HELPERS
// ==========================================================================

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @param {string} format - Format style: 'short', 'long', 'iso'
 * @returns {string} - Formatted date string
 */
export function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-GB');
        case 'long':
            return d.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        case 'iso':
            return d.toISOString().split('T')[0];
        default:
            return d.toLocaleDateString('en-GB');
    }
}

/**
 * Format a number with appropriate precision
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default auto)
 * @returns {string} - Formatted number
 */
export function formatNumber(num, decimals = null) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    
    if (decimals !== null) {
        return num.toFixed(decimals);
    }
    
    // Auto-determine decimals based on value
    if (Number.isInteger(num)) return num.toString();
    if (Math.abs(num) >= 100) return num.toFixed(0);
    if (Math.abs(num) >= 10) return num.toFixed(1);
    return num.toFixed(2);
}

/**
 * Format percentage
 * @param {number} value - Value (0-100 or 0-1)
 * @param {boolean} isDecimal - Whether value is decimal (0-1)
 * @returns {string} - Formatted percentage
 */
export function formatPercentage(value, isDecimal = false) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    
    const pct = isDecimal ? value * 100 : value;
    return `${formatNumber(pct, 1)}%`;
}

// ==========================================================================
// DATA HELPERS
// ==========================================================================

/**
 * Calculate statistics for a data array
 * @param {number[]} data - Array of numbers
 * @returns {object} - Statistics object
 */
export function calculateStats(data) {
    if (!data || data.length === 0) {
        return { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
    }
    
    const validData = data.filter(n => !isNaN(n) && n !== null);
    if (validData.length === 0) {
        return { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
    }
    
    const count = validData.length;
    const sum = validData.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    
    const sorted = [...validData].sort((a, b) => a - b);
    const median = count % 2 === 0 
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 
        : sorted[Math.floor(count / 2)];
    
    const min = sorted[0];
    const max = sorted[count - 1];
    
    const squaredDiffs = validData.map(n => Math.pow(n - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    return { count, sum, mean, median, min, max, stdDev };
}

/**
 * Generate a unique ID
 * @returns {string} - Unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Deep clone an object
 * @param {object} obj - Object to clone
 * @returns {object} - Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================

// Listen for online/offline events
if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}
