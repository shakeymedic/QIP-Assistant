// app.js
import { auth, db, getFirebaseStatus } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Import State & Utils
import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";
import { callAI } from "./ai.js";

// Import Logic Modules
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

console.log('🚀 App starting...');

// SECURITY: Clean any accidentally leaked credentials from URL immediately
(function cleanURL() {
    const url = new URL(window.location.href);
    const sensitiveParams = ['password', 'pass', 'pwd', 'passwd', 'secret', 'token', 'key', 'apikey'];
    let needsClean = false;
    
    sensitiveParams.forEach(param => {
        if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            needsClean = true;
            console.warn('⚠️ SECURITY: Removed sensitive parameter from URL:', param);
        }
    });
    
    if (url.searchParams.has('email') && !url.searchParams.has('share')) {
        url.searchParams.delete('email');
        needsClean = true;
        console.warn('⚠️ SECURITY: Removed email parameter from URL');
    }
    
    if (needsClean) {
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        console.log('✅ URL cleaned of sensitive data');
    }
})();

console.log('Firebase Status:', getFirebaseStatus());
console.log('Auth:', auth ? '✅' : '❌');
console.log('DB:', db ? '✅' : '❌');

// ==========================================================================
// 1. GLOBAL BINDINGS (Connecting HTML Buttons to JS Logic)
// ==========================================================================

// Expose Project Data for Debugging/Console
Object.defineProperty(window, 'projectData', { get: () => state.projectData, set: (v) => state.projectData = v });

// --- NAVIGATION & ROUTER ---
window.router = (view) => {
    if (view !== 'projects' && !state.projectData) { 
        showToast("Please select a project first.", "error"); 
        return; 
    }
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    // Show selected view
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.remove('hidden');
    
    // Update Sidebar Active State
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    // Close Mobile Menu if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('z-50')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }

    R.renderAll(view);
};

window.returnToProjects = () => {
    state.currentProjectId = null; 
    state.projectData = null; 
    state.isReadOnly = false;
    const ind = document.getElementById('readonly-indicator');
    if(ind) ind.classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    
    if (window.unsubscribeProject) window.unsubscribeProject();
    loadProjectList();
};

// --- DATA PORTABILITY (Backup/Restore) ---
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

// --- GLOBAL SETTINGS (AI & Keys) ---
window.openGlobalSettings = () => {
    const el = document.getElementById('settings-ai-key');
    if(el) el.value = state.aiKey || '';
    const modal = document.getElementById('global-settings-modal');
    if(modal) modal.classList.remove('hidden');
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
    
    // Refresh view to show/hide AI buttons
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

// ==========================================
// 2. AI FUNCTIONS
// ==========================================

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

// --- EXPORT FUNCTIONS ---
window.exportPPTX = exportPPTX;
window.printPoster = printPoster;
window.printPosterOnly = printPosterOnly;
window.openPortfolioExport = R.openPortfolioExport;

// --- DATA & CHART FUNCTIONS ---
window.addDataPoint = addDataPoint;
window.deleteDataPoint = deleteDataPoint;
window.downloadCSVTemplate = downloadCSVTemplate;
window.importCSV = importCSV;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.renderDataView = R.renderDataView;
window.renderChart = renderChart;

// Chart Controls
window.setChartMode = setChartMode;
window.updateChartEducation = updateChartEducation;
window.openChartSettings = openChartSettings;
window.saveChartSettings = saveChartSettings;
window.copyChartImage = copyChartImage;

// --- TOOL FUNCTIONS (Fishbone/Driver/Process) ---
window.setToolMode = setToolMode;
window.toggleToolList = R.toggleToolList;
window.toggleToolHelp = toggleToolHelp;
window.resetProcess = resetProcess;
window.updateFishCat = R.updateFishCat;
window.updateFishCause = R.updateFishCause;
window.addFishCause = R.addFishCause;
window.removeFishCause = R.removeFishCause;
window.renderTools = renderTools;

// --- CHECKLIST & AIM ---
window.saveChecklist = (key, val) => { 
    if (!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist[key] = val; 
    window.saveData(); 
};
window.saveChecklistField = window.saveChecklist; // Alias for HTML compatibility
window.saveSmartAim = R.saveSmartAim; 
window.renderChecklist = R.renderChecklist; 
window.startOnboarding = startOnboarding;

// --- TEAM & LEADERSHIP ---
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
    
    // Clear form fields
    document.getElementById('member-name').value = '';
    document.getElementById('member-role').value = '';
    document.getElementById('member-grade').value = '';
    document.getElementById('member-resp').value = '';
    document.getElementById('member-init').value = '';
    
    R.renderTeam();
    showToast("Member added", "success");
};
window.deleteMember = (index) => {
    if(confirm("Remove this team member?")) {
        state.projectData.teamMembers.splice(index, 1);
        window.saveData();
        R.renderTeam();
        showToast("Member removed", "info");
    }
};
window.addLeadershipLog = R.addLeadershipLog;
window.deleteLeadershipLog = R.deleteLeadershipLog;

// --- STAKEHOLDERS ---
window.addStakeholder = R.addStakeholder;
window.updateStake = R.updateStake;
window.removeStake = R.removeStake;
window.toggleStakeView = R.toggleStakeView;

// --- PDSA CYCLES ---
window.addPDSA = R.addPDSA;
window.updatePDSA = R.updatePDSA;
window.deletePDSA = R.deletePDSA;

// --- GANTT CHART ---
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
            alert(`⚠️ Task must start after dependency '${depTask.name}' finishes.`);
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
    
    // Clear form fields
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
    if(confirm("Delete this task?")) {
        state.projectData.gantt = state.projectData.gantt.filter(t => t.id !== id);
        window.saveData();
        R.renderGantt();
        showToast("Task deleted", "info");
    }
};
window.deleteGanttTask = (index) => {
    if(confirm("Delete this task?")) {
        state.projectData.gantt.splice(index, 1);
        window.saveData();
        R.renderGantt();
        showToast("Task deleted", "info");
    }
};

