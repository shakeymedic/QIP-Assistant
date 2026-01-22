import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, setToolMode, renderFullViewChart, makeDraggable, chartMode } from "./charts.js";
import { suggestEvidence } from "./ai.js";

// ==========================================
// 1. MAIN ROUTER & NAVIGATION
// ==========================================

function renderAll(view) {
    updateNavigationUI(view);
    
    // Router
    switch(view) {
        case 'projects': 
            break; 
        case 'dashboard': 
            renderDashboard(); 
            break;
        case 'checklist': 
            renderChecklist(); 
            break; 
        case 'team': 
            renderTeam(); 
            break;
        case 'tools': 
            renderTools(); 
            break;
        case 'data': 
            renderDataView(); 
            break;       
        case 'pdsa': 
            renderPDSA(); 
            break;
        case 'stakeholders': 
            renderStakeholders(); 
            break;
        case 'gantt': 
            renderGantt(); 
            break;
        case 'green': 
            renderGreen(); 
            break;         
        case 'full': 
            renderFullProject(); 
            break;    
        case 'publish': 
            renderPublish(); 
            break;     
        default: 
            renderDashboard();
    }

    // Trigger auto-resize on all textareas after render
    setTimeout(() => {
        document.querySelectorAll('textarea').forEach(el => autoResizeTextarea(el));
    }, 50);

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
        if(id === 'checklist' && d.checklist && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist && d.checklist.ethics) status = '✓';
        else if(id === 'tools' && d.drivers && (d.drivers.primary.length > 0 || d.drivers.changes.length > 0)) status = '✓';
        
        // Remove existing badge
        const existingBadge = btn.querySelector('.status-badge');
        if(existingBadge) existingBadge.remove();

        if(status) {
            const badge = document.createElement('span');
            badge.className = 'status-badge ml-auto text-emerald-400 font-bold text-[10px]';
            badge.textContent = status;
            btn.appendChild(badge);
        }
    });
}

// ==========================================
// 2. DASHBOARD (HOME)
// ==========================================

function renderDashboard() {
    const d = state.projectData;
    if (!d) return;
    
    // Calculate Project Progress Score
    let score = 0;
    if(d.checklist && d.checklist.aim && d.checklist.problem_desc) score += 20;
    if(d.teamMembers && d.teamMembers.length > 0) score += 10;
    if(d.drivers && (d.drivers.primary.length > 0 || (d.fishbone && d.fishbone.categories[0].causes.length > 0))) score += 20;
    if(d.chartData && d.chartData.length >= 6) score += 20;
    if(d.pdsa && d.pdsa.length > 0) score += 20;
    if(d.checklist && d.checklist.sustain) score += 10;
    
    const totalProg = Math.min(100, score);

    // 1. Circular Progress Display
    const statProgress = document.getElementById('stat-progress');
    if (statProgress) {
        statProgress.innerHTML = `
            <div class="flex items-center gap-6">
                <div class="relative w-24 h-24 flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="#f1f5f9" stroke-width="8" fill="transparent" />
                        <circle cx="48" cy="48" r="40" stroke="#2d2e83" stroke-width="8" fill="transparent" stroke-dasharray="251.2" stroke-dashoffset="${251.2 - (251.2 * totalProg / 100)}" class="transition-all duration-1000" />
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
    }
    
    // 2. QI Coach Logic (Smart Banners)
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Next Step: Data", m: "You need a baseline. Add at least 6 data points.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    
    if (!d.checklist || !d.checklist.aim) {
        msg = { t: "Next Step: Define Aim", m: "Use the wizard to define a SMART aim.", i: "target", c: "rose-500", b: "Go to Wizard", a: "checklist" };
    } else if (!d.drivers || d.drivers.primary.length === 0) {
        msg = { t: "Next Step: Diagnosis", m: "Build your Driver Diagram to understand the problem.", i: "git-branch", c: "amber-500", b: "Build Diagram", a: "tools" };
    } else if (d.chartData && d.chartData.length >= 6 && (!d.pdsa || d.pdsa.length === 0)) {
        msg = { t: "Next Step: PDSA", m: "Baseline established. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
    } else if (d.pdsa && d.pdsa.length > 0 && (!d.checklist.sustain)) {
        msg = { t: "Next Step: Sustainability", m: "Document how you'll sustain improvements.", i: "leaf", c: "emerald-600", b: "Add Plan", a: "checklist" };
    }
    
    if (coachEl) {
        coachEl.innerHTML = `
            <div class="card-modern p-6 mb-8 flex flex-col md:flex-row gap-6 items-center border-l-4 border-l-rcem-purple relative overflow-hidden">
                <div class="bg-indigo-50 p-4 rounded-full text-rcem-purple">
                    <i data-lucide="${msg.i}" class="w-6 h-6"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 text-lg">${msg.t}</h4>
                    <p class="text-slate-600 text-sm">${msg.m}</p>
                </div>
                <button onclick="window.router('${msg.a}')" class="bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors shadow-lg flex items-center gap-2">
                    ${msg.b} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }

    // 3. Mini Stats
    const statsContainer = document.getElementById('stat-pdsa');
    if (statsContainer && statsContainer.parentElement && statsContainer.parentElement.parentElement) {
        const container = statsContainer.parentElement.parentElement;
        container.className = "grid grid-cols-2 md:grid-cols-4 gap-4";
        container.innerHTML = `
             <div class="card-modern p-4 text-center">
                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Data Points</div>
                <div class="text-2xl font-bold text-slate-800 gradient-text">${d.chartData?.length || 0}</div>
             </div>
             <div class="card-modern p-4 text-center">
                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">PDSA Cycles</div>
                <div class="text-2xl font-bold text-slate-800 gradient-text">${d.pdsa?.length || 0}</div>
             </div>
             <div class="card-modern p-4 text-center">
                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Drivers</div>
                <div class="text-2xl font-bold text-slate-800 gradient-text">${d.drivers?.primary?.length || 0}</div>
             </div>
             <div class="card-modern p-4 text-center">
                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Team</div>
                <div class="text-2xl font-bold text-slate-800 gradient-text">${d.teamMembers?.length || 0}</div>
             </div>
        `;
    }

    // 4. Aim Display
    const aimEl = document.getElementById('dash-aim-display');
    if (aimEl) {
        aimEl.innerHTML = d.checklist?.aim || `<span class="text-slate-400">No aim defined yet.</span>`;
        aimEl.className = d.checklist?.aim 
            ? "bg-indigo-50 p-4 rounded border border-indigo-100 text-rcem-purple font-medium font-serif" 
            : "bg-slate-50 p-4 rounded border border-slate-200 text-slate-500 italic";
    }
}

// ==========================================
// 3. CHECKLIST (WIZARD)
// ==========================================

