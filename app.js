import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBdu73Xb8xf4tJU4RLhJ82ANhLMI9eu0gI",
    authDomain: "rcem-qip-app.firebaseapp.com",
    projectId: "rcem-qip-app",
    storageBucket: "rcem-qip-app.firebasestorage.app",
    messagingSenderId: "231364231220",
    appId: "1:231364231220:web:6b2260e2c885d40ecb4a61",
    measurementId: "G-XHXTBQ29FX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- HELPER: SECURITY (XSS PREVENTION) ---
const escapeHtml = (unsafe) => {
    if (!unsafe) return "";
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// --- INITIALISE LIBRARIES ---
if (window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
}

// --- STATE ---
let currentUser = null;
let currentProjectId = null;
let projectData = null;
let isDemoMode = false;
let isReadOnly = false;
let chartInstance = null;
let unsubscribeProject = null;
let toolMode = 'fishbone';
let zoomLevel = 2.0; 

// --- HISTORY STACK (UNDO/REDO) ---
let historyStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

// --- OFFLINE DETECTION ---
const updateOnlineStatus = () => {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        if (navigator.onLine) {
            indicator.classList.add('hidden');
        } else {
            indicator.classList.remove('hidden');
        }
    }
};
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
if(document.readyState === 'complete') updateOnlineStatus();

// --- SHARE / READ-ONLY LOGIC ---
async function checkShareLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharePid = urlParams.get('share');
    const shareUid = urlParams.get('uid');

    if (sharePid && shareUid) {
        isReadOnly = true;
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
                projectData = docSnap.data();
                currentProjectId = sharePid;
                document.getElementById('project-header-title').textContent = projectData.meta.title + " (Shared)";
                // Initialize history so local undo works in session
                historyStack = [JSON.stringify(projectData)];
                renderAll();
                window.router('dashboard');
            } else {
                alert("Shared project not found or permission denied.");
            }
        } catch (e) {
            console.error(e);
            alert("Could not load shared project.");
        }
        return true;
    }
    return false;
}

// --- TEMPLATES ---
const emptyProject = {
    meta: { title: "New Project", created: new Date().toISOString() },
    checklist: { results_text: "", aim: "" },
    drivers: { primary: [], secondary: [], changes: [] },
    fishbone: { categories: [{ id: 1, text: "People", causes: [] }, { id: 2, text: "Methods", causes: [] }, { id: 3, text: "Environment", causes: [] }, { id: 4, text: "Equipment", causes: [] }] },
    process: ["Start", "End"],
    pdsa: [],
    chartData: [],
    gantt: [],
    stakeholders: []
};

// --- AUTH & INIT ---
onAuthStateChanged(auth, async (user) => {
    // Check share link BEFORE showing auth screen
    const isShared = await checkShareLink();
    if (isShared) return;

    currentUser = user;
    if (user) {
        const sidebar = document.getElementById('app-sidebar');
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-display').textContent = user.email;
        loadProjectList();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

// --- NAVIGATION & UI HANDLERS ---
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

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch {
        try { await createUserWithEmailAndPassword(auth, email, pass); } catch (err) { alert(err.message); }
    }
});

document.getElementById('logout-btn').addEventListener('click', () => { signOut(auth); window.location.href = window.location.origin; });

// --- UNDO / REDO ---
window.undo = () => {
    if (historyStack.length === 0 || isReadOnly) return;
    redoStack.push(JSON.stringify(projectData));
    const prevState = historyStack.pop();
    projectData = JSON.parse(prevState);
    renderAll();
    saveData(true); 
    updateUndoRedoButtons();
};

window.redo = () => {
    if (redoStack.length === 0 || isReadOnly) return;
    historyStack.push(JSON.stringify(projectData));
    const nextState = redoStack.pop();
    projectData = JSON.parse(nextState);
    renderAll();
    saveData(true);
    updateUndoRedoButtons();
};

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = historyStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// --- PROJECT MANAGEMENT ---
async function loadProjectList() {
    if(isReadOnly) return;
    window.router('projects');
    document.getElementById('top-bar').classList.add('hidden');
    const listEl = document.getElementById('project-list');
    listEl.innerHTML = '<div class="col-span-3 text-center text-slate-400 py-10 animate-pulse">Loading projects...</div>';
    
    const sidebar = document.getElementById('app-sidebar');
    if(sidebar.classList.contains('hidden')) { sidebar.classList.remove('hidden'); sidebar.classList.add('flex'); }

    if (isDemoMode) {
        currentProjectId = null;
        projectData = null; 
        
        listEl.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-rcem-purple border-y border-r border-slate-200 relative overflow-hidden cursor-pointer hover:shadow-md transition-all group" onclick="window.openDemoProject()">
                 <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide">Gold Standard</div>
                 <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery</h3>
                 <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ED Registrar)</p>
                 <div class="flex gap-2 text-xs font-medium text-slate-500">
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 24 Data Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 3 Cycles</span>
                </div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const snap = await getDocs(collection(db, `users/${currentUser.uid}/projects`));
    listEl.innerHTML = '';
    
    if (snap.empty) {
        listEl.innerHTML = `<div class="col-span-3 text-center border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50">
            <h3 class="font-bold text-slate-600 mb-2">No Projects Yet</h3>
            <button onclick="window.createNewProject()" class="text-rcem-purple font-bold hover:underline flex items-center justify-center gap-2 mx-auto"><i data-lucide="plus-circle" class="w-4 h-4"></i> Create your first QIP</button>
        </div>`;
    }

    snap.forEach(doc => {
        const d = doc.data();
        const date = new Date(d.meta?.created).toLocaleDateString();
        listEl.innerHTML += `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group relative" onclick="window.openProject('${doc.id}')">
                <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors truncate">${escapeHtml(d.meta?.title) || 'Untitled'}</h3>
                <p class="text-xs text-slate-400 mb-4">Created: ${date}</p>
                <div class="flex gap-2 text-xs font-medium text-slate-500">
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200">${d.chartData?.length || 0} Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200">${d.pdsa?.length || 0} Cycles</span>
                </div>
                <button onclick="event.stopPropagation(); window.deleteProject('${doc.id}')" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `;
    });
    lucide.createIcons();
}

window.createNewProject = async () => {
    const title = prompt("Project Title:", "My New QIP");
    if (!title) return;
    let template = JSON.parse(JSON.stringify(emptyProject));
    template.meta.title = title;
    await addDoc(collection(db, `users/${currentUser.uid}/projects`), template);
    loadProjectList();
};

window.deleteProject = async (id) => {
    if (confirm("Are you sure?")) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, id));
        loadProjectList();
    }
};

