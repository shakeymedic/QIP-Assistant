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
    setToolMode, renderTools, toolMode 
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";

// ==========================================================================
// 1. GLOBAL BINDINGS (Connecting HTML Buttons to JS Logic)
// ==========================================================================

// Expose Project Data for Debugging/Console
Object.defineProperty(window, 'projectData', { get: () => state.projectData, set: (v) => state.projectData = v });

// Navigation & View Router
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
    if (sidebar.classList.contains('fixed')) { 
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

// Export Functions
window.exportPPTX = exportPPTX;
window.printPoster = printPoster;
window.printPosterOnly = printPosterOnly;
window.openPortfolioExport = R.openPortfolioExport;

// Data & Chart Functions (from charts.js)
window.addDataPoint = addDataPoint;
window.deleteDataPoint = deleteDataPoint;
window.downloadCSVTemplate = downloadCSVTemplate;
window.importCSV = importCSV;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.renderDataView = R.renderDataView; // Re-render table

// Tool Functions (Fishbone/Driver/Process)
window.setToolMode = setToolMode;
window.toggleToolList = R.toggleToolList;
window.addCauseWithWhys = addCauseWithWhys;
window.addDriver = addDriver;
window.addStep = addStep;
window.resetProcess = resetProcess;
window.updateFishCat = R.updateFishCat;
window.updateFishCause = R.updateFishCause;
window.addFishCause = R.addFishCause;
window.removeFishCause = R.removeFishCause;

// Checklist & Aim
window.saveChecklist = (key, val) => { state.projectData.checklist[key] = val; window.saveData(); };
window.saveSmartAim = R.saveSmartAim; // Uses the Modal
window.renderChecklist = R.renderChecklist; // For real-time validation

// Team & Leadership
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
        name, 
        role, 
        grade, 
        responsibilities: resp, 
        initials: init || name.substring(0,2).toUpperCase() 
    });
    
    window.saveData();
    document.getElementById('member-modal').classList.add('hidden');
    R.renderTeam();
    showToast("Member added successfully", "success");
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

// Stakeholders
window.addStakeholder = R.addStakeholder;
window.updateStake = R.updateStake;
window.removeStake = R.removeStake;
window.toggleStakeView = R.toggleStakeView;

// PDSA Cycles
window.addPDSA = R.addPDSA;
window.updatePDSA = R.updatePDSA;
window.deletePDSA = R.deletePDSA;

// Gantt / Timeline
window.openGanttModal = () => document.getElementById('task-modal').classList.remove('hidden');
window.saveGanttTask = () => {
    const name = document.getElementById('task-name').value;
    const start = document.getElementById('task-start').value;
    const end = document.getElementById('task-end').value;
    const type = document.getElementById('task-type').value;
    const owner = document.getElementById('task-owner').value;
    const milestone = document.getElementById('task-milestone').checked;
    const dependency = document.getElementById('task-dep')?.value;

    if(!name) { showToast("Task name is required", "error"); return; }
    if(!start || !end) { showToast("Start and End dates required", "error"); return; }
    
    // Dependency Check
    if(dependency) {
        const depTask = state.projectData.gantt.find(t => t.id === dependency);
        if(depTask && new Date(depTask.end) > new Date(start)) {
            alert(`⚠️ Warning: This task starts before its dependency '${depTask.name}' finishes.`);
        }
    }

    if(!state.projectData.gantt) state.projectData.gantt = [];
    state.projectData.gantt.push({ 
        id: Date.now().toString(), 
        name, start, end, type, owner, milestone, dependency 
    });
    
    window.saveData();
    document.getElementById('task-modal').classList.add('hidden');
    R.renderGantt();
    showToast("Task added to timeline", "success");
};
window.deleteGantt = (id) => {
    if(confirm("Delete this task?")) {
        state.projectData.gantt = state.projectData.gantt.filter(t => t.id !== id);
        window.saveData();
        R.renderGantt();
        showToast("Task deleted", "info");
    }
};

// Publish & Calculators
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

