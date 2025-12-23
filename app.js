import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

// --- STATE ---
let currentUser = null;
let currentProjectId = null;
let projectData = null;
let isDemoMode = false;
let chartInstance = null;
let unsubscribeProject = null;
let toolMode = 'fishbone';

// --- EXPERT COMMITTEE: OFF-THE-SHELF TEMPLATES ---
const qipTemplates = {
    pain: {
        meta: { title: "Analgesia in Majors (RCEM Audit)" },
        checklist: {
            problem_desc: "Delays in analgesia lead to poor patient experience and physiological stress. Current performance is below the RCEM standard (50% within 20 mins).",
            evidence: "RCEM Pain in Adults Guidelines (2023).",
            aim: "To increase the % of patients with severe pain receiving analgesia within 20 mins from X% to 90% by [Date].",
            outcome_measures: "% Time to Analgesia < 20 mins",
            process_measures: "Time to Triage; Pain Score recorded at Triage",
            drivers: { primary: ["Identification", "Prescribing", "Administration"], secondary: ["Pain Scoring", "Nurse PGDs", "Drug Availability"], changes: ["Mandatory Pain Score at Triage", "Intranasal Fentanyl PGD"] }
        }
    },
    sepsis: {
        meta: { title: "Sepsis 6 Compliance" },
        checklist: {
            problem_desc: "Sepsis mortality increases by 7.6% for every hour delay in antibiotics. Current compliance with the 'Sepsis 6' bundle in our ED is variable.",
            evidence: "RCEM Sepsis Standards & NICE NG51.",
            aim: "To increase the % of Red Flag Sepsis patients receiving antibiotics within 60 mins from X% to 95% by [Date].",
            drivers: { 
                primary: ["Recognition", "Equipment", "Culture"], 
                secondary: ["Screening Tool Use", "Grab Bags", "Feedback loops"], 
                changes: ["Sepsis Trolley in Resus", "Automated Triage Prompt"] 
            }
        }
    },
    falls: {
        meta: { title: "Falls Assessment in Elderly" },
        checklist: {
            problem_desc: "Elderly patients with mechanical falls are often not screened for lying/standing BP, leading to missed syncope diagnoses.",
            evidence: "NICE CG161 Falls Assessment.",
            aim: "To increase the completion of lying/standing BP in patients >65 presenting with falls from X% to 80% by [Date].",
            drivers: { primary: ["Staff Education", "Equipment", "Documentation"], secondary: ["Lying/Standing Protocol", "Orthostatic BP Machine", "Cerner PowerForm"], changes: ["Poster in Majors", "Dedicated BP machine"] }
        }
    },
    vte: {
        meta: { title: "VTE Risk Assessment" },
        checklist: {
            problem_desc: "Hospital acquired thrombosis is preventable. VTE risk assessment is mandatory but often missed in busy ED flow.",
            aim: "To increase VTE risk assessment completion for admitted patients from X% to 95% by [Date].",
            drivers: { primary: ["Prompting", "Ease of Use"], secondary: ["Digital Reminder", "Paper Chart Integration"], changes: ["Doctor sticker in notes"] }
        }
    },
    flow: {
        meta: { title: "Ambulance Handover Delays" },
        checklist: {
            problem_desc: "Ambulance crews are delayed in the corridor, reducing community availability.",
            aim: "To decrease average ambulance handover time from X mins to 15 mins by [Date].",
            drivers: { primary: ["Space", "Staffing", "Process"], secondary: ["Fit-to-sit zone", "Cohorting", "Rapid Triage"], changes: ["Halo Nurse Role", "Chairs in corridor"] }
        }
    }
};

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
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-sidebar').classList.remove('hidden');
        document.getElementById('app-sidebar').classList.add('flex');
        document.getElementById('user-display').textContent = user.email;
        loadProjectList();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
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

document.getElementById('logout-btn').addEventListener('click', () => { signOut(auth); location.reload(); });

// --- PROJECT MANAGEMENT ---
async function loadProjectList() {
    window.router('projects');
    document.getElementById('top-bar').classList.add('hidden');
    const listEl = document.getElementById('project-list');
    listEl.innerHTML = '<div class="col-span-3 text-center text-slate-400 py-10 animate-pulse">Loading projects...</div>';
    
    // Demo Mode handling
    if (isDemoMode) {
        listEl.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm border-2 border-rcem-purple relative overflow-hidden cursor-pointer hover:shadow-md transition-all" onclick="window.openDemoProject()">
                 <div class="absolute top-0 right-0 bg-rcem-purple text-white text-xs px-2 py-1">Example</div>
                 <h3 class="font-bold text-lg text-slate-800 mb-1">Improving Sepsis 6 Delivery</h3>
                 <p class="text-xs text-slate-400 mb-4">Dr. A. Medic</p>
                 <div class="flex gap-2 text-xs font-medium text-slate-500">
                    <span class="bg-slate-100 px-2 py-1 rounded">15 Data Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded">3 Cycles</span>
                </div>
            </div>
        `;
        return;
    }

    const snap = await getDocs(collection(db, `users/${currentUser.uid}/projects`));
    listEl.innerHTML = '';
    
    if (snap.empty) {
        listEl.innerHTML = `<div class="col-span-3 text-center border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50">
            <h3 class="font-bold text-slate-600 mb-2">No Projects Yet</h3>
            <p class="text-slate-400 text-sm mb-4">Start your journey towards Quality Improvement.</p>
            <button onclick="window.createNewProject()" class="text-rcem-purple font-bold hover:underline flex items-center justify-center gap-2 mx-auto"><i data-lucide="plus-circle" class="w-4 h-4"></i> Create your first QIP</button>
        </div>`;
    }

    snap.forEach(doc => {
        const d = doc.data();
        const date = new Date(d.meta?.created).toLocaleDateString();
        listEl.innerHTML += `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group relative" onclick="window.openProject('${doc.id}')">
                <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors truncate">${d.meta?.title || 'Untitled'}</h3>
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
    // Expert Committee: Enhanced Selection
    const choice = prompt("Choose a template:\n1. Blank Project\n2. Sepsis (Sepsis 6)\n3. Pain (Analgesia)\n4. Falls (Elderly)\n5. VTE Assessment\n6. Ambulance Flow\n\nEnter Number:", "1");
    if (!choice) return;

    let template = JSON.parse(JSON.stringify(emptyProject));
    const map = { '2':'sepsis', '3':'pain', '4':'falls', '5':'vte', '6':'flow' };
    
    if (map[choice]) {
        const t = qipTemplates[map[choice]];
        Object.assign(template.meta, t.meta);
        Object.assign(template.checklist, t.checklist);
        template.drivers = t.checklist.drivers || template.drivers;
    }

    const title = prompt("Project Title:", template.meta.title || "My New QIP");
    if (!title) return;
    
    template.meta.title = title;
    template.meta.created = new Date().toISOString();
    
    await addDoc(collection(db, `users/${currentUser.uid}/projects`), template);
    loadProjectList();
};

window.deleteProject = async (id) => {
    if (confirm("Are you sure? This cannot be undone.")) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, id));
        loadProjectList();
    }
};

