import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, deleteDataPoint, downloadCSVTemplate } from "./charts.js";

// === MAIN ROUTER ===
export function renderAll(view) {
    updateNavigationUI(view);
    if (view === 'dashboard') renderDashboard();
    if (view === 'full') renderFullProject();
    if (view === 'checklist') renderChecklist();
    if (view === 'team') renderTeam();
    if (view === 'tools') renderTools(); // Now handles Fishbone tab
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
        
        // Remove existing badge then add if needed
        const existing = btn.querySelector('.status-badge');
        if(existing) existing.remove();
        if(status) btn.innerHTML += ` <span class="status-badge ml-auto text-emerald-400 font-bold text-[10px]">${status}</span>`;
    });
}

// === DASHBOARD ===
function renderDashboard() {
    const d = state.projectData;
    
    // 1. Progress Bar
    const calcProgress = (c, t) => Math.min(100, Math.round((c / t) * 100));
    const totalProg = Math.round((calcProgress(d.chartData.length, 12) + calcProgress(d.pdsa.length, 3) + calcProgress(d.drivers.primary.length, 3)) / 3);
    document.getElementById('stat-progress').innerHTML = `<div class="flex justify-between items-end mb-1"><span class="text-3xl font-bold text-slate-800">${totalProg}%</span></div><div class="progress-track"><div class="progress-fill bg-emerald-500" style="width: ${totalProg}%"></div></div><div class="text-[10px] text-slate-400 mt-1 uppercase font-bold">Overall Progress</div>`;

    // 2. QI Coach Banner
    const coachEl = document.getElementById('qi-coach-banner');
    let msg = { t: "Measuring Phase", m: "Collect at least 6 data points to establish a baseline.", i: "bar-chart-2", c: "rcem-purple", b: "Enter Data", a: "data" };
    if (d.chartData.length >= 6 && d.pdsa.length === 0) msg = { t: "Time for Action", m: "Baseline set. Plan your first PDSA cycle.", i: "play-circle", c: "emerald-600", b: "Plan Cycle", a: "pdsa" };
    else if (d.pdsa.length > 0) msg = { t: "Project Active", m: "Monitor your data for shifts (6 points above/below median).", i: "activity", c: "blue-500", b: "Add Point", a: "data" };
    
    coachEl.innerHTML = `<div class="bg-white border-l-4 border-${msg.c} p-6 mb-8 rounded-r-xl shadow-sm flex flex-col md:flex-row gap-6 items-center relative overflow-hidden"><div class="bg-slate-50 p-4 rounded-full text-${msg.c}"><i data-lucide="${msg.i}" class="w-8 h-8"></i></div><div class="flex-1"><h4 class="font-bold text-slate-800 text-lg">QI COACH: ${msg.t}</h4><p class="text-slate-600 mt-1">${msg.m}</p></div><button onclick="window.router('${msg.a}')" class="bg-slate-800 text-white px-4 py-2 rounded shadow-lg font-bold text-sm hover:bg-slate-900">${msg.b}</button></div>`;

    // 3. Time-to-Kit Widget
    const values = d.chartData.map(x => Number(x.value)).filter(n => !isNaN(n));
    const avg = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    
    const statsContainer = document.getElementById('stat-pdsa').parentElement.parentElement;
    // Replace the generic cards with the specific widget
    statsContainer.innerHTML = `
        <div class="col-span-2 sm:col-span-4 bg-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-wrap gap-8 items-center">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-white/10 rounded-lg"><i data-lucide="clock" class="w-6 h-6 text-amber-400"></i></div>
                <div><div class="text-xs text-slate-400 font-bold uppercase tracking-wider">Average Time</div><div class="text-2xl font-bold font-mono">${avg}s</div></div>
            </div>
            <div class="h-10 w-px bg-white/10 hidden sm:block"></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Fastest</div><div class="text-xl font-bold text-emerald-400 font-mono">${min}s</div></div>
            <div><div class="text-xs text-slate-400 font-bold uppercase">Slowest</div><div class="text-xl font-bold text-red-400 font-mono">${max}s</div></div>
            <div class="ml-auto text-right"><div class="text-xs text-slate-400 font-bold uppercase">Data Points</div><div class="text-xl font-bold">${values.length}</div></div>
        </div>
        <div class="col-span-2 sm:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
             ${['Define', 'Diagnose', 'Measure', 'Act'].map((l,i) => {
                 const p = [calcProgress(d.checklist.aim?1:0, 1), calcProgress(d.drivers.primary.length, 3), calcProgress(d.chartData.length, 12), calcProgress(d.pdsa.length, 3)][i];
                 return `<div class="bg-white p-3 rounded border border-slate-200"><div class="text-[10px] font-bold text-slate-500 uppercase mb-1">${l}</div><div class="progress-track h-1.5"><div class="progress-fill bg-rcem-purple" style="width:${p}%"></div></div></div>`
             }).join('')}
        </div>
    `;
    
    // Aim
    const aimEl = document.getElementById('dash-aim-display');
    aimEl.innerText = d.checklist.aim || "No aim defined yet.";
    aimEl.className = d.checklist.aim ? "bg-indigo-50 p-4 rounded border border-indigo-100 text-rcem-purple font-bold font-serif" : "bg-slate-50 p-4 rounded border border-slate-200 text-slate-500 italic";
}

