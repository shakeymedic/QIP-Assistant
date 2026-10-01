// qip-lead.js  — Departmental QIP Lead functionality
import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';
import { LEAD_INVITES, readInvites, writeInvite, deleteInvite } from './invites.js';

// ─── Projects this person has been added to as QIP Lead ──────────────────────
export async function getQIPLeadProjects(db, userEmail) {
    if (!db || !userEmail) return [];
    return readInvites(db, LEAD_INVITES, userEmail);
}

// ─── Add a QIP Lead to the current project ────────────────────────────────────
export async function addQIPLeadToProject(db, ownerUid, projectId, leadEmail, traineeName, projectTitle) {
    if (!db || !leadEmail || !ownerUid || !projectId) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
        showToast('Please enter a valid email address.', 'error');
        return false;
    }
    try {
        await writeInvite(db, LEAD_INVITES, leadEmail, {
            ownerUid,
            projectId,
            projectTitle: projectTitle || 'Untitled QIP',
            traineeName: traineeName || ownerUid
        });
        showToast(`QIP Lead added. ${leadEmail} will see this project when they sign in with that email.`, 'success');
        return true;
    } catch (e) {
        console.error('[QIPLead] addQIPLead error:', e);
        showToast('Failed to add QIP Lead — check your connection and try again.', 'error');
        return false;
    }
}

// ─── Remove a QIP Lead from a project ────────────────────────────────────────
// Removing them from the project's list is what ends their access; deleting the
// invite just stops the project appearing on their dashboard straight away.
export async function removeQIPLeadFromProject(db, ownerUid, projectId, leadEmail) {
    if (!db || !leadEmail) return;
    await deleteInvite(db, LEAD_INVITES, leadEmail, ownerUid, projectId);
    showToast(`Removed ${leadEmail} as QIP Lead.`, 'success');
}

