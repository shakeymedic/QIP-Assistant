import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, setToolMode, renderFullViewChart, makeDraggable } from "./charts.js";

// ==========================================
// 1. MAIN ROUTER & NAVIGATION
// ==========================================

function renderAll(view) {
    updateNavigationUI(view);
    
    // Router
    switch(view) {
        case 'projects': break; 
        case 'dashboard': renderDashboard(); break;
        case 'checklist': renderChecklist(); break; 
        case 'team': renderTeam(); break;
        case 'tools': renderTools(); break;
        case 'data': renderDataView(); break;       
        case 'pdsa': renderPDSA(); break;
        case 'stakeholders': renderStakeholders(); break;
        case 'gantt': renderGantt(); break;
        case 'green': renderGreen(); break;         
        case 'full': renderFullProject(); break;    
        case 'publish': renderPublish(); break;     
        default: renderDashboard();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateNavigationUI(currentView) {
    const navItems = ['checklist', 'team', 'tools', 'pdsa', 'data', 'publish'];
    navItems.forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if(!btn) return;
        
        let status = '';
        const d = state.projectData;
        if (!d) return;
        
        // Logic for "Complete" badges
        if(id === 'checklist' && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist.ethics) status = '✓';
        
        const existingBadge = btn.querySelector('.status-badge');
        if(existingBadge) existingBadge.remove();

        if(status) {
             btn.innerHTML += ` <span class="status-badge ml-auto text-emerald-400 font-bold text-[10px]">${status}</span>`;
        }
    });
}

// ==========================================
// 2. DASHBOARD (HOME)
// ==========================================

