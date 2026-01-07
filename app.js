import { auth, db } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Modules (Flat Structure Imports)
import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";
import { renderChart, renderFullViewChart, renderTools, setToolMode, zoomIn, zoomOut, resetZoom, addCauseWithWhys, addDriver, addStep, resetProcess, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, toolMode } from "./charts.js";
import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";

// --- EXPOSE TO GLOBAL WINDOW (Required for HTML onclick attributes) ---
Object.defineProperty(window, 'projectData', { get: () => state.projectData, set: (v) => state.projectData = v });
window.toolMode = toolMode; 
window.exportPPTX = exportPPTX;
window.printPoster = printPoster;
window.printPosterOnly = printPosterOnly;
window.setToolMode = setToolMode;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.addCauseWithWhys = addCauseWithWhys;
window.addDriver = addDriver;
window.addStep = addStep;
window.resetProcess = resetProcess;
window.deleteDataPoint = deleteDataPoint;
window.addDataPoint = addDataPoint;
window.importCSV = importCSV;
window.downloadCSVTemplate = downloadCSVTemplate;
window.toggleToolList = R.toggleToolList;
window.updateFishCat = R.updateFishCat;
window.updateFishCause = R.updateFishCause;
window.addFishCause = R.addFishCause;
window.removeFishCause = R.removeFishCause;

// Renderer Helpers
window.openMemberModal = R.openMemberModal;
window.saveMember = R.saveMember;
window.deleteMember = R.deleteMember;
window.addLeadershipLog = R.addLeadershipLog;
window.deleteLeadershipLog = R.deleteLeadershipLog;
window.saveSmartAim = R.saveSmartAim; // Kept if needed, but R.renderChecklist uses inline now
window.saveChecklist = (key, val) => { state.projectData.checklist[key] = val; window.saveData(); };
window.addStakeholder = R.addStakeholder;
window.updateStake = R.updateStake;
window.removeStake = R.removeStake;
window.openGanttModal = () => document.getElementById('task-modal').classList.remove('hidden');
window.saveGanttTask = () => {
    const id = Date.now().toString();
    const name = document.getElementById('task-name').value;
    const start = document.getElementById('task-start').value;
    const end = document.getElementById('task-end').value;
    const type = document.getElementById('task-type').value;
    const owner = document.getElementById('task-owner').value;
    const milestone = document.getElementById('task-milestone').checked;
    const dependency = document.getElementById('task-dep').value;
    
    if(!name) { showToast("Task name required", "error"); return; }
    
    state.projectData.gantt.push({ id, name, start, end, type, owner, milestone, dependency });
    window.saveData();
    document.getElementById('task-modal').classList.add('hidden');
    R.renderGantt();
    showToast("Task added", "success");
};
window.deleteGantt = (id) => {
    state.projectData.gantt = state.projectData.gantt.filter(t => t.id !== id);
    window.saveData();
    R.renderGantt();
    showToast("Task deleted", "info");
};
window.addPDSA = R.addPDSA;
window.updatePDSA = R.updatePDSA;
window.deletePDSA = R.deletePDSA;
window.saveResults = (val) => { state.projectData.checklist.results_text = val; window.saveData(); };
window.showHelp = R.showHelp; // If used
window.openHelp = R.openHelp; // If used
window.calcGreen = R.calcGreen;
window.calcMoney = R.calcMoney;
window.calcTime = R.calcTime;
window.calcEdu = R.calcEdu;
window.startTour = R.startTour;
window.openPortfolioExport = R.openPortfolioExport;
window.switchPublishMode = R.renderPublish;
window.copyReport = R.copyReport;
window.renderChecklist = R.renderChecklist; // For validation callback

// --- MAIN APP LOGIC ---

window.saveData = async function(skipHistory = false) {
    if (state.isReadOnly) return;
    if (state.isDemoMode) { 
        if(!skipHistory) pushHistory();
        R.renderAll(currentView); 
        return; 
    }
    if (!state.currentProjectId) return;
    if(!skipHistory) pushHistory();
    await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
    // Visual feedback handled by Toast generally, but can add save-status text logic here if desired
    const s = document.getElementById('save-status');
    if(s) { s.classList.remove('opacity-0'); setTimeout(() => s.classList.add('opacity-0'), 2000); }
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
    R.renderAll(currentView);
    window.saveData(true); 
    updateUndoRedoButtons();
    showToast("Undo", "info");
};

window.redo = () => {
    if (state.redoStack.length === 0 || state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    const nextState = state.redoStack.pop();
    state.projectData = JSON.parse(nextState);
    R.renderAll(currentView);
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

let currentView = 'dashboard';
window.router = (view) => {
    if (view !== 'projects' && !state.projectData) { showToast("Please select a project first.", "error"); return; }
    currentView = view;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('inset-0')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    R.renderAll(currentView);
    lucide.createIcons();
};

// --- PROJECT MANAGEMENT & AUTH ---

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
        const saveStat = document.getElementById('save-status');
        if(saveStat) saveStat.innerText = "Read Only";
        
        try {
            const docRef = doc(db, `users/${shareUid}/projects`, sharePid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                state.projectData = docSnap.data();
                state.currentProjectId = sharePid;
                document.getElementById('project-header-title').textContent = state.projectData.meta.title + " (Shared)";
                state.historyStack = [JSON.stringify(state.projectData)];
                R.renderAll('dashboard'); // Initial render
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
        state.currentProjectId = null; state.projectData = null; 
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
                <div class="flex gap-2 text-xs font-medium text-slate-500">
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200">${d.chartData?.length || 0} Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200">${d.pdsa?.length || 0} Cycles</span>
                </div>
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
    // Unsubscribe from previous listener if exists
    if (window.unsubscribeProject) window.unsubscribeProject();
    
    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!state.projectData) { state.historyStack = [JSON.stringify(data)]; state.redoStack = []; updateUndoRedoButtons(); }
            state.projectData = data;
            
            // Safety checks for new fields
            if(!state.projectData.checklist) state.projectData.checklist = {};
            if(!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!state.projectData.fishbone) state.projectData.fishbone = emptyProject.fishbone;
            if(!state.projectData.pdsa) state.projectData.pdsa = [];
            if(!state.projectData.chartData) state.projectData.chartData = [];
            if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
            if(!state.projectData.gantt) state.projectData.gantt = [];
            if(!state.projectData.teamMembers) state.projectData.teamMembers = [];
            if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
            
            document.getElementById('project-header-title').textContent = state.projectData.meta.title;
            // Only update view if we are already in a project view, otherwise let router handle it
            if (currentView !== 'projects') R.renderAll(currentView);
        }
    });
    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

// UI Handlers
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

// Offline & Demo Handlers
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
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
    R.renderAll('dashboard');
    window.router('dashboard');
    
    const s = document.getElementById('save-status');
    s.innerHTML = `<i data-lucide="info" class="w-3 h-3"></i> Demo Loaded`;
    s.classList.remove('opacity-0');
};

window.returnToProjects = () => {
    state.currentProjectId = null; state.projectData = null; state.isReadOnly = false;
    document.getElementById('readonly-indicator').classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    
    if (window.unsubscribeProject) window.unsubscribeProject();
    loadProjectList();
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
