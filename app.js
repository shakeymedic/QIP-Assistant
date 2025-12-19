import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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

let currentUser = null;
let isDemoUser = false;
let isViewingDemo = false;

// --- GOLD STANDARD DEMO DATA ---
const demoData = {
    checklist: {
        title: "Improving Sepsis 6 Bundle Delivery in the ED",
        lead: "Dr. A. Medic (ST4)",
        team: "Sr. B. Nurse (Band 7), Dr. C. Consultant (QIP Lead)",
        problem_desc: "Local audit (Nov 2024) revealed only 45% of patients triggered for 'Red Flag Sepsis' received the full Sepsis 6 bundle within 1 hour of arrival. This increases mortality risk and length of stay.",
        evidence: "RCEM Guidelines require 100% compliance. NCEPOD 'Just Say Sepsis' highlights early antibiotics as critical.",
        aim: "To increase the delivery of the Sepsis 6 bundle within 1 hour for eligible patients from 45% to 90% by 1st March 2025.",
        outcome_measures: "Percentage of eligible patients receiving Sepsis 6 < 1 hour.",
        process_measures: "1. Time to screening (Triage). 2. Time to antibiotic prescription. 3. Availability of Sepsis Grab Bags.",
        balance_measures: "1. Time to initial assessment for non-sepsis patients (displacement). 2. Rate of inappropriate antibiotic prescribing.",
        strategy_summary: "We identified that equipment availability and lack of triage prompts were key drivers. We plan to introduce 'Sepsis Grab Bags' and a 'Sepsis Stamp' for notes.",
        results_summary: "Baseline data (n=20) showed 45% compliance. Cycle 1 (Stamp) improved this to 65%. Cycle 2 (Grab Bags) improved this to 82%. Cycle 3 (PGD) sustained improvement at 88%.",
        learning: "Process mapping revealed wasted time searching for fluids. Pre-filled bags saved 8 mins per patient. Nursing engagement was crucial for the PGD.",
        sustainability_plan: "Sepsis Lead Nurse appointed to check grab bags daily. Audit metrics added to monthly departmental dashboard.",
        spread_plan: "Presenting at Regional EM Conference in April. Sharing protocol with ICU."
    },
    fishbone: { 
        categories: [
            {id:1, text:"People", causes:["Locum doctors unfamiliar with protocol", "Nursing shortage", "Fear of prescribing wrong dose"]}, 
            {id:2, text:"Methods", causes:["No PGD for nurses", "Paper notes messy", "Screening tool ignored"]}, 
            {id:3, text:"Equipment", causes:["Cannulas missing", "Fluids locked in store room", "Antibiotics in separate cupboard"]}, 
            {id:4, text:"Environment", causes:["Overcrowded Resus", "No dedicated sepsis trolley"]}
        ] 
    },
    drivers: { 
        primary: ["Reliable Identification at Triage", "Rapid Equipment Availability", "Empowered Nursing Staff"], 
        secondary: ["Visual prompts in notes", "Pre-prepared 'Grab Bags'", "Nurse PGD for Antibiotics"], 
        changes: ["Sepsis Stamp", "Grab Bag Implementation", "Training Sessions"] 
    },
    forcefield: { 
        driving: ["National Targets (CQUIN)", "Enthusiastic Junior Doctors", "Consultant Support"], 
        restraining: ["Winter Pressures / Crowding", "Agency Staff Turnover", "IT System Slowness"] 
    },
    swot: { s: [], w: [], o: [], t: [] },
    fiveWhys: [
        "Antibiotics delivered late (>1 hour)", 
        "Doctor didn't prescribe them immediately", 
        "Doctor was busy in Resus with another patient", 
        "Nurses not authorised to prescribe first dose", 
        "No PGD (Patient Group Direction) in place"
    ],
    gantt: [
        {id:"1", name:"Project Planning & Team Formation", start:"2025-01-01", end:"2025-01-07", status:"Complete"},
        {id:"2", name:"Baseline Data Collection (n=20)", start:"2025-01-07", end:"2025-01-14", status:"Complete"},
        {id:"3", name:"PDSA 1: Sepsis Stamp Design", start:"2025-01-14", end:"2025-01-16", status:"Complete"},
        {id:"4", name:"PDSA 1: Trial in Majors", start:"2025-01-16", end:"2025-01-23", status:"Complete"},
        {id:"5", name:"PDSA 2: Sepsis Grab Bags", start:"2025-01-24", end:"2025-02-07", status:"Complete"},
        {id:"6", name:"PDSA 3: Nurse PGD Training", start:"2025-02-10", end:"2025-02-24", status:"In Progress"},
        {id:"7", name:"Final Evaluation & Report", start:"2025-02-25", end:"2025-03-01", status:"Planned"}
    ],
    pdsa: [
        {id:"3", title:"Cycle 3: Nurse PGD", date:"2025-02-10", plan:"Empower Band 6+ nurses to give 1st dose Abx without doctor.", do:"Training run for 10 nurses. PGD signed off.", study:"Time to Abx dropped to 25 mins average.", act:"Roll out to all Band 5s."},
        {id:"2", title:"Cycle 2: Sepsis Grab Bags", date:"2025-01-24", plan:"Create kits with fluids, giving sets, and blood bottles to reduce 'hunting' time.", do:"10 bags placed in Majors. Stock checked daily.", study:"Compliance rose to 82%. Nurses reported high satisfaction.", act:"Adopt as standard practice."},
        {id:"1", title:"Cycle 1: Sepsis Stamp", date:"2025-01-16", plan:"Rubber stamp for notes to prompt Sepsis 6 actions at triage.", do:"Trialled for 1 week. 50 notes stamped.", study:"Compliance rose from 45% to 65%, but stamp ink ran out often.", act:"Adapt: Switch to sticker or digital flag."}
    ],
    chartData: [
        {date:"2025-01-01", value:45, type:"data"}, {date:"2025-01-03", value:40, type:"data"}, {date:"2025-01-05", value:48, type:"data"}, 
        {date:"2025-01-08", value:42, type:"data"}, {date:"2025-01-12", value:45, type:"data"},
        {date:"2025-01-16", value:null, type:"intervention", note:"PDSA 1: Stamp"},
        {date:"2025-01-18", value:60, type:"data"}, {date:"2025-01-20", value:65, type:"data"}, {date:"2025-01-23", value:62, type:"data"},
        {date:"2025-01-24", value:null, type:"intervention", note:"PDSA 2: Grab Bags"},
        {date:"2025-01-27", value:78, type:"data"}, {date:"2025-01-30", value:82, type:"data"}, {date:"2025-02-03", value:85, type:"data"},
        {date:"2025-02-10", value:null, type:"intervention", note:"PDSA 3: PGD"},
        {date:"2025-02-14", value:88, type:"data"}, {date:"2025-02-18", value:92, type:"data"}
    ],
    paretoData: [
        {cat: "Doctor Busy / Delay", count: 45},
        {cat: "Equipment Missing", count: 30},
        {cat: "Not Flagged at Triage", count: 15},
        {cat: "IV Access Difficult", count: 8},
        {cat: "Lab Delays", count: 2}
    ],
    chartGoal: 90
};