// ─── Render QIP Lead panel inside supervisor view ─────────────────────────────
// Called from renderSupervisorDashboard to add the "Manage QIP Leads" section
export function renderQIPLeadPanel(container, db, ownerUid, projectId) {
    if (!container) return;
    const leads = state.projectData?.qipLeads || [];
    const hidden = !!(state.projectData?.visibility && state.projectData.visibility.hideFromDeptQIPLead === true);

    container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <i data-lucide="eye-off" class="w-4 h-4 text-slate-500"></i>
                Departmental QIP Lead Visibility
            </h3>
            <p class="text-xs text-slate-500 mb-3">Anyone with the Departmental QIP Lead role can currently see every QIP project across every user, not just ones they were individually invited to. If you'd rather this project wasn't included in that blanket view, turn it off here — you can still add individual QIP Leads below regardless of this setting. All QIP Lead / Supervisor access to this project is logged for audit.</p>
            <label class="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" ${hidden ? 'checked' : ''} onchange="window.toggleHideFromDeptLead(this.checked)">
                <span class="text-slate-700">Hide this project from the blanket Departmental QIP Lead view</span>
            </label>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5">
            <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
                Departmental QIP Leads
            </h3>
            <p class="text-xs text-slate-500 mb-4">Add a Departmental QIP Lead by email. Use this to flag your project to a specific lead's attention, e.g. for sign-off.</p>

            <div class="flex gap-2 mb-4">
                <input id="qip-lead-email-input" type="email" placeholder="lead@hospital.nhs.uk"
                    class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
                <button onclick="window.addQIPLeadBtn()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1">
                    <i data-lucide="plus" class="w-4 h-4"></i> Add Lead
                </button>
            </div>

            ${leads.length > 0 ? `
            <div class="space-y-2">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Current QIP Leads</h4>
                ${leads.map((l, i) => `
                <div class="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                    <div>
                        <div class="text-sm font-medium text-slate-800">${escapeHtml(l.email)}</div>
                        <div class="text-xs text-slate-400">Added ${l.addedAt ? new Date(l.addedAt).toLocaleDateString('en-GB') : 'recently'}</div>
                    </div>
                    <button onclick="window.removeQIPLeadBtn(${i})" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remove">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>`).join('')}
            </div>
            ` : `<p class="text-xs text-slate-400 italic">No QIP Leads assigned yet.</p>`}
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── Shared overview helpers (also used by supervisor.js) ─────────────────────
export const STALLED_DAYS = 60;

export function daysSince(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function activityLabel(iso) {
    const d = daysSince(iso);
    if (d === null) return 'No activity recorded';
    if (d === 0) return 'Active today';
    if (d === 1) return 'Active yesterday';
    if (d < 30) return `Active ${d} days ago`;
    if (d < 365) return `Active ${Math.round(d / 30)} month${Math.round(d / 30) === 1 ? '' : 's'} ago`;
    return `Active over a year ago`;
}

export function isStalled(p) {
    const d = daysSince(p._lastActivity);
    return !p._signedOff && !p._unavailable && (d === null || d >= STALLED_DAYS);
}

export function stageLabel(stage) {
    return { higher: 'Higher', intermediate: 'Intermediate', accs: 'ACCS' }[stage] || '';
}

export function readinessColour(pct) {
    return pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-300';
}

export function matchesSearch(p, q) {
    if (!q) return true;
    const hay = [p._data?.meta?.title, p.projectTitle, p.traineeName, stageLabel(p._stage)].filter(Boolean).join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

export function sortProjects(list, sort) {
    const title = p => (p._data?.meta?.title || p.projectTitle || '').toLowerCase();
    const act = p => new Date(p._lastActivity || 0).getTime() || 0;
    const cmp = {
        recent: (a, b) => act(b) - act(a),
        'readiness-desc': (a, b) => (b._progress || 0) - (a._progress || 0) || act(b) - act(a),
        'readiness-asc': (a, b) => (a._progress || 0) - (b._progress || 0) || act(b) - act(a),
        title: (a, b) => title(a).localeCompare(title(b)),
        trainee: (a, b) => (a.traineeName || '').localeCompare(b.traineeName || '') || title(a).localeCompare(title(b)),
        pending: (a, b) => (a._signedOff === b._signedOff ? act(b) - act(a) : (a._signedOff ? 1 : -1))
    }[sort] || ((a, b) => act(b) - act(a));
    return [...list].sort(cmp);
}

export function refreshedLabel(opts) {
    if (opts.refreshing) return `<span class="inline-flex items-center gap-1"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Refreshing…</span>`;
    if (!opts.refreshedAt) return '';
    const t = new Date(opts.refreshedAt);
    return `Updated ${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function csvDownload(filename, rows) {
    const esc = v => {
        const s = v === null || v === undefined ? '' : String(v);
        // Neutralise spreadsheet formula injection from user-entered titles/names.
        const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
        return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    };
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── Render QIP Lead Dashboard (shown instead of project list) ────────────────
const leadView = { q: '', filter: 'all', sort: 'recent' };
let leadLast = { container: null, projects: [], opts: {} };

const LEAD_FILTERS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'attention', label: 'Needs attention', test: p => isStalled(p) },
    { key: 'progress', label: 'In progress', test: p => !p._signedOff && !p._unavailable && (p._progress || 0) < 75 },
    { key: 'ready', label: 'Near ready (75%+)', test: p => !p._signedOff && (p._progress || 0) >= 75 },
    { key: 'signed', label: 'Signed off', test: p => !!p._signedOff }
];

function leadVisible() {
    const f = LEAD_FILTERS.find(x => x.key === leadView.filter) || LEAD_FILTERS[0];
    const rows = leadLast.projects.map((p, idx) => ({ ...p, _idx: idx }));
    return sortProjects(rows.filter(p => f.test(p) && matchesSearch(p, leadView.q)), leadView.sort);
}

function leadCardHtml(proj) {
    const d = proj._data || {};
    const title = d.meta?.title || proj.projectTitle || 'Untitled QIP';
    const pdsa = d.pdsa || [];
    const lastPdsa = pdsa.length ? pdsa[pdsa.length - 1] : null;
    const progress = proj._progress || 0;
    const stalled = isStalled(proj);
    const stage = stageLabel(proj._stage);
    const status = proj._unavailable
        ? `<span class="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="alert-circle" class="w-3 h-3"></i> Unavailable</span>`
        : proj._signedOff
            ? `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="check-circle" class="w-3 h-3"></i> Signed off</span>`
            : stalled
                ? `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full" title="No activity for ${STALLED_DAYS}+ days"><i data-lucide="clock-alert" class="w-3 h-3"></i> Stalled</span>`
                : `<span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="activity" class="w-3 h-3"></i> In progress</span>`;
    return `
    <div class="bg-white rounded-2xl border ${stalled ? 'border-amber-200' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
        <div class="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
            <h3 class="font-bold text-white text-sm leading-tight line-clamp-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
            <p class="text-slate-300 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span>Trainee: ${escapeHtml(proj.traineeName || 'Unknown')}</span>
                ${proj._isOwn ? '<span class="bg-white/15 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">You</span>' : ''}
                ${stage ? `<span class="bg-white/15 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">${stage}</span>` : ''}
            </p>
        </div>
        <div class="p-4 flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-3 gap-2">
                ${status}
                <span class="text-[11px] ${stalled ? 'text-amber-700 font-semibold' : 'text-slate-400'}">${activityLabel(proj._lastActivity)}</span>
            </div>
            <div class="mb-3">
                <div class="flex justify-between text-xs text-slate-500 mb-1">
                    <span title="Same readiness score the trainee sees on their dashboard">Portfolio readiness</span><span class="font-bold">${progress}%${proj._readinessTotal ? ` <span class="font-normal text-slate-400">(${proj._readinessMet}/${proj._readinessTotal})</span>` : ''}</span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full">
                    <div class="${readinessColour(progress)} h-2 rounded-full transition-all" style="width:${progress}%"></div>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 mb-3 text-center">
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._dataPoints || 0}</div><div class="text-[10px] text-slate-400">Data pts</div></div>
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._pdsaCount || 0}</div><div class="text-[10px] text-slate-400">PDSA cycles</div></div>
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._teamCount || 0}</div><div class="text-[10px] text-slate-400">Team</div></div>
            </div>
            ${lastPdsa ? `
            <div class="bg-indigo-50 rounded-lg px-3 py-2 mb-3 text-xs">
                <span class="font-bold text-indigo-700">Latest PDSA:</span>
                <span class="text-slate-600 ml-1">${escapeHtml(lastPdsa.title || 'Untitled')}</span>
                ${(lastPdsa.startDate || lastPdsa.start) ? `<span class="text-slate-400 ml-2">${escapeHtml(lastPdsa.startDate || lastPdsa.start)}</span>` : ''}
            </div>` : ''}
            <div class="mt-auto">
                <button onclick="window.viewLeadProject(${proj._idx})" ${proj._unavailable ? 'disabled' : ''}
                    class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i data-lucide="eye" class="w-4 h-4"></i> View Full Project
                </button>
            </div>
        </div>
    </div>`;
}

function renderLeadCards() {
    const grid = document.getElementById('lead-cards');
    const count = document.getElementById('lead-visible-count');
    if (!grid) return;
    const rows = leadVisible();
    if (count) count.textContent = `Showing ${rows.length} of ${leadLast.projects.length}`;
    if (!leadLast.projects.length) {
        grid.innerHTML = `<div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
            <p class="text-slate-600 font-semibold">No QIP projects to show yet</p>
            <p class="text-slate-400 text-sm mt-1">${leadLast.opts.hasRole ? 'Projects appear here as soon as trainees create them (unless they opt out of the department view).' : 'Projects appear here when a trainee adds you as their QIP Lead.'}</p>
        </div>`;
    } else if (!rows.length) {
        grid.innerHTML = `<div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No projects match these filters. <button onclick="window.qipLeadResetFilters()" class="text-indigo-600 font-semibold hover:underline">Clear filters</button>
        </div>`;
    } else {
        grid.innerHTML = rows.map(leadCardHtml).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });
}

export function renderQIPLeadDashboard(container, leadProjects, opts = {}) {
    if (!container) return;
    leadLast = { container, projects: leadProjects || [], opts };
    const all = leadLast.projects;
    const total = all.length;
    const active = all.filter(p => (p._pdsaCount || 0) > 0).length;
    const ready = all.filter(p => (p._progress || 0) >= 75).length;
    const signed = all.filter(p => p._signedOff).length;
    const stalled = all.filter(isStalled).length;
    const stat = (n, label, filter, extra = '') => `
        <button onclick="window.qipLeadSetFilter('${filter}')" class="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors ${leadView.filter === filter ? 'ring-2 ring-white/70' : ''} ${extra}">
            <div class="text-2xl font-bold">${n}</div>
            <div class="text-xs text-indigo-200 mt-0.5">${label}</div>
        </button>`;

    container.innerHTML = `
        <div class="min-h-screen bg-slate-50 p-4 md:p-6">
            <div class="max-w-6xl mx-auto">
                <div class="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-2xl p-6 mb-5 text-white shadow-lg">
                    <div class="flex items-start justify-between gap-4 flex-wrap">
                        <div class="flex items-center gap-4">
                            <img src="./logo.png" alt="" class="h-12 rounded-xl bg-white/10 p-1">
                            <div>
                                <div class="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-1">Departmental QIP Lead Portal</div>
                                <h1 class="text-2xl font-bold">QIP Supervision Dashboard</h1>
                                <p class="text-indigo-200 text-sm mt-1">${total} QIP project${total !== 1 ? 's' : ''} ${opts.hasRole && !opts.deptDenied ? 'across the department' : 'shared with you'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] text-indigo-200">${refreshedLabel(opts)}</span>
                            <button onclick="window.refreshRoleOverview('lead')" ${opts.refreshing ? 'disabled' : ''} class="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50" title="Reload the latest data">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 ${opts.refreshing ? 'animate-spin' : ''}"></i> Refresh
                            </button>
                            <button onclick="window.qipLeadExportCSV()" class="bg-white text-indigo-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-indigo-50" title="Download the projects currently shown as a spreadsheet">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i> Export CSV
                            </button>
                        </div>
                    </div>
                    <div class="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                        ${stat(total, 'Total', 'all')}
                        ${stat(stalled, `Stalled ${STALLED_DAYS}+ days`, 'attention', stalled ? 'bg-amber-400/25' : '')}
                        ${stat(active, 'PDSA started', 'progress')}
                        ${stat(ready, 'Near ready (75%+)', 'ready')}
                        ${stat(signed, 'Signed off', 'signed')}
                    </div>
                </div>

                ${opts.hasRole && opts.deptDenied ? `
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-900" role="status">
                    <div class="flex items-start gap-3">
                        <i data-lucide="lock" class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"></i>
                        <div class="min-w-0">
                            <p class="font-bold">The department-wide view isn't switched on for your account yet</p>
                            <p class="mt-1">Your account has the QIP Lead role, but it hasn't been approved to see every QIP in the department, so you can only see projects a trainee has added you to. To see them all, ask the app administrator to approve your account and send them your account ID:</p>
                            <div class="mt-2 flex items-center gap-2 flex-wrap">
                                <code class="bg-white border border-amber-200 rounded px-2 py-1 text-xs break-all">${escapeHtml(opts.uid || '')}</code>
                                <button type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(${escapeHtml(JSON.stringify(opts.uid || ''))}).then(() => window.showToast && window.showToast('Account ID copied', 'success'))" class="text-xs font-bold text-amber-800 underline">Copy</button>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
                <div class="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                        <input id="lead-search" type="search" value="${escapeHtml(leadView.q)}" oninput="window.qipLeadSetSearch(this.value)"
                            placeholder="Search by project title, trainee or stage…" aria-label="Search projects"
                            class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    </div>
                    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects">
                        ${LEAD_FILTERS.map(f => `<button onclick="window.qipLeadSetFilter('${f.key}')" class="px-3 py-1.5 rounded-lg text-xs font-bold border ${leadView.filter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${f.label}</button>`).join('')}
                    </div>
                    <select onchange="window.qipLeadSetSort(this.value)" aria-label="Sort projects" class="border border-slate-200 rounded-lg text-sm px-2 py-2 bg-white">
                        ${[['recent', 'Most recently active'], ['readiness-desc', 'Readiness: high to low'], ['readiness-asc', 'Readiness: low to high'], ['title', 'Title A–Z'], ['trainee', 'Trainee A–Z']]
                            .map(([k, l]) => `<option value="${k}" ${leadView.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                </div>
                <p id="lead-visible-count" class="text-xs text-slate-400 mb-2"></p>

                <div id="lead-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>

                <div class="mt-6 text-center">
                    <button onclick="window.returnToProjects()" class="text-slate-500 hover:text-slate-700 text-sm underline">Switch to my own projects</button>
                </div>
            </div>
        </div>
    `;
    renderLeadCards();
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

function rerenderLead() {
    if (leadLast.container) renderQIPLeadDashboard(leadLast.container, leadLast.projects, leadLast.opts);
}

window.qipLeadSetSearch = function(v) { leadView.q = v || ''; renderLeadCards(); };
window.qipLeadSetFilter = function(f) { leadView.filter = f; rerenderLead(); };
window.qipLeadSetSort = function(s) { leadView.sort = s; renderLeadCards(); };
window.qipLeadResetFilters = function() { leadView.q = ''; leadView.filter = 'all'; rerenderLead(); };

window.qipLeadExportCSV = function() {
    const rows = leadVisible();
    if (!rows.length) { showToast('No projects to export', 'error'); return; }
    const header = ['Project', 'Trainee', 'Training stage', 'Readiness %', 'Criteria met', 'Data points', 'PDSA cycles', 'Team size', 'Last activity', 'Status', 'Signed off by', 'Signed off date'];
    const body = rows.map(p => [
        p._data?.meta?.title || p.projectTitle || 'Untitled QIP',
        p.traineeName || '',
        stageLabel(p._stage),
        p._progress || 0,
        p._readinessTotal ? `${p._readinessMet}/${p._readinessTotal}` : '',
        p._dataPoints || 0,
        p._pdsaCount || 0,
        p._teamCount || 0,
        p._lastActivity ? p._lastActivity.slice(0, 10) : '',
        p._unavailable ? 'Unavailable' : p._signedOff ? 'Signed off' : isStalled(p) ? 'Stalled' : 'In progress',
        p._signedOffBy || '',
        p._signedOffDate || ''
    ]);
    csvDownload(`qip_department_overview_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
    showToast(`Exported ${rows.length} project${rows.length !== 1 ? 's' : ''}`, 'success');
};
