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
let zoomLevel = 2.0; 

// --- TEMPLATES ---
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
    
    if (isDemoMode) {
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
            <div class="opacity-50 pointer-events-none grayscale bg-white p-6 rounded-xl border border-slate-200 border-dashed">
                <h3 class="font-bold text-lg text-slate-400 mb-1">Pain Scoring in Triage</h3>
                <p class="text-xs text-slate-400 mb-4">Example Project 2</p>
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
            if(!projectData.gantt) projectData.gantt = [];
            
            document.getElementById('project-header-title').textContent = projectData.meta.title;
            renderAll();
        }
    });

    document.getElementById('top-bar').classList.remove('hidden');
    window.router('dashboard');
};

window.openDemoProject = () => {
    projectData = {
        meta: { 
            title: "Improving Sepsis 6 Delivery in ED", 
            created: "2024-01-10T09:00:00.000Z" 
        },
        checklist: { 
            problem_desc: "Audit data (Q4 2023) showed only 55% of 'Red Flag' sepsis patients received antibiotics within 60 minutes of arrival. Delays increase mortality risk by 7.6% per hour (Kumar et al).",
            evidence: "RCEM Sepsis Standards (2023); NICE NG51; Surviving Sepsis Campaign.",
            aim: "To increase the % of eligible sepsis patients receiving IV antibiotics within 60 minutes of arrival from 55% to 95% by 1st July 2024.",
            outcome_measures: "% of patients receiving antibiotics < 60 mins.",
            process_measures: "Screening tool completion rate; Door-to-needle time.",
            balance_measures: "Antibiotic stewardship (total consumption); C. Difficile rates.",
            team: "Dr. J Bloggs (Lead), Sr. M. Smith (Nursing Lead), Dr. X (Consultant Sponsor).",
            ethics: "Registered with Trust Audit Dept (Ref: QIP-2024-055). No ethical approval required (service evaluation).",
            ppi: "Discussed with Patient Liaison Group (PLG). Poster displayed in waiting room inviting feedback.",
            learning: "Success was driven by automation (IT alerts) rather than education alone. Human factors (accessibility of equipment) were critical.",
            sustain: "Sepsis Lead Nurse appointed to monitor monthly data. IT Alert is permanent. Annual audit scheduled.",
            results_text: "The Run Chart shows a clear 'Shift' (8 points above the median) following PDSA Cycle 2 (Sepsis Trolleys). This improvement was sustained and further stabilised by PDSA Cycle 3 (IT Alerts), reaching a new median of 92%."
        },
        drivers: { 
            primary: ["Early Recognition", "Equipment Availability", "Safety Culture"], 
            secondary: ["Triage Screening", "Access to Antibiotics", "Feedback Loops", "Staff Education"], 
            changes: ["Mandatory Sepsis Screen", "Sepsis Grab Bags", "Dedicated Trolley", "IT Best Practice Alert"] 
        },
        fishbone: { 
            categories: [
                { id: 1, text: "People", causes: ["Reliance on Agency Staff", "Lack of ownership", "Fear of prescribing"] }, 
                { id: 2, text: "Methods", causes: ["Paper screening tool lost", "No PGD for nurses", "Complex pathway"] }, 
                { id: 3, text: "Environment", causes: ["Overcrowding", "Distance to drug cupboard", "No dedicated space"] }, 
                { id: 4, text: "Equipment", causes: ["Cannulas missing", "Antibiotic keys missing", "Computers slow"] }
            ] 
        },
        pdsa: [
            { id: 1705000000000, title: "Cycle 1: Education Campaign", plan: "Deliver 10-min teaching at handover for 2 weeks. Put up posters.", do: "Teaching delivered to 80% of nursing staff. Posters displayed in Resus.", study: "Compliance rose slightly to 62% but effect wore off quickly. Staff reported 'forgetting' in busy periods.", act: "Abandon (as sole intervention). Need system change, not just education." },
            { id: 1708000000000, title: "Cycle 2: Sepsis Trolley", plan: "Introduce a dedicated 'Sepsis Trolley' in Majors with pre-made grab bags (bloods, cultures, abx).", do: "Trolley stocked and placed in Bay 1. Checked daily by HCA.", study: "Immediate improvement. Time to cannulation dropped. Staff feedback positive ('saves hunting for keys').", act: "Adopt. Roll out to Resus area as well." },
            { id: 1712000000000, title: "Cycle 3: Electronic Alert", plan: "IT modification: 'Pop-up' alert on Cerner when NEWS2 > 5 + Infection suspected.", do: "Live on April 1st. Required clinician reason to dismiss.", study: "Compliance hit 95%. Screening tool completion 100%.", act: "Adopt. Standard operating procedure." }
        ],
        chartData: [
            { date: "2024-01-07", value: 52, type: "outcome" }, { date: "2024-01-14", value: 58, type: "outcome" }, { date: "2024-01-21", value: 45, type: "outcome" }, { date: "2024-01-28", value: 55, type: "outcome" }, { date: "2024-02-04", value: 50, type: "outcome" }, { date: "2024-02-11", value: 60, type: "outcome" },
            { date: "2024-02-18", value: 65, type: "outcome", note: "Cycle 1: Education" }, { date: "2024-02-25", value: 62, type: "outcome" }, { date: "2024-03-03", value: 58, type: "outcome" },
            { date: "2024-03-10", value: 75, type: "outcome", note: "Cycle 2: Trolleys" }, { date: "2024-03-17", value: 82, type: "outcome" }, { date: "2024-03-24", value: 79, type: "outcome" }, { date: "2024-03-31", value: 85, type: "outcome" },
            { date: "2024-04-07", value: 92, type: "outcome", note: "Cycle 3: IT Alert" }, { date: "2024-04-14", value: 95, type: "outcome" }, { date: "2024-04-21", value: 94, type: "outcome" }, { date: "2024-04-28", value: 91, type: "outcome" }, { date: "2024-05-05", value: 96, type: "outcome" }, { date: "2024-05-12", value: 93, type: "outcome" }, { date: "2024-05-19", value: 95, type: "outcome" }, { date: "2024-05-26", value: 94, type: "outcome" }
        ],
        stakeholders: [
            { name: "ED Consultants", power: 90, interest: 80 }, { name: "Nursing Staff", power: 60, interest: 90 }, { name: "Pharmacy", power: 40, interest: 70 }, { name: "Junior Doctors", power: 30, interest: 85 }, { name: "Hospital Mgmt", power: 80, interest: 20 }
        ],
        gantt: [
            { id: 1, name: "Planning & Stakeholders", start: "2024-01-01", end: "2024-01-20", type: "plan" }, { id: 2, name: "Baseline Data Audit", start: "2024-01-15", end: "2024-02-14", type: "study" }, { id: 3, name: "Driver Diagram Workshop", start: "2024-02-10", end: "2024-02-15", type: "plan" }, { id: 4, name: "Cycle 1: Education", start: "2024-02-16", end: "2024-03-01", type: "act" }, { id: 5, name: "Cycle 2: Sepsis Trolley", start: "2024-03-05", end: "2024-04-01", type: "act" }, { id: 6, name: "Cycle 3: IT Alert Build", start: "2024-03-01", end: "2024-04-01", type: "plan" }, { id: 7, name: "Cycle 3: IT Alert Go-Live", start: "2024-04-01", end: "2024-05-15", type: "act" }, { id: 8, name: "Sustainability Audit", start: "2024-05-15", end: "2024-06-01", type: "study" }, { id: 9, name: "Write Up & Presentation", start: "2024-06-01", end: "2024-06-15", type: "plan" }
        ],
        process: ["Patient Arrives", "Triage (Nurse)", "Sepsis Screen +ve?", "Yes -> Trigger Alert", "Doctor Review", "Abx Prescribed", "Abx Administered"]
    };

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
    if (unsubscribeProject) unsubscribeProject();
    loadProjectList();
};

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
};

