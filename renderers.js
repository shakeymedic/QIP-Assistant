import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, setToolMode, renderFullViewChart } from "./charts.js";

// === MAIN ROUTER ===
function renderAll(view) {
    updateNavigationUI(view);
    if (view === 'dashboard') renderDashboard();
    if (view === 'full') renderFullProject();
    if (view === 'checklist') renderChecklist();
    if (view === 'team') renderTeam();
    if (view === 'tools') renderTools();
    if (view === 'stakeholders') renderStakeholders();
    if (view === 'gantt') renderGantt();
    if (view === 'pdsa') renderPDSA();
    if (view === 'data') renderDataView();
    if (view === 'green') renderGreen();
    if (view === 'publish') renderPublish();
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
        
        if(id === 'checklist' && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist.ethics) status = '✓';
        
        const hasBadge = btn.querySelector('.status-badge');
        if(status && !hasBadge) {
             btn.innerHTML += ` <span class="status-badge ml-auto text-emerald-400 font-bold text-[10px]">${status}</span>`;
        }
    });
}

// === DASHBOARD ===
function renderDashboard() {
    const d = state.projectData;
    const values = d.chartData.map(x => Number(x.value)).filter(n => !isNaN(n));
    const avg = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    
    const calcProgress = (c, t) => Math.min(100, Math.round((c / t) * 100));
    const totalProg = Math.round((calcProgress(d.chartData.length, 12) + calcProgress(d.pdsa.length, 3) + calcProgress(d.drivers.primary.length, 3)) / 3);

    document.getElementById('stat-progress').innerHTML = `
        <div class="flex justify-between items-end mb-1">
            <span class="text-3xl font-bold text-slate-800">${totalProg}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill bg-emerald-500" style="width: ${totalProg}%"></div></div>
        <div class="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Project Completion</div>
    `;
    
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Measuring Phase", m: "Collect at least 6 data points to establish a baseline.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    
    if (d.chartData.length >= 6 && d.pdsa.length === 0) msg = { t: "Time for Action", m: "Baseline established. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
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

    const statsContainer = document.getElementById('stat-pdsa').parentElement.parentElement;
    statsContainer.innerHTML = `
        <div class="col-span-2 sm:col-span-4 bg-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-wrap gap-8 items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-white/10 rounded-lg"><i data-lucide="clock" class="w-6 h-6 text-amber-400"></i></div>
                <div><div class="text-xs text-slate-400 font-bold uppercase tracking-wider">Average</div><div class="text-2xl font-bold font-mono">${avg}s</div></div>
            </div>
            <div class="h-10 w-px bg-white/10 hidden sm:block"></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Fastest</div><div class="text-xl font-bold text-emerald-400 font-mono">${min}s</div></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Slowest</div><div class="text-xl font-bold text-red-400 font-mono">${max}s</div></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Points</div><div class="text-xl font-bold">${values.length}</div></div>
        </div>
    `;

    const aimEl = document.getElementById('dash-aim-display');
    aimEl.innerHTML = d.checklist.aim ? d.checklist.aim : `No aim defined yet.`;
    aimEl.className = d.checklist.aim ? "bg-indigo-50 p-4 rounded border border-indigo-100 text-rcem-purple font-bold font-serif" : "bg-slate-50 p-4 rounded border border-slate-200 text-slate-500 italic";
}

// === DATA VIEW ===
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
                 <select id="chart-cat" class="w-full p-2 border border-slate-300 rounded text-sm bg-white"><option value="outcome">Outcome (Primary Aim)</option><option value="process">Process (Compliance)</option><option value="balance">Balancing (Safety)</option></select>
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

function renderFullProject() {
    const d = state.projectData;
    const has = (v) => v && v.length > 0 ? v : `<span class="text-slate-400 italic">Not yet defined</span>`;
    document.getElementById('full-project-container').innerHTML = `
        <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h2 class="text-2xl font-bold text-rcem-purple mb-6 border-b pb-2">1. Project Charter</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Problem Description</h3><p class="text-slate-600">${has(d.checklist.problem_desc)}</p></div>
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">SMART Aim</h3><p class="text-slate-800 font-bold font-serif bg-indigo-50 p-3 rounded border border-indigo-100">${has(d.checklist.aim)}</p></div>
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Available Knowledge</h3><p class="text-slate-600">${has(d.checklist.lit_review)}</p></div>
                <div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Context</h3><p class="text-slate-600">${has(d.checklist.context)}</p></div>
            </div>
        </div>
        <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mt-8">
             <h2 class="text-2xl font-bold text-rcem-purple mb-6 border-b pb-2">3. Measurement</h2>
             <div id="full-view-chart-container" class="mb-6"></div>
             <div class="bg-slate-50 p-4 rounded border border-slate-200">
                <h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Results Analysis</h3>
                <p class="text-slate-600">${has(d.checklist.results_text)}</p>
             </div>
        </div>
    `;
    renderFullViewChart();
}

function renderChecklist() {
    const d = state.projectData;
    const isSmart = (text) => /\d/.test(text) && /\b(by|in|20\d\d)\b/i.test(text);
    const hint = isSmart(d.checklist.aim) ? "<span class='text-emerald-600'>✓ Good SMART Aim</span>" : "<span class='text-amber-600'>⚠️ Add a Measure (Number) and Time (Date)</span>";
    document.getElementById('checklist-container').innerHTML = `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            <div><label class="block text-sm font-bold text-slate-700 mb-2">Problem Description</label><textarea onchange="window.saveChecklist('problem_desc', this.value)" class="w-full p-3 border border-slate-300 rounded text-sm focus:border-rcem-purple outline-none" rows="3">${escapeHtml(d.checklist.problem_desc)}</textarea></div>
            <div><label class="block text-sm font-bold text-slate-700 mb-2">SMART Aim</label><input type="text" oninput="window.saveChecklist('aim', this.value); window.renderChecklist()" value="${escapeHtml(d.checklist.aim)}" class="w-full p-3 border border-slate-300 rounded text-sm focus:border-rcem-purple outline-none"><div class="text-xs mt-2 font-bold">${hint}</div></div>
        </div>
    `;
}

// === TEAM & LEADERSHIP ===
function renderTeam() {
    // Render Members
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

    // Render Leadership Logs
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

function openMemberModal() {
    const modal = document.getElementById('member-modal');
    modal.querySelector('.space-y-4').innerHTML = `
        <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Name</label><input type="text" id="member-name" class="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-rcem-purple"></div>
        <div class="grid grid-cols-2 gap-3">
             <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Role</label><select id="member-role" class="w-full p-2 border border-slate-300 rounded text-sm bg-white"><option>Project Lead</option><option>Sponsor</option><option>Data Collector</option><option>Stakeholder</option></select></div>
             <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Grade</label><select id="member-grade" class="w-full p-2 border border-slate-300 rounded text-sm bg-white"><option>Consultant</option><option>Registrar</option><option>SHO</option><option>Nurse</option><option>ACP</option><option>Other</option></select></div>
        </div>
        <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Responsibilities</label><input type="text" id="member-resp" class="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-rcem-purple" placeholder="e.g. Data collection"></div>
        <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Initials</label><input type="text" id="member-init" class="w-full p-2 border border-slate-300 rounded text-sm outline-none uppercase" maxlength="3"></div>
        <button onclick="window.saveMember()" class="w-full bg-rcem-purple text-white py-2 rounded font-bold hover:bg-indigo-900 shadow transition-all mt-2">Add Member</button>
    `;
    modal.classList.remove('hidden');
}

// === PUBLISH & REPORTS ===
function renderPublish(mode = 'abstract') {
    const d = state.projectData;
    const content = document.getElementById('publish-content');
    if (mode === 'abstract') {
        const s1 = `${d.checklist.problem_desc} ${d.checklist.aim}`.trim(); const s2 = `Drivers: ${(d.drivers.changes || []).join(', ')}.`.trim(); const s3 = `${d.checklist.results_text}`.trim();
        content.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-8"><div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h3 class="font-bold text-slate-800 mb-4 border-b pb-2">RCEM Abstract</h3><textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32 mb-4">${s1}</textarea><textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32 mb-4">${s2}</textarea><textarea readonly class="w-full p-3 bg-slate-50 rounded border border-slate-200 text-sm h-32">${s3}</textarea></div><div class="bg-sky-50 p-6 rounded-xl border border-sky-100 text-center"><button onclick="navigator.clipboard.writeText('${escapeHtml(s1)}\\n\\n${escapeHtml(s2)}\\n\\n${escapeHtml(s3)}'); showToast('Copied!', 'success');" class="w-full bg-slate-800 text-white py-3 rounded font-bold text-sm">Copy All</button></div></div>`;
    } else {
        content.innerHTML = `<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8"><h3 class="font-bold text-slate-800 mb-4">FRCEM Report Builder</h3><div class="space-y-4"><div><label class="block text-xs font-bold text-slate-700 mb-1">Available Knowledge</label><textarea onchange="window.saveChecklist('lit_review', this.value)" class="w-full p-3 border rounded text-sm">${escapeHtml(d.checklist.lit_review || '')}</textarea></div><div><label class="block text-xs font-bold text-slate-700 mb-1">Context</label><textarea onchange="window.saveChecklist('context', this.value)" class="w-full p-3 border rounded text-sm">${escapeHtml(d.checklist.context || '')}</textarea></div></div></div>`;
    }
}

function renderGantt() { document.getElementById('gantt-container').innerHTML = `<div class="space-y-2">${state.projectData.gantt.map(t => `<div class="flex items-center gap-4 bg-white p-3 rounded border border-slate-200 shadow-sm"><div class="flex-1"><div class="font-bold text-sm text-slate-800">${escapeHtml(t.name)}</div><div class="text-xs text-slate-500">${t.start} -> ${t.end}</div></div><button onclick="window.deleteGantt('${t.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`).join('')}</div><button onclick="window.openGanttModal()" class="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded font-bold text-sm text-slate-500">+ Add Task</button>`; }

// === STAKEHOLDERS ===
function renderStakeholders() { 
    const el = document.getElementById('view-stakeholders');
    const isList = el.getAttribute('data-view') === 'list';
    const canvas = document.getElementById('stakeholder-canvas');
    
    // Header controls
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
            el.style.bottom = `${s.y}%`; // Using bottom for Y-axis (Power)
            el.innerText = s.name.substring(0,2).toUpperCase();
            el.title = `${s.name} (P:${s.y}, I:${s.x})`;
            canvas.appendChild(el);
        });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderGreen() {
    const el = document.getElementById('view-green');
    el.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8">
            <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h3 class="font-bold text-xl text-emerald-800 mb-4 flex items-center gap-2"><i data-lucide="leaf" class="w-5 h-5"></i> Sustainable Value Calculator</h3>
                <p class="text-slate-600 mb-6 text-sm">Estimate the environmental and financial impact of your improvement.</p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="p-4 bg-emerald-50 rounded border border-emerald-100">
                        <label class="block text-xs font-bold text-emerald-700 uppercase mb-2">Paper Saved (Sheets/Month)</label>
                        <input type="number" id="calc-paper" class="w-full p-2 border border-emerald-200 rounded text-sm" placeholder="0">
                        <div class="mt-2 text-right"><button onclick="window.calcGreen()" class="text-xs bg-emerald-600 text-white px-3 py-1 rounded font-bold">Calculate CO2</button></div>
                        <div id="res-green" class="mt-2 text-lg font-bold text-emerald-900 text-right">-</div>
                    </div>

                    <div class="p-4 bg-blue-50 rounded border border-blue-100">
                        <label class="block text-xs font-bold text-blue-700 uppercase mb-2">Staff Time Saved (Hours/Month)</label>
                        <input type="number" id="calc-hours" class="w-full p-2 border border-blue-200 rounded text-sm" placeholder="0">
                        <div class="mt-2 text-right"><button onclick="window.calcTime()" class="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold">Calculate Cost</button></div>
                        <div id="res-time" class="mt-2 text-lg font-bold text-blue-900 text-right">-</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
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

// === EXPORT HELPERS & LOGIC FOR APP.JS ===

// 1. Tool Logic
function toggleToolList() {
    const el = document.getElementById('view-tools');
    const current = el.getAttribute('data-view');
    el.setAttribute('data-view', current === 'list' ? 'visual' : 'list');
    renderTools();
}

function updateFishCat(i, v) { state.projectData.fishbone.categories[i].text = v; window.saveData(); }
function updateFishCause(i, j, v) { state.projectData.fishbone.categories[i].causes[j].text = v; window.saveData(); }
function addFishCause(i) { state.projectData.fishbone.categories[i].causes.push({text: "New", x: 50, y: 50}); window.saveData(); renderTools(); }
function removeFishCause(i, j) { state.projectData.fishbone.categories[i].causes.splice(j, 1); window.saveData(); renderTools(); }

// 2. Leadership Logic
function addLeadershipLog() {
    const note = prompt("Enter meeting note or decision:");
    if(note) {
        if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
        state.projectData.leadershipLogs.push({ date: new Date().toLocaleDateString(), note });
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

// 3. Stakeholder Logic
function addStakeholder() {
    const name = prompt("Stakeholder Name:");
    if(name) {
        state.projectData.stakeholders.push({ name, x: 50, y: 50 });
        window.saveData();
        renderStakeholders();
    }
}
function updateStake(i, key, val) {
    state.projectData.stakeholders[i][key] = val;
    window.saveData();
}
function removeStake(i) {
    if(confirm("Remove stakeholder?")) {
        state.projectData.stakeholders.splice(i, 1);
        window.saveData();
        renderStakeholders();
    }
}
function toggleStakeView() {
    const el = document.getElementById('view-stakeholders');
    const current = el.getAttribute('data-view');
    el.setAttribute('data-view', current === 'list' ? 'visual' : 'list');
    renderStakeholders();
}

// 4. Calculator Logic
function calcGreen() {
    const sheets = document.getElementById('calc-paper').value;
    const co2 = (sheets * 0.005).toFixed(2); // roughly 5g per sheet
    document.getElementById('res-green').innerText = `${co2} kg CO2`;
}
function calcTime() {
    const hours = document.getElementById('calc-hours').value;
    const cost = (hours * 30).toFixed(2); // Avg staff cost £30/hr
    document.getElementById('res-time').innerText = `£${cost} / month`;
}
// Stubs for future use
function calcMoney() {} 
function calcEdu() {}

// 5. Misc App Logic
function saveSmartAim() { showToast("Aim saved via Checklist.", "info"); }
function openPortfolioExport() { showToast("Portfolio Export coming soon.", "info"); }
function copyReport() { 
    navigator.clipboard.writeText("Full report copied."); 
    showToast("Report copied to clipboard", "success"); 
}
function showHelp() { alert("Help Documentation: \n\n1. Define your problem.\n2. Measure baseline.\n3. Plan cycles."); }
function startTour() {
    if(window.driver) {
        const driverObj = window.driver.js.driver({
            showProgress: true,
            steps: [
                { element: '#nav-dashboard', popover: { title: 'Dashboard', description: 'Your project overview.' } },
                { element: '#nav-checklist', popover: { title: 'Define Phase', description: 'Start here by defining your problem.' } },
                { element: '#nav-tools', popover: { title: 'Diagnosis', description: 'Use Fishbone and Driver diagrams here.' } },
                { element: '#nav-data', popover: { title: 'Measurement', description: 'Log your data points and view SPC charts.' } }
            ]
        });
        driverObj.drive();
    } else {
        showToast("Tour not available.", "error");
    }
}

// Export ALL functions required by app.js
export { 
    renderDashboard, renderAll, renderDataView, renderPDSA, renderGantt, renderTools, 
    renderTeam, renderPublish, renderChecklist, renderFullProject, renderStakeholders, 
    renderGreen, openMemberModal, toggleToolList, 
    
    // Logic Exports
    updateFishCat, updateFishCause, addFishCause, removeFishCause,
    addLeadershipLog, deleteLeadershipLog,
    addStakeholder, updateStake, removeStake, toggleStakeView,
    saveSmartAim, openPortfolioExport, copyReport,
    calcGreen, calcTime, calcMoney, calcEdu,
    showHelp, startTour
};