window.openProject = (id) => {
    currentProjectId = id;
    if (unsubscribeProject) unsubscribeProject();
    
    unsubscribeProject = onSnapshot(doc(db, `users/${currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!projectData) {
                historyStack = [JSON.stringify(data)];
                redoStack = [];
                updateUndoRedoButtons();
            }
            projectData = data;
            // Schema patching
            if(!projectData.checklist) projectData.checklist = {};
            if(!projectData.drivers) projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!projectData.fishbone) projectData.fishbone = emptyProject.fishbone;
            if(!projectData.pdsa) projectData.pdsa = [];
            if(!projectData.chartData) projectData.chartData = [];
            if(!projectData.stakeholders) projectData.stakeholders = [];
            if(!projectData.gantt) projectData.gantt = [];
            
            document.getElementById('project-header-title').textContent = projectData.meta.title;
            if (currentView !== 'full') renderAll();
        }
    });
    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

window.openDemoProject = () => {
    const demoData = JSON.parse(JSON.stringify(emptyProject));
    demoData.meta.title = "Improving Sepsis 6 (DEMO)";
    demoData.checklist = { problem_desc: "Sepsis delays in ED.", aim: "Increase abx <1hr to 90% by July.", evidence: "RCEM Standards.", team: "Dr. Bloggs, Sr. Smith" };
    demoData.chartData = [
        {date:"2024-01-01", value:50, type:'outcome'}, {date:"2024-01-08", value:55, type:'outcome'}, {date:"2024-01-15", value:45, type:'outcome'},
        {date:"2024-01-22", value:60, type:'outcome'}, {date:"2024-01-29", value:65, type:'outcome'}, {date:"2024-02-05", value:70, type:'outcome'},
        {date:"2024-02-12", value:85, type:'outcome', note:"Cycle 1"}, {date:"2024-02-19", value:88, type:'outcome'}, {date:"2024-02-26", value:92, type:'outcome'}
    ];
    demoData.pdsa = [{title:"Cycle 1", plan:"Sepsis Trolley", do:"Implemented in Majors", study:"Time to abx reduced", act:"Adopt", isStepChange: true}];
    demoData.drivers = { primary: ["Recognition", "Equipment"], secondary: ["Training", "Stock"], changes: ["Trolley", "Poster"] };
    
    projectData = demoData;
    currentProjectId = 'DEMO';
    historyStack = [JSON.stringify(projectData)];
    redoStack = [];
    updateUndoRedoButtons();

    document.getElementById('project-header-title').textContent = projectData.meta.title + " (DEMO)";
    document.getElementById('top-bar').classList.remove('hidden');
    renderAll();
    window.router('dashboard');
    
    const s = document.getElementById('save-status');
    s.innerHTML = `<i data-lucide="info" class="w-3 h-3"></i> Demo Loaded`;
    s.classList.remove('opacity-0');
}

window.returnToProjects = () => {
    currentProjectId = null;
    projectData = null;
    isReadOnly = false; // RESET ReadOnly State
    document.getElementById('readonly-indicator').classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    
    if (unsubscribeProject) unsubscribeProject();
    loadProjectList();
};

let currentView = 'dashboard';
window.router = (view) => {
    if (view !== 'projects' && !projectData) { alert("Please select a project."); return; }
    currentView = view;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('fixed')) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    if (view === 'checklist') renderChecklist();
    if (view === 'tools') renderTools();
    if (view === 'stakeholders') renderStakeholders();
    if (view === 'data') renderChart();
    if (view === 'pdsa') renderPDSA();
    if (view === 'gantt') renderGantt();
    if (view === 'full') renderFullProject();
    lucide.createIcons();
};

async function saveData(skipHistory = false) {
    if (isReadOnly) return;
    if (isDemoMode) { 
        if(!skipHistory) {
            historyStack.push(JSON.stringify(projectData));
            if(historyStack.length > MAX_HISTORY) historyStack.shift();
            redoStack = []; 
            updateUndoRedoButtons();
        }
        renderAll(); 
        return; 
    }
    if (!currentProjectId) return;

    if(!skipHistory) {
        historyStack.push(JSON.stringify(projectData));
        if(historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack = []; 
        updateUndoRedoButtons();
    }
    await setDoc(doc(db, `users/${currentUser.uid}/projects`, currentProjectId), projectData, { merge: true });
    const s = document.getElementById('save-status');
    s.classList.remove('opacity-0');
    setTimeout(() => s.classList.add('opacity-0'), 2000);
}

document.getElementById('demo-toggle').addEventListener('change', (e) => {
    isDemoMode = e.target.checked;
    currentProjectId = null; projectData = null;
    const wm = document.getElementById('demo-watermark');
    if (isDemoMode) { wm.classList.remove('hidden'); loadProjectList(); } 
    else { wm.classList.add('hidden'); if (currentUser) loadProjectList(); else document.getElementById('auth-screen').classList.remove('hidden'); }
});

document.getElementById('demo-auth-btn').onclick = () => {
    isDemoMode = true;
    currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.add('flex');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('demo-watermark').classList.remove('hidden');
    document.getElementById('demo-toggle').checked = true;
    loadProjectList();
};

// --- FEATURE: SHARE PROJECT ---
window.shareProject = () => {
    if(isDemoMode) { alert("Cannot share demo projects."); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${currentProjectId}&uid=${currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => alert("Read-only link copied to clipboard!"));
};

// --- FEATURE: CSV IMPORT ---
window.importCSV = (input) => {
    if(isReadOnly) return;
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n');
        let count = 0;
        historyStack.push(JSON.stringify(projectData));
        rows.forEach(row => {
            const cols = row.split(',');
            if (cols.length >= 2) {
                const date = cols[0].trim();
                const value = parseFloat(cols[1].trim());
                if (!isNaN(value) && !isNaN(Date.parse(date))) {
                    projectData.chartData.push({ date: new Date(date).toISOString().split('T')[0], value: value, type: 'outcome' });
                    count++;
                }
            }
        });
        saveData();
        renderChart();
        alert(`Imported ${count} points.`);
    };
    reader.readAsText(file);
    input.value = '';
};

// --- RENDER FUNCTIONS ---
function renderAll() {
    renderCoach();
    if(currentView === 'data') renderChart();
    if(currentView === 'tools') renderTools();
    if(currentView === 'stakeholders') renderStakeholders();
    if(currentView === 'checklist') renderChecklist();
    if(currentView === 'pdsa') renderPDSA();
    if(currentView === 'gantt') renderGantt();
}

function renderCoach() {
    if(!projectData) return;
    const d = projectData;
    const banner = document.getElementById('qi-coach-banner');
    
    let filledCount = 0;
    const checkFields = ['problem_desc','evidence','aim','outcome_measures','process_measures','team','ethics','learning'];
    if (d.checklist) {
        checkFields.forEach(f => {
            if(d.checklist[f] && d.checklist[f].length > 5) filledCount++;
        });
    }
    const progress = Math.round((filledCount / checkFields.length) * 100);
    const progEl = document.getElementById('stat-progress');
    if(progEl) progEl.textContent = `${progress}%`;

    let status = { t: "", m: "", b: "", c: "" };
    const aimQuality = checkAimQuality(d.checklist.aim);
    const badgeEl = document.getElementById('aim-quality-badge');
    if(badgeEl) {
        badgeEl.innerHTML = aimQuality.valid 
        ? `<span class="text-emerald-600 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Strong Aim</span>` 
        : `<span class="text-amber-600 font-bold flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> Weak Aim: ${aimQuality.msg}</span>`;
    }

    if (!d.checklist.aim) {
        status = { 
            t: "Step 1: Define your Aim", 
            m: "Every QIP needs a clear aim. Use the SMART wizard.", 
            b: "Start Wizard", 
            a: () => { window.router('checklist'); document.getElementById('smart-modal').classList.remove('hidden'); }, 
            c: "from-rcem-purple to-indigo-700" 
        };
    } else {
        status = { 
            t: "Project Active: Measuring", 
            m: "Keep adding data points. Look for 6 points in a row above/below median.", 
            b: "Enter Data", 
            a: () => window.router('data'), 
            c: "from-teal-600 to-emerald-700" 
        };
    }

    banner.className = `bg-gradient-to-r ${status.c} rounded-xl p-8 text-white shadow-lg relative overflow-hidden transition-all duration-500`;
    banner.innerHTML = `
        <div class="absolute right-0 top-0 opacity-10 p-4"><i data-lucide="compass" class="w-48 h-48"></i></div>
        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <span class="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-white/20 flex items-center gap-2"><i data-lucide="sparkles" class="w-3 h-3"></i> QI Coach</span>
                </div>
                <h3 class="font-bold text-2xl mb-2 font-serif tracking-tight">${status.t}</h3>
                <p class="text-white/90 text-base max-w-2xl leading-relaxed font-light">${status.m}</p>
            </div>
            <button id="coach-action-btn" class="bg-white text-slate-900 px-6 py-3 rounded-lg text-sm font-bold shadow-lg hover:bg-slate-50 transition-all whitespace-nowrap flex items-center gap-2 group transform hover:translate-y-[-2px]">${status.b} <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i></button>
        </div>
    `;
    document.getElementById('coach-action-btn').onclick = status.a;
    
    document.getElementById('stat-pdsa').textContent = d.pdsa.length;
    document.getElementById('stat-data').textContent = d.chartData.length;
    document.getElementById('stat-drivers').textContent = d.drivers.changes.length;
    document.getElementById('dash-aim-display').textContent = d.checklist.aim || "No aim defined yet.";
    lucide.createIcons();
}

function checkAimQuality(aim) {
    if (!aim) return { valid: false, msg: "No aim found" };
    const lower = aim.toLowerCase();
    if (!lower.includes('by') && !/\d{2,4}/.test(aim)) return { valid: false, msg: "No date" };
    return { valid: true };
}

function renderChecklist() {
    if(!projectData) return;
    const list = document.getElementById('checklist-container');
    const sections = [
        { id: "def", title: "Problem & Evidence", fields: [
            {k:"problem_desc", l:"Reason for Project (Problem)", p:"What is the gap?"},
            {k:"evidence", l:"Evidence / Standards", p:"RCEM Guidelines..."}
        ]},
        { id: "meas", title: "Aim & Measures", fields: [
            {k:"aim", l:"SMART Aim", p:"Use the wizard...", w:true},
            {k:"outcome_measures", l:"Outcome Measure", p:"The main result"},
            {k:"process_measures", l:"Process Measures", p:"Are staff doing steps?"},
            {k:"balance_measures", l:"Balancing Measures", p:"Safety checks"}
        ]},
        { id: "team", title: "Team & Ethics", fields: [
            {k:"lead", l:"Project Lead", p:"Name"},
            {k:"team", l:"Team Members", p:"Names"},
            {k:"ethics", l:"Ethical / Governance", p:"Ref Number"},
            {k:"ppi", l:"Patient Public Involvement", p:"Feedback"}
        ]},
        { id: "conc", title: "Conclusions", fields: [
            {k:"learning", l:"Key Learning / Analysis", p:"What worked?"},
            {k:"sustain", l:"Sustainability Plan", p:"How will it stick?"}
        ]}
    ];

    list.innerHTML = sections.map(s => `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-slate-50 px-6 py-3 font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                <span>${s.title}</span>
                ${s.id === 'meas' ? '<span class="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">Gold Standard</span>' : ''}
            </div>
            <div class="p-6 space-y-4">
                ${s.fields.map(f => `
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between items-center">
                            ${f.l} ${f.w ? '<button onclick="document.getElementById(\'smart-modal\').classList.remove(\'hidden\')" class="text-rcem-purple hover:underline text-[10px] ml-2 flex items-center gap-1"><i data-lucide="wand-2" class="w-3 h-3"></i> Open Wizard</button>' : ''}
                        </label>
                        <textarea ${isReadOnly ? 'disabled' : ''} onchange="projectData.checklist['${f.k}']=this.value;saveData()" class="w-full rounded border-slate-300 p-2 text-sm focus:ring-2 focus:ring-rcem-purple outline-none transition-shadow" rows="2" placeholder="${f.p}">${escapeHtml(projectData.checklist[f.k])||''}</textarea>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
    
    window.saveSmartAim = () => {
        if(isReadOnly) return;
        const v = document.getElementById('sa-verb').value;
        const m = document.getElementById('sa-metric').value;
        const p = document.getElementById('sa-pop').value;
        const b = document.getElementById('sa-base').value;
        const t = document.getElementById('sa-target').value;
        const d = document.getElementById('sa-date').value;
        projectData.checklist.aim = `To ${v} the ${m} for ${p} from ${b} to ${t} by ${d}.`;
        saveData();
        document.getElementById('smart-modal').classList.add('hidden');
        renderChecklist();
        renderCoach();
    };
}

window.setToolMode = (m) => {
    toolMode = m;
    zoomLevel = 2.0; 
    document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-rcem-purple'));
    document.getElementById(`tab-${m}`).classList.add('bg-white', 'shadow-sm', 'text-rcem-purple');
    renderTools();
};

window.zoomIn = () => { zoomLevel += 0.2; updateZoom(); };
window.zoomOut = () => { zoomLevel = Math.max(0.5, zoomLevel - 0.2); updateZoom(); };
window.resetZoom = () => { zoomLevel = 2.0; updateZoom(); };

function updateZoom() {
    const el = document.getElementById('diagram-canvas');
    if(el) el.style.transform = `scale(${zoomLevel})`;
}

async function renderTools() {
    const toolInfo = {
        fishbone: { title: "Fishbone", desc: "Root Cause Analysis", how: "Ask 'Why?' 5 times." },
        driver: { title: "Driver Diagram", desc: "Theory of Change", how: "Primary -> Secondary -> Changes" },
        process: { title: "Process Map", desc: "Workflow", how: "Map patient journey." }
    };
    
    document.getElementById('tool-explainer').innerHTML = `
        <h2 class="text-xl font-bold text-indigo-900 mb-1 flex items-center gap-2"><i data-lucide="info" class="w-5 h-5"></i> ${toolInfo[toolMode].title}</h2>
        <p class="text-indigo-800 mb-3 text-sm">${toolInfo[toolMode].desc} - ${toolInfo[toolMode].how}</p>
    `;
    
    if(!projectData) return;
    const canvas = document.getElementById('diagram-canvas');
    const controls = document.getElementById('tool-controls');
    const ghost = document.getElementById('diagram-ghost');
    
    let mCode = '';
    let ctrls = '';
    
    if (toolMode === 'fishbone') {
        const cats = projectData.fishbone.categories;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        mCode = `mindmap\n  root(("${clean(projectData.meta.title || 'Problem')}"))\n` + 
            cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
        
        ctrls = cats.map(c => `<button ${isReadOnly?'disabled':''} onclick="window.addCauseWithWhys(${c.id})" class="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> ${c.text}</button>`).join('');
        if (cats.every(c => c.causes.length === 0)) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'driver') {
        const d = projectData.drivers;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
        ctrls = `<button ${isReadOnly?'disabled':''} onclick="window.addDriver('primary')" class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded">Add Primary</button> <button ${isReadOnly?'disabled':''} onclick="window.addDriver('secondary')" class="px-4 py-2 bg-blue-100 text-blue-800 rounded">Add Secondary</button> <button ${isReadOnly?'disabled':''} onclick="window.addDriver('changes')" class="px-4 py-2 bg-purple-100 text-purple-800 rounded">Add Change Idea</button>`;
        if (d.primary.length === 0) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'process') {
         const p = projectData.process;
         const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
         mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
         ctrls = `<button ${isReadOnly?'disabled':''} onclick="window.addStep()" class="px-4 py-2 bg-white border border-slate-300 rounded">Add Step</button> <button ${isReadOnly?'disabled':''} onclick="window.resetProcess()" class="px-4 py-2 text-red-500">Reset</button>`;
         ghost.classList.add('hidden');
    }

    canvas.innerHTML = `<div class="mermaid">${mCode}</div>`;
    controls.innerHTML = ctrls;
    updateZoom(); 
    try { await mermaid.run(); } catch(e) { console.error("Mermaid error:", e); }
    lucide.createIcons();
}

window.addCauseWithWhys = (id) => {
    if(isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    if (confirm(`Do you want to drill down into "${cause}" using the 5 Whys technique?`)) {
        let root = cause;
        for (let i = 1; i <= 3; i++) {
            let deeper = prompt(`Why does "${root}" happen?`);
            if (!deeper) break;
            root = deeper;
        }
        if (root !== cause && confirm(`Root cause found: "${root}". Add this instead?`)) cause = root;
    }
    projectData.fishbone.categories.find(c=>c.id===id).causes.push(cause);
    saveData(); renderTools();
};
window.addDriver = (t) => { if(isReadOnly) return; const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} }
window.addStep = () => { if(isReadOnly) return; const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} }
window.resetProcess = () => { if(isReadOnly) return; if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} }

