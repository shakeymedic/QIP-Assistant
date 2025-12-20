import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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
let currentProjectId = null;
let liveProjects = [];
let isDemoMode = false;
let chartInstance = null;
let panState = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };
let chartMode = 'run';
let toolMode = 'fishbone';
let dragItem = null;

// --- GOLD STANDARD DEMOS ---
const demos = {
    sepsis: {
        id: 'demo-sepsis',
        checklist: { 
            title: "Improving Sepsis 6 Compliance in the ED", 
            lead: "Dr. A. Medic (ST4)",
            team: "Sr. Nurse B (Band 7), Dr. C (Consultant Lead)",
            problem_desc: "Local audit of 50 consecutive patients (Nov 2024) revealed that only 42% of patients triggering 'Red Flag Sepsis' received the full Sepsis 6 bundle within 1 hour. This increases mortality risk and length of stay.", 
            evidence: "RCEM Clinical Standards for Sepsis (2023) mandate 100% compliance. NICE NG51 supports early administration of antibiotics.",
            aim: "To increase the percentage of eligible adult sepsis patients receiving the Sepsis 6 bundle within 1 hour from 42% to 90% by 1st August 2025.", 
            outcome_measures: "Percentage of eligible patients receiving complete Sepsis 6 bundle within 60 mins of arrival.", 
            process_measures: "1. Time from arrival to triage screening. 2. Availability of Sepsis Grab Bags in Resus. 3. Time to antibiotic prescription.", 
            balance_measures: "1. Time to initial assessment for non-sepsis patients (displacement effect). 2. Rate of inappropriate antibiotic prescribing.",
            results_summary: "Baseline data (n=20) showed a median compliance of 45%. After PDSA 1 (Sepsis Stamp), the median shifted to 60%. Following PDSA 2 (Grab Bags), we observed a sustained shift to 85%, indicating special cause variation.", 
            learning: "Process mapping revealed significant wasted time 'hunting' for fluids and giving sets. Pre-filled bags saved 8 mins per patient. Nursing engagement was critical to success.",
            sustainability_plan: "A Sepsis Lead Nurse has been appointed to check grab bags daily. Sepsis compliance data is now included in the monthly departmental quality dashboard." 
        },
        chartData: [ 
            {date:"2025-01-01",value:40,category:"outcome"},{date:"2025-01-08",value:42,category:"outcome"},{date:"2025-01-15",value:45,category:"outcome"},{date:"2025-01-22",value:41,category:"outcome"},
            {date:"2025-01-29",value:null,type:"intervention",note:"PDSA 1: Stamp"},
            {date:"2025-02-05",value:60,category:"outcome"},{date:"2025-02-12",value:62,category:"outcome"},{date:"2025-02-19",value:58,category:"outcome"},{date:"2025-02-26",value:65,category:"outcome"},
            {date:"2025-03-05",value:null,type:"intervention",note:"PDSA 2: Bags"},
            {date:"2025-03-12",value:80,category:"outcome"},{date:"2025-03-19",value:85,category:"outcome"},{date:"2025-03-26",value:82,category:"outcome"},{date:"2025-04-02",value:88,category:"outcome"} 
        ],
        pdsa: [ 
            {id:"1",title:"Cycle 1: Sepsis Stamp",plan:"Introduce rubber stamp for notes to prompt action at triage.",do:"Trialled for 1 week in Majors.",study:"Compliance rose to 60%, but ink pads dried out and staff forgot to use it.",act:"Adopt idea but switch to sticky labels."}, 
            {id:"2",title:"Cycle 2: Grab Bags",plan:"Create kits with fluids, giving sets, and blood bottles to reduce search time.",do:"10 bags placed in Majors/Resus.",study:"Compliance rose to 85%. Nurses reported high satisfaction.",act:"Adopt as standard practice."} 
        ],
        drivers: { 
            primary:["Reliable Identification","Rapid Equipment Access","Empowered Staff"], 
            secondary:["Visual prompts in notes","Pre-filled 'Grab Kits'","Nurse PGD for Antibiotics"], 
            changes:["Sepsis Stamp","Grab Bag Implementation","Training Sessions"] 
        },
        kanban: { 
            todo:[{id:1,text:"Write final report for portfolio"}, {id:5, text:"Share results at Regional Conference"}], 
            doing:[{id:2,text:"Present at Dept Audit Meeting"}], 
            done:[{id:3,text:"Order stickers"}, {id:4,text:"Collect baseline data"}] 
        },
        fishbone: { 
            categories: [
                {id:1,text:"People",causes:["Locum doctors unfamiliar with protocol","Nursing shortage","Fear of wrong dose"]},
                {id:2,text:"Methods",causes:["No PGD for nurses","Paper notes messy","Screening tool ignored"]},
                {id:3,text:"Equipment",causes:["Cannulas missing","Fluids locked in store room","Antibiotics in separate cupboard"]},
                {id:4,text:"Environment",causes:["Overcrowded Resus","No dedicated sepsis trolley"]}
            ] 
        },
        stakeholder: [{group:"ED Nurses",interest:"High",power:"High",strategy:"Manage Closely"},{group:"Managers",interest:"Low",power:"High",strategy:"Keep Satisfied"}],
        reflection: { d1:"Improved understanding of QI methodology and run charts.", d2:"Directly improved patient safety by reducing time to antibiotics.", d3:"Learned to negotiate with reluctant staff members." }
    },
    hip: { id: 'demo-hip', checklist: {title:"Fascia Iliaca Block for Hip #", aim:"95% within 4 hours"}, chartData:[], pdsa:[], drivers:{primary:[],secondary:[],changes:[]}, fishbone:{categories:[]}, kanban:{todo:[],doing:[],done:[]}, reflection:{} }
};

