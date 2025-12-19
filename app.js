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
let isDemoUser = false; // "Demo User" (Logged out)
let isViewingDemo = false; // "Viewing Demo" (Logged in but looking at example)

// The "Gold Standard" Example Data
const demoData = {
    checklist: {
        title: "Improving Sepsis 6 Bundle Delivery", lead: "Dr. Demo", aim: "To increase Sepsis 6 delivery within 1 hour from 45% to 90% by Dec 2025.",
        problem_desc: "Audit showed only 45% of patients get abx in <1h.", results_summary: "Achieved 85% compliance after 3 cycles."
    },
    fishbone: { categories: [{id:1, text:"People", causes:["Locum staff"]}, {id:2, text:"Methods", causes:["No protocol"]}, {id:3, text:"Equipment", causes:["Missing kits"]}, {id:4, text:"Env", causes:["Crowding"]}] },
    drivers: { primary: ["Reliable Identification", "Timely Delivery"], secondary: ["Triage Screening", "Grab Bags"], changes: ["Sepsis Stamp", "Pre-made kits"] },
    forcefield: { driving: [], restraining: [] },
    swot: { s: [], w: [], o: [], t: [] },
    fiveWhys: ["","","","",""],
    gantt: [],
    pdsa: [{id:1, title:"Cycle 1: Sepsis Stamp", date:"2025-01-16", plan:"Stamp notes at triage", do:"Trialled for 1 week", study:"Compliance rose to 65%", act:"Adopt"}],
    chartData: [
        {date:"2025-01-01", value:45, type:"data"}, {date:"2025-01-08", value:42, type:"data"},
        {date:"2025-01-15", value:50, type:"data"}, {date:"2025-01-16", value:0, type:"intervention", note:"PDSA 1: Sepsis Stamp"},
        {date:"2025-01-22", value:65, type:"data"}, {date:"2025-01-29", value:70, type:"data"},
        {date:"2025-02-05", value:85, type:"data"}, {date:"2025-02-12", value:88, type:"data"}
    ],
    paretoData: [],
    chartGoal: 90
};

// Current user data
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
            // Structure Check
            if(!projectData.fishbone || !projectData.fishbone.categories) projectData.fishbone = { categories: [{id:1, text:"People", causes:[]}, {id:2, text:"Methods", causes:[]}, {id:3, text:"Equipment", causes:[]}, {id:4, text:"Environment", causes:[]}] };
            if(!projectData.drivers) projectData.drivers = { primary: [], secondary: [], changes: [] };
            if(!projectData.fiveWhys) projectData.fiveWhys = ["","","","",""];
            if(!projectData.forcefield) projectData.forcefield = { driving: [], restraining: [] };
        }
        if (!isViewingDemo) renderAll();
    });
}

async function saveData() { 
    // Block save if viewing demo or if demo user
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

// Global Shortcuts
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
    
    // Update Goal Input based on view
    const data = getData();
    if(document.getElementById('chart-goal')) document.getElementById('chart-goal').value = data.chartGoal || '';
}