window.openProject = (id) => {
    currentProjectId = id;
    if (unsubscribeProject) unsubscribeProject();
    
    unsubscribeProject = onSnapshot(doc(db, `users/${currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            projectData = doc.data();
            // Schema patching
            if(!projectData.checklist) projectData.checklist = {};
            if(!projectData.drivers) projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!projectData.fishbone) projectData.fishbone = emptyProject.fishbone;
            if(!projectData.pdsa) projectData.pdsa = [];
            if(!projectData.chartData) projectData.chartData = [];
            if(!projectData.stakeholders) projectData.stakeholders = [];
            
            document.getElementById('project-header-title').textContent = projectData.meta.title;
            renderAll();
        }
    });

    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

window.openDemoProject = () => {
    // Basic Demo Data structure
    projectData = {
        meta: { title: "Demo Project" },
        checklist: { aim: "To increase sepsis screening to 95% by 2025.", problem_desc: "Demo problem.", drivers: {primary:[], secondary:[], changes:[]} },
        drivers: { primary: ["Staff"], secondary: ["Training"], changes: ["Posters"] },
        chartData: [{date: "2024-01-01", value: 50}, {date: "2024-01-02", value: 55}],
        pdsa: [],
        fishbone: emptyProject.fishbone,
        process: ["Start", "End"],
        stakeholders: [],
        gantt: []
    };
    document.getElementById('project-header-title').textContent = "Demo Project (Read Only)";
    document.getElementById('top-bar').classList.remove('hidden');
    renderAll();
    window.router('dashboard');
}

window.returnToProjects = () => {
    currentProjectId = null;
    projectData = null;
    if (unsubscribeProject) unsubscribeProject();
    loadProjectList();
};

// --- ROUTER ---
let currentView = 'dashboard';
window.router = (view) => {
    currentView = view;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
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
    
    // Expert Committee: First-Time Tour trigger logic placeholder
    // In a real deployment, we would check localStorage here.
    // if(!localStorage.getItem(`tour-${view}`)) window.startTour();
};

async function saveData() {
    if (isDemoMode) { renderAll(); return; }
    if (!currentProjectId) return;
    await setDoc(doc(db, `users/${currentUser.uid}/projects`, currentProjectId), projectData, { merge: true });
    
    const s = document.getElementById('save-status');
    s.classList.remove('opacity-0');
    setTimeout(() => s.classList.add('opacity-0'), 2000);
}

// --- DEMO MODE ---
document.getElementById('demo-toggle').addEventListener('change', (e) => {
    isDemoMode = e.target.checked;
    const wm = document.getElementById('demo-watermark');
    if (isDemoMode) {
        wm.classList.remove('hidden');
        loadProjectList();
    } else {
        wm.classList.add('hidden');
        if (currentUser) loadProjectList();
        else document.getElementById('auth-screen').classList.remove('hidden');
    }
});

document.getElementById('demo-auth-btn').onclick = () => {
    isDemoMode = true;
    currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.add('flex');
    document.getElementById('demo-watermark').classList.remove('hidden');
    document.getElementById('demo-toggle').checked = true;
    loadProjectList();
};

function renderAll() {
    renderCoach();
    if(currentView === 'data') renderChart();
    if(currentView === 'tools') renderTools();
    if(currentView === 'stakeholders') renderStakeholders();
    if(currentView === 'checklist') renderChecklist();
    if(currentView === 'pdsa') renderPDSA();
    if(currentView === 'gantt') renderGantt();
    if(currentView === 'full') renderFullProject();
}

// --- 1. THE QI COACH (Enhanced) ---
function renderCoach() {
    if(!projectData) return;
    const d = projectData;
    const banner = document.getElementById('qi-coach-banner');
    
    // Logic Tree with "Quality Assurance"
    let status = { t: "", m: "", b: "", c: "" };

    const aimQuality = checkAimQuality(d.checklist.aim);
    const badgeEl = document.getElementById('aim-quality-badge');
    if(badgeEl) {
        badgeEl.innerHTML = aimQuality.valid 
        ? `<span class="text-emerald-600 font-bold flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Strong Aim</span>` 
        : `<span class="text-amber-600 font-bold flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> Weak Aim: ${aimQuality.msg}</span>`;
    }

    if (!d.checklist.aim) {
        status = { t: "Step 1: Define your Aim", m: "A project without an aim is just a hobby. Use the SMART wizard to define exactly what you want to achieve.", b: "Build SMART Aim", a: () => { window.router('checklist'); document.getElementById('smart-modal').classList.remove('hidden'); }, c: "from-purple-600 to-indigo-700" };
    } else if (!aimQuality.valid) {
        status = { t: "Refine your Aim", m: `Your aim is missing a key element: ${aimQuality.msg}. Click 'Edit' to make it SMART.`, b: "Fix Aim", a: () => { window.router('checklist'); document.getElementById('smart-modal').classList.remove('hidden'); }, c: "from-amber-600 to-orange-700" };
    } else if (d.drivers.secondary.length === 0) {
        status = { t: "Step 2: Diagnose the Issue", m: "You have a target. Now use the Driver Diagram to map out *how* you will hit it.", b: "Go to Drivers", a: () => window.router('tools'), c: "from-blue-600 to-cyan-700" };
    } else if (d.chartData.length < 5) {
        status = { t: "Step 3: Establish Baseline", m: "Collect at least 5-10 data points before starting changes to understand your 'normal'.", b: "Add Data", a: () => window.router('data'), c: "from-amber-500 to-orange-600" };
    } else if (d.pdsa.length === 0) {
        status = { t: "Step 4: Time to Act", m: "You have a baseline. Pick a 'Change Idea' from your Driver Diagram and run a PDSA cycle.", b: "Start PDSA", a: () => window.router('pdsa'), c: "from-emerald-600 to-green-700" };
    } else {
        status = { t: "Project Active", m: "Keep measuring. Look for 'Shifts' (6 points above median) in your data to prove improvement.", b: "Review Data", a: () => window.router('data'), c: "from-slate-700 to-slate-800" };
    }

    banner.className = `bg-gradient-to-r ${status.c} shadow-lg relative overflow-hidden transition-all duration-500`;
    banner.innerHTML = `
        <div class="absolute right-0 top-0 opacity-10 p-4"><i data-lucide="compass" class="w-32 h-32"></i></div>
        <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">QI Coach</span>
                    <h3 class="font-bold text-lg">${status.t}</h3>
                </div>
                <p class="text-white/90 text-sm max-w-2xl">${status.m}</p>
            </div>
            <button id="coach-action-btn" class="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-slate-50 transition-colors whitespace-nowrap flex items-center gap-2">${status.b} <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
        </div>
    `;
    document.getElementById('coach-action-btn').onclick = status.a;
    lucide.createIcons();
    
    // Stats update
    document.getElementById('stat-pdsa').textContent = d.pdsa.length;
    document.getElementById('stat-data').textContent = d.chartData.length;
    document.getElementById('stat-drivers').textContent = d.drivers.changes.length;
    document.getElementById('dash-aim-display').textContent = d.checklist.aim || "No aim defined yet.";
}

function checkAimQuality(aim) {
    if (!aim) return { valid: false, msg: "No aim found" };
    const lower = aim.toLowerCase();
    if (!/\d/.test(aim)) return { valid: false, msg: "No measurable number (Target %)" };
    if (!lower.includes('by') && !/\d{2,4}/.test(aim)) return { valid: false, msg: "No date/deadline" };
    return { valid: true };
}

// --- 2. CHECKLIST & SMART WIZARD ---
function renderChecklist() {
    if(!projectData) return;
    const list = document.getElementById('checklist-container');
    const sections = [
        { id: "def", title: "Problem & Evidence", fields: [
            {k:"problem_desc", l:"Reason for Project (Problem)", p:"What is the gap between standard and reality? Why is it a problem?"},
            {k:"evidence", l:"Evidence / Standards", p:"RCEM Guidelines, NICE, Local Audit data..."}
        ]},
        { id: "meas", title: "Aim & Measures", fields: [
            {k:"aim", l:"SMART Aim", p:"Use the wizard to build this...", w:true},
            {k:"outcome_measures", l:"Outcome Measure", p:"The main result (e.g. % Compliance)"},
            {k:"process_measures", l:"Process Measures", p:"Are staff doing the steps? (e.g. Screening tool used)"},
            {k:"balance_measures", l:"Balancing Measures", p:"Are we causing harm elsewhere? (e.g. Delays)"}
        ]},
        { id: "team", title: "Team & Ethics", fields: [
            {k:"lead", l:"Project Lead", p:"Your name"},
            {k:"team", l:"Team Members", p:"Consultant Sponsor, Nursing Lead, etc."},
            {k:"ethics", l:"Ethical / Governance", p:"Registered with Audit Dept? Ref Number?"},
            {k:"ppi", l:"Patient Public Involvement (PPI)", p:"How have patients been consulted?"}
        ]},
        { id: "conc", title: "Conclusions", fields: [
            {k:"learning", l:"Key Learning / Analysis", p:"What worked? What didn't?"},
            {k:"sustain", l:"Sustainability Plan", p:"How will this stick when you leave?"}
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
                        <textarea onchange="projectData.checklist['${f.k}']=this.value;saveData()" class="w-full rounded border-slate-300 p-2 text-sm focus:ring-2 focus:ring-rcem-purple outline-none transition-shadow" rows="2" placeholder="${f.p}">${projectData.checklist[f.k]||''}</textarea>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
    
    // Updated saveSmartAim to read from Mad Libs inputs
    window.saveSmartAim = () => {
        const v = document.getElementById('sa-verb').value;
        const m = document.getElementById('sa-metric').value;
        const p = document.getElementById('sa-pop').value;
        const b = document.getElementById('sa-base').value;
        const t = document.getElementById('sa-target').value;
        const d = document.getElementById('sa-date').value;
        
        const sentence = `To ${v} the ${m} for ${p} from ${b} to ${t} by ${d}.`;
        projectData.checklist.aim = sentence;
        saveData();
        document.getElementById('smart-modal').classList.add('hidden');
        renderChecklist();
        renderCoach();
    };
}

// --- 3. TOOLS (5 WHYS & FISHBONE) ---
window.setToolMode = (m) => {
    toolMode = m;
    document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-rcem-purple'));
    document.getElementById(`tab-${m}`).classList.add('bg-white', 'shadow-sm', 'text-rcem-purple');
    renderTools();
};

async function renderTools() {
    const toolInfo = {
        fishbone: { title: "Fishbone", desc: "Root Cause Analysis", how: "Ask 'Why?' 5 times." },
        driver: { title: "Driver Diagram", desc: "Theory of Change", how: "Primary Drivers -> Secondary Drivers -> Changes" },
        process: { title: "Process Map", desc: "Workflow", how: "Map the patient journey step-by-step." }
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
        
        ctrls = cats.map(c => `
            <button onclick="window.addCauseWithWhys(${c.id})" class="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2">
                <i data-lucide="plus" class="w-4 h-4"></i> ${c.text}
            </button>
        `).join('');

        if (cats.every(c => c.causes.length === 0)) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'driver') {
        const d = projectData.drivers;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        
        mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
        
        ctrls = `<button onclick="window.addDriver('primary')" class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded">Add Primary</button> <button onclick="window.addDriver('secondary')" class="px-4 py-2 bg-blue-100 text-blue-800 rounded">Add Secondary</button> <button onclick="window.addDriver('changes')" class="px-4 py-2 bg-purple-100 text-purple-800 rounded">Add Change Idea</button>`;
        
        if (d.primary.length === 0) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'process') {
         const p = projectData.process;
         const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
         mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
         ctrls = `<button onclick="window.addStep()" class="px-4 py-2 bg-white border border-slate-300 rounded">Add Step</button> <button onclick="window.resetProcess()" class="px-4 py-2 text-red-500">Reset</button>`;
         ghost.classList.add('hidden');
    }

    canvas.innerHTML = `<div class="mermaid">${mCode}</div>`;
    controls.innerHTML = ctrls;
    try { await mermaid.run(); } catch(e) {}
    lucide.createIcons();
}

// EXPERT COMMITTEE: 5 Whys Interaction
window.addCauseWithWhys = (id) => {
    let cause = prompt("What is the cause?");
    if (!cause) return;
    
    // The "5 Whys" Drill Down
    if (confirm(`Do you want to drill down into "${cause}" using the 5 Whys technique?`)) {
        let root = cause;
        for (let i = 1; i <= 3; i++) { // Limit to 3 levels for UI sanity
            let deeper = prompt(`Why does "${root}" happen?`);
            if (!deeper) break;
            root = deeper;
        }
        if (root !== cause) {
            if(confirm(`The root cause seems to be: "${root}". \n\nAdd "${root}" to the diagram instead of "${cause}"?`)) {
                cause = root;
            }
        }
    }
    
    projectData.fishbone.categories.find(c=>c.id===id).causes.push(cause);
    saveData();
    renderTools();
};

window.addDriver = (t) => { const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} }
window.addStep = () => { const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} }
window.resetProcess = () => { if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} }

// --- 4. STAKEHOLDERS (SCRIPTS) ---
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
        el.innerHTML = `<span class="whitespace-nowrap">${s.name}</span>`;
        
        // Expert Committee: Click to see Script
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

        el.onmousedown = (e) => dragStakeholder(e, index);
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
    const name = prompt("Stakeholder Name:");
    if(!name) return;
    if(!projectData.stakeholders) projectData.stakeholders = [];
    projectData.stakeholders.push({ name: name, power: 50, interest: 50 });
    saveData();
    renderStakeholders();
};


