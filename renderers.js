import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, setToolMode, renderFullViewChart } from "./charts.js";

// ==========================================
// 1. MAIN ROUTER & NAVIGATION
// ==========================================

function renderAll(view) {
    // 1. Update UI Active States
    updateNavigationUI(view);
    
    // 2. Route to specific renderer
    if (view === 'dashboard') renderDashboard();
    else if (view === 'checklist') renderChecklist(); // The Wizard
    else if (view === 'team') renderTeam();
    else if (view === 'tools') renderTools();         // Imports from charts.js
    else if (view === 'data') renderDataView();
    else if (view === 'pdsa') renderPDSA();
    else if (view === 'stakeholders') renderStakeholders();
    else if (view === 'gantt') renderGantt();
    else if (view === 'green') renderGreen();         // Sustainability
    else if (view === 'full') renderFullProject();    // The Charter View
    else if (view === 'publish') renderPublish();     // The QIAT Writer

    // 3. Re-initialize icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateNavigationUI(currentView) {
    const navItems = ['checklist', 'team', 'tools', 'pdsa', 'data', 'publish'];
    navItems.forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if(!btn) return;
        
        // Active State Styling
        // (Managed via CSS usually, but we ensure logic here if needed)
        
        // Status Badges (Progress Tracking)
        let status = '';
        const d = state.projectData;
        if (!d) return;
        
        if(id === 'checklist' && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist.ethics) status = '✓';
        
        // Prevent duplicate badges
        const hasBadge = btn.querySelector('.status-badge');
        if(status && !hasBadge) {
             btn.innerHTML += ` <span class="status-badge ml-auto text-emerald-400 font-bold text-[10px]">${status}</span>`;
        }
    });
}

// ==========================================
// 2. DASHBOARD (HOME)
// ==========================================

