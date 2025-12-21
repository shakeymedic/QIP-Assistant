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

// --- DEMO DATA (Gold Standard Sepsis Example) ---
const demoProject = {
    meta: { title: "Improving Sepsis 6 Delivery", created: new Date().toISOString() },
    checklist: {
        title: "Improving Sepsis 6 Delivery in ED",
        lead: "Dr. A. Medic",
        team: "Sr. B. Nurse (Band 7), Dr. C. Consultant (Sponsor)",
        problem_desc: "Audit showed only 45% of Red Flag Sepsis patients received Abx within 1h. This increases mortality risk.",
        evidence: "RCEM Guidelines require 100% compliance. NCEPOD 'Just Say Sepsis' mandates early Abx.",
        aim: "To increase delivery of Sepsis 6 bundle within 1 hour from 45% to 90% by March 2025.",
        outcome_measures: "Sepsis 6 Compliance % (<1h)",
        process_measures: "Time to Screening; Availability of Packs",
        balance_measures: "Time to initial assessment for non-sepsis patients (displacement)",
        ethics: "QI project only. No patient identifiable data used. Registered with Audit Dept (Ref: 1234).",
        learning: "Process mapping showed 'hunting for kit' was a major delay. Grab bags fixed this.",
        sustain: "Nurse in Charge checks grab bags daily. Monthly audit report automated.",
        ppi: "Patient liaison group reviewed the new patient information leaflet and suggested clearer language."
    },
    drivers: {
        primary: ["Identification", "Equipment", "Culture"],
        secondary: ["Triage Screening", "Access to Fluids/Abx", "Empowerment to prescribe"],
        changes: ["Sepsis Stamp", "Grab Bags", "PGD for Nurses"]
    },
    fishbone: { categories: [{ id: 1, text: "People", causes: ["Locums unaware", "Fear of error"] }, { id: 2, text: "Process", causes: ["No PGD", "Paper notes"] }, { id: 3, text: "Equipment", causes: ["Fluids locked away"] }, { id: 4, text: "Environment", causes: ["Crowded Resus"] }] },
    process: ["Arrival", "Triage (Screen +)", "Doctor Review", "Sepsis 6 Initiated"],
    pdsa: [
        { id: "1", title: "Cycle 1: Sepsis Stamp", plan: "Use stamp in notes to prompt action.", do: "Used for 1 week.", study: "Compliance rose to 60%. Ink ran out.", act: "Switch to stickers." },
        { id: "2", title: "Cycle 2: Grab Bags", plan: "Pre-fill bags to save time.", do: "Deployed 10 bags.", study: "Compliance hit 82%. Staff loved it.", act: "Adopt permanently." }
    ],
    chartData: [
        { date: "2025-01-01", value: 45, type: "outcome" }, { date: "2025-01-02", value: 42, type: "outcome" },
        { date: "2025-01-03", value: 48, type: "outcome" }, { date: "2025-01-04", value: 46, type: "outcome" },
        { date: "2025-01-05", value: 50, type: "outcome" }, { date: "2025-01-06", value: 45, type: "outcome" },
        { date: "2025-01-07", value: 65, type: "outcome", note: "PDSA 1: Stamp" },
        { date: "2025-01-08", value: 68, type: "outcome" }, { date: "2025-01-09", value: 70, type: "outcome" },
        { date: "2025-01-14", value: 82, type: "outcome", note: "PDSA 2: Bags" },
        { date: "2025-01-15", value: 85, type: "outcome" }, { date: "2025-01-16", value: 88, type: "outcome" }
    ],
    gantt: [
        { id: "1", name: "Data Collection", start: "2025-01-01", end: "2025-01-14" },
        { id: "2", name: "PDSA 1: Stamps", start: "2025-01-07", end: "2025-01-10" }
    ]
};

