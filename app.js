import { auth, db, getFirebaseStatus } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Import State & Utils
import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";
import { callAI } from "./ai.js";

// Import Logic Modules
// NOTE: addCauseWithWhys, addDriver, addStep are window globals defined in charts.js, not exports
import { 
    renderChart, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, 
    zoomIn, zoomOut, resetZoom, resetProcess, 
    setToolMode, setChartMode, updateChartEducation, renderTools, toolMode,
    openChartSettings, saveChartSettings, copyChartImage, renderFullViewChart,
    toggleToolHelp
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";

console.log('🚀 App starting...');
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
            // Immediate cloud save to persist imported data (if logged in)
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
        Requirements: 3 Primary Drivers, 4 Secondary Drivers, 5 Specific Change Ideas.
    `;

    const result = await callAI(prompt, true); // JSON mode

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
    
    // Sort and format data for token efficiency
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

// --- TOOL FUNCTIONS (Fishbone/Driver) ---
// Note: addCauseWithWhys, addDriver, addStep are defined as window globals in charts.js
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
window.saveSmartAim = R.saveSmartAim; 
window.renderChecklist = R.renderChecklist; 

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

// --- PUBLISH & CALCULATORS ---
window.switchPublishMode = R.renderPublish;
window.copyReport = R.copyReport;
window.saveResults = (val) => { 
    if(!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist.results_text = val; 
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
            // Refresh specific views that depend on data
            if(viewName === 'tools' || viewName === 'data' || viewName === 'dashboard') {
                R.renderAll(viewName);
            }
        }
        return; 
    }

    // Firebase Save
    if (!state.currentProjectId || !state.currentUser) return;
    
    // FIX: Check if DB is initialized
    if (!db) {
        showToast("Database not connected. Changes saved locally.", "warning");
        return;
    }
    
    if(!skipHistory) pushHistory();
    
    try {
        await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
        // Optional: Trigger a UI "Saved" indicator
        const s = document.getElementById('save-status');
        if(s) { s.classList.remove('opacity-0'); setTimeout(() => s.classList.add('opacity-0'), 2000); }
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
// AUTHENTICATION ERROR HANDLING - COMPREHENSIVE
// ==========================================================================

/**
 * Get user-friendly error message from Firebase Auth error code
 * @param {Error} error - Firebase Auth error object
 * @returns {Object} - { message: string, type: string, field: string|null }
 */
function getAuthErrorDetails(error) {
    const errorCode = error.code || '';
    const errorDetails = {
        message: 'An unexpected error occurred. Please try again.',
        type: 'error',
        field: null, // 'email', 'password', or null for general errors
        suggestion: null
    };

    switch (errorCode) {
        // Email-related errors
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
            
        // Password-related errors
        case 'auth/wrong-password':
            errorDetails.message = 'Incorrect password. Please try again.';
            errorDetails.field = 'password';
            errorDetails.suggestion = 'reset';
            break;
        case 'auth/weak-password':
            errorDetails.message = 'Password is too weak. Use at least 6 characters with a mix of letters and numbers.';
            errorDetails.field = 'password';
            break;
        case 'auth/missing-password':
            errorDetails.message = 'Please enter your password.';
            errorDetails.field = 'password';
            break;
            
        // Combined credential errors (Firebase v9+ returns this for security)
        case 'auth/invalid-credential':
            errorDetails.message = 'Invalid email or password. Please check your details and try again.';
            errorDetails.field = null; // Could be either
            break;
        case 'auth/invalid-login-credentials':
            errorDetails.message = 'Invalid email or password. Please check your details and try again.';
            errorDetails.field = null;
            break;
            
        // Account status errors
        case 'auth/user-disabled':
            errorDetails.message = 'This account has been disabled. Please contact support.';
            errorDetails.type = 'warning';
            break;
        case 'auth/account-exists-with-different-credential':
            errorDetails.message = 'An account already exists with this email using a different sign-in method.';
            errorDetails.field = 'email';
            break;
            
        // Rate limiting and security
        case 'auth/too-many-requests':
            errorDetails.message = 'Too many failed attempts. Please wait a few minutes before trying again, or reset your password.';
            errorDetails.type = 'warning';
            errorDetails.suggestion = 'wait';
            break;
        case 'auth/operation-not-allowed':
            errorDetails.message = 'Email/password sign-in is not enabled. Please contact support.';
            errorDetails.type = 'warning';
            break;
            
        // Network errors
        case 'auth/network-request-failed':
            errorDetails.message = 'Network error. Please check your internet connection and try again.';
            errorDetails.type = 'warning';
            break;
        case 'auth/internal-error':
            errorDetails.message = 'A server error occurred. Please try again in a moment.';
            break;
        case 'auth/timeout':
            errorDetails.message = 'The request timed out. Please check your connection and try again.';
            errorDetails.type = 'warning';
            break;
            
        // Popup/redirect errors (for OAuth - future use)
        case 'auth/popup-closed-by-user':
            errorDetails.message = 'Sign-in was cancelled. Please try again.';
            errorDetails.type = 'info';
            break;
            
        default:
            // Log unknown errors for debugging
            console.error('Unknown auth error:', errorCode, error.message);
            errorDetails.message = `Authentication error: ${error.message || 'Unknown error'}`;
    }

    return errorDetails;
}

/**
 * Show/hide field-level error styling
 * @param {string} fieldId - The input field ID
 * @param {boolean} hasError - Whether to show error state
 * @param {string} message - Error message (optional)
 */
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

/**
 * Clear all field errors
 */
function clearFieldErrors() {
    setFieldError('email', false);
    setFieldError('password', false);
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Set button loading state
 * @param {HTMLElement} button 
 * @param {boolean} isLoading 
 * @param {string} loadingText 
 * @param {string} originalText 
 */
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
        // Recreate icons if needed
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
    console.error("⚠️ Firebase Auth not initialized. Check your API configuration.");
    // Show error in UI
    window.addEventListener('DOMContentLoaded', () => {
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) {
            const formContainer = authScreen.querySelector('.p-8.space-y-4');
            if (formContainer) {
                const errorAlert = document.createElement('div');
                errorAlert.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm';
                errorAlert.innerHTML = `
                    <div class="flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-5 h-5"></i>
                        <div>
                            <strong>Connection Error</strong>
                            <p class="text-xs mt-1">Unable to connect to authentication services. Please refresh the page or try again later.</p>
                        </div>
                    </div>
                `;
                formContainer.insertBefore(errorAlert, formContainer.firstChild);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
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
             <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide">Gold Standard</div>
             <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery</h3>
             <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ED Registrar)</p>
             <div class="flex gap-2 text-xs font-medium text-slate-500">
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 40 Data</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 2 Cycles</span>
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
        await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), template);
        loadProjectList();
        showToast("Project created", "success");
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
    
    // Real-time listener for collaboration
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
            
            // If inside a view, refresh it to show new data
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
// AUTHENTICATION HANDLERS - IMPROVED
// ==========================================================================

function initAuthHandlers() {
    console.log('📄 Initializing Auth Handlers');
    
    // Auth Form Handler
    const authForm = document.getElementById('auth-form');
    console.log('Auth form:', authForm ? '✅ Found' : '❌ Not found');
    
    if(authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔑 Form submitted');
            
            // Clear previous errors
            clearFieldErrors();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = authForm.querySelector('button[type="submit"]');
            
            if (!emailInput || !passwordInput) {
                console.error('❌ Email or password input not found');
                showToast('Form error: Input fields not found', 'error');
                return;
            }
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            // Client-side validation
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
            
            // Check if auth is available
            if (!auth) {
                showToast("Authentication service unavailable. Please refresh the page.", "error");
                return;
            }
            
            console.log('Attempting login for:', email);
            
            // Show loading state
            setButtonLoading(submitBtn, true, 'Signing in...');
            
            try { 
                await signInWithEmailAndPassword(auth, email, password);
                console.log('✅ Login successful');
                showToast("Signed in successfully!", "success");
            } 
            catch (error) {
                console.error('❌ Login error:', error.code, error.message);
                
                const errorDetails = getAuthErrorDetails(error);
                
                // Show field-specific error if applicable
                if (errorDetails.field) {
                    setFieldError(errorDetails.field, true, errorDetails.message);
                }
                
                // Show toast with error message
                showToast(errorDetails.message, errorDetails.type);
                
                // Clear password field on error (security best practice)
                passwordInput.value = '';
                
                // Show suggestion if available
                if (errorDetails.suggestion === 'register') {
                    setTimeout(() => {
                        showToast("Don't have an account? Click 'Register' to create one.", "info");
                    }, 1500);
                } else if (errorDetails.suggestion === 'signin') {
                    setTimeout(() => {
                        showToast("Already have an account? Use 'Sign In' instead.", "info");
                    }, 1500);
                } else if (errorDetails.suggestion === 'wait') {
                    // Disable the form briefly
                    submitBtn.disabled = true;
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        showToast("You can try again now.", "info");
                    }, 30000); // 30 seconds
                }
                
                // Reset button state
                setButtonLoading(submitBtn, false, null, 'Sign In');
            }
        });
        
        // Clear errors on input
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput) {
            emailInput.addEventListener('input', () => setFieldError('email', false));
            emailInput.addEventListener('focus', () => setFieldError('email', false));
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('input', () => setFieldError('password', false));
            passwordInput.addEventListener('focus', () => setFieldError('password', false));
        }
    }

    // Register Button Handler
    const btnRegister = document.getElementById('btn-register');
    console.log('Register button:', btnRegister ? '✅ Found' : '❌ Not found');
    
    if(btnRegister) {
        btnRegister.addEventListener('click', async () => {
            // Clear previous errors
            clearFieldErrors();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            
            if (!emailInput || !passwordInput) {
                console.error('❌ Email or password input not found');
                showToast('Form error: Input fields not found', 'error');
                return;
            }
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            // Client-side validation
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
                showToast("Authentication service unavailable. Please refresh the page.", "error");
                return;
            }
            
            // Show loading state
            setButtonLoading(btnRegister, true, 'Creating account...');
            
            try { 
                await createUserWithEmailAndPassword(auth, email, password);
                console.log('✅ Account created');
                showToast("Account created successfully! You are now signed in.", "success");
            } 
            catch (error) {
                console.error('❌ Registration error:', error.code, error.message);
                
                const errorDetails = getAuthErrorDetails(error);
                
                // Show field-specific error if applicable
                if (errorDetails.field) {
                    setFieldError(errorDetails.field, true, errorDetails.message);
                }
                
                // Show toast
                showToast(errorDetails.message, errorDetails.type);
                
                // Show suggestion
                if (errorDetails.suggestion === 'signin') {
                    setTimeout(() => {
                        showToast("Try clicking 'Sign In' instead.", "info");
                    }, 1500);
                }
                
                // Reset button
                setButtonLoading(btnRegister, false, null, 'Register');
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => { 
            try {
                if(auth) await signOut(auth);
                showToast("Signed out successfully", "info");
                // Clear state
                state.currentUser = null;
                state.currentProjectId = null;
                state.projectData = null;
                // Reload to reset everything cleanly
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                console.error('Logout error:', error);
                showToast("Error signing out. Please try again.", "error");
            }
        });
    }

    // Mobile Menu
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

    // Demo Mode Toggle
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

    // Demo Auth Button
    const demoAuthBtn = document.getElementById('demo-auth-btn');
    if(demoAuthBtn) {
        demoAuthBtn.onclick = () => {
            console.log('🎮 Demo mode button clicked');
            state.isDemoMode = true;
            state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
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
    
    console.log('Demo button:', demoAuthBtn ? '✅ Found' : '❌ Not found');
}

// ROBUST LOADING CHECK:
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
    showToast("Gold Standard Example Loaded", "info");
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

// Debug helper - expose Firebase status to window
window.checkFirebaseStatus = () => {
    const status = getFirebaseStatus();
    console.log('🔥 Firebase Status:', status);
    return status;
};

console.log('✅ App initialization complete');