function renderDashboard() {
    const d = state.projectData;
    
    // Statistics
    const values = d.chartData.map(x => Number(x.value)).filter(n => !isNaN(n));
    const avg = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    
    // Progress Bar Calculation
    const calcProgress = (c, t) => Math.min(100, Math.round((c / t) * 100));
    // Weighted progress: Data (33%) + PDSA (33%) + Drivers (33%)
    const totalProg = Math.round((calcProgress(d.chartData.length, 12) + calcProgress(d.pdsa.length, 3) + calcProgress(d.drivers.primary.length, 3)) / 3);

    document.getElementById('stat-progress').innerHTML = `
        <div class="flex justify-between items-end mb-1">
            <span class="text-3xl font-bold text-slate-800">${totalProg}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill bg-emerald-500" style="width: ${totalProg}%"></div></div>
        <div class="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Project Completion</div>
    `;
    
    // "QI Coach" Logic
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Measuring Phase", m: "Collect at least 6 data points to establish a baseline.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    
    if (d.checklist.aim === "") msg = { t: "Define Your Aim", m: "Start by using the Wizard to define a SMART aim.", i: "target", c: "rose-500", b: "Go to Wizard", a: "checklist" };
    else if (d.chartData.length >= 6 && d.pdsa.length === 0) msg = { t: "Time for Action", m: "Baseline established. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
    else if (d.pdsa.length > 0) msg = { t: "Project Active", m: "Keep tracking data to detect improvement shifts.", i: "activity", c: "blue-500", b: "Add Point", a: "data" };
    
    coachEl.innerHTML = `
        <div class="bg-white border-l-4 border-${msg.c} p-6 mb-8 rounded-r-xl shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden">
            <div class="bg-slate-50 p-4 rounded-full shadow-inner text-${msg.c}"><i data-lucide="${msg.i}" class="w-8 h-8"></i></div>
            <div class="flex-1">
                <h4 class="font-bold text-slate-800 text-lg">QI COACH: ${msg.t}</h4>
                <p class="text-slate-600 mt-1">${msg.m}</p>
            </div>
            <button onclick="window.router('${msg.a}')" class="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors shadow-lg">${msg.b}</button>
        </div>
    `;

    // Mini Stats Bar
    const statsContainer = document.getElementById('stat-pdsa').parentElement.parentElement;
    statsContainer.innerHTML = `
        <div class="col-span-2 sm:col-span-4 bg-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-wrap gap-8 items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-white/10 rounded-lg"><i data-lucide="clock" class="w-6 h-6 text-amber-400"></i></div>
                <div><div class="text-xs text-slate-400 font-bold uppercase tracking-wider">Average</div><div class="text-2xl font-bold font-mono">${avg}</div></div>
            </div>
            <div class="h-10 w-px bg-white/10 hidden sm:block"></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Fastest</div><div class="text-xl font-bold text-emerald-400 font-mono">${min}</div></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Slowest</div><div class="text-xl font-bold text-red-400 font-mono">${max}</div></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Points</div><div class="text-xl font-bold">${values.length}</div></div>
        </div>
    `;

    // Aim Display
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

    // --- Wizard Logic Helpers ---
    // These compile the specific inputs into the big text blocks required for the exam
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
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Context (Why is this important?)</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="e.g. Sepsis is a leading cause of avoidable death..." value="${escapeHtml(cl.problem_context || '')}" onchange="window.saveChecklist('problem_context', this.value); window.renderChecklist()">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Evidence (How do you know?)</label>
                            <input class="w-full p-2 border rounded text-sm" placeholder="e.g. Audit showed 45% compliance..." value="${escapeHtml(cl.problem_evidence || '')}" onchange="window.saveChecklist('problem_evidence', this.value); window.renderChecklist()">
                        </div>
                        <div class="bg-slate-50 p-3 rounded border border-slate-200 mt-2">
                            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Generated Problem Statement</label>
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
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Measure (What are you improving?)</label>
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
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">By When? (Date)</label>
                            <input type="text" class="w-full p-2 border rounded text-sm" placeholder="e.g. August 2026" value="${escapeHtml(cl.aim_date || '')}" onchange="window.saveChecklist('aim_date', this.value); window.renderChecklist()">
                        </div>
                    </div>
                    <div class="bg-indigo-50 p-3 rounded border border-indigo-100">
                        <label class="block text-xs font-bold text-indigo-400 uppercase mb-1">Generated Aim Statement</label>
                        <p class="text-sm text-indigo-900 font-bold font-serif">${escapeHtml(buildAim())}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                <div class="bg-amber-50 p-5 rounded-xl border border-amber-100 text-amber-900 text-sm">
                    <h4 class="font-bold flex items-center gap-2 mb-2"><i data-lucide="lightbulb" class="w-4 h-4"></i> QI Coach Tip</h4>
                    <p class="mb-2"><strong>Don't just say "Improve Care".</strong></p>
                    <p>RCEM requires a SMART aim. Use the wizard to ensure you have a clear numeric target and a deadline.</p>
                </div>

                <div class="bg-white p-5 rounded-xl border border-slate-200">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Methodology</label>
                    <select onchange="window.saveChecklist('methodology', this.value)" class="w-full p-2 border rounded text-sm bg-white mb-4">
                        <option>Model for Improvement (PDSA)</option>
                        <option>Lean / Six Sigma</option>
                        <option>Clinical Audit (Cycle)</option>
                    </select>
                    
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Ethics / Approval</label>
                    <textarea onchange="window.saveChecklist('ethics', this.value)" class="w-full p-2 border rounded text-sm h-24">${escapeHtml(cl.ethics)}</textarea>
                </div>
                
                <div class="bg-white p-5 rounded-xl border border-slate-200">
                     <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Measures Definitions</label>
                     <input placeholder="Outcome Measure" class="w-full p-2 border rounded text-sm mb-2" value="${escapeHtml(cl.measure_outcome || '')}" onchange="window.saveChecklist('measure_outcome', this.value)">
                     <input placeholder="Process Measure" class="w-full p-2 border rounded text-sm mb-2" value="${escapeHtml(cl.measure_process || '')}" onchange="window.saveChecklist('measure_process', this.value)">
                     <input placeholder="Balancing Measure" class="w-full p-2 border rounded text-sm" value="${escapeHtml(cl.measure_balance || '')}" onchange="window.saveChecklist('measure_balance', this.value)">
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. THE QIAT WRITER (Publish)
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

    // Helper for Copy Buttons
    const copyBtn = (id) => `
        <button onclick="navigator.clipboard.writeText(document.getElementById('${id}').innerText); showToast('Copied!', 'success')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-300 flex items-center gap-1 transition-colors">
            <i data-lucide="copy" class="w-3 h-3"></i> Copy
        </button>`;

    if (mode === 'abstract') {
        const s1 = `${d.checklist.problem_desc} ${d.checklist.aim}`.trim(); 
        const s2 = `Drivers: ${(d.drivers.changes || []).join(', ')}.`.trim(); 
        const s3 = `${d.checklist.results_text}`.trim();
        content.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 class="font-bold text-slate-800 mb-4 border-b pb-2">RCEM Conference Abstract</h3>
                    <textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32 mb-4">${s1}</textarea>
                    <textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32 mb-4">${s2}</textarea>
                    <textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32">${s3}</textarea>
                </div>
            </div>`;
    } else if (mode === 'qiat') {
        // Prepare Data Strings
        const s1_1 = `${d.checklist.problem_desc || d.checklist.problem_context}\n\nContext:\n${d.checklist.context || ''}`.trim();
        const s1_2 = `Methodology: ${d.checklist.methodology}\n\nWe used a Driver Diagram. \nPrimary Drivers: ${(d.drivers.primary || []).join(', ')}. \nSecondary Drivers: ${(d.drivers.secondary || []).join(', ')}.`;
        const s1_3 = d.checklist.aim;
        const s1_4 = `Outcome: ${d.checklist.measure_outcome}\nProcess: ${d.checklist.measure_process}\nBalance: ${d.checklist.measure_balance}\n\nAnalysis: ${d.checklist.results_text}`;
        const s1_5 = d.pdsa.map((p, i) => `Cycle ${i+1}: ${p.title}\nPlan: ${p.desc}\nDo: ${p.do}\nStudy: ${p.study}\nAct: ${p.act}`).join('\n\n----------------\n\n');
        const s_reflect = `Learning:\n${d.checklist.learning}\n\nSustainability:\n${d.checklist.sustain}`;

        content.innerHTML = `
            <div class="max-w-5xl mx-auto">
                <div class="bg-indigo-900 text-white p-6 rounded-t-xl flex justify-between items-center">
                    <div><h2 class="text-xl font-bold">RCEM QIAT Report Generator</h2><p class="text-indigo-200 text-sm">Copy these sections directly into your Risr/Portfolio form.</p></div>
                    <div class="bg-indigo-800 px-4 py-2 rounded text-xs font-mono">Target: FRCEM QIP</div>
                </div>
                <div class="bg-white border-x border-b border-slate-200 p-8 rounded-b-xl space-y-8">
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.1 Analysis of Problem</label>${copyBtn('qiat-1-1')}</div><div id="qiat-1-1" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s1_1)}</div></div>
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.2 Use of QI Methods</label>${copyBtn('qiat-1-2')}</div><div id="qiat-1-2" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s1_2)}</div></div>
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.3 Aim Statement</label>${copyBtn('qiat-1-3')}</div><div id="qiat-1-3" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s1_3)}</div></div>
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.4 Measurement</label>${copyBtn('qiat-1-4')}</div><div id="qiat-1-4" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s1_4)}</div></div>
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">1.5 Evaluation (PDSA)</label>${copyBtn('qiat-1-5')}</div><div id="qiat-1-5" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s1_5)}</div></div>
                    <div class="qiat-section"><div class="flex justify-between items-end mb-2"><label class="text-sm font-bold text-slate-800 uppercase tracking-wide">Reflection</label>${copyBtn('qiat-reflect')}</div><div id="qiat-reflect" class="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 font-mono whitespace-pre-wrap">${escapeHtml(s_reflect)}</div></div>
                </div>
            </div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 5. THE PROJECT CHARTER (Full View)