const emptyProject = {
    meta: { title: "New Project", created: new Date().toISOString() },
    checklist: {},
    drivers: { primary: [], secondary: [], changes: [] },
    fishbone: { categories: [{ id: 1, text: "People", causes: [] }, { id: 2, text: "Methods", causes: [] }, { id: 3, text: "Environment", causes: [] }, { id: 4, text: "Equipment", causes: [] }] },
    process: ["Start", "End"],
    pdsa: [],
    chartData: [],
    gantt: []
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
    
    if (isDemoMode) {
        // In demo mode, show just one project
        listEl.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm border-2 border-rcem-purple relative overflow-hidden cursor-pointer hover:shadow-md transition-all" onclick="window.openDemoProject()">
                 <div class="absolute top-0 right-0 bg-rcem-purple text-white text-xs px-2 py-1">Example</div>
                 <h3 class="font-bold text-lg text-slate-800 mb-1">Improving Sepsis 6 Delivery</h3>
                 <p class="text-xs text-slate-400 mb-4">Created: Today</p>
                 <div class="flex gap-2 text-xs font-medium text-slate-500">
                    <span class="bg-slate-100 px-2 py-1 rounded">12 Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded">2 Cycles</span>
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
    const title = prompt("Project Title:", "My New QIP");
    if (!title) return;
    const newProj = JSON.parse(JSON.stringify(emptyProject));
    newProj.meta.title = title;
    await addDoc(collection(db, `users/${currentUser.uid}/projects`), newProj);
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
            // Schema integrity checks
            if(!projectData.checklist) projectData.checklist = {};
            if(!projectData.drivers) projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!projectData.fishbone) projectData.fishbone = emptyProject.fishbone;
            if(!projectData.process) projectData.process = ["Start", "End"];
            if(!projectData.pdsa) projectData.pdsa = [];
            if(!projectData.gantt) projectData.gantt = [];
            
            document.getElementById('project-header-title').textContent = projectData.meta.title;
            renderAll();
        }
    });

    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

window.openDemoProject = () => {
    projectData = JSON.parse(JSON.stringify(demoProject));
    document.getElementById('project-header-title').textContent = "Demo Project";
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
    
    // Nav Highlights
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    // Trigger specific renders
    if (view === 'checklist') renderChecklist();
    if (view === 'tools') renderTools();
    if (view === 'data') renderChart();
    if (view === 'pdsa') renderPDSA();
    if (view === 'gantt') renderGantt();
    
    lucide.createIcons();
};

// --- DATA SAVING ---
async function saveData() {
    if (isDemoMode) {
        renderAll();
        return;
    }
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
    if(currentView === 'checklist') renderChecklist();
    if(currentView === 'pdsa') renderPDSA();
}

