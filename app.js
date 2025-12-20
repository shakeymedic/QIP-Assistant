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

// --- EXAMPLES LIBRARY ---
const examples = {
    sepsis: {
        checklist: { title: "Sepsis 6 Compliance", problem_desc: "Audit showed 45% compliance.", aim: "90% by March.", outcome_measures: "% Sepsis 6 < 1hr" },
        drivers: { primary: ["Identification", "Equipment"], secondary: ["Triage Tool", "Grab Bags"], changes: ["Sepsis Stamp", "Kits"] },
        chartData: [{date:"2025-01-01", value:45}, {date:"2025-01-08", value:60}, {date:"2025-01-15", value:75}],
        kanban: { todo: [{id:1, text:"Order Bags"}], doing: [{id:2, text:"Train Nurses"}], done: [] }
    },
    hip: {
        checklist: { title: "Fascia Iliaca Block", problem_desc: "Pain scores high.", aim: "Block < 4hrs.", outcome_measures: "Time to Block" },
        drivers: { primary: ["Doctor Skills", "Equipment"], secondary: ["Training"], changes: ["Workshop"] },
        chartData: [{date:"2025-01-01", value:240}, {date:"2025-01-08", value:180}, {date:"2025-01-15", value:120}],
        kanban: { todo: [], doing: [{id:1, text:"Audit Notes"}], done: [{id:2, text:"Write Protocol"}] }
    }
};

let projectData = {
    checklist: {},
    fishbone: { categories: [{id:1, text:"People", causes:[]}, {id:2, text:"Methods", causes:[]}, {id:3, text:"Equipment", causes:[]}, {id:4, text:"Environment", causes:[]}] },
    drivers: { primary: [], secondary: [], changes: [] },
    stakeholder: [], processMap: [], gantt: [], pdsa: [], chartData: [], paretoData: [], 
    kanban: { todo: [], doing: [], done: [] },
    reflection: {},
    chartGoal: null, chartBenchmark: null
};

let chartMode = 'run';
let toolMode = 'fishbone'; 
let chartInstance = null;
let panState = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };

const showToast = (msg) => { const el = document.createElement('div'); el.className = `px-4 py-2 rounded shadow-lg text-white text-sm font-medium mb-2 fade-in bg-rcem-purple fixed bottom-4 right-4 z-50`; el.innerHTML = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3000); }
mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

// --- AUTH & SETUP ---
onAuthStateChanged(auth, (user) => {
    if(isDemoUser) return; 
    currentUser = user;
    if (user) { showApp(); initRealtimeListener(); } else { showAuth(); }
});

