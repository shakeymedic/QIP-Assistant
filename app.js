import { auth, db, getFirebaseStatus } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, collectionGroup, onSnapshot, addDoc, deleteDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ─── Master Admin ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'emevidence999@gmail.com';

import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";
window.showToast = showToast; // expose for non-module files (e.g. patient-tracker.js)
import { callAI } from "./ai.js";

import { 
    renderChart, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, 
    zoomIn, zoomOut, resetZoom, resetProcess, 
    setToolMode, setChartMode, updateChartEducation, renderTools, toolMode,
    openChartSettings, saveChartSettings, copyChartImage, renderFullViewChart,
    toggleToolHelp
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";
import { startOnboarding } from "./onboarding.js";
import { exportToKaizen } from "./kaizen-export.js";
import { renderSupervisorDashboard } from "./supervisor.js";

import { renderSurveys, addSurvey, deleteSurvey, importSurveyCSV, updateSurveySummary, updateSurveyTitle, aiAnalyseSurvey } from "./surveys.js";

console.log('App starting...');
window._qipModules = { state }; // expose for export functions
// Expose QIP Lead panel renderer for supervisor.js
window.renderQIPLeadPanelFn = function() {
    const panel = document.getElementById('qip-lead-panel');
    if (panel && state.currentUser) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
};

// QIP Lead runtime state
state.isQIPLead = false;
state.qipLeadProjects = [];

// Master Admin runtime state
state.isMasterAdmin = false;
state.adminAllProjects = [];

(function cleanURL() {
    const url = new URL(window.location.href);
    const sensitiveParams = ['password', 'pass', 'pwd', 'passwd', 'secret', 'token', 'key', 'apikey'];
    let needsClean = false;
    
    sensitiveParams.forEach(param => {
        if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            needsClean = true;
        }
    });
    
    if (url.searchParams.has('email') && !url.searchParams.has('share')) {
        url.searchParams.delete('email');
        needsClean = true;
    }
    
    if (needsClean) {
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
})();

Object.defineProperty(window, 'projectData', { get: () => state.projectData, set: (v) => state.projectData = v });

window.router = (view) => {
    if (view !== 'projects' && !state.projectData) { 
        showToast("Please select a project first.", "error"); 
        return; 
    }
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('z-50')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }

    if (view === 'supervisor') {
        renderSupervisorDashboard();
    } else {
        R.renderAll(view);
    }
};

