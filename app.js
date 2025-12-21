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

// --- DEMO DATA (Significantly Expanded) ---
const demoProject = {
    meta: { title: "Improving Sepsis 6 Delivery in ED", created: new Date().toISOString() },
    checklist: {
        title: "Improving Sepsis 6 Delivery in ED",
        lead: "Dr. A. Medic",
        team: "Sr. B. Nurse (Band 7), Dr. C. Consultant (Sponsor), Mr. D. Pharmacist",
        problem_desc: "Sepsis is a time-critical condition with high mortality. National data suggests every hour of delay in antibiotic administration increases mortality by 7.6%. \n\nLocal audit data (Oct-Dec 2024, n=50) revealed that only 45% of patients meeting 'Red Flag' sepsis criteria received the full Sepsis 6 bundle within 1 hour of arrival. The average time to antibiotics was 95 minutes. This represents a significant quality gap compared to the RCEM standard of 100%.",
        evidence: "1. RCEM Clinical Standard for Sepsis (2023): '100% of patients with red flag sepsis should receive antibiotics within 1 hour.'\n2. NCEPOD 'Just Say Sepsis' Report (2015): Highlights early recognition as key failure point.\n3. NICE NG51: Mandates rapid delivery of care bundle.",
        aim: "To increase the percentage of adult patients (age >18) with Red Flag Sepsis receiving the full Sepsis 6 bundle within 60 minutes of arrival from a baseline of 45% to 90% by 1st March 2025.",
        outcome_measures: "Primary: % of Red Flag Sepsis patients receiving Sepsis 6 within 1h.",
        process_measures: "1. Time from arrival to screening (minutes).\n2. % of notes with Sepsis Stamp completed.\n3. Availability of Sepsis Grab Bags in Resus (daily check).",
        balance_measures: "1. Time to initial assessment for non-sepsis patients (displacement effect).\n2. Rate of inappropriate antibiotic prescribing (reviews by Micro).",
        ethics: "Registered as a Quality Improvement Project with the Trust Audit Department (Ref: QIP-25-101). No patient identifiable data collected on this platform. Data is aggregate only.",
        learning: "The main barrier identified was 'Cognitive Load' and 'Access to Equipment'. Staff knew *what* to do, but gathering the equipment took too long (avg 12 mins). Creating pre-filled 'Grab Bags' reduced this to 2 mins.\n\nKey Lesson: Make the right thing the easiest thing to do.",
        sustain: "Sustainability relies on embedding the process. The 'Grab Bags' are now part of the daily HCA stock check. The Sepsis screening prompt has been added to the electronic triage system (Cerner) to replace the paper stamp.",
        ppi: "We held a focus group with the Patient Liaison Group. They reviewed the patient information leaflet and suggested changing 'Lactate' to 'Blood Acid Level' for clarity, which we adopted.",
        results_text: "The Run Chart shows a clear improvement. \n\nBaseline (Points 1-6): Performance was variable with a median of 45%.\n\nIntervention 1 (Stamps): Resulted in a small increase but no sustained shift.\n\nIntervention 2 (Grab Bags): This created a 'Step Change'. We observe a run of 6 consecutive points above the median, indicating a statistically significant shift. The new process median is approx 85%."
    },
    drivers: {
        primary: ["Early Identification", "Rapid Equipment Access", "Staff Culture & Empowerment"],
        secondary: ["Reliable Triage Screening", "Availability of Antibiotics/Fluids", "Nurse Prescribing (PGD)", "Feedback to Staff"],
        changes: ["Sepsis Stamp in Notes", "Pre-filled 'Grab Bags'", "Sepsis Trolley in Majors", "Weekly Data Dashboard in Coffee Room"]
    },
    fishbone: { categories: [{ id: 1, text: "People", causes: ["Junior doctors rotating often", "Fear of prescribing wrong dose", "Nurses not empowered to cannulate"] }, { id: 2, text: "Process", causes: ["Screening tool buried in notes", "Wait for blood results before Abx", "No PGD for fluids"] }, { id: 3, text: "Equipment", causes: ["Fluids locked in different room", "Blood culture bottles out of stock", "No dedicated trolley"] }, { id: 4, text: "Environment", causes: ["Overcrowding in ED", "Lack of cubicle space", "IT system slow"] }] },
    process: ["Patient Arrives", "Triage Nurse Screens", "Positive Flag?", "Doctor Bleeped", "Cannulation & Cultures", "Antibiotics Prescribed", "Antibiotics Administered"],
    pdsa: [
        { id: "1", title: "Cycle 1: Sepsis Stamp", plan: "Test if a visual prompt in notes increases screening. \nWho: Triage Nurses. \nWhen: 1 week.", do: "Rubber stamp used on all notes. \nProblem: Ink pad dried out on Day 3.", study: "Data showed screening rose from 40% to 60%, but fell back when ink ran out. Staff liked the prompt but hated the mess.", act: "ABANDON stamp. Move to stickers or digital prompt." },
        { id: "2", title: "Cycle 2: Sepsis Grab Bags", plan: "Reduce time looking for kit. \nWho: Charge Nurse to stock. \nWhat: Bag containing blood bottles, cannula, giving set, saline.", do: "10 bags created and placed in Resus. Used for 2 weeks.", study: "Time to cannulation dropped by 10 mins. Staff feedback excellent: 'Saved my life during a busy shift'.", act: "ADOPT. Roll out to Majors and Triage." },
        { id: "3", title: "Cycle 3: Digital Screen", plan: "Embed screening in IT system.", do: "IT dept updated triage form.", study: "Screening hit 95%. Hard stop added.", act: "SUSTAIN. Standard practice." }
    ],
    chartData: [
        { date: "2025-01-01", value: 45, type: "outcome" }, { date: "2025-01-02", value: 42, type: "outcome" },
        { date: "2025-01-03", value: 48, type: "outcome" }, { date: "2025-01-04", value: 46, type: "outcome" },
        { date: "2025-01-05", value: 50, type: "outcome" }, { date: "2025-01-06", value: 45, type: "outcome" },
        { date: "2025-01-07", value: 65, type: "outcome", note: "PDSA 1: Stamp" },
        { date: "2025-01-08", value: 68, type: "outcome" }, { date: "2025-01-09", value: 70, type: "outcome" },
        { date: "2025-01-14", value: 82, type: "outcome", note: "PDSA 2: Bags" },
        { date: "2025-01-15", value: 85, type: "outcome" }, { date: "2025-01-16", value: 88, type: "outcome" },
        { date: "2025-01-17", value: 89, type: "outcome" }, { date: "2025-01-18", value: 92, type: "outcome" },
        { date: "2025-01-19", value: 86, type: "outcome" }
    ],
    gantt: [
        { id: "1", name: "Project Setup & Registration", start: "2024-12-01", end: "2024-12-10" },
        { id: "2", name: "Baseline Audit (n=50)", start: "2024-12-11", end: "2024-12-31" },
        { id: "3", name: "Driver Diagram Workshop", start: "2025-01-02", end: "2025-01-03" },
        { id: "4", name: "PDSA 1: Stamps", start: "2025-01-05", end: "2025-01-12" },
        { id: "5", name: "PDSA 2: Grab Bags", start: "2025-01-14", end: "2025-01-28" },
        { id: "6", name: "Sustainability Planning", start: "2025-02-01", end: "2025-02-14" },
        { id: "7", name: "Final Report & Poster", start: "2025-02-15", end: "2025-03-01" }
    ]
};