async function saveData() {
    if (isDemoMode) { renderAll(); return; }
    if (!currentProjectId) return;
    await setDoc(doc(db, `users/${currentUser.uid}/projects`, currentProjectId), projectData, { merge: true });
    
    const s = document.getElementById('save-status');
    s.classList.remove('opacity-0');
    setTimeout(() => s.classList.add('opacity-0'), 2000);
}

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

function renderCoach() {
    if(!projectData) return;
    const d = projectData;
    const banner = document.getElementById('qi-coach-banner');
    
    const checkFields = ['problem_desc','evidence','aim','outcome_measures','process_measures','team','ethics','learning'];
    let filledCount = 0;
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
        status = { t: "Step 1: Define your Aim", m: "A project without an aim is just a hobby.", b: "Build SMART Aim", a: () => { window.router('checklist'); document.getElementById('smart-modal').classList.remove('hidden'); }, c: "from-purple-600 to-indigo-700" };
    } else {
        status = { t: "Project Active", m: "Keep measuring. Look for 'Shifts' (6 points above median).", b: "Review Data", a: () => window.router('data'), c: "from-slate-700 to-slate-800" };
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
    
    document.getElementById('stat-pdsa').textContent = d.pdsa.length;
    document.getElementById('stat-data').textContent = d.chartData.length;
    document.getElementById('stat-drivers').textContent = d.drivers.changes.length;
    document.getElementById('dash-aim-display').textContent = d.checklist.aim || "No aim defined yet.";
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
                        <textarea onchange="projectData.checklist['${f.k}']=this.value;saveData()" class="w-full rounded border-slate-300 p-2 text-sm focus:ring-2 focus:ring-rcem-purple outline-none transition-shadow" rows="2" placeholder="${f.p}">${projectData.checklist[f.k]||''}</textarea>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
    
    window.saveSmartAim = () => {
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
        
        ctrls = cats.map(c => `<button onclick="window.addCauseWithWhys(${c.id})" class="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> ${c.text}</button>`).join('');
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
    updateZoom(); 
    try { await mermaid.run(); } catch(e) {}
    lucide.createIcons();
}

window.addCauseWithWhys = (id) => {
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
window.addDriver = (t) => { const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} }
window.addStep = () => { const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} }
window.resetProcess = () => { if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} }

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
    saveData(); renderStakeholders();
};