// Current user data structure
let projectData = {
    checklist: {},
    fishbone: { categories: [] },
    drivers: { primary: [], secondary: [], changes: [] },
    forcefield: { driving: [], restraining: [] },
    swot: { s: [], w: [], o: [], t: [] },
    fiveWhys: ["","","","",""],
    gantt: [],
    pdsa: [],
    chartData: [],
    paretoData: [],
    chartGoal: null
};

let chartMode = 'run';
let toolMode = 'fishbone'; 
let authMode = 'signin';
let chartInstance = null;
let toolZoom = 1.0; 

const escapeHtml = (unsafe) => { if(!unsafe) return ''; return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
const showToast = (message) => {
    const el = document.createElement('div'); el.className = `px-4 py-2 rounded shadow-lg text-white text-sm font-medium mb-2 fade-in bg-rcem-purple`; el.innerHTML = message;
    document.getElementById('toast-container').appendChild(el); setTimeout(() => el.remove(), 3000);
}

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if(isDemoUser) return; 
    currentUser = user;
    if (user) {
        showApp();
        initRealtimeListener();
        if(!localStorage.getItem('rcem_tour_done')) {
            document.getElementById('guide-modal').classList.remove('hidden');
            localStorage.setItem('rcem_tour_done', 'true');
        }
    } else {
        showAuth();
    }
});

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.add('flex');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('user-display').textContent = currentUser ? currentUser.email : "Demo User";
}

function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.remove('flex');
    document.getElementById('app-sidebar').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
}

window.enableDemoMode = () => {
    isDemoUser = true;
    currentUser = { email: "demo@rcem.ac.uk", uid: "demo" };
    projectData = JSON.parse(JSON.stringify(demoData)); // Deep copy
    showApp();
    renderAll();
    showToast("Demo Loaded - Data not saved");
}

document.getElementById('demo-btn').onclick = window.enableDemoMode;

// --- TOGGLE DEMO VIEW ---
window.toggleDemoView = () => {
    const checkbox = document.getElementById('demo-toggle');
    isViewingDemo = checkbox.checked;
    
    const indicator = document.getElementById('demo-indicator');
    if (isViewingDemo) {
        indicator.classList.remove('hidden');
        showToast("Viewing Example Project");
    } else {
        indicator.classList.add('hidden');
        showToast("Returning to Your Project");
    }
    renderAll();
};

document.getElementById('demo-toggle').onclick = window.toggleDemoView;


// Helper: get current active data source
function getData() {
    return isViewingDemo ? demoData : projectData;
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (authMode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
        else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { alert(err.message); }
});

document.getElementById('logout-btn').addEventListener('click', () => { 
    isDemoUser = false; 
    isViewingDemo = false;
    signOut(auth); 
    location.reload(); 
});

document.getElementById('toggle-auth').onclick = (e) => { e.preventDefault(); authMode = authMode==='signin'?'signup':'signin'; document.getElementById('auth-btn-text').textContent = authMode==='signin'?'Sign In':'Sign Up'; document.getElementById('auth-title').textContent = authMode==='signin'?'Sign In':'Create Account'; };

// --- DB ---
function initRealtimeListener() {
    if (!currentUser || isDemoUser) return;
    onSnapshot(doc(db, 'projects', currentUser.uid), (doc) => {
        if (doc.exists()) {
            projectData = { ...projectData, ...doc.data() };
            // Structure Checks
            if(!projectData.fishbone || !projectData.fishbone.categories) projectData.fishbone = { categories: [{id:1, text:"People", causes:[]}, {id:2, text:"Methods", causes:[]}, {id:3, text:"Equipment", causes:[]}, {id:4, text:"Environment", causes:[]}] };
            if(!projectData.drivers) projectData.drivers = { primary: [], secondary: [], changes: [] };
            if(!projectData.fiveWhys) projectData.fiveWhys = ["","","","",""];
            if(!projectData.forcefield) projectData.forcefield = { driving: [], restraining: [] };
        }
        if (!isViewingDemo) renderAll();
    });
}

async function saveData() { 
    if(isViewingDemo || isDemoUser) return; 
    if(currentUser) await setDoc(doc(db, 'projects', currentUser.uid), projectData, { merge: true }); 
    const s = document.getElementById('save-status');
    s.innerHTML = '<i data-lucide="save" class="w-3 h-3 text-emerald-600"></i> Saved';
    s.classList.add('animate-pulse-fast');
    setTimeout(() => s.classList.remove('animate-pulse-fast'), 1000);
    lucide.createIcons(); 
}
window.saveData = saveData;