const emptyProject = {
    checklist: {}, chartData: [], pdsa: [], drivers: {primary:[],secondary:[],changes:[]}, 
    fishbone: {categories:[{id:1,text:"People",causes:[]},{id:2,text:"Methods",causes:[]},{id:3,text:"Equip",causes:[]},{id:4,text:"Env",causes:[]}]}, 
    kanban: {todo:[],doing:[],done:[]}, stakeholder: [], reflection: {}
};

let projectData = JSON.parse(JSON.stringify(emptyProject));

// --- AUTH & SETUP ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) { showApp(); loadProjects(); } else { showAuth(); }
});

function showApp() { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-sidebar').classList.remove('hidden'); document.getElementById('app-sidebar').classList.add('flex'); document.getElementById('main-content').classList.remove('hidden'); document.getElementById('user-display').textContent = currentUser.email; initPanZoom(); }
function showAuth() { document.getElementById('auth-screen').classList.remove('hidden'); document.getElementById('app-sidebar').classList.add('hidden'); document.getElementById('main-content').classList.add('hidden'); }

// --- PROJECT MANAGEMENT ---
function loadProjects() {
    onSnapshot(query(collection(db, 'projects'), where('uid', '==', currentUser.uid)), (snap) => {
        liveProjects = [];
        snap.forEach(d => liveProjects.push({id: d.id, ...d.data()}));
        if(liveProjects.length === 0) createNewProject();
        else if(!currentProjectId && !isDemoMode) switchProject(liveProjects[0].id);
        renderProjectList();
    });
}
window.createNewProject = async () => {
    if(isDemoMode) return alert("Switch to 'My Projects' to create new.");
    const newP = { ...emptyProject, uid: currentUser.uid, checklist: { title: "Untitled Project " + (liveProjects.length+1) } };
    const ref = await addDoc(collection(db, 'projects'), newP);
    switchProject(ref.id);
};
window.switchProject = (id) => { currentProjectId = id; projectData = liveProjects.find(p=>p.id===id)||emptyProject; renderAll(); };
window.toggleMode = (m) => {
    isDemoMode = (m === 'demo');
    document.body.classList.toggle('demo-mode', isDemoMode);
    document.getElementById('demo-banner').classList.toggle('hidden', !isDemoMode);
    document.getElementById('mode-live').className = isDemoMode ? "flex-1 py-1 text-xs font-bold rounded text-slate-400 hover:text-white" : "flex-1 py-1 text-xs font-bold rounded bg-rcem-purple text-white";
    document.getElementById('mode-demo').className = !isDemoMode ? "flex-1 py-1 text-xs font-bold rounded text-slate-400 hover:text-white" : "flex-1 py-1 text-xs font-bold rounded bg-rcem-purple text-white";
    document.getElementById('project-list-container').classList.toggle('hidden', isDemoMode);
    document.getElementById('demo-list-container').classList.toggle('hidden', !isDemoMode);
    if(isDemoMode) window.loadExample('sepsis'); else if(liveProjects.length) switchProject(liveProjects[0].id);
};
window.loadExample = (k) => { projectData = JSON.parse(JSON.stringify(demos[k])); renderAll(); showToast("Example Loaded"); };
function renderProjectList() { document.getElementById('project-list-container').innerHTML = liveProjects.map(p => `<button onclick="window.switchProject('${p.id}')" class="w-full text-left px-3 py-2 text-sm rounded ${currentProjectId===p.id?'bg-white/20 text-white font-bold':'text-slate-300 hover:text-white hover:bg-white/10'} truncate">${p.checklist.title||'Untitled'}</button>`).join(''); }

window.saveData = async () => { if(!isDemoMode && currentUser && currentProjectId) { await setDoc(doc(db, 'projects', currentProjectId), projectData, {merge:true}); document.getElementById('save-status').innerHTML='Saved'; setTimeout(()=>document.getElementById('save-status').innerHTML='',1000); updateTracker(); } };

// --- RENDERING VIEWS ---
function renderAll() {
    document.getElementById('current-project-name').textContent = projectData.checklist.title || "Untitled";
    renderChecklist(); 
    renderPDSA(); 
    if(projectData.kanban) renderKanban(); 
    updateTracker();
    if(!document.getElementById('view-data').classList.contains('hidden')) renderChart();
    if(!document.getElementById('view-tools').classList.contains('hidden')) renderTools();
}

function renderChecklist() {
    const d = projectData.checklist;
    const make = (k,l,p) => `<div class="glass p-4 rounded-xl space-y-2"><div class="flex justify-between"><label class="lbl">${l}</label>${k==='problem_desc'?`<button onclick="window.openProblemWizard()" class="text-indigo-600 text-xs"><i data-lucide="wand-2" class="w-3 h-3 inline"></i> Wizard</button>`:''}</div><textarea class="inp" placeholder="${p}" onchange="projectData.checklist.${k}=this.value;saveData()">${d[k]||''}</textarea></div>`;
    document.getElementById('checklist-container').innerHTML = 
        make('title','Title','e.g. Improving Sepsis 6') + 
        make('problem_desc','1. Problem Description','e.g. A local audit of [Number] patients in [Date] showed that [Issue]. This affects [Who]. This is a problem because [Why - Safety/Flow].') +
        make('aim','2. SMART Aim','e.g. To increase the percentage of [Patient Group] receiving [Intervention] from [X%] to [Y%] by [Date].') +
        make('outcome_measures','3. Outcome Measures','e.g. The % of patients receiving the bundle within 1 hour. (This matches your Aim).') +
        make('process_measures','4. Process Measures','e.g. 1. Availability of equipment. 2. Staff knowledge scores. 3. Time to triage.') +
        make('balance_measures','5. Balancing Measures','e.g. 1. Delays to other patients. 2. Staff satisfaction/burnout.') +
        make('results_summary','6. Results Summary','e.g. Baseline data showed [X]. After PDSA 1, we observed a shift to [Y].') +
        make('learning','7. Learning','e.g. We learned that engaging nurses early was key. Data collection was harder than expected.') +
        make('sustainability_plan','8. Sustainability','e.g. We have appointed a champion. This is now part of the induction pack.');
    lucide.createIcons();
}

// --- CHARTS & ANALYTICS ---
window.setChartMode = (m) => { chartMode = m; renderChart(); };
function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    
    // Sort Data
    const data = [...(projectData.chartData||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(!data.length) { document.getElementById('chart-narrative').textContent = "No data yet."; return; }
    
    let values = data.map(d => parseFloat(d.value));
    let labels = data.map(d => d.date);
    let center = 0, ucl = null, lcl = null;
    let annotations = {};

    // Mode Logic
    if(chartMode === 'spc_xmr') {
        const mr = values.map((v,i)=>i===0?0:Math.abs(v-values[i-1])).slice(1);
        const mrAvg = mr.reduce((a,b)=>a+b,0)/mr.length;
        center = values.reduce((a,b)=>a+b,0)/values.length;
        ucl = center + (2.66 * mrAvg);
        lcl = center - (2.66 * mrAvg);
    } else if(chartMode === 'spc_p') {
        center = values.reduce((a,b)=>a+b,0)/values.length;
        const n = 20; // assumed sample size for visual
        const sigma = Math.sqrt((center*(100-center))/n);
        ucl = center + (3*sigma);
        lcl = center - (3*sigma);
    } else {
        const sorted = [...values].sort((a,b)=>a-b);
        center = sorted[Math.floor(sorted.length/2)];
    }

    // Rules
    let pColors = values.map(()=>'#2d2e83');
    let shiftC = 0;
    values.forEach((v,i) => {
        if(v > center) shiftC++; else if(v < center) shiftC=0;
        if(shiftC>=6) for(let k=i; k>i-6; k--) pColors[k]='#ef4444';
    });

    // Annotations
    annotations.center = { type:'line', yMin:center, yMax:center, borderColor:'#94a3b8', borderDash:[5,5], label:{display:true,content:chartMode==='run'?'Median':'Mean'} };
    if(ucl!==null) annotations.ucl = { type:'line', yMin:ucl, yMax:ucl, borderColor:'#ef4444', borderDash:[2,2], label:{display:true,content:'UCL'} };
    if(lcl!==null) annotations.lcl = { type:'line', yMin:lcl, yMax:lcl, borderColor:'#ef4444', borderDash:[2,2], label:{display:true,content:'LCL'} };

    // Narrative
    document.getElementById('chart-narrative').innerHTML = `<strong>Automated Analysis:</strong> Baseline: ${center.toFixed(1)}. ${pColors.includes('#ef4444') ? "Significant Shift detected (Special Cause Variation)." : "Common Cause Variation only."}`;

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Measure', data:values, borderColor:'#2d2e83', pointBackgroundColor:pColors, tension:0 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins: { annotation: { annotations } } }
    });
}
window.addDataPoint = () => { if(isDemoMode) return; const d=document.getElementById('chart-date').value; if(d){ projectData.chartData.push({date:d, value:document.getElementById('chart-value').value, type:document.getElementById('chart-type').value}); saveData(); renderChart(); } };

