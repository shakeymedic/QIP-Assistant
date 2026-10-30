// role-requests.js — asking for the Clinical Supervisor or QIP Lead role.
//
// Anyone can tick these roles, so the administrator wants to know who is
// asking. When an account adds either role it is asked for its details (name,
// job title, hospital and so on). They are saved to roleRequests/{uid}_{role}
// and listed in the Admin audit page, where the administrator approves or
// rejects them; a rejected request drops off the list.
//
// Saving also asks the Netlify function role-request-notify to email the
// administrator. That only works once the email is set up on Netlify (see
// netlify/functions/role-request-notify.mjs); until then the request still
// shows in the admin list and in the count on the admin bar.
//
// Rules for roleRequests are in firestore.rules: the person asking may only
// write their own request, always as 'pending'; only the master admin can
// approve or reject, and list them all.

import { doc, getDoc, setDoc, deleteDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { escapeHtml, showToast } from "./utils.js";

export const REQUEST_ROLES = ['supervisor', 'qip_lead'];
export const ROLE_NAMES = { supervisor: 'Clinical Supervisor', qip_lead: 'Departmental QIP Lead' };

// The form, in order. `max` matches firestore.rules.
const FIELDS = [
    { key: 'fullName', label: 'Full name', required: true, max: 200, placeholder: 'Dr Jane Smith', autocomplete: 'name' },
    { key: 'jobTitle', label: 'Job title and grade', required: true, max: 200, placeholder: 'Consultant in Emergency Medicine' },
    { key: 'hospital', label: 'Hospital', required: true, max: 200, placeholder: 'Queen Elizabeth Hospital Birmingham' },
    { key: 'organisation', label: 'NHS Trust or Health Board', max: 200, placeholder: 'University Hospitals Birmingham NHS Foundation Trust' },
    { key: 'department', label: 'Department', max: 200, placeholder: 'Emergency Department' },
    { key: 'regNumber', label: 'GMC or NMC number', max: 40, placeholder: 'Optional' },
    { key: 'workEmail', label: 'Work email, if different from your sign-in email', max: 320, type: 'email', placeholder: 'Optional', autocomplete: 'email' },
    { key: 'phone', label: 'Work phone or bleep', max: 40, type: 'tel', placeholder: 'Optional' },
    { key: 'reason', label: 'Anything the administrator should know', max: 1000, multiline: true, placeholder: 'For example, which trainees you supervise or why you need the department-wide view' }
];

export function requestId(uid, role) {
    return `${uid}_${role}`;
}

// This account's own request for a role, or null if it has never sent one.
export async function getMyRoleRequest(db, uid, role) {
    if (!db || !uid) return null;
    try {
        const snap = await getDoc(doc(db, 'roleRequests', requestId(uid, role)));
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.warn('[RoleRequest] could not read own request:', e);
        return null;
    }
}

// Removing the role withdraws the request, so it doesn't sit in the admin list.
export async function withdrawRoleRequest(db, uid, role) {
    if (!db || !uid || !REQUEST_ROLES.includes(role)) return;
    try {
        await deleteDoc(doc(db, 'roleRequests', requestId(uid, role)));
    } catch (e) {
        console.warn('[RoleRequest] could not withdraw request:', e);
    }
}

// Every request (master admin only), keyed by document ID.
export async function fetchRoleRequests(db) {
    const snap = await getDocs(collection(db, 'roleRequests'));
    const out = {};
    snap.forEach(d => { out[d.id] = d.data() || {}; });
    return out;
}

// The admin's Approve / Reject / Undo. For an old QIP Lead claim made before
// details were collected there is no request yet, so `base` fills one in.
export async function decideRoleRequest(db, uid, role, status, adminEmail, base = {}) {
    const ref = doc(db, 'roleRequests', requestId(uid, role));
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : {
        uid, role,
        email: base.email || '',
        fullName: base.displayName || ''
    };
    await setDoc(ref, {
        ...current,
        status,
        decidedAtIso: new Date().toISOString(),
        decidedByEmail: adminEmail || ''
    });
}

// ─── The form ─────────────────────────────────────────────────────────────────
let _ctx = null; // { db, user, roles, onDone }

function ensureModal() {
    let modal = document.getElementById('role-request-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'role-request-modal';
    modal.className = 'hidden fixed inset-0 bg-black/60 z-[10001] items-center justify-center p-4 overflow-y-auto';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'role-request-title');
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div class="p-6 border-b border-slate-100">
                <h3 id="role-request-title" class="text-lg font-bold text-slate-800">Tell the administrator about yourself</h3>
                <p id="role-request-intro" class="text-sm text-slate-600 mt-1"></p>
            </div>
            <form id="role-request-form" class="p-6 space-y-3" novalidate onsubmit="event.preventDefault(); window.submitRoleRequest();">
                ${FIELDS.map(f => `
                <div>
                    <label for="rr-${f.key}" class="block text-sm font-medium text-slate-700 mb-1">${escapeHtml(f.label)}${f.required ? ' <span class="text-red-600">*</span>' : ''}</label>
                    ${f.multiline
                        ? `<textarea id="rr-${f.key}" maxlength="${f.max}" rows="3" class="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="${escapeHtml(f.placeholder || '')}"></textarea>`
                        : `<input id="rr-${f.key}" type="${f.type || 'text'}" maxlength="${f.max}" ${f.required ? 'required' : ''} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} class="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="${escapeHtml(f.placeholder || '')}">`}
                </div>`).join('')}
                <p class="text-xs text-slate-500">Your details go to the QIP Assist administrator only, to check your request. See the <a href="privacy.html" target="_blank" rel="noopener" class="underline">privacy notice</a>.</p>
                <p id="role-request-error" class="hidden text-sm text-red-600" role="alert"></p>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" aria-label="Cancel role request" onclick="window.closeRoleRequestForm()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Not now</button>
                    <button type="submit" id="role-request-submit" class="px-4 py-2 bg-rcem-purple hover:bg-indigo-800 text-white rounded-lg text-sm font-bold">Send to the administrator</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

// Opens the form for one or more roles. Fields are filled from an earlier
// request if there is one, otherwise from the account's name.
export async function openRoleRequestForm(db, user, roles, onDone) {
    roles = (roles || []).filter(r => REQUEST_ROLES.includes(r));
    if (!db || !user || roles.length === 0) return;
    _ctx = { db, user, roles, onDone };
    const modal = ensureModal();
    const names = roles.map(r => ROLE_NAMES[r]).join(' and ');
    document.getElementById('role-request-intro').textContent =
        `You've asked for the ${names} role. Please send the administrator your details so they know who you are` +
        (roles.includes('qip_lead') ? ' and can approve the department-wide view.' : '.');
    const earlier = await getMyRoleRequest(db, user.uid, roles[0]);
    FIELDS.forEach(f => {
        const el = document.getElementById(`rr-${f.key}`);
        if (el) el.value = (earlier && earlier[f.key]) || (f.key === 'fullName' ? (user.displayName || '') : '');
    });
    const err = document.getElementById('role-request-error');
    err.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('rr-fullName')?.focus(), 50);
}

window.closeRoleRequestForm = function() {
    const modal = document.getElementById('role-request-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    const ctx = _ctx;
    _ctx = null;
    if (ctx && ctx.onDone) ctx.onDone(false);
};

window.submitRoleRequest = async function() {
    if (!_ctx) return;
    const { db, user, roles, onDone } = _ctx;
    const err = document.getElementById('role-request-error');
    const btn = document.getElementById('role-request-submit');
    const values = {};
    FIELDS.forEach(f => { values[f.key] = (document.getElementById(`rr-${f.key}`)?.value || '').trim().slice(0, f.max); });
    const missing = FIELDS.filter(f => f.required && !values[f.key]).map(f => f.label.toLowerCase());
    if (missing.length) {
        err.textContent = `Please fill in your ${missing.join(', ')}.`;
        err.classList.remove('hidden');
        return;
    }
    if (values.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.workEmail)) {
        err.textContent = 'The work email address does not look right.';
        err.classList.remove('hidden');
        return;
    }
    err.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
        const now = new Date().toISOString();
        for (const role of roles) {
            const earlier = await getMyRoleRequest(db, user.uid, role);
            const data = {
                uid: user.uid,
                role,
                status: 'pending',
                createdAtIso: (earlier && earlier.status === 'pending' && earlier.createdAtIso) || now,
                updatedAtIso: now,
                ...values
            };
            if (user.email) data.email = user.email;
            await setDoc(doc(db, 'roleRequests', requestId(user.uid, role)), data);
            notifyAdministrator(user, role);
        }
        const modal = document.getElementById('role-request-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        _ctx = null;
        showToast('Thank you. Your details have been sent to the administrator.', 'success');
        if (onDone) onDone(true);
    } catch (e) {
        console.warn('[RoleRequest] could not save:', e);
        err.textContent = e?.code === 'permission-denied'
            ? 'Could not send: the database refused it. Please tell the administrator.'
            : 'Could not send your details. Check your connection and try again.';
        err.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send to the administrator';
    }
};

// Best-effort email to the administrator. The function reads the saved
// request itself, so all it needs is who is asking (the sign-in token) and
// which role. Failure is silent: the request is already in the admin list.
async function notifyAdministrator(user, role) {
    try {
        const token = await user.getIdToken();
        const res = await fetch('/.netlify/functions/role-request-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role })
        });
        if (!res.ok) console.warn('[RoleRequest] email to the administrator not sent:', res.status);
    } catch (e) {
        console.warn('[RoleRequest] email to the administrator not sent:', e);
    }
}

// One line of the requester's details for the admin table.
export function requestDetailsHTML(r) {
    if (!r || !r.jobTitle) return '<span class="text-slate-400 italic">No details sent (asked before details were collected)</span>';
    const line = (label, v) => v ? `<div><span class="text-slate-400">${label}:</span> ${escapeHtml(v)}</div>` : '';
    return line('Job title', r.jobTitle) + line('Hospital', r.hospital) + line('Trust', r.organisation)
        + line('Department', r.department) + line('GMC/NMC', r.regNumber) + line('Work email', r.workEmail)
        + line('Phone', r.phone) + line('Note', r.reason);
}