// ==========================================
// HOW-TO GUIDE MODAL
// ==========================================
window.showHowTo = function() {
    const m = document.getElementById('howto-modal');
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.howtoNav = function(view) {
    window.closeHowTo();
    if (state.projectData) {
        window.router(view);
    } else {
        showToast('Open a project first to navigate there.', 'info');
    }
};

window.closeHowTo = function() {
    const m = document.getElementById('howto-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    const cb = document.getElementById('howto-dont-show');
    if (cb && cb.checked) localStorage.setItem('qip_howto_seen', '1');
};

window.returnToProjects = () => {
    state.currentProjectId = null;
    state.projectData = null;
    state.isReadOnly = false;
    state.isLeadViewing = false;
    const ind = document.getElementById('readonly-indicator');
    if (ind) ind.classList.add('hidden');
    document.body.classList.remove('readonly-mode');

    if (window.unsubscribeProject) window.unsubscribeProject();

    if (state.isMasterAdmin) {
        loadMasterAdminDashboard();
    } else {
        loadProjectList();
    }
};

window.exportProjectToFile = function() {
    if (!state.projectData) { showToast("No data to export", "error"); return; }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.projectData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().slice(0,10);
    const cleanTitle = (state.projectData.meta.title || "QIP").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAnchorNode.setAttribute("download", `qip_backup_${cleanTitle}_${date}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("Project saved to Downloads", "success");
}

window.triggerImportProject = function() {
    document.getElementById('project-upload-input').click();
}

window.importProjectFromFile = function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!json.meta || !json.checklist) throw new Error("Invalid QIP file");
            
            state.projectData = json;
            window.saveData(true); 
            R.renderAll('dashboard');
            showToast("Project loaded from file", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to load project: " + err.message, "error");
        }
    };
    reader.readAsText(file);
    input.value = '';
}

window.openGlobalSettings = () => {
    const el = document.getElementById('settings-ai-key');
    if (el) el.value = state.aiKey || '';
    // Hide roles section for demo mode / admin
    const rolesSection = document.getElementById('settings-roles-section');
    if (rolesSection) {
        rolesSection.classList.toggle('hidden', state.isDemoMode || state.isMasterAdmin || !state.currentUser);
    }
    const modal = document.getElementById('global-settings-modal');
    if (modal) modal.classList.remove('hidden');
    // Load current roles for logged-in normal users
    if (state.currentUser && !state.isDemoMode && !state.isMasterAdmin) {
        loadRolesIntoSettings();
    }
};

window.saveGlobalSettings = () => {
    const key = document.getElementById('settings-ai-key').value.trim();
    state.aiKey = key;
    if(key) {
        localStorage.setItem('rcem_qip_ai_key', key);
        showToast("Settings saved. AI features enabled.", "success");
    } else {
        localStorage.removeItem('rcem_qip_ai_key');
        showToast("Settings saved. AI features disabled.", "info");
    }
    document.getElementById('global-settings-modal').classList.add('hidden');
    
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        window.router(viewName);
    }
};

window.toggleKeyVis = () => {
    const input = document.getElementById('settings-ai-key');
    if(input) input.type = input.type === 'password' ? 'text' : 'password';
};

window.hasAI = () => !!state.aiKey;

window.aiRefineAim = async () => {
    const d = state.projectData.checklist;
    if (!d.problem_desc && !d.aim) { showToast("Enter a problem or draft aim first", "error"); return; }
    
    const btn = document.getElementById('btn-ai-aim');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Refining...`;
    
    const prompt = `
        Context: Quality Improvement in Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Draft Aim: "${d.aim || 'Not defined'}"
        Task: Rewrite the aim to be strictly SMART (Specific, Measurable, Achievable, Relevant, Time-bound). 
        Keep it under 35 words. Return ONLY the aim statement text, no quotes.
    `;
    
    const result = await callAI(prompt);
    if (result) {
        state.projectData.checklist.aim = result.trim();
        window.saveData();
        R.renderChecklist();
        showToast("Aim refined by AI", "success");
    }
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> Refine Aim`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiSuggestDrivers = async () => {
    const d = state.projectData.checklist;
    if (!d.aim) { showToast("Define an Aim first", "error"); return; }

    const btn = document.getElementById('btn-ai-driver');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Generating...`;
    }

    const prompt = `
        The QIP Aim is: "${d.aim}".
        Problem Context: "${d.problem_desc}".
        Task: Generate a Driver Diagram structure in JSON format.
        Schema: { "primary": ["string"], "secondary": ["string"], "changes": ["string"] }
        Requirements: 3-4 Primary Drivers, 4-6 Secondary Drivers, 5-8 Specific Change Ideas.
    `;

    const result = await callAI(prompt, true);

    if (result && result.primary) {
        state.projectData.drivers = result;
        window.saveData();
        window.renderTools();
        showToast("Driver Diagram generated", "success");
    }

    if(btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> Auto-Generate`;
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiGeneratePDSA = async () => {
    const title = document.getElementById('pdsa-title').value;
    if(!title) { showToast("Enter a title for the cycle first", "error"); return; }
    
    const d = state.projectData.checklist;
    const btn = document.getElementById('btn-ai-pdsa');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Drafting...`;

    const prompt = `
        Project Aim: "${d.aim}".
        PDSA Title: "${title}".
        Task: Draft a realistic PDSA cycle for this project.
        Return JSON format: { "desc": "Plan details...", "do": "Do details...", "study": "Study details...", "act": "Act details..." }
        Keep sections concise (2-3 sentences each).
    `;

    const result = await callAI(prompt, true);
    
    if(result) {
        document.getElementById('pdsa-plan').value = `${result.desc}\n\n[AI Drafted - Prediction]\n${result.study}`;
        showToast("Plan drafted", "success");
    }
    
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Draft`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiAnalyseChart = async () => {
    const d = state.projectData.chartData;
    if(!d || d.length < 5) { showToast("Need at least 5 data points", "error"); return; }
    
    const btn = document.getElementById('btn-ai-chart');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Analysing...`;
    
    const sorted = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const dataStr = sorted.map(x => `${x.date}:${x.value}`).join(', ');
    
    const prompt = `
        Aim: "${state.projectData.checklist.aim}".
        Data (Date:Value): [${dataStr}].
        Task: Analyze this SPC/Run chart data. Identify shifts, trends, or outliers. 
        Conclude if there is improvement. Write a short paragraph for the "Results" section.
    `;
    
    const result = await callAI(prompt);
    
    if(result) {
        const box = document.getElementById('results-text');
        box.value = result.trim();
        window.saveResults(result.trim());
        showToast("Analysis complete", "success");
    }
    
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> AI Analyse`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiSuggestEvidence = async () => {
    const d = state.projectData.checklist;
    if (!d.problem_desc && !d.aim) { showToast("Define a problem or aim first", "error"); return; }
    
    const prompt = `
        Context: Quality Improvement in UK Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Aim: "${d.aim || 'Not defined'}"
        Task: Suggest relevant evidence, guidelines, and standards for this QIP.
        Include: NICE guidelines, RCEM standards, key research papers, CQC requirements.
        Format as a brief paragraph suitable for a literature review section.
        Keep under 150 words.
    `;
    
    const result = await callAI(prompt);
    
    if(result) {
        const existing = d.lit_review || '';
        state.projectData.checklist.lit_review = existing ? existing + '\n\n[AI Suggestions]\n' + result.trim() : result.trim();
        window.saveData();
        R.renderChecklist();
        showToast("Evidence suggestions added", "success");
    }
};

window.exportPPTX = exportPPTX;
window.printPoster = printPoster;
window.printPosterOnly = printPosterOnly;
window.openPortfolioExport = R.openPortfolioExport;
window.exportToKaizen = exportToKaizen;

window.addDataPoint = addDataPoint;
window.deleteDataPoint = deleteDataPoint;
window.downloadCSVTemplate = downloadCSVTemplate;
window.importCSV = importCSV;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.renderDataView = R.renderDataView;
window.renderChart = renderChart;

window.setChartMode = setChartMode;
window.updateChartEducation = updateChartEducation;
window.openChartSettings = openChartSettings;
window.saveChartSettings = saveChartSettings;
window.copyChartImage = copyChartImage;
window.renderFullViewChart = renderFullViewChart;

window.setToolMode = setToolMode;
window.toggleToolList = R.toggleToolList;
window.toggleToolHelp = toggleToolHelp;
window.resetProcess = resetProcess;
window.updateFishCat = R.updateFishCat;
window.updateFishCause = R.updateFishCause;
window.addFishCause = R.addFishCause;
window.removeFishCause = R.removeFishCause;
window.renderTools = renderTools;

// Debounced save — fires 1.5s after last keystroke to reduce Firestore writes
let _saveDebounceTimer = null;
window.saveDataDebounced = function() {
    clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => window.saveData(), 1500);
};

window.saveChecklist = (key, val) => { 
    if (!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist[key] = val; 
    window.saveDataDebounced();
};
window.saveChecklistField = window.saveChecklist; 
window.saveSmartAim = R.saveSmartAim; 
window.renderChecklist = R.renderChecklist; 
window.startOnboarding = startOnboarding;

window.openMemberModal = R.openMemberModal;
window.saveMember = () => {
    const name = document.getElementById('member-name').value;
    const role = document.getElementById('member-role').value;
    const grade = document.getElementById('member-grade').value;
    const resp = document.getElementById('member-resp').value;
    const init = document.getElementById('member-init').value;
    
    if(!name) { showToast("Name is required", "error"); return; }
    
    if (!state.projectData.teamMembers) state.projectData.teamMembers = [];
    state.projectData.teamMembers.push({ 
        id: Date.now().toString(),
        name, role, grade, responsibilities: resp, 
        initials: init || name.substring(0,2).toUpperCase() 
    });
    
    window.saveData();
    document.getElementById('member-modal').classList.add('hidden');
    
    document.getElementById('member-name').value = '';
    document.getElementById('member-role').value = '';
    document.getElementById('member-grade').value = '';
    document.getElementById('member-resp').value = '';
    document.getElementById('member-init').value = '';
    
    R.renderTeam();
    showToast("Member added", "success");
};
window.deleteMember = (index) => {
    window.showConfirmDialog('Remove this team member?', () => {
        state.projectData.teamMembers.splice(index, 1);
        window.saveData();
        R.renderTeam();
        showToast('Member removed', 'info');
    }, 'Remove', 'Remove Team Member');
};
window.addLeadershipLog = R.addLeadershipLog;
window.deleteLeadershipLog = R.deleteLeadershipLog;

window.addStakeholder = R.addStakeholder;
window.updateStake = R.updateStake;
window.removeStake = R.removeStake;
window.toggleStakeView = R.toggleStakeView;

window.addPDSA = R.addPDSA;
window.updatePDSA = R.updatePDSA;
window.deletePDSA = R.deletePDSA;

window.openGanttModal = R.openGanttModal;
window.saveGanttTask = () => {
    const name = document.getElementById('task-name').value;
    const start = document.getElementById('task-start').value;
    const end = document.getElementById('task-end').value;
    const type = document.getElementById('task-type').value;
    const owner = document.getElementById('task-owner').value;
    const milestone = document.getElementById('task-milestone').checked;
    const dependency = document.getElementById('task-dep')?.value;

    if(!name || !start || !end) { showToast("Missing task details", "error"); return; }
    
    if(dependency) {
        const depTask = state.projectData.gantt.find(t => t.id === dependency);
        if(depTask && new Date(depTask.end) > new Date(start)) {
            showToast(`Task must start after dependency '${depTask.name}' finishes.`, 'error');
            return;
        }
    }

    if(!state.projectData.gantt) state.projectData.gantt = [];
    state.projectData.gantt.push({ 
        id: Date.now().toString(), 
        name, start, end, type, owner, milestone, dependency 
    });
    
    window.saveData();
    document.getElementById('task-modal').classList.add('hidden');
    
    document.getElementById('task-name').value = '';
    document.getElementById('task-start').value = '';
    document.getElementById('task-end').value = '';
    document.getElementById('task-type').value = 'plan';
    document.getElementById('task-owner').value = '';
    document.getElementById('task-milestone').checked = false;
    document.getElementById('task-dep').value = '';
    
    R.renderGantt();
    showToast("Task added", "success");
};
window.deleteGantt = (id) => {
    window.showConfirmDialog('Delete this Gantt task?', () => {
        state.projectData.gantt = state.projectData.gantt.filter(t => t.id !== id);
        window.saveData();
        R.renderGantt();
        showToast('Task deleted', 'info');
    }, 'Delete', 'Delete Task');
};
window.deleteGanttTask = (index) => {
    window.showConfirmDialog('Delete this Gantt task?', () => {
        state.projectData.gantt.splice(index, 1);
        window.saveData();
        R.renderGantt();
        showToast('Task deleted', 'info');
    }, 'Delete', 'Delete Task');
};

window.switchPublishMode = R.renderPublish;
window.copyReport = R.copyReport;
window.saveResults = (val) => { 
    if(!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist.results_analysis = val; 
    window.saveData(); 
};
window.calcGreen = R.calcGreen;
window.calcMoney = R.calcMoney;
window.calcTime = R.calcTime;
window.calcEdu = R.calcEdu;
window.showHelp = R.showHelp;
window.startTour = R.startTour;

window.renderSurveys = renderSurveys;
window.addSurvey = addSurvey;
window.deleteSurvey = deleteSurvey;
window.importSurveyCSV = importSurveyCSV;
window.updateSurveySummary = updateSurveySummary;
window.updateSurveyTitle = updateSurveyTitle;
window.aiAnalyseSurvey = aiAnalyseSurvey;

window.saveData = async function(skipHistory = false) {
    if (state.isReadOnly) return;
    
    if (state.isDemoMode) { 
        if(!skipHistory) pushHistory();
        let currentView = document.querySelector('.view-section:not(.hidden)');
        if (currentView) {
            let viewName = currentView.id.replace('view-', '');
            if(viewName === 'tools' || viewName === 'data' || viewName === 'dashboard') {
                R.renderAll(viewName);
            }
        }
        return; 
    }

    if (!state.currentProjectId || !state.currentUser) return;
    
    if (!db) {
        showToast("Database not connected. Changes saved locally.", "warning");
        return;
    }
    
    if(!skipHistory) pushHistory();
    
    try {
        await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
        
        const s = document.getElementById('save-status');
        if(s) { 
            // Record save time and show persistent indicator
            window._lastSavedAt = Date.now();
            s.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Saved`;
            s.classList.remove('opacity-0', 'text-slate-400');
            s.classList.add('text-emerald-600', 'flex', 'items-center', 'gap-1', 'text-xs', 'font-medium');
            if(typeof lucide !== 'undefined') lucide.createIcons();

            // Start / restart the "X min ago" updater
            if (!window._saveIntervalId) {
                window._saveIntervalId = setInterval(() => {
                    const el = document.getElementById('save-status');
                    if (!el || !window._lastSavedAt) return;
                    const mins = Math.floor((Date.now() - window._lastSavedAt) / 60000);
                    el.innerHTML = mins < 1
                        ? `<i data-lucide="check" class="w-3 h-3"></i> Saved just now`
                        : `<i data-lucide="clock" class="w-3 h-3"></i> Saved ${mins}m ago`;
                    if(typeof lucide !== 'undefined') lucide.createIcons();
                }, 60000);
            }
        }
    } catch (e) {
        showToast("Save failed: " + e.message, "error");
    }
};

// Quick-add data point from dashboard widget
window.quickAddDataPoint = async function() {
    if (!state.projectData || state.isReadOnly) return;
    const dateEl = document.getElementById('quick-add-date');
    const valEl = document.getElementById('quick-add-value');
    const phaseEl = document.getElementById('quick-add-phase');
    const date = dateEl?.value;
    const value = parseFloat(valEl?.value);
    if (!date || isNaN(value)) {
        showToast('Please enter a date and value', 'error');
        return;
    }
    const grade = phaseEl?.value || 'Intervention';
    if (!state.projectData.chartData) state.projectData.chartData = [];
    state.projectData.chartData.push({ date, value, grade });
    if (window.saveData) await window.saveData();
    showToast('Data point added', 'success');
    // Reset value input, keep date
    if (valEl) valEl.value = '';
    // Refresh dashboard mini-chart if visible
    if (typeof R !== 'undefined' && R.renderAll) R.renderAll('dashboard');
};

function pushHistory() {
    if(state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    if(state.historyStack.length > state.MAX_HISTORY) state.historyStack.shift();
    state.redoStack = []; 
    updateUndoRedoButtons();
}

window.undo = () => {
    if (state.historyStack.length === 0 || state.isReadOnly) return;
    state.redoStack.push(JSON.stringify(state.projectData));
    const prevState = state.historyStack.pop();
    state.projectData = JSON.parse(prevState);
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        R.renderAll(viewName);
    }
    window.saveData(true); 
    updateUndoRedoButtons();
    showToast("Undo", "info");
};

window.redo = () => {
    if (state.redoStack.length === 0 || state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    const nextState = state.redoStack.pop();
    state.projectData = JSON.parse(nextState);
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        R.renderAll(viewName);
    }
    window.saveData(true);
    updateUndoRedoButtons();
    showToast("Redo", "info");
};

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = state.historyStack.length === 0;
    if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

function getAuthErrorDetails(error) {
    const errorCode = error.code || '';
    const errorDetails = {
        message: 'An unexpected error occurred. Please try again.',
        type: 'error',
        field: null,
        suggestion: null
    };

    switch (errorCode) {
        case 'auth/invalid-email':
            errorDetails.message = 'Please enter a valid email address.';
            errorDetails.field = 'email';
            break;
        case 'auth/email-already-in-use':
            errorDetails.message = 'This email is already registered. Try signing in instead.';
            errorDetails.field = 'email';
            errorDetails.suggestion = 'signin';
            break;
        case 'auth/user-not-found':
            errorDetails.message = 'No account found with this email address.';
            errorDetails.field = 'email';
            errorDetails.suggestion = 'register';
            break;
        case 'auth/wrong-password':
            errorDetails.message = 'Incorrect password. Please try again.';
            errorDetails.field = 'password';
            errorDetails.suggestion = 'reset';
            break;
        case 'auth/weak-password':
            errorDetails.message = 'Password is too weak. Use at least 6 characters.';
            errorDetails.field = 'password';
            break;
        case 'auth/missing-password':
            errorDetails.message = 'Please enter your password.';
            errorDetails.field = 'password';
            break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            errorDetails.message = 'Invalid email or password. Please check your details.';
            errorDetails.field = null;
            break;
        case 'auth/user-disabled':
            errorDetails.message = 'This account has been disabled. Please contact support.';
            errorDetails.type = 'warning';
            break;
        case 'auth/too-many-requests':
            errorDetails.message = 'Too many failed attempts. Please wait before trying again.';
            errorDetails.type = 'warning';
            errorDetails.suggestion = 'wait';
            break;
        case 'auth/network-request-failed':
            errorDetails.message = 'Network error. Please check your internet connection.';
            errorDetails.type = 'warning';
            break;
        default:
            errorDetails.message = `Authentication error: ${error.message || 'Unknown error'}`;
    }

    return errorDetails;
}

function setFieldError(fieldId, hasError, message = '') {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const wrapper = field.parentElement;
    let errorSpan = wrapper.querySelector('.field-error');

    if (hasError) {
        field.classList.add('border-red-500', 'bg-red-50');
        field.classList.remove('border-slate-300');
        
        if (message && !errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'field-error text-red-500 text-xs mt-1 block';
            wrapper.appendChild(errorSpan);
        }
        if (errorSpan) {
            errorSpan.textContent = message;
        }
    } else {
        field.classList.remove('border-red-500', 'bg-red-50');
        field.classList.add('border-slate-300');
        
        if (errorSpan) {
            errorSpan.remove();
        }
    }
}

function clearFieldErrors() {
    setFieldError('email', false);
    setFieldError('password', false);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function setButtonLoading(button, isLoading, loadingText = 'Loading...', originalText = null) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i> ${loadingText}`;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [button] });
    } else {
        button.disabled = false;
        button.innerHTML = originalText || button.dataset.originalText || 'Submit';
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [button] });
    }
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        const isShared = await checkShareLink();
        if (isShared) return;

        state.currentUser = user;
        if (user) {
            state.isMasterAdmin = (user.email && user.email.toLowerCase() === ADMIN_EMAIL);

            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('app-sidebar').classList.add('lg:flex');
            document.getElementById('auth-screen').classList.add('hidden');
            // Hide register screen if somehow visible
            const rs = document.getElementById('register-screen');
            if (rs) rs.classList.add('hidden');

            const ud = document.getElementById('user-display');

            if (state.isMasterAdmin) {
                if (ud) ud.textContent = '\uD83D\uDC41 Master Admin';
                const adminBar = document.getElementById('admin-bar');
                if (adminBar) adminBar.classList.remove('hidden');
                // Push content down so admin bar doesn't overlap nav
                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.style.marginTop = '32px';
                loadMasterAdminDashboard();
            } else {
                if (ud) ud.textContent = user.email;
                loadProjectList();
                // Check if user is also a QIP Lead for others' projects
                checkQIPLeadStatus(user);
            }
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
            // Reset admin state on logout
            state.isMasterAdmin = false;
            const adminBar = document.getElementById('admin-bar');
            if (adminBar) adminBar.classList.add('hidden');
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.style.marginTop = '';
        }
    });
}

async function checkShareLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharePid = urlParams.get('share');
    const shareUid = urlParams.get('uid');

    if (sharePid && shareUid) {
        state.isReadOnly = true;
        const ind = document.getElementById('readonly-indicator');
        if(ind) ind.classList.remove('hidden');
        
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-sidebar').classList.add('lg:flex');
        document.body.classList.add('readonly-mode');
        
        try {
            if (!db) throw new Error("Database not connected");
            const docRef = doc(db, `users/${shareUid}/projects`, sharePid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                state.projectData = docSnap.data();
                state.currentProjectId = sharePid;
                document.getElementById('project-header-title').textContent = state.projectData.meta.title + " (Shared)";
                window.router('dashboard');
            } else {
                showToast("Shared project not found.", "error");
            }
        } catch (e) {
            showToast("Could not load shared project.", "error");
        }
        return true;
    }
    return false;
}

// ─── QIP Lead status check ───────────────────────────────────────────────────
async function checkQIPLeadStatus(user) {
    if (!user?.email || !db) return;
    try {
        const projects = await getQIPLeadProjects(db, user.email);
        if (!projects.length) return;

        // Load data for each supervised project
        const enriched = [];
        for (const proj of projects) {
            try {
                const snap = await getDoc(doc(db, `users/${proj.ownerUid}/projects`, proj.projectId));
                if (snap.exists()) {
                    const d = snap.data();
                    // Compute a rough progress score
                    const c = d.checklist || {};
                    const filled = ['problem_desc','aim','outcome_measure','process_measure','lit_review','ethics'].filter(k=>c[k]).length;
                    const hasPdsa = (d.pdsa||[]).length > 0;
                    const hasData = (d.chartData||[]).length > 0;
                    const progress = Math.round(((filled/6)*50) + (hasPdsa?25:0) + (hasData?25:0));
                    enriched.push({ ...proj, _data: d, _progress: progress });
                }
            } catch(e) { enriched.push({ ...proj, _data: {}, _progress: 0 }); }
        }
        state.qipLeadProjects = enriched;
        state.isQIPLead = enriched.length > 0;

        if (enriched.length > 0) {
            // Show badge on projects page
            const badge = document.getElementById('qip-lead-badge');
            const badgeText = document.getElementById('qip-lead-badge-text');
            if (badge) badge.classList.remove('hidden');
            if (badgeText) badgeText.textContent = `Supervising ${enriched.length} QIP project${enriched.length > 1 ? 's' : ''} as Departmental QIP Lead`;
            // Show Lead Dashboard nav button
            const navBtn = document.getElementById('nav-lead-dashboard');
            if (navBtn) navBtn.classList.remove('hidden');
            // Render QIP Lead panel in supervisor section
            const panel = document.getElementById('qip-lead-panel');
            if (panel && state.currentUser) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
        }
    } catch(e) {
        console.warn('[QIPLead] checkQIPLeadStatus error:', e);
    }
}

// Called from sidebar or projects page to show QIP Lead dashboard
window.showQIPLeadDashboard = function() {
    const container = document.getElementById('qip-lead-dashboard-container');
    const projectsView = document.getElementById('view-projects');
    if (!container) return;

    // Hide projects view, show lead dashboard within same view-projects area
    const inner = document.getElementById('project-list-inner');
    if (inner) inner.classList.add('hidden');
    container.classList.remove('hidden');

    renderQIPLeadDashboard(container, state.qipLeadProjects, (i) => {
        window.viewLeadProject(i);
    });
};

window.switchToOwnProjects = function() {
    const container = document.getElementById('qip-lead-dashboard-container');
    const inner = document.getElementById('project-list-inner');
    if (container) container.classList.add('hidden');
    if (inner) inner.classList.remove('hidden');
};

window.viewLeadProject = async function(idx) {
    const proj = state.qipLeadProjects[idx];
    if (!proj || !proj._data) return;
    // Set up read-only project view
    state.projectData = proj._data;
    state.currentProjectId = proj.projectId;
    state.isReadOnly = true;
    state.isLeadViewing = true;
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
    showToast('Viewing in read-only mode', 'info');
};

window.returnFromLeadView = function() {
    state.isReadOnly = false;
    state.isLeadViewing = false;
    state.projectData = null;
    window.showQIPLeadDashboard();
};

// ─── Add/Remove QIP Lead button handlers (called from supervisor view) ───────
window.addQIPLeadBtn = async function() {
    const input = document.getElementById('qip-lead-email-input');
    if (!input) return;
    const email = input.value.trim().toLowerCase();
    if (!email) { showToast('Enter a lead email address.', 'error'); return; }
    const d = state.projectData;
    if (!d || !state.currentUser) return;
    const success = await addQIPLeadToProject(
        db, state.currentUser.uid, state.currentProjectId,
        email,
        d.teamMembers?.[0]?.name || state.currentUser.email,
        d.meta?.title || 'Untitled QIP'
    );
    if (success) {
        if (!d.qipLeads) d.qipLeads = [];
        d.qipLeads.push({ email, addedAt: new Date().toISOString() });
        if (window.saveData) window.saveData();
        input.value = '';
        // Re-render the lead panel
        const panel = document.getElementById('qip-lead-panel');
        if (panel) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
    }
};

window.removeQIPLeadBtn = async function(idx) {
    const d = state.projectData;
    if (!d?.qipLeads) return;
    const lead = d.qipLeads[idx];
    if (!lead) return;
    await removeQIPLeadFromProject(db, state.currentUser.uid, state.currentProjectId, lead.email);
    d.qipLeads.splice(idx, 1);
    if (window.saveData) window.saveData();
    const panel = document.getElementById('qip-lead-panel');
    if (panel) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
};

async function loadProjectList() {
    if (state.isReadOnly) return;
    if (state.isMasterAdmin) { loadMasterAdminDashboard(); return; }
    window.router('projects');
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.add('hidden');

    // Auto-show How-To guide for first-time visitors
    if (!localStorage.getItem('qip_howto_seen')) {
        setTimeout(() => window.showHowTo(), 800);
    }

    const listEl = document.getElementById('project-list');
    
    if (state.isDemoMode) {
        listEl.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-rcem-purple relative cursor-pointer group hover:shadow-md transition-all" onclick="window.openDemoProject()">
             <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide rounded-bl">Gold Standard</div>
             <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery in the ED</h3>
             <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ST6 Emergency Medicine)</p>
             <div class="flex gap-2 text-xs font-medium text-slate-500 flex-wrap">
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 52 Data Points</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 5 PDSA Cycles</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> 6 Team Members</span>
            </div>
        </div>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    try {
        if (!db) throw new Error("No database connection");
        const snap = await getDocs(collection(db, `users/${state.currentUser.uid}/projects`));
        listEl.innerHTML = '';
        if (snap.empty) {
            listEl.innerHTML = `<div class="col-span-3 text-center p-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                <h3 class="font-bold text-slate-600 mb-2">No Projects Yet</h3>
                <button onclick="window.createNewProject()" class="text-rcem-purple font-bold hover:underline flex items-center justify-center gap-2 mx-auto"><i data-lucide="plus-circle" class="w-4 h-4"></i> Create your first QIP</button>
            </div>`;
        }
        snap.forEach(doc => {
            const d = doc.data();
            const date = new Date(d.meta?.created).toLocaleDateString('en-GB');
            const titleText = escapeHtml(d.meta?.title) || 'Untitled';
            listEl.innerHTML += `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer relative group hover:shadow-md transition-all" onclick="window.openProject('${doc.id}')">
                    <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors truncate" title="${titleText}">${titleText}</h3>
                    <p class="text-xs text-slate-400 mb-4">Created: ${date}</p>
                    <button onclick="event.stopPropagation(); window.deleteProject('${doc.id}')" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        showToast("Failed to load projects: " + e.message, "error");
    }
}