// --- 5. CHART (RIGOROUS SPC) ---
function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if (data.length === 0) { document.getElementById('chart-ghost').classList.remove('hidden'); if(chartInstance) chartInstance.destroy(); return; }
    document.getElementById('chart-ghost').classList.add('hidden');

    const outcomes = data.filter(d => d.type === 'outcome' || !d.type);
    const values = outcomes.map(d => Number(d.value));
    const labels = outcomes.map(d => d.date);
    
    // EXPERT COMMITTEE: Rigorous Median & Shift Detection
    // 1. Calculate Baseline Median (first 12 points or all if <12)
    let baselinePoints = values.slice(0, 12); 
    let currentMedian = baselinePoints.length ? baselinePoints.sort((a,b)=>a-b)[Math.floor(baselinePoints.length/2)] : 0;
    
    const pointColors = [];
    const medianLineData = [];
    let runCount = 0;
    let runDirection = 0; // 1 up, -1 down

    values.forEach((v, i) => {
        // Run Chart Rules
        if (v > currentMedian) {
            if (runDirection === 1) runCount++;
            else { runCount = 1; runDirection = 1; }
        } else if (v < currentMedian) {
            if (runDirection === -1) runCount++;
            else { runCount = 1; runDirection = -1; }
        } else {
            runCount = 0; 
        }

        // Color Logic: Shift if 6+ points on one side of median
        if (runCount >= 6) {
             pointColors.push('#059669'); // Green (Shift)
        } else {
             pointColors.push('#2d2e83'); // Normal
        }
        
        medianLineData.push(currentMedian);
    });

    if (chartInstance) chartInstance.destroy();
    
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2, label: { display: true, content: 'Median', position: 'end' } }
    };
    
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Outcome Measure',
                    data: values,
                    borderColor: '#2d2e83',
                    backgroundColor: pointColors,
                    pointBackgroundColor: pointColors,
                    pointRadius: 6,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { annotation: { annotations } },
            onClick: (e, activeEls) => {
                if (activeEls.length > 0) {
                    const i = activeEls[0].index;
                    // Expert Feature: Context for Outliers
                    const note = prompt(`Annotate data point (${labels[i]}):`, data[i].note || "");
                    if (note !== null) {
                        data[i].note = note;
                        saveData();
                        renderChart();
                    }
                }
            }
        }
    });

    // Render History List
    document.getElementById('data-history').innerHTML = data.slice().reverse().map(d => `
        <div class="flex justify-between border-b border-slate-100 py-2 items-center">
            <span><span class="font-mono text-xs text-slate-400 mr-2">${d.date}</span> <strong>${d.value}</strong> <span class="text-[10px] text-slate-400 uppercase tracking-wide ml-1">${d.type}</span></span>
            ${d.note ? `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">${d.note}</span>` : ''}
        </div>
    `).join('');
}

window.addDataPoint = () => {
    const d = {
        date: document.getElementById('chart-date').value,
        value: document.getElementById('chart-value').value,
        type: document.getElementById('chart-cat').value
    };
    if (d.date && d.value) {
        projectData.chartData.push(d);
        saveData();
        renderChart();
    }
};

window.saveResults = (val) => {
    if(!projectData.checklist) projectData.checklist = {};
    projectData.checklist.results_text = val;
    saveData();
}

// --- 6. PDSA (Celebrate Failure) ---
window.addPDSA = () => {
    const t = prompt("Cycle Title (e.g. Cycle 1: Sticker):");
    if(t) { 
        projectData.pdsa.unshift({id: Date.now(), title:t, plan:"", do:"", study:"", act:""}); 
        saveData(); 
        renderPDSA(); 
    }
}
function renderPDSA() {
    if(!projectData) return;
    const container = document.getElementById('pdsa-container');
    if (projectData.pdsa.length === 0) {
        container.innerHTML = `<div class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50"><button onclick="window.addPDSA()" class="bg-rcem-purple text-white px-4 py-2 rounded">Start Cycle 1</button></div>`;
        return;
    }
    container.innerHTML = projectData.pdsa.map((p,i) => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-4">
                <div class="font-bold text-lg text-slate-800">${p.title}</div>
                <button onclick="window.deletePDSA(${i})" class="text-slate-400 hover:text-red-500"><i data-lucide="trash-2"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-3 rounded"><div class="text-xs font-bold text-blue-800 uppercase">Plan</div><textarea onchange="projectData.pdsa[${i}].plan=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.plan}</textarea></div>
                <div class="bg-orange-50 p-3 rounded"><div class="text-xs font-bold text-orange-800 uppercase">Do</div><textarea onchange="projectData.pdsa[${i}].do=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.do}</textarea></div>
                <div class="bg-purple-50 p-3 rounded">
                    <div class="text-xs font-bold text-purple-800 uppercase flex justify-between">Study <span>Did it work?</span></div>
                    <textarea onchange="projectData.pdsa[${i}].study=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2" placeholder="Analyze data...">${p.study}</textarea>
                </div>
                <div class="bg-emerald-50 p-3 rounded"><div class="text-xs font-bold text-emerald-800 uppercase">Act</div><textarea onchange="projectData.pdsa[${i}].act=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2" placeholder="Adopt, Adapt, or Abandon?">${p.act}</textarea></div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.deletePDSA = (i) => { if(confirm("Delete?")) { projectData.pdsa.splice(i,1); saveData(); renderPDSA(); } }