const stakeholderScripts = {
    highPowerLowInterest: { t: "Keep Satisfied", s: "Focus on Risk: 'We need your support to ensure this doesn't impact flow/safety. It won't require much of your time, but your sign-off is crucial.'" },
    highPowerHighInterest: { t: "Manage Closely", s: "Partnership: 'You are key to this success. Can we meet weekly? I want to build this around your vision for the department.'" },
    lowPowerHighInterest:  { t: "Keep Informed", s: "Empowerment: 'I know you care about this. Can you be our champion on the shop floor? We need your eyes and ears.'" },
    lowPowerLowInterest:   { t: "Monitor", s: "Minimal Effort: 'Just an FYI, we are tweaking this process. No action needed from you right now.'" }
};

function renderStakeholders() {
    if (!projectData) return;
    const container = document.getElementById('stakeholder-canvas');
    container.innerHTML = '';
    projectData.stakeholders.forEach((s, index) => {
        const el = document.createElement('div');
        el.className = 'absolute transform -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-slate-600 rounded-full px-3 py-1 text-xs font-bold shadow-lg cursor-grab z-30 flex items-center gap-1';
        el.style.bottom = `${s.power}%`;
        el.style.left = `${s.interest}%`;
        el.innerHTML = `<span class="whitespace-nowrap">${escapeHtml(s.name)}</span>`;
        el.onclick = () => {
            let type = "";
            if (s.power > 50 && s.interest > 50) type = "highPowerHighInterest";
            else if (s.power > 50) type = "highPowerLowInterest";
            else if (s.interest > 50) type = "lowPowerHighInterest";
            else type = "lowPowerLowInterest";
            const script = stakeholderScripts[type];
            document.getElementById('script-type').innerText = `${s.name} (${script.t})`;
            document.getElementById('script-content').innerText = script.s;
            document.getElementById('stakeholder-script').classList.remove('translate-y-full');
        };
        if(!isReadOnly) el.onmousedown = (e) => dragStakeholder(e, index);
        container.appendChild(el);
    });
}