window.runEvidenceAI = async () => {
    const btn = document.getElementById('btn-evidence-ai');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Researching...`;
    
    const result = await suggestEvidence();
    if (result) {
        state.projectData.checklist.lit_review = result;
        window.saveData();
        renderChecklist();
        showToast("Evidence added", "success");
    }
    if(btn) btn.innerHTML = `<i data-lucide="book-open" class="w-3 h-3"></i> Auto-Evidence`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

function renderChecklist() {
    const d = state.projectData;
    if (!d) return;
    const cl = d.checklist || {};
    const container = document.getElementById('checklist-container');
    if (!container) return;

    // AI Buttons
    const aiAimBtn = (window.hasAI && window.hasAI()) 
        ? `<button onclick="window.aiRefineAim()" id="btn-ai-aim" class="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 font-bold flex items-center gap-1 transition-colors"><i data-lucide="sparkles" class="w-3 h-3"></i> Refine</button>` 
        : '';
        
    const aiEvBtn = (window.hasAI && window.hasAI()) 
        ? `<button onclick="window.runEvidenceAI()" id="btn-evidence-ai" class="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 font-bold flex items-center gap-1 transition-colors"><i data-lucide="book-open" class="w-3 h-3"></i> Auto-Evidence</button>` 
        : '';

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-8">
                
                <div class="card-modern p-6">
                    <div class="flex items-center gap-3 mb-4 border-b pb-2">
                        <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold">1</div>
                        <h3 class="text-lg font-bold text-slate-800">Define the Problem</h3>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Problem Description</label>
                            <textarea class="w-full p-3 border rounded text-sm focus:border-rcem-purple bg-slate-50 focus:bg-white transition-colors" rows="3" placeholder="What is the issue? Why does it matter?" onchange="window.saveChecklist('problem_desc', this.value)">${escapeHtml(cl.problem_desc || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Context</label>
                            <input class="w-full p-2 border rounded text-sm focus:border-rcem-purple" placeholder="Dept size, throughput, etc." value="${escapeHtml(cl.problem_context || '')}" onchange="window.saveChecklist('problem_context', this.value)">
                        </div>
                    </div>
                </div>

                <div class="card-modern p-6">
                    <div class="flex items-center gap-3 mb-4 border-b pb-2">
                        <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold">2</div>
                        <h3 class="text-lg font-bold text-slate-800">SMART Aim</h3>
                    </div>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div><label class="text-[10px] font-bold uppercase text-slate-400">Measure</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.aim_measure || '')}" onchange="window.saveChecklist('aim_measure', this.value)"></div>
                            <div><label class="text-[10px] font-bold uppercase text-slate-400">Baseline</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.aim_baseline || '')}" onchange="window.saveChecklist('aim_baseline', this.value)"></div>
                            <div><label class="text-[10px] font-bold uppercase text-slate-400">Target</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.aim_target || '')}" onchange="window.saveChecklist('aim_target', this.value)"></div>
                            <div><label class="text-[10px] font-bold uppercase text-slate-400">Date</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.aim_date || '')}" onchange="window.saveChecklist('aim_date', this.value)"></div>
                        </div>
                        <div class="bg-indigo-50 p-4 rounded border border-indigo-100 relative">
                             <div class="flex justify-between items-start mb-2">
                                <label class="block text-xs font-bold text-indigo-400 uppercase">Aim Statement</label>
                                ${aiAimBtn}
                            </div>
                            <textarea class="w-full p-2 bg-transparent border-none text-sm font-medium text-indigo-900 focus:ring-0 font-serif" rows="3" placeholder="To increase..." onchange="window.saveChecklist('aim', this.value)">${escapeHtml(cl.aim || '')}</textarea>
                        </div>
                    </div>
                </div>

                <div class="card-modern p-6">
                     <div class="flex items-center gap-3 mb-4 border-b pb-2">
                        <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold">3</div>
                        <h3 class="text-lg font-bold text-slate-800">Sustainability</h3>
                    </div>
                    <div class="space-y-4">
                        <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Key Learning</label><textarea class="w-full p-2 border rounded text-sm" rows="3" onchange="window.saveChecklist('learning', this.value)">${escapeHtml(cl.learning || '')}</textarea></div>
                        <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Sustain Plan</label><textarea class="w-full p-2 border rounded text-sm" rows="3" onchange="window.saveChecklist('sustain', this.value)">${escapeHtml(cl.sustain || '')}</textarea></div>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                 <div class="card-modern p-5">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="font-bold text-slate-800">Evidence Base</h4>
                        ${aiEvBtn}
                    </div>
                    <textarea class="w-full p-2 border rounded text-sm focus:border-rcem-purple bg-slate-50" rows="8" placeholder="NICE Guidelines, RCEM Standards..." onchange="window.saveChecklist('lit_review', this.value)">${escapeHtml(cl.lit_review || '')}</textarea>
                </div>

                <div class="card-modern p-5">
                    <h4 class="font-bold text-slate-800 mb-3">Measures</h4>
                    <div class="space-y-3">
                        <div><label class="block text-[10px] font-bold text-slate-400 uppercase">Outcome</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.measure_outcome || '')}" onchange="window.saveChecklist('measure_outcome', this.value)"></div>
                        <div><label class="block text-[10px] font-bold text-slate-400 uppercase">Process</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.measure_process || '')}" onchange="window.saveChecklist('measure_process', this.value)"></div>
                        <div><label class="block text-[10px] font-bold text-slate-400 uppercase">Balance</label><input class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.measure_balance || '')}" onchange="window.saveChecklist('measure_balance', this.value)"></div>
                    </div>
                </div>
                
                <div class="card-modern p-5">
                    <h4 class="font-bold text-slate-800 mb-3">Ethics</h4>
                    <textarea class="w-full p-2 border rounded text-sm" rows="2" placeholder="Statement..." onchange="window.saveChecklist('ethics', this.value)">${escapeHtml(cl.ethics || '')}</textarea>
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
    if (!d) return;
    
    const formContainer = document.getElementById('data-form-container');
    if (formContainer) {
        formContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input type="date" id="chart-date" class="w-full p-2 border border-slate-300 rounded text-sm focus:border-rcem-purple">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Value</label>
                    <input type="number" id="chart-value" class="w-full p-2 border border-slate-300 rounded text-sm focus:border-rcem-purple" placeholder="0" step="any">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Context</label>
                <select id="chart-grade" class="w-full p-2 border border-slate-300 rounded text-sm bg-white focus:border-rcem-purple">
                    <option value="Audit Point">Audit Point</option>
                    <option value="Baseline">Baseline</option>
                    <option value="Intervention">Intervention</option>
                    <option value="Post-Intervention">Post-Intervention</option>
                </select>
            </div>
            <div class="pt-2">
                <button onclick="window.addDataPoint()" class="w-full bg-rcem-purple text-white py-2 rounded font-bold hover:bg-indigo-900 shadow transition-colors">Add Data Point</button>
            </div>
            <div class="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button onclick="document.getElementById('csv-upload').click()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"><i data-lucide="upload" class="w-3 h-3"></i> Upload CSV</button>
                <button onclick="window.downloadCSVTemplate()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"><i data-lucide="download" class="w-3 h-3"></i> Template</button>
            </div>
        `;
    }

    // Chart Mode Controls
    let chartModeControls = document.getElementById('chart-mode-controls');
    if (!chartModeControls) {
        const chartArea = document.querySelector('#view-data canvas');
        if (chartArea && chartArea.parentElement) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="mb-4 bg-slate-100 p-2 rounded-lg flex flex-wrap gap-2 justify-center items-center" id="chart-mode-controls">
                    <span class="text-xs font-bold text-slate-500 uppercase mr-2">Chart Type:</span>
                    <button onclick="window.setChartMode('run')" data-mode="run" class="px-3 py-1 rounded text-xs font-bold bg-slate-800 text-white shadow">Run Chart</button>
                    <button onclick="window.setChartMode('spc')" data-mode="spc" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50">SPC</button>
                    <button onclick="window.setChartMode('histogram')" data-mode="histogram" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50">Histogram</button>
                    <button onclick="window.setChartMode('pareto')" data-mode="pareto" class="px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50">Pareto</button>
                </div>
            `;
            chartArea.parentElement.insertBefore(wrapper.firstElementChild, chartArea);
        }
    }

    // Results Box
    const resultsText = document.getElementById('results-text');
    if (resultsText && d.checklist) {
        resultsText.value = d.checklist.results_text || '';
    }

    // AI Chart Button
    const aiChartBtn = (window.hasAI && window.hasAI()) 
        ? `<button onclick="window.aiAnalyseChart()" id="btn-ai-chart" class="text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-1 rounded shadow hover:shadow-md flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> AI Analyse</button>` 
        : '';
        
    const resultsContainer = resultsText?.parentElement;
    if (resultsContainer) {
        const header = resultsContainer.querySelector('h3');
        if(header && !header.querySelector('button')) {
            const wrap = document.createElement('div');
            wrap.className = "flex justify-between items-center mb-2";
            wrap.innerHTML = `<span class="font-bold text-slate-800">Results & Interpretation</span>${aiChartBtn}`;
            header.replaceWith(wrap);
        }
    }

    // History
    const historyContainer = document.getElementById('data-history');
    if (historyContainer) {
        if (!d.chartData || d.chartData.length === 0) {
            historyContainer.innerHTML = `<div class="text-center py-8 text-slate-400 italic text-xs">No data yet.</div>`;
        } else {
            const sorted = [...d.chartData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
            historyContainer.innerHTML = `
                <table class="w-full text-left border-collapse">
                    <thead><tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200"><th class="pb-2">Date</th><th class="pb-2">Value</th><th class="pb-2">Type</th><th class="pb-2 text-right"></th></tr></thead>
                    <tbody class="text-xs text-slate-700">
                        ${sorted.map(item => `
                            <tr class="border-b border-slate-50 hover:bg-slate-50">
                                <td class="py-2 font-mono">${escapeHtml(item.date)}</td>
                                <td class="py-2 font-bold text-rcem-purple">${item.value}</td>
                                <td class="py-2 text-slate-400">${escapeHtml(item.grade || '-')}</td>
                                <td class="py-2 text-right"><button onclick="window.deleteDataPoint('${item.date}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            `;
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (window.renderChart) window.renderChart();
}

// ==========================================
// 5. PUBLISH VIEW (QIAT UPDATE)
// ==========================================

function renderPublish(mode = 'qiat') {
    const d = state.projectData;
    if (!d) return;
    
    const content = document.getElementById('publish-content');
    if (!content) return;
    
    const modes = ['qiat', 'abstract', 'report'];
    modes.forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if(btn) btn.className = mode === m 
            ? "px-3 py-1 text-xs font-bold rounded bg-white shadow text-rcem-purple" 
            : "px-3 py-1 text-xs font-bold rounded text-slate-500 hover:bg-slate-200";
    });

    const copyBtn = (id) => `
        <button onclick="navigator.clipboard.writeText(document.getElementById('${id}').innerText); window.showToast ? window.showToast('Copied!', 'success') : alert('Copied!')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-300 flex items-center gap-1 transition-colors">
            <i data-lucide="copy" class="w-3 h-3"></i> Copy
        </button>`;

    const cl = d.checklist || {};

    // Helper for QIAT blocks
    const QiatBlock = (id, label, text) => `
        <div class="qiat-section mb-6">
            <div class="flex justify-between items-end mb-2">
                <label class="text-sm font-bold text-slate-800 uppercase tracking-wide border-l-4 border-rcem-purple pl-2">${label}</label>
                ${copyBtn(id)}
            </div>
            <div id="${id}" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm font-mono whitespace-pre-wrap text-slate-700">${escapeHtml(text || 'Not documented')}</div>
        </div>
    `;

    if (mode === 'abstract') {
        content.innerHTML = `
            <div class="max-w-4xl mx-auto card-modern overflow-hidden">
                <div class="bg-sky-900 text-white p-6 flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold">RCEM Abstract Generator</h2>
                        <p class="text-sky-200 text-sm">Structured abstract for conference submission</p>
                    </div>
                    ${copyBtn('abstract-output')}
                </div>
                <div class="p-8">
                    <div id="abstract-output" class="prose max-w-none">
                        <h3 class="text-lg font-bold text-slate-800 mb-2">${escapeHtml(d.meta?.title || 'Untitled Project')}</h3>
                        <div class="space-y-4 text-sm text-slate-700">
                            <div><strong class="text-slate-800">Background:</strong> ${escapeHtml(cl.problem_desc || 'Not defined')}</div>
                            <div><strong class="text-slate-800">Aim:</strong> ${escapeHtml(cl.aim || 'Not defined')}</div>
                            <div><strong class="text-slate-800">Methods:</strong> ${escapeHtml(cl.methodology || 'Model for Improvement using PDSA cycles')}. ${d.pdsa && d.pdsa.length > 0 ? `${d.pdsa.length} PDSA cycle(s) were completed.` : ''}</div>
                            <div><strong class="text-slate-800">Results:</strong> ${escapeHtml(cl.results_text || 'Not documented')}</div>
                            <div><strong class="text-slate-800">Conclusions:</strong> ${escapeHtml(cl.learning || 'Not documented')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (mode === 'report') {
        content.innerHTML = `
            <div class="max-w-4xl mx-auto card-modern overflow-hidden">
                <div class="bg-emerald-900 text-white p-6">
                    <h2 class="text-xl font-bold">FRCEM QIP Report</h2>
                    <p class="text-emerald-200 text-sm">Structured report for FRCEM portfolio</p>
                </div>
                <div class="p-8 space-y-8">
                    <div class="report-section">
                        <div class="flex justify-between items-end mb-2"><h3 class="text-lg font-bold text-slate-800">1. Project Overview</h3>${copyBtn('report-overview')}</div>
                        <div id="report-overview" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm">
                            <p><strong>Title:</strong> ${escapeHtml(d.meta?.title || 'Untitled')}</p>
                            <p><strong>Setting:</strong> ${escapeHtml(cl.context || 'Not specified')}</p>
                            <p><strong>Team:</strong> ${escapeHtml(cl.team || (d.teamMembers ? d.teamMembers.map(m => m.name).join(', ') : 'Not specified'))}</p>
                        </div>
                    </div>
                    ${QiatBlock('rep-prob', '2. Problem & Aim', `Problem: ${cl.problem_desc}\n\nAim: ${cl.aim}`)}
                    ${QiatBlock('rep-res', '3. Results', cl.results_text)}
                    ${QiatBlock('rep-learn', '4. Learning & Sustainability', `Learning: ${cl.learning}\n\nSustainability: ${cl.sustain}`)}
                </div>
            </div>
        `;
    } else {
        // FULL QIAT MODE
        const teamStr = d.teamMembers ? d.teamMembers.map(m => `${m.name} (${m.role})`).join(', ') : '';
        const driverStr = d.drivers ? `Primary: ${d.drivers.primary.join(', ')}\nSecondary: ${d.drivers.secondary.join(', ')}\nChange Ideas: ${d.drivers.changes.join(', ')}` : '';
        const measureStr = `Outcome: ${cl.measure_outcome || ''}\nProcess: ${cl.measure_process || ''}\nBalance: ${cl.measure_balance || ''}`;
        const pdsaStr = d.pdsa ? d.pdsa.map((p,i) => `Cycle ${i+1}: ${p.title} (${p.start})\nPlan: ${p.desc}\nDo: ${p.do}\nStudy: ${p.study}\nAct: ${p.act}`).join('\n\n') : '';

        content.innerHTML = `
            <div class="max-w-5xl mx-auto card-modern overflow-hidden">
                <div class="bg-indigo-900 text-white p-6">
                    <h2 class="text-xl font-bold">Full QIAT / Risr Form Data</h2>
                    <p class="text-indigo-200 text-sm">Every section required for the official submission.</p>
                </div>
                <div class="p-8">
                    ${QiatBlock('qiat-title', 'Project Title', d.meta?.title)}
                    ${QiatBlock('qiat-team', 'Project Team / Leadership', teamStr)}
                    ${QiatBlock('qiat-context', 'Context / Setting', cl.context)}
                    ${QiatBlock('qiat-prob', 'Problem / Background', cl.problem_desc)}
                    ${QiatBlock('qiat-evidence', 'Baseline Evidence', cl.problem_evidence)}
                    ${QiatBlock('qiat-aim', 'SMART Aim', cl.aim)}
                    ${QiatBlock('qiat-drivers', 'Drivers & Change Ideas', driverStr)}
                    ${QiatBlock('qiat-measures', 'Measures (Outcome, Process, Balance)', measureStr)}
                    ${QiatBlock('qiat-pdsa', 'PDSA Cycles Summary', pdsaStr)}
                    ${QiatBlock('qiat-results', 'Results & Analysis', cl.results_text)}
                    ${QiatBlock('qiat-learning', 'Key Learning / Conclusions', cl.learning)}
                    ${QiatBlock('qiat-sustain', 'Sustainability Plan', cl.sustain)}
                    ${QiatBlock('qiat-ethics', 'Ethics / Governance', cl.ethics)}
                </div>
            </div>
        `;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 6. FULL PROJECT VIEW
// ==========================================

function renderFullProject() {
    const d = state.projectData;
    if (!d) return;
    
    const has = (v) => v && v.length > 0 ? escapeHtml(v) : `<span class="text-slate-400 italic">Not yet defined</span>`;
    const cl = d.checklist || {};

    const container = document.getElementById('full-project-container');
    if (!container) return;

    // Helper for sections
    const Section = (title, content) => `
        <div class="card-modern p-8 mb-8">
            <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2">${title}</h2>
            ${content}
        </div>`;

    // 1. Team & Stakeholders Content
    let teamHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">`;
    if(d.teamMembers && d.teamMembers.length > 0) {
        teamHtml += d.teamMembers.map(m => `
            <div class="p-4 border border-slate-200 rounded-lg flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">${escapeHtml(m.initials || '??')}</div>
                <div><div class="font-bold text-sm">${escapeHtml(m.name)}</div><div class="text-xs text-slate-500">${escapeHtml(m.role)}</div></div>
            </div>
        `).join('');
    } else { teamHtml += `<div class="col-span-full text-slate-400 italic">No team members.</div>`; }
    teamHtml += `</div>`;
    
    let stakeHtml = `<h3 class="font-bold text-slate-700 text-sm uppercase mb-3">Stakeholders</h3><div class="overflow-x-auto"><table class="w-full text-sm text-left">
        <thead class="bg-slate-50 text-slate-500 font-bold"><tr class="border-b"><th class="p-2">Name</th><th class="p-2">Power</th><th class="p-2">Interest</th></tr></thead><tbody>`;
    if(d.stakeholders && d.stakeholders.length > 0) {
        stakeHtml += d.stakeholders.map(s => `<tr class="border-b"><td class="p-2">${escapeHtml(s.name)}</td><td class="p-2">${s.y}</td><td class="p-2">${s.x}</td></tr>`).join('');
    } else { stakeHtml += `<tr><td colspan="3" class="p-2 text-slate-400 italic">No stakeholders.</td></tr>`; }
    stakeHtml += `</tbody></table></div>`;

    // 2. Charter Content
    const charterHtml = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Context</h3><p class="text-sm text-slate-600 bg-slate-50 p-3 rounded">${has(cl.context)}</p></div>
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Ethics</h3><p class="text-sm text-slate-600 bg-slate-50 p-3 rounded">${has(cl.ethics)}</p></div>
            </div>
            <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Problem Statement</h3><p class="text-slate-700 bg-slate-50 p-4 rounded border-l-4 border-rcem-purple">${has(cl.problem_desc)}</p></div>
            <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">SMART Aim</h3><p class="text-indigo-900 font-bold font-serif bg-indigo-50 p-4 rounded border border-indigo-100">${has(cl.aim)}</p></div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="p-3 border rounded"><h4 class="font-bold text-xs uppercase text-slate-500 mb-1">Outcome Measure</h4><p class="text-sm">${has(cl.measure_outcome)}</p></div>
                <div class="p-3 border rounded"><h4 class="font-bold text-xs uppercase text-slate-500 mb-1">Process Measure</h4><p class="text-sm">${has(cl.measure_process)}</p></div>
                <div class="p-3 border rounded"><h4 class="font-bold text-xs uppercase text-slate-500 mb-1">Balancing Measure</h4><p class="text-sm">${has(cl.measure_balance)}</p></div>
            </div>
        </div>
    `;

    // 3. Diagnosis
    const diagHtml = `
        <div class="space-y-8">
            <div>
                <h3 class="font-bold text-slate-700 mb-2">Process Map</h3>
                <div id="full-view-process-container" class="border border-slate-200 rounded min-h-[200px] flex justify-center p-4"></div>
            </div>
            <div>
                <h3 class="font-bold text-slate-700 mb-2">Driver Diagram</h3>
                <div id="full-view-driver-container" class="border border-slate-200 rounded min-h-[300px] flex justify-center p-4"></div>
            </div>
        </div>
    `;

    // 4. Timeline
    const timelineHtml = `<div id="full-view-gantt-container" class="overflow-x-auto min-h-[200px]"></div>`;

    // 5. Results
    const resultsHtml = `
        <div id="full-view-chart-container" class="mb-6 h-80 relative">
            <canvas id="full-view-chart-canvas"></canvas>
        </div>
        <div class="bg-emerald-50 p-4 rounded border border-emerald-100">
            <h3 class="font-bold text-emerald-900 text-sm uppercase mb-2">Interpretation</h3>
            <p class="text-emerald-800">${has(cl.results_text)}</p>
        </div>
    `;

    // 6. PDSA
    const pdsaHtml = `
        <div class="space-y-4">
            ${d.pdsa && d.pdsa.length > 0 ? d.pdsa.map((p, i) => `
                <div class="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <h4 class="font-bold text-slate-800 flex justify-between">
                        <span>Cycle ${i + 1}: ${escapeHtml(p.title || 'Untitled')}</span>
                        <span class="text-xs font-normal text-slate-500 font-mono">${p.start} - ${p.end}</span>
                    </h4>
                    <p class="text-sm text-slate-600 mt-1 mb-3 italic">${escapeHtml(p.desc)}</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div class="bg-white p-2 rounded border border-slate-100"><strong class="text-amber-600 block mb-1">Do</strong>${escapeHtml(p.do)}</div>
                        <div class="bg-white p-2 rounded border border-slate-100"><strong class="text-purple-600 block mb-1">Study</strong>${escapeHtml(p.study)}</div>
                        <div class="bg-white p-2 rounded border border-slate-100"><strong class="text-emerald-600 block mb-1">Act</strong>${escapeHtml(p.act)}</div>
                    </div>
                </div>
            `).join('') : '<p class="text-slate-400 italic">No cycles.</p>'}
        </div>
    `;

    // 7. Sustain
    const sustainHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Key Learning</h3><p class="text-sm text-slate-600 bg-amber-50 p-4 rounded border border-amber-100">${has(cl.learning)}</p></div>
            <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Sustainability Plan</h3><p class="text-sm text-slate-600 bg-emerald-50 p-4 rounded border border-emerald-100">${has(cl.sustain)}</p></div>
        </div>
    `;

    // 8. Logs
    let logHtml = `<div class="space-y-2">`;
    if(d.leadershipLogs && d.leadershipLogs.length > 0) {
        logHtml += d.leadershipLogs.map(l => `
            <div class="text-sm border-l-2 border-slate-300 pl-3 py-1">
                <span class="font-bold text-slate-700 mr-2">${l.date}:</span>
                <span class="text-slate-600">${escapeHtml(l.note)}</span>
            </div>
        `).join('');
    } else { logHtml += `<p class="text-slate-400 italic">No logs recorded.</p>`; }
    logHtml += `</div>`;

    // Assemble
    container.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-8 pb-20">
            <div class="card-modern p-8 text-center">
                <h1 class="text-3xl font-bold text-rcem-purple mb-2">${escapeHtml(d.meta?.title || 'Untitled Project')}</h1>
                <p class="text-slate-500">Project Lead: ${escapeHtml(d.teamMembers && d.teamMembers[0] ? d.teamMembers[0].name : 'Not specified')}</p>
                <div class="mt-4 flex justify-center gap-2">
                    <button onclick="window.print()" class="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded flex items-center gap-1"><i data-lucide="printer" class="w-3 h-3"></i> Print Report</button>
                </div>
            </div>

            ${Section('1. Team & Stakeholders', teamHtml + '<div class="mt-6">' + stakeHtml + '</div>')}
            ${Section('2. Project Charter', charterHtml)}
            ${Section('3. Diagnosis & Process', diagHtml)}
            ${Section('4. Project Timeline', timelineHtml)}
            ${Section('5. Results & Analysis', resultsHtml)}
            ${Section('6. PDSA Cycles', pdsaHtml)}
            ${Section('7. Learning & Sustainability', sustainHtml)}
            ${Section('8. Leadership Log', logHtml)}
        </div>
    `;
    
    setTimeout(() => {
        renderFullViewChart();
        renderTools('full-view-driver-container', 'driver');
        renderTools('full-view-process-container', 'process');
        renderGantt('full-view-gantt-container');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 150);
}

// ==========================================
// 7. GREEN VIEW
// ==========================================

function renderGreen() {
    const el = document.getElementById('view-green');
    if (!el) return;
    el.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            <div class="card-modern p-8">
                <div class="flex items-center gap-3 mb-6 border-b pb-4">
                    <div class="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><i data-lucide="leaf" class="w-6 h-6"></i></div>
                    <div><h3 class="font-bold text-xl text-slate-800">Sustainable Value</h3><p class="text-slate-500 text-sm">Triple Bottom Line Calculator.</p></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                        <h4 class="font-bold text-emerald-800 mb-2">Environmental</h4>
                        <input type="number" id="calc-paper" class="w-full p-2 border border-emerald-200 rounded text-sm bg-white" placeholder="Sheets saved">
                        <button onclick="window.calcGreen()" class="mt-4 w-full bg-emerald-600 text-white py-2 rounded font-bold text-xs hover:bg-emerald-700">Calculate CO₂</button>
                        <div id="res-green" class="mt-2 text-center text-xl font-bold text-emerald-900">-</div>
                    </div>
                    <div class="p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <h4 class="font-bold text-blue-800 mb-2">Financial</h4>
                        <input type="number" id="calc-hours" class="w-full p-2 border border-blue-200 rounded text-sm bg-white" placeholder="Hours saved">
                        <button onclick="window.calcTime()" class="mt-4 w-full bg-blue-600 text-white py-2 rounded font-bold text-xs hover:bg-blue-700">Calculate Savings</button>
                        <div id="res-time" class="mt-2 text-center text-xl font-bold text-blue-900">-</div>
                    </div>
                    <div class="p-6 bg-purple-50 rounded-xl border border-purple-100">
                        <h4 class="font-bold text-purple-800 mb-2">Social</h4>
                        <input type="number" id="calc-edu-ppl" class="w-full p-2 border border-purple-200 rounded text-sm bg-white" placeholder="Staff trained">
                        <button onclick="window.calcEdu()" class="mt-4 w-full bg-purple-600 text-white py-2 rounded font-bold text-xs hover:bg-purple-700">Log Impact</button>
                        <div id="res-edu" class="mt-2 text-center text-lg font-bold text-purple-900">-</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 8. PDSA VIEW (IMPROVED - STACKED & BIGGER)
// ==========================================

function renderPDSA() {
    const d = state.projectData;
    if (!d) return;
    
    const container = document.getElementById('pdsa-container');
    if (!container) return;
    
    // AI Button Logic
    const aiButton = (window.hasAI && window.hasAI()) 
        ? `<button onclick="window.aiGeneratePDSA()" id="btn-ai-pdsa" class="w-full mt-2 border border-purple-200 text-purple-700 bg-purple-50 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"><i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Draft Cycle</button>`
        : '';

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div class="lg:col-span-4 space-y-6">
                <div class="card-modern p-6 sticky top-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-lg text-slate-800">Plan New Cycle</h3>
                    </div>
                    <div class="space-y-3">
                        <div><label class="text-[10px] font-bold uppercase text-slate-500">Title</label><input id="pdsa-title" class="w-full p-2 border rounded text-sm focus:border-rcem-purple outline-none" placeholder="e.g. Test new checklist"></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="text-[10px] font-bold uppercase text-slate-500">Start</label><input type="date" id="pdsa-start" class="w-full p-2 border rounded text-sm focus:border-rcem-purple outline-none"></div>
                            <div><label class="text-[10px] font-bold uppercase text-slate-500">End</label><input type="date" id="pdsa-end" class="w-full p-2 border rounded text-sm focus:border-rcem-purple outline-none"></div>
                        </div>
                        <div><label class="text-[10px] font-bold uppercase text-slate-500">Initial Plan</label><textarea id="pdsa-plan" class="w-full p-2 border rounded text-sm focus:border-rcem-purple outline-none" rows="4" placeholder="What exactly will you do?"></textarea></div>
                        <button onclick="window.addPDSA()" class="w-full bg-slate-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-900 shadow-md transition-all">Add Cycle</button>
                        ${aiButton}
                    </div>
                </div>
            </div>

            <div class="lg:col-span-8 space-y-8">
                ${!d.pdsa || d.pdsa.length === 0 ? '<div class="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">No PDSA cycles started yet.</div>' : ''}
                ${d.pdsa ? d.pdsa.map((p, i) => `
                <div class="card-modern overflow-hidden group">
                    <div class="bg-white p-4 border-b border-slate-200 flex justify-between items-start sticky top-0 z-10 shadow-sm">
                        <div class="flex gap-4 items-center">
                            <div class="bg-rcem-purple text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm flex-shrink-0">${i + 1}</div>
                            <div>
                                <h4 class="font-bold text-slate-800 text-lg leading-tight">${escapeHtml(p.title || 'Untitled')}</h4>
                                <div class="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                                    <i data-lucide="calendar" class="w-3 h-3"></i> ${p.start || '...'} → ${p.end || '...'}
                                </div>
                            </div>
                        </div>
                        <button onclick="window.deletePDSA(${i})" class="text-slate-300 hover:text-red-500 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    
                    <div class="p-6 space-y-6">
                        <div class="space-y-2 pdsa-stack-item bg-pastel-blue p-4 rounded-xl border">
                            <div class="flex items-center gap-2 mb-1 text-blue-800">
                                <i data-lucide="map" class="w-4 h-4"></i>
                                <label class="text-sm font-bold uppercase tracking-wide">Plan</label>
                            </div>
                            <textarea onchange="window.updatePDSA(${i}, 'desc', this.value)" class="w-full p-3 bg-white/50 border border-blue-100 rounded text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none transition-all resize-none overflow-hidden" rows="6">${escapeHtml(p.desc || '')}</textarea>
                        </div>

                        <div class="space-y-2 pdsa-stack-item bg-pastel-orange p-4 rounded-xl border">
                            <div class="flex items-center gap-2 mb-1 text-orange-800">
                                <i data-lucide="play" class="w-4 h-4"></i>
                                <label class="text-sm font-bold uppercase tracking-wide">Do</label>
                            </div>
                            <textarea onchange="window.updatePDSA(${i}, 'do', this.value)" class="w-full p-3 bg-white/50 border border-orange-100 rounded text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none transition-all resize-none overflow-hidden" rows="6">${escapeHtml(p.do || '')}</textarea>
                        </div>

                        <div class="space-y-2 pdsa-stack-item bg-pastel-purple p-4 rounded-xl border">
                            <div class="flex items-center gap-2 mb-1 text-purple-800">
                                <i data-lucide="bar-chart-2" class="w-4 h-4"></i>
                                <label class="text-sm font-bold uppercase tracking-wide">Study</label>
                            </div>
                            <textarea onchange="window.updatePDSA(${i}, 'study', this.value)" class="w-full p-3 bg-white/50 border border-purple-100 rounded text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-300 outline-none transition-all resize-none overflow-hidden" rows="6">${escapeHtml(p.study || '')}</textarea>
                        </div>

                        <div class="space-y-2 pdsa-stack-item bg-pastel-green p-4 rounded-xl border">
                            <div class="flex items-center gap-2 mb-1 text-emerald-800">
                                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                                <label class="text-sm font-bold uppercase tracking-wide">Act</label>
                            </div>
                            <textarea onchange="window.updatePDSA(${i}, 'act', this.value)" class="w-full p-3 bg-white/50 border border-emerald-100 rounded text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 outline-none transition-all resize-none overflow-hidden" rows="6">${escapeHtml(p.act || '')}</textarea>
                        </div>
                    </div>
                </div>`).join('') : ''}
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 9. STAKEHOLDERS VIEW
// ==========================================

function renderStakeholders() {
    const el = document.getElementById('view-stakeholders');
    if (!el) return;
    
    const isList = el.getAttribute('data-view') === 'list';
    const canvas = document.getElementById('stakeholder-canvas');
    if (!canvas) return;
    
    let stakeControls = document.getElementById('stake-controls');
    if (!stakeControls) {
        const header = document.createElement('div');
        header.id = 'stake-controls';
        header.className = 'flex justify-between items-center p-4 bg-white border-b border-slate-200 rounded-t-xl';
        header.innerHTML = `
            <h3 class="font-bold text-slate-800">Stakeholder Matrix</h3>
            <div class="flex gap-2">
                <button onclick="window.addStakeholder()" class="bg-rcem-purple text-white px-3 py-1 rounded text-xs font-bold shadow">+ Add Stakeholder</button>
                <button onclick="window.toggleStakeView()" class="bg-slate-100 text-slate-600 px-3 py-1 rounded text-xs font-bold hover:bg-slate-200">${isList ? 'Matrix View' : 'List View'}</button>
            </div>
        `;
        el.insertBefore(header, el.firstChild);
    }

    if (isList) {
        canvas.innerHTML = `
            <div class="p-8 max-w-4xl mx-auto">
                <div class="card-modern overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 border-b border-slate-200"><tr class="text-xs font-bold text-slate-500 uppercase"><th class="p-4">Name</th><th class="p-4">Power (Y)</th><th class="p-4">Interest (X)</th><th class="p-4 text-right">Actions</th></tr></thead>
                        <tbody class="divide-y divide-slate-100">
                            ${state.projectData.stakeholders?.map((s, i) => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" value="${escapeHtml(s.name || '')}" onchange="window.updateStake(${i},'name',this.value)"></td>
                                    <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" type="number" min="0" max="100" value="${s.y || 50}" onchange="window.updateStake(${i},'y',parseInt(this.value))"></td>
                                    <td class="p-2"><input class="w-full p-2 border border-slate-200 rounded text-sm" type="number" min="0" max="100" value="${s.x || 50}" onchange="window.updateStake(${i},'x',parseInt(this.value))"></td>
                                    <td class="p-2 text-right"><button onclick="window.removeStake(${i})" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
                                </tr>
                            `).join('') || `<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">No stakeholders added yet.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        canvas.innerHTML = `
            <div class="absolute inset-0 bg-white" style="min-height: 500px; border-radius: 0.75rem;">
                <div class="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300"></div>
                <div class="absolute top-1/2 left-0 right-0 h-px bg-slate-300"></div>
                <div class="absolute top-4 left-4 text-xs font-bold text-slate-400 uppercase">Keep Satisfied</div>
                <div class="absolute top-4 right-4 text-xs font-bold text-slate-400 uppercase">Manage Closely</div>
                <div class="absolute bottom-4 left-4 text-xs font-bold text-slate-400 uppercase">Monitor</div>
                <div class="absolute bottom-4 right-4 text-xs font-bold text-slate-400 uppercase">Keep Informed</div>
            </div>
        `;
        
        state.projectData.stakeholders?.forEach((s, i) => {
            const bubble = document.createElement('div');
            bubble.className = 'absolute bg-white border-2 border-rcem-purple text-rcem-purple px-3 py-1 rounded-full shadow-lg cursor-grab z-10 text-sm font-bold flex items-center gap-2 group max-w-[150px]';
            const xPos = Math.max(5, Math.min(90, s.x || 50));
            const yPos = Math.max(5, Math.min(90, 100 - (s.y || 50)));
            bubble.style.left = `${xPos}%`; bubble.style.top = `${yPos}%`;
            bubble.style.transform = 'translate(-50%, -50%)';
            bubble.innerHTML = `<span class="truncate pointer-events-none">${escapeHtml(s.name || 'Unnamed')}</span><button onclick="event.stopPropagation(); window.removeStake(${i})" class="hidden group-hover:block text-red-500 hover:bg-red-50 rounded-full p-0.5"><i data-lucide="x" class="w-3 h-3"></i></button>`;
            if (!state.isReadOnly) {
                makeDraggable(bubble, canvas, false, null, null, (newX, newY) => {
                    state.projectData.stakeholders[i].x = Math.round(Math.max(0, Math.min(100, newX)));
                    state.projectData.stakeholders[i].y = Math.round(Math.max(0, Math.min(100, 100 - newY)));
                    window.saveData();
                });
            }
            canvas.appendChild(bubble);
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 10. GANTT VIEW (CONDENSED MODE)
// ==========================================

let ganttMode = 'compact'; // default to compact for better viewing

function renderGantt(targetId = 'gantt-container') {
    const d = state.projectData;
    if (!d) return;
    const container = document.getElementById(targetId);
    if (!container) return;

    // View Toggle Control (Only in main view)
    if (targetId === 'gantt-container' && !document.getElementById('gantt-view-toggle')) {
        const header = container.previousElementSibling; // The header div
        if(header && !header.querySelector('#gantt-view-toggle')) {
            const toggleDiv = document.createElement('div');
            toggleDiv.id = 'gantt-view-toggle';
            toggleDiv.className = 'flex bg-slate-100 p-1 rounded-lg ml-4';
            toggleDiv.innerHTML = `
                <button onclick="ganttMode='standard'; window.renderGantt()" class="${ganttMode === 'standard' ? 'bg-white shadow text-slate-800' : 'text-slate-500'} px-3 py-1 text-xs font-bold rounded transition-all">Daily</button>
                <button onclick="ganttMode='compact'; window.renderGantt()" class="${ganttMode === 'compact' ? 'bg-white shadow text-slate-800' : 'text-slate-500'} px-3 py-1 text-xs font-bold rounded transition-all">Weekly (Compact)</button>
            `;
            header.querySelector('div').appendChild(toggleDiv);
        }
    }

    if (!d.gantt || d.gantt.length === 0) {
        container.innerHTML = `<div class="text-center p-12 text-slate-400 italic"><i data-lucide="calendar-clock" class="w-12 h-12 mx-auto mb-4 opacity-30"></i><p>No tasks yet. Click "Add Task" to start.</p></div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const dates = d.gantt.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) {
        container.innerHTML = `<div class="text-center p-12 text-slate-400 italic">Invalid dates in tasks.</div>`;
        return;
    }
    
    // CONDENSED VIEW LOGIC
    const isCompact = ganttMode === 'compact';
    const pxPerDay = isCompact ? 5 : 30; // Significantly reduced for compact mode
    const rowHeight = isCompact ? 35 : 50;
    
    // Set container class for styling overrides
    container.className = isCompact ? 'min-w-[800px] p-6 min-h-[300px] relative gantt-compact' : 'min-w-[800px] p-6 min-h-[300px] relative';

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 30);
    
    const headerHeight = 40;
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const totalWidth = Math.max(800, totalDays * pxPerDay);
    
    // Draw SVG Dependencies
    let svgLines = '';
    const sortedTasks = [...d.gantt].sort((a, b) => new Date(a.start) - new Date(b.start));
    const taskPositions = {};
    sortedTasks.forEach((t, idx) => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        if(!isNaN(start) && !isNaN(end)) {
            const offsetDays = Math.floor((start - minDate) / (1000 * 60 * 60 * 24));
            const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
            taskPositions[t.id] = {
                x: offsetDays * pxPerDay,
                width: duration * pxPerDay,
                y: idx * rowHeight + (rowHeight / 2) + headerHeight,
                rightX: (offsetDays * pxPerDay) + (duration * pxPerDay)
            };
        }
    });

    sortedTasks.forEach(t => {
        if(t.dependency && taskPositions[t.dependency] && taskPositions[t.id]) {
            const from = taskPositions[t.dependency];
            const to = taskPositions[t.id];
            const p1 = { x: from.rightX, y: from.y };
            const p2 = { x: to.x, y: to.y };
            const midX = p1.x + (isCompact ? 5 : 15);
            svgLines += `<path d="M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}" fill="none" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrowhead)" />`;
        }
    });

    let headerHTML = `<div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20 h-[${headerHeight}px]">`;
    let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (current <= maxDate) {
        const monthStr = current.toLocaleString('default', { month: 'short', year: '2-digit' });
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        const visibleStart = new Date(Math.max(current.getTime(), minDate.getTime()));
        const visibleEnd = new Date(Math.min(monthEnd.getTime(), maxDate.getTime()));
        const visibleDays = Math.ceil((visibleEnd - visibleStart) / (1000 * 60 * 60 * 24)) + 1;
        const width = visibleDays * pxPerDay;
        // In compact mode, we center the label more aggressively
        headerHTML += `<div class="border-r border-slate-200 text-xs font-bold text-slate-500 uppercase p-2 flex-shrink-0 text-center flex items-center justify-center overflow-hidden" style="width: ${width}px">${monthStr}</div>`;
        current.setMonth(current.getMonth() + 1);
    }
    headerHTML += '</div>';

    let rowsHTML = `<div class="relative" style="min-height: ${d.gantt.length * rowHeight + 50}px;">`;
    // SVG Layer
    rowsHTML += `<svg class="absolute inset-0 w-full h-full pointer-events-none z-0"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" /></marker></defs>${svgLines}</svg>`;
    
    // Today Line
    const today = new Date();
    if(today >= minDate && today <= maxDate) {
        const todayOffset = Math.floor((today - minDate) / (1000 * 60 * 60 * 24)) * pxPerDay;
        rowsHTML += `<div class="absolute top-0 bottom-0 border-l-2 border-red-400 border-dashed z-10" style="left: ${todayOffset}px;"><div class="bg-red-400 text-white text-[9px] px-1 font-bold absolute -top-4 -left-3 rounded">TODAY</div></div>`;
    }

    sortedTasks.forEach((t, idx) => {
        const start = new Date(t.start);
        const end = new Date(t.end);
        const offsetDays = Math.floor((start - minDate) / (1000 * 60 * 60 * 24));
        const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const width = duration * pxPerDay;
        const typeColors = { plan: 'from-blue-500 to-blue-600', do: 'from-amber-500 to-amber-600', study: 'from-purple-500 to-purple-600', act: 'from-emerald-500 to-emerald-600' };
        const bg = typeColors[t.type] || 'from-slate-500 to-slate-600';
        
        // Compact mode: Smaller bars, text might need to float outside if too small
        const barHeight = isCompact ? 'h-5 text-[10px]' : 'h-8 text-xs';
        
        rowsHTML += `
            <div class="absolute h-[${rowHeight}px] flex items-center w-full hover:bg-slate-50 transition-colors border-b border-slate-100 gantt-task-row" style="top: ${idx * rowHeight}px;">
                <div class="absolute ${barHeight} rounded-lg shadow-sm text-white font-bold flex items-center px-3 cursor-pointer bg-gradient-to-r ${bg} z-10 hover:shadow-md hover:scale-[1.01] transition-all group gantt-bar" 
                     style="left: ${offsetDays * pxPerDay}px; width: ${Math.max(isCompact ? 20 : 40, width)}px;"
                     onclick="if(confirm('Delete task: ${escapeHtml(t.name)}?')) window.deleteGantt('${t.id}')">
                    <span class="truncate drop-shadow-md">${escapeHtml(t.name)}</span>
                    <div class="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-30 whitespace-nowrap shadow-xl">
                        <div class="font-bold">${escapeHtml(t.name)}</div>
                        <div class="text-slate-300 font-mono text-[10px]">${t.start} - ${t.end}</div>
                    </div>
                </div>
            </div>
        `;
    });
    rowsHTML += '</div>';

    container.style.minWidth = `${totalWidth}px`;
    container.innerHTML = headerHTML + rowsHTML;
}

// ==========================================
// 11. TEAM VIEW (EXPANDED GUIDANCE)
// ==========================================

function renderTeam() {
    const d = state.projectData;
    if (!d) return;
    const list = document.getElementById('team-list');
    if (!list) return;
    
    list.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2"><i data-lucide="users-2" class="text-rcem-purple"></i> Team Members</h2>
            <div class="flex gap-2">
                 <button onclick="document.getElementById('stakeholder-guide').classList.toggle('hidden')" class="bg-indigo-50 text-indigo-700 px-4 py-2 rounded shadow hover:bg-indigo-100 flex items-center gap-2 border border-indigo-200"><i data-lucide="lightbulb" class="w-4 h-4"></i> Who to include?</button>
                 <button onclick="window.openMemberModal()" class="bg-rcem-purple text-white px-4 py-2 rounded shadow hover:bg-indigo-900 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Add Member</button>
            </div>
        </div>

        <div id="stakeholder-guide" class="hidden mb-8 card-modern p-6 border-l-4 border-l-rcem-purple">
            <h3 class="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-lg"><i data-lucide="info" class="w-5 h-5"></i> NHS Team Composition Guide</h3>
            <p class="text-sm text-slate-600 mb-4">Successful QIPs require a multidisciplinary team. Consider engaging these key roles in your ED:</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-700">
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <strong class="text-rcem-purple block mb-1 text-sm">Nursing Leadership</strong>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><strong>Matron / Band 8:</strong> Essential for departmental policy changes.</li>
                        <li><strong>Senior Sister / Band 7:</strong> Critical for shop-floor enforcement and culture change.</li>
                    </ul>
                </div>
                
                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <strong class="text-rcem-purple block mb-1 text-sm">Medical Team</strong>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><strong>Consultant Sponsor:</strong> Mandatory for governance and high-level blockage removal.</li>
                        <li><strong>Junior Docs (Rotational):</strong> Excellent for data collection but high turnover risks continuity.</li>
                    </ul>
                </div>

                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <strong class="text-rcem-purple block mb-1 text-sm">Operational & Support</strong>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><strong>Service Manager:</strong> Key if your project needs funding or business cases.</li>
                        <li><strong>Porters:</strong> Vital for flow, radiology, and transfer projects.</li>
                        <li><strong>Reception:</strong> First point of contact for patient stream projects.</li>
                    </ul>
                </div>

                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <strong class="text-rcem-purple block mb-1 text-sm">Clinical Support</strong>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><strong>Pharmacy:</strong> For antimicrobial stewardship or drug chart safety.</li>
                        <li><strong>Microbiology:</strong> For sepsis or infection control protocols.</li>
                    </ul>
                </div>

                <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <strong class="text-rcem-purple block mb-1 text-sm">Governance</strong>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><strong>Audit Lead:</strong> Ensures registration and compliance.</li>
                        <li><strong>Patient Voice:</strong> PALS or patient representative for service design.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            ${!d.teamMembers || d.teamMembers.length === 0 ? `<div class="col-span-full text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">No team members added yet.</div>` : d.teamMembers.map((m, i) => `
                <div class="p-4 card-modern relative group hover:shadow-md">
                    <button onclick="window.deleteMember(${i})" class="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold shadow-md flex-shrink-0">${escapeHtml(m.initials || 'NA')}</div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-slate-800 truncate">${escapeHtml(m.name || 'Unnamed')}</div>
                            <div class="text-xs font-bold text-rcem-purple uppercase tracking-wide mb-1">${escapeHtml(m.role || 'No role')}</div>
                            ${m.grade ? `<div class="text-xs text-slate-500">${escapeHtml(m.grade)}</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Logs
    const logList = document.getElementById('leadership-log-list');
    if (logList) {
        logList.innerHTML = `
            <div class="mt-8 card-modern p-6">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="text-lg font-bold text-slate-800">Leadership Log</h3>
                    <button onclick="window.addLeadershipLog()" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded border border-slate-300">+ Add Log Entry</button>
                </div>
                ${!d.leadershipLogs?.length ? `<div class="text-slate-400 text-sm italic py-4">Record meetings and leadership activities here.</div>` : `
                    <div class="space-y-3">
                        ${d.leadershipLogs.map((log, i) => `
                            <div class="bg-slate-50 p-3 rounded border border-slate-200 text-sm relative group">
                                <button onclick="window.deleteLeadershipLog(${i})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                                <div class="font-bold text-slate-700 text-xs mb-1">${escapeHtml(log.date || 'No date')}</div>
                                <div class="text-slate-800">${escapeHtml(log.note || '')}</div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 12. HELPER FUNCTIONS
// ==========================================

function calcGreen() { 
    const paper = parseFloat(document.getElementById('calc-paper').value) || 0;
    const co2 = (paper * 0.005).toFixed(2);
    document.getElementById('res-green').innerText = `${co2} kg CO₂ saved`;
    showToast("Environmental impact calculated", "success");
}

function calcMoney() {
    // Placeholder for additional financial calculation
}

function calcTime() { 
    const hours = parseFloat(document.getElementById('calc-hours').value) || 0;
    const savings = (hours * 30).toFixed(2);
    document.getElementById('res-time').innerText = `£${savings} / month`;
    showToast("Financial impact calculated", "success");
}

function calcEdu() { 
    const ppl = document.getElementById('calc-edu-ppl').value;
    if(ppl) { 
        document.getElementById('res-edu').innerText = `${ppl} staff upskilled!`;
        showToast("Social impact logged", "success");
    }
}

function openMemberModal() { 
    document.getElementById('member-modal').classList.remove('hidden'); 
}

function openGanttModal() { 
    // Populate dependency dropdown
    const depSelect = document.getElementById('task-dep');
    if (depSelect && state.projectData.gantt) {
        depSelect.innerHTML = '<option value="">None</option>';
        state.projectData.gantt.forEach(t => {
            depSelect.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
        });
    }
    document.getElementById('task-modal').classList.remove('hidden'); 
}

function toggleToolList() { 
    renderTools(); 
}

function updateFishCat(i, v) { 
    state.projectData.fishbone.categories[i].text = v; 
    window.saveData(); 
}

function updateFishCause(i, j, v) { 
    state.projectData.fishbone.categories[i].causes[j].text = v; 
    window.saveData(); 
}

function addFishCause(i) { 
    state.projectData.fishbone.categories[i].causes.push({text: "New Cause", x: 50, y: 50}); 
    window.saveData(); 
    renderTools(); 
}

function removeFishCause(i, j) { 
    state.projectData.fishbone.categories[i].causes.splice(j, 1); 
    window.saveData(); 
    renderTools(); 
}

function addLeadershipLog() { 
    const n = prompt("Log Entry:"); 
    if(n) { 
        if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = []; 
        state.projectData.leadershipLogs.push({date: new Date().toLocaleDateString(), note: n}); 
        window.saveData(); 
        renderTeam(); 
        showToast("Log added", "success"); 
    } 
}

function deleteLeadershipLog(i) { 
    if(confirm("Delete this log entry?")) { 
        state.projectData.leadershipLogs.splice(i, 1); 
        window.saveData(); 
        renderTeam(); 
    } 
}

function addStakeholder() { 
    const n = prompt("Stakeholder Name:"); 
    if(n) { 
        if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
        state.projectData.stakeholders.push({name: n, x: 50, y: 50}); 
        window.saveData(); 
        renderStakeholders(); 
        showToast("Stakeholder added", "success");
    } 
}

function updateStake(i, k, v) { 
    state.projectData.stakeholders[i][k] = v; 
    window.saveData(); 
}

function removeStake(i) { 
    if(confirm("Remove this stakeholder?")) { 
        state.projectData.stakeholders.splice(i, 1); 
        window.saveData(); 
        renderStakeholders(); 
    } 
}

function toggleStakeView() { 
    const e = document.getElementById('view-stakeholders'); 
    e.setAttribute('data-view', e.getAttribute('data-view') === 'list' ? 'visual' : 'list'); 
    // Remove and recreate controls to update button text
    const controls = document.getElementById('stake-controls');
    if (controls) controls.remove();
    renderStakeholders(); 
}

function addPDSA() { 
    const t = document.getElementById('pdsa-title').value; 
    const s = document.getElementById('pdsa-start').value; 
    const e = document.getElementById('pdsa-end').value; 
    const p = document.getElementById('pdsa-plan').value; 
    
    if(t) { 
        if(!state.projectData.pdsa) state.projectData.pdsa = [];
        state.projectData.pdsa.push({title: t, start: s, end: e, desc: p, do: '', study: '', act: ''}); 
        window.saveData(); 
        renderPDSA(); 
        showToast("PDSA Cycle added", "success"); 
    } else { 
        showToast("Title is required", "error"); 
    } 
}

function updatePDSA(i, f, v) { 
    state.projectData.pdsa[i][f] = v; 
    window.saveData(); 
}

function deletePDSA(i) { 
    if(confirm("Delete this PDSA cycle?")) { 
        state.projectData.pdsa.splice(i, 1); 
        window.saveData(); 
        renderPDSA(); 
    } 
}

function saveSmartAim() { 
    showToast("Aim saved", "info"); 
}

function openPortfolioExport() { 
    showToast("Portfolio export coming soon", "info"); 
}

function copyReport() { 
    navigator.clipboard.writeText("Report copied"); 
    showToast("Copied to clipboard", "success"); 
}

function showHelp() { 
    alert("Use the tabs to navigate your QIP journey. Start with Define & Measure, then build your Driver Diagram, add data, and document PDSA cycles."); 
}

function startTour() {
    if (typeof driver === 'undefined' || !driver.js) {
        showToast("Tour feature loading...", "info");
        return;
    }
    
    try {
        const driverObj = driver.js.driver({
            showProgress: true,
            animate: true,
            steps: [
                { element: '#nav-dashboard', popover: { title: 'Dashboard', description: 'Overview of your project progress and key metrics.' }},
                { element: '#nav-checklist', popover: { title: 'Define & Measure', description: 'Start here! Define your problem and SMART aim.' }},
                { element: '#nav-tools', popover: { title: 'Diagnosis Tools', description: 'Build Fishbone and Driver diagrams to understand root causes.' }},
                { element: '#nav-data', popover: { title: 'Data & SPC', description: 'Track your measurements over time with run and SPC charts.' }},
                { element: '#nav-pdsa', popover: { title: 'PDSA Cycles', description: 'Plan-Do-Study-Act cycles to test changes.' }},
                { element: '#nav-publish', popover: { title: 'Publish', description: 'Generate reports and export your project.' }}
            ]
        });
        driverObj.drive();
    } catch (e) {
        console.error(e);
        showToast("Tour error", "error");
    }
}

// Re-export all necessary functions
export { 
    renderAll, renderDashboard, renderChecklist, renderDataView, 
    renderFullProject, renderGantt, renderGreen, renderPDSA, 
    renderPublish, renderStakeholders, renderTeam, toggleToolList, 
    openMemberModal, openGanttModal, openPortfolioExport, 
    copyReport, updateFishCat, updateFishCause, addFishCause, 
    removeFishCause, addLeadershipLog, deleteLeadershipLog, 
    addStakeholder, updateStake, removeStake, toggleStakeView, 
    addPDSA, updatePDSA, deletePDSA, saveSmartAim, showHelp, startTour,
    calcGreen, calcMoney, calcTime, calcEdu
};