function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (data.length === 0) { document.getElementById('chart-ghost').classList.remove('hidden'); if(chartInstance) chartInstance.destroy(); return; }
    document.getElementById('chart-ghost').classList.add('hidden');

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

    if (chartInstance) chartInstance.destroy();
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2, label: { display: true, content: 'Median', position: 'end' } }
    };
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Outcome Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 6, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations } }, onClick: (e, activeEls) => { if (activeEls.length > 0) { const i = activeEls[0].index; const note = prompt(`Annotate:`, data[i].note || ""); if (note !== null) { data[i].note = note; saveData(); renderChart(); } } } }
    });
    
    document.getElementById('data-history').innerHTML = data.slice().reverse().map(d => `<div class="flex justify-between border-b border-slate-100 py-2 items-center"><span><span class="font-mono text-xs text-slate-400 mr-2">${d.date}</span> <strong>${d.value}</strong></span>${d.note ? `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">${d.note}</span>` : ''}</div>`).join('');
}

window.addDataPoint = () => {
    const d = { date: document.getElementById('chart-date').value, value: document.getElementById('chart-value').value, type: document.getElementById('chart-cat').value };
    if (d.date && d.value) { projectData.chartData.push(d); saveData(); renderChart(); }
};
window.saveResults = (val) => { if(!projectData.checklist) projectData.checklist={}; projectData.checklist.results_text = val; saveData(); }