// --- PUBLISH & CALCULATORS ---
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

// ==========================================================================
// 3. CORE LOGIC (Auth, Save, Load)
// ==========================================================================

// Main Save Function (Debounced & History Push)
window.saveData = async function(skipHistory = false) {
    if (state.isReadOnly) return;
    
    // Demo Mode: Local Only
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

    // Firebase Save
    if (!state.currentProjectId || !state.currentUser) return;
    
    if (!db) {
        showToast("Database not connected. Changes saved locally.", "warning");
        return;
    }
    
    if(!skipHistory) pushHistory();
    
    try {
        await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
        
        // Priority 5.2 - Auto-save indicator made more prominent
        const s = document.getElementById('save-status');
        if(s) { 
            s.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Saved`;
            s.classList.remove('opacity-0', 'text-emerald-600');
            s.classList.add('text-white', 'bg-emerald-500', 'px-3', 'py-1', 'rounded-full', 'shadow-sm', 'transition-all');
            if(typeof lucide !== 'undefined') lucide.createIcons();
            
            setTimeout(() => {
                s.classList.add('opacity-0');
                setTimeout(() => {
                    s.classList.remove('text-white', 'bg-emerald-500', 'px-3', 'py-1', 'rounded-full', 'shadow-sm');
                    s.classList.add('text-emerald-600');
                    s.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Saved`;
                    if(typeof lucide !== 'undefined') lucide.createIcons();
                }, 300);
            }, 2500); 
        }
    } catch (e) {
        console.error("Save failed", e);
        showToast("Save failed: " + e.message, "error");
    }
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

// ==========================================================================
// AUTHENTICATION ERROR HANDLING
// ==========================================================================

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
            console.error('Unknown auth error:', errorCode, error.message);
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

// --- AUTH LISTENER ---
if (auth) {
    onAuthStateChanged(auth, async (user) => {
        console.log('🔐 Auth state changed:', user ? user.email : 'No user');
        
        const isShared = await checkShareLink();
        if (isShared) return;

        state.currentUser = user;
        if (user) {
            // FIX: Show the app container
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('app-sidebar').classList.add('lg:flex');
            document.getElementById('auth-screen').classList.add('hidden');
            const ud = document.getElementById('user-display');
            if(ud) ud.textContent = user.email;
            loadProjectList();
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    });
} else {
    console.error("⚠️ Firebase Auth not initialized.");
}

async function checkShareLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharePid = urlParams.get('share');
    const shareUid = urlParams.get('uid');

    if (sharePid && shareUid) {
        state.isReadOnly = true;
        const ind = document.getElementById('readonly-indicator');
        if(ind) ind.classList.remove('hidden');
        
        // FIX: Show the app container for shared links
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
            console.error(e);
            showToast("Could not load shared project.", "error");
        }
        return true;
    }
    return false;
}

