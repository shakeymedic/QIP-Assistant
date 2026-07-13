// qip-lead.js  — Departmental QIP Lead functionality
import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

// ─── Check whether the logged-in user is a QIP Lead ───────────────────────────
// Returns the lead's project list (may be empty) from qipLeadInvites/{email}
export async function getQIPLeadProjects(db, userEmail) {
    if (!db || !userEmail) return [];
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDoc(doc(db, 'qipLeadInvites', userEmail));
        if (snap.exists()) {
            return snap.data().projects || [];
        }
    } catch (e) {
        console.warn('[QIPLead] Could not fetch lead data:', e);
    }
    return [];
}

// ─── Add a QIP Lead to the current project ────────────────────────────────────
export async function addQIPLeadToProject(db, ownerUid, projectId, leadEmail, traineeName, projectTitle) {
    if (!db || !leadEmail || !ownerUid || !projectId) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
        showToast('Please enter a valid email address.', 'error');
        return false;
    }
    try {
        const { doc, setDoc, arrayUnion, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const entry = {
            ownerUid,
            projectId,
            projectTitle: projectTitle || 'Untitled QIP',
            traineeName: traineeName || ownerUid,
            addedAt: new Date().toISOString()
        };
        await setDoc(
            doc(db, 'qipLeadInvites', leadEmail),
            { email: leadEmail, projects: arrayUnion(entry) },
            { merge: true }
        );
        showToast(`QIP Lead invite sent to ${leadEmail}`, 'success');
        return true;
    } catch (e) {
        console.error('[QIPLead] addQIPLead error:', e);
        showToast('Failed to add QIP Lead — check your connection.', 'error');
        return false;
    }
}

// ─── Remove a QIP Lead from a project ────────────────────────────────────────
export async function removeQIPLeadFromProject(db, ownerUid, projectId, leadEmail) {
    if (!db || !leadEmail) return;
    try {
        const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const ref = doc(db, 'qipLeadInvites', leadEmail);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const projects = (snap.data().projects || []).filter(
            p => !(p.ownerUid === ownerUid && p.projectId === projectId)
        );
        await setDoc(ref, { email: leadEmail, projects }, { merge: false });
        showToast(`Removed ${leadEmail} as QIP Lead.`, 'success');
    } catch (e) {
        console.error('[QIPLead] removeQIPLead error:', e);
    }
}

// ─── Render QIP Lead panel inside supervisor view ─────────────────────────────
// Called from renderSupervisorDashboard to add the "Manage QIP Leads" section
export function renderQIPLeadPanel(container, db, ownerUid, projectId) {
    if (!container) return;
    const leads = state.projectData?.qipLeads || [];

    container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-5">
            <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2">
                <i data-lucide="users" class="w-4 h-4 text-indigo-500"></i>
                Departmental QIP Leads
            </h3>
            <p class="text-xs text-slate-500 mb-4">Add a Departmental QIP Lead by email. They can log in to view this project and all other projects where they're listed as lead — with a summary dashboard.</p>

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

// ─── Render QIP Lead Dashboard (shown instead of project list) ────────────────
export function renderQIPLeadDashboard(container, leadProjects, onViewProject) {
    if (!container) return;

    const total = leadProjects.length;

    container.innerHTML = `
        <div class="min-h-screen bg-slate-50 p-6">
            <!-- Header -->
            <div class="max-w-5xl mx-auto">
                <div class="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-2xl p-6 mb-6 text-white shadow-lg">
                    <div class="flex items-center gap-4">
                        <img src="./logo.png" alt="Logo" class="h-12 rounded-xl bg-white/10 p-1">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-1">Departmental QIP Lead Portal</div>
                            <h1 class="text-2xl font-bold">QIP Supervision Dashboard</h1>
                            <p class="text-indigo-200 text-sm mt-1">You are supervising ${total} QIP project${total !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div class="mt-4 grid grid-cols-3 gap-4">
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${total}</div>
                            <div class="text-xs text-indigo-200 mt-0.5">Total Projects</div>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${leadProjects.filter(p => p._data?.pdsa?.length > 0).length}</div>
                            <div class="text-xs text-indigo-200 mt-0.5">Active (PDSA started)</div>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${leadProjects.filter(p => (p._progress || 0) >= 75).length}</div>
                            <div class="text-xs text-indigo-200 mt-0.5">Near Completion</div>
                        </div>
                    </div>
                </div>

                <!-- Project cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${leadProjects.map((proj, i) => {
                        const d = proj._data || {};
                        const meta = d.meta || {};
                        const pdsa = d.pdsa || [];
                        // Sum data points across all measures if the project has multiple
                        // measures; falls back to the legacy flat chartData otherwise.
                        const chartData = Array.isArray(d.measures) && d.measures.length > 0
                            ? d.measures.reduce((acc, m) => acc.concat(Array.isArray(m.chartData) ? m.chartData : []), [])
                            : (d.chartData || []);
                        const progress = proj._progress || 0;
                        const lastPdsa = pdsa.length > 0 ? pdsa[pdsa.length - 1] : null;
                        const progressColor = progress >= 75 ? 'bg-emerald-500' : progress >= 40 ? 'bg-amber-500' : 'bg-slate-300';

                        return `
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                            <div class="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
                                <h3 class="font-bold text-white text-sm leading-tight">${escapeHtml(meta.title || proj.projectTitle || 'Untitled QIP')}</h3>
                                <p class="text-slate-300 text-xs mt-1">Trainee: ${escapeHtml(proj.traineeName || 'Unknown')}</p>
                            </div>
                            <div class="p-4">
                                <!-- Progress bar -->
                                <div class="mb-3">
                                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                                        <span>Progress</span><span class="font-bold">${progress}%</span>
                                    </div>
                                    <div class="h-2 bg-slate-100 rounded-full">
                                        <div class="${progressColor} h-2 rounded-full transition-all" style="width:${progress}%"></div>
                                    </div>
                                </div>

                                <!-- Key stats -->
                                <div class="grid grid-cols-3 gap-2 mb-4 text-center">
                                    <div class="bg-slate-50 rounded-lg p-2">
                                        <div class="font-bold text-slate-800">${chartData.length}</div>
                                        <div class="text-[10px] text-slate-400">Data pts</div>
                                    </div>
                                    <div class="bg-slate-50 rounded-lg p-2">
                                        <div class="font-bold text-slate-800">${pdsa.length}</div>
                                        <div class="text-[10px] text-slate-400">PDSA cycles</div>
                                    </div>
                                    <div class="bg-slate-50 rounded-lg p-2">
                                        <div class="font-bold text-slate-800">${d.teamMembers?.length || 0}</div>
                                        <div class="text-[10px] text-slate-400">Team</div>
                                    </div>
                                </div>

                                ${lastPdsa ? `
                                <div class="bg-indigo-50 rounded-lg px-3 py-2 mb-3 text-xs">
                                    <span class="font-bold text-indigo-700">Latest PDSA:</span>
                                    <span class="text-slate-600 ml-1">${escapeHtml(lastPdsa.title || 'Untitled')}</span>
                                    ${lastPdsa.startDate ? `<span class="text-slate-400 ml-2">${lastPdsa.startDate}</span>` : ''}
                                </div>` : ''}

                                <button onclick="window.viewLeadProject(${i})"
                                    class="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                    <i data-lucide="eye" class="w-4 h-4"></i> View Full Project
                                </button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>

                <div class="mt-6 text-center">
                    <button onclick="window.switchToOwnProjects && window.switchToOwnProjects()"
                        class="text-slate-500 hover:text-slate-700 text-sm underline">
                        Switch to my own projects
                    </button>
                </div>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
