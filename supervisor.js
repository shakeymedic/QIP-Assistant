// supervisor.js
import { state } from "./state.js";
import { showToast, escapeHtml } from "./utils.js";
import { renderQIPLeadPanel } from "./qip-lead.js";

// ─── Render Supervisor Overview (shown instead of project list) ───────────────
// Mirrors renderQIPLeadDashboard's visual pattern (qip-lead.js), teal-themed,
// with an added sign-off status badge and two actions per card: view read-only
// vs. jump straight into the SLO 11 review/sign-off form.
export function renderSupervisorOverview(container, supervisedProjects, onViewFull, onReview) {
    if (!container) return;

    const total = supervisedProjects.length;
    const signedOffCount = supervisedProjects.filter(p => p._signedOff).length;
    const pendingCount = total - signedOffCount;

    if (total === 0) {
        container.innerHTML = `
            <div class="min-h-screen bg-slate-50 p-6">
                <div class="max-w-3xl mx-auto">
                    <div class="bg-gradient-to-r from-teal-700 to-teal-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
                        <div class="flex items-center gap-4">
                            <img src="./logo.png" alt="Logo" class="h-12 rounded-xl bg-white/10 p-1">
                            <div>
                                <div class="text-xs font-bold uppercase tracking-widest text-teal-200 mb-1">Clinical Supervisor Portal</div>
                                <h1 class="text-2xl font-bold">Supervisor Overview</h1>
                                <p class="text-teal-100 text-sm mt-1">No trainees have shared a QIP with you yet.</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                        <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
                        <p class="text-slate-500 text-sm">Once a trainee adds you as their Clinical or Educational Supervisor, their project will appear here for you to review and sign off.</p>
                        <button onclick="window.switchToOwnProjects && window.switchToOwnProjects()" class="mt-4 text-teal-600 hover:text-teal-800 text-sm font-bold underline">Switch to my own projects</button>
                    </div>
                </div>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = `
        <div class="min-h-screen bg-slate-50 p-6">
            <div class="max-w-5xl mx-auto">
                <!-- Header -->
                <div class="bg-gradient-to-r from-teal-700 to-teal-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
                    <div class="flex items-center gap-4">
                        <img src="./logo.png" alt="Logo" class="h-12 rounded-xl bg-white/10 p-1">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-widest text-teal-200 mb-1">Clinical Supervisor Portal</div>
                            <h1 class="text-2xl font-bold">Supervisor Overview</h1>
                            <p class="text-teal-100 text-sm mt-1">You are supervising ${total} QIP project${total !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div class="mt-4 grid grid-cols-3 gap-4">
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${total}</div>
                            <div class="text-xs text-teal-100 mt-0.5">Total Projects</div>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${pendingCount}</div>
                            <div class="text-xs text-teal-100 mt-0.5">Pending Sign-off</div>
                        </div>
                        <div class="bg-white/10 rounded-xl p-3 text-center">
                            <div class="text-2xl font-bold">${signedOffCount}</div>
                            <div class="text-xs text-teal-100 mt-0.5">Signed Off</div>
                        </div>
                    </div>
                </div>

                <!-- Project cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${supervisedProjects.map((proj, i) => {
                        const d = proj._data || {};
                        const meta = d.meta || {};
                        const pdsa = d.pdsa || [];
                        const chartData = Array.isArray(d.measures) && d.measures.length > 0
                            ? d.measures.reduce((acc, m) => acc.concat(Array.isArray(m.chartData) ? m.chartData : []), [])
                            : (d.chartData || []);
                        const progress = proj._progress || 0;
                        const progressColor = progress >= 75 ? 'bg-emerald-500' : progress >= 40 ? 'bg-amber-500' : 'bg-slate-300';
                        const signedOff = !!proj._signedOff;
                        const statusBadge = signedOff
                            ? `<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="check-circle" class="w-3 h-3"></i> Signed off</span>`
                            : `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full"><i data-lucide="clock" class="w-3 h-3"></i> Pending sign-off</span>`;

                        return `
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                            <div class="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
                                <h3 class="font-bold text-white text-sm leading-tight">${escapeHtml(meta.title || proj.projectTitle || 'Untitled QIP')}</h3>
                                <p class="text-slate-300 text-xs mt-1">Trainee: ${escapeHtml(proj.traineeName || 'Unknown')}</p>
                            </div>
                            <div class="p-4">
                                <div class="mb-3">${statusBadge}</div>

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

                                <div class="grid grid-cols-2 gap-2">
                                    <button onclick="window.viewSupervisedProjectReadOnly(${i})"
                                        class="w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5">
                                        <i data-lucide="eye" class="w-3.5 h-3.5"></i> View Full Project
                                    </button>
                                    <button onclick="window.reviewSupervisedProject(${i})"
                                        class="w-full bg-teal-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5">
                                        <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i> Review &amp; Sign Off
                                    </button>
                                </div>
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

export function renderSupervisorDashboard() {
    const container = document.getElementById('view-supervisor');
    if (!container) return;
    
    const projectData = state.projectData;
    if (!projectData) return;
    if (!projectData.assessment) {
        projectData.assessment = {
            traineeLevel: 'core',
            capabilitiesMet: [],
            supervisorComments: '',
            signedOff: false,
            signedOffBy: '',
            signedOffDate: '',
            lastSupervisorActivityAt: '',
            traineeSeenAt: ''
        };
    }

    const assessment = projectData.assessment;
    if (assessment.lastSupervisorActivityAt === undefined) assessment.lastSupervisorActivityAt = '';
    if (assessment.traineeSeenAt === undefined) assessment.traineeSeenAt = '';

    // Trainee (not the supervisor) is opening this tab — if the supervisor has
    // left new comments or changed sign-off status since the trainee last looked,
    // show a banner and mark it seen so the sidebar badge clears.
    const hasUnseenSupervisorActivity = !state.isSupervisorViewing
        && assessment.lastSupervisorActivityAt
        && assessment.lastSupervisorActivityAt > assessment.traineeSeenAt;
    if (hasUnseenSupervisorActivity) {
        assessment.traineeSeenAt = new Date().toISOString();
        if (window.saveData) window.saveData();
    }
    if (window.updateSupervisorNavBadge) window.updateSupervisorNavBadge();

    const coreChecked = assessment.traineeLevel === 'core' ? 'checked' : '';
    const intChecked = assessment.traineeLevel === 'intermediate' ? 'checked' : '';
    const higherChecked = assessment.traineeLevel === 'higher' ? 'checked' : '';

    const cap1Checked = assessment.capabilitiesMet.includes('cap1') ? 'checked' : '';
    const cap2Checked = assessment.capabilitiesMet.includes('cap2') ? 'checked' : '';
    const cap3Checked = assessment.capabilitiesMet.includes('cap3') ? 'checked' : '';

    // Build supervisor-review banner (shown when a supervisor is reviewing a trainee's project)
    const reviewingBanner = state.isLeadViewing ? `
        <div class="bg-gradient-to-r from-teal-700 to-teal-600 text-white px-5 py-4 rounded-xl mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div class="flex items-center gap-3 flex-1">
                <div class="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i data-lucide="user-check" class="w-5 h-5"></i>
                </div>
                <div>
                    <div class="font-bold text-base">Supervisor Review Mode</div>
                    <div class="text-teal-200 text-xs mt-0.5">You are reviewing: <strong class="text-white">${projectData.meta?.title || 'Trainee QIP'}</strong></div>
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

    container.innerHTML = reviewingBanner + traineeActivityBanner + `
        <div class="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <h2 class="text-xl md:text-2xl font-bold text-slate-800 mb-4">SLO 11 Mapping and Supervisor Sign-off</h2>
            <p class="text-slate-600 mb-6 text-sm md:text-base">Use this dashboard to map your project to the RCEM Key Capabilities. Your Educational or Clinical Supervisor must review and sign off on this section before your ARCP.</p>
            
            <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded">
                <h3 class="font-bold text-slate-800 mb-3">1. Current Trainee Level</h3>
                <div class="flex flex-col md:flex-row gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="core" ${coreChecked} onchange="window.updateAssesmentLevel('core')"> 
                        <span>Core (ACCS)</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="intermediate" ${intChecked} onchange="window.updateAssesmentLevel('intermediate')"> 
                        <span>Intermediate</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="t_level" value="higher" ${higherChecked} onchange="window.updateAssesmentLevel('higher')"> 
                        <span>Higher (HST)</span>
                    </label>
                </div>
            </div>

            <div class="mb-6 p-4 bg-slate-50 border border-slate-200 rounded">
                <h3 class="font-bold text-slate-800 mb-3">2. Key Capabilities Demonstrated</h3>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap1" ${cap1Checked} onchange="window.toggleCapability('cap1', this.checked)"> 
                    <span class="text-sm md:text-base">Contribute effectively to a departmental quality improvement project (Core Requirement).</span>
                </label>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap2" ${cap2Checked} onchange="window.toggleCapability('cap2', this.checked)"> 
                    <span class="text-sm md:text-base">Describe involvement, show an understanding of QI methods, and reflect on the project (Intermediate Requirement).</span>
                </label>
                <label class="flex items-start gap-3 mb-3 cursor-pointer">
                    <input type="checkbox" class="mt-1" value="cap3" ${cap3Checked} onchange="window.toggleCapability('cap3', this.checked)"> 
                    <span class="text-sm md:text-base">Provide clinical leadership on effective QI work and support a culture of safety (Higher Requirement).</span>
                </label>
            </div>

            <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 class="font-bold text-blue-800 mb-3">3. Supervisor Review</h3>
                <textarea id="sup-comments" class="w-full border border-slate-300 rounded p-3 mb-3 text-sm md:text-base" rows="4" placeholder="Supervisor comments regarding progress against the 2025 curriculum requirements...">${assessment.supervisorComments}</textarea>
                <button onclick="window.saveSupervisorComments()" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 w-full md:w-auto mb-6">Save Comments</button>
                
                <div class="border-t border-blue-200 pt-6">
                    ${assessment.signedOff ? 
                        `<div class="bg-emerald-100 text-emerald-800 p-4 rounded flex flex-col md:flex-row items-start md:items-center gap-3 font-bold">
                            <i data-lucide="check-circle" class="w-6 h-6 shrink-0"></i> 
                            <span>Signed off by ${assessment.signedOffBy} on ${assessment.signedOffDate}</span>
                            <button onclick="window.revokeSignOff()" class="mt-2 md:mt-0 md:ml-auto text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 w-full md:w-auto">Revoke Sign-off</button>
                        </div>` : 
                        `<div class="flex flex-col md:flex-row gap-2">
                             <input type="text" id="sup-name" class="w-full md:w-2/3 border border-slate-300 rounded p-2 text-sm md:text-base" placeholder="Supervisor Name and GMC Number">
                             <button onclick="window.signOffProject()" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 w-full md:w-1/3">Sign Off for ARCP</button>
                         </div>`
                    }
                </div>
            </div>
        </div>

        <!-- QIP Lead management panel — re-injected here so getElementById finds it -->
        ${!state.isSupervisorViewing ? '<div id="qip-lead-panel" class="mt-4"></div>' : ''}
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Now the panel div exists in DOM — populate it. Skipped while a supervisor is
    // reviewing someone else's project: this panel manages the trainee's own QIP
    // Lead invites and is irrelevant (and unsafe to touch) during another user's review.
    if (!state.isSupervisorViewing && typeof window.renderQIPLeadPanelFn === 'function') {
        window.renderQIPLeadPanelFn();
    }
}

// Persists the SLO 11 assessment. When a supervisor is reviewing a trainee's
// project (read-only browsing everywhere else), this routes through the
// dedicated assessment-only write path so the sign-off still saves without
// opening up the rest of the project to edits. Otherwise (a trainee filling in
// their own self-assessment) it goes through the normal save.
function persistAssessment() {
    if (state.isSupervisorViewing) {
        // Stamp the activity timestamp BEFORE saving so the trainee sees a banner
        // and sidebar badge next time they open their own project.
        if (state.projectData && state.projectData.assessment) {
            state.projectData.assessment.lastSupervisorActivityAt = new Date().toISOString();
        }
        window.saveSupervisorAssessment();
    } else {
        window.saveData();
    }
}

window.updateAssesmentLevel = (level) => {
    state.projectData.assessment.traineeLevel = level;
    persistAssessment();
};

window.toggleCapability = (cap, isChecked) => {
    const assessment = state.projectData.assessment;
    if (isChecked && !assessment.capabilitiesMet.includes(cap)) {
        assessment.capabilitiesMet.push(cap);
    } else if (!isChecked) {
        assessment.capabilitiesMet = assessment.capabilitiesMet.filter(c => c !== cap);
    }
    persistAssessment();
};

window.saveSupervisorComments = () => {
    const comments = document.getElementById('sup-comments').value;
    state.projectData.assessment.supervisorComments = comments;
    persistAssessment();
    showToast('Supervisor comments saved successfully.', 'success');
};

window.signOffProject = () => {
    const name = document.getElementById('sup-name').value.trim();
    if (!name) { 
        showToast('Please enter your name and GMC number before signing off.', 'error'); 
        return; 
    }
    window.showConfirmDialog(
        `Confirm sign-off as "${name}"? This formally certifies this QIP meets the RCEM Key Capabilities. It can be revoked but creates a permanent audit trail.`,
        () => {
            state.projectData.assessment.signedOff = true;
            state.projectData.assessment.signedOffBy = name;
            state.projectData.assessment.signedOffDate = new Date().toLocaleDateString('en-GB');
            persistAssessment();
            renderSupervisorDashboard();
            showToast('Project signed off for ARCP.', 'success');
        },
        'Confirm Sign-off',
        'Sign Off for ARCP'
    );
};

window.revokeSignOff = () => {
    window.showConfirmDialog(
        'Revoke this supervisor sign-off? The project will return to unsigned status.',
        () => {
            state.projectData.assessment.signedOff = false;
            state.projectData.assessment.signedOffBy = '';
            state.projectData.assessment.signedOffDate = '';
            persistAssessment();
            renderSupervisorDashboard();
            showToast('Sign-off revoked.', 'info');
        },
        'Revoke',
        'Revoke Sign-off'
    );
};