function dragStakeholder(e, index) {
    e.preventDefault();
    const container = document.getElementById('stakeholder-canvas');
    const rect = container.getBoundingClientRect();
    function onMouseMove(moveEvent) {
        let x = moveEvent.clientX - rect.left;
        let y = rect.bottom - moveEvent.clientY; 
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));
        projectData.stakeholders[index].interest = (x / rect.width) * 100;
        projectData.stakeholders[index].power = (y / rect.height) * 100;
        renderStakeholders();
    }
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveData();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}
window.addStakeholder = () => {
    if(isReadOnly) return;
    const name = prompt("Stakeholder Name:");
    if(!name) return;
    if(!projectData.stakeholders) projectData.stakeholders = [];
    projectData.stakeholders.push({ name: name, power: 50, interest: 50 });
    saveData(); renderStakeholders();
};

function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (data.length === 0) { document.getElementById('chart-ghost').classList.remove('hidden'); if(chartInstance) chartInstance.destroy(); return; }
    document.getElementById('chart-ghost').classList.add('hidden');

    const values = data.map(d => Number(d.value));
    const labels = data.map(d => d.date);
    
    // Standard Median (First 12 points)
    let baselinePoints = values.slice(0, 12); 
    let currentMedian = baselinePoints.length ? baselinePoints.sort((a,b)=>a-b)[Math.floor(baselinePoints.length/2)] : 0;
    
    const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83')); // Simple color logic

    if (chartInstance) chartInstance.destroy();
    
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 }
    };
    
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 6, tension: 0.1 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { annotation: { annotations } },
            onClick: (e, activeEls) => {
                if (isReadOnly || activeEls.length === 0) return;
                const i = activeEls[0].index;
                const note = prompt(`Annotate point:`, data[i].note || "");
                if (note !== null) { data[i].note = note; saveData(); renderChart(); }
            }
        }
    });
    
    // Render History List
    document.getElementById('data-history').innerHTML = data.slice().reverse().map((d, i) => `
        <div class="flex justify-between border-b border-slate-100 py-2 items-center group">
            <span><span class="font-mono text-xs text-slate-400 mr-2">${d.date}</span> <strong>${d.value}</strong>${d.note ? `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">${escapeHtml(d.note)}</span>` : ''}</span>
            ${!isReadOnly ? `<button onclick="window.deleteDataPoint(${data.length - 1 - i})" class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
        </div>`).join('');
    lucide.createIcons();
}

window.deleteDataPoint = (index) => {
    if (isReadOnly) return;
    if (confirm("Delete?")) {
        projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
        projectData.chartData.splice(index, 1);
        saveData();
        renderChart();
    }
};

window.addDataPoint = () => {
    if (isReadOnly) return;
    const d = { date: document.getElementById('chart-date').value, value: document.getElementById('chart-value').value, type: document.getElementById('chart-cat').value };
    if (d.date && d.value) { projectData.chartData.push(d); saveData(); renderChart(); }
};

