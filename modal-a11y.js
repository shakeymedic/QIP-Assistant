// ==========================================
// Modal keyboard and backdrop behaviour
// ==========================================
// Every pop-up in the app is a full-screen "fixed inset-0" overlay, some in
// index.html and some built on the fly. Rather than wire each one up, this
// watches for whichever overlay is on top and gives it the behaviour people
// expect: Escape and a click on the dark backdrop close it (by pressing its
// own Close/Cancel button, so any clean-up code still runs), focus moves into
// it when it opens, Tab stays inside it, and focus returns to the button that
// opened it afterwards.

const IGNORE_IDS = new Set(['loading-overlay', 'register-screen', 'offline-indicator']);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisible(el) {
    if (!el || el.classList.contains('hidden')) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
}

function topModal() {
    let best = null, bestZ = -Infinity;
    document.querySelectorAll('body div.fixed.inset-0').forEach(el => {
        if (IGNORE_IDS.has(el.id) || !isVisible(el)) return;
        const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
        if (z >= bestZ) { best = el; bestZ = z; }   // ties: later in the DOM wins
    });
    return best;
}

function focusables(modal) {
    return [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
}

function findCloseButton(modal) {
    const buttons = [...modal.querySelectorAll('button')].filter(b => b.offsetParent !== null);
    return buttons.find(b => /^(close|cancel)\b/i.test(b.getAttribute('aria-label') || ''))
        || buttons.find(b => /^(cancel|close|not now)$/i.test((b.textContent || '').trim()))
        || buttons.find(b => b.querySelector('[data-lucide="x"], svg.lucide-x') && !(b.textContent || '').trim());
}

function closeModal(modal) {
    const btn = findCloseButton(modal);
    if (btn) { btn.click(); return true; }
    return false;
}

let current = null;
let opener = null;

function syncFocus() {
    const modal = topModal();
    if (modal === current) return;
    if (modal) {
        if (!current) opener = document.activeElement;
        if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (!modal.contains(document.activeElement)) {
            const items = focusables(modal);
            const first = items.find(el => el.matches('input, textarea, select')) || items[0];
            if (first) first.focus({ preventScroll: true });
        }
    } else if (opener && document.contains(opener) && opener.offsetParent !== null) {
        opener.focus({ preventScroll: true });
        opener = null;
    } else {
        opener = null;
    }
    current = modal;
}

let pending = false;
const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; syncFocus(); });
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

document.addEventListener('keydown', (e) => {
    const modal = topModal();
    if (!modal) return;
    if (e.key === 'Escape') {
        // Leave Escape to an open hint popover or the guided tour first
        const hint = document.getElementById('qip-hint-pop');
        if (hint && !hint.hidden) return;
        if (document.querySelector('.driver-popover')) return;
        if (closeModal(modal)) e.preventDefault();
        return;
    }
    if (e.key === 'Tab') {
        const items = focusables(modal);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (!modal.contains(document.activeElement)) {
            e.preventDefault(); first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }
}, true);   // capture, so an open hint popover is seen before it closes itself

// Close on a click on the dark backdrop itself (press and release both on the
// overlay, so dragging a text selection out of a field doesn't close it).
let downOn = null;
document.addEventListener('mousedown', (e) => { downOn = e.target; }, true);
document.addEventListener('click', (e) => {
    const modal = topModal();
    if (!modal || e.target !== modal || downOn !== modal) return;
    closeModal(modal);
});