// --- ROUTER & SHORTCUTS ---
window.router = (viewId) => {
    if(viewId === 'poster') { updatePoster(); document.getElementById('view-poster').classList.remove('hidden'); return; }
    document.getElementById('view-poster').classList.add('hidden');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'tools') renderTools();
    if(viewId === 'data') renderChart();
};
window.toggleDarkMode = () => document.documentElement.classList.toggle('dark');
window.openGuide = () => document.getElementById('guide-modal').classList.remove('hidden');
window.openBulkImport = () => document.getElementById('bulk-modal').classList.remove('hidden');
document.getElementById('mobile-menu-btn').onclick = () => { const sb = document.getElementById('app-sidebar'); sb.classList.toggle('hidden'); sb.classList.toggle('absolute'); sb.classList.toggle('z-40'); sb.classList.toggle('w-full'); };

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveData(); showToast("Saved"); }
    if (e.key === 'Escape') {
        document.querySelectorAll('.fixed').forEach(el => {
            if(el.id !== 'auth-screen' && !el.classList.contains('hidden')) el.classList.add('hidden');
        });
    }
});

function renderAll() {
    renderDashboard(); renderChecklist(); renderChart(); renderTools(); renderGantt(); renderPDSA();
    lucide.createIcons();
    const data = getData();
    if(document.getElementById('chart-goal')) document.getElementById('chart-goal').value = data.chartGoal || '';
}

// --- ENHANCED QI COACH ---
function renderCoach() {
    const dataObj = getData();
    const coachEl = document.getElementById('qi-coach');
    const titleEl = document.getElementById('coach-title');
    const msgEl = document.getElementById('coach-msg');
    const btnEl = document.getElementById('coach-action');

    if (!coachEl) return; 

    if (isViewingDemo) {
        coachEl.classList.add('hidden');
        return;
    }

    // Logic Chain
    let step = {};
    if (!dataObj.checklist.title) {
        step = { title: "Define the Project", msg: "Start by giving your project a clear title and identifying the team.", action: "checklist", btn: "Go to Checklist" };
    } else if (!dataObj.checklist.problem_desc) {
        step = { title: "What is the problem?", msg: "Use local evidence. E.g., 'Audit showed only 40% compliance'. Avoid assumptions.", action: "checklist", btn: "Define Problem" };
    } else if (dataObj.paretoData && dataObj.paretoData.length === 0) {
         step = { title: "Analyse the causes", msg: "Use a Pareto chart to find the biggest contributors to the problem.", action: "data", btn: "Create Pareto" };
    } else if (!dataObj.checklist.aim) {
        step = { title: "Set a SMART Aim", msg: "Specific, Measurable, Achievable, Relevant, Time-bound.", action: "dashboard-aim", btn: "Open Wizard" };
    } else if (dataObj.fishbone.categories[0].causes.length === 0 && dataObj.fiveWhys[0] === "") {
        step = { title: "Diagnose Root Causes", msg: "Don't jump to solutions! Use the Fishbone or 5 Whys to understand WHY it happens.", action: "tools", btn: "Use Tools" };
    } else if (dataObj.drivers.changes.length === 0) {
        step = { title: "Plan Strategy", msg: "Create a Driver Diagram. Connect your Aim to Primary Drivers -> Change Ideas.", action: "tools", btn: "Driver Diagram" };
    } else if (dataObj.chartData.length < 5) {
        step = { title: "Baseline Data", msg: "Collect 5-10 data points before changing anything. Establish a baseline.", action: "data", btn: "Add Data" };
    } else if (dataObj.pdsa.length === 0) {
        step = { title: "Start PDSA Cycle 1", msg: "Pick one small change idea. Test it. Document it.", action: "pdsa", btn: "Start PDSA" };
    } else if (!dataObj.checklist.results_summary) {
        step = { title: "Summarize & Reflect", msg: "Project finished? Summarize your results and write your sustainability plan.", action: "checklist", btn: "Finish Checklist" };
    } else {
        step = { title: "Ready for Report", msg: "Great job! You have a complete project. Generate your report now.", action: "poster", btn: "View Poster" };
    }

    titleEl.textContent = step.title;
    msgEl.textContent = step.msg;
    btnEl.innerHTML = `${step.btn} <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    
    btnEl.onclick = () => {
        if(step.action === 'dashboard-aim') { window.openSmartWizard(); }
        else { window.router(step.action); }
    };
    coachEl.classList.remove('hidden');
}

// --- SPC RULE ENGINE ---
function analyzeRunChart(dataPoints) {
    if (dataPoints.length < 10) return "<strong>Status:</strong> Not enough data to determine trends (need 10+ points).";

    const values = dataPoints.map(d => parseFloat(d.value));
    const sortedVals = [...values].sort((a,b)=>a-b);
    const mid = Math.floor(sortedVals.length/2);
    const median = sortedVals.length > 0 ? (sortedVals.length%2!==0 ? sortedVals[mid] : (sortedVals[mid-1]+sortedVals[mid])/2) : 0;

    let shiftCount = 0;
    let shiftDetected = false;
    let trendDesc = "Variation appears random (Common Cause).";

    // Rule 1: Shift (6+ points on one side of median)
    let currentSide = 0; // 0=on, 1=above, -1=below
    let runLength = 0;

    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        const side = val > median ? 1 : (val < median ? -1 : 0);
        if (side === currentSide && side !== 0) { runLength++; } 
        else { if (runLength >= 6) shiftDetected = true; runLength = 1; currentSide = side; }
    }
    if (runLength >= 6) shiftDetected = true;

    if (shiftDetected) {
        trendDesc = `<span class="text-emerald-600 font-bold">Improvement Detected!</span> Found a "Shift" (6+ points on one side of median).`;
    }

    return `<strong>Median:</strong> ${median.toFixed(1)} | ${trendDesc}`;
}

// --- CHARTING ENGINE (Pareto & Run) ---
window.setChartMode = (m) => { chartMode = m; 
    document.getElementById('input-run').classList.toggle('hidden', m!=='run');
    document.getElementById('input-pareto').classList.toggle('hidden', m!=='pareto');
    document.getElementById('chart-input-title').textContent = m==='run' ? 'Add Data / Intervention' : 'Add Pareto Category';
    renderChart();
    
    document.getElementById('btn-chart-run').className = m==='run' ? "bg-rcem-purple text-white px-3 py-1.5 rounded text-sm shadow" : "bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm";
    document.getElementById('btn-chart-pareto').className = m==='pareto' ? "bg-rcem-purple text-white px-3 py-1.5 rounded text-sm shadow" : "bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm";
}

window.updateGoal = () => { if(isViewingDemo) return; projectData.chartGoal = document.getElementById('chart-goal').value; saveData(); renderChart(); }
window.validateDate = (input) => { const d = new Date(input.value); const now = new Date(); if(d > now) alert("Note: Future date."); }

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const dataObj = getData();

    if (chartMode === 'run') {
        const data = dataObj.chartData || [];
        const sortedData = [...data].sort((a,b) => new Date(a.date) - new Date(b.date));
        const dataPoints = sortedData.filter(d => d.type !== 'intervention');
        
        // Run SPC Logic
        document.getElementById('chart-legend').innerHTML = analyzeRunChart(dataPoints);

        const values = dataPoints.map(d => parseFloat(d.value));
        const sortedVals = [...values].sort((a,b)=>a-b);
        const mid = Math.floor(sortedVals.length/2);
        const median = sortedVals.length > 0 ? (sortedVals.length%2!==0 ? sortedVals[mid] : (sortedVals[mid-1]+sortedVals[mid])/2) : 0;
        
        const pointColors = values.map((v, i) => {
            if (i < 5) return '#2d2e83'; 
            const subset = values.slice(Math.max(0, i-5), i+1);
            if (subset.length < 6) return '#2d2e83';
            const allAbove = subset.every(x => x > median);
            const allBelow = subset.every(x => x < median);
            return (allAbove || allBelow) ? '#ef4444' : '#2d2e83'; 
        });

        const annotations = {};
        sortedData.filter(d => d.type === 'intervention').forEach((d, i) => {
            annotations[`line${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, borderDash: [6, 6], label: { display: true, content: d.note || 'PDSA', position: 'start', backgroundColor: '#f36f21', color: 'white' } };
        });
        if(dataObj.chartGoal) annotations['goal'] = { type: 'box', yMin: dataObj.chartGoal, yMax: Math.max(...values, parseFloat(dataObj.chartGoal)) * 1.1, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 0 };

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: dataPoints.map(d => d.date), datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', pointBackgroundColor: pointColors, pointRadius: 5, tension: 0.1 }, { label: 'Median', data: Array(values.length).fill(median), borderColor: '#94a3b8', borderDash: [5,5], pointRadius:0 }] },
            options: { responsive: true, plugins: { annotation: { annotations } }, scales: { y: { beginAtZero: true, grid:{color:gridColor} }, x: { grid:{color:gridColor} } } }
        });
        document.getElementById('data-history-list').innerHTML = sortedData.map((d,i)=>`<div class="flex justify-between text-sm border-b border-slate-200 dark:border-slate-700 p-2"><span><span class="font-bold ${d.type==='intervention'?'text-orange-500':'text-indigo-600'}">${d.type==='intervention'?'INT':'DAT'}</span> ${d.date}: ${d.type==='intervention' ? d.note : d.value}</span>${!isViewingDemo ? `<button onclick="window.deleteDataPoint(${i})" class="text-red-500 hover:text-red-700">x</button>` : ''}</div>`).join('');
    
    } else {
        const data = dataObj.paretoData || [];
        const sortedData = [...data].sort((a,b) => b.count - a.count);
        const total = sortedData.reduce((a,b) => a + Number(b.count), 0);
        let acc = 0;
        const percentages = sortedData.map(d => { acc += Number(d.count); return Math.round((acc/total)*100); });

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: sortedData.map(d => d.cat), datasets: [{ type: 'line', label: 'Cumulative %', data: percentages, borderColor: '#f36f21', yAxisID: 'y1' }, { type: 'bar', label: 'Frequency', data: sortedData.map(d => d.count), backgroundColor: '#2d2e83', yAxisID: 'y' }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, position: 'left' }, y1: { beginAtZero: true, position: 'right', max: 100 } } }
        });
        document.getElementById('data-history-list').innerHTML = sortedData.map((d,i)=>`<div class="flex justify-between text-sm border-b p-2"><span>${d.cat}: <b>${d.count}</b></span>${!isViewingDemo ? `<button onclick="window.deleteParetoPoint(${i})" class="text-red-500">x</button>` : ''}</div>`).join('');
    }
}