async function loadProjectList() {
    if(state.isReadOnly) return;
    window.router('projects');
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.add('hidden');
    const listEl = document.getElementById('project-list');
    
    // --- DEMO MODE RENDER ---
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

    // --- FIREBASE PROJECT LIST ---
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
            const date = new Date(d.meta?.created).toLocaleDateString();
            listEl.innerHTML += `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer relative group hover:shadow-md transition-all" onclick="window.openProject('${doc.id}')">
                    <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors truncate">${escapeHtml(d.meta?.title) || 'Untitled'}</h3>
                    <p class="text-xs text-slate-400 mb-4">Created: ${date}</p>
                    <button onclick="event.stopPropagation(); window.deleteProject('${doc.id}')" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error("Error loading projects:", e);
        showToast("Failed to load projects: " + e.message, "error");
    }
}

// --- PROJECT ACTIONS ---
window.createNewProject = async () => {
    const title = prompt("Project Title:", "New QIP");
    if (!title) return;
    let template = JSON.parse(JSON.stringify(emptyProject));
    template.meta.title = title;
    template.meta.created = new Date().toISOString();
    template.meta.updated = new Date().toISOString();
    
    try {
        if(!db) throw new Error("No DB connection");
        const docRef = await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), template);
        
        showToast("Project created successfully", "success");
        
        // Open the project immediately
        window.openProject(docRef.id);
        
        // Launch onboarding wizard after a short delay to ensure DOM is ready
        setTimeout(() => {
            if (window.startOnboarding) window.startOnboarding();
        }, 600);
        
    } catch (e) {
        console.error("Error creating project:", e);
        showToast("Failed to create project: " + e.message, "error");
    }
};

window.deleteProject = async (id) => {
    if (confirm("Are you sure? This cannot be undone.")) { 
        try {
            if(!db) throw new Error("No DB connection");
            await deleteDoc(doc(db, `users/${state.currentUser.uid}/projects`, id)); 
            loadProjectList(); 
            showToast("Project deleted", "info");
        } catch (e) {
            console.error("Error deleting project:", e);
            showToast("Failed to delete project: " + e.message, "error");
        }
    }
};

window.openProject = (id) => {
    state.currentProjectId = id;
    if (window.unsubscribeProject) window.unsubscribeProject();
    
    if (!db) { showToast("No DB connection", "error"); return; }
    
    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!state.projectData) { 
                state.historyStack = [JSON.stringify(data)]; 
                state.redoStack = []; 
                updateUndoRedoButtons(); 
            }
            state.projectData = data;
            
            // Schema Validation (Safe Defaults)
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
            
            const headerTitle = document.getElementById('project-header-title');
            if(headerTitle) headerTitle.textContent = state.projectData.meta.title;
            
            let currentView = document.querySelector('.view-section:not(.hidden)');
            if (currentView) {
                let viewName = currentView.id.replace('view-', '');
                if(viewName !== 'projects') R.renderAll(viewName);
            }
        }
    }, (error) => {
        console.error("Error listening to project:", error);
        showToast("Connection error: " + error.message, "error");
    });
    
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
};

// ==========================================================================
// AUTHENTICATION HANDLERS
// ==========================================================================

function initAuthHandlers() {
    console.log('📄 Initializing Auth Handlers');
    
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
            
            if (!emailInput || !passwordInput) {
                showToast('Form error: Input fields not found', 'error');
                return;
            }
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email) {
                setFieldError('email', true, 'Email is required');
                emailInput.focus();
                return;
            }
            
            if (!isValidEmail(email)) {
                setFieldError('email', true, 'Please enter a valid email address');
                emailInput.focus();
                return;
            }
            
            if (!password) {
                setFieldError('password', true, 'Password is required');
                passwordInput.focus();
                return;
            }
            
            if (password.length < 6) {
                setFieldError('password', true, 'Password must be at least 6 characters');
                passwordInput.focus();
                return;
            }
            
            if (!auth) {
                showToast("Authentication service unavailable. Please refresh.", "error");
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
    
    if(btnRegister) {
        btnRegister.addEventListener('click', async () => {
            clearFieldErrors();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            
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
            
            setButtonLoading(btnRegister, true, 'Creating account...');
            
            try { 
                await createUserWithEmailAndPassword(auth, email, password);
                showToast("Account created successfully!", "success");
            } 
            catch (error) {
                const errorDetails = getAuthErrorDetails(error);
                if (errorDetails.field) {
                    setFieldError(errorDetails.field, true, errorDetails.message);
                }
                showToast(errorDetails.message, errorDetails.type);
                setButtonLoading(btnRegister, false, null, 'Register');
            }
        });
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
            console.log('🎮 Demo mode activated');
            state.isDemoMode = true;
            state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
            
            // FIX: Show the app container for demo mode
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
            showToast("Demo mode activated - explore the Gold Standard example!", "success");
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
    showToast("Gold Standard Example Loaded - explore all features!", "info");
};

window.shareProject = () => {
    if(state.isDemoMode) { showToast("Cannot share demo projects.", "error"); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${state.currentProjectId}&uid=${state.currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => showToast("Share Link copied!", "success"));
};

// Keyboard Shortcuts
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

// Initial Setup
if(document.readyState === 'complete') {
    updateOnlineStatus();
} else {
    window.addEventListener('load', updateOnlineStatus);
}

// Initialize Mermaid
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

// Initialize Lucide Icons
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

window.checkFirebaseStatus = () => {
    const status = getFirebaseStatus();
    console.log('🔥 Firebase Status:', status);
    return status;
};

console.log('✅ App initialization complete');