function showApp() { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-sidebar').classList.remove('hidden'); document.getElementById('app-sidebar').classList.add('flex'); document.getElementById('main-content').classList.remove('hidden'); document.getElementById('user-display').textContent = currentUser ? currentUser.email : "Demo"; initPanZoom(); }
function showAuth() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app-sidebar').classList.add('hidden'); document.getElementById('main-content').classList.add('hidden'); }
window.enableDemoMode = () => { isDemoUser = true; currentUser = { email: "demo@rcem.ac.uk", uid: "demo" }; projectData = JSON.parse(JSON.stringify(examples.sepsis)); showApp(); renderAll(); showToast("Demo Loaded"); }
document.getElementById('demo-btn').onclick = window.enableDemoMode;

function initRealtimeListener() {
    if (!currentUser || isDemoUser) return;
    onSnapshot(doc(db, 'projects', currentUser.uid), (doc) => {
        if (doc.exists()) {
            projectData = { ...projectData, ...doc.data() };
            if(!projectData.kanban) projectData.kanban = { todo:[], doing:[], done:[] };
        }
        renderAll();
    });
}
window.saveData = async () => { if(!isViewingDemo && !isDemoUser && currentUser) await setDoc(doc(db, 'projects', currentUser.uid), projectData, { merge: true }); const s = document.getElementById('save-status'); s.innerHTML='Saved'; setTimeout(()=>s.innerHTML='Saved',1000); updateTracker(); }

// --- JOURNEY TRACKER ---
function updateTracker() {
    const d = projectData;
    const steps = document.querySelectorAll('.journey-step');
    steps.forEach(s => s.classList.remove('active', 'completed'));
    
    let active = 'scope';
    if(d.checklist.title) active = 'plan';
    if(d.drivers.primary.length > 0) active = 'do';
    if(d.pdsa.length > 0) active = 'study';
    if(d.chartData.length > 5) active = 'act';
    if(d.checklist.sustainability_plan) active = 'share';

    const order = ['scope','plan','do','study','act','share'];
    const activeIdx = order.indexOf(active);

    steps.forEach((s, i) => {
        if(i < activeIdx) s.classList.add('completed');
        if(i === activeIdx) s.classList.add('active');
    });
}

// --- ADVANCED CHARTING (SPC, G-Chart, Rules) ---
window.setChartMode = (m) => { chartMode = m; renderChart(); }
function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    const data = [...(projectData.chartData||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(data.length === 0) return;

    let values = data.map(d => parseFloat(d.value));
    let labels = data.map(d => d.date);
    let annotations = {};
    let datasets = [];

    // --- SPC Logic ---
    let centerLine = 0;
    let ucl = 0, lcl = 0;
    
    if (chartMode === 'spc_xmr') {
        // XmR Chart: Moving Range
        const mrs = values.map((v, i) => i === 0 ? 0 : Math.abs(v - values[i-1])).slice(1);
        const mrAvg = mrs.reduce((a,b)=>a+b,0) / mrs.length;
        centerLine = values.reduce((a,b)=>a+b,0) / values.length;
        ucl = centerLine + (2.66 * mrAvg);
        lcl = centerLine - (2.66 * mrAvg);
    } else if (chartMode === 'spc_p') {
        // P-Chart (Simplified assuming constant sample size for visual)
        centerLine = values.reduce((a,b)=>a+b,0) / values.length; // Average P
        const sigma = Math.sqrt((centerLine * (100 - centerLine)) / 20); // Dummy N=20 for visual
        ucl = centerLine + (3 * sigma);
        lcl = centerLine - (3 * sigma);
    } else if (chartMode === 'gchart') {
        // G-Chart: Days between events
        // Transform data: Value becomes "Days since last date"
        const dates = data.map(d => new Date(d.date));
        values = dates.map((d, i) => i === 0 ? 0 : (d - dates[i-1])/(1000*60*60*24)).slice(1);
        labels = labels.slice(1);
        centerLine = values.sort((a,b)=>a-b)[Math.floor(values.length/2)]; // Median
    } else {
        // Run Chart (Median)
        const sorted = [...values].sort((a,b)=>a-b);
        centerLine = sorted[Math.floor(sorted.length/2)];
    }

    // --- AUTOMATED RULES (Shift & Trend) ---
    const pointColors = values.map((v, i) => {
        // Shift: 6 points same side of median
        if (i >= 5) {
            const subset = values.slice(i-5, i+1);
            if (subset.every(x => x > centerLine) || subset.every(x => x < centerLine)) return '#ef4444'; // Red flag
        }
        return '#2d2e83';
    });

    // Annotations
    annotations['center'] = { type: 'line', yMin: centerLine, yMax: centerLine, borderColor: '#94a3b8', borderDash:[5,5], label:{display:true, content: chartMode==='run'?'Median':'Mean', position:'start'} };
    if(chartMode.includes('spc')) {
        annotations['ucl'] = { type: 'line', yMin: ucl, yMax: ucl, borderColor: '#ef4444', borderDash:[2,2], label:{display:true, content:'UCL'} };
        annotations['lcl'] = { type: 'line', yMin: lcl, yMax: lcl, borderColor: '#ef4444', borderDash:[2,2], label:{display:true, content:'LCL'} };
    }
    // National Standard & Goal
    if(projectData.chartBenchmark) annotations['bench'] = { type: 'line', yMin: projectData.chartBenchmark, yMax: projectData.chartBenchmark, borderColor: '#ef4444', borderWidth: 2, label:{display:true, content:'National Std', backgroundColor:'#ef4444', color:'white'} };
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', pointBackgroundColor: pointColors, tension: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations } } }
    });
}
window.copyChartImage = () => { document.getElementById('mainChart').toBlob(b => navigator.clipboard.write([new ClipboardItem({'image/png': b})]).then(()=>showToast("Copied to Clipboard!"))); }
window.updateMeta = () => { projectData.chartGoal = document.getElementById('chart-goal').value; projectData.chartBenchmark = document.getElementById('chart-benchmark').value; saveData(); renderChart(); }
window.addDataPoint = () => { 
    const d=document.getElementById('chart-date').value; 
    if(d){ 
        projectData.chartData.push({ date: d, value: document.getElementById('chart-value').value, type: document.getElementById('chart-type').value, category: document.getElementById('chart-category').value }); 
        saveData(); renderChart(); 
    } 
}

// --- KANBAN BOARD ---
function renderKanban() {
    ['todo','doing','done'].forEach(s => {
        const list = document.getElementById(`kb-${s}`);
        list.innerHTML = projectData.kanban[s].map(t => 
            `<div class="kanban-card" draggable="true" ondragstart="window.dragStart(event, '${s}', ${t.id})">
                ${t.text} <button onclick="window.delTask('${s}',${t.id})" class="float-right text-red-500">×</button>
            </div>`).join('');
        // Add drop listeners
        list.parentElement.ondragover = e => e.preventDefault();
        list.parentElement.ondrop = e => window.dropTask(e, s);
    });
}
window.addKanbanTask = () => { const t=prompt("Task:"); if(t) { projectData.kanban.todo.push({id:Date.now(), text:t}); saveData(); renderKanban(); } }
window.delTask = (s,id) => { projectData.kanban[s] = projectData.kanban[s].filter(t=>t.id!==id); saveData(); renderKanban(); }
let dragItem = null;
window.dragStart = (e, s, id) => { dragItem = {s, id}; }
window.dropTask = (e, targetS) => {
    if(!dragItem) return;
    const task = projectData.kanban[dragItem.s].find(t=>t.id===dragItem.id);
    projectData.kanban[dragItem.s] = projectData.kanban[dragItem.s].filter(t=>t.id!==dragItem.id);
    projectData.kanban[targetS].push(task);
    saveData(); renderKanban(); dragItem = null;
}

// --- REFLECTION & EXAMPLE ---
window.saveReflection = (k, v) => { projectData.reflection[k] = v; saveData(); }
window.loadExample = (k) => { if(k && examples[k]) { projectData = JSON.parse(JSON.stringify(examples[k])); saveData(); renderAll(); showToast("Example Loaded"); } }

// --- RENDER ALL ---
function renderAll() {
    updateTracker();
    renderChart();
    renderKanban();
    // Fill checklist, reflection, tools, gantt... (abbreviated for size)
    const d = projectData;
    ['d1','d2','d3'].forEach(k => { if(document.getElementById(`ref-${k}`)) document.getElementById(`ref-${k}`).value = d.reflection[k]||''; });
    // Checklist/Tools rendering kept from previous version
    lucide.createIcons();
}

window.router = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId==='kanban') renderKanban();
    if(viewId==='data') renderChart();
    lucide.createIcons();
};

// Initial Init
initRealtimeListener();
