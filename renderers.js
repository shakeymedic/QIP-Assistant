import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate } from "./charts.js";

export function renderAll(view) {
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
        if(id === 'checklist' && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist.ethics) status = '✓';
        const hasBadge = btn.querySelector('.status-badge');
        if(status && !hasBadge) btn.innerHTML += ` <span class="status-badge ml-auto text-emerald-400 font-bold text-[10px]">${status}</span>`;
    });
}

function renderDashboard() {
    const d = state.projectData;
    const values = d.chartData.map(x => Number(x.value)).filter(n => !isNaN(n));
    const avg = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const calcProgress = (c, t) => Math.min(100, Math.round((c / t) * 100));
    const totalProg = Math.round((calcProgress(d.chartData.length, 12) + calcProgress(d.pdsa.length, 3) + calcProgress(d.drivers.primary.length, 3)) / 3);

    document.getElementById('stat-progress').innerHTML = `<div class="flex justify-between items-end mb-1"><span class="text-3xl font-bold text-slate-800">${totalProg}%</span></div><div class="progress-track"><div class="progress-fill bg-emerald-500" style="width: ${totalProg}%"></div></div><div class="text-[10px] text-slate-400 mt-1 uppercase font-bold">Progress</div>`;

    const statsContainer = document.getElementById('stat-pdsa').parentElement.parentElement;
    statsContainer.innerHTML = `<div class="col-span-2 sm:col-span-4 bg-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-wrap gap-8 items-center justify-between"><div class="flex items-center gap-4"><div class="p-3 bg-white/10 rounded-lg"><i data-lucide="clock" class="w-6 h-6 text-amber-400"></i></div><div><div class="text-xs text-slate-400 font-bold uppercase tracking-wider">Average</div><div class="text-2xl font-bold font-mono">${avg}s</div></div></div><div class="h-10 w-px bg-white/10 hidden sm:block"></div><div><div class="text-xs text-slate-400 font-bold uppercase">Fastest</div><div class="text-xl font-bold text-emerald-400 font-mono">${min}s</div></div><div><div class="text-xs text-slate-400 font-bold uppercase">Slowest</div><div class="text-xl font-bold text-red-400 font-mono">${max}s</div></div><div><div class="text-xs text-slate-400 font-bold uppercase">Points</div><div class="text-xl font-bold">${values.length}</div></div></div>`;
    
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Measuring Phase", m: "Collect at least 6 data points to establish a baseline.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    if (d.chartData.length >= 6 && d.pdsa.length === 0) msg = { t: "Time for Action", m: "Baseline set. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
    else if (d.pdsa.length > 0) msg = { t: "Project Active", m: "Monitor your data for shifts (6 points above/below median).", i: "activity", c: "blue-500", b: "Add Point", a: "data" };
    coachEl.innerHTML = `<div class="bg-white border-l-4 border-${msg.c} p-6 mb-8 rounded-r-xl shadow-sm flex flex-col md:flex-row gap-6 items-center"><div class="bg-slate-50 p-4 rounded-full text-${msg.c}"><i data-lucide="${msg.i}" class="w-8 h-8"></i></div><div class="flex-1"><h4 class="font-bold text-slate-800 text-lg">QI COACH: ${msg.t}</h4><p class="text-slate-600 mt-1">${msg.m}</p></div><button onclick="window.router('${msg.a}')" class="bg-slate-800 text-white px-4 py-2 rounded shadow-lg font-bold text-sm hover:bg-slate-900">${msg.b}</button></div>`;
    
    const aimEl = document.getElementById('dash-aim-display');
    aimEl.innerText = d.checklist.aim || "No aim defined yet.";
    aimEl.className = d.checklist.aim ? "bg-indigo-50 p-4 rounded border border-indigo-100 text-rcem-purple font-bold font-serif" : "bg-slate-50 p-4 rounded border border-slate-200 text-slate-500 italic";
}

function renderTools() {
    const mode = window.toolMode || 'fishbone'; 
    const canvas = document.getElementById('diagram-canvas');
    canvas.innerHTML = ''; 
    const header = document.querySelector('#view-tools header');
    if(!document.getElementById('tool-nav-ui')) {
        header.innerHTML = `<div id="tool-nav-ui" class="flex gap-2 bg-slate-100 p-1 rounded-lg"><button onclick="window.setToolMode('fishbone')" class="px-3 py-1 rounded text-sm font-bold ${mode==='fishbone'?'bg-white shadow text-rcem-purple':''}">Fishbone</button><button onclick="window.setToolMode('driver')" class="px-3 py-1 rounded text-sm font-bold ${mode==='driver'?'bg-white shadow text-rcem-purple':''}">Driver</button></div><button onclick="window.toggleToolList()" class="ml-auto text-xs font-bold text-slate-500 flex gap-2 items-center bg-slate-100 px-3 py-1 rounded"><i data-lucide="list"></i> List View</button>`;
    }

    if (document.getElementById('view-tools').getAttribute('data-view') === 'list') {
        renderDriverList(canvas);
        return;
    }

    if (mode === 'fishbone') {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.style.position = 'absolute'; svg.style.top = '0'; svg.style.left = '0'; svg.style.pointerEvents = 'none';
        svg.innerHTML = `<line x1="5%" y1="50%" x2="95%" y2="50%" stroke="#2d2e83" stroke-width="4"/><path d="M 95% 50% L 92% 48% L 92% 52% Z" fill="#2d2e83"/><line x1="20%" y1="20%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="20%" y1="80%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="70%" y1="20%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="70%" y1="80%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>`;
        canvas.appendChild(svg);
        const createLabel = (text, x, y, isCat, catIdx, causeIdx) => {
            const el = document.createElement('div');
            el.className = `fishbone-label ${isCat ? 'category' : ''}`;
            el.innerText = text; el.style.left = `${x}%`; el.style.top = `${y}%`;
            el.onmousedown = (e) => {
                e.preventDefault();
                const startX = e.clientX; const startY = e.clientY;
                const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
                const parentW = canvas.offsetWidth; const parentH = canvas.offsetHeight;
                const onMove = (ev) => {
                    const dx = (ev.clientX - startX) / parentW * 100; const dy = (ev.clientY - startY) / parentH * 100;
                    el.style.left = `${startLeft + dx}%`; el.style.top = `${startTop + dy}%`;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
                    const newX = parseFloat(el.style.left); const newY = parseFloat(el.style.top);
                    if (isCat) { state.projectData.fishbone.categories[catIdx].x = newX; state.projectData.fishbone.categories[catIdx].y = newY; } 
                    else { state.projectData.fishbone.categories[catIdx].causes[causeIdx].x = newX; state.projectData.fishbone.categories[catIdx].causes[causeIdx].y = newY; }
                    window.saveData(true);
                };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            };
            canvas.appendChild(el);
        };
        state.projectData.fishbone.categories.forEach((cat, i) => {
            createLabel(cat.text, cat.x || (i%2?20:70), cat.y || (i<2?20:80), true, i);
            cat.causes.forEach((cause, j) => {
                let cx = cause.x || (cat.x + (j*5)); let cy = cause.y || (cat.y + (j*5));
                createLabel(typeof cause === 'string' ? cause : cause.text, cx, cy, false, i, j);
            });
        });
    } else {
        // MERMAID DRIVER DIAGRAM
        const d = state.projectData.drivers;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        let mCode = `graph LR\n  AIM[AIM] --> P[Primary]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
        canvas.innerHTML = `<div class="mermaid w-full h-full flex items-center justify-center">${mCode}</div>`;
        try { mermaid.run(); } catch(e) { console.error(e); }
    }
}

function renderDriverList(container) {
    container.innerHTML = `<div class="p-8 bg-white h-full overflow-y-auto"><h3 class="font-bold text-slate-800 mb-4">Edit Diagram Data</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-8">${state.projectData.fishbone.categories.map((cat, i) => `<div class="bg-slate-50 p-4 rounded border border-slate-200"><input class="font-bold bg-transparent border-b border-slate-300 w-full mb-2 outline-none" value="${cat.text}" onchange="window.updateFishCat(${i}, this.value)"><div class="space-y-2 pl-4 border-l-2 border-slate-200">${cat.causes.map((c, j) => `<div class="flex gap-2"><input class="text-sm w-full p-1 border rounded" value="${typeof c === 'string' ? c : c.text}" onchange="window.updateFishCause(${i}, ${j}, this.value)"><button onclick="window.removeFishCause(${i}, ${j})" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addFishCause(${i})" class="text-xs text-sky-600 font-bold">+ Add Cause</button></div></div>`).join('')}</div></div>`;
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

function renderDataView() {
    const d = state.projectData;
    const formContainer = document.querySelector('#view-data .bg-white .space-y-4'); 
    if (formContainer) {
        formContainer.innerHTML = `<div class="grid grid-cols-2 gap-2"><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" id="chart-date" class="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rcem-purple outline-none"></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Value (s)</label><input type="number" id="chart-value" class="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-rcem-purple outline-none" placeholder="127"></div></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Grade</label><select id="chart-grade" class="w-full p-2 border border-slate-300 rounded text-sm bg-white"><option>Not Specified</option><option>Consultant</option><option>Registrar</option><option>Nurse</option></select></div><div class="pt-2"><button onclick="window.addDataPoint()" class="w-full bg-rcem-purple text-white py-2 rounded font-bold hover:bg-indigo-900 shadow">Add Data Point</button></div><div class="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2"><button onclick="document.getElementById('csv-upload').click()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="upload" class="w-3 h-3"></i> Upload CSV</button><button onclick="window.downloadCSVTemplate()" class="border border-slate-300 text-slate-600 py-1.5 rounded text-xs hover:bg-slate-50 flex items-center justify-center gap-1"><i data-lucide="download" class="w-3 h-3"></i> Template</button></div>`;
    }
    const historyContainer = document.getElementById('data-history');
    if (d.chartData.length === 0) historyContainer.innerHTML = `<div class="text-center py-8 text-slate-400 italic text-xs">No data yet.</div>`;
    else {
        const sorted = [...d.chartData].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        historyContainer.innerHTML = `<table class="w-full text-left border-collapse"><thead><tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200"><th class="pb-2">Date</th><th class="pb-2">Value</th><th class="pb-2">Grade</th><th class="pb-2 text-right"></th></tr></thead><tbody class="text-xs text-slate-700">${sorted.map(item => `<tr class="border-b border-slate-50 hover:bg-slate-50"><td class="py-2 font-mono">${item.date}</td><td class="py-2 font-bold text-rcem-purple">${item.value}</td><td class="py-2 text-slate-400">${item.grade || '-'}</td><td class="py-2 text-right"><button onclick="window.deleteDataPoint('${item.date}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button></td></tr>`).join('')}</tbody></table>`;
    }
    if(window.renderChart) window.renderChart();
}

function renderFullProject() {
    const d = state.projectData;
    const has = (v) => v && v.length > 0 ? v : `<span class="text-slate-400 italic">Not yet defined</span>`;
    document.getElementById('full-project-container').innerHTML = `<div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200"><h2 class="text-2xl font-bold text-rcem-purple mb-6 border-b pb-2">1. Project Charter</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Problem Description</h3><p class="text-slate-600">${has(d.checklist.problem_desc)}</p></div><div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">SMART Aim</h3><p class="text-slate-800 font-bold font-serif bg-indigo-50 p-3 rounded border border-indigo-100">${has(d.checklist.aim)}</p></div><div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Available Knowledge</h3><p class="text-slate-600">${has(d.checklist.lit_review)}</p></div><div><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Context</h3><p class="text-slate-600">${has(d.checklist.context)}</p></div></div></div><div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mt-8"><h2 class="text-2xl font-bold text-rcem-purple mb-6 border-b pb-2">3. Measurement</h2><div class="bg-slate-50 p-4 rounded border border-slate-200"><h3 class="font-bold text-slate-700 text-sm uppercase mb-2">Results Analysis</h3><p class="text-slate-600">${has(d.checklist.results_text)}</p></div></div>`;
}

function renderChecklist() {
    const d = state.projectData;
    const isSmart = (text) => /\d/.test(text) && /\b(by|in|20\d\d)\b/i.test(text);
    const hint = isSmart(d.checklist.aim) ? "<span class='text-emerald-600'>✓ Good SMART Aim</span>" : "<span class='text-amber-600'>⚠️ Add a Measure (Number) and Time (Date)</span>";
    document.getElementById('checklist-container').innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6"><div><label class="block text-sm font-bold text-slate-700 mb-2">Problem Description</label><textarea onchange="window.saveChecklist('problem_desc', this.value)" class="w-full p-3 border border-slate-300 rounded text-sm focus:border-rcem-purple outline-none" rows="3">${escapeHtml(d.checklist.problem_desc)}</textarea></div><div><label class="block text-sm font-bold text-slate-700 mb-2">SMART Aim</label><input type="text" oninput="window.saveChecklist('aim', this.value); window.renderChecklist()" value="${escapeHtml(d.checklist.aim)}" class="w-full p-3 border border-slate-300 rounded text-sm focus:border-rcem-purple outline-none"><div class="text-xs mt-2 font-bold">${hint}</div></div></div>`;
}

function renderTeam() {
    const list = document.getElementById('team-list');
    list.innerHTML = state.projectData.teamMembers.length === 0 ? `<div class="text-center p-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">No team members added yet.</div>` : state.projectData.teamMembers.map((m, i) => `<div class="p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative group"><button onclick="window.deleteMember(${i})" class="absolute top-3 right-3 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button><div class="flex items-start gap-4"><div class="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold shadow-md">${m.initials}</div><div><div class="font-bold text-slate-800">${escapeHtml(m.name)}</div><div class="text-xs font-bold text-rcem-purple uppercase tracking-wide mb-1">${escapeHtml(m.role)}</div></div></div></div>`).join('');
}

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
function renderGreen() { document.getElementById('view-green').innerHTML = '<div class="text-center p-8">Green Calculator (Placeholder)</div>'; }
function renderStakeholders() { 
    const isList = document.getElementById('view-stakeholders').getAttribute('data-view') === 'list';
    if(isList) {
        document.getElementById('stakeholder-canvas').innerHTML = `<div class="p-8"><table class="w-full text-left"><thead><tr><th>Name</th><th>Power</th><th>Interest</th></tr></thead><tbody>${state.projectData.stakeholders.map((s,i)=>`<tr><td><input value="${s.name}" onchange="window.updateStake(${i},'name',this.value)"></td><td><input type="number" value="${s.y}" onchange="window.updateStake(${i},'y',this.value)"></td><td><input type="number" value="${s.x}" onchange="window.updateStake(${i},'x',this.value)"></td></tr>`).join('')}</tbody></table></div>`;
    } else {
        document.getElementById('stakeholder-canvas').innerHTML = ''; // Clear for drag
        state.projectData.stakeholders.forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'absolute w-8 h-8 bg-rcem-purple text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg cursor-grab z-20';
            el.style.left = `${s.x}%`; el.style.top = `${s.y}%`; el.innerText = s.name.substring(0,2).toUpperCase();
            document.getElementById('stakeholder-canvas').appendChild(el);
        });
    }
}

window.setToolMode = (m) => { window.toolMode = m; renderTools(); };
window.toggleToolList = () => { document.getElementById('view-tools').setAttribute('data-view', document.getElementById('view-tools').getAttribute('data-view')==='list'?'visual':'list'); renderTools(); };
window.updateFishCat = (i,v) => { state.projectData.fishbone.categories[i].text=v; window.saveData(); };
window.updateFishCause = (i,j,v) => { state.projectData.fishbone.categories[i].causes[j].text=v; window.saveData(); };
window.addFishCause = (i) => { state.projectData.fishbone.categories[i].causes.push({text:"New", x:50, y:50}); window.saveData(); renderTools(); };
window.removeFishCause = (i,j) => { state.projectData.fishbone.categories[i].causes.splice(j,1); window.saveData(); renderTools(); };

export { renderDashboard, renderAll, renderDataView, renderPDSA, renderGantt, renderTools, renderTeam, renderPublish, renderChecklist, renderFullProject, renderStakeholders, renderGreen };