// --- 1. THE QI COACH (Logic Engine) ---
function renderCoach() {
    if(!projectData) return;
    const d = projectData;
    const banner = document.getElementById('qi-coach-banner');
    const title = document.getElementById('coach-title');
    const msg = document.getElementById('coach-msg');
    const btn = document.getElementById('coach-btn');
    
    // Logic Tree
    if (!d.checklist.aim) {
        title.textContent = "Step 1: Define your Aim";
        msg.textContent = "Every QIP starts with a clear goal. Use the SMART wizard to define what you want to achieve.";
        btn.innerHTML = 'Build SMART Aim <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        btn.onclick = () => { window.router('checklist'); document.getElementById('smart-modal').classList.remove('hidden'); };
        banner.className = "bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500";
    } else if (d.drivers.secondary.length === 0) {
        title.textContent = "Step 2: Diagnose the Issue";
        msg.textContent = "You have an aim, but how will you get there? Create a Driver Diagram to map your strategy.";
        btn.innerHTML = 'Go to Drivers <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        btn.onclick = () => window.router('tools');
        banner.className = "bg-gradient-to-r from-blue-600 to-cyan-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500";
    } else if (d.chartData.length < 5) {
        title.textContent = "Step 3: Establish Baseline";
        msg.textContent = "Before changing anything, measure the current performance. Collect at least 10-15 data points for an SPC baseline.";
        btn.innerHTML = 'Add Data <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        btn.onclick = () => window.router('data');
        banner.className = "bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500";
    } else if (d.pdsa.length === 0) {
        title.textContent = "Step 4: Time to Act";
        msg.textContent = "You have a baseline. Now pick a Change Idea from your Driver Diagram and run a PDSA cycle.";
        btn.innerHTML = 'Start PDSA <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        btn.onclick = () => window.router('pdsa');
        banner.className = "bg-gradient-to-r from-emerald-600 to-green-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500";
    } else {
        title.textContent = "Project Active";
        msg.textContent = "Great work! Continue collecting data to show sustained improvement. Consider your sustainability plan.";
        btn.innerHTML = 'Review Data <i data-lucide="arrow-right" class="w-4 h-4"></i>';
        btn.onclick = () => window.router('data');
        banner.className = "bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500";
    }
    lucide.createIcons();

    // Dashboard Stats
    const totalFields = 12; // Approximation of key fields
    const filledFields = Object.values(d.checklist).filter(v=>v).length;
    document.getElementById('stat-progress').textContent = Math.min(100, Math.round((filledFields / totalFields)*100)) + "%";
    document.getElementById('stat-pdsa').textContent = d.pdsa.length;
    document.getElementById('stat-data').textContent = d.chartData.length;
    document.getElementById('stat-drivers').textContent = d.drivers.changes.length;
    document.getElementById('dash-aim-display').textContent = d.checklist.aim || "No aim defined yet.";
}

// --- 2. CHECKLIST & WIZARD ---
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
}

// SMART Wizard Logic
const smartInputs = ['sa-verb', 'sa-metric', 'sa-pop', 'sa-val', 'sa-date'];
smartInputs.forEach(id => document.getElementById(id).addEventListener('input', updateSmartPreview));
function updateSmartPreview() {
    const txt = `To ${document.getElementById('sa-verb').value} ${document.getElementById('sa-metric').value || '...'} for ${document.getElementById('sa-pop').value || '...'} ${document.getElementById('sa-val').value || '...'} by ${document.getElementById('sa-date').value || '...'}.`;
    document.getElementById('sa-preview').textContent = txt;
}
window.saveSmartAim = () => {
    projectData.checklist.aim = document.getElementById('sa-preview').textContent;
    saveData();
    document.getElementById('smart-modal').classList.add('hidden');
    renderChecklist();
};

// --- 3. DIAGRAMS & TOOLS ---
let toolMode = 'fishbone';
window.setToolMode = (m) => {
    toolMode = m;
    document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-rcem-purple'));
    document.getElementById(`tab-${m}`).classList.add('bg-white', 'shadow-sm', 'text-rcem-purple');
    renderTools();
};

async function renderTools() {
    if(!projectData) return;
    const canvas = document.getElementById('diagram-canvas');
    const controls = document.getElementById('tool-controls');
    let mCode = '';
    let ctrls = '';

    if (toolMode === 'fishbone') {
        const cats = projectData.fishbone.categories;
        const titleSafe = projectData.meta.title.replace(/[^a-zA-Z0-9]/g, '_') || "Problem";
        mCode = `mindmap\n  root((${titleSafe}))\n` + cats.map(c => `    ${c.text}\n` + c.causes.map(x => `      ${x}`).join('\n')).join('\n');
        ctrls = cats.map(c => `<button onclick="window.addCause(${c.id})" class="whitespace-nowrap px-3 py-1 bg-white border border-slate-200 rounded text-xs hover:bg-slate-50 font-medium text-slate-700 shadow-sm">+ ${c.text}</button>`).join('');
    } else if (toolMode === 'driver') {
        const d = projectData.drivers;
        mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${x}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${x}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${x}"]\n`);
        ctrls = `<button onclick="window.addDriver('primary')" class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold border border-emerald-200">+ Primary Driver</button>
                 <button onclick="window.addDriver('secondary')" class="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold border border-blue-200">+ Secondary Driver</button>
                 <button onclick="window.addDriver('changes')" class="px-3 py-1 bg-purple-100 text-purple-800 rounded text-xs font-bold border border-purple-200">+ Change Idea</button>`;
    } else if (toolMode === 'process') {
        const p = projectData.process;
        mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${x}"] --> n${i+1}["${p[i+1]}"]` : `  n${i}["${x}"]`).join('\n');
        ctrls = `<button onclick="window.addStep()" class="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium shadow-sm hover:bg-slate-50">+ Add Step</button> <button onclick="window.resetProcess()" class="px-3 py-1 text-red-500 text-xs ml-auto">Reset</button>`;
    }

    // Only re-render if code changed (to stop flicker)
    if (canvas.dataset.code !== mCode) {
        canvas.innerHTML = `<div class="mermaid opacity-0 transition-opacity duration-300" id="mermaid-render">${mCode}</div>`;
        canvas.dataset.code = mCode;
        try { 
            await mermaid.run(); 
            document.getElementById('mermaid-render').classList.remove('opacity-0');
        } catch(e) { console.error(e); }
    }
    controls.innerHTML = ctrls;
    setupPanZoom();
}