window.addPDSA = () => { const t = prompt("Cycle Title:"); if(t) { projectData.pdsa.unshift({id: Date.now(), title:t, plan:"", do:"", study:"", act:""}); saveData(); renderPDSA(); } }
function renderPDSA() {
    if(!projectData) return;
    const container = document.getElementById('pdsa-container');
    if (projectData.pdsa.length === 0) { container.innerHTML = `<div class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50"><button onclick="window.addPDSA()" class="bg-rcem-purple text-white px-4 py-2 rounded">Start Cycle 1</button></div>`; return; }
    container.innerHTML = projectData.pdsa.map((p,i) => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-4"><div class="font-bold text-lg text-slate-800">${p.title}</div><button onclick="window.deletePDSA(${i})" class="text-slate-400 hover:text-red-500"><i data-lucide="trash-2"></i></button></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-3 rounded"><div class="text-xs font-bold text-blue-800 uppercase">Plan</div><textarea onchange="projectData.pdsa[${i}].plan=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.plan}</textarea></div>
                <div class="bg-orange-50 p-3 rounded"><div class="text-xs font-bold text-orange-800 uppercase">Do</div><textarea onchange="projectData.pdsa[${i}].do=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.do}</textarea></div>
                <div class="bg-purple-50 p-3 rounded"><div class="text-xs font-bold text-purple-800 uppercase">Study</div><textarea onchange="projectData.pdsa[${i}].study=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.study}</textarea></div>
                <div class="bg-emerald-50 p-3 rounded"><div class="text-xs font-bold text-emerald-800 uppercase">Act</div><textarea onchange="projectData.pdsa[${i}].act=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${p.act}</textarea></div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.deletePDSA = (i) => { if(confirm("Delete?")) { projectData.pdsa.splice(i,1); saveData(); renderPDSA(); } }

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
    document.getElementById('risr-content').innerHTML = fields.map(f => `<div class="bg-white p-4 rounded border border-slate-200 shadow-sm"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide">${f.t}</h4><button class="text-xs text-rcem-purple font-bold hover:underline" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copy</button></div><div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap font-mono text-slate-600 select-all border border-slate-100">${f.v || 'Not recorded'}</div></div>`).join('');
};

// --- ROBUST ASSET GENERATOR (FAIL-SAFE) ---
async function getVisualAsset(type) {
    if (!projectData) return null;

    if (type === 'chart') {
        // Create an off-screen canvas to generate the chart from data
        const canvas = document.createElement('canvas');
        canvas.width = 1200; // High resolution
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
        if(data.length === 0) return null;

        const outcomes = data.filter(d => d.type === 'outcome' || !d.type);
        const values = outcomes.map(d => Number(d.value));
        const labels = outcomes.map(d => d.date);
        
        // Basic Median Logic
        let baselinePoints = values.slice(0, 12); 
        let currentMedian = baselinePoints.length ? baselinePoints.sort((a,b)=>a-b)[Math.floor(baselinePoints.length/2)] : 0;
        
        // Basic Color Logic
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

        // Render Chart to hidden canvas
        new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Outcome Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 8, tension: 0.1, borderWidth: 3 }] },
            options: { 
                animation: false, // Instant render
                responsive: false, 
                plugins: { 
                    annotation: { annotations },
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
        
        return canvas.toDataURL('image/png', 1.0);
    }

    if (type === 'driver') {
        // Generate Driver Diagram SVGs from data
        const tempId = 'temp-mermaid-' + Date.now();
        const el = document.createElement('div');
        el.id = tempId;
        el.style.position = 'absolute';
        el.style.left = '-9999px'; // Hide off-screen
        el.style.width = '1200px';
        document.body.appendChild(el);
        
        const d = projectData.drivers;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        let mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        
        if(d.primary.length === 0) mCode += ` P --> P1[No Drivers Yet]`;
        
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
        
        try {
            const { svg: svgString } = await mermaid.render(tempId + 'svg', mCode);
            el.innerHTML = svgString;
            const svg = el.querySelector('svg');
            
            if (!svg) return null;

            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);

            return new Promise(resolve => {
                img.onload = () => {
                    canvas.width = img.width * 2; // 2x Scaling
                    canvas.height = img.height * 2;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    document.body.removeChild(el); // Clean up
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => { document.body.removeChild(el); resolve(null); };
                img.src = url;
            });
        } catch (e) {
            console.error("Mermaid Render Error", e);
            if(el.parentNode) document.body.removeChild(el);
            return null;
        }
    }
    return null;
}