function renderDashboard() {
    const d = state.projectData;
    const values = d.chartData.map(x => Number(x.value)).filter(n => !isNaN(n));
    const avg = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;
    
    // Calculate Project Progress Score
    // Logic: Aim(20), Team(10), Diagnosis(20), Data(20), PDSA(20), Sustain(10)
    let score = 0;
    if(d.checklist.aim && d.checklist.problem_desc) score += 20;
    if(d.teamMembers.length > 0) score += 10;
    if(d.drivers.primary.length > 0 || d.fishbone.categories[0].causes.length > 0) score += 20;
    if(d.chartData.length >= 6) score += 20;
    if(d.pdsa.length > 0) score += 20;
    if(d.checklist.sustain) score += 10;
    
    const totalProg = Math.min(100, score);

    // 1. Circular Progress Display
    document.getElementById('stat-progress').innerHTML = `
        <div class="flex items-center gap-6">
            <div class="relative w-24 h-24 flex items-center justify-center">
                <svg class="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="transparent" class="text-slate-100" />
                    <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="transparent" stroke-dasharray="251.2" stroke-dashoffset="${251.2 - (251.2 * totalProg / 100)}" class="text-emerald-500 transition-all duration-1000" />
                </svg>
                <span class="absolute text-xl font-bold text-slate-700">${totalProg}%</span>
            </div>
            <div>
                <h4 class="font-bold text-slate-800 text-lg">Project Health</h4>
                <p class="text-xs text-slate-500 mb-2">Completion Status</p>
                <div class="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 inline-block">
                    ${totalProg < 30 ? 'Setting Up' : totalProg < 70 ? 'In Progress' : 'Near Completion'}
                </div>
            </div>
        </div>
    `;
    
    // 2. QI Coach Logic (Smart Banners)
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Next Step: Data", m: "You need a baseline. Add at least 6 data points.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    
    if (d.checklist.aim === "") msg = { t: "Next Step: Define Aim", m: "Use the wizard to define a SMART aim.", i: "target", c: "rose-500", b: "Go to Wizard", a: "checklist" };
    else if (d.drivers.primary.length === 0) msg = { t: "Next Step: Diagnosis", m: "Build your Driver Diagram to understand the problem.", i: "git-branch", c: "amber-500", b: "Build Diagram", a: "tools" };
    else if (d.chartData.length >= 6 && d.pdsa.length === 0) msg = { t: "Next Step: PDSA", m: "Baseline established. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
    
    coachEl.innerHTML = `
        <div class="bg-white border-l-4 border-${msg.c} p-6 mb-8 rounded-r-xl shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden transition-all hover:shadow-md">
            <div class="bg-slate-50 p-4 rounded-full shadow-inner text-${msg.c}">
                <i data-lucide="${msg.i}" class="w-8 h-8"></i>
            </div>
            <div class="flex-1">
                <h4 class="font-bold text-slate-800 text-lg">${msg.t}</h4>
                <p class="text-slate-600 mt-1 text-sm">${msg.m}</p>
            </div>
            <button onclick="window.router('${msg.a}')" class="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors shadow-lg flex items-center gap-2">
                ${msg.b} <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
    `;

    // 3. Mini Stats
    const statsContainer = document.getElementById('stat-pdsa').parentElement.parentElement;
    statsContainer.innerHTML = `
        <div class="col-span-2 sm:col-span-4 bg-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-wrap gap-4 lg:gap-8 items-center justify-around">
            <div class="text-center">
                <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Average</div>
                <div class="text-2xl font-bold font-mono text-white">${avg}</div>
            </div>
            <div class="h-8 w-px bg-white/20 hidden sm:block"></div>
            <div class="text-center">
                <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Data Points</div>
                <div class="text-2xl font-bold font-mono text-amber-400">${d.chartData.length}</div>
            </div>
            <div class="h-8 w-px bg-white/20 hidden sm:block"></div>
            <div class="text-center">
                <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">PDSA Cycles</div>
                <div class="text-2xl font-bold font-mono text-emerald-400">${d.pdsa.length}</div>
            </div>
        </div>
    `;

    // 4. Aim Display
    const aimEl = document.getElementById('dash-aim-display');
    aimEl.innerHTML = d.checklist.aim ? d.checklist.aim : `No aim defined yet.`;
    aimEl.className = d.checklist.aim ? "bg-indigo-50 p-4 rounded border border-indigo-100 text-rcem-purple font-bold font-serif" : "bg-slate-50 p-4 rounded border border-slate-200 text-slate-500 italic";
}

// ==========================================
// 3. THE "QI SHERPA" WIZARD (Checklist)
// ==========================================

function renderChecklist() {
    const d = state.projectData;
    const cl = d.checklist;

    const buildProblem = () => {
        const p = `${cl.problem_context || ''} ${cl.problem_evidence || ''} ${cl.problem_specific || ''}`.trim();
        window.saveChecklist('problem_desc', p); 
        return p;
    };
    
    const buildAim = () => {
        if(!cl.aim_measure || !cl.aim_target || !cl.aim_date) return cl.aim; 
        const a = `To increase ${cl.aim_measure} from ${cl.aim_baseline || 'baseline'} to ${cl.aim_target} by ${cl.aim_date}.`;
        window.saveChecklist('aim', a); 
        return a;
    };

    document.getElementById('checklist-container').innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-8">
                
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex items-center gap-3 mb-4 border-b pb-2">
                        <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold">1</div>
                        <h3 class="text-lg font-bold text-slate-800">Define the Problem</h3>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Context</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="Why is this important?" value="${escapeHtml(cl.problem_context || '')}" onchange="window.saveChecklist('problem_context', this.value); window.renderChecklist()">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Evidence</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="What is the baseline data?" value="${escapeHtml(cl.problem_evidence || '')}" onchange="window.saveChecklist('problem_evidence', this.value); window.renderChecklist()">
                        </div>
                        <div class="bg-slate-50 p-3 rounded border border-slate-200 mt-2">
                            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Problem Statement</label>
                            <p class="text-sm text-slate-700 italic">${escapeHtml(buildProblem())}</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div class="flex items-center gap-3 mb-4 border-b pb-2">
                        <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold">2</div>
                        <h3 class="text-lg font-bold text-slate-800">Build a SMART Aim</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="col-span-2">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Measure</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="e.g. delivery of IV antibiotics <1hr" value="${escapeHtml(cl.aim_measure || '')}" onchange="window.saveChecklist('aim_measure', this.value); window.renderChecklist()">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Baseline</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="e.g. 45%" value="${escapeHtml(cl.aim_baseline || '')}" onchange="window.saveChecklist('aim_baseline', this.value); window.renderChecklist()">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Target</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="e.g. 90%" value="${escapeHtml(cl.aim_target || '')}" onchange="window.saveChecklist('aim_target', this.value); window.renderChecklist()">
                        </div>
                         <div class="col-span-2">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">By When?</label>
                            <input type="text" class="w-full p-2 border rounded text-sm" placeholder="e.g. August 2026" value="${escapeHtml(cl.aim_date || '')}" onchange="window.saveChecklist('aim_date', this.value); window.renderChecklist()">
                        </div>
                    </div>
                    <div class="bg-indigo-50 p-3 rounded border border-indigo-100">
                        <label class="block text-xs font-bold text-indigo-400 uppercase mb-1">Aim Statement</label>
                        <p class="text-sm text-indigo-900 font-bold font-serif">${escapeHtml(buildAim())}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                <div class="bg-white p-5 rounded-xl border border-slate-200">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Measures Definitions</label>
                     <input placeholder="Outcome Measure (The Aim)" class="w-full p-2 border rounded text-sm mb-2" value="${escapeHtml(cl.measure_outcome || '')}" onchange="window.saveChecklist('measure_outcome', this.value)">
                     <input placeholder="Process Measure (Compliance)" class="w-full p-2 border rounded text-sm mb-2" value="${escapeHtml(cl.measure_process || '')}" onchange="window.saveChecklist('measure_process', this.value)">
                     <input placeholder="Balancing Measure (Safety)" class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.measure_balance || '')}" onchange="window.saveChecklist('measure_balance', this.value)">
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. DATA VIEW
// ==========================================