// --- TOOLS & DIAGRAMS ---
window.setToolMode=(m)=>{toolMode=m; renderTools();};
function renderTools() {
    const c=document.getElementById('tool-canvas'), d=projectData;
    let mm = "";
    if(toolMode==='fishbone') {
        const cats = d.fishbone.categories || [];
        mm=`mindmap\n root((Problem))\n` + cats.map(cat => `  ${cat.text}\n` + (cat.causes||[]).map(x=>`   ${x.replace(/["()]/g,"")}`).join('\n')).join('\n');
    } else if(toolMode==='driver') {
        mm=`graph LR\n Aim[AIM]-->P[Primary]\n P-->S[Secondary]\n S-->C[Changes]\n`;
        (d.drivers.primary||[]).forEach((p,i)=>mm+=` P-->P${i}["${p}"]\n`);
        (d.drivers.secondary||[]).forEach((s,i)=>mm+=` S-->S${i}["${s}"]\n`);
        (d.drivers.changes||[]).forEach((ch,i)=>mm+=` C-->C${i}["${ch}"]\n`);
    } else {
        c.innerHTML = `<div class="grid grid-cols-2 gap-4 w-full">${(d.stakeholder||[]).map(s=>`<div class="bg-slate-50 border p-2 rounded"><b>${s.group}</b><br>Int: ${s.interest} | Pow: ${s.power}</div>`).join('')}</div>`;
        return;
    }
    c.innerHTML = `<div class="mermaid">${mm}</div>`;
    mermaid.run({ nodes: [c.querySelector('.mermaid')] });
    document.getElementById('tool-controls').innerHTML = !isDemoMode ? `<button onclick="window.addNode()" class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-sm font-bold shadow-sm border border-indigo-200">+ Add Node</button>` : '';
}
window.addNode = () => {
    if(toolMode==='fishbone') { const t=prompt("Cause:"); if(t){ projectData.fishbone.categories[0].causes.push(t); saveData(); renderTools(); } }
    else if(toolMode==='driver') { const t=prompt("Primary Driver:"); if(t){ projectData.drivers.primary.push(t); saveData(); renderTools(); } }
    else if(toolMode==='stakeholder') { const t=prompt("Group Name:"); if(t){ projectData.stakeholder.push({group:t,interest:'High',power:'High'}); saveData(); renderTools(); } }
};