// === FISHBONE (Moveable Labels) ===
function renderTools() {
    const mode = window.toolMode || 'fishbone'; // Default
    const canvas = document.getElementById('diagram-canvas');
    const ghost = document.getElementById('diagram-ghost');
    ghost.classList.add('hidden');
    canvas.innerHTML = ''; // Clear

    // Header Toggle
    const header = document.querySelector('#view-tools header');
    if(!document.getElementById('tool-nav-ui')) {
        header.innerHTML = `
            <div id="tool-nav-ui" class="flex gap-2 bg-slate-100 p-1 rounded-lg">
                <button onclick="window.setToolMode('fishbone')" class="px-3 py-1 rounded text-sm font-bold ${mode==='fishbone'?'bg-white shadow text-rcem-purple':''}">Fishbone</button>
                <button onclick="window.setToolMode('driver')" class="px-3 py-1 rounded text-sm font-bold ${mode==='driver'?'bg-white shadow text-rcem-purple':''}">Driver</button>
            </div>
            <button onclick="window.toggleToolList()" class="ml-auto text-xs font-bold text-slate-500 flex gap-2 items-center bg-slate-100 px-3 py-1 rounded"><i data-lucide="list"></i> Toggle List View</button>
        `;
    }

    if (document.getElementById('view-tools').getAttribute('data-view') === 'list') {
        renderDriverList(canvas);
        return;
    }

    if (mode === 'fishbone') {
        renderFishboneVisual(canvas);
    } else {
        // Fallback to simple driver visual if needed, or re-use existing charts.js logic
        // For this response, we focus on the Fishbone
        canvas.innerHTML = `<div class="text-center mt-20 text-slate-400">Driver Diagram Visual (Use List View for Editing)</div>`;
    }
}

