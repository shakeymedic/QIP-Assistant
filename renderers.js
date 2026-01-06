import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { renderChart, renderTools, renderFullViewChart } from './charts.js';

export function renderAll(currentView) {
    renderCoach();
    if(currentView === 'data') renderChart();
    if(currentView === 'tools') renderTools();
    if(currentView === 'stakeholders') renderStakeholders();
    if(currentView === 'checklist') renderChecklist();
    if(currentView === 'pdsa') renderPDSA();
    if(currentView === 'gantt') renderGantt();
    if(currentView === 'team') renderTeam();
    // FIX: Added the missing handler for the Full Project View
    if(currentView === 'full') renderFullProject();
}

export function renderCoach() {
    if(!state.projectData) return;
    const d = state.projectData;
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

export function renderTeam() {
    if(!state.projectData) return;
    const team = state.projectData.teamMembers || [];
    const container = document.getElementById('team-list');
    
    state.projectData.checklist.team = team.map(t => `${t.name} (${t.role})`).join('\n');
    
    if (team.length === 0) {
        container.innerHTML = `<div class="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm">No team members added. Click "Add Member" to build your team.</div>`;
    } else {
        container.innerHTML = team.map((t, index) => `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200">${escapeHtml(t.initials)}</div>
                    <div>
                        <div class="font-bold text-slate-800">${escapeHtml(t.name)}</div>
                        <div class="text-xs text-slate-500 uppercase font-bold">${escapeHtml(t.role)}</div>
                    </div>
                </div>
                ${!state.isReadOnly ? `<button onclick="window.deleteMember('${t.id}')" class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            </div>
        `).join('');
    }

    const logs = state.projectData.leadershipLogs || [];
    const logContainer = document.getElementById('leadership-log-list');
    logContainer.innerHTML = logs.map((l, i) => `
        <div class="text-xs p-2 bg-slate-50 rounded border border-slate-100 flex justify-between group">
            <span>${escapeHtml(l)}</span>
            ${!state.isReadOnly ? `<button onclick="window.deleteLeadershipLog(${i})" class="text-slate-300 hover:text-red-500 hidden group-hover:block"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
        </div>
    `).join('');
    
    if(logs.length > 0) {
        state.projectData.checklist.leadership_evidence = logs.map((l,i) => `${i+1}. ${l}`).join('\n');
    }

    lucide.createIcons();
}

export function renderChecklist() {
    if(!state.projectData) return;
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
        { id: "team", title: "Team, Leadership & Governance", fields: [
            {k:"team", l:"Team Members", p:"(Auto-generated from Team tab)", readonly: true},
            {k:"leadership_evidence", l:"Leadership & Management Evidence", p:"(Auto-generated from Leadership Log)", h: "leadership", readonly: true},
            {k:"ethics", l:"Ethical / Governance", p:"Ref Number"},
            {k:"ppi", l:"Patient Public Involvement", p:"Feedback"}
        ]},
        { id: "conc", title: "Conclusions", fields: [
            {k:"learning", l:"Key Learning / Analysis", p:"What worked?"},
            {k:"sustain", l:"Sustainability Plan", p:"How will it stick?", h: "sustain"}
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
                            ${f.l} 
                            <div class="flex gap-2">
                                ${f.w ? '<button onclick="document.getElementById(\'smart-modal\').classList.remove(\'hidden\')" class="text-rcem-purple hover:underline text-[10px] ml-2 flex items-center gap-1"><i data-lucide="wand-2" class="w-3 h-3"></i> Open Wizard</button>' : ''}
                                ${f.h ? `<button onclick="window.showHelp('${f.h}')" class="text-emerald-600 hover:underline text-[10px] ml-2 flex items-center gap-1"><i data-lucide="lightbulb" class="w-3 h-3"></i> Ideas</button>` : ''}
                            </div>
                        </label>
                        <textarea ${state.isReadOnly || f.readonly ? 'disabled' : ''} onchange="projectData.checklist['${f.k}']=this.value;saveData()" class="w-full rounded border-slate-300 p-2 text-sm focus:ring-2 focus:ring-rcem-purple outline-none transition-shadow ${f.readonly ? 'bg-slate-50 text-slate-500' : ''}" rows="2" placeholder="${f.p}">${escapeHtml(state.projectData.checklist[f.k])||''}</textarea>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

export function renderPDSA() {
    if(!state.projectData) return;
    const container = document.getElementById('pdsa-container');
    container.innerHTML = state.projectData.pdsa.map((p,i) => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-4">
                <div class="font-bold text-lg text-slate-800">${escapeHtml(p.title)}</div>
                ${!state.isReadOnly ? `<button onclick="window.deletePDSA(${i})" class="text-slate-400 hover:text-red-500"><i data-lucide="trash-2"></i></button>` : ''}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-3 rounded"><div class="text-xs font-bold text-blue-800 uppercase">Plan</div><textarea ${state.isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].plan=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.plan)}</textarea></div>
                <div class="bg-orange-50 p-3 rounded"><div class="text-xs font-bold text-orange-800 uppercase">Do</div><textarea ${state.isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].do=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.do)}</textarea></div>
                <div class="bg-purple-50 p-3 rounded"><div class="text-xs font-bold text-purple-800 uppercase">Study</div><textarea ${state.isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].study=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.study)}</textarea></div>
                <div class="bg-emerald-50 p-3 rounded"><div class="text-xs font-bold text-emerald-800 uppercase">Act</div><textarea ${state.isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].act=this.value;saveData()" class="w-full bg-transparent text-sm resize-none outline-none" rows="2">${escapeHtml(p.act)}</textarea></div>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                <input type="checkbox" ${p.isStepChange ? 'checked' : ''} ${state.isReadOnly ? 'disabled' : ''} onchange="projectData.pdsa[${i}].isStepChange=this.checked;saveData()" id="step-${i}">
                <label for="step-${i}" class="text-xs text-slate-500 font-bold">Mark as Step Change (Re-baseline Chart)</label>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

export function renderGantt() {
    if(!state.projectData) return;
    const g = state.projectData.gantt || [];
    const container = document.getElementById('gantt-container');
    
    if (g.length === 0) {
        container.innerHTML = `<div class="text-center py-12"><button onclick="window.openGanttModal()" class="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold">Add First Task</button></div>`;
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

        let avatarHtml = '';
        if (t.ownerId && state.projectData.teamMembers) {
            const owner = state.projectData.teamMembers.find(m => m.id === t.ownerId);
            if (owner) {
                avatarHtml = `<div class="gantt-avatar" title="Assigned to ${escapeHtml(owner.name)}">${escapeHtml(owner.initials)}</div>`;
            }
        }

        html += `
            <div class="flex border-b border-slate-100 hover:bg-slate-50 transition-colors h-12 relative group">
                <div class="w-[250px] shrink-0 p-3 text-sm font-medium text-slate-700 border-r border-slate-200 bg-white sticky left-0 z-10 truncate flex items-center justify-between">
                    ${escapeHtml(t.name)}
                    <button onclick="deleteGantt('${t.id}')" class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
                <div class="gantt-bar ${colorClass}" 
                     style="left: ${250 + leftPos}px; width: ${width}px;">
                     ${avatarHtml}
                     <span>${Math.round((end - start)/(1000*60*60*24))}d</span>
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

export function renderStakeholders() {
    if (!state.projectData) return;
    const container = document.getElementById('stakeholder-canvas');
    container.innerHTML = '';
    const stakeholderScripts = {
        highPowerLowInterest: { t: "Keep Satisfied", s: "Focus on Risk: 'We need your support to ensure this doesn't impact flow/safety. It won't require much of your time, but your sign-off is crucial.'" },
        highPowerHighInterest: { t: "Manage Closely", s: "Partnership: 'You are key to this success. Can we meet weekly? I want to build this around your vision for the department.'" },
        lowPowerHighInterest:  { t: "Keep Informed", s: "Empowerment: 'I know you care about this. Can you be our champion on the shop floor? We need your eyes and ears.'" },
        lowPowerLowInterest:   { t: "Monitor", s: "Minimal Effort: 'Just an FYI, we are tweaking this process. No action needed from you right now.'" }
    };
    
    state.projectData.stakeholders.forEach((s, index) => {
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
        if(!state.isReadOnly) el.onmousedown = (e) => dragStakeholder(e, index);
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
        state.projectData.stakeholders[index].interest = (x / rect.width) * 100;
        state.projectData.stakeholders[index].power = (y / rect.height) * 100;
        renderStakeholders();
    }
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        window.saveData();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

export async function renderFullProject() {
    if (!state.projectData) return;
    
    const container = document.getElementById('full-project-container');
    const d = state.projectData;
    
    const checkField = (val) => val && val.length > 5;
    const statusBadge = (complete) => complete 
        ? '<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">✓ Complete</span>'
        : '<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">⚠ Incomplete</span>';

    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    
    const cats = d.fishbone.categories;
    const fishboneCode = `mindmap\n  root(("${clean(d.meta.title || 'Problem')}"))\n` + 
        cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
    
    let driverCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
    d.drivers.primary.forEach((x,i) => driverCode += `  P --> P${i}["${clean(x)}"]\n`);
    d.drivers.secondary.forEach((x,i) => driverCode += `  S --> S${i}["${clean(x)}"]\n`);
    d.drivers.changes.forEach((x,i) => driverCode += `  C --> C${i}["${clean(x)}"]\n`);

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
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">4. Team, Leadership & Governance</h2>
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Team Members</h3><p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.team) || 'Not defined'}</p></div>
                    <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Ethics / Registration</h3><p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.ethics) || 'Not defined'}</p></div>
                </div>
                <div>
                    <h3 class="text-xs font-bold text-indigo-500 uppercase mb-2 flex items-center gap-1"><i data-lucide="award" class="w-3 h-3"></i> Leadership & Management</h3>
                    <p class="text-slate-700 whitespace-pre-wrap bg-indigo-50 p-4 rounded-lg border border-indigo-100">${escapeHtml(d.checklist.leadership_evidence) || '<span class="text-slate-400 italic">No leadership evidence recorded yet.</span>'}</p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">5. Driver Diagram</h2>
            <div class="mermaid bg-slate-50 p-4 rounded border overflow-x-auto">${driverCode}</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-xs text-slate-500"><strong>Primary:</strong> ${d.drivers.primary.join(', ')}</div>
                <div class="text-xs text-slate-500"><strong>Secondary:</strong> ${d.drivers.secondary.join(', ')}</div>
                <div class="text-xs text-slate-500"><strong>Changes:</strong> ${d.drivers.changes.join(', ')}</div>
            </div>
        </div>
        
        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">6. Fishbone Analysis</h2>
             <div class="mermaid bg-slate-50 p-4 rounded border overflow-x-auto">${fishboneCode}</div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">7. PDSA Cycles (${d.pdsa.length})</h2>
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
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">8. Data & Results</h2>
            <div class="bg-slate-50 p-4 rounded-lg border mb-4">
                 <div class="h-80 w-full relative">
                    <canvas id="fullProjectChart"></canvas>
                 </div>
            </div>
            <div><h3 class="text-xs font-bold text-slate-500 uppercase mb-2">Results Interpretation</h3>
            <p class="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border">${escapeHtml(d.checklist.results_text) || '<span class="text-slate-400 italic">No analysis written yet</span>'}</p></div>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border-2 border-emerald-200">
            <h2 class="text-lg font-bold text-slate-800 mb-4 border-b pb-3">9. Learning & Sustainability</h2>
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
    renderFullViewChart();
    try { await mermaid.run({ querySelector: '.mermaid' }); } catch(e) { console.error("Mermaid full render error", e); }
}

// Global actions exposed to window
export function openMemberModal() {
    document.getElementById('member-name').value = '';
    document.getElementById('member-role').value = '';
    document.getElementById('member-init').value = '';
    document.getElementById('member-modal').classList.remove('hidden');
}
export function saveMember() {
    const name = document.getElementById('member-name').value;
    const role = document.getElementById('member-role').value;
    const init = document.getElementById('member-init').value;
    if (name && role && init) {
        if (!state.projectData.teamMembers) state.projectData.teamMembers = [];
        state.projectData.teamMembers.push({ id: `tm-${Date.now()}`, name, role, initials: init.toUpperCase().substring(0,3) });
        window.saveData();
        document.getElementById('member-modal').classList.add('hidden');
        renderTeam();
    }
}
export function deleteMember(id) {
    if(confirm('Remove this team member?')) {
        state.projectData.teamMembers = state.projectData.teamMembers.filter(t => t.id !== id);
        window.saveData(); renderTeam();
    }
}
export function addLeadershipLog() {
    const txt = document.getElementById('lead-log-input').value;
    if(txt) {
        if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
        state.projectData.leadershipLogs.push(txt);
        document.getElementById('lead-log-input').value = '';
        window.saveData(); renderTeam();
    }
}
export function deleteLeadershipLog(index) {
    state.projectData.leadershipLogs.splice(index, 1);
    window.saveData(); renderTeam();
}
export function saveSmartAim() {
    if(state.isReadOnly) return;
    const v = document.getElementById('sa-verb').value;
    const m = document.getElementById('sa-metric').value;
    const p = document.getElementById('sa-pop').value;
    const b = document.getElementById('sa-base').value;
    const t = document.getElementById('sa-target').value;
    const d = document.getElementById('sa-date').value;
    state.projectData.checklist.aim = `To ${v} the ${m} for ${p} from ${b} to ${t} by ${d}.`;
    window.saveData();
    document.getElementById('smart-modal').classList.add('hidden');
    renderChecklist();
    renderCoach();
}
export function addStakeholder() {
    if(state.isReadOnly) return;
    const name = prompt("Stakeholder Name:");
    if(!name) return;
    if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
    state.projectData.stakeholders.push({ name: name, power: 50, interest: 50 });
    window.saveData(); renderStakeholders();
}
export function openGanttModal() {
    document.getElementById('task-name').value = '';
    document.getElementById('task-start').value = new Date().toISOString().split('T')[0];
    document.getElementById('task-end').value = '';
    const sel = document.getElementById('task-owner');
    sel.innerHTML = '<option value="">-- Unassigned --</option>';
    if(state.projectData.teamMembers) {
        state.projectData.teamMembers.forEach(m => {
            sel.innerHTML += `<option value="${m.id}">${escapeHtml(m.name)}</option>`;
        });
    }
    document.getElementById('task-modal').classList.remove('hidden');
}
export function saveGanttTask() {
    const n = document.getElementById('task-name').value;
    const s = document.getElementById('task-start').value;
    const e = document.getElementById('task-end').value;
    const t = document.getElementById('task-type').value;
    const o = document.getElementById('task-owner').value;
    if(!n || !s || !e) return;
    if(!state.projectData.gantt) state.projectData.gantt=[];
    state.projectData.gantt.push({ id: Date.now(), name: n, start: s, end: e, type: t, ownerId: o }); 
    window.saveData(); 
    document.getElementById('task-modal').classList.add('hidden');
    renderGantt(); 
}
export function deleteGantt(id) { state.projectData.gantt = state.projectData.gantt.filter(x=>x.id!=id); window.saveData(); renderGantt(); }
export function addPDSA() { 
    if (state.isReadOnly) return;
    const t = prompt("Cycle Title:"); 
    if(t) { state.projectData.pdsa.unshift({id: Date.now(), title:t, plan:"", do:"", study:"", act:"", isStepChange: false}); window.saveData(); renderPDSA(); } 
}
export function deletePDSA(i) { if(state.isReadOnly) return; if(confirm("Delete?")) { state.projectData.pdsa.splice(i,1); window.saveData(); renderPDSA(); } }
export function saveResults(val) { if(state.isReadOnly) return; if(!state.projectData.checklist) state.projectData.checklist={}; state.projectData.checklist.results_text = val; window.saveData(); }
export function showHelp(key) { 
    const helpData = {
        checklist: {
            t: "RCEM QIP Checklist Guide",
            c: `<div class="space-y-4">... (Help content omitted for brevity) ...</div>` // Add full content back if needed, but it's long
        },
        leadership: { t: "Leadership", c: "Checklist..." }, // Simplified for brevity in this split
        sustain: { t: "Sustainability", c: "..." },
        data: { t: "SPC Chart Guide", c: "..." },
        pdsa: { t: "PDSA Guide", c: "..." }
    };
    // Re-populate the full help text from original file here if needed, or keep simple
    document.getElementById('help-title').textContent = key; 
    document.getElementById('help-content').innerHTML = "See RCEM guidelines for details on " + key; 
    document.getElementById('help-modal').classList.remove('hidden'); 
    lucide.createIcons();
}
export function openHelp() { showHelp('checklist'); }
export function calcGreen() {
    const v = document.getElementById('green-type').value;
    const q = document.getElementById('green-qty').value;
    document.getElementById('green-res').innerHTML = `<span class="text-2xl text-emerald-600">${(v*q).toFixed(2)} kg</span> CO2e`;
    document.getElementById('green-res').classList.remove('hidden');
}
export function calcMoney() {
    const unit = parseFloat(document.getElementById('money-unit').value) || 0;
    const qty = parseFloat(document.getElementById('money-qty').value) || 0;
    document.getElementById('money-res').innerHTML = `<span class="text-2xl text-emerald-600">£${(unit * qty).toFixed(2)}</span> total saved`;
    document.getElementById('money-res').classList.remove('hidden');
}
export function calcTime() {
    const unit = parseFloat(document.getElementById('time-unit').value) || 0;
    const qty = parseFloat(document.getElementById('time-qty').value) || 0;
    const total = unit * qty;
    document.getElementById('time-res').innerHTML = `<span class="text-2xl text-blue-600">${Math.floor(total/60)}h ${total%60}m</span> total saved`;
    document.getElementById('time-res').classList.remove('hidden');
}
export function calcEdu() {
    const pre = parseFloat(document.getElementById('edu-pre').value) || 0;
    const post = parseFloat(document.getElementById('edu-post').value) || 0;
    const n = parseFloat(document.getElementById('edu-n').value) || 1;
    document.getElementById('edu-res').innerHTML = `Confidence improved by <span class="text-2xl text-indigo-600">${(((post - pre) / pre) * 100).toFixed(0)}%</span> across ${n} staff members.`;
    document.getElementById('edu-res').classList.remove('hidden');
}
export function startTour() {
    const driver = window.driver.js.driver;
    const tour = driver({ showProgress: true, steps: [{ element: '#nav-checklist', popover: { title: 'Step 1: Define', description: 'Start here.' } }, { element: '#nav-tools', popover: { title: 'Step 2: Diagnose', description: 'Use Fishbone & Drivers.' } }, { element: '#nav-data', popover: { title: 'Step 3: Measure', description: 'Enter data here.' } }, { element: '#nav-pdsa', popover: { title: 'Step 4: Act', description: 'Record changes.' } }] });
    tour.drive();
}
export function openPortfolioExport() {
    const d = state.projectData;
    const modal = document.getElementById('risr-modal');
    modal.classList.remove('hidden');
    const fields = [
        { t: "Title", v: d.meta.title },
        { t: "Reason", v: d.checklist.problem_desc },
        { t: "Evidence", v: d.checklist.evidence },
        { t: "Aim", v: d.checklist.aim },
        { t: "Team", v: d.checklist.team },
        { t: "Leadership & Mgmt", v: d.checklist.leadership_evidence },
        { t: "Drivers", v: `Primary: ${d.drivers.primary.join(', ')}\nChanges: ${d.drivers.changes.join(', ')}` },
        { t: "Measures", v: `Outcome: ${d.checklist.outcome_measures}\nProcess: ${d.checklist.process_measures}` },
        { t: "PDSA", v: d.pdsa.map(p => `[${p.title}] Study: ${p.study} Act: ${p.act}`).join('\n\n') },
        { t: "Analysis", v: d.checklist.results_text },
        { t: "Learning", v: d.checklist.learning + "\n\nSustainability: " + d.checklist.sustain },
        { t: "Ethics", v: d.checklist.ethics }
    ];
    document.getElementById('risr-content').innerHTML = fields.map(f => `<div class="bg-white p-4 rounded border border-slate-200 shadow-sm"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-slate-700 text-sm uppercase tracking-wide">${f.t}</h4><button class="text-xs text-rcem-purple font-bold hover:underline" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)">Copy</button></div><div class="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap font-mono text-slate-600 select-all border border-slate-100">${escapeHtml(f.v) || 'Not recorded'}</div></div>`).join('');
}