function renderDataView() {
    const d = state.projectData;
    const formContainer = document.querySelector('#view-data .bg-white .space-y-4'); 
    
    // Chart Mode Controls
    if(!document.getElementById('chart-mode-controls')) {
        const chartArea = document.querySelector('#view-data canvas').parentElement; 
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
        <div class="mb-4 bg-slate-100 p-2 rounded-lg flex flex-wrap gap-2 justify-center items-center" id="chart-mode-controls">
            <span class="text-xs font-bold text-slate-500 uppercase mr-2">Chart Type:</span>
            <button onclick="window.setChartMode('run')" data-mode="run" class="px-3 py-1 rounded text-xs font-bold bg-slate-800 text-white shadow">Run Chart</button>
            <button onclick="window.setChartMode('spc')" data-mode="spc" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300">SPC</button>
            <button onclick="window.setChartMode('histogram')" data-mode="histogram" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300">Histogram</button>
            <button onclick="window.setChartMode('pareto')" data-mode="pareto" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300">Pareto</button>
        </div>`;
        chartArea.parentElement.insertBefore(wrapper, chartArea);
    }
    
    if (formContainer && formContainer.children.length === 0) {
        formContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input type="date" id="chart-date" class="w-full p-2 border border-slate-300 rounded text-sm outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Value</label>
                    <input type="number" id="chart-value" class="w-full p-2 border border-slate-300 rounded text-sm outline-none" placeholder="0">
                </div>
            </div>
            <div>
                 <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Context</label>
                 <select id="chart-grade" class="w-full p-2 border border-slate-300 rounded text-sm bg-white">
                    <option>Audit Point</option>
                    <option>Baseline</option>
                    <option>Intervention</option>
                 </select>
            </div>
            <div class="pt-2">
                <button onclick="window.addDataPoint()" class="w-full bg-rcem-purple text-white py-2 rounded font-bold hover:bg-indigo-900 shadow">Add Data Point</button>
            </div>
            <div class="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button onclick="document.getElementById('csv-upload').click()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="upload" class="w-3 h-3"></i> Upload CSV</button>
                <button onclick="window.downloadCSVTemplate()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="download" class="w-3 h-3"></i> Template</button>
            </div>
        `;
    }

    const historyContainer = document.getElementById('data-history');
    if (d.chartData.length === 0) {
        historyContainer.innerHTML = `<div class="text-center py-8 text-slate-400 italic text-xs">No data yet.</div>`;
    } else {
        const sorted = [...d.chartData].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        historyContainer.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead><tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200"><th class="pb-2">Date</th><th class="pb-2">Value</th><th class="pb-2">Type</th><th class="pb-2 text-right"></th></tr></thead>
                <tbody class="text-xs text-slate-700">
                    ${sorted.map(item => `
                        <tr class="border-b border-slate-50 hover:bg-slate-50">
                            <td class="py-2 font-mono">${item.date}</td>
                            <td class="py-2 font-bold text-rcem-purple">${item.value}</td>
                            <td class="py-2 text-slate-400">${item.grade || '-'}</td>
                            <td class="py-2 text-right">
                                <button onclick="window.deleteDataPoint('${item.date}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
        `;
    }
    if(window.renderChart) window.renderChart();
}

// ==========================================
// 5. PUBLISH VIEW
// ==========================================

function renderPublish(mode = 'qiat') {
    const d = state.projectData;
    const content = document.getElementById('publish-content');
    
    // Update Mode Buttons
    const modes = ['qiat', 'abstract', 'report'];
    modes.forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if(btn) btn.className = mode === m 
            ? "px-3 py-1 text-xs font-bold rounded bg-white shadow text-rcem-purple" 
            : "px-3 py-1 text-xs font-bold rounded text-slate-500 hover:bg-slate-200";
    });

    const copyBtn = (id) => `
        <button onclick="navigator.clipboard.writeText(document.getElementById('${id}').innerText); showToast('Copied!', 'success')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-300 flex items-center gap-1 transition-colors">
            <i data-lucide="copy" class="w-3 h-3"></i> Copy
        </button>`;

    if (mode === 'abstract') {
        content.innerHTML = `<div class="p-8 bg-white rounded border border-slate-200 text-center text-slate-500">Abstract generator is being updated for 2026 guidelines.</div>`;
    } else if (mode === 'qiat') {
        const s1_1 = `${d.checklist.problem_desc}\n\nContext:\n${d.checklist.context || ''}`;
        const s1_2 = `Methodology: ${d.checklist.methodology}\nDrivers: ${(d.drivers.primary || []).join(', ')}.`;
        const s1_3 = d.checklist.aim;
        const s1_4 = `Outcome: ${d.checklist.measure_outcome}\nProcess: ${d.checklist.measure_process}\n\nAnalysis: ${d.checklist.results_text}`;
        const s1_5 = d.pdsa.map((p, i) => `Cycle ${i+1}: ${p.title}\nAct: ${p.act}`).join('\n\n');

        content.innerHTML = `
            <div class="max-w-5xl mx-auto">
                <div class="bg-indigo-900 text-white p-6 rounded-t-xl flex justify-between items-center">
                    <div><h2 class="text-xl font-bold">RCEM QIAT Report Generator</h2><p class="text-indigo-200 text-sm">Copy directly into your portfolio.</p></div>
                </div>
                <div class="bg-white border-x border-b border-slate-200 p-8 rounded-b-xl space-y-8">
                    <div class="qiat-section">
                        <div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.1 Problem</label>${copyBtn('qiat-1-1')}</div>
                        <div id="qiat-1-1" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm font-mono whitespace-pre-wrap">${escapeHtml(s1_1)}</div>
                    </div>
                    <div class="qiat-section">
                        <div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.3 Aim</label>${copyBtn('qiat-1-3')}</div>
                        <div id="qiat-1-3" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm font-mono whitespace-pre-wrap">${escapeHtml(s1_3)}</div>
                    </div>
                    <div class="qiat-section">
                        <div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.4 Measurement</label>${copyBtn('qiat-1-4')}</div>
                        <div id="qiat-1-4" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm font-mono whitespace-pre-wrap">${escapeHtml(s1_4)}</div>
                    </div>
                </div>
            </div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 6. THE PROJECT CHARTER (Full View)
// ==========================================

function renderFullProject() {
    // Aggregates ALL diagrams and data into one view
    const d = state.projectData;
    const has = (v) => v && v.length > 0 ? v : `<span class="text-slate-400 italic">Not yet defined</span>`;

    document.getElementById('full-project-container').innerHTML = `
        <div class="max-w-6xl mx-auto space-y-8 print:space-y-4">
            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                <h1 class="text-3xl font-bold text-rcem-purple mb-2">${escapeHtml(d.meta.title)}</h1>
                <p class="text-slate-500">Project Lead: ${escapeHtml(d.teamMembers[0]?.name || 'Unknown')}</p>
            </div>

            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="file-text" class="w-5 h-5"></i> 1. Project Charter</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Problem</h3><p class="text-slate-600 bg-slate-50 p-4 rounded">${has(d.checklist.problem_desc)}</p></div>
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Aim</h3><p class="text-indigo-900 font-bold font-serif bg-indigo-50 p-4 rounded border border-indigo-100">${has(d.checklist.aim)}</p></div>
                </div>
            </div>

            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="git-branch" class="w-5 h-5"></i> 2. Driver Diagram</h2>
                <div id="full-view-driver-container" class="mermaid flex justify-center p-4 bg-slate-50 rounded border border-slate-200 min-h-[300px]"></div>
            </div>
            
            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                 <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="bar-chart-2" class="w-5 h-5"></i> 3. Results</h2>
                 <div id="full-view-chart-container" class="mb-6 h-80"></div>
                 <div class="bg-emerald-50 p-4 rounded border border-emerald-100">
                    <h3 class="font-bold text-emerald-900 text-sm uppercase mb-2">Interpretation</h3>
                    <p class="text-emerald-800">${has(d.checklist.results_text)}</p>
                 </div>
            </div>

            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                 <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="refresh-cw" class="w-5 h-5"></i> 4. PDSA Cycles</h2>
                 <div class="space-y-4">
                    ${d.pdsa.map((p,i) => `
                        <div class="border border-slate-200 rounded-lg p-4">
                            <h4 class="font-bold text-slate-800">Cycle ${i+1}: ${escapeHtml(p.title)}</h4>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2 text-sm text-slate-600">
                                <div class="bg-slate-50 p-2 rounded"><strong class="block text-xs uppercase text-slate-400">Plan</strong>${escapeHtml(p.desc)}</div>
                                <div class="bg-slate-50 p-2 rounded"><strong class="block text-xs uppercase text-slate-400">Do</strong>${escapeHtml(p.do)}</div>
                                <div class="bg-slate-50 p-2 rounded"><strong class="block text-xs uppercase text-slate-400">Study</strong>${escapeHtml(p.study)}</div>
                                <div class="bg-slate-50 p-2 rounded"><strong class="block text-xs uppercase text-slate-400">Act</strong>${escapeHtml(p.act)}</div>
                            </div>
                        </div>
                    `).join('')}
                 </div>
            </div>
        </div>
    `;
    
    renderFullViewChart();
    renderTools('full-view-driver-container', 'driver');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 7. SUSTAINABILITY (Green)
// ==========================================

function renderGreen() {
    const el = document.getElementById('view-green');
    el.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div class="flex items-center gap-3 mb-6 border-b pb-4">
                    <div class="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><i data-lucide="leaf" class="w-6 h-6"></i></div>
                    <div>
                        <h3 class="font-bold text-xl text-slate-800">Sustainable Value Calculator</h3>
                        <p class="text-slate-500 text-sm">Triple Bottom Line: Financial, Environmental, Social.</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                        <h4 class="font-bold text-emerald-800 mb-2 flex items-center gap-2"><i data-lucide="tree-pine" class="w-4 h-4"></i> Environmental</h4>
                        <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-emerald-700">Paper Saved</label>
                            <input type="number" id="calc-paper" class="w-full p-2 border border-emerald-200 rounded text-sm bg-white" placeholder="Sheets">
                        </div>
                        <button onclick="window.calcGreen()" class="mt-4 w-full bg-emerald-600 text-white py-2 rounded font-bold text-xs">Calc CO2</button>
                        <div id="res-green" class="mt-2 text-center text-xl font-bold text-emerald-900">-</div>
                    </div>

                    <div class="p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <h4 class="font-bold text-blue-800 mb-2 flex items-center gap-2"><i data-lucide="pound-sterling" class="w-4 h-4"></i> Financial</h4>
                         <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-blue-700">Hours Saved</label>
                            <input type="number" id="calc-hours" class="w-full p-2 border border-blue-200 rounded text-sm bg-white" placeholder="Hours">
                        </div>
                         <button onclick="window.calcTime()" class="mt-4 w-full bg-blue-600 text-white py-2 rounded font-bold text-xs">Calc Savings</button>
                        <div id="res-time" class="mt-2 text-center text-xl font-bold text-blue-900">-</div>
                    </div>
                    
                    <div class="p-6 bg-purple-50 rounded-xl border border-purple-100">
                        <h4 class="font-bold text-purple-800 mb-2 flex items-center gap-2"><i data-lucide="graduation-cap" class="w-4 h-4"></i> Social</h4>
                        <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-purple-700">Staff Trained</label>
                            <input type="number" id="calc-edu-ppl" class="w-full p-2 border border-purple-200 rounded text-sm bg-white" placeholder="People">
                        </div>
                         <button onclick="window.calcEdu()" class="mt-4 w-full bg-purple-600 text-white py-2 rounded font-bold text-xs">Log Impact</button>
                        <div id="res-edu" class="mt-2 text-center text-lg font-bold text-purple-900">-</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 8. PDSA (Improved Layout)
// ==========================================

function renderPDSA() {
    const d = state.projectData;
    const container = document.getElementById('pdsa-container');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 class="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><i data-lucide="plus-circle" class="w-5 h-5 text-rcem-purple"></i> New Cycle</h3>
                <div class="space-y-3">
                    <input id="pdsa-title" class="w-full p-2 border rounded text-sm" placeholder="Cycle Title (e.g. Posters)">
                    <div class="grid grid-cols-2 gap-2">
                        <input type="date" id="pdsa-start" class="w-full p-2 border rounded text-sm">
                        <input type="date" id="pdsa-end" class="w-full p-2 border rounded text-sm">
                    </div>
                    <textarea id="pdsa-plan" class="w-full p-2 border rounded text-sm" rows="3" placeholder="Plan: What will you do?"></textarea>
                    <button onclick="window.addPDSA()" class="w-full bg-slate-800 text-white py-2 rounded font-bold text-sm hover:bg-slate-900">Add Cycle</button>
                </div>
            </div>

            <div class="lg:col-span-2 space-y-6">
                ${d.pdsa.length === 0 ? `<div class="text-center p-10 text-slate-400 italic">No PDSA cycles yet. Plan your first one!</div>` : ''}
                ${d.pdsa.map((p,i) => `
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg">Cycle ${i+1}: ${escapeHtml(p.title)}</h4>
                            <div class="text-xs text-slate-500 font-mono">${p.start} - ${p.end}</div>
                        </div>
                        <button onclick="window.deletePDSA(${i})" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold uppercase text-slate-400">Plan</label>
                            <textarea onchange="window.updatePDSA(${i}, 'desc', this.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm resize-y min-h-[80px] focus:bg-white focus:ring-1 focus:ring-rcem-purple outline-none">${escapeHtml(p.desc)}</textarea>
                        </div>
                        <div class="space-y-1">
                             <label class="text-[10px] font-bold uppercase text-slate-400">Do</label>
                            <textarea onchange="window.updatePDSA(${i}, 'do', this.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm resize-y min-h-[80px] focus:bg-white focus:ring-1 focus:ring-rcem-purple outline-none">${escapeHtml(p.do)}</textarea>
                        </div>
                        <div class="space-y-1">
                             <label class="text-[10px] font-bold uppercase text-slate-400">Study</label>
                            <textarea onchange="window.updatePDSA(${i}, 'study', this.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm resize-y min-h-[80px] focus:bg-white focus:ring-1 focus:ring-rcem-purple outline-none">${escapeHtml(p.study)}</textarea>
                        </div>
                        <div class="space-y-1">
                             <label class="text-[10px] font-bold uppercase text-slate-400">Act</label>
                            <textarea onchange="window.updatePDSA(${i}, 'act', this.value)" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm resize-y min-h-[80px] focus:bg-white focus:ring-1 focus:ring-rcem-purple outline-none">${escapeHtml(p.act)}</textarea>
                        </div>
                    </div>
                </div>`).join('')}
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 9. STAKEHOLDERS (Interactive)
// ==========================================

function renderStakeholders() {
    const el = document.getElementById('view-stakeholders');
    const isList = el.getAttribute('data-view') === 'list';
    const canvas = document.getElementById('stakeholder-canvas');
    
    // Header controls
    if(!document.getElementById('stake-controls')) {
        const header = document.createElement('div');
        header.id = 'stake-controls';
        header.className = 'flex justify-between items-center p-4 bg-white border-b border-slate-200';
        header.innerHTML = `
            <h3 class="font-bold text-slate-800">Stakeholder Matrix</h3>
            <div class="flex gap-2">
                <button onclick="window.addStakeholder()" class="bg-rcem-purple text-white px-3 py-1 rounded text-xs font-bold shadow">+ Add Stakeholder</button>
                <button onclick="window.toggleStakeView()" class="bg-slate-100 text-slate-600 px-3 py-1 rounded text-xs font-bold hover:bg-slate-200">Switch View</button>
            </div>`;
        el.insertBefore(header, el.firstChild);
    }

    if(isList) {
        canvas.innerHTML = `
        <div class="p-8 max-w-4xl mx-auto">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50 border-b border-slate-200"><tr class="text-xs font-bold text-slate-500 uppercase"><th class="p-4">Name</th><th class="p-4">Influence (Y)</th><th class="p-4">Interest (X)</th><th class="p-4"></th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                        ${state.projectData.stakeholders.map((s,i)=>`
                        <tr>
                            <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" value="${escapeHtml(s.name)}" onchange="window.updateStake(${i},'name',this.value)"></td>
                            <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" type="number" min="0" max="100" value="${s.y}" onchange="window.updateStake(${i},'y',this.value)"></td>
                            <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" type="number" min="0" max="100" value="${s.x}" onchange="window.updateStake(${i},'x',this.value)"></td>
                            <td class="p-2 text-center"><button onclick="window.removeStake(${i})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    } else {
        // VISUAL MATRIX
        canvas.innerHTML = `
            <div class="absolute inset-0 bg-white">
                <div class="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 dashed z-0"></div>
                <div class="absolute top-1/2 left-0 right-0 h-px bg-slate-300 dashed z-0"></div>
                
                <div class="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase bg-white px-2">High Power</div>
                <div class="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 uppercase bg-white px-2">Low Power</div>
                <div class="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase -rotate-90 bg-white px-2">Low Interest</div>
                <div class="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase rotate-90 bg-white px-2">High Interest</div>
            </div>
        `;
        
        state.projectData.stakeholders.forEach((s, i) => {
            const bubble = document.createElement('div');
            bubble.className = 'absolute bg-white border-2 border-rcem-purple text-rcem-purple px-3 py-1 rounded shadow-lg cursor-grab z-10 text-sm font-bold flex items-center gap-2 group max-w-[150px]';
            // Convert state X/Y (0-100) to CSS style
            bubble.style.left = `${s.x}%`; 
            bubble.style.bottom = `${s.y}%`; 
            bubble.innerHTML = `
                <span class="truncate pointer-events-none">${escapeHtml(s.name)}</span>
                <button onclick="window.removeStake(${i})" class="hidden group-hover:block text-red-500 hover:bg-red-50 rounded-full p-0.5"><i data-lucide="x" class="w-3 h-3"></i></button>
            `;
            
            // Apply Draggable logic
            makeDraggable(bubble, canvas, false, null, null, (newX, newY) => {
                state.projectData.stakeholders[i].x = Math.round(newX);
                // Convert Top% back to Bottom% for Y
                state.projectData.stakeholders[i].y = Math.round(100 - newY);
                window.saveData();
            });
            
            canvas.appendChild(bubble);
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 10. GANTT CHART (Visual Rewrite)
// ==========================================

function renderGantt() {
    const d = state.projectData;
    const container = document.getElementById('gantt-container');
    const scrollContainer = document.getElementById('gantt-scroll-container');
    
    if (d.gantt.length === 0) {
        container.innerHTML = `<div class="text-center p-12 text-slate-400 italic">No tasks yet. Click "Add Task" to start planning your timeline.</div>`;
        return;
    }

    // 1. Calculate Timeline Range
    const dates = d.gantt.flatMap(t => [new Date(t.start), new Date(t.end)]);
    if(dates.length === 0) return;
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 7); // Buffer
    maxDate.setDate(maxDate.getDate() + 7);
    
    const pxPerDay = 30;
    const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    const totalWidth = totalDays * pxPerDay;
    
    // 2. Build Header (Months)
    let headerHTML = '<div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">';
    let current = new Date(minDate);
    
    while(current <= maxDate) {
        const monthStr = current.toLocaleString('default', { month: 'short', year: '2-digit' });
        const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        const width = daysInMonth * pxPerDay;
        
        headerHTML += `<div class="border-r border-slate-200 text-xs font-bold text-slate-500 uppercase p-2 flex-shrink-0" style="width: ${width}px">${monthStr}</div>`;
        current.setMonth(current.getMonth() + 1);
        current.setDate(1); 
    }
    headerHTML += '</div>';

    // 3. Build Rows
    let rowsHTML = '<div class="relative min-h-[400px]">';
    const sortedTasks = [...d.gantt].sort((a,b) => new Date(a.start) - new Date(b.start));
    
    sortedTasks.forEach(t => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        const offsetDays = (start - minDate) / (1000 * 60 * 60 * 24);
        const durationDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
        
        const left = offsetDays * pxPerDay;
        const width = durationDays * pxPerDay;
        const colorClass = t.type === 'plan' ? 'bg-blue-500' : t.type === 'do' ? 'bg-amber-500' : 'bg-emerald-500';
        
        rowsHTML += `
            <div class="group relative h-12 border-b border-slate-100 hover:bg-slate-50 transition-colors flex items-center">
                <div class="absolute left-2 z-10 text-xs font-bold text-slate-700 w-48 truncate bg-white/90 px-1 rounded shadow-sm border border-slate-100 pointer-events-none">
                    ${escapeHtml(t.name)}
                </div>
                <div class="absolute h-6 rounded-full shadow-sm text-white text-[10px] font-bold flex items-center px-2 cursor-pointer ${colorClass} hover:brightness-110 transition-all z-10" 
                     style="left: ${left}px; width: ${width}px;"
                     onclick="if(confirm('Delete task?')) window.deleteGantt('${t.id}')"
                     title="${t.name}: ${t.start} to ${t.end}">
                </div>
                <div class="absolute inset-0 w-full h-full pointer-events-none" style="background-image: linear-gradient(to right, #f1f5f9 1px, transparent 1px); background-size: ${pxPerDay * 7}px 100%;"></div>
            </div>
        `;
    });
    rowsHTML += '</div>';

    container.style.minWidth = `${totalWidth}px`;
    container.innerHTML = headerHTML + rowsHTML;
}

// ==========================================
// 11. HELPERS
// ==========================================

function renderTeam() {
    const list = document.getElementById('team-list');
    list.innerHTML = state.projectData.teamMembers.length === 0 ? `<div class="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">No team members added yet.</div>` : state.projectData.teamMembers.map((m, i) => `
        <div class="p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative group hover:shadow-md transition-shadow">
            <button onclick="window.deleteMember(${i})" class="absolute top-3 right-3 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold shadow-md">${m.initials}</div>
                <div>
                    <div class="font-bold text-slate-800">${escapeHtml(m.name)}</div>
                    <div class="text-xs font-bold text-rcem-purple uppercase tracking-wide mb-1">${escapeHtml(m.role)}</div>
                    ${m.grade ? `<div class="text-xs text-slate-500"><span class="font-semibold">Grade:</span> ${escapeHtml(m.grade)}</div>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    const logList = document.getElementById('leadership-log-list');
    if(logList) {
        const logs = state.projectData.leadershipLogs || [];
        logList.innerHTML = `
            <div class="mt-8">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold text-slate-800">Leadership Log</h3>
                    <button onclick="window.addLeadershipLog()" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded border border-slate-300 transition-colors">+ Add Log</button>
                </div>
                ${logs.length === 0 ? '<div class="text-slate-400 text-sm italic">Record meetings & engagements here.</div>' : 
                `<div class="space-y-3">
                    ${logs.map((log, i) => `
                    <div class="bg-white p-3 rounded border border-slate-200 text-sm relative group">
                        <button onclick="window.deleteLeadershipLog(${i})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-3 h-3"></i></button>
                        <div class="font-bold text-slate-700 text-xs mb-1">${log.date}</div>
                        <div class="text-slate-800">${escapeHtml(log.note)}</div>
                    </div>`).join('')}
                </div>`}
            </div>`;
    }
}

function calcGreen() { const s = document.getElementById('calc-paper').value; document.getElementById('res-green').innerText = `${(s * 0.005).toFixed(2)} kg CO2`; }
function calcTime() { const h = document.getElementById('calc-hours').value; document.getElementById('res-time').innerText = `£${(h * 30).toFixed(2)} / month`; }
function calcEdu() { const p = document.getElementById('calc-edu-ppl').value; if(p) { document.getElementById('res-edu').innerText = `${p} staff upskilled!`; showToast("Impact logged", "success"); } }

function openMemberModal() { document.getElementById('member-modal').classList.remove('hidden'); }
function openGanttModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function toggleToolList() { renderTools(); }

function updateFishCat(i, v) { state.projectData.fishbone.categories[i].text = v; window.saveData(); }
function updateFishCause(i, j, v) { state.projectData.fishbone.categories[i].causes[j].text = v; window.saveData(); }
function addFishCause(i) { state.projectData.fishbone.categories[i].causes.push({text: "New", x: 50, y: 50}); window.saveData(); renderTools(); }
function removeFishCause(i, j) { state.projectData.fishbone.categories[i].causes.splice(j, 1); window.saveData(); renderTools(); }

function addLeadershipLog() { const n = prompt("Note:"); if(n) { if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs=[]; state.projectData.leadershipLogs.push({date:new Date().toLocaleDateString(), note:n}); window.saveData(); renderTeam(); showToast("Log added", "success"); } }
function deleteLeadershipLog(i) { if(confirm("Delete?")) { state.projectData.leadershipLogs.splice(i, 1); window.saveData(); renderTeam(); } }

function addStakeholder() { const n = prompt("Name:"); if(n) { state.projectData.stakeholders.push({name:n, x:50, y:50}); window.saveData(); renderStakeholders(); } }
function updateStake(i, k, v) { state.projectData.stakeholders[i][k] = v; window.saveData(); }
function removeStake(i) { if(confirm("Remove?")) { state.projectData.stakeholders.splice(i,1); window.saveData(); renderStakeholders(); } }
function toggleStakeView() { const e = document.getElementById('view-stakeholders'); e.setAttribute('data-view', e.getAttribute('data-view')==='list'?'visual':'list'); renderStakeholders(); }

function addPDSA() { const t=document.getElementById('pdsa-title').value; const s=document.getElementById('pdsa-start').value; const e=document.getElementById('pdsa-end').value; const p=document.getElementById('pdsa-plan').value; if(t){ state.projectData.pdsa.push({title:t, start:s, end:e, desc:p, do:'', study:'', act:''}); window.saveData(); renderPDSA(); showToast("Cycle added", "success"); } else { showToast("Title required", "error"); } }
function updatePDSA(i, f, v) { state.projectData.pdsa[i][f] = v; window.saveData(); }
function deletePDSA(i) { if(confirm("Delete?")) { state.projectData.pdsa.splice(i,1); window.saveData(); renderPDSA(); } }

function saveSmartAim() { showToast("Aim saved", "info"); } 
function openPortfolioExport() { showToast("Coming soon", "info"); } 
function copyReport() { navigator.clipboard.writeText("Report copied"); showToast("Copied", "success"); } 
function showHelp() { alert("Use the tabs to navigate your QIP journey."); } 
function startTour() { showToast("Tour not available", "info"); }

export { 
    renderDashboard, renderAll, renderDataView, renderPDSA, renderGantt, renderTools, 
    renderTeam, renderPublish, renderChecklist, renderFullProject, renderStakeholders, 
    renderGreen, openMemberModal, openGanttModal, toggleToolList, 
    updateFishCat, updateFishCause, addFishCause, removeFishCause,
    addLeadershipLog, deleteLeadershipLog,
    addStakeholder, updateStake, removeStake, toggleStakeView,
    addPDSA, updatePDSA, deletePDSA,
    saveSmartAim, openPortfolioExport, copyReport,
    calcGreen, calcTime, calcEdu,
    showHelp, startTour
};