// Diagram Actions
window.addCause = (id) => { const v=prompt("Cause:"); if(v){projectData.fishbone.categories.find(c=>c.id===id).causes.push(v); saveData(); renderTools();} }
window.addDriver = (t) => { const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} }
window.addStep = () => { const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} }
window.resetProcess = () => { if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} }

// Pan/Zoom Logic
let scale = 1, pX = 0, pY = 0;
function setupPanZoom() {
    const wrap = document.getElementById('diagram-wrapper');
    const canvas = document.getElementById('diagram-canvas');
    let isDown = false, startX, startY;

    wrap.onmousedown = (e) => { isDown = true; startX = e.clientX - pX; startY = e.clientY - pY; wrap.classList.add('cursor-grabbing'); };
    window.onmouseup = () => { isDown = false; wrap.classList.remove('cursor-grabbing'); };
    wrap.onmousemove = (e) => { if(!isDown) return; e.preventDefault(); pX = e.clientX - startX; pY = e.clientY - startY; updateTransform(); };
    wrap.onwheel = (e) => { e.preventDefault(); scale += e.deltaY * -0.001; scale = Math.min(Math.max(.5, scale), 4); updateTransform(); };
}
function updateTransform() { document.getElementById('diagram-canvas').style.transform = `translate(${pX}px, ${pY}px) scale(${scale})`; }
window.resetZoom = () => { scale=1; pX=0; pY=0; updateTransform(); };

// --- 4. CHARTING & SPC LOGIC ---
function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const ghost = document.getElementById('chart-ghost');
    const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));

    // Ghost State
    if (data.length === 0) { ghost.classList.remove('hidden'); return; }
    ghost.classList.add('hidden');

    const outcomes = data.filter(d => d.type === 'outcome' || !d.type);
    const values = outcomes.map(d => Number(d.value));
    const labels = outcomes.map(d => d.date);
    
    // SPC Logic: Calculate Median
    const median = values.length ? values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)] : 0;
    
    // SPC Rules: Highlight special cause (6 points one side of median)
    const pointColors = values.map((v, i) => {
        // Simple shift rule: if 6 in a row above median, highlight green
        // Note: Real SPC is more complex, but this is a good educational approximation
        let isRun = false;
        if (i >= 5) {
            const subset = values.slice(i-5, i+1);
            if (subset.every(x => x > median)) isRun = true;
        }
        return isRun ? '#059669' : '#2d2e83'; // Emerald vs Purple
    });

    if (chartInstance) chartInstance.destroy();
    
    // Annotations (PDSAs)
    const annotations = {
        median: { type: 'line', yMin: median, yMax: median, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2, label: { display: true, content: 'Median', position: 'end' } }
    };
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Outcome Measure',
                data: values,
                borderColor: '#2d2e83',
                backgroundColor: pointColors,
                pointBackgroundColor: pointColors,
                pointRadius: 6,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { annotation: { annotations } }
        }
    });

    // History List
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