function renderFishboneVisual(container) {
    const d = state.projectData.fishbone;
    const w = container.offsetWidth || 800;
    const h = container.offsetHeight || 500;
    
    // 1. Draw Spine & Ribs (SVG Background)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = 'absolute';
    svg.style.top = '0'; svg.style.left = '0'; svg.style.pointerEvents = 'none'; // Click through to HTML labels
    
    // Spine
    svg.innerHTML = `
        <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="#2d2e83" stroke-width="4" stroke-linecap="round"/>
        <path d="M 95% 50% L 92% 48% L 92% 52% Z" fill="#2d2e83"/>
        <line x1="20%" y1="20%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="20%" y1="80%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="70%" y1="20%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="70%" y1="80%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
    `;
    container.appendChild(svg);

    // 2. Render Moveable Labels
    const createLabel = (text, x, y, isCat, catIdx, causeIdx) => {
        const el = document.createElement('div');
        el.className = `fishbone-label ${isCat ? 'category' : ''}`;
        el.innerText = text;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        
        // Drag Logic
        el.onmousedown = (e) => {
            e.preventDefault();
            const startX = e.clientX; const startY = e.clientY;
            const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
            const parentW = container.offsetWidth; const parentH = container.offsetHeight;

            const onMove = (ev) => {
                const dx = (ev.clientX - startX) / parentW * 100;
                const dy = (ev.clientY - startY) / parentH * 100;
                el.style.left = `${startLeft + dx}%`;
                el.style.top = `${startTop + dy}%`;
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                // Save Position
                const newX = parseFloat(el.style.left);
                const newY = parseFloat(el.style.top);
                if (isCat) {
                    state.projectData.fishbone.categories[catIdx].x = newX;
                    state.projectData.fishbone.categories[catIdx].y = newY;
                } else {
                    state.projectData.fishbone.categories[catIdx].causes[causeIdx].x = newX;
                    state.projectData.fishbone.categories[catIdx].causes[causeIdx].y = newY;
                }
                window.saveData(true);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        container.appendChild(el);
    };

    // Render Categories & Causes
    d.categories.forEach((cat, i) => {
        createLabel(cat.text, cat.x || (i%2?20:70), cat.y || (i<2?20:80), true, i);
        cat.causes.forEach((cause, j) => {
            let cx = cause.x || (cat.x + (j*5)); 
            let cy = cause.y || (cat.y + (j*5));
            createLabel(typeof cause === 'string' ? cause : cause.text, cx, cy, false, i, j);
        });
    });
}

function renderDriverList(container) {
    // Shared list view for both fishbone and drivers
    container.innerHTML = `
        <div class="p-8 bg-white h-full overflow-y-auto">
            <h3 class="font-bold text-slate-800 mb-4">Edit Diagram Data</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${state.projectData.fishbone.categories.map((cat, i) => `
                <div class="bg-slate-50 p-4 rounded border border-slate-200">
                    <input class="font-bold bg-transparent border-b border-slate-300 w-full mb-2 outline-none" value="${cat.text}" onchange="window.updateFishCat(${i}, this.value)">
                    <div class="space-y-2 pl-4 border-l-2 border-slate-200">
                        ${cat.causes.map((c, j) => `
                        <div class="flex gap-2">
                            <input class="text-sm w-full p-1 border rounded" value="${typeof c === 'string' ? c : c.text}" onchange="window.updateFishCause(${i}, ${j}, this.value)">
                            <button onclick="window.removeFishCause(${i}, ${j})" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button>
                        </div>`).join('')}
                        <button onclick="window.addFishCause(${i})" class="text-xs text-sky-600 font-bold">+ Add Cause</button>
                    </div>
                </div>`).join('')}
            </div>
        </div>
    `;
}

// === PDSA TIMELINE ===
function renderPDSA() {
    const container = document.getElementById('pdsa-container');
    const isTimeline = container.getAttribute('data-view') === 'timeline';
    const d = state.projectData;

    let html = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="font-bold text-slate-800">PDSA Cycles</h3>
            <div class="flex bg-slate-100 p-1 rounded-lg">
                <button onclick="document.getElementById('pdsa-container').setAttribute('data-view', 'grid'); renderPDSA()" class="px-3 py-1 text-xs font-bold rounded ${!isTimeline?'bg-white shadow':''}">Grid</button>
                <button onclick="document.getElementById('pdsa-container').setAttribute('data-view', 'timeline'); renderPDSA()" class="px-3 py-1 text-xs font-bold rounded ${isTimeline?'bg-white shadow':''}">Timeline</button>
            </div>
        </div>
    `;

    if (isTimeline) {
        // Simple GANTT-like view for PDSA
        html += `<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-x-auto"><div class="min-w-[600px]">`;
        const sorted = [...d.pdsa].sort((a,b) => new Date(a.start) - new Date(b.start));
        sorted.forEach(p => {
            html += `
                <div class="mb-4">
                    <div class="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>${escapeHtml(p.title)}</span><span class="font-mono">${p.start} → ${p.end}</span></div>
                    <div class="h-4 bg-slate-100 rounded-full overflow-hidden relative">
                        <div class="absolute inset-y-0 left-0 bg-rcem-purple rounded-full opacity-80" style="width: 100%"></div> 
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
    } else {
        // Existing Form & Grid View (from previous step)
        html += `
            <div class="bg-white rounded-xl shadow-sm border-l-4 border-rcem-purple p-6 mb-8">
                <h4 class="font-bold text-slate-800 mb-4">Start New Cycle</h4>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <input id="pdsa-title" class="p-2 border rounded text-sm" placeholder="Title">
                    <div class="flex gap-2"><input type="date" id="pdsa-start" class="w-full p-2 border rounded text-sm"><input type="date" id="pdsa-end" class="w-full p-2 border rounded text-sm"></div>
                </div>
                <textarea id="pdsa-plan" class="w-full p-2 border rounded text-sm mb-3" rows="2" placeholder="Plan..."></textarea>
                <button onclick="window.addPDSA()" class="bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm">Create Cycle</button>
            </div>
            <div class="space-y-4">
                ${d.pdsa.map((p,i) => `
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative group">
                    <button onclick="window.deletePDSA(${i})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    <h4 class="font-bold text-slate-800">${escapeHtml(p.title)}</h4>
                    <div class="grid grid-cols-4 gap-4 mt-4 text-sm">
                        <textarea onchange="window.updatePDSA(${i}, 'desc', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Plan">${escapeHtml(p.desc)}</textarea>
                        <textarea onchange="window.updatePDSA(${i}, 'do', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Do">${escapeHtml(p.do)}</textarea>
                        <textarea onchange="window.updatePDSA(${i}, 'study', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Study">${escapeHtml(p.study)}</textarea>
                        <textarea onchange="window.updatePDSA(${i}, 'act', this.value)" class="p-2 bg-slate-50 rounded border-none resize-none h-20" placeholder="Act">${escapeHtml(p.act)}</textarea>
                    </div>
                </div>
                `).join('')}
            </div>
        `;
    }
    container.innerHTML = html;
}

// === GANTT (Dependencies & Milestones) ===
function renderGantt() {
    const c = document.getElementById('gantt-container');
    const d = state.projectData.gantt;
    // Basic visualization placeholder - a full JS Gantt lib is heavy, so we use a styled list
    c.innerHTML = `
        <div class="space-y-2">
            ${d.map(t => `
            <div class="flex items-center gap-4 bg-white p-3 rounded border border-slate-200 shadow-sm ${t.milestone ? 'border-l-4 border-l-orange-500' : ''}">
                <div class="flex-1">
                    <div class="font-bold text-sm text-slate-800 flex items-center gap-2">
                        ${t.milestone ? '<i data-lucide="diamond" class="w-3 h-3 text-orange-500"></i>' : ''} 
                        ${escapeHtml(t.name)}
                    </div>
                    <div class="text-xs text-slate-500">${t.start} -> ${t.end} ${t.dependency ? `<span class="bg-red-50 text-red-600 px-1 rounded ml-2">Dep: ${t.dependency}</span>` : ''}</div>
                </div>
                <div class="flex -space-x-2">
                    <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">${t.owner || '?'}</div>
                </div>
                <button onclick="window.deleteGantt('${t.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
            `).join('')}
        </div>
        <button onclick="window.openGanttModal()" class="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:bg-slate-50 font-bold text-sm">+ Add Task / Milestone</button>
    `;
    
    // Inject enhanced modal content
    const modal = document.getElementById('task-modal');
    if(modal) {
        modal.querySelector('.space-y-4').innerHTML = `
            <input type="text" id="task-name" class="w-full p-2 border rounded" placeholder="Task Name">
            <div class="flex gap-2"><input type="date" id="task-start" class="w-full p-2 border rounded"><input type="date" id="task-end" class="w-full p-2 border rounded"></div>
            <div class="flex gap-2 items-center">
                <input type="checkbox" id="task-milestone" class="w-4 h-4"> <label for="task-milestone" class="text-sm font-bold text-slate-600">Milestone?</label>
            </div>
            <select id="task-dep" class="w-full p-2 border rounded text-sm bg-white"><option value="">No Dependency</option>${d.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select>
            <input type="text" id="task-owner" class="w-full p-2 border rounded" placeholder="Owner Initials">
            <button onclick="window.saveGanttTask()" class="w-full bg-slate-800 text-white py-2 rounded font-bold">Save Task</button>
        `;
    }
}

// === HELPER EXPORTS ===
window.toggleToolList = () => {
    const el = document.getElementById('view-tools');
    el.setAttribute('data-view', el.getAttribute('data-view') === 'list' ? 'visual' : 'list');
    renderTools();
};
window.setToolMode = (m) => { window.toolMode = m; renderTools(); };
window.updateFishCat = (i, v) => { state.projectData.fishbone.categories[i].text = v; window.saveData(); };
window.updateFishCause = (i, j, v) => { state.projectData.fishbone.categories[i].causes[j].text = v; window.saveData(); };
window.addFishCause = (i) => { state.projectData.fishbone.categories[i].causes.push({text: "New", x: 50, y: 50}); window.saveData(); renderTools(); };
window.removeFishCause = (i, j) => { state.projectData.fishbone.categories[i].causes.splice(j, 1); window.saveData(); renderTools(); };

// Existing Logic for Checklist, Full Project, Stakeholders (List View), Data Entry (Template)
// ... (Include renderChecklist, renderStakeholders from previous step)
// ... (Include renderFullProject from previous step)
// ... (Include renderDataView from previous step)

export { renderDashboard, renderAll, renderDataView, renderPDSA, renderGantt, renderTools };