window.deleteDataPoint = (i) => { projectData.chartData.splice(i,1); saveData(); renderChart(); }
window.deleteParetoPoint = (i) => { projectData.paretoData.splice(i,1); saveData(); renderChart(); }
window.addDataPoint = () => { 
    if(isViewingDemo) return;
    const date = document.getElementById('chart-date').value; const type = document.getElementById('chart-type').value; const value = document.getElementById('chart-value').value; const note = document.getElementById('chart-note').value;
    if(date && (value || type === 'intervention')) { projectData.chartData.push({ date, value, type, note }); saveData(); renderChart(); }
}
window.addParetoData = () => { 
    if(isViewingDemo) return;
    projectData.paretoData.push({ cat: document.getElementById('pareto-cat').value, count: document.getElementById('pareto-count').value }); saveData(); renderChart();
}
window.handleBulkImport = () => {
    if(isViewingDemo) return;
    const raw = document.getElementById('bulk-text').value;
    const lines = raw.split('\n');
    let added = 0;
    lines.forEach(l => { const [d, v] = l.split(/\t|,/); if(d && v && !isNaN(parseFloat(v))) { projectData.chartData.push({ date: d.trim(), value: v.trim(), type: 'data' }); added++; } });
    saveData();
    document.getElementById('bulk-modal').classList.add('hidden');
    showToast(`Imported ${added} points`);
    renderChart();
}

// --- TOOLS (Diagrams) ---
window.setToolMode = (m) => { 
    toolMode = m; 
    toolZoom = 1.0;
    document.querySelectorAll('.tool-tab').forEach(btn => btn.className = 'tool-tab px-3 py-1.5 rounded-md transition-all bg-transparent text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700');
    const active = document.getElementById(`btn-${m}`);
    if(active) active.className = 'tool-tab px-3 py-1.5 rounded-md transition-all bg-rcem-purple text-white shadow-md transform scale-105';
    renderTools(); 
}