// --- FEATURE 1: GOLD STANDARD POWERPOINT EXPORT ---
window.exportPPTX = async () => {
    try {
        if (!projectData) { alert("Please load a project first."); return; }
        const d = projectData;
        const pres = new PptxGenJS();

        // 1. Branding Constants
        const RCEM_NAVY = '2d2e83';
        const RCEM_ORANGE = 'f36f21';

        // 2. Define Master Slide (Theme)
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

        // --- SLIDE 1: TITLE ---
        const s1 = pres.addSlide({ masterName: 'RCEM_MASTER' });
        s1.addText(d.meta.title, { x: 1, y: 2, w: 8, fontSize: 36, bold: true, color: RCEM_NAVY, align: 'center' });
        s1.addText(d.checklist.team || "QIP Team", { x: 1, y: 3.5, w: 8, fontSize: 18, color: '64748b', align: 'center' });
        s1.addText(`Generated: ${new Date().toLocaleDateString()}`, { x: 1, y: 4, w: 8, fontSize: 12, color: '94a3b8', align: 'center' });

        // --- SLIDE 2: THE PROBLEM ---
        const s2 = addSlide('The Problem & Aim');
        s2.addText('Problem Definition', { x: 0.5, y: 1.2, fontSize: 14, bold: true, color: '475569' });
        s2.addText(d.checklist.problem_desc || "No problem defined.", { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 14, color: '334155', fill: 'F8FAFC' });
        
        s2.addText('SMART Aim', { x: 0.5, y: 3.0, fontSize: 14, bold: true, color: '475569' });
        s2.addText(d.checklist.aim || "No aim defined.", { x: 0.5, y: 3.3, w: 9, h: 1, fontSize: 16, color: RCEM_NAVY, italic: true, fill: 'EFF6FF', border: { color: 'BFDBFE' } });

        // --- SLIDE 3: DRIVER DIAGRAM ---
        const s3 = addSlide('Driver Diagram (Strategy)');
        const driverImg = await getVisualAsset('driver');
        if (driverImg) {
            s3.addImage({ data: driverImg, x: 0.5, y: 1.2, w: 9, h: 3.8, sizing: { type: 'contain' } });
        } else {
            s3.addText("[Driver Diagram Not Available]", { x: 3, y: 2.5 });
        }

        // --- SLIDE 4: INTERVENTIONS ---
        const s4 = addSlide('PDSA Cycles & Interventions');
        const rows = [['Cycle', 'Plan / Intervention', 'Outcome / Act']];
        d.pdsa.forEach(p => {
            rows.push([p.title, p.plan, `Study: ${p.study}\nAct: ${p.act}`]);
        });
        
        s4.addTable(rows, {
            x: 0.5, y: 1.2, w: 9,
            colW: [2, 3.5, 3.5],
            border: { pt: 1, color: 'e2e8f0' },
            fill: { color: 'F1F5F9' },
            headerStyles: { fill: RCEM_NAVY, color: 'FFFFFF', bold: true },
            fontSize: 10
        });

        // --- SLIDE 5: RESULTS ---
        const s5 = addSlide('Results & Analysis');
        const chartImg = await getVisualAsset('chart');
        if (chartImg) {
            s5.addImage({ data: chartImg, x: 0.5, y: 1.2, w: 5.5, h: 3.5, sizing: { type: 'contain' } });
        }
        s5.addText("Interpretation:", { x: 6.2, y: 1.2, fontSize: 12, bold: true });
        s5.addText(d.checklist.results_text || "No analysis recorded.", { 
            x: 6.2, y: 1.5, w: 3.3, h: 3.2, 
            fontSize: 11, color: '334155', valign: 'top', 
            fill: 'F8FAFC', border: { color: 'E2E8F0' } 
        });

        // --- SLIDE 6: CONCLUSIONS ---
        const s6 = addSlide('Learning & Sustainability');
        s6.addText('Key Learning Points', { x: 0.5, y: 1.2, fontSize: 14, bold: true, color: '15803d' }); 
        s6.addText(d.checklist.learning || "Not recorded.", { x: 0.5, y: 1.5, w: 4.2, h: 3, fontSize: 12, fill: 'F0FDF4' });

        s6.addText('Sustainability Plan', { x: 5.0, y: 1.2, fontSize: 14, bold: true, color: '1e40af' }); 
        s6.addText(d.checklist.sustain || "Not recorded.", { x: 5.0, y: 1.5, w: 4.5, h: 3, fontSize: 12, fill: 'EFF6FF' });

        pres.writeFile({ fileName: `RCEM_QIP_${d.meta.title.replace(/[^a-z0-9]/gi, '_')}.pptx` });

    } catch (e) {
        console.error(e);
        alert("Error generating PowerPoint: " + e.message);
    }
};

