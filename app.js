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
    window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
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

// 1. SIGN IN (Triggered by the 'Sign In' button or pressing Enter)
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // Success is handled by the onAuthStateChanged listener automatically
    } catch (error) {
        console.error("Login error:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             alert("Incorrect email or password.");
        } else if (error.code === 'auth/too-many-requests') {
             alert("Too many failed attempts. Please try again later.");
        } else {
             alert("Login failed: " + error.message);
        }
    }
});

// 2. REGISTER (Triggered only by clicking the 'Register' button)
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (!email || !pass) {
        alert("Please enter an email and password to register.");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        alert("Account created successfully!");
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already registered. Please Sign In instead.");
        } else if (error.code === 'auth/weak-password') {
            alert("Password is too weak. It should be at least 6 characters.");
        } else {
            alert("Registration failed: " + error.message);
        }
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
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 40 Data Points</span>
                    <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 4 Cycles</span>
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

// --- MASSIVE DEMO DATA ---
window.openDemoProject = () => {
    const demoData = JSON.parse(JSON.stringify(emptyProject));
    demoData.meta.title = "Improving Sepsis 6 Delivery in ED";
    demoData.meta.created = new Date().toISOString();
    
    demoData.checklist = {
        problem_desc: "A baseline audit of 50 patients (Oct-Dec 2023) presenting with 'Red Flag' sepsis revealed that only 42% received the complete Sepsis 6 bundle within 1 hour of arrival. \n\nDelayed antibiotic administration in sepsis increases mortality by 7.6% per hour (Kumar et al., 2006). This performance is significantly below the RCEM quality standard (90%).",
        evidence: "1. RCEM Sepsis Quality Improvement Guide (2023)\n2. NICE NG51: Sepsis: recognition, diagnosis and early management\n3. Surviving Sepsis Campaign Guidelines",
        aim: "To increase the percentage of eligible 'Red Flag' sepsis patients receiving IV antibiotics within 60 minutes of arrival from 42% to 90% by 1st August 2024.",
        outcome_measures: "Percentage of Red Flag Sepsis patients receiving IV antibiotics < 60 mins from arrival.",
        process_measures: "1. Time from arrival to Triage.\n2. Percentage of patients with 'Sepsis Screen' completed at Triage.\n3. Time from medical review to antibiotic prescription.",
        balance_measures: "1. Rate of C. Difficile infections (Antibiotic stewardship).\n2. Percentage of patients triggered as 'Sepsis' who did not have infection (False positives).",
        team: "Project Lead: Dr. J. Bloggs (ST4)\nSponsor: Dr. A. Consultant (Sepsis Lead)\nNursing Lead: Sr. M. Smith\nPharmacist: P. Jones",
        ethics: "Registered with Trust Clinical Audit Department (Ref: QIP-24-055). This project is a service evaluation against national standards and does not require Research Ethics Committee approval.",
        ppi: "The project plan was presented to the Patient Liaison Group (PLG). They highlighted that 'waiting for a doctor' was a key frustration. We incorporated this feedback by empowering nurses to cannulate immediately via PGD.",
        learning: "The biggest barrier was not knowledge, but 'cognitive load'. Staff knew *what* to do, but the environment made it hard. \n\nThe 'Sepsis Trolley' (Cycle 2) worked because it reduced the friction of finding equipment. \n\nThe IT Alert (Cycle 3) was the most effective intervention because it functioned as a 'forcing function', preventing the doctor from closing the file without addressing the sepsis risk.",
        sustain: "1. The IT Alert is now a permanent feature of the EPR.\n2. Sepsis Trolley checklist added to HCA daily duties.\n3. Monthly data reporting automated to the governance dashboard.",
        results_text: "The Run Chart demonstrates a robust improvement.\n\n- Baseline median was 42%.\n- Following Cycle 2 (Trolleys), a 'Shift' occurred (6 points above median), indicating a non-random improvement.\n- Cycle 3 (IT Alert) pushed compliance to >90% consistently.\n- The new median is established at 92%.\n- Special cause variation is evident and sustained."
    };

    demoData.drivers = { 
        primary: ["Early Recognition", "Equipment Availability", "Safety Culture", "Efficient Pathways"], 
        secondary: ["Triage Screening Accuracy", "Nursing Empowerment", "Access to Antibiotics", "Feedback Loops"], 
        changes: ["Mandatory Sepsis Screen at Triage", "Sepsis Grab Bags in Resus", "Dedicated Sepsis Trolley", "PGD for Nurse Initiation", "IT Best Practice Alert", "Daily Safety Huddle Feedback"] 
    };

    demoData.fishbone = { 
        categories: [
            { id: 1, text: "People", causes: ["Reliance on Agency Staff", "Lack of ownership", "Fear of prescribing broad spectrum", "Junior doctor rotation turnover"] }, 
            { id: 2, text: "Methods", causes: ["Paper screening tool often lost", "No PGD for nurses (must wait for doctor)", "Complex pathway for blood cultures"] }, 
            { id: 3, text: "Environment", causes: ["Overcrowding in Majors", "Distance to drug cupboard", "No dedicated space for septic patients", "Poor lighting in triage"] }, 
            { id: 4, text: "Equipment", causes: ["Cannulas missing from trolleys", "Antibiotic cupboard keys missing", "Computers slow to load", "Blood culture bottles expired"] }
        ] 
    };
    
    demoData.process = [
        "Patient Arrives in ED", 
        "Triage Assessment (15 mins)", 
        "Sepsis Screening Tool Applied", 
        "Red Flag Sepsis Triggered?", 
        "Medical Review (Immediate)", 
        "Sepsis 6 Bundle Initiated", 
        "IV Antibiotics Administered", 
        "Transfer to Ward/ICU"
    ];

    demoData.pdsa = [
        {id: 1, title: "Cycle 1: Education", plan: "Deliver 10-min teaching at handover for 2 weeks. Display posters in staff room.", do: "Teaching delivered to 80% of nursing staff. Posters up.", study: "Compliance rose slightly to 48% but effect wore off quickly. Staff reported 'forgetting' in busy periods.", act: "Abandon as sole intervention. Education is necessary but not sufficient.", isStepChange: false},
        {id: 2, title: "Cycle 2: Sepsis Trolley", plan: "Introduce a bright yellow 'Sepsis Trolley' in Majors containing everything needed (bloods, cultures, fluids, abx).", do: "Trolley stocked and placed in Bay 1. Checked daily by HCA.", study: "Immediate improvement. Time to cannulation dropped by 15 mins. Staff feedback positive ('saves hunting for keys').", act: "Adopt. Roll out to Resus area as well.", isStepChange: true},
        {id: 3, title: "Cycle 3: PGD & Nurse Empowerment", plan: "Introduce Patient Group Direction (PGD) allowing Band 6 nurses to give first dose antibiotics.", do: "Approved by Pharmacy committee. Training rolled out.", study: "Mixed results. Some nurses confident, others reluctant. Process measure improved but variation remained.", act: "Adapt. focus on 'Sepsis Champions' on each shift.", isStepChange: false},
        {id: 4, title: "Cycle 4: Electronic Alert", plan: "IT modification: 'Pop-up' alert on Cerner when NEWS2 > 5 + Infection suspected.", do: "Live on April 1st. Required clinician reason to dismiss.", study: "Compliance hit 95%. Screening tool completion 100%.", act: "Adopt. Standard operating procedure.", isStepChange: true}
    ];

    demoData.chartData = [
        {date:"2023-10-01", value:40, type:'outcome'}, {date:"2023-10-08", value:45, type:'outcome'}, {date:"2023-10-15", value:35, type:'outcome'},
        {date:"2023-10-22", value:50, type:'outcome'}, {date:"2023-10-29", value:42, type:'outcome'}, {date:"2023-11-05", value:38, type:'outcome'},
        {date:"2023-11-12", value:48, type:'outcome'}, {date:"2023-11-19", value:41, type:'outcome'}, {date:"2023-11-26", value:44, type:'outcome'},
        {date:"2023-12-03", value:55, type:'outcome', note:"Cycle 1: Education"}, {date:"2023-12-10", value:52, type:'outcome'}, {date:"2023-12-17", value:45, type:'outcome'},
        {date:"2024-01-07", value:65, type:'outcome', note:"Cycle 2: Trolleys"}, {date:"2024-01-14", value:72, type:'outcome'}, {date:"2024-01-21", value:68, type:'outcome'},
        {date:"2024-01-28", value:75, type:'outcome'}, {date:"2024-02-04", value:70, type:'outcome'}, {date:"2024-02-11", value:78, type:'outcome'},
        {date:"2024-02-18", value:76, type:'outcome', note:"Cycle 3: PGD"}, {date:"2024-02-25", value:80, type:'outcome'}, {date:"2024-03-03", value:75, type:'outcome'},
        {date:"2024-03-10", value:92, type:'outcome', note:"Cycle 4: IT Alert"}, {date:"2024-03-17", value:95, type:'outcome'}, {date:"2024-03-24", value:94, type:'outcome'},
        {date:"2024-03-31", value:91, type:'outcome'}, {date:"2024-04-07", value:96, type:'outcome'}, {date:"2024-04-14", value:93, type:'outcome'},
        {date:"2024-04-21", value:95, type:'outcome'}, {date:"2024-04-28", value:94, type:'outcome'}, {date:"2024-05-05", value:97, type:'outcome'}
    ];

    demoData.stakeholders = [
        { name: "ED Consultants", power: 90, interest: 80 }, 
        { name: "Nursing Staff", power: 60, interest: 90 },
        { name: "Junior Doctors", power: 30, interest: 85 },
        { name: "Hospital Mgmt", power: 80, interest: 20 },
        { name: "Pharmacy", power: 50, interest: 60 }
    ];

    demoData.gantt = [
        { id: 1, name: "Planning & Stakeholders", start: "2023-09-01", end: "2023-09-30", type: "plan" },
        { id: 2, name: "Baseline Data Collection", start: "2023-10-01", end: "2023-11-30", type: "study" },
        { id: 3, name: "Driver Diagram Workshop", start: "2023-11-15", end: "2023-11-20", type: "plan" },
        { id: 4, name: "Cycle 1: Education", start: "2023-12-01", end: "2023-12-20", type: "act" },
        { id: 5, name: "Cycle 2: Sepsis Trolleys", start: "2024-01-05", end: "2024-02-01", type: "act" },
        { id: 6, name: "Cycle 4: IT Alert Go-Live", start: "2024-03-01", end: "2024-05-01", type: "act" },
        { id: 7, name: "Write Up & Presentation", start: "2024-05-01", end: "2024-06-01", type: "plan" }
    ];
    
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
};