window.createNewProject = async () => {
    const modal      = document.getElementById('new-project-modal');
    const titleInput = document.getElementById('new-project-title');
    const oldSubmit  = document.getElementById('new-project-submit');
    if (!modal || !titleInput) return;

    titleInput.value = '';
    titleInput.classList.remove('border-red-400', 'ring-1', 'ring-red-400');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => titleInput.focus(), 60);

    const submitBtn = oldSubmit.cloneNode(true);
    oldSubmit.parentNode.replaceChild(submitBtn, oldSubmit);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const doCreate = async () => {
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.classList.add('border-red-400', 'ring-1', 'ring-red-400');
            titleInput.focus();
            return;
        }
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        let template = JSON.parse(JSON.stringify(emptyProject));
        template.meta.title = title;
        template.meta.created = new Date().toISOString();
        template.meta.updated = new Date().toISOString();

        try {
            if (!db) throw new Error('No DB connection');
            const docRef = await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), template);
            showToast('Project created successfully', 'success');
            window.openProject(docRef.id);
            setTimeout(() => { if (window.startOnboarding) window.startOnboarding(); }, 600);
        } catch (e) {
            showToast('Failed to create project: ' + e.message, 'error');
        }
    };

    submitBtn.onclick = doCreate;
    titleInput.onkeydown = (e) => { if (e.key === 'Enter') doCreate(); };
};

