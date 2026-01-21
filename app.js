import { auth, db } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Import State & Utils
import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";

// Import Logic Modules
import { 
    renderChart, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, 
    zoomIn, zoomOut, resetZoom, addCauseWithWhys, addDriver, addStep, resetProcess, 
    setToolMode, setChartMode, updateChartEducation, renderTools, toolMode,
    openChartSettings, saveChartSettings, copyChartImage, renderFullViewChart,
    toggleToolHelp
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";

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
    if (sidebar.classList.contains('z-50')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }

    R.renderAll(view);
};

window.returnToProjects = () => {
    state.currentProjectId = null; 
    state.projectData = null; 
    state.isReadOnly = false;
    document.getElementById('readonly-indicator').classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    
    if (window.unsubscribeProject) window.unsubscribeProject();
    loadProjectList();
};

// --- GLOBAL SETTINGS (AI KEY) ---
window.openGlobalSettings = () => {
    document.getElementById('settings-ai-key').value = state.aiKey || '';
    document.getElementById('global-settings-modal').classList.remove('hidden');
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
    // Re-render current view to show/hide AI buttons
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        window.router(viewName);
    }
};

window.toggleKeyVis = () => {
    const input = document.getElementById('settings-ai-key');
    input.type = input.type === 'password' ? 'text' : 'password';
};

window.hasAI = () => !!state.aiKey;

// Placeholder AI Function
window.aiGeneratePDSA = async () => {
    if(!window.hasAI()) { showToast("No API Key found in Settings", "error"); return; }
    // NOTE: This is where you would call the OpenAI/Gemini API using state.aiKey
    alert("AI Integration: This would now call the API using your key: " + state.aiKey.substring(0,5) + "...");
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
window.setToolMode = setToolMode;
window.toggleToolList = R.toggleToolList;
window.toggleToolHelp = toggleToolHelp;
window.addCauseWithWhys = addCauseWithWhys;
window.addDriver = addDriver;
window.addStep = addStep;
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
// 2. CORE LOGIC (Auth, Save, Load)
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

// --- AUTH LISTENER ---
onAuthStateChanged(auth, async (user) => {
    const isShared = await checkShareLink();
    if (isShared) return;

    state.currentUser = user;
    if (user) {
        document.getElementById('app-sidebar').classList.add('lg:flex');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display').textContent = user.email;
        loadProjectList();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

async function checkShareLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharePid = urlParams.get('share');
    const shareUid = urlParams.get('uid');

    if (sharePid && shareUid) {
        state.isReadOnly = true;
        document.getElementById('readonly-indicator').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-sidebar').classList.add('lg:flex');
        document.body.classList.add('readonly-mode');
        
        try {
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
    document.getElementById('top-bar').classList.add('hidden');
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
        lucide.createIcons();
        return;
    }

    // --- FIREBASE PROJECT LIST ---
    try {
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
        lucide.createIcons();
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
            
            document.getElementById('project-header-title').textContent = state.projectData.meta.title;
            
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
    
    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

// --- HANDLERS ---
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); 
        showToast("Signed in successfully", "success");
    } 
    catch (error) { 
        showToast("Login failed: " + error.message, "error"); 
    }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showToast("Please enter email and password", "error");
        return;
    }
    
    if (password.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        return;
    }
    
    try { 
        await createUserWithEmailAndPassword(auth, email, password); 
        showToast("Account created!", "success"); 
    } 
    catch (error) { 
        showToast("Registration failed: " + error.message, "error"); 
    }
});

document.getElementById('logout-btn').addEventListener('click', () => { 
    signOut(auth); 
    window.location.reload(); 
});

document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden'); 
        sidebar.classList.add('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
    } else {
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
    }
});

// Demo Mode Toggle
document.getElementById('demo-toggle').addEventListener('change', (e) => {
    state.isDemoMode = e.target.checked;
    state.currentProjectId = null; 
    state.projectData = null;
    const wm = document.getElementById('demo-watermark');
    if (state.isDemoMode) { 
        wm.classList.remove('hidden'); 
        loadProjectList(); 
    } 
    else { 
        wm.classList.add('hidden'); 
        if (state.currentUser) loadProjectList(); 
        else document.getElementById('auth-screen').classList.remove('hidden'); 
    }
});

document.getElementById('demo-auth-btn').onclick = () => {
    state.isDemoMode = true;
    state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
    document.getElementById('app-sidebar').classList.add('lg:flex');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('demo-watermark').classList.remove('hidden');
    document.getElementById('demo-toggle').checked = true;
    loadProjectList();
};

window.openDemoProject = () => {
    state.projectData = getDemoData();
    state.currentProjectId = 'DEMO';
    state.historyStack = [JSON.stringify(state.projectData)];
    state.redoStack = [];
    updateUndoRedoButtons();

    document.getElementById('project-header-title').textContent = state.projectData.meta.title + " (DEMO)";
    document.getElementById('top-bar').classList.remove('hidden');
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