window.addPDSA = () => { 
    if (isReadOnly) return;
    const t = prompt("Cycle Title:"); 
    if(t) { projectData.pdsa.unshift({id: Date.now(), title:t, plan:"", do:"", study:"", act:"", isStepChange: false}); saveData(); renderPDSA(); } 
};

function renderPDSA() {
    if(!projectData) return;
    const container = document.getElementById('pdsa-container');
    container.innerHTML = projectData.pdsa.map((p,i) => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-4">
                <div class="font-bold text-lg text-slate-800">${escapeHtml(p.title)}</div>
                ${!isReadOnly ? `<button onclick="window.deletePDSA(${i})" class="text-slate-400 hover:text-red-500"><i data-lucide="trash-2"></i></button>` : ''}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-3 rounded"><div class="text-xs font-bold text-blue-800 uppercase">Plan</div><textarea ${isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].plan=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.plan)}</textarea></div>
                <div class="bg-orange-50 p-3 rounded"><div class="text-xs font-bold text-orange-800 uppercase">Do</div><textarea ${isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].do=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.do)}</textarea></div>
                <div class="bg-purple-50 p-3 rounded"><div class="text-xs font-bold text-purple-800 uppercase">Study</div><textarea ${isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].study=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.study)}</textarea></div>
                <div class="bg-emerald-50 p-3 rounded"><div class="text-xs font-bold text-emerald-800 uppercase">Act</div><textarea ${isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].act=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.act)}</textarea></div>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                <input type="checkbox" ${p.isStepChange ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].isStepChange=this.checked;saveData()" id="step-${i}">
                <label for="step-${i}" class="text-xs text-slate-500 font-bold">Mark as Step Change (Re-baseline Chart)</label>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.deletePDSA = (i) => { if(isReadOnly) return; if(confirm("Delete?")) { projectData.pdsa.splice(i,1); saveData(); renderPDSA(); } };

window.saveResults = (val) => { if(isReadOnly) return; if(!projectData.checklist) projectData.checklist={}; projectData.checklist.results_text = val; saveData(); };
window.showHelp = (key) => { document.getElementById('help-title').textContent = helpData[key].t; document.getElementById('help-content').innerHTML = helpData[key].c; document.getElementById('help-modal').classList.remove('hidden'); };
window.openHelp = () => window.showHelp('checklist');

window.calcGreen = () => {
    const v = document.getElementById('green-type').value;
    const q = document.getElementById('green-qty').value;
    document.getElementById('green-res').innerHTML = `<span class="text-2xl text-emerald-600">${(v*q).toFixed(2)} kg</span> CO2e`;
    document.getElementById('green-res').classList.remove('hidden');
}
window.calcMoney = () => {
    const unit = parseFloat(document.getElementById('money-unit').value) || 0;
    const qty = parseFloat(document.getElementById('money-qty').value) || 0;
    document.getElementById('money-res').innerHTML = `<span class="text-2xl text-emerald-600">£${(unit * qty).toFixed(2)}</span> total saved`;
    document.getElementById('money-res').classList.remove('hidden');
}
window.calcTime = () => {
    const unit = parseFloat(document.getElementById('time-unit').value) || 0;
    const qty = parseFloat(document.getElementById('time-qty').value) || 0;
    const total = unit * qty;
    document.getElementById('time-res').innerHTML = `<span class="text-2xl text-blue-600">${Math.floor(total/60)}h ${total%60}m</span> total saved`;
    document.getElementById('time-res').classList.remove('hidden');
}
window.calcEdu = () => {
    const pre = parseFloat(document.getElementById('edu-pre').value) || 0;
    const post = parseFloat(document.getElementById('edu-post').value) || 0;
    const n = parseFloat(document.getElementById('edu-n').value) || 1;
    document.getElementById('edu-res').innerHTML = `Confidence improved by <span class="text-2xl text-indigo-600">${(((post - pre) / pre) * 100).toFixed(0)}%</span> across ${n} staff members.`;
    document.getElementById('edu-res').classList.remove('hidden');
}

window.startTour = () => {
    const driver = window.driver.js.driver;
    const tour = driver({ showProgress: true, steps: [{ element: '#nav-checklist', popover: { title: 'Step 1: Define', description: 'Start here.' } }, { element: '#nav-tools', popover: { title: 'Step 2: Diagnose', description: 'Use Fishbone & Drivers.' } }, { element: '#nav-data', popover: { title: 'Step 3: Measure', description: 'Enter data here.' } }, { element: '#nav-pdsa', popover: { title: 'Step 4: Act', description: 'Record changes.' } }] });
    tour.drive();
};

window.openPortfolioExport = () => {
    const d = projectData;
    const modal = document.getElementById('risr-modal');
    modal.classList.remove('hidden');
    const fields = [
        { t: "Title", v: d.meta.title },
        { t: "Reason", v: d.checklist.problem_desc },
        { t: "Evidence", v: d.checklist.evidence },
        { t: "Aim", v: d.checklist.aim },
        { t: "Team", v: d.checklist.team },
        { t: "Drivers", v: `Primary: ${d.drivers.primary.join(', ')}\nChanges: ${d.drivers.changes.join(', ')}` },
        { t: "Measures", v: `Outcome: ${d.checklist.outcome_measures}\nProcess: ${d.checklist.process_measures}` },
        { t: "PDSA", v: d.pdsa.map(p => `[${p.title}] Study: ${p.study} Act: ${p.act}`).join('\n\n') },
        { t: "Analysis", v: d.checklist.results_text },
        { t: "Learning", v: d.checklist.learning + "\n\nSustainability: " + d.checklist.sustain },
        { t: "Ethics", v: d.checklist.ethics }
    ];
    document.getElementById('risr-content').innerHTML = fields.map(f => `<div class="bg-white p-4 rounded border border-slate-200 shadow-sm"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide">${f.t}</h4><button class="text-xs text-rcem-purple font-bold hover:underline" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copy</button></div><div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap font-mono text-slate-600 select-all border border-slate-100">${escapeHtml(f.v) || 'Not recorded'}</div></div>`).join('');
};