const emptyProject = {
    meta: { title: "New Project", created: new Date().toISOString() },
    checklist: { results_text: "" },
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
    if (view === 'full') renderFullProject();
    
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
    if(currentView === 'gantt') renderGantt();
    if(currentView === 'full') renderFullProject();
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
const toolInfo = {
    fishbone: {
        title: "Fishbone (Ishikawa) Diagram",
        subtitle: "Root Cause Analysis",
        desc: "A Fishbone diagram helps you explore the underlying causes of a problem, rather than just the symptoms. It structures your brainstorming into categories (People, Process, Equipment, Environment).",
        how: "Start with the problem on the right. Ask 'Why is this happening?' for each category. Keep asking 'Why?' (The 5 Whys) until you reach a root cause that you can actually change.",
        tip: "Useful at the very start of a project before you decide on solutions."
    },
    driver: {
        title: "Driver Diagram",
        subtitle: "Theory of Change",
        desc: "The Driver Diagram connects your Aim to your Actions. It visualises your strategy on one page.",
        how: "<b>Primary Drivers:</b> Big topics that influence the aim directly (e.g. 'Staff Knowledge').<br><b>Secondary Drivers:</b> Specific components of the primary drivers (e.g. 'Training sessions').<br><b>Change Ideas:</b> The specific interventions you will test (e.g. 'Weekly simulation training').",
        tip: "This should be your project's roadmap."
    },
    process: {
        title: "Process Map",
        subtitle: "Workflow Visualisation",
        desc: "A Process Map lays out the steps of the current patient journey or workflow. It highlights bottlenecks, duplication, or safety gaps.",
        how: "Map the 'As-Is' process (how it actually happens, not how it's written in policy). Walk the floor and observe.",
        tip: "Look for steps that add no value and try to remove them."
    }
};

window.setToolMode = (m) => {
    toolMode = m;
    document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-rcem-purple'));
    document.getElementById(`tab-${m}`).classList.add('bg-white', 'shadow-sm', 'text-rcem-purple');
    renderTools();
};

async function renderTools() {
    // 1. Inject Explainer
    const info = toolInfo[toolMode];
    document.getElementById('tool-explainer').innerHTML = `
        <h2 class="text-xl font-bold text-indigo-900 mb-1 flex items-center gap-2"><i data-lucide="info" class="w-5 h-5"></i> ${info.title} <span class="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded uppercase">${info.subtitle}</span></h2>
        <p class="text-indigo-800 mb-3 text-sm leading-relaxed">${info.desc}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div class="bg-white p-3 rounded border border-indigo-100"><strong class="block text-indigo-600 mb-1">How to make it:</strong> ${info.how}</div>
            <div class="bg-white p-3 rounded border border-indigo-100"><strong class="block text-indigo-600 mb-1">Top Tip:</strong> ${info.tip}</div>
        </div>
    `;
    
    // 2. Render Diagram
    if(!projectData) return;
    const canvas = document.getElementById('diagram-canvas');
    const controls = document.getElementById('tool-controls');
    const ghost = document.getElementById('diagram-ghost');
    const ghostTitle = document.getElementById('ghost-title');
    const ghostMsg = document.getElementById('ghost-msg');
    
    let mCode = '';
    let ctrls = '';
    let isEmpty = false;

    if (toolMode === 'fishbone') {
        const cats = projectData.fishbone.categories;
        const titleSafe = projectData.meta.title.replace(/[^a-zA-Z0-9]/g, '_') || "Problem";
        mCode = `mindmap\n  root((${titleSafe}))\n` + cats.map(c => `    ${c.text}\n` + c.causes.map(x => `      ${x}`).join('\n')).join('\n');
        
        // Buttons
        const colors = ['bg-rose-100 text-rose-800 border-rose-200', 'bg-blue-100 text-blue-800 border-blue-200', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-amber-100 text-amber-800 border-amber-200'];
        ctrls = cats.map((c, i) => `
            <button onclick="window.addCause(${c.id})" class="whitespace-nowrap px-4 py-2 ${colors[i%4]} border rounded-lg text-sm font-bold shadow-sm hover:brightness-95 flex items-center gap-2">
                <i data-lucide="plus" class="w-4 h-4"></i> ${c.text}
            </button>
        `).join('');
        
        isEmpty = cats.every(c => c.causes.length === 0);
        ghostTitle.innerText = "Empty Fishbone";
        ghostMsg.innerText = "Use this diagram to brainstorm root causes. Ask 'Why' is this happening?";

    } else if (toolMode === 'driver') {
        const d = projectData.drivers;
        mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${x}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${x}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${x}"]\n`);
        
        ctrls = `
            <button onclick="window.addDriver('primary')" class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200 shadow-sm flex items-center gap-2 hover:bg-emerald-200"><i data-lucide="plus-circle" class="w-4 h-4"></i> Primary Driver</button>
            <button onclick="window.addDriver('secondary')" class="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-bold border border-blue-200 shadow-sm flex items-center gap-2 hover:bg-blue-200"><i data-lucide="plus-circle" class="w-4 h-4"></i> Secondary Driver</button>
            <button onclick="window.addDriver('changes')" class="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold border border-purple-200 shadow-sm flex items-center gap-2 hover:bg-purple-200"><i data-lucide="lightbulb" class="w-4 h-4"></i> Change Idea</button>
        `;
        isEmpty = d.primary.length === 0 && d.secondary.length === 0 && d.changes.length === 0;
        ghostTitle.innerText = "Start Your Strategy";
        ghostMsg.innerText = "Map out your theory of change. Drivers are 'What' you need to influence, Change Ideas are 'How' you do it.";

    } else if (toolMode === 'process') {
        const p = projectData.process;
        mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${x}"] --> n${i+1}["${p[i+1]}"]` : `  n${i}["${x}"]`).join('\n');
        
        ctrls = `
            <button onclick="window.addStep()" class="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4 text-slate-600"></i> Add Step</button>
            <div class="w-px h-6 bg-slate-300 mx-2"></div>
            <button onclick="window.resetProcess()" class="px-4 py-2 text-red-500 text-sm font-medium hover:bg-red-50 rounded-lg flex items-center gap-2"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reset</button>
        `;
        isEmpty = p.length <= 2;
        ghostTitle.innerText = "Map the Process";
        ghostMsg.innerText = "Visualise the patient journey or current workflow step-by-step.";
    }

    // Render Mermaid
    if (canvas.dataset.code !== mCode) {
        canvas.innerHTML = `<div class="mermaid opacity-0 transition-opacity duration-300" id="mermaid-render">${mCode}</div>`;
        canvas.dataset.code = mCode;
        try { 
            await mermaid.run(); 
            document.getElementById('mermaid-render').classList.remove('opacity-0');
        } catch(e) { console.error(e); }
    }
    
    // Render Controls & Ghost
    controls.innerHTML = ctrls;
    if(isEmpty) {
        ghost.classList.remove('hidden');
    } else {
        ghost.classList.add('hidden');
    }
    
    lucide.createIcons();
    setupPanZoom();
}

// Diagram Actions
window.addCause = (id) => { const v=prompt("Cause:"); if(v){projectData.fishbone.categories.find(c=>c.id===id).causes.push(v); saveData(); renderTools();} }
window.addDriver = (t) => { const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} }
window.addStep = () => { const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} }
window.resetProcess = () => { if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} }