// --- QI COACH ---
function renderCoach() {
    const dataObj = getData();
    const coachEl = document.getElementById('qi-coach');
    const titleEl = document.getElementById('coach-title');
    const msgEl = document.getElementById('coach-msg');
    const btnEl = document.getElementById('coach-action');

    if (!coachEl) return; 

    // Hide if viewing demo (as it's already "perfect")
    if (isViewingDemo) {
        coachEl.classList.add('hidden');
        return;
    }

    let step = {};

    // LOGIC CHAIN
    if (!dataObj.checklist.title || !dataObj.checklist.problem_desc) {
        step = { title: "Define the Problem", msg: "A good QIP starts with a clear problem. Use the Checklist to define what is wrong.", action: "checklist", btn: "Go to Checklist" };
    } else if (!dataObj.checklist.aim) {
        step = { title: "Set a SMART Aim", msg: "You have a problem, but no target. Use the SMART Wizard to set a specific goal.", action: "dashboard-aim", btn: "Open Wizard" };
    } else if (dataObj.drivers.changes.length === 0) {
        step = { title: "Plan your Strategy", msg: "How will you hit your aim? Create a Driver Diagram to map out your change ideas.", action: "tools", btn: "Go to Tools" };
    } else if (dataObj.chartData.length < 5) {
        step = { title: "Collect Baseline Data", msg: "Before making changes, you need 5-10 baseline data points to understand the current process.", action: "data", btn: "Add Data" };
    } else if (dataObj.pdsa.length === 0) {
        step = { title: "Start PDSA Cycle 1", msg: "You have baseline data. Now pick one change idea from your strategy and test it.", action: "pdsa", btn: "Start PDSA" };
    } else if (dataObj.checklist.results_summary === undefined || dataObj.checklist.results_summary === "") {
        step = { title: "Summarize Results", msg: "You have data and cycles. Now summarize your findings in the Checklist for your report.", action: "checklist", btn: "Update Checklist" };
    } else {
        // Project largely complete
        coachEl.classList.add('hidden');
        return;
    }

    // Render
    titleEl.textContent = step.title;
    msgEl.textContent = step.msg;
    btnEl.innerHTML = `${step.btn} <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    
    // Action Handlers
    btnEl.onclick = () => {
        if(step.action === 'dashboard-aim') { window.openSmartWizard(); }
        else { window.router(step.action); }
    };

    coachEl.classList.remove('hidden');
}


// --- CHARTING ENGINE ---
window.setChartMode = (m) => { chartMode = m; 
    document.getElementById('input-run').classList.toggle('hidden', m!=='run');
    document.getElementById('input-pareto').classList.toggle('hidden', m!=='pareto');
    document.getElementById('chart-input-title').textContent = m==='run' ? 'Add Data / Intervention' : 'Add Pareto Category';
    renderChart();
    
    // Toggle active buttons
    document.getElementById('btn-chart-run').className = m==='run' ? "bg-rcem-purple text-white px-3 py-1.5 rounded text-sm shadow" : "bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm";
    document.getElementById('btn-chart-pareto').className = m==='pareto' ? "bg-rcem-purple text-white px-3 py-1.5 rounded text-sm shadow" : "bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm";
}

window.updateGoal = () => { 
    if(isViewingDemo) return; 
    projectData.chartGoal = document.getElementById('chart-goal').value; 
    saveData(); 
    renderChart(); 
}
window.validateDate = (input) => {
    const d = new Date(input.value); const now = new Date();
    if(d > now) alert("Note: You entered a future date. Ensure this is intentional planning.");
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    
    const dataObj = getData();

    if (chartMode === 'run') {
        const data = dataObj.chartData || [];
        // Sort by date
        const sortedData = [...data].sort((a,b) => new Date(a.date) - new Date(b.date));
        const dataPoints = sortedData.filter(d => d.type !== 'intervention');
        
        const values = dataPoints.map(d => parseFloat(d.value));
        const sortedVals = [...values].sort((a,b)=>a-b);
        const mid = Math.floor(sortedVals.length/2);
        const median = sortedVals.length%2!==0 ? sortedVals[mid] : (sortedVals[mid-1]+sortedVals[mid])/2;
        
        const pointColors = values.map((v, i) => {
            if (i < 5) return '#2d2e83'; 
            const subset = values.slice(i-5, i+1);
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
    if(date && (value || type === 'intervention')) { projectData.chartData.push({ date, value, type, note }); saveData(); }
}
window.addParetoData = () => { 
    if(isViewingDemo) return;
    projectData.paretoData.push({ cat: document.getElementById('pareto-cat').value, count: document.getElementById('pareto-count').value }); saveData(); 
}
window.handleBulkImport = () => {
    if(isViewingDemo) return;
    const raw = document.getElementById('bulk-text').value;
    const lines = raw.split('\n');
    let added = 0;
    lines.forEach(l => {
        const [d, v] = l.split(/\t|,/); // Split by tab or comma
        if(d && v && !isNaN(parseFloat(v))) {
            projectData.chartData.push({ date: d.trim(), value: v.trim(), type: 'data' });
            added++;
        }
    });
    saveData();
    document.getElementById('bulk-modal').classList.add('hidden');
    showToast(`Imported ${added} points`);
}

// --- MERMAID ---
window.setToolMode = (m) => { 
    toolMode = m; 
    
    // Highlight Active Button
    document.querySelectorAll('.tool-tab').forEach(btn => {
        btn.className = 'tool-tab px-3 py-1.5 rounded-md transition-all bg-transparent text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700';
    });
    const active = document.getElementById(`btn-${m}`);
    if(active) active.className = 'tool-tab px-3 py-1.5 rounded-md transition-all bg-rcem-purple text-white shadow-md transform scale-105';

    renderTools(); 
}

async function renderTools() {
    const container = document.getElementById('tool-canvas'); const controls = document.getElementById('tool-controls'); let mermaidCode = '';
    const dataObj = getData();

    if (toolMode === 'fishbone') {
        const cats = dataObj.fishbone.categories;
        mermaidCode = `mindmap\n  root((PROBLEM))\n`; cats.forEach(c => { mermaidCode += `    ${c.text}\n`; c.causes.forEach(cause => mermaidCode += `      ${cause}\n`); });
        
        if(!isViewingDemo) {
            controls.innerHTML = cats.map(c => `<button onclick="window.addFish(${c.id})" class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">+ ${c.text}</button>`).join('');
        } else controls.innerHTML = '<span class="text-sm text-slate-500 italic">View Only (Demo)</span>';

    } else if (toolMode === 'driver') {
        const d = dataObj.drivers;
        mermaidCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary Drivers]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((p,i) => mermaidCode += `  P --> P${i}[${p}]\n`); d.secondary.forEach((s,i) => mermaidCode += `  S --> S${i}[${s}]\n`); d.changes.forEach((c,i) => mermaidCode += `  C --> C${i}[${c}]\n`);
        
        if(!isViewingDemo) {
            controls.innerHTML = `<button onclick="window.addDriver('primary')" class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">+ Primary</button><button onclick="window.addDriver('secondary')" class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">+ Secondary</button><button onclick="window.addDriver('changes')" class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">+ Change Idea</button><button onclick="window.clearDrivers()" class="text-red-500 text-xs ml-2">Clear</button>`;
        } else controls.innerHTML = '<span class="text-sm text-slate-500 italic">View Only (Demo)</span>';

    } else { container.innerHTML = `<div class="text-slate-400">Select Fishbone or Driver for Vector Diagrams.</div>`; controls.innerHTML = ''; return; }
    container.innerHTML = `<div class="mermaid">${mermaidCode}</div>`; try { await mermaid.run(); } catch(e) { console.log(e); }
}
window.addFish = (id) => { const t=prompt("Cause:"); if(t){projectData.fishbone.categories.find(c=>c.id===id).causes.push(t); saveData(); renderTools();} }
window.addDriver = (k) => { const t=prompt("Item:"); if(t){projectData.drivers[k].push(t); saveData(); renderTools();} }
window.clearDrivers = () => { if(confirm("Clear?")){ projectData.drivers={primary:[],secondary:[],changes:[]}; saveData(); renderTools(); } }
window.downloadDiagram = async () => {
    const svg = document.querySelector('#tool-canvas svg'); if(!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg); const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d"); const img = new Image();
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); const a = document.createElement('a'); a.download = "diagram.png"; a.href = canvas.toDataURL("image/png"); a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