// --- FEATURE 2: CONFERENCE POSTER PRINTING ---
window.printPoster = async () => {
    try {
        if (!projectData) { alert("Please load a project first."); return; }
        const d = projectData;
        const container = document.getElementById('print-container');
        
        // Load Assets
        const driverImg = await getVisualAsset('driver');
        const chartImg = await getVisualAsset('chart');

        container.innerHTML = `
            <div class="poster-grid">
                <header class="poster-header">
                    <div class="poster-logo-area">
                        <img src="https://iili.io/KGQOvkl.md.png" class="poster-logo" alt="RCEM Logo">
                    </div>
                    <div class="poster-title-area">
                        <h1>${d.meta.title}</h1>
                        <p><strong>Team:</strong> ${d.checklist.team || 'Unspecified'}</p>
                    </div>
                </header>

                <div class="poster-col">
                    <div class="poster-box">
                        <h2><i data-lucide="alert-circle" style="width:24px; vertical-align:middle"></i> The Problem</h2>
                        <p>${d.checklist.problem_desc || 'No problem defined.'}</p>
                        <p><strong>Evidence:</strong> ${d.checklist.evidence || 'N/A'}</p>
                    </div>
                    
                    <div class="poster-box aim-box">
                        <h2><i data-lucide="target" style="width:24px; vertical-align:middle"></i> SMART Aim</h2>
                        <p class="aim-statement">${d.checklist.aim || 'No aim defined.'}</p>
                    </div>

                    <div class="poster-box">
                        <h2><i data-lucide="git-branch" style="width:24px; vertical-align:middle"></i> Driver Diagram</h2>
                        <div class="driver-holder">
                            ${driverImg ? `<img src="${driverImg}" class="img-fluid">` : '<p class="text-slate-400 italic">No diagram generated.</p>'}
                        </div>
                    </div>
                </div>

                <div class="poster-col">
                    <div class="poster-box" style="flex:1">
                        <h2><i data-lucide="line-chart" style="width:24px; vertical-align:middle"></i> Results</h2>
                        <div class="chart-holder">
                            ${chartImg ? `<img src="${chartImg}" class="img-fluid">` : '<p>No data available.</p>'}
                        </div>
                        <div class="analysis-box">
                            <h3 style="font-weight:bold; margin-bottom:10px; color:#2d2e83">Analysis</h3>
                            <p>${d.checklist.results_text || 'No analysis text provided.'}</p>
                        </div>
                    </div>
                </div>

                <div class="poster-col">
                    <div class="poster-box">
                        <h2><i data-lucide="refresh-cw" style="width:24px; vertical-align:middle"></i> Interventions</h2>
                        <ul>
                            ${d.pdsa.map(p => `
                                <li>
                                    <strong>${p.title}</strong><br>
                                    <span style="font-size:14px; opacity:0.8">${p.do}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>

                    <div class="poster-box">
                        <h2><i data-lucide="lightbulb" style="width:24px; vertical-align:middle"></i> Learning</h2>
                        <p>${d.checklist.learning || 'N/A'}</p>
                    </div>

                    <div class="poster-box sustain-box">
                        <h2><i data-lucide="leaf" style="width:24px; vertical-align:middle"></i> Sustainability</h2>
                        <p>${d.checklist.sustain || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        setTimeout(() => { window.print(); }, 500);

    } catch (e) {
        console.error(e);
        alert("Error generating Poster: " + e.message);
    }
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
                    ${t.name}
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

function renderFullProject() {
    if(!projectData) return;
    const d = projectData;
    const c = d.checklist;
    const container = document.getElementById('full-project-container');
    const flags = checkRCEMCriteria(d);
    
    let html = '';
    if(flags.length > 0) {
        html += `<div class="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 rounded shadow-sm"><div class="flex items-center gap-2 mb-2"><i data-lucide="alert-triangle" class="text-amber-600"></i><h3 class="font-bold text-amber-900">Action Points</h3></div><ul class="list-disc list-inside text-sm text-amber-800 space-y-1">${flags.map(f => `<li>${f}</li>`).join('')}</ul></div>`;
    } else {
        html += `<div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-8 rounded shadow-sm flex items-center gap-3"><i data-lucide="check-circle-2" class="text-emerald-600 w-6 h-6"></i><div><h3 class="font-bold text-emerald-900">RCEM Gold Standard Met</h3><p class="text-xs text-emerald-700">Excellent work!</p></div></div>`;
    }

    const section = (title, content, validationKey) => {
        const isMissing = !content || (Array.isArray(content) && content.length === 0);
        return `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">${title}</h3><div class="text-slate-600 text-sm whitespace-pre-wrap">${content || '<span class="italic text-slate-400">Not recorded</span>'}</div>${isMissing ? `<div class="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 mt-2 inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Missing</div>` : ''}</div>`;
    };

    html += `<div class="space-y-6">`;
    html += section("1. Problem & Reason", c.problem_desc);
    html += section("2. Evidence & Guidelines", c.evidence);
    html += section("3. SMART Aim", c.aim);
    html += `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">4. Driver Diagram Summary</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><h4 class="font-bold text-xs uppercase text-slate-500 mb-2">Primary Drivers</h4><ul class="list-disc list-inside text-sm text-slate-700">${d.drivers.primary.map(x=>`<li>${x}</li>`).join('')}</ul></div><div><h4 class="font-bold text-xs uppercase text-slate-500 mb-2">Changes</h4><ul class="list-disc list-inside text-sm text-slate-700">${d.drivers.changes.map(x=>`<li>${x}</li>`).join('')}</ul></div></div></div>`;
    html += `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">5. Data & Results</h3><div class="h-64 relative mb-4"><img src="${document.getElementById('mainChart').toDataURL()}" class="w-full h-full object-contain"></div><p class="text-sm text-slate-600"><strong>Analysis:</strong> ${c.results_text}</p></div>`;
    html += `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 class="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">6. PDSA Cycles</h3>${d.pdsa.map(p => `<div class="mb-4 p-3 bg-slate-50 rounded border border-slate-200"><div class="font-bold text-slate-700 mb-1">${p.title}</div><div class="text-xs text-slate-500 grid grid-cols-2 gap-2"><div>Plan: ${p.plan}</div><div>Do: ${p.do}</div><div>Study: ${p.study}</div><div>Act: ${p.act}</div></div></div>`).join('')}</div>`;
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
    if(d.drivers.secondary.length === 0) flags.push("Driver Diagram incomplete.");
    if(d.chartData.length < 10) flags.push("Insufficient data (<10 points).");
    if(d.pdsa.length === 0) flags.push("No PDSA cycles.");
    if(!c.ethics) flags.push("Ethics missing.");
    return flags;
}

const helpData = {
    checklist: { t: "Define & Measure", c: "<p>Problem, Aim (SMART), and Measures.</p>" },
    diagrams: { t: "Drivers & Fishbone", c: "<p>Fishbone = Root Cause. Drivers = Strategy.</p>" },
    data: { t: "SPC & Run Charts", c: "<p>Look for Shifts (6+ points) and Trends (5+ points).</p>" },
    pdsa: { t: "PDSA Cycles", c: "<p>Plan, Do, Study, Act.</p>" }
};
window.showHelp = (key) => {
    document.getElementById('help-title').textContent = helpData[key].t;
    document.getElementById('help-content').innerHTML = helpData[key].c;
    document.getElementById('help-modal').classList.remove('hidden');
};
window.openHelp = () => window.showHelp('checklist');