// Pan/Zoom Logic
let scale = 1.3, pX = 0, pY = 0; // Default scale increased to 1.3
function setupPanZoom() {
    const wrap = document.getElementById('diagram-wrapper');
    const canvas = document.getElementById('diagram-canvas');
    let isDown = false, startX, startY;

    wrap.onmousedown = (e) => { isDown = true; startX = e.clientX - pX; startY = e.clientY - pY; wrap.classList.add('cursor-grabbing'); };
    window.onmouseup = () => { isDown = false; wrap.classList.remove('cursor-grabbing'); };
    wrap.onmousemove = (e) => { if(!isDown) return; e.preventDefault(); pX = e.clientX - startX; pY = e.clientY - startY; updateTransform(); };
    wrap.onwheel = (e) => { e.preventDefault(); scale += e.deltaY * -0.001; scale = Math.min(Math.max(.5, scale), 4); updateTransform(); };
    
    // Init transform on first load
    updateTransform();
}
function updateTransform() { document.getElementById('diagram-canvas').style.transform = `translate(${pX}px, ${pY}px) scale(${scale})`; }
window.resetZoom = () => { scale=1.3; pX=0; pY=0; updateTransform(); };
window.zoomIn = () => { scale = Math.min(scale + 0.2, 4); updateTransform(); };
window.zoomOut = () => { scale = Math.max(scale - 0.2, 0.5); updateTransform(); };