window.deleteProject = async (id) => {
    window.showConfirmDialog(
        'Permanently delete this project? This cannot be undone.',
        async () => {
            try {
                if (!db) throw new Error('No DB connection');
                await deleteDoc(doc(db, `users/${state.currentUser.uid}/projects`, id));
                loadProjectList();
                showToast('Project deleted', 'info');
            } catch (e) {
                showToast('Failed to delete project: ' + e.message, 'error');
            }
        },
        'Delete Project',
        'Delete Project'
    );
};

window.openProject = (id) => {
    state.currentProjectId = id;
    if (window.unsubscribeProject) window.unsubscribeProject();
    
    if (!db) { showToast("No DB connection", "error"); return; }
    
    let firstLoad = true; // navigate to dashboard only once data is ready

    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!state.projectData) { 
                state.historyStack = [JSON.stringify(data)]; 
                state.redoStack = []; 
                updateUndoRedoButtons(); 
            }
            state.projectData = data;
            
            if(!state.projectData.checklist) state.projectData.checklist = {};
            if(!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!state.projectData.fishbone) state.projectData.fishbone = emptyProject.fishbone;
            if(!state.projectData.pdsa) state.projectData.pdsa = [];
            if(!state.projectData.chartData) state.projectData.chartData = [];
            if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
            if(!state.projectData.gantt) state.projectData.gantt = [];
            if(!state.projectData.teamMembers) state.projectData.teamMembers = [];
            if(!state.projectData.chartSettings) state.projectData.chartSettings = {};
            if(!state.projectData.process) state.projectData.process = ["Start", "End"];
            if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
            if(!state.projectData.patientFeedback) state.projectData.patientFeedback = [];
            if(!state.projectData.assessment) state.projectData.assessment = {
                traineeLevel: 'core', capabilitiesMet: [], supervisorComments: '',
                signedOff: false, signedOffBy: '', signedOffDate: ''
            };
            if(!state.projectData.surveys) state.projectData.surveys = [];
            
            const headerTitle = document.getElementById('project-header-title');
            if(headerTitle) headerTitle.textContent = state.projectData.meta.title;

            if (firstLoad) {
                // First snapshot: data is ready — now it's safe to navigate
                firstLoad = false;
                const topBar = document.getElementById('top-bar');
                if(topBar) topBar.classList.remove('hidden');
                window.router('dashboard');
            } else {
                // Subsequent snapshots (live updates): re-render current view
                let currentView = document.querySelector('.view-section:not(.hidden)');
                if (currentView) {
                    let viewName = currentView.id.replace('view-', '');
                    if(viewName !== 'projects') window.router(viewName);
                }
            }
        }
    }, (error) => {
        showToast("Connection error: " + error.message, "error");
    });
};