// --- 7. TOURS (Driver.js) ---
window.startTour = () => {
    const driver = window.driver.js.driver;
    const tour = driver({
        showProgress: true,
        steps: [
            { element: '#nav-checklist', popover: { title: 'Step 1: Define', description: 'Start here. You need a SMART Aim before you do anything else.' } },
            { element: '#nav-tools', popover: { title: 'Step 2: Diagnose', description: 'Use the Fishbone to find the cause, and Driver Diagram to plan your strategy.' } },
            { element: '#nav-data', popover: { title: 'Step 3: Measure', description: 'Enter your data here. The chart will automatically tell you if you are improving.' } },
            { element: '#nav-pdsa', popover: { title: 'Step 4: Act', description: 'Record your changes (PDSA cycles) here. Even failed cycles count as portfolio evidence!' } }
        ]
    });
    tour.drive();
};

// --- 8. EXPORTS & UTILS ---

window.openPortfolioExport = () => {
    const d = projectData;
    const modal = document.getElementById('risr-modal');
    modal.classList.remove('hidden');
    
    const fields = [
        { t: "Title", v: d.meta.title },
        { t: "Reason for Project (Problem)", v: d.checklist.problem_desc },
        { t: "Evidence / Standards", v: d.checklist.evidence },
        { t: "SMART Aim", v: d.checklist.aim },
        { t: "Team & Stakeholders", v: d.checklist.team },
        { t: "Drivers & Strategy", v: `Primary Drivers: ${d.drivers.primary.join(', ')}\nChanges: ${d.drivers.changes.join(', ')}` },
        { t: "Measures", v: `Outcome: ${d.checklist.outcome_measures}\nProcess: ${d.checklist.process_measures}\nBalance: ${d.checklist.balance_measures}` },
        { t: "Interventions (PDSA)", v: d.pdsa.map(p => `[${p.title}] Study: ${p.study} Act: ${p.act}`).join('\n\n') },
        { t: "Results & Analysis", v: d.checklist.results_text || "No analysis recorded yet." },
        { t: "Learning & Sustainability", v: d.checklist.learning + "\n\nSustainability Plan:\n" + d.checklist.sustain },
        { t: "Ethical & PPI", v: d.checklist.ethics + "\n\nPPI: " + d.checklist.ppi }
    ];

    document.getElementById('risr-content').innerHTML = fields.map(f => `
        <div class="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-2">
                 <h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide">${f.t}</h4>
                 <button class="text-xs text-rcem-purple font-bold hover:underline" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copy</button>
            </div>
            <div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap font-mono text-slate-600 select-all border border-slate-100">${f.v || 'Not recorded'}</div>
        </div>
    `).join('');
};