// --- 4. CHARTING & SPC LOGIC ---
function renderChart() {
    if(!projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const ghost = document.getElementById('chart-ghost');
    const resultsTxt = document.getElementById('results-text');
    const data = projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));

    // Populate results text
    if(projectData.checklist && projectData.checklist.results_text) {
        resultsTxt.value = projectData.checklist.results_text;
    }

    // Ghost State
    if (data.length === 0) { 
        ghost.classList.remove('hidden'); 
        if(chartInstance) { chartInstance.destroy(); chartInstance = null; }
        document.getElementById('data-history').innerHTML = '<p class="text-xs text-slate-400 italic">No data history available.</p>';
        return; 
    }
    ghost.classList.add('hidden');

    const outcomes = data.filter(d => d.type === 'outcome' || !d.type);
    const values = outcomes.map(d => Number(d.value));
    const labels = outcomes.map(d => d.date);
    
    // SPC Logic: Calculate Median
    const median = values.length ? values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)] : 0;
    
    // SPC Rules
    const pointColors = values.map((v, i) => {
        let isRun = false;
        if (i >= 5) {
            const subset = values.slice(i-5, i+1);
            if (subset.every(x => x > median)) isRun = true;
        }
        return isRun ? '#059669' : '#2d2e83'; // Emerald vs Purple
    });

    if (chartInstance) chartInstance.destroy();
    
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