window.addGanttTask = () => {
    const n = prompt("Task Name:");
    if(!n) return;
    const s = prompt("Start Date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    const e = prompt("End Date:", s);
    if(!projectData.gantt) projectData.gantt=[];
    projectData.gantt.push({id:Date.now(), name:n, start: s, end: e, type:'plan'}); 
    saveData(); renderGantt(); 
}
window.deleteGantt = (id) => { projectData.gantt = projectData.gantt.filter(x=>x.id!=id); saveData(); renderGantt(); }

function renderGantt() {
    if(!projectData) return;
    const g = projectData.gantt || [];
    const container = document.getElementById('gantt-container');
    
    if (g.length === 0) {
        container.innerHTML = `<div class="text-center py-12"><button onclick="window.addGanttTask()" class="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold">Add First Task</button></div>`;
        return;
    }

    const dates = g.flatMap(t => [new Date(t.start), new Date(t.end)]);
    const minDate = new Date(Math.min(...dates)); minDate.setDate(1); 
    const maxDate = new Date(Math.max(...dates)); maxDate.setMonth(maxDate.getMonth() + 1); maxDate.setDate(0); 

    const monthDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth()) + 1;
    const pxPerMonth = 150;
    const totalWidth = 250 + (monthDiff * pxPerMonth);

    let html = `<div class="relative bg-white min-h-[400px] border border-slate-200 rounded-lg overflow-hidden" style="width: ${totalWidth}px;">`;

    html += `<div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">`;
    html += `<div class="w-[250px] shrink-0 p-3 font-bold text-slate-700 text-sm border-r border-slate-200 bg-slate-50 sticky left-0 z-30 shadow-sm">Phase / Task</div>`;
    
    for (let i = 0; i < monthDiff; i++) {
        const d = new Date(minDate.getFullYear(), minDate.getMonth() + i, 1);
        html += `<div class="shrink-0 border-r border-slate-200 p-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" style="width:${pxPerMonth}px">${d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</div>`;
    }
    html += `</div>`;

    g.forEach(t => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        
        const startMonthIndex = (start.getFullYear() - minDate.getFullYear()) * 12 + (start.getMonth() - minDate.getMonth());
        const startDayFactor = (start.getDate() / 30); 
        const leftPos = (startMonthIndex + startDayFactor) * pxPerMonth;
        
        const durationMs = end - start;
        const width = Math.max(20, (durationMs / (1000 * 60 * 60 * 24 * 30)) * pxPerMonth);

        let colorClass = "bg-slate-600";
        if(t.type === 'plan') colorClass = "bg-slate-400";
        if(t.type === 'study') colorClass = "bg-blue-500";
        if(t.type === 'act') colorClass = "bg-rcem-purple";

        html += `
            <div class="flex border-b border-slate-100 hover:bg-slate-50 transition-colors h-12 relative group">
                <div class="w-[250px] shrink-0 p-3 text-sm font-medium text-slate-700 border-r border-slate-200 bg-white sticky left-0 z-10 truncate flex items-center justify-between">
                    ${escapeHtml(t.name)}
                    <button onclick="deleteGantt('${t.id}')" class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
                <div class="absolute h-6 top-3 rounded-md shadow-sm text-[10px] text-white flex items-center px-2 whitespace-nowrap overflow-hidden ${colorClass}" 
                     style="left: ${250 + leftPos}px; width: ${width}px;">
                     ${Math.round((end - start)/(1000*60*60*24))}d
                </div>
                ${Array(monthDiff).fill(0).map((_, i) => 
                    `<div class="absolute top-0 bottom-0 border-r border-slate-100 border-dashed pointer-events-none" style="left: ${250 + ((i+1) * pxPerMonth)}px"></div>`
                ).join('')}
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
    lucide.createIcons();
}

// --- ASSET GENERATOR (FIXED for PowerPoint & Poster) ---
async function getVisualAsset(type) {
    if (!projectData) return null;

    // Create invisible container in DOM to ensure rendering
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 3000));

    const generator = (async () => {
        if (type === 'chart') {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1600; 
                canvas.height = 800;
                container.appendChild(canvas);
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
                if(data.length === 0) return null;

                const outcomes = data.filter(d => d.type === 'outcome' || !d.type);
                const values = outcomes.map(d => Number(d.value));
                const labels = outcomes.map(d => d.date);
                
                let baselinePoints = values.slice(0, 12); 
                let currentMedian = baselinePoints.length ? baselinePoints.sort((a,b)=>a-b)[Math.floor(baselinePoints.length/2)] : 0;
                
                const pointColors = [];
                let runCount = 0; let runDirection = 0;
                values.forEach((v) => {
                    if (v > currentMedian) {
                        if (runDirection === 1) runCount++; else { runCount = 1; runDirection = 1; }
                    } else if (v < currentMedian) {
                        if (runDirection === -1) runCount++; else { runCount = 1; runDirection = -1; }
                    } else runCount = 0;
                    pointColors.push(runCount >= 6 ? '#059669' : '#2d2e83');
                });

                const annotations = {
                    median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 }
                };

                await new Promise(resolve => {
                    new Chart(ctx, {
                        type: 'line',
                        data: { labels: labels, datasets: [{ label: 'Outcome Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 8, tension: 0.1, borderWidth: 3 }] },
                        options: { 
                            animation: false,
                            responsive: false, 
                            plugins: { annotation: { annotations }, legend: { display: false } },
                            scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
                        }
                    });
                    setTimeout(resolve, 100);
                });
                return canvas.toDataURL('image/png', 1.0);
            } catch (e) { console.error("Chart gen error", e); return null; }
        }

        if (type === 'driver' || type === 'fishbone') {
            try {
                const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
                let mCode = "";
                
                if (type === 'driver') {
                    const d = projectData.drivers;
                    if(!d || (!d.primary.length && !d.secondary.length)) return null;
                    mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
                    if(d.primary.length === 0) mCode += ` P --> P1[No Drivers Yet]`;
                    d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
                    d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
                    d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
                } else if (type === 'fishbone') {
                    const cats = projectData.fishbone.categories;
                    if (cats.every(c => c.causes.length === 0)) return null;
                    mCode = `mindmap\n  root(("${clean(projectData.meta.title || 'Problem')}"))\n` + 
                        cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
                }

                const tempId = 'temp-mermaid-' + Date.now();
                const { svg: svgString } = await mermaid.render(tempId, mCode);
                const el = document.createElement('div');
                el.innerHTML = svgString;
                container.appendChild(el);
                
                const svg = el.querySelector('svg');
                const viewBox = svg.getAttribute('viewBox').split(' ');
                const width = parseFloat(viewBox[2]) * 2;
                const height = parseFloat(viewBox[3]) * 2;
                svg.setAttribute('width', width);
                svg.setAttribute('height', height);
                
                const svgData = new XMLSerializer().serializeToString(svg);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                
                const img = new Image();
                const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
                const url = URL.createObjectURL(svgBlob);
                
                return new Promise(resolve => {
                    img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/png')); };
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
            } catch (e) { console.error("Diagram gen error", e); return null; }
        }
        return null;
    })();

    const result = await Promise.race([generator, timeout]);
    document.body.removeChild(container);
    return result;
}

// --- FEATURE 1: EXPORT PPTX ---
window.exportPPTX = async () => {
    if (!projectData) { alert("Please load a project first."); return; }
    
    const btnText = document.querySelector("#view-dashboard button i[data-lucide='presentation']").parentElement.nextElementSibling;
    const originalText = btnText.textContent;
    btnText.textContent = "Generating...";
    
    try {
        const d = projectData;
        const pres = new PptxGenJS();
        
        const driverImg = await getVisualAsset('driver');
        const chartImg = await getVisualAsset('chart');

        const RCEM_NAVY = '2d2e83';
        const RCEM_ORANGE = 'f36f21';

        pres.defineSlideMaster({
            title: 'RCEM_MASTER',
            background: { color: 'FFFFFF' },
            objects: [
                { rect: { x: 0, y: 0, w: '100%', h: 0.15, fill: RCEM_NAVY } },
                { rect: { x: 0, y: 5.4, w: '100%', h: 0.225, fill: RCEM_NAVY } },
                { text: { text: `RCEM QIP Assistant | ${d.meta.title}`, options: { x: 0.2, y: 5.45, w: 6, fontSize: 10, color: 'FFFFFF' } } },
                { text: { text: { type: 'number' }, options: { x: 9.0, y: 5.45, w: 0.5, fontSize: 10, color: 'FFFFFF', align: 'right' } } }
            ]
        });

        const addSlide = (title) => {
            const slide = pres.addSlide({ masterName: 'RCEM_MASTER' });
            slide.addText(title, { x: 0.5, y: 0.4, w: 9, fontSize: 24, fontFace: 'Arial', bold: true, color: RCEM_NAVY, border: { pt: 0, color: 'FFFFFF', bottom: { pt: 2, color: RCEM_ORANGE } } });
            return slide;
        };

        const s1 = pres.addSlide({ masterName: 'RCEM_MASTER' });
        s1.addText(d.meta.title || "Untitled Project", { x: 1, y: 2, w: 8, fontSize: 36, bold: true, color: RCEM_NAVY, align: 'center' });
        s1.addText((d.checklist && d.checklist.team) || "QIP Team", { x: 1, y: 3.5, w: 8, fontSize: 18, color: '64748b', align: 'center' });

        const s2 = addSlide('The Problem & Aim');
        s2.addText('Problem Definition', { x: 0.5, y: 1.2, fontSize: 14, bold: true, color: '475569' });
        s2.addText(d.checklist.problem_desc || "No problem defined.", { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 14, color: '334155', fill: 'F8FAFC' });
        s2.addText('SMART Aim', { x: 0.5, y: 3.0, fontSize: 14, bold: true, color: '475569' });
        s2.addText(d.checklist.aim || "No aim defined.", { x: 0.5, y: 3.3, w: 9, h: 1, fontSize: 16, color: RCEM_NAVY, italic: true, fill: 'EFF6FF', border: { color: 'BFDBFE' } });

        const s3 = addSlide('Driver Diagram (Strategy)');
        if (driverImg) s3.addImage({ data: driverImg, x: 0.5, y: 1.2, w: 9, h: 3.8, sizing: { type: 'contain' } });
        else s3.addText("[Driver Diagram Not Available]", { x: 3, y: 2.5, color: '94a3b8' });

        const s4 = addSlide('PDSA Cycles & Interventions');
        const rows = [['Cycle', 'Plan / Intervention', 'Outcome / Act']];
        d.pdsa.forEach(p => { rows.push([p.title, p.plan, `Study: ${p.study}\nAct: ${p.act}`]); });
        if (rows.length > 1) s4.addTable(rows, { x: 0.5, y: 1.2, w: 9, colW: [2, 3.5, 3.5], border: { pt: 1, color: 'e2e8f0' }, fill: { color: 'F1F5F9' }, headerStyles: { fill: RCEM_NAVY, color: 'FFFFFF', bold: true }, fontSize: 10 });
        else s4.addText("No PDSA cycles recorded.", { x: 0.5, y: 1.2, color: '64748b' });

        const s5 = addSlide('Results & Analysis');
        if (chartImg) s5.addImage({ data: chartImg, x: 0.5, y: 1.2, w: 5.5, h: 3.5, sizing: { type: 'contain' } });
        else s5.addText("No data chart available.", { x: 0.5, y: 2, w: 5, align: 'center', color: '94a3b8' });
        s5.addText("Interpretation:", { x: 6.2, y: 1.2, fontSize: 12, bold: true });
        s5.addText(d.checklist.results_text || "No analysis recorded.", { x: 6.2, y: 1.5, w: 3.3, h: 3.2, fontSize: 11, color: '334155', valign: 'top', fill: 'F8FAFC', border: { color: 'E2E8F0' } });

        const s6 = addSlide('Learning & Sustainability');
        s6.addText('Key Learning Points', { x: 0.5, y: 1.2, fontSize: 14, bold: true, color: '15803d' }); 
        s6.addText(d.checklist.learning || "Not recorded.", { x: 0.5, y: 1.5, w: 4.2, h: 3, fontSize: 12, fill: 'F0FDF4' });
        s6.addText('Sustainability Plan', { x: 5.0, y: 1.2, fontSize: 14, bold: true, color: '1e40af' }); 
        s6.addText(d.checklist.sustain || "Not recorded.", { x: 5.0, y: 1.5, w: 4.5, h: 3, fontSize: 12, fill: 'EFF6FF' });

        await pres.writeFile({ fileName: `RCEM_QIP_${d.meta.title.replace(/[^a-z0-9]/gi, '_')}.pptx` });
    } catch (e) { console.error(e); alert("Error generating PowerPoint: " + e.message); } 
    finally { btnText.textContent = originalText; }
};

// --- FEATURE 2: PDF POSTER EXPORT ---
window.printPoster = async () => {
    if (!projectData) { alert("Please load a project first."); return; }
    
    const btn = document.querySelector("#view-dashboard button i[data-lucide='file-down']").parentElement.nextElementSibling;
    const originalText = btn.innerText;
    btn.innerText = "Generating PDF...";

    try {
        const d = projectData;
        const driverImg = await getVisualAsset('driver');
        const chartImg = await getVisualAsset('chart');

        const posterHTML = `
            <div style="font-family: 'Inter', sans-serif; padding: 20px; background: white; width: 1200px;">
                <div style="background: #2d2e83; color: white; padding: 30px; border-radius: 15px; display: flex; gap: 30px; align-items: center; border-bottom: 8px solid #f36f21; margin-bottom: 30px;">
                    <div style="background: white; padding: 15px; border-radius: 10px; height: 100px; width: 100px; display: flex; align-items: center; justify-content: center;">
                        <img src="https://iili.io/KGQOvkl.md.png" style="max-height: 80px; width: auto;">
                    </div>
                    <div>
                        <h1 style="font-size: 48px; font-weight: 800; margin: 0; line-height: 1.1;">${d.meta.title}</h1>
                        <p style="font-size: 24px; opacity: 0.9; margin: 10px 0 0;"><strong>Team:</strong> ${d.checklist.team || 'Unspecified'}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 25% 45% 25%; gap: 25px;">
                    <div style="display: flex; flex-direction: column; gap: 25px;">
                        <div style="border: 2px solid #cbd5e1; padding: 25px; border-radius: 15px; background: white;">
                            <h2 style="color: #2d2e83; border-bottom: 3px solid #f36f21; font-size: 24px; font-weight: 800; margin-top: 0; text-transform: uppercase;">The Problem</h2>
                            <p style="font-size: 14px; line-height: 1.5; color: #334155;">${d.checklist.problem_desc || 'No problem defined.'}</p>
                        </div>
                        <div style="border: 2px solid #3b82f6; padding: 25px; border-radius: 15px; background: #eff6ff;">
                            <h2 style="color: #1e3a8a; border-bottom: 3px solid #60a5fa; font-size: 24px; font-weight: 800; margin-top: 0;">SMART Aim</h2>
                            <p style="font-size: 18px; font-weight: bold; font-style: italic; color: #1e40af;">${d.checklist.aim || 'No aim defined.'}</p>
                        </div>
                        <div style="border: 2px solid #cbd5e1; padding: 25px; border-radius: 15px; background: white;">
                            <h2 style="color: #2d2e83; border-bottom: 3px solid #f36f21; font-size: 24px; font-weight: 800; margin-top: 0; text-transform: uppercase;">Driver Diagram</h2>
                            ${driverImg ? `<img src="${driverImg}" style="width: 100%; border-radius: 8px;">` : '<p style="color: #94a3b8; font-style: italic;">No drivers defined.</p>'}
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 25px;">
                        <div style="border: 2px solid #cbd5e1; padding: 25px; border-radius: 15px; background: white; height: 100%;">
                            <h2 style="color: #2d2e83; border-bottom: 3px solid #f36f21; font-size: 24px; font-weight: 800; margin-top: 0; text-transform: uppercase;">Results & Data</h2>
                            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin-bottom: 20px; display: flex; justify-content: center;">
                                ${chartImg ? `<img src="${chartImg}" style="max-width: 100%; height: auto;">` : '<p style="padding: 40px; color: #94a3b8;">No data available.</p>'}
                            </div>
                            <div style="background: #f8fafc; padding: 20px; border-left: 6px solid #2d2e83; border-radius: 4px;">
                                <h3 style="color: #2d2e83; font-weight: bold; margin-top: 0;">Analysis</h3>
                                <p style="font-size: 14px; color: #334155; white-space: pre-wrap;">${d.checklist.results_text || 'No analysis provided.'}</p>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 25px;">
                        <div style="border: 2px solid #cbd5e1; padding: 25px; border-radius: 15px; background: white;">
                            <h2 style="color: #2d2e83; border-bottom: 3px solid #f36f21; font-size: 24px; font-weight: 800; margin-top: 0; text-transform: uppercase;">Interventions</h2>
                            <ul style="list-style: none; padding: 0;">
                                ${d.pdsa.map(p => `
                                    <li style="margin-bottom: 15px; padding-left: 15px; border-left: 4px solid #94a3b8;">
                                        <strong style="display: block; color: #1e293b;">${p.title}</strong>
                                        <span style="font-size: 13px; color: #64748b;">${p.do}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div style="border: 2px solid #cbd5e1; padding: 25px; border-radius: 15px; background: white;">
                            <h2 style="color: #2d2e83; border-bottom: 3px solid #f36f21; font-size: 24px; font-weight: 800; margin-top: 0; text-transform: uppercase;">Learning</h2>
                            <p style="font-size: 14px; color: #334155;">${d.checklist.learning || 'N/A'}</p>
                        </div>
                        <div style="border: 2px solid #10b981; padding: 25px; border-radius: 15px; background: #ecfdf5;">
                            <h2 style="color: #047857; border-bottom: 3px solid #34d399; font-size: 24px; font-weight: 800; margin-top: 0;">Sustainability</h2>
                            <p style="font-size: 14px; color: #065f46;">${d.checklist.sustain || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = posterHTML;
        document.body.appendChild(container);

        const opt = {
            margin: 0.2,
            filename: `RCEM_Poster_${d.meta.title}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a0', orientation: 'landscape' }
        };

        await html2pdf().set(opt).from(container).save();
        document.body.removeChild(container);

    } catch (e) {
        console.error(e);
        alert("Error generating PDF: " + e.message);
    } finally {
        btn.innerText = originalText;
    }
};

// --- FULL VIEW ---
async function renderFullProject() {
    if(!projectData) return;
    const container = document.getElementById('full-project-container');
    container.innerHTML = `<div class="text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-rcem-purple inline-block"></div><br>Generating Report...</div>`;
    
    const chartImg = await getVisualAsset('chart');
    const driverImg = await getVisualAsset('driver');
    const fishboneImg = await getVisualAsset('fishbone');
    
    const d = projectData;
    const c = d.checklist;
    
    container.innerHTML = `
        <div class="space-y-8">
            <div class="bg-white p-8 rounded shadow-sm border border-slate-200">
                <h1 class="text-3xl font-bold text-slate-900 mb-6 border-b pb-4">${escapeHtml(d.meta.title)}</h1>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div><h3 class="font-bold text-slate-500 uppercase text-xs mb-2">Problem</h3><p class="text-slate-800">${escapeHtml(c.problem_desc)}</p></div>
                    <div><h3 class="font-bold text-slate-500 uppercase text-xs mb-2">Aim</h3><p class="text-slate-800 font-medium">${escapeHtml(c.aim)}</p></div>
                </div>
            </div>

            <div class="bg-white p-8 rounded shadow-sm border border-slate-200">
                <h3 class="font-bold text-xl mb-6 text-slate-800 border-b pb-2">Diagnostic Phase</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 class="font-bold text-sm text-slate-500 uppercase mb-3">Driver Diagram</h4>
                        ${driverImg ? `<img src="${driverImg}" class="w-full border rounded shadow-sm">` : '<p class="text-slate-400 italic">No diagram.</p>'}
                    </div>
                    <div>
                        <h4 class="font-bold text-sm text-slate-500 uppercase mb-3">Fishbone Analysis</h4>
                        ${fishboneImg ? `<img src="${fishboneImg}" class="w-full border rounded shadow-sm">` : '<p class="text-slate-400 italic">No diagram.</p>'}
                    </div>
                </div>
            </div>

            <div class="bg-white p-8 rounded shadow-sm border border-slate-200">
                <h3 class="font-bold text-xl mb-6 text-slate-800 border-b pb-2">Measurement & Results</h3>
                <div class="mb-6">
                    ${chartImg ? `<img src="${chartImg}" class="w-full border rounded shadow-sm">` : '<p class="text-slate-400 italic py-10 text-center">No data points recorded.</p>'}
                </div>
                <div class="bg-slate-50 p-4 rounded border-l-4 border-rcem-purple">
                    <h4 class="font-bold text-sm text-rcem-purple uppercase mb-1">Analysis</h4>
                    <p class="text-slate-700 whitespace-pre-wrap">${escapeHtml(c.results_text)}</p>
                </div>
            </div>

            <div class="bg-white p-8 rounded shadow-sm border border-slate-200">
                <h3 class="font-bold text-xl mb-6 text-slate-800 border-b pb-2">PDSA Cycles</h3>
                <div class="space-y-4">
                    ${d.pdsa.map(p => `
                        <div class="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-bold text-lg text-slate-800">${escapeHtml(p.title)}</h4>
                                ${p.isStepChange ? '<span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-bold">Step Change</span>' : ''}
                            </div>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div><span class="font-bold text-slate-500 block text-xs uppercase">Plan</span>${escapeHtml(p.plan)}</div>
                                <div><span class="font-bold text-slate-500 block text-xs uppercase">Do</span>${escapeHtml(p.do)}</div>
                                <div><span class="font-bold text-slate-500 block text-xs uppercase">Study</span>${escapeHtml(p.study)}</div>
                                <div><span class="font-bold text-slate-500 block text-xs uppercase">Act</span>${escapeHtml(p.act)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// --- HELPERS ---
const helpData = {
    checklist: { t: "Define & Measure", c: "<p>Problem, Aim (SMART), and Measures.</p>" },
    diagrams: { t: "Drivers & Fishbone", c: "<p>Fishbone = Root Cause. Drivers = Strategy.</p>" },
    data: { t: "SPC & Run Charts", c: "<p>Look for Shifts (6+ points) and Trends (5+ points).</p>" },
    pdsa: { t: "PDSA Cycles", c: "<p>Plan, Do, Study, Act.</p>" }
};