function initAuthHandlers() {
    const authForm = document.getElementById('auth-form');
    
    if(authForm) {
        authForm.onsubmit = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            clearFieldErrors();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = authForm.querySelector('button[type="submit"]');
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !isValidEmail(email)) {
                setFieldError('email', true, 'Please enter a valid email address');
                return;
            }
            
            if (!password || password.length < 6) {
                setFieldError('password', true, 'Password must be at least 6 characters');
                return;
            }
            
            if (!auth) {
                showToast("Authentication service unavailable.", "error");
                return;
            }
            
            setButtonLoading(submitBtn, true, 'Signing in...');
            
            try { 
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Signed in successfully!", "success");
            } 
            catch (error) {
                const errorDetails = getAuthErrorDetails(error);
                if (errorDetails.field) {
                    setFieldError(errorDetails.field, true, errorDetails.message);
                }
                showToast(errorDetails.message, errorDetails.type);
                passwordInput.value = '';
                setButtonLoading(submitBtn, false, null, 'Sign In');
            }
        });
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput) {
            emailInput.addEventListener('input', () => setFieldError('email', false));
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('input', () => setFieldError('password', false));
        }
    }

    const btnRegister = document.getElementById('btn-register');
    if (btnRegister) {
        btnRegister.addEventListener('click', () => window.showRegisterScreen());
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => { 
            try {
                if(auth) await signOut(auth);
                showToast("Signed out successfully", "info");
                state.currentUser = null;
                state.currentProjectId = null;
                state.projectData = null;
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                showToast("Error signing out. Please try again.", "error");
            }
        });
    }

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('app-sidebar');
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden'); 
                sidebar.classList.add('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
            } else {
                sidebar.classList.add('hidden'); 
                sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
            }
        });
    }

    const btnForgotPassword = document.getElementById('btn-forgot-password');
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener('click', async () => {
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email || !isValidEmail(email)) {
                setFieldError('email', true, 'Enter your email address above first, then click Forgot Password.');
                return;
            }
            if (!auth) { showToast('Authentication service unavailable.', 'error'); return; }
            try {
                await sendPasswordResetEmail(auth, email);
                showToast(`Password reset email sent to ${email}. Check your inbox (and spam folder).`, 'success');
            } catch (error) {
                const details = getAuthErrorDetails(error);
                showToast(details.message, details.type);
            }
        });
    }

    const btnGoogleSignin = document.getElementById('btn-google-signin');
    if (btnGoogleSignin) {
        btnGoogleSignin.addEventListener('click', async () => {
            if (!auth) { showToast('Authentication service unavailable.', 'error'); return; }
            setButtonLoading(btnGoogleSignin, true, 'Signing in with Google...');
            try {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, provider);
                showToast('Signed in with Google!', 'success');
            } catch (error) {
                // User closed the popup — don't show an error toast
                if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                    setButtonLoading(btnGoogleSignin, false);
                    return;
                }
                const details = getAuthErrorDetails(error);
                showToast(details.message, details.type);
                setButtonLoading(btnGoogleSignin, false);
            }
        });
    }

    const demoToggle = document.getElementById('demo-toggle');
    if(demoToggle) {
        demoToggle.addEventListener('change', (e) => {
            state.isDemoMode = e.target.checked;
            state.currentProjectId = null; 
            state.projectData = null;
            const wm = document.getElementById('demo-watermark');
            if (state.isDemoMode) { 
                if(wm) wm.classList.remove('hidden'); 
                loadProjectList(); 
            } 
            else { 
                if(wm) wm.classList.add('hidden'); 
                if (state.currentUser) loadProjectList(); 
                else {
                    const authScreen = document.getElementById('auth-screen');
                    if(authScreen) authScreen.classList.remove('hidden');
                }
            }
        });
    }

    const demoAuthBtn = document.getElementById('demo-auth-btn');
    if(demoAuthBtn) {
        demoAuthBtn.onclick = () => {
            state.isDemoMode = true;
            state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
            
            const appContainer = document.getElementById('app-container');
            if(appContainer) appContainer.classList.remove('hidden');
            
            const sb = document.getElementById('app-sidebar');
            if(sb) sb.classList.add('lg:flex');
            const as = document.getElementById('auth-screen');
            if(as) as.classList.add('hidden');
            const wm = document.getElementById('demo-watermark');
            if(wm) wm.classList.remove('hidden');
            if(demoToggle) demoToggle.checked = true;
            loadProjectList();
            showToast("Demo mode activated", "success");
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthHandlers);
} else {
    initAuthHandlers();
}