window.exportPPTX = async () => {
    if (!projectData) return;
    const d = projectData;
    const pres = new PptxGenJS();
    
    // Helper to rasterize Mermaid SVG
    const getDiagramImage = async () => {
        const svg = document.querySelector('#mermaid-render svg');
        if(!svg) return null;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        return new Promise(resolve => {
            img.onload = () => {
                canvas.width = img.width * 2; // High res
                canvas.height = img.height * 2;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });
    };

    // 1. Title Slide
    let slide = pres.addSlide();
    slide.addText(d.meta.title, { x: 0.5, y: 2, w: 9, fontSize: 32, bold: true, color: '2d2e83' });
    slide.addText(d.checklist.team || 'QIP Team', { x: 0.5, y: 3.5, fontSize: 18, color: '64748b' });

    // 2. Problem & Aim
    slide = pres.addSlide();
    slide.addText('Problem & Aim', { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    slide.addText('The Problem:', { x: 0.5, y: 1.2, fontSize: 14, color: 'f36f21', bold: true });
    slide.addText(d.checklist.problem_desc || 'N/A', { x: 0.5, y: 1.5, w: 9, fontSize: 12, color: '334155' });
    slide.addText('SMART Aim:', { x: 0.5, y: 3.5, fontSize: 14, color: 'f36f21', bold: true });
    slide.addText(d.checklist.aim || 'N/A', { x: 0.5, y: 3.8, w: 9, fontSize: 16, color: '2d2e83', italic: true, fill: 'f1f5f9' });

    // 3. Diagrams Slide
    slide = pres.addSlide();
    slide.addText('Project Drivers / Strategy', { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    try {
        const diagImg = await getDiagramImage();
        if(diagImg) slide.addImage({ data: diagImg, x: 0.5, y: 1.5, w: 9, h: 5, sizing: {type:'contain'} });
        else slide.addText("(Navigate to Diagrams tab to include diagram)", { x: 3, y: 3, color: '94a3b8' });
    } catch(e) { console.log(e); }

    // 4. Results Slide
    slide = pres.addSlide();
    slide.addText('Results (Run Chart)', { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    const chartImg = document.getElementById('mainChart').toDataURL('image/png');
    slide.addImage({ data: chartImg, x: 0.5, y: 1.5, w: 9, h: 4.5, sizing: {type:'contain'} });
    slide.addText(d.checklist.results_text || '', { x: 0.5, y: 6.2, w: 9, fontSize: 11 });

    pres.writeFile({ fileName: `QIP-Export.pptx` });
};

window.printPoster = () => {
    const d = projectData;
    const container = document.getElementById('print-container');
    container.innerHTML = `
        <div class="poster-grid">
            <header>
                <img src="https://iili.io/KGQOvkl.md.png" class="logo">
                <div class="header-text">
                    <h1>${d.meta.title}</h1>
                    <p class="team">${d.checklist.team}</p>
                    <p class="trust">Quality Improvement Project</p>
                </div>
            </header>
            <div class="col">
                <div class="box"><h2>1. Introduction & Problem</h2><p>${d.checklist.problem_desc}</p><p class="evidence"><b>Evidence:</b> ${d.checklist.evidence}</p></div>
                <div class="box"><h2>2. SMART Aim</h2><p class="big-aim">${d.checklist.aim}</p></div>
                <div class="box"><h2>3. Driver Diagram</h2><ul class="driver-list">${d.drivers.secondary.map(s=>`<li>${s}</li>`).join('')}</ul></div>
            </div>
            <div class="col wide">
                <div class="box grow">
                    <h2>4. Results (Run Chart)</h2>
                    <div class="chart-holder"><img src="${document.getElementById('mainChart').toDataURL('image/png', 2.0)}"></div>
                    <p class="caption"><b>Analysis:</b> ${d.checklist.results_text || 'No results text added.'}</p>
                </div>
            </div>
            <div class="col">
                <div class="box"><h2>5. PDSA Cycles</h2><ul class="pdsa-list">${d.pdsa.map(p=>`<li><b>${p.title}:</b> ${p.study} -> ${p.act}</li>`).join('')}</ul></div>
                <div class="box"><h2>6. Conclusions & Learning</h2><p>${d.checklist.learning}</p></div>
                <div class="box"><h2>7. Sustainability</h2><p>${d.checklist.sustain}</p></div>
            </div>
        </div>
    `;
    window.print();
};

window.addGanttTask = () => {
    const n = prompt("Task Name:");
    if(!n) return;
    const s = prompt("Start Date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if(!s) return;
    const e = prompt("End Date (YYYY-MM-DD):", s);
    if(!e) return;

    if(!projectData.gantt) projectData.gantt=[];
    projectData.gantt.push({id:Date.now(), name:n, start: s, end: e}); 
    saveData(); 
    renderGantt(); 
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
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 7); 
    maxDate.setDate(maxDate.getDate() + 7);

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((maxDate - minDate) / dayMs);
    const pxPerDay = 30; 
    
    let gridHTML = `<div class="gantt-grid" style="grid-template-columns: 200px repeat(${totalDays}, ${pxPerDay}px); width: ${200 + (totalDays * pxPerDay)}px">`;
    
    gridHTML += `<div class="gantt-header sticky left-0 bg-white z-20 border-r border-slate-200">Task Name</div>`;
    for(let i=0; i<totalDays; i+=7) { 
        const d = new Date(minDate.getTime() + (i * dayMs));
        gridHTML += `<div class="gantt-header" style="grid-column: span 7; text-align: left; padding-left: 5px;">${d.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>`;
    }

    const today = new Date();
    if(today >= minDate && today <= maxDate) {
        const todayOffset = Math.floor((today - minDate) / dayMs);
        gridHTML += `<div class="gantt-today" style="left: ${200 + (todayOffset * pxPerDay)}px"></div>`;
    }

    g.forEach(t => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        const offsetDays = Math.floor((start - minDate) / dayMs);
        const durationDays = Math.ceil((end - start) / dayMs) || 1;
        
        gridHTML += `<div class="gantt-row sticky left-0 bg-white z-10 border-r border-slate-200 flex items-center px-4 text-sm font-medium text-slate-700 truncate" title="${t.name}">
            ${t.name} <button onclick="deleteGantt('${t.id}')" class="ml-auto text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`;
        
        gridHTML += `<div class="gantt-row" style="grid-column: 2 / -1;">
            <div class="gantt-bar" style="left: ${offsetDays * pxPerDay}px; width: ${durationDays * pxPerDay}px;">
                ${durationDays} days
            </div>
        </div>`;
    });

    gridHTML += `</div>`;
    container.innerHTML = gridHTML;
    lucide.createIcons();
}

// --- CALCULATORS ---
window.calcGreen = () => {
    const v = document.getElementById('green-type').value;
    const q = document.getElementById('green-qty').value;
    const r = document.getElementById('green-res');
    r.innerHTML = `<span class="text-2xl text-emerald-600">${(v*q).toFixed(2)} kg</span> CO2e`;
    r.classList.remove('hidden');
}

window.calcMoney = () => {
    const unit = parseFloat(document.getElementById('money-unit').value) || 0;
    const qty = parseFloat(document.getElementById('money-qty').value) || 0;
    const res = document.getElementById('money-res');
    res.innerHTML = `<span class="text-2xl text-emerald-600">£${(unit * qty).toFixed(2)}</span> total saved`;
    res.classList.remove('hidden');
}

window.calcTime = () => {
    const unit = parseFloat(document.getElementById('time-unit').value) || 0;
    const qty = parseFloat(document.getElementById('time-qty').value) || 0;
    const res = document.getElementById('time-res');
    const total = unit * qty;
    const hrs = Math.floor(total / 60);
    const mins = total % 60;
    res.innerHTML = `<span class="text-2xl text-blue-600">${hrs}h ${mins}m</span> total saved`;
    res.classList.remove('hidden');
}

window.calcEdu = () => {
    const pre = parseFloat(document.getElementById('edu-pre').value) || 0;
    const post = parseFloat(document.getElementById('edu-post').value) || 0;
    const n = parseFloat(document.getElementById('edu-n').value) || 1;
    const diff = ((post - pre) / pre) * 100;
    const res = document.getElementById('edu-res');
    res.innerHTML = `Confidence improved by <span class="text-2xl text-indigo-600">${diff.toFixed(0)}%</span> across ${n} staff members.`;
    res.classList.remove('hidden');
}

// --- WHOLE PROJECT VIEW ---
function renderFullProject() {
    if(!projectData) return;
    const d = projectData;
    const c = d.checklist;
    const container = document.getElementById('full-project-container');
    const flags = checkRCEMCriteria(d);
    
    let html = '';

    if(flags.length > 0) {
        html += `
            <div class="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 rounded shadow-sm">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="alert-triangle" class="text-amber-600"></i>
                    <h3 class="font-bold text-amber-900">Project Action Points</h3>
                </div>
                <ul class="list-disc list-inside text-sm text-amber-800 space-y-1">
                    ${flags.map(f => `<li>${f}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        html += `
            <div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-8 rounded shadow-sm flex items-center gap-3">
                <i data-lucide="check-circle-2" class="text-emerald-600 w-6 h-6"></i>
                <div>
                    <h3 class="font-bold text-emerald-900">RCEM Gold Standard Met</h3>
                    <p class="text-xs text-emerald-700">Your project meets all core criteria. Excellent work!</p>
                </div>
            </div>
        `;
    }

    const section = (title, content, validationKey) => {
        const isMissing = !content || (Array.isArray(content) && content.length === 0);
        const warning = isMissing ? `<div class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 mt-2 inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Missing / Incomplete</div>` : '';
        return `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">${title}</h3>
                <div class="text-slate-600 text-sm whitespace-pre-wrap">${content || '<span class="italic text-slate-400">Not recorded</span>'}</div>
                ${warning}
            </div>
        `;
    };

    html += `<div class="space-y-6">`;
    html += section("1. Problem & Reason", c.problem_desc);
    html += section("2. Evidence & Guidelines", c.evidence);
    html += section("3. SMART Aim", c.aim);
    
    html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">4. Driver Diagram Summary</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-bold text-xs uppercase text-slate-500 mb-2">Primary Drivers</h4>
                    <ul class="list-disc list-inside text-sm text-slate-700">${d.drivers.primary.length ? d.drivers.primary.map(x=>`<li>${x}</li>`).join('') : '<li class="italic text-slate-400">None</li>'}</ul>
                </div>
                 <div>
                    <h4 class="font-bold text-xs uppercase text-slate-500 mb-2">Change Ideas (Interventions)</h4>
                    <ul class="list-disc list-inside text-sm text-slate-700">${d.drivers.changes.length ? d.drivers.changes.map(x=>`<li>${x}</li>`).join('') : '<li class="italic text-slate-400">None</li>'}</ul>
                </div>
            </div>
            ${d.drivers.secondary.length === 0 ? `<div class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 mt-4 inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Missing Drivers</div>` : ''}
        </div>
    `;

    html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">5. Data & Results</h3>
            <div class="h-64 relative mb-4">
                <img src="${document.getElementById('mainChart').toDataURL()}" class="w-full h-full object-contain">
            </div>
            <p class="text-sm text-slate-600"><strong>Analysis:</strong> ${c.results_text || 'No analysis recorded.'}</p>
            ${d.chartData.length < 10 ? `<div class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 mt-4 inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Insufficient Data (<10 points)</div>` : ''}
        </div>
    `;

    const pdsaContent = d.pdsa.map(p => `
        <div class="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
            <div class="font-bold text-slate-700 mb-1">${p.title}</div>
            <div class="text-xs text-slate-500 grid grid-cols-2 gap-2">
                <div><strong>Plan:</strong> ${p.plan}</div>
                <div><strong>Do:</strong> ${p.do}</div>
                <div><strong>Study:</strong> ${p.study}</div>
                <div><strong>Act:</strong> ${p.act}</div>
            </div>
        </div>
    `).join('');
    html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">6. PDSA Cycles</h3>
            ${pdsaContent || '<span class="italic text-slate-400 text-sm">No cycles recorded.</span>'}
            ${d.pdsa.length === 0 ? `<div class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 mt-2 inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> No Intervention Cycles</div>` : ''}
        </div>
    `;

    html += section("7. Learning & Sustainability", c.learning + "\n\n" + c.sustain);
    html += section("8. Ethics & Governance", c.ethics);
    
    html += `</div>`;
    
    container.innerHTML = html;
    lucide.createIcons();
}

function checkRCEMCriteria(d) {
    const flags = [];
    const c = d.checklist;
    
    if(!c.aim) flags.push("Missing SMART Aim.");
    else if(!c.aim.toLowerCase().includes('by')) flags.push("Aim may not be Time-bound (missing date/deadline).");

    if(d.drivers.secondary.length === 0) flags.push("Driver Diagram incomplete (no secondary drivers).");
    if(d.drivers.changes.length === 0) flags.push("No Change Ideas (Interventions) listed.");

    if(d.chartData.length === 0) flags.push("No data recorded.");
    else if(d.chartData.length < 10) flags.push("Insufficient data points for reliable SPC analysis (aim for 15+).");

    if(d.pdsa.length === 0) flags.push("No PDSA cycles recorded. QIP requires iterative testing.");

    if(!c.ethics) flags.push("Ethics & Governance section missing.");
    if(!c.sustain) flags.push("Sustainability plan missing.");

    return flags;
}

// --- HELP SYSTEM ---
const helpData = {
    checklist: { t: "Define & Measure", c: "<p class='mb-2'><b>Problem:</b> What is the gap between standard and reality?</p><p class='mb-2'><b>Aim:</b> Must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound).</p><p class='mb-2'><b>Measures:</b><br>- Outcome: The goal.<br>- Process: Are we doing the steps?<br>- Balance: Are we safe?</p>" },
    diagrams: { t: "Drivers & Fishbone", c: "<p class='mb-2'><b>Fishbone:</b> Use to find root causes. 'Why' does the problem exist?</p><p class='mb-2'><b>Driver Diagram:</b> Your strategy. Drivers are 'What' we need to change, Change Ideas are 'How' we do it.</p>" },
    data: { t: "SPC & Run Charts", c: "<p class='mb-2'><b>Run Chart:</b> Plot data over time.</p><p class='mb-2'><b>Rules:</b><br>- Shift: 6+ points on one side of median.<br>- Trend: 5+ points going up or down.</p>" },
    pdsa: { t: "PDSA Cycles", c: "<p><b>Plan:</b> Who, when, where?</p><p><b>Do:</b> Carry out the test.</p><p><b>Study:</b> Analyse data.</p><p><b>Act:</b> Adopt, Adapt, or Abandon.</p>" }
};
window.showHelp = (key) => {
    document.getElementById('help-title').textContent = helpData[key].t;
    document.getElementById('help-content').innerHTML = helpData[key].c;
    document.getElementById('help-modal').classList.remove('hidden');
};
window.openHelp = () => window.showHelp('checklist');