// ==========================================

function renderFullProject() {
    // This is the beautiful "Read Only" dashboard view
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
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Problem Description</h3><p class="text-slate-600 bg-slate-50 p-4 rounded">${has(d.checklist.problem_desc)}</p></div>
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">SMART Aim</h3><p class="text-indigo-900 font-bold font-serif bg-indigo-50 p-4 rounded border border-indigo-100">${has(d.checklist.aim)}</p></div>
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Evidence & Literature</h3><p class="text-slate-600 bg-slate-50 p-4 rounded">${has(d.checklist.lit_review)}</p></div>
                    <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Context</h3><p class="text-slate-600 bg-slate-50 p-4 rounded">${has(d.checklist.context)}</p></div>
                </div>
            </div>

            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="git-branch" class="w-5 h-5"></i> 2. Diagnosis</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-purple-50 rounded border border-purple-100"><h4 class="font-bold text-purple-900 mb-2">Primary Drivers</h4><ul class="list-disc pl-4 text-sm">${d.drivers.primary.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
                    <div class="p-4 bg-purple-50 rounded border border-purple-100"><h4 class="font-bold text-purple-900 mb-2">Secondary Drivers</h4><ul class="list-disc pl-4 text-sm">${d.drivers.secondary.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
                    <div class="p-4 bg-purple-50 rounded border border-purple-100"><h4 class="font-bold text-purple-900 mb-2">Change Ideas</h4><ul class="list-disc pl-4 text-sm">${d.drivers.changes.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
                </div>
            </div>

            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                 <h2 class="text-xl font-bold text-slate-800 mb-6 border-b pb-2 flex items-center gap-2"><i data-lucide="bar-chart-2" class="w-5 h-5"></i> 3. Measurement</h2>
                 <div id="full-view-chart-container" class="mb-6 h-64"></div>
                 <div class="bg-emerald-50 p-4 rounded border border-emerald-100">
                    <h3 class="font-bold text-emerald-900 text-sm uppercase mb-2">Results Analysis</h3>
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
    
    // Render the chart in this view
    renderFullViewChart();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 6. VALUE & SUSTAINABILITY (Green)
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
                        <p class="text-slate-500 text-sm">Demonstrate the "Triple Bottom Line" (Financial, Environmental, Social) for your FRCEM project.</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                        <h4 class="font-bold text-emerald-800 mb-2 flex items-center gap-2"><i data-lucide="tree-pine" class="w-4 h-4"></i> Environmental</h4>
                        <p class="text-xs text-emerald-600 mb-4">Did you reduce paper, travel, or waste?</p>
                        <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-emerald-700">Items Saved (Monthly)</label>
                            <input type="number" id="calc-paper" class="w-full p-2 border border-emerald-200 rounded text-sm bg-white" placeholder="e.g. 500 sheets">
                        </div>
                        <div class="mt-4 pt-4 border-t border-emerald-200">
                            <button onclick="window.calcGreen()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-bold text-xs transition-colors">Calculate CO2</button>
                            <div id="res-green" class="mt-2 text-center text-xl font-bold text-emerald-900">-</div>
                        </div>
                    </div>

                    <div class="p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <h4 class="font-bold text-blue-800 mb-2 flex items-center gap-2"><i data-lucide="pound-sterling" class="w-4 h-4"></i> Financial</h4>
                        <p class="text-xs text-blue-600 mb-4">Did you save staff time or equipment costs?</p>
                        <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-blue-700">Hours Saved (Monthly)</label>
                            <input type="number" id="calc-hours" class="w-full p-2 border border-blue-200 rounded text-sm bg-white" placeholder="e.g. 10 hours">
                        </div>
                        <div class="mt-4 pt-4 border-t border-blue-200">
                            <button onclick="window.calcTime()" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-xs transition-colors">Calculate Savings</button>
                            <div id="res-time" class="mt-2 text-center text-xl font-bold text-blue-900">-</div>
                        </div>
                    </div>
                    
                    <div class="p-6 bg-purple-50 rounded-xl border border-purple-100">
                        <h4 class="font-bold text-purple-800 mb-2 flex items-center gap-2"><i data-lucide="graduation-cap" class="w-4 h-4"></i> Social & Staff</h4>
                        <p class="text-xs text-purple-600 mb-4">Did you upskill staff or improve morale?</p>
                        <div class="space-y-2">
                            <label class="text-xs font-bold uppercase text-purple-700">Staff Trained</label>
                            <input type="number" id="calc-edu-ppl" class="w-full p-2 border border-purple-200 rounded text-sm bg-white" placeholder="e.g. 15 nurses">
                        </div>
                        <div class="mt-4 pt-4 border-t border-purple-200">
                            <button onclick="window.calcEdu()" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-bold text-xs transition-colors">Log Impact</button>
                            <div id="res-edu" class="mt-2 text-center text-lg font-bold text-purple-900">-</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 7. STANDARD MODULES (Team, Data, PDSA, Stakeholders, Gantt)
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
                    ${m.responsibilities ? `<div class="text-xs text-slate-500 italic mt-1">"${escapeHtml(m.responsibilities)}"</div>` : ''}
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
                    <h3 class="text-lg font-bold text-slate-800">Leadership & Engagement Log</h3>
                    <button onclick="window.addLeadershipLog()" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded border border-slate-300 transition-colors">+ Add Log</button>
                </div>
                ${logs.length === 0 ? '<div class="text-slate-400 text-sm italic">Record meetings, stakeholder engagements, or key decisions here.</div>' : 
                `<div class="space-y-3">
                    ${logs.map((log, i) => `
                    <div class="bg-white p-3 rounded border border-slate-200 text-sm relative group">
                        <button onclick="window.deleteLeadershipLog(${i})" class="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="x" class="w-3 h-3"></i></button>
                        <div class="font-bold text-slate-700 text-xs mb-1">${log.date}</div>
                        <div class="text-slate-800">${escapeHtml(log.note)}</div>
                    </div>`).join('')}
                </div>`}
            </div>`;
    }
}

function renderDataView() {
    const d = state.projectData;
    const formContainer = document.querySelector('#view-data .bg-white .space-y-4'); 
    
    if (formContainer && formContainer.children.length === 0) {
        formContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" id="chart-date" class="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rcem-purple outline-none"></div>
                <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Value</label><input type="number" id="chart-value" class="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rcem-purple outline-none" placeholder="127"></div>
            </div>
            <div>
                 <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Grade</label>
                 <select id="chart-grade" class="w-full p-2 border border-slate-300 rounded text-sm bg-white"><option>Not Specified</option><option>Consultant</option><option>Registrar</option><option>Nurse</option></select>
            </div>
            <div>
                 <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Measure Type</label>
                 <select id="chart-cat" class="w-full p-2 border border-slate-300 rounded text-sm bg-white">
                    <option value="outcome">Outcome Measure (Primary Aim)</option>
                    <option value="process">Process Measure (Compliance)</option>
                    <option value="balance">Balancing Measure (Safety/Side effects)</option>
                 </select>
            </div>
            <div id="data-preview-card" class="hidden bg-slate-50 p-3 rounded border border-slate-200 text-xs text-slate-600 mb-2">
                <strong>Preview:</strong> <span id="preview-text">...</span>
            </div>
            <div class="pt-2"><button onclick="window.addDataPoint()" class="w-full bg-rcem-purple text-white py-2 rounded font-bold hover:bg-indigo-900 shadow">Add Data Point</button></div>
            <div class="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button onclick="document.getElementById('csv-upload').click()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="upload" class="w-3 h-3"></i> Upload CSV</button>
                <button onclick="window.downloadCSVTemplate()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="download" class="w-3 h-3"></i> Template</button>
            </div>
        `;
        
        ['chart-date', 'chart-value', 'chart-grade'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                const date = document.getElementById('chart-date').value;
                const val = document.getElementById('chart-value').value;
                const grade = document.getElementById('chart-grade').value;
                if(date && val) {
                    document.getElementById('data-preview-card').classList.remove('hidden');
                    document.getElementById('preview-text').innerHTML = `Value: <strong>${val}</strong> on ${date} (${grade})`;
                } else {
                    document.getElementById('data-preview-card').classList.add('hidden');
                }
            });
        });
    }

    const historyContainer = document.getElementById('data-history');
    if (d.chartData.length === 0) historyContainer.innerHTML = `<div class="text-center py-8 text-slate-400 italic text-xs">No data yet.</div>`;
    else {
        const sorted = [...d.chartData].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        historyContainer.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead><tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200"><th class="pb-2">Date</th><th class="pb-2">Value</th><th class="pb-2">Grade</th><th class="pb-2 text-right"></th></tr></thead>
                <tbody class="text-xs text-slate-700">
                    ${sorted.map(item => `<tr class="border-b border-slate-50 hover:bg-slate-50"><td class="py-2 font-mono">${item.date}</td><td class="py-2 font-bold text-rcem-purple">${item.value}</td><td class="py-2 text-slate-400">${item.grade || '-'}</td><td class="py-2 text-right"><button onclick="window.deleteDataPoint('${item.date}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button></td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }
    if(window.renderChart) window.renderChart();
}

function renderPDSA() {
    const container = document.getElementById('pdsa-container');
    const isTimeline = container.getAttribute('data-view') === 'timeline';
    const d = state.projectData;
    let html = `<div class="flex justify-between items-center mb-6"><h3 class="font-bold text-slate-800">PDSA Cycles</h3><div class="flex bg-slate-100 p-1 rounded-lg"><button onclick="document.getElementById('pdsa-container').setAttribute('data-view', 'grid'); renderPDSA()" class="px-3 py-1 text-xs font-bold rounded ${!isTimeline?'bg-white shadow':''}">Grid</button><button onclick="document.getElementById('pdsa-container').setAttribute('data-view', 'timeline'); renderPDSA()" class="px-3 py-1 text-xs font-bold rounded ${isTimeline?'bg-white shadow':''}">Timeline</button></div></div>`;
    if (isTimeline) {
        html += `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto"><div class="min-w-[600px]">`;
        [...d.pdsa].sort((a,b) => new Date(a.start) - new Date(b.start)).forEach(p => {
            html += `<div class="mb-4"><div class="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>${escapeHtml(p.title)}</span><span class="font-mono">${p.start} → ${p.end}</span></div><div class="h-4 bg-slate-100 rounded-full overflow-hidden relative"><div class="absolute inset-y-0 left-0 bg-rcem-purple rounded-full opacity-80" style="width: 100%"></div></div></div>`;
        });
        html += `</div></div>`;
    } else {
        html += `<div class="bg-white rounded-xl shadow-sm border-l-4 border-rcem-purple p-6 mb-8"><h4 class="font-bold text-slate-800 mb-4">Start New Cycle</h4><div class="grid grid-cols-2 gap-4 mb-3"><input id="pdsa-title" class="p-2 border rounded text-sm" placeholder="Title"><div class="flex gap-2"><input type="date" id="pdsa-start" class="w-full p-2 border rounded text-sm"><input type="date" id="pdsa-end" class="w-full p-2 border rounded text-sm"></div></div><textarea id="pdsa-plan" class="w-full p-2 border rounded text-sm mb-3" rows="2" placeholder="Plan..."></textarea><button onclick="window.addPDSA()" class="bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm">Create Cycle</button></div><div class="space-y-4">${d.pdsa.map((p,i) => `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative group"><button onclick="window.deletePDSA(${i})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button><h4 class="font-bold text-slate-800">${escapeHtml(p.title)}</h4><div class="grid grid-cols-4 gap-4 mt-4 text-sm"><textarea onchange="window.updatePDSA(${i}, 'desc', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Plan">${escapeHtml(p.desc)}</textarea><textarea onchange="window.updatePDSA(${i}, 'do', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Do">${escapeHtml(p.do)}</textarea><textarea onchange="window.updatePDSA(${i}, 'study', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Study">${escapeHtml(p.study)}</textarea><textarea onchange="window.updatePDSA(${i}, 'act', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Act">${escapeHtml(p.act)}</textarea></div></div>`).join('')}</div>`;
    }
    container.innerHTML = html;
}

function renderStakeholders() {
    const el = document.getElementById('view-stakeholders');
    const isList = el.getAttribute('data-view') === 'list';
    const canvas = document.getElementById('stakeholder-canvas');
    
    let header = document.querySelector('#view-stakeholders .stakeholder-controls');
    if(!header) {
        header = document.createElement('div');
        header.className = 'stakeholder-controls flex justify-end gap-2 p-4';
        header.innerHTML = `<button onclick="window.toggleStakeView()" class="bg-white border border-slate-300 text-slate-600 px-3 py-1 rounded text-xs font-bold shadow-sm">Toggle View</button>`;
        el.insertBefore(header, el.firstChild);
    }

    if(isList) {
        canvas.innerHTML = `
        <div class="p-8 max-w-4xl mx-auto">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50 border-b border-slate-200"><tr class="text-xs font-bold text-slate-500 uppercase"><th class="p-4">Name</th><th class="p-4">Power (0-100)</th><th class="p-4">Interest (0-100)</th><th class="p-4"></th></tr></thead>
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
                <div class="p-4 bg-slate-50 border-t border-slate-200">
                    <button onclick="window.addStakeholder()" class="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 font-bold text-sm hover:bg-white transition-colors">+ Add Stakeholder</button>
                </div>
            </div>
        </div>`;
    } else {
        canvas.innerHTML = `
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-50 pointer-events-none"></div>
            <div class="absolute left-4 bottom-4 w-64 text-xs text-slate-400 pointer-events-none z-10">
                <div class="font-bold">Y-Axis: Power / Influence</div>
                <div class="font-bold">X-Axis: Interest</div>
            </div>
            <div class="absolute top-1/2 left-0 w-full h-px bg-slate-300 dashed z-0"></div>
            <div class="absolute left-1/2 top-0 h-full w-px bg-slate-300 dashed z-0"></div>
        `;
        
        state.projectData.stakeholders.forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'absolute w-10 h-10 bg-rcem-purple text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg cursor-grab z-20 hover:scale-110 transition-transform';
            el.style.left = `${s.x}%`; 
            el.style.bottom = `${s.y}%`; 
            el.innerText = s.name.substring(0,2).toUpperCase();
            el.title = `${s.name} (P:${s.y}, I:${s.x})`;
            canvas.appendChild(el);
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderGantt() { 
    document.getElementById('gantt-container').innerHTML = `
        <div class="space-y-2">${state.projectData.gantt.map(t => `
            <div class="flex items-center gap-4 bg-white p-3 rounded border border-slate-200 shadow-sm">
                <div class="flex-1">
                    <div class="font-bold text-sm text-slate-800">${escapeHtml(t.name)}</div>
                    <div class="text-xs text-slate-500">${t.start} -> ${t.end}</div>
                </div>
                <button onclick="window.deleteGantt('${t.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>`).join('')}
        </div>
        <button onclick="window.openGanttModal()" class="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded font-bold text-sm text-slate-500">+ Add Task</button>
    `; 
}

// ==========================================
// 8. LOGIC & HELPERS
// ==========================================

// --- Calculators ---
function calcGreen() {
    const sheets = document.getElementById('calc-paper').value;
    const co2 = (sheets * 0.005).toFixed(2); 
    document.getElementById('res-green').innerText = `${co2} kg CO2`;
}
function calcTime() {
    const hours = document.getElementById('calc-hours').value;
    const cost = (hours * 30).toFixed(2); 
    document.getElementById('res-time').innerText = `£${cost} / month`;
}
function calcEdu() {
    const ppl = document.getElementById('calc-edu-ppl').value;
    if(ppl) {
        document.getElementById('res-edu').innerText = `${ppl} staff upskilled!`;
        showToast("Education impact logged", "success");
    }
}
function calcMoney() { calcTime(); } // Alias

// --- Modals & Toggles ---
function openMemberModal() { document.getElementById('member-modal').classList.remove('hidden'); }
function openGanttModal() { document.getElementById('task-modal').classList.remove('hidden'); }
function toggleToolList() { renderTools(); }

// --- Fishbone Logic ---
function updateFishCat(i, v) { state.projectData.fishbone.categories[i].text = v; window.saveData(); }
function updateFishCause(i, j, v) { state.projectData.fishbone.categories[i].causes[j].text = v; window.saveData(); }
function addFishCause(i) { state.projectData.fishbone.categories[i].causes.push({text: "New", x: 50, y: 50}); window.saveData(); renderTools(); }
function removeFishCause(i, j) { state.projectData.fishbone.categories[i].causes.splice(j, 1); window.saveData(); renderTools(); }

// --- Leadership Logic ---
function addLeadershipLog() { 
    const n = prompt("Enter meeting note or decision:"); 
    if(n) { 
        if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = []; 
        state.projectData.leadershipLogs.push({ date: new Date().toLocaleDateString(), note: n }); 
        window.saveData(); 
        renderTeam(); 
        showToast("Log added", "success"); 
    } 
}
function deleteLeadershipLog(i) { 
    if(confirm("Delete this log?")) { 
        state.projectData.leadershipLogs.splice(i, 1); 
        window.saveData(); 
        renderTeam(); 
    } 
}

// --- Stakeholder Logic ---
function addStakeholder() { const n = prompt("Name:"); if(n) { state.projectData.stakeholders.push({name:n, x:50, y:50}); window.saveData(); renderStakeholders(); } }
function updateStake(i, k, v) { state.projectData.stakeholders[i][k] = v; window.saveData(); }
function removeStake(i) { if(confirm("Remove?")) { state.projectData.stakeholders.splice(i,1); window.saveData(); renderStakeholders(); } }
function toggleStakeView() { const e = document.getElementById('view-stakeholders'); e.setAttribute('data-view', e.getAttribute('data-view')==='list'?'visual':'list'); renderStakeholders(); }

// --- PDSA Logic ---
function addPDSA() { 
    const t=document.getElementById('pdsa-title').value; 
    const s=document.getElementById('pdsa-start').value; 
    const e=document.getElementById('pdsa-end').value; 
    const p=document.getElementById('pdsa-plan').value; 
    if(t){ state.projectData.pdsa.push({title:t, start:s, end:e, desc:p, do:'', study:'', act:''}); window.saveData(); renderPDSA(); showToast("Cycle added", "success"); } 
    else { showToast("Title required", "error"); }
}
function updatePDSA(i, f, v) { state.projectData.pdsa[i][f] = v; window.saveData(); }
function deletePDSA(i) { if(confirm("Delete cycle?")) { state.projectData.pdsa.splice(i,1); window.saveData(); renderPDSA(); } }

// --- Placeholder/Legacy ---
function saveSmartAim() { showToast("Aim saved", "info"); } 
function openPortfolioExport() { showToast("Coming soon", "info"); } 
function copyReport() { navigator.clipboard.writeText("Report copied"); showToast("Copied", "success"); } 
function showHelp() { alert("Use the tabs to navigate your QIP journey."); } 
function startTour() { showToast("Tour not available", "info"); }

// ==========================================
// 9. EXPORTS
// ==========================================

export { 
    renderDashboard, renderAll, renderDataView, renderPDSA, renderGantt, renderTools, 
    renderTeam, renderPublish, renderChecklist, renderFullProject, renderStakeholders, 
    renderGreen, openMemberModal, openGanttModal, toggleToolList, 
    
    updateFishCat, updateFishCause, addFishCause, removeFishCause,
    addLeadershipLog, deleteLeadershipLog,
    addStakeholder, updateStake, removeStake, toggleStakeView,
    addPDSA, updatePDSA, deletePDSA,
    saveSmartAim, openPortfolioExport, copyReport,
    calcGreen, calcTime, calcMoney, calcEdu,
    showHelp, startTour
};