window.changeZoom = (delta) => {
    toolZoom = Math.max(0.5, Math.min(3.0, toolZoom + delta));
    const content = document.querySelector('.tool-content-inner');
    if(content) content.style.transform = `scale(${toolZoom})`;
    document.getElementById('zoom-display').innerText = `${Math.round(toolZoom * 100)}%`;
}

async function renderTools() {
    const container = document.getElementById('tool-canvas'); 
    const controls = document.getElementById('tool-controls'); 
    const dataObj = getData();
    
    let contentHtml = '';
    let controlHtml = '';
    
    // Helper to sanitize text for Mermaid
    const clean = (str) => str ? str.replace(/"/g, "'") : "..."; 

    const zoomControls = `
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 ml-auto">
            <button onclick="window.changeZoom(-0.1)" class="p-1 hover:bg-white rounded dark:hover:bg-slate-600"><i data-lucide="minus" class="w-4 h-4"></i></button>
            <span id="zoom-display" class="text-xs font-mono w-10 text-center">${Math.round(toolZoom*100)}%</span>
            <button onclick="window.changeZoom(0.1)" class="p-1 hover:bg-white rounded dark:hover:bg-slate-600"><i data-lucide="plus" class="w-4 h-4"></i></button>
        </div>
    `;

    if (toolMode === 'fishbone') {
        const cats = dataObj.fishbone.categories;
        const mermaidCode = `mindmap\n  root((PROBLEM))\n` + cats.map(c => `    ${c.text}\n` + c.causes.map(cause => `      ${clean(cause)}`).join('\n')).join('\n');
        contentHtml = `<div class="mermaid tool-content-inner origin-top-left transition-transform">${mermaidCode}</div>`;
        if(!isViewingDemo) controlHtml = cats.map(c => `<button onclick="window.addFish(${c.id})" class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">+ ${c.text}</button>`).join('');
    
    } else if (toolMode === 'driver') {
        const d = dataObj.drivers;
        let mermaidCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary Drivers]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((p,i) => mermaidCode += `  P --> P${i}["${clean(p)}"]\n`); 
        d.secondary.forEach((s,i) => mermaidCode += `  S --> S${i}["${clean(s)}"]\n`); 
        d.changes.forEach((c,i) => mermaidCode += `  C --> C${i}["${clean(c)}"]\n`);
        contentHtml = `<div class="mermaid tool-content-inner origin-top-left transition-transform">${mermaidCode}</div>`;
        if(!isViewingDemo) controlHtml = `<button onclick="window.addDriver('primary')" class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">+ Primary</button><button onclick="window.addDriver('secondary')" class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">+ Secondary</button><button onclick="window.addDriver('changes')" class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">+ Change Idea</button><button onclick="window.clearDrivers()" class="text-red-500 text-xs ml-2">Clear</button>`;

    } else if (toolMode === 'whys') {
        const whys = dataObj.fiveWhys || ["","","","",""];
        // FIXED: Added quotes around variables to handle parentheses safely
        let mermaidCode = `graph TD\n  Problem(Problem) --> W1[Why?]\n  W1 -->|Because...| A["${clean(whys[0])}"]\n`;
        if(whys[1]) mermaidCode += `  A --> W2[Why?]\n  W2 -->|Because...| B["${clean(whys[1])}"]\n`;
        if(whys[2]) mermaidCode += `  B --> W3[Why?]\n  W3 -->|Because...| C["${clean(whys[2])}"]\n`;
        if(whys[3]) mermaidCode += `  C --> W4[Why?]\n  W4 -->|Because...| D["${clean(whys[3])}"]\n`;
        if(whys[4]) mermaidCode += `  D --> W5[Why?]\n  W5 -->|Root Cause| E((("${clean(whys[4])}")))\n`;
        
        contentHtml = `<div class="mermaid tool-content-inner origin-top-left transition-transform">${mermaidCode}</div>`;
        if(!isViewingDemo) controlHtml = `<div class="flex flex-col gap-2 w-full max-w-md">${whys.map((w,i) => `<input placeholder="Why ${i+1}?" value="${w}" onchange="window.updateWhy(${i}, this.value)" class="border rounded px-2 py-1 text-sm">`).join('')}</div>`;

    } else if (toolMode === 'force') {
        const f = dataObj.forcefield || { driving:[], restraining:[] };
        contentHtml = `
            <div class="tool-content-inner origin-top-center transition-transform w-full max-w-4xl mx-auto grid grid-cols-3 gap-8 p-8">
                <div class="space-y-4">
                    <h4 class="font-bold text-emerald-600 text-center border-b pb-2">Driving Forces (Help)</h4>
                    ${f.driving.map(t => `<div class="bg-emerald-50 text-emerald-800 p-3 rounded shadow-sm text-center relative after:content-['➜'] after:absolute after:-right-6 after:top-1/2 after:-translate-y-1/2 after:text-emerald-300 after:text-xl">${t}</div>`).join('')}
                    ${!isViewingDemo ? `<button onclick="window.addForce('driving')" class="w-full py-2 border-2 border-dashed border-emerald-200 text-emerald-500 rounded hover:bg-emerald-50">+ Add</button>` : ''}
                </div>
                <div class="flex items-center justify-center">
                    <div class="bg-slate-800 text-white p-6 rounded-xl font-bold text-xl shadow-lg w-full text-center">
                        CHANGE PLAN
                        <div class="text-xs font-normal text-slate-400 mt-2">Status Quo</div>
                    </div>
                </div>
                <div class="space-y-4">
                    <h4 class="font-bold text-red-600 text-center border-b pb-2">Restraining Forces (Hinder)</h4>
                    ${f.restraining.map(t => `<div class="bg-red-50 text-red-800 p-3 rounded shadow-sm text-center relative before:content-['➜'] before:absolute before:-left-6 before:top-1/2 before:-translate-y-1/2 before:text-red-300 before:text-xl before:rotate-180">${t}</div>`).join('')}
                    ${!isViewingDemo ? `<button onclick="window.addForce('restraining')" class="w-full py-2 border-2 border-dashed border-red-200 text-red-500 rounded hover:bg-red-50">+ Add</button>` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = contentHtml;
    controls.innerHTML = (isViewingDemo ? '<span class="text-sm text-slate-500 italic mr-auto">View Only (Demo)</span>' : controlHtml) + zoomControls;
    
    if(toolMode !== 'force') {
        try { await mermaid.run(); } catch(e) { console.log("Mermaid Error", e); }
    }
    lucide.createIcons();
}

window.addFish = (id) => { const t=prompt("Cause:"); if(t){projectData.fishbone.categories.find(c=>c.id===id).causes.push(t); saveData(); renderTools();} }
window.addDriver = (k) => { const t=prompt("Item:"); if(t){projectData.drivers[k].push(t); saveData(); renderTools();} }
window.clearDrivers = () => { if(confirm("Clear?")){ projectData.drivers={primary:[],secondary:[],changes:[]}; saveData(); renderTools(); } }
window.updateWhy = (i, v) => { projectData.fiveWhys[i] = v; saveData(); renderTools(); }
window.addForce = (type) => { const t=prompt("Force:"); if(t){projectData.forcefield[type].push(t); saveData(); renderTools();} }

window.downloadDiagram = async () => {
    // If SVG (Mermaid)
    const svg = document.querySelector('#tool-canvas svg'); 
    if(svg) {
        const svgData = new XMLSerializer().serializeToString(svg); 
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); const img = new Image();
        img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); const a = document.createElement('a'); a.download = "diagram.png"; a.href = canvas.toDataURL("image/png"); a.click(); };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        return;
    }
    // If HTML (Force Field) - Simplified screenshot logic or alert
    if(toolMode === 'force') alert("Use your device's screenshot tool for the Force Field diagram.");
}

// --- PPTX EXPORT ---
window.exportPPTX = async () => {
    const data = getData();
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    // Slide 1: Title
    let slide1 = pptx.addSlide();
    slide1.addText(data.checklist.title || "Untitled QIP", { x: 1, y: 1.5, w: '80%', fontSize: 32, bold: true, color: '2d2e83' });
    slide1.addText(`Lead: ${data.checklist.lead || "Unknown"}`, { x: 1, y: 3, fontSize: 18 });
    slide1.addText("Generated by RCEM QIP Assistant", { x: 1, y: 5, fontSize: 12, color: '888888' });

    // Slide 2: Problem & Aim
    let slide2 = pptx.addSlide();
    slide2.addText("Problem & Aim", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    slide2.addText("The Problem:", { x: 0.5, y: 1.5, bold: true });
    slide2.addText(data.checklist.problem_desc || "...", { x: 0.5, y: 2, w: '90%', fontSize: 14 });
    slide2.addText("SMART Aim:", { x: 0.5, y: 3.5, bold: true });
    slide2.addText(data.checklist.aim || "...", { x: 0.5, y: 4, w: '90%', fontSize: 14, italic: true });

    // Slide 3: Run Chart (Capture canvas)
    let slide3 = pptx.addSlide();
    slide3.addText("Results (Run Chart)", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    const canvas = document.getElementById('mainChart');
    if(canvas) {
        const img = canvas.toDataURL("image/png");
        slide3.addImage({ data: img, x: 1, y: 1.5, w: 8, h: 4.5 });
    }

    pptx.writeFile({ fileName: 'RCEM_QIP_Presentation.pptx' });
    showToast("Downloading PowerPoint...");
}

// --- DASHBOARD & CHECKLIST ---
function renderDashboard() {
    const dataObj = getData();
    const filled = Object.values(dataObj.checklist || {}).filter(v => v).length;
    const progress = Math.min(100, Math.round((filled / 13) * 100)); // Updated count
    
    document.getElementById('stats-grid').innerHTML = `
        <div class="glass p-6 rounded-xl border-l-4 border-emerald-500"><div class="flex justify-between"><span class="text-slate-500">Checklist</span><i data-lucide="check-square" class="text-emerald-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${progress}%</div></div>
        <div class="glass p-6 rounded-xl border-l-4 border-blue-500"><div class="flex justify-between"><span class="text-slate-500">Cycles</span><i data-lucide="refresh-cw" class="text-blue-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${dataObj.pdsa.length}</div></div>
        <div class="glass p-6 rounded-xl border-l-4 border-amber-500"><div class="flex justify-between"><span class="text-slate-500">Data Points</span><i data-lucide="bar-chart-2" class="text-amber-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${dataObj.chartData.length}</div></div>
        <div class="glass p-6 rounded-xl border-l-4 border-purple-500"><div class="flex justify-between"><span class="text-slate-500">Strategy</span><i data-lucide="git-branch" class="text-purple-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${dataObj.drivers.changes.length}</div></div>
    `;
    document.getElementById('dashboard-aim').textContent = dataObj.checklist?.aim || "No aim defined.";
    
    if(!isViewingDemo && dataObj.chartData.length === 0 && dataObj.pdsa.length === 0 && !dataObj.checklist.title) {
        document.getElementById('get-started-card').classList.remove('hidden');
    } else {
        document.getElementById('get-started-card').classList.add('hidden');
    }
    renderCoach();
}

window.openSmartWizard = () => document.getElementById('smart-modal').classList.remove('hidden');
window.saveSmartAim = () => {
    if(isViewingDemo) return;
    const s = document.getElementById('smart-s').value; const m = document.getElementById('smart-m').value; const p = document.getElementById('smart-p').value; const t = document.getElementById('smart-t').value;
    projectData.checklist.aim = `To ${s || 'improve x'} for ${p || 'patients'} by ${m || 'a measurable amount'} by ${t || 'date'}.`; saveData(); document.getElementById('smart-modal').classList.add('hidden'); renderAll();
}

window.emailSupervisor = () => {
    const dataObj = getData();
    const subject = encodeURIComponent(`QIP Review: ${dataObj.checklist.title || 'Untitled'}`);
    const body = encodeURIComponent(`Dear Supervisor,\n\nPlease review my QIP.\n\nAIM: ${dataObj.checklist.aim || 'Not set'}\n\nSUMMARY: ${dataObj.checklist.results_summary || 'Not set'}\n\nLink: (Show them on your device)`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

window.openPortfolioExport = () => {
    const dataObj = getData();
    const modal = document.getElementById('portfolio-modal');
    const content = document.getElementById('portfolio-content');
    modal.classList.remove('hidden');

    const sections = [
        { title: "Project Title", val: dataObj.checklist.title },
        { title: "Problem Statement", val: dataObj.checklist.problem_desc },
        { title: "SMART Aim", val: dataObj.checklist.aim },
        { title: "Intervention (Driver Diagram Summary)", val: `Primary Drivers: ${dataObj.drivers.primary.join(', ')}. \nChange Ideas: ${dataObj.drivers.changes.join(', ')}.` },
        { title: "Results Summary", val: dataObj.checklist.results_summary },
        { title: "PDSA Cycles", val: dataObj.pdsa.map(p => `${p.title}: ${p.plan} -> ${p.act}`).join('\n\n') },
        { title: "Learning & Reflection", val: dataObj.checklist.learning },
        { title: "Sustainability Plan", val: dataObj.checklist.sustainability_plan }
    ];

    content.innerHTML = sections.map(s => `
        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">${s.title}</h4>
                <button onclick="window.copyText(this.dataset.val)" data-val="${escapeHtml(s.val || 'Not completed')}" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                    <i data-lucide="copy" class="w-3 h-3"></i> Copy
                </button>
            </div>
            <div class="text-sm text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">${s.val || '<span class="italic text-slate-400">Not completed yet</span>'}</div>
        </div>
    `).join('');
    lucide.createIcons();
}
window.copyText = (text) => { navigator.clipboard.writeText(text).then(() => showToast("Copied to Clipboard")); }

window.updatePoster = () => {
    const dataObj = getData();
    document.getElementById('poster-title').textContent = dataObj.checklist.title || 'Untitled QIP'; 
    document.getElementById('poster-team').textContent = dataObj.checklist.team || 'Team'; 
    document.getElementById('poster-problem').textContent = dataObj.checklist.problem_desc || 'No problem defined.'; 
    document.getElementById('poster-aim').textContent = dataObj.checklist.aim || 'No aim defined.'; 
    document.getElementById('poster-results').textContent = dataObj.checklist.results_summary || 'No results yet.'; 
    document.getElementById('poster-learning').textContent = dataObj.checklist.learning || 'No conclusion yet.'; 
    document.getElementById('poster-pdsa').innerHTML = dataObj.pdsa.slice(0,3).map(c => `<div><strong>${c.title}:</strong> ${c.act}</div>`).join('');
    const chartCanvas = document.getElementById('mainChart'); if(chartCanvas) document.getElementById('poster-chart').src = chartCanvas.toDataURL();
    const d = dataObj.drivers; document.getElementById('poster-driver').innerHTML = `<ul class="list-disc pl-5 text-sm"><li>Primary: ${d.primary.join(', ')}</li><li>Secondary: ${d.secondary.join(', ')}</li><li>Changes: ${d.changes.join(', ')}</li></ul>`;
}

window.generateReport = () => {
    const dataObj = getData();
    const el = document.getElementById('report-template'); el.classList.remove('hidden');
    document.getElementById('rep-title').textContent = dataObj.checklist.title || 'Untitled'; 
    document.getElementById('rep-lead').textContent = dataObj.checklist.lead || ''; 
    document.getElementById('rep-team').textContent = dataObj.checklist.team || ''; 
    document.getElementById('rep-problem').textContent = dataObj.checklist.problem_desc || ''; 
    document.getElementById('rep-aim').textContent = dataObj.checklist.aim || ''; 
    document.getElementById('rep-driver-list').textContent = `Primary: ${dataObj.drivers.primary.join(', ')}. Interventions: ${dataObj.drivers.changes.join(', ')}.`; 
    document.getElementById('rep-pdsa-list').innerHTML = dataObj.pdsa.map(c => `<div><strong>${c.title}:</strong> ${c.act}</div>`).join(''); 
    document.getElementById('rep-results').textContent = dataObj.checklist.results_summary || ''; 
    document.getElementById('rep-learning').textContent = dataObj.checklist.learning || '';
    const canvas = document.getElementById('mainChart'); if(canvas) document.getElementById('rep-chart-img').src = canvas.toDataURL();
    html2pdf().from(el).set({ margin: 0.5, filename: 'RCEM_QIP_Report.pdf' }).save().then(() => el.classList.add('hidden'));
}

function renderChecklist() {
    const dataObj = getData();
    const checklistConfig = [
        { title: "1. Problem & Diagnosis", icon: "alert-circle", fields: ["title", "lead", "team", "problem_desc", "evidence"], placeholders: ["Sepsis 6 Compliance", "Dr. Name", "Nurses, Consultants", "Only 40% of patients get Abx in 1h", "Local audit 2024 data"] },
        { title: "2. Aim & Measures", icon: "target", fields: ["aim", "outcome_measures", "process_measures", "balance_measures"], placeholders: ["To improve X by Y date", "Time to Antibiotics (mins)", "Screening Tool Usage %", "Delays in other areas"] },
        { title: "3. Strategy & Change", icon: "git-branch", fields: ["strategy_summary"], desc:"Summarize driver diagram here", placeholders: ["Focus on education and grab bags"] },
        { title: "4. Results", icon: "bar-chart-2", fields: ["results_summary", "learning"], placeholders: ["Compliance rose to 85%", "Staff engagement was key"] },
        { title: "5. Sustainability & Spread", icon: "repeat", fields: ["sustainability_plan", "spread_plan"], placeholders: ["Added to induction handbook, Monthly Audit scheduled", "Presented at Regional Governance meeting"] }
    ];

    document.getElementById('checklist-container').innerHTML = checklistConfig.map((sec, i) => `
        <details class="glass rounded-xl shadow-sm overflow-hidden group" ${i===0?'open':''}>
            <summary class="px-6 py-4 flex items-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-800"><i data-lucide="${sec.icon}" class="text-rcem-purple dark:text-indigo-400 w-5 h-5"></i><h3 class="font-semibold text-slate-800 dark:text-white flex-1">${sec.title}</h3></summary>
            <div class="p-6 space-y-4">${sec.fields.map((f, idx) => `<div><label class="flex justify-between text-sm font-medium dark:text-slate-300 capitalize mb-1"><span>${f.replace(/_/g,' ')}</span><button onclick="window.copyText(this.parentElement.nextElementSibling.value)" class="text-xs text-indigo-500 hover:text-indigo-700"><i data-lucide="copy" class="w-3 h-3 inline"></i> Copy</button></label><textarea ${isViewingDemo ? 'disabled' : ''} onchange="projectData.checklist['${f}']=this.value;saveData()" class="w-full rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900 p-2 text-sm disabled:opacity-50" placeholder="e.g. ${sec.placeholders?.[idx] || 'Enter details...'}">${dataObj.checklist[f]||''}</textarea></div>`).join('')}</div>
        </details>`).join('');
}

function renderGantt() {
    const dataObj = getData();
    const container = document.getElementById('gantt-chart-area'); const tasks = dataObj.gantt || [];
    if(tasks.length === 0) { container.innerHTML = `<div class="text-center text-slate-400 mt-10">No tasks added yet.</div>`; return; }
    const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]); const min = new Date(Math.min(...dates)); const max = new Date(Math.max(...dates)); const totalTime = Math.max(1, max - min) + (1000*60*60*24*10); 
    document.getElementById('gantt-range').textContent = `Timeline (${min.toLocaleDateString()} - ${max.toLocaleDateString()})`;
    container.innerHTML = tasks.map(t => { const start = new Date(t.start); const end = new Date(t.end); const left = ((start - min) / totalTime) * 100; const width = Math.max(2, ((end - start) / totalTime) * 100); return `<div class="relative mb-4 flex items-center z-10"><div class="w-1/4 pr-4 flex items-center justify-between"><span class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">${escapeHtml(t.name)}</span>${!isViewingDemo ? `<button onclick="window.removeGanttTask('${t.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}</div><div class="flex-1 relative h-8 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="absolute top-0 h-full rounded-full shadow-sm flex items-center px-2 text-xs text-white bg-rcem-purple whitespace-nowrap overflow-hidden" style="left: ${left}%; width: ${width}%">${t.status}</div></div></div>`; }).join('');
}
window.addGanttTask = () => { if(isViewingDemo) return; projectData.gantt.push({ id:Date.now(), name:document.getElementById('gantt-name').value, start:document.getElementById('gantt-start').value, end:document.getElementById('gantt-end').value, status:document.getElementById('gantt-status').value }); saveData(); renderGantt(); }
window.removeGanttTask = (id) => { projectData.gantt = projectData.gantt.filter(t => t.id !== id); saveData(); renderGantt(); };

function renderPDSA() {
    const dataObj = getData();
    const container = document.getElementById('pdsa-list');

    if(dataObj.pdsa.length === 0) {
        container.innerHTML = `<div class="opacity-60 border-2 border-dashed border-slate-300 p-6 rounded-xl bg-slate-50 pointer-events-none select-none text-center">No PDSA Cycles yet. Click 'New Cycle' to begin.</div>`;
        return;
    }

    container.innerHTML = dataObj.pdsa.map(c => `
        <div class="glass rounded-xl shadow-sm overflow-hidden mb-4">
            <div class="px-6 py-4 bg-slate-50/50 dark:bg-slate-700 border-b dark:border-slate-600 flex justify-between">
                <h4 class="font-bold dark:text-white text-rcem-purple">${c.title} (${c.date})</h4>
                <div class="flex gap-2"><button onclick="window.copyText('${c.plan} ${c.do} ${c.study} ${c.act}')" class="text-indigo-500 text-xs">Copy All</button>${!isViewingDemo ? `<button onclick="window.deletePDSA('${c.id}')" class="text-red-500 hover:text-red-700 text-xs">Delete</button>` : ''}</div>
            </div>
            <div class="p-4 grid grid-cols-2 gap-4">
                ${['Plan','Do','Study','Act'].map(s=>`<div><label class="text-xs font-bold dark:text-slate-300 uppercase">${s}</label><textarea ${isViewingDemo?'disabled':''} onchange="window.updatePDSA('${c.id}','${s.toLowerCase()}',this.value)" class="w-full text-sm p-2 border rounded dark:bg-slate-900 dark:border-slate-600 h-20 disabled:opacity-50" placeholder="Enter details...">${c[s.toLowerCase()]||''}</textarea></div>`).join('')}
            </div>
        </div>`).join('');
}
window.addPDSACycle = () => { if(isViewingDemo) return; const d = new Date().toLocaleDateString(); projectData.pdsa.unshift({ id: Date.now().toString(), title: `Cycle ${projectData.pdsa.length+1}`, date: d }); saveData(); renderPDSA(); }
window.updatePDSA = (id,f,v) => { projectData.pdsa.find(c=>c.id===id)[f]=v; saveData(); }
window.deletePDSA = (id) => { if(confirm('Delete?')) { projectData.pdsa=projectData.pdsa.filter(c=>c.id!==id); saveData(); renderPDSA(); } }

window.calcCarbon = () => { document.getElementById('green-result').textContent = `Total: ${(document.getElementById('green-item').value * document.getElementById('green-qty').value).toFixed(2)} kg CO2e`; document.getElementById('green-result').classList.remove('hidden'); }
window.resetProject = async () => { if(isViewingDemo) return; if(confirm("Delete all data?")) { projectData={checklist:{},fishbone:{categories:[]},drivers:{primary:[],secondary:[],changes:[]},forcefield:{driving:[],restraining:[]},swot:{s:[],w:[],o:[],t:[]},fiveWhys:["","","","",""],gantt:[],pdsa:[],chartData:[],paretoData:[],chartGoal:null}; await saveData(); location.reload(); } }
window.downloadJSON = () => { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(projectData)); a.download = "qip_backup.json"; a.click(); }
window.restoreJSON = (i) => { if(isViewingDemo) return; const r = new FileReader(); r.onload = (e) => { projectData = JSON.parse(e.target.result); saveData(); location.reload(); }; r.readAsText(i.files[0]); }

lucide.createIcons();
router('dashboard');
