// supervisor.js
import { state } from "./state.js";
import { showToast, escapeHtml } from "./utils.js";
import { renderQIPLeadPanel, STALLED_DAYS, activityLabel, isStalled, stageLabel, readinessColour, matchesSearch, sortProjects, refreshedLabel } from "./qip-lead.js";
import { renderEMQIATForm } from "./emqiat.js";
import { db } from "./config.js";
import { logProjectAccessEvent } from "./audit-log.js";
import { computeReadiness, allMeasurePoints, lastActivityDate } from "./project-metrics.js";

// ─── Supervisor Overview (shown instead of project list) ─────────────────────
const supView = { q: '', filter: 'all', sort: 'pending' };
let supLast = { container: null, projects: [], opts: {} };

const SUP_FILTERS = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'pending', label: 'Awaiting sign-off', test: p => !p._signedOff && !p._unavailable },
    { key: 'signed', label: 'Signed off', test: p => !!p._signedOff },
    { key: 'attention', label: 'Stalled', test: p => isStalled(p) }
];

function supVisible() {
    const f = SUP_FILTERS.find(x => x.key === supView.filter) || SUP_FILTERS[0];
    const rows = supLast.projects.map((p, idx) => ({ ...p, _idx: idx }));
    return sortProjects(rows.filter(p => f.test(p) && matchesSearch(p, supView.q)), supView.sort);
}

function supCardHtml(proj) {
    const d = proj._data || {};
    const title = d.meta?.title || proj.projectTitle || 'Untitled QIP';
    const progress = proj._progress || 0;
    const stage = stageLabel(proj._stage);
    const stalled = isStalled(proj);
    const statusBadge = proj._unavailable
        ? `<span class="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="alert-circle" class="w-3 h-3"></i> Unavailable</span>`
        : proj._signedOff
            ? `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full" title="${escapeHtml(proj._signedOffBy ? 'Signed off by ' + proj._signedOffBy + (proj._signedOffDate ? ' on ' + proj._signedOffDate : '') : '')}"><i data-lucide="check-circle" class="w-3 h-3"></i> Signed off${proj._signedOffDate ? ' ' + escapeHtml(proj._signedOffDate) : ''}</span>`
            : `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="clock" class="w-3 h-3"></i> Awaiting sign-off</span>`;
    return `
    <div class="bg-white rounded-2xl border ${stalled ? 'border-amber-200' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
        <div class="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
            <h3 class="font-bold text-white text-sm leading-tight line-clamp-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
            <p class="text-slate-300 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span>Trainee: ${escapeHtml(proj.traineeName || 'Unknown')}</span>
                ${stage ? `<span class="bg-white/15 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">${stage}</span>` : ''}
            </p>
        </div>
        <div class="p-4 flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-3 gap-2">
                ${statusBadge}
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
            <div class="grid grid-cols-3 gap-2 mb-4 text-center">
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._dataPoints || 0}</div><div class="text-[10px] text-slate-400">Data pts</div></div>
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._pdsaCount || 0}</div><div class="text-[10px] text-slate-400">PDSA cycles</div></div>
                <div class="bg-slate-50 rounded-lg p-2"><div class="font-bold text-slate-800">${proj._teamCount || 0}</div><div class="text-[10px] text-slate-400">Team</div></div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-auto">
                <button onclick="window.viewSupervisedProjectReadOnly(${proj._idx})" ${proj._unavailable ? 'disabled' : ''}
                    class="w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> View Full Project
                </button>
                <button onclick="window.reviewSupervisedProject(${proj._idx})" ${proj._unavailable ? 'disabled' : ''}
                    class="w-full bg-teal-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i> ${proj._signedOff ? 'View Sign-off' : 'Review &amp; Sign Off'}
                </button>
            </div>
        </div>
    </div>`;
}

function renderSupCards() {
    const grid = document.getElementById('sup-cards');
    const count = document.getElementById('sup-visible-count');
    if (!grid) return;
    const rows = supVisible();
    if (count) count.textContent = `Showing ${rows.length} of ${supLast.projects.length}`;
    if (!supLast.projects.length) {
        grid.innerHTML = `<div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
            <p class="text-slate-600 font-semibold">No trainees have shared a QIP with you yet</p>
            <p class="text-slate-400 text-sm mt-1">Once a trainee adds your email under Settings → Project access, their project appears here for review and sign-off.</p>
        </div>`;
    } else if (!rows.length) {
        grid.innerHTML = `<div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No projects match these filters. <button onclick="window.supResetFilters()" class="text-teal-700 font-semibold hover:underline">Clear filters</button>
        </div>`;
    } else {
        grid.innerHTML = rows.map(supCardHtml).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });
}