// Main Save Function
window.saveData = async function(skipHistory = false) {
    if (state.isReadOnly) return;
    
    // Demo Mode Save (Local Only)
    if (state.isDemoMode) { 
        if(!skipHistory) pushHistory();
        // Just re-render current view to reflect changes
        let currentView = document.querySelector('.view-section:not(.hidden)').id.replace('view-', '');
        R.renderAll(currentView);
        return; 
    }

    // Firestore Save
    if (!state.currentProjectId || !state.currentUser) return;
    
    if(!skipHistory) pushHistory();
    
    try {
        await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
        // Visual indicator handled by specific actions (Toasts), but we can flash the save icon
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
    let currentView = document.querySelector('.view-section:not(.hidden)').id.replace('view-', '');
    R.renderAll(currentView);
    window.saveData(true); 
    updateUndoRedoButtons();
    showToast("Undo successful", "info");
};

window.redo = () => {
    if (state.redoStack.length === 0 || state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    const nextState = state.redoStack.pop();
    state.projectData = JSON.parse(nextState);
    let currentView = document.querySelector('.view-section:not(.hidden)').id.replace('view-', '');
    R.renderAll(currentView);
    window.saveData(true);
    updateUndoRedoButtons();
    showToast("Redo successful", "info");
};

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = state.historyStack.length === 0;
    if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

// Auth Listener
onAuthStateChanged(auth, async (user) => {
    const isShared = await checkShareLink();
    if (isShared) return;

    state.currentUser = user;
    if (user) {
        document.getElementById('app-sidebar').classList.remove('hidden');
        document.getElementById('app-sidebar').classList.add('flex');
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
        document.getElementById('app-sidebar').classList.remove('hidden');
        document.getElementById('app-sidebar').classList.add('flex');
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
    
    if (state.isDemoMode) {
        // ... (Demo Card HTML) ...
        listEl.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-rcem-purple relative cursor-pointer group hover:shadow-md transition-all" onclick="window.openDemoProject()">
             <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide">Gold Standard</div>
             <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery</h3>
             <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ED Registrar)</p>
             <div class="flex gap-2 text-xs font-medium text-slate-500">
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 40 Data Points</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 4 Cycles</span>
            </div>
        </div>`;
        lucide.createIcons();
        return;
    }

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
}

window.createNewProject = async () => {
    const title = prompt("Project Title:", "New QIP");
    if (!title) return;
    let template = JSON.parse(JSON.stringify(emptyProject));
    template.meta.title = title;
    await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), template);
    loadProjectList();
};

window.deleteProject = async (id) => {
    if (confirm("Are you sure?")) { await deleteDoc(doc(db, `users/${state.currentUser.uid}/projects`, id)); loadProjectList(); showToast("Project deleted", "info"); }
};

window.openProject = (id) => {
    state.currentProjectId = id;
    if (window.unsubscribeProject) window.unsubscribeProject();
    
    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!state.projectData) { state.historyStack = [JSON.stringify(data)]; state.redoStack = []; updateUndoRedoButtons(); }
            state.projectData = data;
            
            // Schema Safety Checks
            if(!state.projectData.checklist) state.projectData.checklist = {};
            if(!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!state.projectData.fishbone) state.projectData.fishbone = emptyProject.fishbone;
            if(!state.projectData.pdsa) state.projectData.pdsa = [];
            if(!state.projectData.chartData) state.projectData.chartData = [];
            if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
            if(!state.projectData.gantt) state.projectData.gantt = [];
            if(!state.projectData.teamMembers) state.projectData.teamMembers = [];
            
            document.getElementById('project-header-title').textContent = state.projectData.meta.title;
            // Refresh current view if active
            let currentView = document.querySelector('.view-section:not(.hidden)').id.replace('view-', '');
            if(currentView !== 'projects') R.renderAll(currentView);
        }
    });
    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

// Handlers
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); } 
    catch (error) { showToast("Login failed: " + error.message, "error"); }
});
document.getElementById('btn-register').addEventListener('click', async () => {
    try { await createUserWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value); showToast("Account created!", "success"); } 
    catch (error) { showToast("Registration failed: " + error.message, "error"); }
});
document.getElementById('logout-btn').addEventListener('click', () => { signOut(auth); window.location.reload(); });
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden'); sidebar.classList.add('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
    } else {
        sidebar.classList.add('hidden'); sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
    }
});

// Demo Mode
document.getElementById('demo-toggle').addEventListener('change', (e) => {
    state.isDemoMode = e.target.checked;
    state.currentProjectId = null; state.projectData = null;
    const wm = document.getElementById('demo-watermark');
    if (state.isDemoMode) { wm.classList.remove('hidden'); loadProjectList(); } 
    else { wm.classList.add('hidden'); if (state.currentUser) loadProjectList(); else document.getElementById('auth-screen').classList.remove('hidden'); }
});

document.getElementById('demo-auth-btn').onclick = () => {
    state.isDemoMode = true;
    state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.add('flex');
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
    showToast("Demo Project Loaded", "info");
};

window.shareProject = () => {
    if(state.isDemoMode) { showToast("Cannot share demo projects.", "error"); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${state.currentProjectId}&uid=${state.currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => showToast("Link copied to clipboard!", "success"));
};

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.saveData(true);
        showToast("Project Saved", "success");
    }
});

// Initialization
if(document.readyState === 'complete') updateOnlineStatus();