window.saveResults = (val) => {
    if(!projectData.checklist) projectData.checklist = {};
    projectData.checklist.results_text = val;
    saveData();
}

// --- 5. PDSA Logic ---
function renderPDSA() {
    if(!projectData) return;
    const container = document.getElementById('pdsa-container');
    
    if (projectData.pdsa.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <div class="bg-purple-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-purple-600">
                    <i data-lucide="refresh-cw" class="w-8 h-8"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-700">No Cycles Yet</h3>
                <p class="text-slate-400 text-sm mb-6 max-w-sm mx-auto">Start your first Plan-Do-Study-Act cycle to test a change idea.</p>
                <button onclick="window.addPDSA()" class="bg-rcem-purple text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-900 transition-all">Start Cycle 1</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = projectData.pdsa.map((p,i) => `
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

// --- GANTT CHART (Proper Timeline) ---
function renderGantt() {
    if(!projectData) return;
    const g = projectData.gantt || [];
    const container = document.getElementById('gantt-container');
    
    if (g.length === 0) {
        container.innerHTML = `<div class="text-center py-12"><button onclick="window.addGanttTask()" class="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold">Add First Task</button></div>`;
        return;
    }

    // 1. Calculate Grid Dates
    const dates = g.flatMap(t => [new Date(t.start), new Date(t.end)]);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 7); // Buffer
    maxDate.setDate(maxDate.getDate() + 7);

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((maxDate - minDate) / dayMs);
    const pxPerDay = 30; // Width of one day column
    
    // 2. Build Header
    let gridHTML = `<div class="gantt-grid" style="grid-template-columns: 200px repeat(${totalDays}, ${pxPerDay}px); width: ${200 + (totalDays * pxPerDay)}px">`;
    
    // Header Row
    gridHTML += `<div class="gantt-header sticky left-0 bg-white z-20 border-r border-slate-200">Task Name</div>`;
    for(let i=0; i<totalDays; i+=7) { // Show weekly headers
        const d = new Date(minDate.getTime() + (i * dayMs));
        gridHTML += `<div class="gantt-header" style="grid-column: span 7; text-align: left; padding-left: 5px;">${d.toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>`;
    }

    // 3. Build Rows
    g.forEach(t => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        const offsetDays = Math.floor((start - minDate) / dayMs);
        const durationDays = Math.ceil((end - start) / dayMs) || 1;
        
        // Row Label
        gridHTML += `<div class="gantt-row sticky left-0 bg-white z-10 border-r border-slate-200 flex items-center px-4 text-sm font-medium text-slate-700 truncate" title="${t.name}">
            ${t.name} <button onclick="deleteGantt('${t.id}')" class="ml-auto text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`;
        
        // Row Bar Container
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

// --- CALCULATORS (Separated) ---
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
    
    // 1. Validation Logic
    const flags = checkRCEMCriteria(d);
    
    // 2. Build HTML
    let html = '';

    // Validator Banner
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

    // Sections Helper
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
    
    // Drivers
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

    // Chart
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

    // PDSA
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