// --- KANBAN ---
window.addKanbanTask = () => { if(isDemoMode)return; const t=prompt("Task:"); if(t){ projectData.kanban.todo.push({id:Date.now(),text:t}); saveData(); renderKanban(); } };
window.delTask = (s,id) => { if(isDemoMode)return; projectData.kanban[s]=projectData.kanban[s].filter(t=>t.id!=id); saveData(); renderKanban(); };
window.dragStart = (e, s, id) => { e.dataTransfer.setData('text/plain', JSON.stringify({s,id})); };
window.dropTask = (e, targetS) => { 
    if(isDemoMode)return; e.preventDefault(); 
    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const task = projectData.kanban[data.s].find(t=>t.id==data.id);
        if(task) {
            projectData.kanban[data.s] = projectData.kanban[data.s].filter(t=>t.id!=data.id);
            projectData.kanban[targetS].push(task);
            saveData(); renderKanban();
        }
    } catch(err) {}
};
function renderKanban() {
    ['todo','doing','done'].forEach(s => {
        const list = document.getElementById(`kb-${s}`);
        list.innerHTML = (projectData.kanban[s]||[]).map(t => 
            `<div class="kanban-card" draggable="true" ondragstart="window.dragStart(event, '${s}', ${t.id})">
                ${t.text} <button onclick="window.delTask('${s}',${t.id})" class="float-right text-red-500">×</button>
            </div>`).join('');
        list.parentElement.ondragover = e => e.preventDefault();
        list.parentElement.ondrop = e => window.dropTask(e, s);
    });
}