// --- DASHBOARD & CHECKLIST ---
function renderDashboard() {
    const dataObj = getData();
    const filled = Object.values(dataObj.checklist || {}).filter(v => v).length;
    const progress = Math.min(100, Math.round((filled / 10) * 100));
    document.getElementById('stats-grid').innerHTML = `<div class="glass p-6 rounded-xl"><div class="flex justify-between"><span class="text-slate-500">Checklist</span><i data-lucide="check-square" class="text-emerald-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${progress}%</div></div><div class="glass p-6 rounded-xl"><div class="flex justify-between"><span class="text-slate-500">Cycles</span><i data-lucide="refresh-cw" class="text-blue-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${dataObj.pdsa.length}</div></div><div class="glass p-6 rounded-xl"><div class="flex justify-between"><span class="text-slate-500">Data</span><i data-lucide="bar-chart-2" class="text-amber-500 w-6 h-6"></i></div><div class="text-3xl font-bold dark:text-white">${dataObj.chartData.length}</div></div>`;
    document.getElementById('dashboard-aim').textContent = dataObj.checklist?.aim || "No aim defined.";
    
    // Empty State Logic (Only show if not demo)
    if(!isViewingDemo && dataObj.chartData.length === 0 && dataObj.pdsa.length === 0 && !dataObj.checklist.title) {
        document.getElementById('get-started-card').classList.remove('hidden');
    } else {
        document.getElementById('get-started-card').classList.add('hidden');
    }

    renderCoach(); // NEW: Trigger Coach logic
}
window.openSmartWizard = () => document.getElementById('smart-modal').classList.remove('hidden');
window.saveSmartAim = () => {
    if(isViewingDemo) return;
    const s = document.getElementById('smart-s').value; const m = document.getElementById('smart-m').value; const p = document.getElementById('smart-p').value; const t = document.getElementById('smart-t').value;
    projectData.checklist.aim = `To ${s || 'improve x'} for ${p || 'patients'} by ${m || 'a measurable amount'} by ${t || 'date'}.`; saveData(); document.getElementById('smart-modal').classList.add('hidden');
}