window.openDemoProject = () => {
    state.projectData = getDemoData();
    state.currentProjectId = 'DEMO';
    state.historyStack = [JSON.stringify(state.projectData)];
    state.redoStack = [];
    updateUndoRedoButtons();

    const header = document.getElementById('project-header-title');
    if(header) header.textContent = state.projectData.meta.title + " (DEMO)";
    
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
};

window.shareProject = () => {
    if(state.isDemoMode) { showToast("Cannot share demo projects.", "error"); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${state.currentProjectId}&uid=${state.currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => showToast("Share Link copied!", "success"));
};

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.saveData(true);
        showToast("Project Saved", "success");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!e.shiftKey) {
            e.preventDefault();
            window.undo();
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        window.redo();
    }
});

if(document.readyState === 'complete') {
    updateOnlineStatus();
} else {
    window.addEventListener('load', updateOnlineStatus);
}

if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'base',
        themeVariables: {
            primaryColor: '#2d2e83',
            primaryTextColor: '#fff',
            primaryBorderColor: '#2d2e83',
            lineColor: '#94a3b8',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#eff6ff'
        }
    });
}

if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

window.checkFirebaseStatus = () => {
    return getFirebaseStatus();
};

// ==========================================
// RAPID BATCH DATA ENTRY
// ==========================================

window.addBatchEntryRow = function() {
    const tbody = document.getElementById('batch-entry-tbody');
    if (!tbody) return;
    const today = new Date().toISOString().split('T')[0];
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-50';
    tr.innerHTML = `
        <td class="py-0.5 pr-1"><input type="date" class="batch-date w-full p-0.5 border border-slate-200 rounded text-xs" value="${today}"></td>
        <td class="py-0.5 pr-1"><input type="number" class="batch-value w-24 p-0.5 border border-slate-200 rounded text-xs" placeholder="0" step="any"></td>
        <td class="py-0.5 pr-1"><select class="batch-phase w-full p-0.5 border border-slate-200 rounded text-xs">
            <option value="">—</option>
            <option value="Baseline">Baseline</option>
            <option value="PDSA 1">PDSA 1</option>
            <option value="PDSA 2">PDSA 2</option>
            <option value="PDSA 3">PDSA 3</option>
            <option value="PDSA 4">PDSA 4</option>
            <option value="Sustain">Sustain</option>
        </select></td>
        <td class="py-0.5 pl-1"><button onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-400 text-base leading-none px-1" title="Remove row">&times;</button></td>
    `;
    tbody.appendChild(tr);
};

window.initBatchEntry = function() {
    const tbody = document.getElementById('batch-entry-tbody');
    if (tbody && tbody.children.length === 0) {
        for (let i = 0; i < 3; i++) window.addBatchEntryRow();
    }
};