// --- WIZARDS & HELPERS ---
window.openProblemWizard = () => document.getElementById('problem-wizard-modal').classList.remove('hidden');
window.saveProblemWizard = () => { projectData.checklist.problem_desc = `Problem identified regarding ${document.getElementById('prob-what').value} affecting ${document.getElementById('prob-who').value} in ${document.getElementById('prob-when').value}. Evidence: ${document.getElementById('prob-evi').value}.`; saveData(); document.getElementById('problem-wizard-modal').classList.add('hidden'); renderChecklist(); };
window.checkHra = (v) => { document.getElementById('hra-result').classList.remove('hidden'); document.getElementById('hra-result').textContent = v ? "Likely RESEARCH (Ethics required)." : "Likely AUDIT/QI (Local registration)."; document.getElementById('hra-result').className = v ? "mt-4 p-4 rounded font-bold bg-red-100 text-red-800" : "mt-4 p-4 rounded font-bold bg-green-100 text-green-800"; };
window.calcCarbon = () => { document.getElementById('green-result').textContent = `Total Saved: ${(document.getElementById('green-item').value * document.getElementById('green-qty').value).toFixed(2)} kgCO2e`; };
window.runPreFlight = () => { 
    const c = projectData.checklist; 
    document.getElementById('rubric-list').innerHTML = `<div class="p-2 border-b">Problem defined? <b>${c.problem_desc?'PASS':'FAIL'}</b></div><div class="p-2 border-b">SMART Aim? <b>${c.aim?'PASS':'FAIL'}</b></div><div class="p-2">Data (>5 points)? <b>${projectData.chartData.length>5?'PASS':'FAIL'}</b></div>`;
    document.getElementById('rubric-modal').classList.remove('hidden');
};
window.updateTracker = () => {
    const steps = document.querySelectorAll('.journey-step');
    steps.forEach(s => s.classList.remove('active', 'completed'));
    let idx = 0;
    if(projectData.checklist.title) idx=1; 
    if(projectData.drivers.primary && projectData.drivers.primary.length) idx=2;
    if(projectData.pdsa && projectData.pdsa.length) idx=3;
    if(projectData.chartData && projectData.chartData.length>5) idx=4;
    if(projectData.checklist.sustainability_plan) idx=5;
    steps.forEach((s,i) => { if(i<idx) s.classList.add('completed'); if(i===idx) s.classList.add('active'); });
};
window.addPDSACycle = () => { if(isDemoMode)return; projectData.pdsa.unshift({id:Date.now(),title:"Cycle "+(projectData.pdsa.length+1), plan:"", do:"", study:"", act:""}); saveData(); renderPDSA(); };
function renderPDSA() { document.getElementById('pdsa-list').innerHTML = (projectData.pdsa||[]).map(c=>`<div class="glass p-4 rounded-xl mb-4 bg-slate-50"><div class="font-bold border-b pb-2 mb-2 flex justify-between"><span>${c.title}</span><button onclick="window.delPDSA('${c.id}')" class="text-red-500">×</button></div><div class="grid grid-cols-2 gap-2"><textarea placeholder="Plan" onchange="window.updPDSA('${c.id}','plan',this.value)" class="inp h-20">${c.plan||''}</textarea><textarea placeholder="Do" onchange="window.updPDSA('${c.id}','do',this.value)" class="inp h-20">${c.do||''}</textarea><textarea placeholder="Study" onchange="window.updPDSA('${c.id}','study',this.value)" class="inp h-20">${c.study||''}</textarea><textarea placeholder="Act" onchange="window.updPDSA('${c.id}','act',this.value)" class="inp h-20">${c.act||''}</textarea></div></div>`).join(''); }
window.updPDSA = (id,k,v) => { projectData.pdsa.find(c=>c.id==id)[k]=v; saveData(); };
window.delPDSA = (id) => { if(isDemoMode)return; projectData.pdsa=projectData.pdsa.filter(c=>c.id!=id); saveData(); renderPDSA(); };
window.router = (v) => { document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden')); document.getElementById('view-'+v).classList.remove('hidden'); if(v==='data') renderChart(); if(v==='tools') renderTools(); if(v==='kanban') renderKanban(); lucide.createIcons(); };
window.openTherapy = () => document.getElementById('therapy-modal').classList.remove('hidden');
window.openPortfolioExport = () => {
    const c = projectData.checklist;
    document.getElementById('portfolio-content').innerHTML = `
        <h4 class="font-bold">Title</h4><p class="mb-4 bg-slate-100 p-2 rounded">${c.title||'-'}</p>
        <h4 class="font-bold">Aim</h4><p class="mb-4 bg-slate-100 p-2 rounded">${c.aim||'-'}</p>
        <h4 class="font-bold">Method</h4><p class="mb-4 bg-slate-100 p-2 rounded">${c.problem_desc||'-'}</p>
        <h4 class="font-bold">Results</h4><p class="mb-4 bg-slate-100 p-2 rounded">${c.results_summary||'-'}</p>
        <h4 class="font-bold">Reflection</h4><p class="mb-4 bg-slate-100 p-2 rounded">${projectData.reflection.d1||'-'}</p>
    `;
    document.getElementById('portfolio-modal').classList.remove('hidden');
};
window.printPoster = () => {
    const c = projectData.checklist;
    document.getElementById('print-title').textContent = c.title || "Untitled";
    document.getElementById('print-problem').textContent = c.problem_desc;
    document.getElementById('print-aim').textContent = c.aim;
    document.getElementById('print-results').textContent = c.results_summary;
    document.getElementById('print-sustain').textContent = c.sustainability_plan;
    document.getElementById('print-process-measures').textContent = c.process_measures;
    document.getElementById('print-learning').textContent = c.learning;
    document.getElementById('print-pdsa-list').innerHTML = projectData.pdsa.map(p=>`<li>${p.title}: ${p.act}</li>`).join('');
    document.getElementById('print-chart-img').src = document.getElementById('mainChart').toDataURL();
    // Driver Diagram clone
    const driverSvg = document.querySelector('#tool-canvas svg');
    if(driverSvg) document.getElementById('print-driver-container').innerHTML = new XMLSerializer().serializeToString(driverSvg);
    window.print();
};
window.handleBulkImport = () => {
    const txt = document.getElementById('bulk-text').value;
    txt.split('\n').forEach(line => {
        const [d,v] = line.split(/[\t,]+/);
        if(d && v) projectData.chartData.push({date:d.trim(), value:v.trim(), category:'outcome'});
    });
    saveData(); renderChart(); document.getElementById('bulk-modal').classList.add('hidden');
};
window.exportPPTX = () => {
    const pptx = new PptxGenJS();
    const s1 = pptx.addSlide(); s1.addText(projectData.checklist.title||"QIP", {x:1,y:1,fontSize:24});
    const s2 = pptx.addSlide(); s2.addText("Problem & Aim", {x:0.5,y:0.5}); s2.addText(`Problem: ${projectData.checklist.problem_desc}\n\nAim: ${projectData.checklist.aim}`, {x:0.5,y:1.5,w:8});
    const s3 = pptx.addSlide(); s3.addText("Results", {x:0.5,y:0.5}); s3.addImage({data:document.getElementById('mainChart').toDataURL(), x:0.5, y:1.5, w:9, h:4});
    pptx.writeFile({ fileName: "RCEM_QIP.pptx" });
};
window.openGuide = () => document.getElementById('guide-modal').classList.remove('hidden');
window.saveReflection = (k,v) => { projectData.reflection[k]=v; saveData(); };

function initPanZoom() {
    const w = document.getElementById('tool-container-wrapper'), c = document.getElementById('tool-canvas');
    if(!w)return;
    w.onmousedown=e=>{e.preventDefault();panState.panning=true;panState.startX=e.clientX-panState.pointX;panState.startY=e.clientY-panState.pointY;w.classList.add('cursor-grabbing')};
    w.onmousemove=e=>{if(!panState.panning)return;e.preventDefault();panState.pointX=e.clientX-panState.startX;panState.pointY=e.clientY-panState.startY;c.style.transform=`translate(${panState.pointX}px,${panState.pointY}px) scale(${panState.scale})`};
    w.onmouseup=()=>{panState.panning=false;w.classList.remove('cursor-grabbing')};
    w.onwheel=e=>{e.preventDefault();panState.scale+=e.deltaY*-0.001;panState.scale=Math.min(Math.max(.5,panState.scale),4);c.style.transform=`translate(${panState.pointX}px,${panState.pointY}px) scale(${panState.scale})`};
}
const showToast = (msg) => { const el = document.createElement('div'); el.className = `px-4 py-2 rounded shadow-lg text-white text-sm font-medium mb-2 fade-in bg-rcem-purple fixed bottom-4 right-4 z-50`; el.innerHTML = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3000); };

lucide.createIcons();