// --- 5. PDSA Logic ---
function renderPDSA() {
    if(!projectData) return;
    document.getElementById('pdsa-container').innerHTML = projectData.pdsa.map((p,i) => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-all hover:shadow-md">
            <div class="flex justify-between items-center mb-4">
                <div class="font-bold text-lg text-slate-800">${p.title}</div>
                <button onclick="window.deletePDSA(${i})" class="text-slate-400 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div class="text-xs font-bold text-blue-800 uppercase mb-1">Plan</div>
                    <textarea onchange="projectData.pdsa[${i}].plan=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="3" placeholder="What are you testing?">${p.plan}</textarea>
                </div>
                <div class="bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <div class="text-xs font-bold text-orange-800 uppercase mb-1">Do</div>
                    <textarea onchange="projectData.pdsa[${i}].do=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="3" placeholder="What happened?">${p.do}</textarea>
                </div>
                <div class="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <div class="text-xs font-bold text-purple-800 uppercase mb-1">Study</div>
                    <textarea onchange="projectData.pdsa[${i}].study=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="3" placeholder="What did the data show?">${p.study}</textarea>
                </div>
                <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <div class="text-xs font-bold text-emerald-800 uppercase mb-1">Act</div>
                    <textarea onchange="projectData.pdsa[${i}].act=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="3" placeholder="Adopt, Adapt, or Abandon?">${p.act}</textarea>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.addPDSA = () => {
    const t = prompt("Cycle Title (e.g. Cycle 1: Sticker):");
    if(t) { projectData.pdsa.unshift({id: Date.now(), title:t, plan:"", do:"", study:"", act:""}); saveData(); renderPDSA(); }
}
window.deletePDSA = (i) => {
    if(confirm("Delete this cycle?")) { projectData.pdsa.splice(i,1); saveData(); renderPDSA(); }
}

// --- 6. EXPORTS (GOLD STANDARD) ---
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
        { t: "Results & Analysis", v: `Baseline data showed... \nRun Chart analysis demonstrates... \n[Insert analysis here]` },
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

window.printPoster = () => {
    // Inject Poster HTML
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
                    <p class="caption"><b>Outcome Measure:</b> ${d.checklist.outcome_measures}</p>
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

// --- Gantt Logic ---
function renderGantt() {
    if(!projectData) return;
    const g = projectData.gantt || [];
    document.getElementById('gantt-container').innerHTML = g.length ? g.map(t => `
        <div class="flex items-center gap-4 mb-2 p-2 bg-slate-50 rounded border border-slate-100">
            <div class="w-1/3 font-bold text-sm">${t.name}</div>
            <div class="flex-1 bg-slate-200 h-4 rounded overflow-hidden relative">
                 <div class="absolute bg-rcem-purple h-full opacity-70" style="left: 0; width: 100%"></div> 
                 <span class="absolute inset-0 text-[10px] text-center text-white flex items-center justify-center">${t.start} - ${t.end}</span>
            </div>
            <button onclick="deleteGantt('${t.id}')" class="text-slate-400 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    `).join('') : '<p class="text-center text-slate-400">No tasks defined.</p>';
    lucide.createIcons();
}
window.addGanttTask = () => {
    const n = prompt("Task Name:");
    if(n) { 
        if(!projectData.gantt) projectData.gantt=[];
        projectData.gantt.push({id:Date.now(), name:n, start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0]}); 
        saveData(); renderGantt(); 
    }
}
window.deleteGantt = (id) => { projectData.gantt = projectData.gantt.filter(x=>x.id!=id); saveData(); renderGantt(); }

// --- Placeholders ---
window.calcGreen = () => {
    const v = document.getElementById('green-type').value;
    const q = document.getElementById('green-qty').value;
    const r = document.getElementById('green-res');
    r.textContent = `Total CO2e Saved: ${(v*q).toFixed(2)} kg`;
    r.classList.remove('hidden');
}