window.returnToProjects = () => {
    currentProjectId = null;
    projectData = null;
    isReadOnly = false;
    document.getElementById('readonly-indicator').classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    
    if (unsubscribeProject) unsubscribeProject();
    loadProjectList();
};

let currentView = 'dashboard';
window.router = (view) => {
    if (view !== 'projects' && !projectData) {
        alert("Please select a project from the list first.");
        return;
    }

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

window.shareProject = () => {
    if(isDemoMode) { alert("Cannot share demo projects."); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${currentProjectId}&uid=${currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => alert("Read-only link copied to clipboard!"));
};

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
window.addDriver = (t) => { if(isReadOnly) return; const v=prompt("Driver:"); if(v){projectData.drivers[t].push(v); saveData(); renderTools();} };
window.addStep = () => { if(isReadOnly) return; const v=prompt("Step Description:"); if(v){projectData.process.push(v); saveData(); renderTools();} };
window.resetProcess = () => { if(isReadOnly) return; if(confirm("Start over?")){projectData.process=["Start","End"]; saveData(); renderTools();} };

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
    
    const data = [...projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if (data.length === 0) { 
        document.getElementById('chart-ghost').classList.remove('hidden'); 
        if(chartInstance) chartInstance.destroy(); 
        return; 
    }
    document.getElementById('chart-ghost').classList.add('hidden');

    const values = data.map(d => Number(d.value));
    const labels = data.map(d => d.date);
    
    let baselinePoints = values.slice(0, 12); 
    let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
    let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
    
    const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83'));

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
        const sortedData = [...projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
        const itemToDelete = sortedData[index];
        const originalIndex = projectData.chartData.findIndex(d => d.date === itemToDelete.date && d.value === itemToDelete.value);
        if (originalIndex !== -1) {
            projectData.chartData.splice(originalIndex, 1);
        }
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

const helpData = {
    checklist: {
        t: "RCEM QIP Checklist Guide",
        c: `<div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 class="font-bold text-blue-800 mb-2">Problem & Evidence</h4>
                <p class="text-sm text-blue-700">Clearly define the gap between current practice and the desired standard. Reference RCEM, NICE, or local guidelines.</p>
            </div>
            <div class="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h4 class="font-bold text-amber-800 mb-2">SMART Aim</h4>
                <p class="text-sm text-amber-700"><strong>S</strong>pecific, <strong>M</strong>easurable, <strong>A</strong>chievable, <strong>R</strong>elevant, <strong>T</strong>ime-bound.</p>
            </div>
            <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <h4 class="font-bold text-emerald-800 mb-2">Measures</h4>
                <ul class="text-sm text-emerald-700 list-disc pl-4 space-y-1">
                    <li><strong>Outcome:</strong> Your primary aim metric</li>
                    <li><strong>Process:</strong> Are staff following the steps?</li>
                    <li><strong>Balancing:</strong> Safety/unintended consequences</li>
                </ul>
            </div>
        </div>`
    },
    data: {
        t: "SPC Chart Guide",
        c: `<div class="space-y-4">
            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 class="font-bold text-slate-800 mb-2">What is SPC?</h4>
                <p class="text-sm text-slate-700">Statistical Process Control helps distinguish between random variation and true improvement.</p>
            </div>
            <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <h4 class="font-bold text-emerald-800 mb-2">Detecting a Shift</h4>
                <p class="text-sm text-emerald-700"><strong>6 or more consecutive points</strong> on one side of the median indicates a significant shift.</p>
            </div>
        </div>`
    },
    pdsa: {
        t: "PDSA Cycle Guide",
        c: `<div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 class="font-bold text-blue-800 mb-2">Plan</h4>
                <p class="text-sm text-blue-700">What change will you test? Who, what, when, where?</p>
            </div>
            <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 class="font-bold text-orange-800 mb-2">Do</h4>
                <p class="text-sm text-orange-700">Carry out the test on a small scale. Document what happened.</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 class="font-bold text-purple-800 mb-2">Study</h4>
                <p class="text-sm text-purple-700">Analyse the results. Did it work?</p>
            </div>
            <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <h4 class="font-bold text-emerald-800 mb-2">Act</h4>
                <p class="text-sm text-emerald-700">Adopt, Adapt, or Abandon.</p>
            </div>
        </div>`
    }
};

window.deletePDSA = (i) => { if(isReadOnly) return; if(confirm("Delete?")) { projectData.pdsa.splice(i,1); saveData(); renderPDSA(); } };

window.saveResults = (val) => { if(isReadOnly) return; if(!projectData.checklist) projectData.checklist={}; projectData.checklist.results_text = val; saveData(); };
window.showHelp = (key) => { document.getElementById('help-title').textContent = helpData[key].t; document.getElementById('help-content').innerHTML = helpData[key].c; document.getElementById('help-modal').classList.remove('hidden'); };
window.openHelp = () => window.showHelp('checklist');

window.calcGreen = () => {
    const v = document.getElementById('green-type').value;
    const q = document.getElementById('green-qty').value;
    document.getElementById('green-res').innerHTML = `<span class="text-2xl text-emerald-600">${(v*q).toFixed(2)} kg</span> CO2e`;
    document.getElementById('green-res').classList.remove('hidden');
};
window.calcMoney = () => {
    const unit = parseFloat(document.getElementById('money-unit').value) || 0;
    const qty = parseFloat(document.getElementById('money-qty').value) || 0;
    document.getElementById('money-res').innerHTML = `<span class="text-2xl text-emerald-600">£${(unit * qty).toFixed(2)}</span> total saved`;
    document.getElementById('money-res').classList.remove('hidden');
};
window.calcTime = () => {
    const unit = parseFloat(document.getElementById('time-unit').value) || 0;
    const qty = parseFloat(document.getElementById('time-qty').value) || 0;
    const total = unit * qty;
    document.getElementById('time-res').innerHTML = `<span class="text-2xl text-blue-600">${Math.floor(total/60)}h ${total%60}m</span> total saved`;
    document.getElementById('time-res').classList.remove('hidden');
};
window.calcEdu = () => {
    const pre = parseFloat(document.getElementById('edu-pre').value) || 0;
    const post = parseFloat(document.getElementById('edu-post').value) || 0;
    const n = parseFloat(document.getElementById('edu-n').value) || 1;
    document.getElementById('edu-res').innerHTML = `Confidence improved by <span class="text-2xl text-indigo-600">${(((post - pre) / pre) * 100).toFixed(0)}%</span> across ${n} staff members.`;
    document.getElementById('edu-res').classList.remove('hidden');
};

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
};
window.deleteGantt = (id) => { projectData.gantt = projectData.gantt.filter(x=>x.id!=id); saveData(); renderGantt(); };

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

function renderFullProject() {
    if (!projectData) return;
    
    const container = document.getElementById('full-project-container');
    const d = projectData;
    
    const checkField = (val) => val && val.length > 5;
    const statusBadge = (complete) => complete 
        ? '<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">✓ Complete</span>'
        : '<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">⚠ Incomplete</span>';

    container.innerHTML = `
        <div class="bg-gradient-to-r from-rcem-purple to-indigo-700 rounded-xl p-8 text-white shadow-lg">
            <h1 class="text-3xl font-bold font-serif">${escapeHtml(d.meta.title)}</h1>
            <p class="text-white/80 mt-2">Created: ${new Date(d.meta.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        
        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4">Completion Status</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span>Problem</span>${statusBadge(checkField(d.checklist.problem_desc))}</div>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span>Aim</span>${statusBadge(checkField(d.checklist.aim))}</div>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span>Measures</span>${statusBadge(checkField(d.checklist.outcome_measures))}</div>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><span>Team</span>${statusBadge(checkField(d.checklist.team))}</div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">1. Problem & Evidence</h2>
            <div class="space-y-4">
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Problem Description</h3>
                <p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.problem_desc) || '<span class="text-slate-400 italic">Not yet defined</span>'}</p></div>
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Evidence / Standards</h3>
                <p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.evidence) || '<span class="text-slate-400 italic">Not yet defined</span>'}</p></div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border-2 border-blue-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">2. SMART Aim</h2>
            <div class="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <p class="text-xl font-serif italic text-blue-900">${escapeHtml(d.checklist.aim) || '<span class="text-blue-400">No aim defined yet</span>'}</p>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">3. Measures</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200"><h3 class="text-xs font-bold text-emerald-800 uppercase mb-2">Outcome</h3><p class="text-sm text-emerald-900">${escapeHtml(d.checklist.outcome_measures) || 'Not defined'}</p></div>
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200"><h3 class="text-xs font-bold text-blue-800 uppercase mb-2">Process</h3><p class="text-sm text-blue-900">${escapeHtml(d.checklist.process_measures) || 'Not defined'}</p></div>
                <div class="bg-amber-50 p-4 rounded-lg border border-amber-200"><h3 class="text-xs font-bold text-amber-800 uppercase mb-2">Balancing</h3><p class="text-sm text-amber-900">${escapeHtml(d.checklist.balance_measures) || 'Not defined'}</p></div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">4. Team & Governance</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Team Members</h3><p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.team) || 'Not defined'}</p></div>
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Ethics / Registration</h3><p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.ethics) || 'Not defined'}</p></div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">5. Driver Diagram</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200"><h3 class="text-xs font-bold text-emerald-800 uppercase mb-2">Primary Drivers (${d.drivers.primary.length})</h3><ul class="text-sm text-emerald-900 space-y-1">${d.drivers.primary.map(p => '<li>• ' + escapeHtml(p) + '</li>').join('') || '<li class="text-emerald-400 italic">None defined</li>'}</ul></div>
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200"><h3 class="text-xs font-bold text-blue-800 uppercase mb-2">Secondary Drivers (${d.drivers.secondary.length})</h3><ul class="text-sm text-blue-900 space-y-1">${d.drivers.secondary.map(s => '<li>• ' + escapeHtml(s) + '</li>').join('') || '<li class="text-blue-400 italic">None defined</li>'}</ul></div>
                <div class="bg-purple-50 p-4 rounded-lg border border-purple-200"><h3 class="text-xs font-bold text-purple-800 uppercase mb-2">Change Ideas (${d.drivers.changes.length})</h3><ul class="text-sm text-purple-900 space-y-1">${d.drivers.changes.map(c => '<li>• ' + escapeHtml(c) + '</li>').join('') || '<li class="text-purple-400 italic">None defined</li>'}</ul></div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">6. PDSA Cycles (${d.pdsa.length})</h2>
            <div class="space-y-4">
                ${d.pdsa.length === 0 ? '<p class="text-slate-400 italic">No PDSA cycles recorded yet</p>' : 
                d.pdsa.map((p, i) => `
                    <div class="border border-slate-200 rounded-lg overflow-hidden">
                        <div class="bg-slate-50 px-4 py-2 font-bold text-slate-700 flex items-center gap-2">
                            <span class="bg-rcem-purple text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">${i + 1}</span>
                            ${escapeHtml(p.title)}
                            ${p.isStepChange ? '<span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full ml-auto">Step Change</span>' : ''}
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-slate-200">
                            <div class="p-3 bg-blue-50"><span class="text-xs font-bold text-blue-800 block mb-1">PLAN</span><p class="text-xs text-blue-900">${escapeHtml(p.plan) || '-'}</p></div>
                            <div class="p-3 bg-orange-50"><span class="text-xs font-bold text-orange-800 block mb-1">DO</span><p class="text-xs text-orange-900">${escapeHtml(p.do) || '-'}</p></div>
                            <div class="p-3 bg-purple-50"><span class="text-xs font-bold text-purple-800 block mb-1">STUDY</span><p class="text-xs text-purple-900">${escapeHtml(p.study) || '-'}</p></div>
                            <div class="p-3 bg-emerald-50"><span class="text-xs font-bold text-emerald-800 block mb-1">ACT</span><p class="text-xs text-emerald-900">${escapeHtml(p.act) || '-'}</p></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">7. Data & Results</h2>
            <div class="bg-slate-50 p-4 rounded-lg border mb-4"><p class="text-sm text-slate-600"><strong>Data Points:</strong> ${d.chartData.length}</p></div>
            <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Results Interpretation</h3>
            <p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.results_text) || '<span class="text-slate-400 italic">No analysis written yet</span>'}</p></div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border-2 border-emerald-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">8. Learning & Sustainability</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Key Learning</h3><p class="text-slate-700 whitespace-pre-wrap bg-amber-50 p-4 rounded-lg border border-amber-200">${escapeHtml(d.checklist.learning) || 'Not yet documented'}</p></div>
                <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Sustainability Plan</h3><p class="text-slate-700 whitespace-pre-wrap bg-emerald-50 p-4 rounded-lg border border-emerald-200">${escapeHtml(d.checklist.sustain) || 'Not yet documented'}</p></div>
            </div>
        </div>

        <div class="flex justify-center gap-4 py-8 no-print">
            <button onclick="window.print()" class="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4"></i> Print This View</button>
            <button onclick="window.router('dashboard')" class="bg-white text-slate-800 px-6 py-3 rounded-lg font-bold border border-slate-300 hover:bg-slate-50 flex items-center gap-2"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Dashboard</button>
        </div>
    `;
    
    lucide.createIcons();
}

// --- ASSET GENERATOR ---
async function getVisualAsset(type) {
    if (!projectData) return { success: false, error: "No project data." };

    let container = document.getElementById('asset-staging-area');
    if (!container) {
        container = document.createElement('div');
        container.id = 'asset-staging-area';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: -9999px;
            width: 1600px;
            height: 1200px;
            z-index: -9999;
            visibility: visible;
            background-color: white;
            opacity: 1;
        `;
        document.body.appendChild(container);
    }
    container.innerHTML = '';

    try {
        if (type === 'chart') {
            if (typeof Chart === 'undefined') throw new Error("Chart.js library missing.");
            
            const canvas = document.createElement('canvas');
            canvas.width = 1600;
            canvas.height = 900;
            canvas.style.width = '1600px';
            canvas.style.height = '900px';
            container.appendChild(canvas);

            const data = [...projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
            if (data.length === 0) throw new Error("No data points to chart.");

            const values = data.map(d => Number(d.value));
            const labels = data.map(d => d.date);
            
            let baselinePoints = values.slice(0, 12);
            let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
            let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
            const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83')); 
            
            const annotations = { 
                median: { 
                    type: 'line', 
                    yMin: currentMedian, 
                    yMax: currentMedian, 
                    borderColor: '#94a3b8', 
                    borderDash: [5,5], 
                    borderWidth: 2 
                } 
            };

            data.filter(d => d.note).forEach((d, i) => {
                annotations[`pdsa${i}`] = { 
                    type: 'line', 
                    xMin: d.date, 
                    xMax: d.date, 
                    borderColor: '#f36f21', 
                    borderWidth: 2, 
                    label: { 
                        display: true, 
                        content: d.note, 
                        position: 'start', 
                        backgroundColor: '#f36f21', 
                        color: 'white' 
                    } 
                };
            });

            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: labels, 
                    datasets: [{ 
                        label: 'Measure', 
                        data: values, 
                        borderColor: '#2d2e83', 
                        backgroundColor: pointColors, 
                        pointBackgroundColor: pointColors, 
                        pointRadius: 8, 
                        tension: 0.1, 
                        borderWidth: 3 
                    }] 
                },
                options: { 
                    animation: false,
                    responsive: false, 
                    maintainAspectRatio: false,
                    plugins: { 
                        annotation: { annotations }, 
                        legend: { display: false } 
                    },
                    scales: { 
                        y: { beginAtZero: true },
                        x: { display: true }
                    }
                }
            });

            chart.update('none');
            await new Promise(resolve => requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 200);
                });
            }));
            
            const imgData = canvas.toDataURL('image/png');
            chart.destroy();
            return { success: true, img: imgData };
        }

        if (type === 'driver' || type === 'fishbone') {
            if (typeof mermaid === 'undefined') throw new Error("Mermaid library missing.");
            
            const clean = (t) => t ? String(t).replace(/["()[\]{}#]/g, '').replace(/\n/g, ' ').trim() : '...';
            let mCode = "";
            
            if (type === 'driver') {
                const d = projectData.drivers;
                if(!d.primary.length && !d.secondary.length && !d.changes.length) throw new Error("No drivers defined.");
                mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
                d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
                d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
                d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
            } else {
                const cats = projectData.fishbone.categories;
                if (cats.every(c => c.causes.length === 0)) throw new Error("Fishbone empty.");
                mCode = `mindmap\n  root(("${clean(projectData.meta.title || 'Problem')}"))\n` + 
                        cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
            }

            const renderId = `mermaid-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const { svg } = await mermaid.render(renderId, mCode);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = svg;
            const svgEl = wrapper.querySelector('svg');
            
            if (!svgEl) throw new Error("Mermaid did not produce SVG output.");
            
            let w, h;
            const viewBoxAttr = svgEl.getAttribute('viewBox');
            if (viewBoxAttr) {
                const viewBox = viewBoxAttr.split(/[\s,]+/);
                w = parseFloat(viewBox[2]) || 800;
                h = parseFloat(viewBox[3]) || 600;
            } else {
                w = parseFloat(svgEl.getAttribute('width')) || 800;
                h = parseFloat(svgEl.getAttribute('height')) || 600;
            }
            
            w = Math.max(w, 100);
            h = Math.max(h, 100);
            
            const scale = 2; 
            svgEl.setAttribute('width', w * scale);
            svgEl.setAttribute('height', h * scale);
            svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
            
            const svgString = new XMLSerializer().serializeToString(svgEl);
            const canvas = document.createElement('canvas');
            canvas.width = w * scale;
            canvas.height = h * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const img = new Image();
            
            const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
            const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

            return new Promise((resolve) => {
                img.onload = () => {
                    try {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve({ success: true, img: canvas.toDataURL('image/png') });
                    } catch (drawError) {
                        console.error('Canvas draw error:', drawError);
                        resolve({ success: false, error: "Canvas drawing failed." });
                    }
                };
                img.onerror = (e) => {
                    console.error('Image load error:', e);
                    resolve({ success: false, error: "SVG to image conversion failed." });
                };
                img.src = dataUrl;
            });
        }

    } catch (e) {
        console.error('getVisualAsset error:', e);
        return { success: false, error: e.message };
    } finally {
        const stagingArea = document.getElementById('asset-staging-area');
        if (stagingArea) stagingArea.innerHTML = '';
    }
    return { success: false, error: "Unknown type" };
}

// --- EXPORT PPTX ---
window.exportPPTX = async () => {
    if (!projectData) { alert("Please load a project first."); return; }
    if (typeof PptxGenJS === 'undefined') { alert("PowerPoint library (PptxGenJS) not loaded. Check connection."); return; }

    const exportBtn = document.querySelector("button[onclick='exportPPTX()']");
    const originalHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generating...';
        lucide.createIcons();
    }

    try {
        const d = projectData;
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';
        pres.author = 'RCEM QIP Assistant';
        pres.title = d.meta.title;
        pres.subject = 'Quality Improvement Project';
        
        const driverRes = await getVisualAsset('driver');
        const fishboneRes = await getVisualAsset('fishbone');
        const chartRes = await getVisualAsset('chart');

        const RCEM_NAVY = '2d2e83';
        const RCEM_ORANGE = 'f36f21';
        const RCEM_TEAL = '0d9488';
        const SLATE_700 = '334155';
        const SLATE_500 = '64748b';
        const SLATE_100 = 'f1f5f9';

        pres.defineSlideMaster({
            title: 'RCEM_MASTER',
            background: { color: 'FFFFFF' },
            objects: [
                { rect: { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: RCEM_NAVY } } },
                { rect: { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: RCEM_NAVY } } },
                { text: { text: d.meta.title, options: { x: 0.3, y: 5.48, w: 7, fontSize: 9, color: 'FFFFFF', fontFace: 'Arial' } } },
                { text: { text: 'RCEM QIP Assistant', options: { x: 8.5, y: 5.48, w: 1.5, fontSize: 9, color: 'FFFFFF', fontFace: 'Arial', align: 'right' } } }
            ]
        });

        pres.defineSlideMaster({
            title: 'TITLE_SLIDE',
            background: { color: RCEM_NAVY },
            objects: [
                { rect: { x: 0, y: 4.8, w: '100%', h: 0.08, fill: { color: RCEM_ORANGE } } }
            ]
        });

        const addContentSlide = (title, subtitle = null) => {
            const s = pres.addSlide({ masterName: 'RCEM_MASTER' });
            s.addText(title, { 
                x: 0.4, y: 0.25, w: 9.2, h: 0.5,
                fontSize: 24, bold: true, color: RCEM_NAVY, fontFace: 'Arial'
            });
            if (subtitle) {
                s.addText(subtitle, { 
                    x: 0.4, y: 0.7, w: 9.2, h: 0.3,
                    fontSize: 12, color: SLATE_500, fontFace: 'Arial'
                });
            }
            s.addShape(pres.ShapeType.rect, { x: 0.4, y: 0.95, w: 1.5, h: 0.04, fill: { color: RCEM_ORANGE } });
            return s;
        };

        const addTextBox = (slide, text, x, y, w, h, options = {}) => {
            const defaultOpts = {
                fontSize: 11,
                color: SLATE_700,
                fontFace: 'Arial',
                valign: 'top',
                fill: { color: SLATE_100 },
                margin: [8, 10, 8, 10]
            };
            slide.addText(text || 'Not specified', { x, y, w, h, ...defaultOpts, ...options });
        };

        // SLIDE 1: TITLE
        const s1 = pres.addSlide({ masterName: 'TITLE_SLIDE' });
        s1.addText(d.meta.title, { 
            x: 0.8, y: 1.8, w: 8.4, h: 1.2,
            fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Arial',
            align: 'center', valign: 'middle'
        });
        s1.addText('Quality Improvement Project', { 
            x: 0.8, y: 3.0, w: 8.4, h: 0.4,
            fontSize: 18, color: 'CCCCCC', fontFace: 'Arial',
            align: 'center'
        });
        const teamLines = (d.checklist.team || 'QI Team').split('\n').slice(0, 3);
        s1.addText(teamLines.join('\n'), { 
            x: 0.8, y: 3.8, w: 8.4, h: 0.8,
            fontSize: 14, color: 'FFFFFF', fontFace: 'Arial',
            align: 'center', valign: 'top'
        });
        s1.addText(new Date(d.meta.created).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), { 
            x: 0.8, y: 5.0, w: 8.4, h: 0.3,
            fontSize: 12, color: RCEM_ORANGE, fontFace: 'Arial',
            align: 'center'
        });

        // SLIDE 2: EXECUTIVE SUMMARY
        const s2 = addContentSlide('Executive Summary', 'Project Overview at a Glance');
        const stats = [
            { label: 'PDSA Cycles', value: d.pdsa.length.toString(), color: RCEM_NAVY },
            { label: 'Data Points', value: d.chartData.length.toString(), color: RCEM_TEAL },
            { label: 'Change Ideas', value: d.drivers.changes.length.toString(), color: RCEM_ORANGE },
            { label: 'Stakeholders', value: (d.stakeholders?.length || 0).toString(), color: SLATE_500 }
        ];
        stats.forEach((stat, i) => {
            const xPos = 0.4 + (i * 2.4);
            s2.addShape(pres.ShapeType.rect, { x: xPos, y: 1.2, w: 2.2, h: 1.0, fill: { color: stat.color } });
            s2.addText(stat.value, { x: xPos, y: 1.25, w: 2.2, h: 0.6, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
            s2.addText(stat.label, { x: xPos, y: 1.8, w: 2.2, h: 0.35, fontSize: 10, color: 'FFFFFF', align: 'center', valign: 'top' });
        });
        s2.addText('SMART Aim', { x: 0.4, y: 2.5, w: 9.2, fontSize: 12, bold: true, color: SLATE_500 });
        s2.addText(d.checklist.aim || 'No aim defined', { 
            x: 0.4, y: 2.8, w: 9.2, h: 0.9,
            fontSize: 14, italic: true, color: RCEM_NAVY, fontFace: 'Arial',
            fill: { color: 'EFF6FF' }, margin: [10, 12, 10, 12], valign: 'middle'
        });
        s2.addText('Key Results', { x: 0.4, y: 3.9, w: 9.2, fontSize: 12, bold: true, color: SLATE_500 });
        const resultsPreview = (d.checklist.results_text || 'No results recorded').substring(0, 400) + (d.checklist.results_text?.length > 400 ? '...' : '');
        addTextBox(s2, resultsPreview, 0.4, 4.2, 9.2, 1.1, { fontSize: 10 });

        // SLIDE 3: THE PROBLEM
        const s3 = addContentSlide('The Problem', 'Why This Project Matters');
        s3.addText('Problem Description', { x: 0.4, y: 1.1, w: 5.6, fontSize: 11, bold: true, color: SLATE_500 });
        addTextBox(s3, d.checklist.problem_desc, 0.4, 1.35, 5.6, 2.5);
        s3.addText('Evidence & Standards', { x: 6.2, y: 1.1, w: 3.6, fontSize: 11, bold: true, color: SLATE_500 });
        addTextBox(s3, d.checklist.evidence, 6.2, 1.35, 3.4, 2.5);

        // SLIDE 4: SMART AIM
        const s4 = addContentSlide('SMART Aim', 'Specific, Measurable, Achievable, Relevant, Time-bound');
        s4.addShape(pres.ShapeType.rect, { x: 0.4, y: 1.2, w: 9.2, h: 1.8, fill: { color: 'EFF6FF' }, line: { color: '3B82F6', pt: 2 } });
        s4.addText(d.checklist.aim || 'No SMART aim defined yet', { 
            x: 0.6, y: 1.4, w: 8.8, h: 1.4,
            fontSize: 18, italic: true, color: RCEM_NAVY, fontFace: 'Arial',
            valign: 'middle', align: 'center'
        });

        // SLIDE 5: MEASURES
        const s5 = addContentSlide('Measurement Strategy', 'Outcome, Process & Balancing Measures');
        const measures = [
            { title: 'Outcome Measure', content: d.checklist.outcome_measures, color: '059669', bg: 'ECFDF5' },
            { title: 'Process Measures', content: d.checklist.process_measures, color: '2563EB', bg: 'EFF6FF' },
            { title: 'Balancing Measures', content: d.checklist.balance_measures, color: 'D97706', bg: 'FFFBEB' }
        ];
        measures.forEach((m, i) => {
            const xPos = 0.4 + (i * 3.15);
            s5.addShape(pres.ShapeType.rect, { x: xPos, y: 1.2, w: 3.0, h: 4.0, fill: { color: m.bg }, line: { color: m.color, pt: 1 } });
            s5.addText(m.title, { x: xPos + 0.1, y: 1.3, w: 2.8, h: 0.4, fontSize: 11, bold: true, color: m.color });
            s5.addText(m.content || 'Not defined', { x: xPos + 0.1, y: 1.75, w: 2.8, h: 3.3, fontSize: 10, color: SLATE_700, valign: 'top' });
        });

        // SLIDE 6: DRIVER DIAGRAM
        const s6 = addContentSlide('Driver Diagram', 'Theory of Change');
        if (driverRes.success) {
            s6.addImage({ data: driverRes.img, x: 0.4, y: 1.2, w: 9.2, h: 4.0, sizing: { type: 'contain' } });
        } else {
            s6.addText('Primary Drivers', { x: 0.4, y: 1.2, w: 3.0, fontSize: 11, bold: true, color: '059669' });
            s6.addText(d.drivers.primary.map((p, i) => `${i+1}. ${p}`).join('\n') || 'None defined', { 
                x: 0.5, y: 1.55, w: 2.8, h: 2.3, fontSize: 10, color: SLATE_700, valign: 'top'
            });
            s6.addText('Secondary Drivers', { x: 3.6, y: 1.2, w: 3.0, fontSize: 11, bold: true, color: '2563EB' });
            s6.addText(d.drivers.secondary.map((s, i) => `${i+1}. ${s}`).join('\n') || 'None defined', { 
                x: 3.7, y: 1.55, w: 2.8, h: 2.3, fontSize: 10, color: SLATE_700, valign: 'top'
            });
            s6.addText('Change Ideas', { x: 6.8, y: 1.2, w: 3.0, fontSize: 11, bold: true, color: RCEM_ORANGE });
            s6.addText(d.drivers.changes.map((c, i) => `${i+1}. ${c}`).join('\n') || 'None defined', { 
                x: 6.9, y: 1.55, w: 2.6, h: 2.3, fontSize: 10, color: SLATE_700, valign: 'top'
            });
        }

        // SLIDE 7: FISHBONE
        const s7 = addContentSlide('Root Cause Analysis', 'Fishbone / Ishikawa Diagram');
        if (fishboneRes.success) {
            s7.addImage({ data: fishboneRes.img, x: 0.4, y: 1.2, w: 9.2, h: 4.0, sizing: { type: 'contain' } });
        } else {
            const cats = d.fishbone?.categories || [];
            cats.forEach((cat, i) => {
                const xPos = 0.4 + ((i % 2) * 4.8);
                const yPos = 1.2 + (Math.floor(i / 2) * 2.0);
                s7.addShape(pres.ShapeType.rect, { x: xPos, y: yPos, w: 4.6, h: 1.8, fill: { color: SLATE_100 } });
                s7.addText(cat.text, { x: xPos + 0.1, y: yPos + 0.05, w: 4.4, h: 0.35, fontSize: 12, bold: true, color: RCEM_NAVY });
                s7.addText(cat.causes.map(c => '• ' + c).join('\n') || 'No causes identified', { 
                    x: xPos + 0.1, y: yPos + 0.4, w: 4.4, h: 1.3, fontSize: 9, color: SLATE_700, valign: 'top'
                });
            });
        }

        // SLIDE 8: CHART
        if (chartRes.success) {
            const sChart = addContentSlide('Run Chart / SPC', 'Data Over Time');
            sChart.addImage({ data: chartRes.img, x: 0.4, y: 1.2, w: 9.2, h: 4.0, sizing: { type: 'contain' } });
        }

        // SLIDE 9: PDSA CYCLES
        if (d.pdsa.length > 0) {
            const sPdsa = addContentSlide('PDSA Cycles', `${d.pdsa.length} Improvement Cycles Completed`);
            d.pdsa.slice(0, 4).forEach((cycle, i) => {
                const xPos = 0.4 + (i * 2.35);
                const isStepChange = cycle.isStepChange;
                sPdsa.addShape(pres.ShapeType.ellipse, { 
                    x: xPos + 0.85, y: 1.3, w: 0.6, h: 0.6, 
                    fill: { color: isStepChange ? '059669' : RCEM_NAVY }
                });
                sPdsa.addText((i + 1).toString(), { 
                    x: xPos + 0.85, y: 1.35, w: 0.6, h: 0.5, 
                    fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
                });
                sPdsa.addText(cycle.title, { 
                    x: xPos, y: 2.0, w: 2.2, h: 0.5, 
                    fontSize: 10, bold: true, color: RCEM_NAVY, align: 'center', valign: 'top'
                });
                if (isStepChange) {
                    sPdsa.addShape(pres.ShapeType.rect, { x: xPos + 0.3, y: 2.45, w: 1.6, h: 0.25, fill: { color: '059669' } });
                    sPdsa.addText('STEP CHANGE', { x: xPos + 0.3, y: 2.45, w: 1.6, h: 0.25, fontSize: 7, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
                }
            });
        }

        // SLIDE 10: LEARNING
        const sLearn = addContentSlide('Key Learning & Sustainability');
        s7.addText('Key Learning', { x: 0.4, y: 1.2, w: 4.4, fontSize: 11, bold: true, color: SLATE_500 });
        addTextBox(sLearn, d.checklist.learning, 0.4, 1.45, 4.4, 2.5);
        sLearn.addText('Sustainability Plan', { x: 5.0, y: 1.2, w: 4.6, fontSize: 11, bold: true, color: SLATE_500 });
        addTextBox(sLearn, d.checklist.sustain, 5.0, 1.45, 4.6, 2.5);

        pres.writeFile({ fileName: `${d.meta.title.replace(/[^a-z0-9]/gi, '_')}_QIP.pptx` });

    } catch (err) {
        console.error('PPTX Export Error:', err);
        alert('Error generating PowerPoint: ' + err.message);
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }
};

// --- PRINT POSTER FUNCTION ---
window.printPoster = async () => {
    if (!projectData) { 
        alert("Please load a project first."); 
        return; 
    }

    const d = projectData;
    const container = document.getElementById('print-container');
    
    // Generate chart image
    let chartImgHtml = '<p class="text-slate-400 italic">No chart data available</p>';
    const chartRes = await getVisualAsset('chart');
    if (chartRes.success) {
        chartImgHtml = `<img src="${chartRes.img}" class="img-fluid" alt="Run Chart">`;
    }

    // Generate driver diagram image
    let driverImgHtml = '';
    const driverRes = await getVisualAsset('driver');
    if (driverRes.success) {
        driverImgHtml = `<div class="driver-holder"><img src="${driverRes.img}" class="img-fluid" alt="Driver Diagram"></div>`;
    } else {
        driverImgHtml = `
            <div class="space-y-2">
                <div><strong>Primary:</strong> ${d.drivers.primary.join(', ') || 'None'}</div>
                <div><strong>Secondary:</strong> ${d.drivers.secondary.join(', ') || 'None'}</div>
                <div><strong>Changes:</strong> ${d.drivers.changes.join(', ') || 'None'}</div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="poster-grid">
            <div class="poster-header">
                <div class="poster-logo-area">
                    <img src="https://iili.io/KGQOvkl.md.png" class="poster-logo" alt="RCEM Logo">
                </div>
                <div class="poster-title-area">
                    <h1>${escapeHtml(d.meta.title)}</h1>
                    <p>${escapeHtml(d.checklist.team) || 'QI Team'}</p>
                </div>
            </div>

            <div class="poster-col">
                <div class="poster-box">
                    <h2>Problem</h2>
                    <p>${escapeHtml(d.checklist.problem_desc) || 'Not defined'}</p>
                </div>
                <div class="poster-box aim-box">
                    <h2>SMART Aim</h2>
                    <p class="aim-statement">${escapeHtml(d.checklist.aim) || 'No aim defined'}</p>
                </div>
                <div class="poster-box">
                    <h2>Measures</h2>
                    <ul>
                        <li><strong>Outcome:</strong> ${escapeHtml(d.checklist.outcome_measures) || 'Not defined'}</li>
                        <li><strong>Process:</strong> ${escapeHtml(d.checklist.process_measures) || 'Not defined'}</li>
                        <li><strong>Balancing:</strong> ${escapeHtml(d.checklist.balance_measures) || 'Not defined'}</li>
                    </ul>
                </div>
                <div class="poster-box">
                    <h2>Driver Diagram</h2>
                    ${driverImgHtml}
                </div>
            </div>

            <div class="poster-col">
                <div class="poster-box">
                    <h2>Run Chart</h2>
                    <div class="chart-holder">
                        ${chartImgHtml}
                    </div>
                    <div class="analysis-box">
                        <h3 style="font-weight: bold; margin-bottom: 8px;">Results Analysis</h3>
                        <p>${escapeHtml(d.checklist.results_text) || 'No analysis written yet'}</p>
                    </div>
                </div>
                <div class="poster-box">
                    <h2>PDSA Cycles (${d.pdsa.length})</h2>
                    ${d.pdsa.length === 0 ? '<p class="text-slate-400 italic">No cycles recorded</p>' : 
                    d.pdsa.map((p, i) => `
                        <div style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${p.isStepChange ? '#059669' : '#2d2e83'};">
                            <strong>Cycle ${i + 1}: ${escapeHtml(p.title)}</strong>
                            ${p.isStepChange ? '<span style="background: #059669; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 8px;">STEP CHANGE</span>' : ''}
                            <p style="font-size: 12px; margin-top: 4px;"><strong>Study:</strong> ${escapeHtml(p.study) || '-'}</p>
                            <p style="font-size: 12px;"><strong>Act:</strong> ${escapeHtml(p.act) || '-'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="poster-col">
                <div class="poster-box">
                    <h2>Evidence</h2>
                    <p>${escapeHtml(d.checklist.evidence) || 'Not specified'}</p>
                </div>
                <div class="poster-box">
                    <h2>Key Learning</h2>
                    <p>${escapeHtml(d.checklist.learning) || 'Not yet documented'}</p>
                </div>
                <div class="poster-box sustain-box">
                    <h2>Sustainability</h2>
                    <p>${escapeHtml(d.checklist.sustain) || 'Not yet documented'}</p>
                </div>
                <div class="poster-box">
                    <h2>Governance</h2>
                    <p>${escapeHtml(d.checklist.ethics) || 'Not specified'}</p>
                </div>
            </div>
        </div>
    `;

    // Use html2pdf if available, otherwise just print
    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: 0.25,
            filename: `${d.meta.title.replace(/[^a-z0-9]/gi, '_')}_Poster.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a1', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};