window.emailSupervisor = () => {
    const dataObj = getData();
    const subject = encodeURIComponent(`QIP Review: ${dataObj.checklist.title || 'Untitled'}`);
    const body = encodeURIComponent(`Dear Supervisor,\n\nPlease review my QIP.\n\nAIM: ${dataObj.checklist.aim || 'Not set'}\n\nSUMMARY: ${dataObj.checklist.results_summary || 'Not set'}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// NEW: PORTFOLIO EXPORT
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

window.copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied to Clipboard"));
}

window.updatePoster = () => {
    const dataObj = getData();
    document.getElementById('poster-title').textContent = dataObj.checklist.title || 'Untitled QIP'; document.getElementById('poster-team').textContent = dataObj.checklist.team || 'Team'; document.getElementById('poster-problem').textContent = dataObj.checklist.problem_desc || 'No problem defined.'; document.getElementById('poster-aim').textContent = dataObj.checklist.aim || 'No aim defined.'; document.getElementById('poster-results').textContent = dataObj.checklist.results_summary || 'No results yet.'; document.getElementById('poster-learning').textContent = dataObj.checklist.learning || 'No conclusion yet.'; document.getElementById('poster-pdsa').innerHTML = dataObj.pdsa.slice(0,3).map(c => `<div><strong>${c.title}:</strong> ${c.act}</div>`).join('');
    const chartCanvas = document.getElementById('mainChart'); if(chartCanvas) document.getElementById('poster-chart').src = chartCanvas.toDataURL();
    const d = dataObj.drivers; document.getElementById('poster-driver').innerHTML = `<ul class="list-disc pl-5 text-sm"><li>Primary: ${d.primary.join(', ')}</li><li>Secondary: ${d.secondary.join(', ')}</li><li>Changes: ${d.changes.join(', ')}</li></ul>`;
}

window.generateReport = () => {
    const dataObj = getData();
    const el = document.getElementById('report-template'); el.classList.remove('hidden');
    document.getElementById('rep-title').textContent = dataObj.checklist.title || 'Untitled'; document.getElementById('rep-lead').textContent = dataObj.checklist.lead || ''; document.getElementById('rep-team').textContent = dataObj.checklist.team || ''; document.getElementById('rep-problem').textContent = dataObj.checklist.problem_desc || ''; document.getElementById('rep-aim').textContent = dataObj.checklist.aim || ''; document.getElementById('rep-driver-list').textContent = `Primary: ${dataObj.drivers.primary.join(', ')}. Interventions: ${dataObj.drivers.changes.join(', ')}.`; document.getElementById('rep-pdsa-list').innerHTML = dataObj.pdsa.map(c => `<div><strong>${c.title}:</strong> ${c.act}</div>`).join(''); document.getElementById('rep-results').textContent = dataObj.checklist.results_summary || ''; document.getElementById('rep-learning').textContent = dataObj.checklist.learning || '';
    const canvas = document.getElementById('mainChart'); if(canvas) document.getElementById('rep-chart-img').src = canvas.toDataURL();
    html2pdf().from(el).set({ margin: 0.5, filename: 'RCEM_QIP_Report.pdf' }).save().then(() => el.classList.add('hidden'));
}

// --- RENDERERS ---
function renderChecklist() {
    const dataObj = getData();
    // UPDATED CHECKLIST with SUSTAINABILITY
    const checklistConfig = [
        { title: "1. Problem & Diagnosis", icon: "alert-circle", fields: ["title", "lead", "team", "problem_desc", "evidence"], placeholders: ["Sepsis 6 Compliance", "Dr. Name", "Nurses, Consultants", "Only 40% of patients get Abx in 1h", "Local audit 2024 data"] },
        { title: "2. Aim & Measures", icon: "target", fields: ["aim", "outcome_measures", "process_measures", "balance_measures"], placeholders: ["To improve X by Y date", "Time to Antibiotics (mins)", "Screening Tool Usage %", "Delays in other areas"] },
        { title: "3. Strategy & Change", icon: "git-branch", fields: ["strategy_summary"], desc:"Summarize driver diagram here", placeholders: ["Focus on education and grab bags"] },
        { title: "4. Results", icon: "bar-chart-2", fields: ["results_summary", "learning"], placeholders: ["Compliance rose to 85%", "Staff engagement was key"] },
        // NEW SECTION
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
    container.innerHTML = tasks.map(t => { const start = new Date(t.start); const end = new Date(t.end); const left = ((start - min) / totalTime) * 100; const width = Math.max(2, ((end - start) / totalTime) * 100); return `<div class="relative mb-4 flex items-center z-10"><div class="w-1/4 pr-4 flex items-center justify-between"><span class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">${escapeHtml(t.name)}</span>${!isViewingDemo ? `<button onclick="window.removeGanttTask('${t.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}</div><div class="flex-1 relative h-8 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="absolute top-0 h-full rounded-full shadow-sm flex items-center px-2 text-xs text-white bg-rcem-purple" style="left: ${left}%; width: ${width}%">${t.status}</div></div></div>`; }).join('');
}
window.addGanttTask = () => { if(isViewingDemo) return; projectData.gantt.push({ id:Date.now(), name:document.getElementById('gantt-name').value, start:document.getElementById('gantt-start').value, end:document.getElementById('gantt-end').value, status:document.getElementById('gantt-status').value }); saveData(); }
window.removeGanttTask = (id) => { projectData.gantt = projectData.gantt.filter(t => t.id !== id); saveData(); };

function renderPDSA() {
    const dataObj = getData();
    const container = document.getElementById('pdsa-list');

    // GHOST PDSA Logic
    if(dataObj.pdsa.length === 0) {
        container.innerHTML = `
            <div class="opacity-60 border-2 border-dashed border-slate-300 p-6 rounded-xl bg-slate-50 pointer-events-none select-none">
                <div class="font-bold text-slate-500 mb-4 flex items-center gap-2"><i data-lucide="ghost" class="w-4 h-4"></i> Example Cycle (How it should look)</div>
                <div class="grid grid-cols-2 gap-4 text-sm filter blur-[0.5px]">
                    <div><strong class="text-xs uppercase text-slate-400">Plan</strong><div class="p-2 border rounded bg-white">Trial sepsis stamp on 5 patients.</div></div>
                    <div><strong class="text-xs uppercase text-slate-400">Do</strong><div class="p-2 border rounded bg-white">Stamp was lost on day 2.</div></div>
                    <div><strong class="text-xs uppercase text-slate-400">Study</strong><div class="p-2 border rounded bg-white">Only 2 notes stamped.</div></div>
                    <div><strong class="text-xs uppercase text-slate-400">Act</strong><div class="p-2 border rounded bg-white">Tie stamp to desk. Re-test.</div></div>
                </div>
                <div class="mt-4 text-center text-rcem-purple font-bold flex items-center justify-center gap-2 animate-pulse">
                    <i data-lucide="arrow-up"></i> Click "New Cycle" to start yours
                </div>
            </div>`;
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
window.addPDSACycle = () => { 
    if(isViewingDemo) return;
    const d = new Date().toLocaleDateString();
    projectData.pdsa.unshift({ id: Date.now().toString(), title: `Cycle ${projectData.pdsa.length+1}`, date: d }); 
    saveData(); 
}
window.updatePDSA = (id,f,v) => { projectData.pdsa.find(c=>c.id===id)[f]=v; saveData(); }
window.deletePDSA = (id) => { if(confirm('Delete?')) { projectData.pdsa=projectData.pdsa.filter(c=>c.id!==id); saveData(); } }

// Green ED
window.calcCarbon = () => { document.getElementById('green-result').textContent = `Total: ${(document.getElementById('green-item').value * document.getElementById('green-qty').value).toFixed(2)} kg CO2e`; document.getElementById('green-result').classList.remove('hidden'); }

window.resetProject = async () => { if(isViewingDemo) return; if(confirm("Delete all data?")) { projectData={checklist:{},fishbone:{categories:[]},drivers:{primary:[],secondary:[],changes:[]},forcefield:{driving:[],restraining:[]},swot:{s:[],w:[],o:[],t:[]},fiveWhys:["","","","",""],gantt:[],pdsa:[],chartData:[],paretoData:[],chartGoal:null}; await saveData(); location.reload(); } }
window.downloadJSON = () => { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(projectData)); a.download = "qip_backup.json"; a.click(); }
window.restoreJSON = (i) => { if(isViewingDemo) return; const r = new FileReader(); r.onload = (e) => { projectData = JSON.parse(e.target.result); saveData(); location.reload(); }; r.readAsText(i.files[0]); }

lucide.createIcons();
router('dashboard');