export function renderSupervisorOverview(container, supervisedProjects, opts = {}) {
    if (!container) return;
    supLast = { container, projects: supervisedProjects || [], opts };
    const all = supLast.projects;
    const total = all.length;
    const signedOffCount = all.filter(p => p._signedOff).length;
    const pendingCount = all.filter(p => !p._signedOff && !p._unavailable).length;
    const stalledCount = all.filter(isStalled).length;
    const stat = (n, label, filter) => `
        <button onclick="window.supSetFilter('${filter}')" class="bg-white/10 hover:bg-white/20 rounded-xl p-3 text-center transition-colors ${supView.filter === filter ? 'ring-2 ring-white/70' : ''}">
            <div class="text-2xl font-bold">${n}</div>
            <div class="text-xs text-teal-100 mt-0.5">${label}</div>
        </button>`;

    container.innerHTML = `
        <div class="min-h-screen bg-slate-50 p-4 md:p-6">
            <div class="max-w-6xl mx-auto">
                <div class="bg-gradient-to-r from-teal-700 to-teal-600 rounded-2xl p-6 mb-5 text-white shadow-lg">
                    <div class="flex items-start justify-between gap-4 flex-wrap">
                        <div class="flex items-center gap-4">
                            <img src="./logo.png" alt="" class="h-12 rounded-xl bg-white/10 p-1">
                            <div>
                                <div class="text-xs font-bold uppercase tracking-widest text-teal-200 mb-1">Clinical Supervisor Portal</div>
                                <h1 class="text-2xl font-bold">Supervisor Overview</h1>
                                <p class="text-teal-100 text-sm mt-1">${total ? `You are supervising ${total} QIP project${total !== 1 ? 's' : ''}` : 'No trainees have shared a QIP with you yet.'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] text-teal-100">${refreshedLabel(opts)}</span>
                            <button onclick="window.refreshRoleOverview('supervisor')" ${opts.refreshing ? 'disabled' : ''} class="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50" title="Reload the latest data">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 ${opts.refreshing ? 'animate-spin' : ''}"></i> Refresh
                            </button>
                        </div>
                    </div>
                    ${total ? `
                    <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${stat(total, 'Total projects', 'all')}
                        ${stat(pendingCount, 'Awaiting sign-off', 'pending')}
                        ${stat(signedOffCount, 'Signed off', 'signed')}
                        ${stat(stalledCount, `Stalled ${STALLED_DAYS}+ days`, 'attention')}
                    </div>` : ''}
                </div>

                ${total ? `
                <div class="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-col md:flex-row gap-3 md:items-center">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                        <input type="search" value="${escapeHtml(supView.q)}" oninput="window.supSetSearch(this.value)" placeholder="Search by project title or trainee…" aria-label="Search supervised projects"
                            class="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                    </div>
                    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects">
                        ${SUP_FILTERS.map(f => `<button onclick="window.supSetFilter('${f.key}')" class="px-3 py-1.5 rounded-lg text-xs font-bold border ${supView.filter === f.key ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${f.label}</button>`).join('')}
                    </div>
                    <select onchange="window.supSetSort(this.value)" aria-label="Sort projects" class="border border-slate-200 rounded-lg text-sm px-2 py-2 bg-white">
                        ${[['pending', 'Awaiting sign-off first'], ['recent', 'Most recently active'], ['readiness-desc', 'Readiness: high to low'], ['title', 'Title A–Z'], ['trainee', 'Trainee A–Z']]
                            .map(([k, l]) => `<option value="${k}" ${supView.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                </div>
                <p id="sup-visible-count" class="text-xs text-slate-400 mb-2"></p>` : ''}

                <div id="sup-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>

                <div class="mt-6 text-center">
                    <button onclick="window.returnToProjects()" class="text-slate-500 hover:text-slate-700 text-sm underline">Switch to my own projects</button>
                </div>
            </div>
        </div>
    `;
    renderSupCards();
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

function rerenderSup() {
    if (supLast.container) renderSupervisorOverview(supLast.container, supLast.projects, supLast.opts);
}
window.supSetSearch = function(v) { supView.q = v || ''; renderSupCards(); };
window.supSetFilter = function(f) { supView.filter = f; rerenderSup(); };
window.supSetSort = function(s) { supView.sort = s; renderSupCards(); };
window.supResetFilters = function() { supView.q = ''; supView.filter = 'all'; rerenderSup(); };

// ─── SLO 11 tab ──────────────────────────────────────────────────────────────
// Three audiences share this tab:
//   - the reviewing Clinical/Educational Supervisor (state.isSupervisorViewing):
//     can comment, sign off and revoke;
//   - the trainee on their own project: sees the supervisor's comments and
//     sign-off status read-only (a trainee cannot sign off their own QIP);
//   - anyone else browsing read-only (QIP Lead, share link): read-only.
function supervisorAtAGlance(d) {
    const r = computeReadiness(d);
    const missing = r.criteria.filter(c => !c.met && c.label !== 'Supervisor Signed Off').map(c => c.label);
    const last = lastActivityDate(d);
    return `
        <div class="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 mb-5">
            <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
                <h3 class="font-bold text-slate-800 flex items-center gap-2"><i data-lucide="gauge" class="w-4 h-4 text-teal-600"></i> At a glance</h3>
                <div class="flex flex-wrap gap-2">
                    <button onclick="window.router('data')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"><i data-lucide="line-chart" class="w-3.5 h-3.5"></i> Charts</button>
                    <button onclick="window.router('pdsa')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> PDSA cycles</button>
                    <button onclick="window.router('full')" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"><i data-lucide="file-text" class="w-3.5 h-3.5"></i> Whole project</button>
                    <button onclick="document.getElementById('slo11-signoff')?.scrollIntoView({ behavior: 'smooth', block: 'start' })" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1"><i data-lucide="arrow-down" class="w-3.5 h-3.5"></i> Jump to sign-off</button>
                </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div class="bg-slate-50 rounded-lg p-3"><div class="text-xl font-bold text-slate-800">${r.percent}%</div><div class="text-[11px] text-slate-500">Portfolio readiness</div></div>
                <div class="bg-slate-50 rounded-lg p-3"><div class="text-xl font-bold text-slate-800">${(d.pdsa || []).length}</div><div class="text-[11px] text-slate-500">PDSA cycles</div></div>
                <div class="bg-slate-50 rounded-lg p-3"><div class="text-xl font-bold text-slate-800">${allMeasurePoints(d).length}</div><div class="text-[11px] text-slate-500">Data points</div></div>
                <div class="bg-slate-50 rounded-lg p-3"><div class="text-sm font-bold text-slate-800 mt-1">${escapeHtml(activityLabel(last ? last.toISOString() : ''))}</div><div class="text-[11px] text-slate-500">Last activity</div></div>
            </div>
            ${missing.length ? `<p class="text-xs text-slate-500 mt-3"><strong class="text-slate-600">Not yet evidenced:</strong> ${missing.map(escapeHtml).join(' · ')}</p>`
                : `<p class="text-xs text-emerald-700 mt-3 font-semibold">All readiness criteria are evidenced.</p>`}
        </div>`;
}

export function renderSupervisorDashboard() {
    const container = document.getElementById('view-supervisor');
    if (!container) return;

    const projectData = state.projectData;
    if (!projectData) return;
    if (!projectData.assessment) projectData.assessment = {};
    const assessment = projectData.assessment;
    ['supervisorComments', 'signedOffBy', 'signedOffByUid', 'signedOffByEmail', 'signedOffGmc', 'signedOffDate', 'lastSupervisorActivityAt', 'traineeSeenAt']
        .forEach(k => { if (assessment[k] === undefined || assessment[k] === null) assessment[k] = ''; });
    if (assessment.signedOff === undefined) assessment.signedOff = false;

    const isSupervisor = !!state.isSupervisorViewing;
    const isOwner = !state.isReadOnly && !isSupervisor;

    // Trainee opening their own tab — if the supervisor has left new comments or
    // changed sign-off status since they last looked, show a banner and mark it
    // seen so the sidebar badge clears.
    const hasUnseenSupervisorActivity = isOwner
        && assessment.lastSupervisorActivityAt
        && assessment.lastSupervisorActivityAt > assessment.traineeSeenAt;
    if (hasUnseenSupervisorActivity) {
        assessment.traineeSeenAt = new Date().toISOString();
        if (window.saveData) window.saveData(true); // bookkeeping, not an Undo step
    }
    if (window.updateSupervisorNavBadge) window.updateSupervisorNavBadge();

    const title = projectData.meta?.title || 'Trainee QIP';
    const reviewingBanner = isSupervisor ? `
        <div class="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-5 py-4 rounded-xl mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div class="flex items-center gap-3 flex-1">
                <div class="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i data-lucide="user-check" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="font-bold text-base">Supervisor Review Mode</div>
                    <div class="text-teal-200 text-xs mt-0.5">You are reviewing: <strong class="text-white">${escapeHtml(title)}</strong></div>
                </div>
            </div>
            <button onclick="window.exitReadOnlyReview()" class="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Supervisor Overview
            </button>
        </div>` : '';

    const traineeActivityBanner = hasUnseenSupervisorActivity ? `
        <div class="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl mb-5 flex items-center gap-3 text-sm">
            <i data-lucide="bell" class="w-5 h-5 flex-shrink-0"></i>
            <span>Your supervisor has left new comments or updated the sign-off status on this project since you last checked.</span>
        </div>` : '';

    const signedOffLine = assessment.signedOff
        ? `Signed off by ${escapeHtml(assessment.signedOffBy || 'supervisor')}${assessment.signedOffGmc ? ' (GMC ' + escapeHtml(assessment.signedOffGmc) + ')' : ''}${assessment.signedOffDate ? ' on ' + escapeHtml(assessment.signedOffDate) : ''}`
        : '';

    let reviewSection;
    if (isSupervisor) {
        const signerIdentity = state.currentUser
            ? escapeHtml(state.currentUser.displayName || state.currentUser.email || 'Unknown account')
            : 'Not signed in';
        reviewSection = `
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded" data-readonly-allow>
                <h3 class="font-bold text-blue-800 mb-3">Supervisor Review</h3>
                <label for="sup-comments" class="sr-only">Supervisor comments</label>
                <textarea id="sup-comments" class="w-full border border-slate-300 rounded p-3 mb-3 text-sm md:text-base" rows="4" placeholder="Supervisor comments regarding progress against the 2025 curriculum requirements...">${escapeHtml(assessment.supervisorComments)}</textarea>
                <button onclick="window.saveSupervisorComments()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto mb-6">Save Comments</button>

                <div class="border-t border-blue-200 pt-6">
                    ${assessment.signedOff ?
                        `<div class="bg-emerald-100 text-emerald-800 p-4 rounded flex flex-col md:flex-row items-start md:items-center gap-3 font-bold">
                            <i data-lucide="check-circle" class="w-6 h-6 shrink-0"></i>
                            <span>${signedOffLine}</span>
                            <button onclick="window.revokeSignOff()" class="mt-2 md:mt-0 md:ml-auto text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 w-full md:w-auto">Revoke Sign-off</button>
                        </div>` :
                        `<div class="mb-2 text-xs text-slate-500">Signing in as <strong class="text-slate-700">${signerIdentity}</strong> — the sign-off is tied to this logged-in account, not free text, and is logged for audit.</div>
                         <div class="flex flex-col md:flex-row gap-2">
                             <input type="text" id="sup-gmc" inputmode="numeric" maxlength="7" class="w-full md:w-2/3 border border-slate-300 rounded p-2 text-sm md:text-base" placeholder="GMC number (optional but recommended)">
                             <button onclick="window.signOffProject()" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 w-full md:w-1/3">Sign Off for ARCP</button>
                         </div>`
                    }
                </div>
            </div>`;
    } else {
        const comments = assessment.supervisorComments
            ? `<div class="bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 whitespace-pre-line">${escapeHtml(assessment.supervisorComments)}</div>`
            : `<p class="text-sm text-slate-400 italic">No supervisor comments yet.</p>`;
        const status = assessment.signedOff
            ? `<div class="bg-emerald-100 text-emerald-800 p-4 rounded flex items-center gap-3 font-bold"><i data-lucide="check-circle" class="w-6 h-6 shrink-0"></i><span>${signedOffLine}</span></div>`
            : `<div class="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded text-sm flex items-start gap-3">
                    <i data-lucide="clock" class="w-5 h-5 shrink-0 mt-0.5"></i>
                    <div><strong>Not yet signed off.</strong> ${isOwner
                        ? 'Your supervisor signs off from their own account. Add their email under <button onclick="window.openGlobalSettings && window.openGlobalSettings()" class="underline font-semibold">Settings → Project access</button>, then they can review this form and sign off.'
                        : 'Only the trainee\'s named Clinical or Educational Supervisor can sign off this project.'}</div>
               </div>`;
        reviewSection = `
            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 class="font-bold text-blue-800 mb-3">Supervisor Review</h3>
                ${comments}
                <div class="border-t border-blue-200 pt-4 mt-4">${status}</div>
            </div>`;
    }

    container.innerHTML = reviewingBanner + traineeActivityBanner + (isSupervisor ? supervisorAtAGlance(projectData) : '') + `
        <div id="emqiat-form-container"></div>

        <div id="slo11-signoff" class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 mb-6 scroll-mt-24">
            <h2 class="text-xl md:text-2xl font-bold text-slate-800 mb-1">SLO 11 Supervisor Review &amp; Sign-off</h2>
            <p class="text-slate-600 mb-6 text-sm md:text-base">Your Educational or Clinical Supervisor reviews the EM-QIAT above and signs off here before your ARCP.</p>
            ${reviewSection}
        </div>

        ${isOwner ? '<div id="qip-lead-panel" class="mt-4"></div>' : ''}
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // The real EM-QIAT form — editable for the trainee, read-only for everyone else.
    const emqiatContainer = document.getElementById('emqiat-form-container');
    if (emqiatContainer) renderEMQIATForm(emqiatContainer, { readOnly: !isOwner });

    // The QIP Lead management panel manages the trainee's own invites, so it is
    // only shown on the trainee's own project.
    if (isOwner && typeof window.renderQIPLeadPanelFn === 'function') {
        window.renderQIPLeadPanelFn();
    }
}

// Persists the SLO 11 assessment via the dedicated assessment-only write path,
// so a reviewing supervisor never writes the rest of the trainee's project.
function persistAssessment() {
    if (state.projectData && state.projectData.assessment) {
        state.projectData.assessment.lastSupervisorActivityAt = new Date().toISOString();
    }
    return window.saveSupervisorAssessment();
}

function requireSupervisor() {
    if (!state.isSupervisorViewing) {
        showToast('Only the trainee\'s supervisor can do this, from their own account.', 'error');
        return false;
    }
    return true;
}

window.saveSupervisorComments = async () => {
    if (!requireSupervisor()) return;
    const comments = document.getElementById('sup-comments')?.value || '';
    state.projectData.assessment.supervisorComments = comments;
    await persistAssessment();
    showToast('Supervisor comments saved.', 'success');
};

// Sign-off is tied to the reviewer's authenticated account (name/email from
// state.currentUser) rather than a free-typed name.
window.signOffProject = () => {
    if (!requireSupervisor()) return;
    if (!state.currentUser) {
        showToast('You must be signed in to sign off this project.', 'error');
        return;
    }
    const gmc = (document.getElementById('sup-gmc')?.value || '').trim();
    if (gmc && !/^\d{7}$/.test(gmc)) {
        showToast('A GMC number is 7 digits — please check it or leave it blank.', 'error');
        return;
    }
    // Keep any comments typed but not yet saved.
    const typed = document.getElementById('sup-comments');
    if (typed) state.projectData.assessment.supervisorComments = typed.value;
    const identity = state.currentUser.displayName || state.currentUser.email || 'Unknown account';
    window.showConfirmDialog(
        `Confirm sign-off as "${identity}"${gmc ? ' (GMC ' + gmc + ')' : ''}? This formally certifies this QIP meets the RCEM SLO 11 requirement. It can be revoked but creates a permanent audit trail tied to your account.`,
        async () => {
            const a = state.projectData.assessment;
            a.signedOff = true;
            a.signedOffBy = identity;
            a.signedOffByUid = state.currentUser.uid || '';
            a.signedOffByEmail = state.currentUser.email || '';
            a.signedOffGmc = gmc;
            a.signedOffDate = new Date().toLocaleDateString('en-GB');
            await persistAssessment();
            logProjectAccessEvent(db, {
                viewerUid: state.currentUser.uid,
                viewerEmail: state.currentUser.email,
                viaRole: 'supervisor',
                ownerUid: state.supervisorTargetUid,
                projectId: state.currentProjectId,
                projectTitle: state.projectData.meta?.title || 'Untitled QIP',
                action: 'signed_off'
            });
            renderSupervisorDashboard();
            showToast('Project signed off for ARCP.', 'success');
        },
        'Confirm Sign-off',
        'Sign Off for ARCP'
    );
};

window.revokeSignOff = () => {
    if (!requireSupervisor()) return;
    window.showConfirmDialog(
        'Revoke this supervisor sign-off? The project will return to unsigned status.',
        async () => {
            const a = state.projectData.assessment;
            a.signedOff = false;
            a.signedOffBy = '';
            a.signedOffByUid = '';
            a.signedOffByEmail = '';
            a.signedOffGmc = '';
            a.signedOffDate = '';
            await persistAssessment();
            if (state.currentUser) {
                logProjectAccessEvent(db, {
                    viewerUid: state.currentUser.uid,
                    viewerEmail: state.currentUser.email,
                    viaRole: 'supervisor',
                    ownerUid: state.supervisorTargetUid,
                    projectId: state.currentProjectId,
                    projectTitle: state.projectData.meta?.title || 'Untitled QIP',
                    action: 'signoff_revoked'
                });
            }
            renderSupervisorDashboard();
            showToast('Sign-off revoked.', 'info');
        },
        'Revoke',
        'Revoke Sign-off'
    );
};