window.submitBatchEntry = function() {
    if (!state.projectData) { showToast('No project open', 'error'); return; }
    const rows = document.querySelectorAll('#batch-entry-tbody tr');
    let added = 0;
    const errors = [];
    rows.forEach((row, idx) => {
        const d = row.querySelector('.batch-date')?.value;
        const v = row.querySelector('.batch-value')?.value;
        const g = row.querySelector('.batch-phase')?.value || '';
        if (!d && !v) return; // skip blank rows silently
        if (!d) { errors.push(`Row ${idx + 1}: missing date`); return; }
        if (v === '' || v === null || v === undefined) { errors.push(`Row ${idx + 1}: missing value`); return; }
        const parsedValue = parseFloat(v);
        if (isNaN(parsedValue)) { errors.push(`Row ${idx + 1}: invalid value`); return; }
        if (!state.projectData.chartData) state.projectData.chartData = [];
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        state.projectData.chartData.push({ id, date: d, value: parsedValue, grade: g });
        added++;
    });
    if (errors.length > 0) {
        showToast(errors[0], 'error');
    }
    if (added > 0) {
        state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (window.saveData) window.saveData();
        if (window.renderDataView) window.renderDataView();
        const tbody = document.getElementById('batch-entry-tbody');
        if (tbody) { tbody.innerHTML = ''; for (let i = 0; i < 3; i++) window.addBatchEntryRow(); }
        showToast(`${added} point${added !== 1 ? 's' : ''} added`, 'success');
    } else if (errors.length === 0) {
        showToast('No data in rows — please enter dates and values', 'error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION SCREEN — role selection + account creation
// ─────────────────────────────────────────────────────────────────────────────
let _regSelectedRoles = [];

window.showRegisterScreen = function() {
    const reg = document.getElementById('register-screen');
    const auth = document.getElementById('auth-screen');
    if (!reg) return;
    reg.classList.remove('hidden');
    if (auth) auth.classList.add('hidden');

    // Reset state
    _regSelectedRoles = [];

    // Reset step visibility
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s1) s1.classList.remove('hidden');
    if (s2) s2.classList.add('hidden');

    // Reset progress dots
    const d1 = document.getElementById('reg-dot-1');
    const d2 = document.getElementById('reg-dot-2');
    if (d1) { d1.classList.add('bg-rcem-purple'); d1.classList.remove('bg-slate-200'); }
    if (d2) { d2.classList.remove('bg-rcem-purple'); d2.classList.add('bg-slate-200'); }

    // Reset role cards
    ['trainee', 'supervisor', 'qip_lead'].forEach(role => {
        const card = document.getElementById(`role-card-${role}`);
        if (!card) return;
        card.classList.remove('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        const ind = card.querySelector('.role-check-indicator');
        if (ind) {
            ind.classList.remove('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.add('border-slate-300');
            ind.innerHTML = '';
        }
    });

    // Clear errors
    const e1 = document.getElementById('reg-step1-error');
    const e2 = document.getElementById('reg-error');
    if (e1) { e1.classList.add('hidden'); e1.textContent = ''; }
    if (e2) { e2.classList.add('hidden'); e2.textContent = ''; }

    // Clear form fields
    ['reg-name', 'reg-email', 'reg-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.hideRegisterScreen = function() {
    const reg = document.getElementById('register-screen');
    const auth = document.getElementById('auth-screen');
    if (reg) reg.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
};

window.toggleRegRole = function(role) {
    const card = document.getElementById(`role-card-${role}`);
    if (!card) return;
    const ind = card.querySelector('.role-check-indicator');

    if (_regSelectedRoles.includes(role)) {
        _regSelectedRoles = _regSelectedRoles.filter(r => r !== role);
        card.classList.remove('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        if (ind) {
            ind.classList.remove('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.add('border-slate-300');
            ind.innerHTML = '';
        }
    } else {
        _regSelectedRoles.push(role);
        card.classList.add('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        if (ind) {
            ind.classList.add('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.remove('border-slate-300');
            ind.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        }
    }
};

window.regNextStep = function() {
    const errEl = document.getElementById('reg-step1-error');
    if (_regSelectedRoles.length === 0) {
        if (errEl) { errEl.textContent = 'Please select at least one role to continue.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (errEl) errEl.classList.add('hidden');

    // Build role summary
    const roleLabels = { trainee: 'Trainee', supervisor: 'Clinical Supervisor', qip_lead: 'Departmental QIP Lead' };
    const summaryEl = document.getElementById('reg-roles-summary');
    if (summaryEl) {
        summaryEl.innerHTML = 'Roles selected: ' + _regSelectedRoles.map(r =>
            `<span class="font-bold text-rcem-purple">${roleLabels[r] || r}</span>`
        ).join(', ');
    }

    // Transition to step 2
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s1) s1.classList.add('hidden');
    if (s2) s2.classList.remove('hidden');

    // Update progress dots
    const d2 = document.getElementById('reg-dot-2');
    if (d2) { d2.classList.add('bg-rcem-purple'); d2.classList.remove('bg-slate-200'); }

    // Focus email
    setTimeout(() => { const em = document.getElementById('reg-email'); if (em) em.focus(); }, 80);
};

window.regGoBack = function() {
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s2) s2.classList.add('hidden');
    if (s1) s1.classList.remove('hidden');
    const d2 = document.getElementById('reg-dot-2');
    if (d2) { d2.classList.remove('bg-rcem-purple'); d2.classList.add('bg-slate-200'); }
};

async function saveUserProfileToFirestore(uid, email, displayName) {
    if (!db) return;
    try {
        await setDoc(doc(db, 'qipUsers', uid), {
            email: email || '',
            displayName: displayName || '',
            roles: _regSelectedRoles,
            createdAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('[Register] Failed to save user profile to Firestore:', e);
    }
}

window.submitRegister = async function() {
    const nameEl = document.getElementById('reg-name');
    const emailEl = document.getElementById('reg-email');
    const passEl = document.getElementById('reg-password');
    const errEl = document.getElementById('reg-error');
    const submitBtn = document.getElementById('reg-submit-btn');

    const name = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (!email || !isValidEmail(email)) {
        if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (!password || password.length < 6) {
        if (errEl) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (errEl) errEl.classList.add('hidden');

    setButtonLoading(submitBtn, true, 'Creating account...');
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserProfileToFirestore(cred.user.uid, email, name);
        // onAuthStateChanged will fire and load the app
        const reg = document.getElementById('register-screen');
        if (reg) reg.classList.add('hidden');
        showToast('Account created successfully! Welcome.', 'success');
    } catch (error) {
        const details = getAuthErrorDetails(error);
        if (errEl) { errEl.textContent = details.message; errEl.classList.remove('hidden'); }
        setButtonLoading(submitBtn, false, null, 'Create Account');
    }
};

window.registerWithGoogle = async function() {
    const errEl = document.getElementById('reg-error');
    const googleBtn = document.getElementById('reg-btn-google');
    if (errEl) errEl.classList.add('hidden');
    setButtonLoading(googleBtn, true, 'Signing up with Google...');

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await signInWithPopup(auth, provider);
        await saveUserProfileToFirestore(cred.user.uid, cred.user.email, cred.user.displayName || '');
        const reg = document.getElementById('register-screen');
        if (reg) reg.classList.add('hidden');
        showToast('Account created with Google! Welcome.', 'success');
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            setButtonLoading(googleBtn, false, null, 'Sign up with Google');
            return;
        }
        const details = getAuthErrorDetails(error);
        if (errEl) { errEl.textContent = details.message; errEl.classList.remove('hidden'); }
        setButtonLoading(googleBtn, false, null, 'Sign up with Google');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ADMIN DASHBOARD — read-only view of ALL users' projects
// ─────────────────────────────────────────────────────────────────────────────
async function loadMasterAdminDashboard() {
    if (!state.isMasterAdmin || !db) return;

    window.router('projects');
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.add('hidden');

    // Patch the view-projects header for admin context
    const h1 = document.querySelector('#view-projects header h1');
    if (h1) h1.textContent = 'Master Admin — All Projects';
    const sub = document.querySelector('#view-projects header p');
    if (sub) sub.textContent = 'Read-only overview of every user\'s QIP projects';
    // Hide the "New Project" button for admin
    const newBtn = document.querySelector('#view-projects header button');
    if (newBtn) newBtn.classList.add('hidden');
    // Hide QIP lead badge
    const badge = document.getElementById('qip-lead-badge');
    if (badge) badge.classList.add('hidden');
    // Hide QIP lead dashboard container
    const leadCont = document.getElementById('qip-lead-dashboard-container');
    if (leadCont) leadCont.classList.add('hidden');

    const listEl = document.getElementById('project-list');
    if (!listEl) return;

    listEl.className = 'w-full'; // override grid
    listEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-rcem-purple border-t-transparent mb-4"></div>
            <p class="text-slate-500 font-medium">Loading all projects across all users&hellip;</p>
        </div>`;

    try {
        const snap = await getDocs(collectionGroup(db, 'projects'));
        state.adminAllProjects = [];
        const userMap = {};

        snap.forEach(docSnap => {
            const pathParts = docSnap.ref.path.split('/');
            // Path: users/{uid}/projects/{pid}
            if (pathParts.length < 4 || pathParts[0] !== 'users' || pathParts[2] !== 'projects') return;
            const ownerUid = pathParts[1];
            const projectId = docSnap.id;
            const data = docSnap.data();
            state.adminAllProjects.push({ ownerUid, projectId, data });
            if (!userMap[ownerUid]) userMap[ownerUid] = [];
            userMap[ownerUid].push({ projectId, data });
        });

        // Fetch user emails from qipUsers collection
        const userEmails = {};
        for (const uid of Object.keys(userMap)) {
            try {
                const uSnap = await getDoc(doc(db, 'qipUsers', uid));
                if (uSnap.exists()) {
                    const ud = uSnap.data();
                    userEmails[uid] = ud.displayName ? `${ud.displayName} (${ud.email})` : (ud.email || uid);
                } else {
                    userEmails[uid] = uid;
                }
            } catch (e) { userEmails[uid] = uid; }
        }

        const totalProjects = state.adminAllProjects.length;
        const totalUsers = Object.keys(userMap).length;

        // Update admin bar count
        const countEl = document.getElementById('admin-project-count');
        if (countEl) countEl.textContent = `${totalProjects} project${totalProjects !== 1 ? 's' : ''} · ${totalUsers} user${totalUsers !== 1 ? 's' : ''}`;

        if (totalProjects === 0) {
            listEl.innerHTML = `
                <div class="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                    <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-3"></i>
                    <h3 class="font-bold text-slate-600 mb-1">No Projects Found</h3>
                    <p class="text-slate-400 text-sm">No users have created QIP projects yet.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Render — grouped by user
        let html = `
            <div class="mb-6 grid grid-cols-3 gap-4">
                <div class="bg-rcem-purple text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${totalProjects}</div>
                    <div class="text-xs opacity-80 mt-1">Total Projects</div>
                </div>
                <div class="bg-indigo-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${totalUsers}</div>
                    <div class="text-xs opacity-80 mt-1">Users</div>
                </div>
                <div class="bg-emerald-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${state.adminAllProjects.reduce((s, p) => s + (p.data.pdsa || []).length, 0)}</div>
                    <div class="text-xs opacity-80 mt-1">Total PDSA Cycles</div>
                </div>
            </div>`;

        for (const [uid, projects] of Object.entries(userMap)) {
            const email = escapeHtml(userEmails[uid] || uid);
            html += `
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <div class="w-7 h-7 bg-rcem-purple rounded-full flex items-center justify-center flex-shrink-0">
                            <i data-lucide="user" class="w-3.5 h-3.5 text-white"></i>
                        </div>
                        <span class="font-bold text-slate-700">${email}</span>
                        <span class="text-xs text-slate-400 ml-1">${projects.length} project${projects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

            projects.forEach(({ projectId, data }, idx) => {
                const title = escapeHtml(data.meta?.title || 'Untitled');
                const created = data.meta?.created ? new Date(data.meta.created).toLocaleDateString('en-GB') : '?';
                const updated = data.meta?.updated ? new Date(data.meta.updated).toLocaleDateString('en-GB') : '?';
                const pdsaCount = (data.pdsa || []).length;
                const dataPoints = (data.chartData || []).length;
                const c = data.checklist || {};
                const filled = ['problem_desc', 'aim', 'outcome_measure', 'process_measure', 'lit_review'].filter(k => c[k]).length;
                const progress = Math.round((filled / 5) * 100);

                html += `
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                         onclick="window.adminViewProject('${uid}', '${projectId}')">
                        <div class="flex items-start justify-between mb-2 gap-2">
                            <h3 class="font-bold text-slate-800 truncate group-hover:text-rcem-purple transition-colors" title="${title}">${title}</h3>
                            <span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">Read-only</span>
                        </div>
                        <p class="text-xs text-slate-400 mb-3">Created: ${created}&ensp;·&ensp;Updated: ${updated}</p>
                        <div class="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                            <div class="bg-rcem-purple h-1.5 rounded-full transition-all" style="width:${progress}%"></div>
                        </div>
                        <div class="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-0.5"></i>${pdsaCount} PDSA
                            </span>
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="activity" class="w-3 h-3 inline mr-0.5"></i>${dataPoints} data pts
                            </span>
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="check-square" class="w-3 h-3 inline mr-0.5"></i>${progress}% complete
                            </span>
                        </div>
                    </div>`;
            });

            html += `</div></div>`;
        }

        listEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error('[Admin] loadMasterAdminDashboard error:', e);
        listEl.innerHTML = `
            <div class="p-8 bg-red-50 rounded-xl border border-red-200 text-center">
                <i data-lucide="alert-circle" class="w-8 h-8 mx-auto text-red-500 mb-3"></i>
                <h3 class="font-bold text-red-700 mb-1">Failed to Load Projects</h3>
                <p class="text-red-600 text-sm mb-2">${escapeHtml(e.message)}</p>
                <p class="text-slate-500 text-xs">Make sure the Firestore collection group rules are set up correctly (see the rules provided).</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

window.adminViewProject = async function(uid, projectId) {
    if (!state.isMasterAdmin) return;
    try {
        const snap = await getDoc(doc(db, `users/${uid}/projects`, projectId));
        if (!snap.exists()) { showToast('Project not found', 'error'); return; }

        const data = snap.data();
        // Ensure all expected fields exist
        if (!data.checklist) data.checklist = {};
        if (!data.drivers) data.drivers = { primary: [], secondary: [], changes: [] };
        if (!data.fishbone) data.fishbone = {};
        if (!data.pdsa) data.pdsa = [];
        if (!data.chartData) data.chartData = [];
        if (!data.stakeholders) data.stakeholders = [];
        if (!data.gantt) data.gantt = [];
        if (!data.teamMembers) data.teamMembers = [];
        if (!data.chartSettings) data.chartSettings = {};
        if (!data.process) data.process = ['Start', 'End'];
        if (!data.surveys) data.surveys = [];

        state.projectData = data;
        state.currentProjectId = projectId;
        state.isReadOnly = true;
        state.isLeadViewing = false;

        const headerTitle = document.getElementById('project-header-title');
        if (headerTitle) headerTitle.textContent = (data.meta?.title || 'Untitled') + ' \u2014 Admin View';

        const topBar = document.getElementById('top-bar');
        if (topBar) topBar.classList.remove('hidden');

        window.router('dashboard');
        showToast('Admin: read-only project view', 'info');
    } catch (e) {
        showToast('Failed to open project: ' + e.message, 'error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE MANAGEMENT — load and toggle roles in Settings modal
// ─────────────────────────────────────────────────────────────────────────────
async function loadRolesIntoSettings() {
    const container = document.getElementById('settings-roles-container');
    if (!container || !state.currentUser || !db) return;

    container.innerHTML = '<p class="text-xs text-slate-400 italic">Loading...</p>';

    try {
        const snap = await getDoc(doc(db, 'qipUsers', state.currentUser.uid));
        const currentRoles = snap.exists() ? (snap.data().roles || []) : [];

        const roleOptions = [
            { key: 'trainee',   label: 'Trainee',                icon: 'user',             desc: 'Manage your own QIP projects' },
            { key: 'supervisor', label: 'Clinical Supervisor',   icon: 'user-check',        desc: 'Review & sign off trainees\' projects' },
            { key: 'qip_lead',   label: 'Departmental QIP Lead', icon: 'layout-dashboard',  desc: 'Dashboard of all department QIPs' }
        ];

        container.innerHTML = roleOptions.map(ro => {
            const active = currentRoles.includes(ro.key);
            return `
                <div class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <i data-lucide="${ro.icon}" class="w-4 h-4 text-rcem-purple flex-shrink-0"></i>
                        <div class="min-w-0">
                            <p class="text-xs font-medium text-slate-700 truncate">${ro.label}</p>
                            <p class="text-[11px] text-slate-400 truncate">${ro.desc}</p>
                        </div>
                    </div>
                    <button onclick="window.toggleSettingsRole('${ro.key}', this)"
                            data-active="${active}"
                            class="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${active
                                ? 'bg-rcem-purple text-white border-rcem-purple hover:bg-indigo-700'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-rcem-purple hover:text-rcem-purple'}">
                        ${active ? 'Remove' : 'Add'}
                    </button>
                </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
    } catch (e) {
        container.innerHTML = '<p class="text-xs text-red-500">Could not load roles</p>';
        console.warn('[Settings] loadRolesIntoSettings error:', e);
    }
}

window.toggleSettingsRole = async function(role, btnEl) {
    if (!state.currentUser || !db) return;
    const wasActive = btnEl.dataset.active === 'true';

    try {
        const snap = await getDoc(doc(db, 'qipUsers', state.currentUser.uid));
        let roles = snap.exists() ? (snap.data().roles || []) : [];

        if (wasActive) {
            roles = roles.filter(r => r !== role);
        } else {
            if (!roles.includes(role)) roles.push(role);
        }

        await setDoc(doc(db, 'qipUsers', state.currentUser.uid), {
            email: state.currentUser.email || '',
            roles
        }, { merge: true });

        // Refresh the role list UI
        await loadRolesIntoSettings();
        showToast(`Role ${wasActive ? 'removed' : 'added'}`, 'success');
    } catch (e) {
        showToast('Failed to update roles: ' + e.message, 'error');
    }
};
