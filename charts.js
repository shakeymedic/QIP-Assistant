import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

export let toolMode = 'fishbone';
export let chartMode = 'run'; 
let zoomLevel = 1.0;

// HELP CONTENT
const TOOL_HELP = {
    fishbone: {
        title: "Fishbone Diagram",
        desc: "Identify root causes of a problem.",
        tips: "Double-click a category to add a cause. Drag causes to arrange them. Use '5 Whys'."
    },
    driver: {
        title: "Driver Diagram",
        desc: "Map your Aim to Drivers and Change Ideas.",
        tips: "Primary Drivers are high-level factors. Secondary are actionable. Change Ideas are specific interventions."
    },
    process: {
        title: "Process Map",
        desc: "Visualize the patient journey.",
        tips: "Map the 'As Is' process. Identify bottlenecks and waste."
    }
};

// ==========================================
// 1. TOOL & TAB MANAGEMENT
// ==========================================

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    renderTools();
}

export function toggleToolHelp() {
    const p = document.getElementById('tool-help-panel');
    if(p) p.classList.toggle('hidden');
}

export async function renderTools(targetId = 'diagram-canvas', overrideMode = null) {
    if(!state.projectData) return;
    const canvas = document.getElementById(targetId);
    if (!canvas) return;

    // 1. Render Tabs (Only if we are in the main view)
    if (targetId === 'diagram-canvas') {
        renderToolUI();
    }

    const mode = overrideMode || toolMode;
    canvas.innerHTML = ''; 
    
    if (mode === 'fishbone') {
        renderFishboneVisual(canvas, targetId === 'diagram-canvas');
    } 
    else if (mode === 'driver') {
        renderDriverVisual(canvas, targetId === 'diagram-canvas');
    }
    else if (mode === 'process') {
        renderProcessVisual(canvas, targetId === 'diagram-canvas');
    }
}

function renderToolUI() {
    const header = document.querySelector('#view-tools header');
    if(!header) return;

    const isActive = (m) => toolMode === m ? 'bg-rcem-purple text-white shadow' : 'text-slate-500 hover:bg-slate-50';
    
    header.innerHTML = `
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button onclick="window.setToolMode('fishbone')" class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('fishbone')}">Fishbone</button>
            <button onclick="window.setToolMode('driver')" class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('driver')}">Driver Diagram</button>
            <button onclick="window.setToolMode('process')" class="px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('process')}">Process Map</button>
        </div>
        <div class="ml-auto flex items-center gap-2">
            <button onclick="window.toggleToolHelp()" class="text-xs font-bold text-slate-500 flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200"><i data-lucide="help-circle" class="w-4 h-4"></i> Guide</button>
        </div>
    `;

    // Inject Help Panel if missing
    let helpPanel = document.getElementById('tool-help-panel');
    if(!helpPanel) {
        helpPanel = document.createElement('div');
        helpPanel.id = 'tool-help-panel';
        helpPanel.className = 'absolute top-4 right-4 w-64 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-30 hidden';
        document.getElementById('view-tools').querySelector('.relative').appendChild(helpPanel);
    }
    
    const info = TOOL_HELP[toolMode];
    helpPanel.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h4 class="font-bold text-slate-800">${info.title}</h4>
            <button onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-slate-800"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
        <p class="text-xs text-slate-600 mb-3">${info.desc}</p>
        <div class="bg-indigo-50 p-2 rounded text-[10px] text-indigo-800 font-medium">
            <strong>Tip:</strong> ${info.tips}
        </div>
    `;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 2. INTERACTIVE DIAGRAMS
// ==========================================

// Generic Drag Handler
export function makeDraggable(el, container, isCat, catIdx, causeIdx, onEndCallback) {
    if(state.isReadOnly) return;

    const handleMove = (clientX, clientY, startLeft, startTop, startX, startY) => {
        const parentW = container.offsetWidth || 1000;
        const parentH = container.offsetHeight || 600;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        const newLeft = startLeft + (deltaX / parentW * 100);
        const newTop = startTop + (deltaY / parentH * 100);

        el.style.left = `${newLeft}%`;
        el.style.top = `${newTop}%`;
    };

    const handleEnd = () => {
        const newX = parseFloat(el.style.left);
        const newY = parseFloat(el.style.top);
        if (onEndCallback) {
            onEndCallback(newX, newY);
        } else {
            // Fishbone default save
            if (isCat) { 
                state.projectData.fishbone.categories[catIdx].x = newX; 
                state.projectData.fishbone.categories[catIdx].y = newY; 
            } else { 
                state.projectData.fishbone.categories[catIdx].causes[causeIdx].x = newX; 
                state.projectData.fishbone.categories[catIdx].causes[causeIdx].y = newY; 
            }
            window.saveData(true);
        }
    };

    // Mouse
    el.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        const startX = e.clientX; const startY = e.clientY;
        const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
        const onMove = (ev) => handleMove(ev.clientX, ev.clientY, startLeft, startTop, startX, startY);
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); handleEnd(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    };

    // Touch
    el.ontouchstart = (e) => {
        if(e.touches.length > 1) return;
        e.preventDefault(); e.stopPropagation();
        const touch = e.touches[0];
        const startX = touch.clientX; const startY = touch.clientY;
        const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
        const onTouchMove = (ev) => handleMove(ev.touches[0].clientX, ev.touches[0].clientY, startLeft, startTop, startX, startY);
        const onTouchEnd = () => { document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('touchend', onTouchEnd); handleEnd(); };
        document.addEventListener('touchmove', onTouchMove, {passive: false}); document.addEventListener('touchend', onTouchEnd);
    };
}

function renderFishboneVisual(container, enableInteraction = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; svg.style.top = '0'; svg.style.left = '0'; svg.style.pointerEvents = 'none';
    svg.innerHTML = `<line x1="5%" y1="50%" x2="95%" y2="50%" stroke="#2d2e83" stroke-width="4" stroke-linecap="round"/><path d="M 95% 50% L 92% 48% L 92% 52% Z" fill="#2d2e83"/><line x1="20%" y1="20%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="20%" y1="80%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="70%" y1="20%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/><line x1="70%" y1="80%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>`;
    container.appendChild(svg);

    const createLabel = (text, x, y, isCat, catIdx, causeIdx) => {
        const el = document.createElement('div');
        el.className = `fishbone-label ${isCat ? 'category' : ''}`;
        el.innerText = text;
        el.style.left = `${x}%`; el.style.top = `${y}%`;
        
        if(!state.isReadOnly && enableInteraction) {
            makeDraggable(el, container, isCat, catIdx, causeIdx); 
            el.ondblclick = (e) => { 
                e.stopPropagation(); 
                if(isCat) window.addCauseWithWhys(catIdx); 
                else {
                    const newText = prompt("Edit Cause:", text);
                    if(newText) {
                         state.projectData.fishbone.categories[catIdx].causes[causeIdx].text = newText;
                         window.saveData();
                         renderTools();
                    }
                }
            };
        }
        container.appendChild(el);
    };

    state.projectData.fishbone.categories.forEach((cat, i) => {
        createLabel(cat.text, cat.x || (i%2?20:70), cat.y || (i<2?20:80), true, i);
        cat.causes.forEach((cause, j) => {
            let cx = cause.x || (cat.x + (j*5)); let cy = cause.y || (cat.y + (j*5));
            createLabel(typeof cause === 'string' ? cause : cause.text, cx, cy, false, i, j);
        });
    });
}

function renderDriverVisual(container, enableInteraction = false) {
    const d = state.projectData.drivers;
    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    
    let mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
    d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
    d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
    d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid w-full h-full flex items-center justify-center text-sm';
    wrapper.textContent = mCode;
    container.appendChild(wrapper);
    
    try { mermaid.run({ nodes: [wrapper] }); } catch(e) { console.error(e); }

    // Editor Overlay
    if (enableInteraction) {
        const overlay = document.createElement('div');
        overlay.className = "absolute top-0 right-0 w-64 h-full bg-white/95 border-l border-slate-200 shadow-lg flex flex-col p-4 overflow-y-auto";
        overlay.innerHTML = `
            <h4 class="font-bold text-slate-800 text-sm mb-4">Edit Diagram</h4>
            
            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Primary Drivers</div>
                ${d.primary.map((x,i) => `<div class="flex gap-1 mb-1"><input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.primary[${i}]=this.value;window.saveData();renderTools()"><button onclick="state.projectData.drivers.primary.splice(${i},1);window.saveData();renderTools()" class="text-red-500 hover:bg-red-50 p-1"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}
                <button onclick="window.addDriver('primary')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Primary</button>
            </div>
            
            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Secondary Drivers</div>
                ${d.secondary.map((x,i) => `<div class="flex gap-1 mb-1"><input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.secondary[${i}]=this.value;window.saveData();renderTools()"><button onclick="state.projectData.drivers.secondary.splice(${i},1);window.saveData();renderTools()" class="text-red-500 hover:bg-red-50 p-1"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}
                <button onclick="window.addDriver('secondary')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Secondary</button>
            </div>

            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Change Ideas</div>
                ${d.changes.map((x,i) => `<div class="flex gap-1 mb-1"><input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.changes[${i}]=this.value;window.saveData();renderTools()"><button onclick="state.projectData.drivers.changes.splice(${i},1);window.saveData();renderTools()" class="text-red-500 hover:bg-red-50 p-1"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}
                <button onclick="window.addDriver('changes')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Change Idea</button>
            </div>
        `;
        container.appendChild(overlay);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function renderProcessVisual(container, enableInteraction = false) {
    const p = state.projectData.process || ["Start", "End"];
    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    let mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid w-full h-full flex items-center justify-center text-sm';
    wrapper.textContent = mCode;
    container.appendChild(wrapper);
    
    if (enableInteraction) {
         const overlay = document.createElement('div');
         overlay.className = "absolute top-0 right-0 w-64 h-full bg-white/95 border-l border-slate-200 shadow-lg flex flex-col p-4 overflow-y-auto";
         overlay.innerHTML = `
            <h4 class="font-bold text-slate-800 text-sm mb-4">Edit Process</h4>
            ${p.map((x,i) => `<div class="flex gap-1 mb-1"><span class="text-xs w-4">${i+1}.</span><input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.process[${i}]=this.value;window.saveData();renderTools()"><button onclick="state.projectData.process.splice(${i},1);window.saveData();renderTools()" class="text-red-500 hover:bg-red-50 p-1"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}
            <div class="flex gap-2 mt-2">
                <button onclick="window.addStep()" class="text-xs bg-slate-800 text-white px-2 py-1 rounded">+ Add</button>
                <button onclick="window.resetProcess()" class="text-xs text-red-500">Reset</button>
            </div>
         `;
         container.appendChild(overlay);
    }
    
    try { mermaid.run({ nodes: [wrapper] }); } catch(e) { console.error(e); }
}

// === EXPORTS & HELPERS ===
export function addCauseWithWhys(catIdx) {
    if(state.isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    const cat = state.projectData.fishbone.categories[catIdx];
    cat.causes.push({ text: cause, x: cat.x + 5, y: cat.y + 5 });
    window.saveData();
    renderTools();
}

export function addDriver(type) {
    if(state.isReadOnly) return;
    const v = prompt(`Add ${type}:`);
    if(v) { state.projectData.drivers[type].push(v); window.saveData(); renderTools(); }
}

export function addStep() {
    if(state.isReadOnly) return;
    const v = prompt("Step Description:");
    if(v) { 
        if(!state.projectData.process) state.projectData.process = ["Start", "End"];
        state.projectData.process.splice(state.projectData.process.length-1, 0, v);
        window.saveData(); renderTools(); 
    }
}

export function resetProcess() {
    if(confirm("Reset process map?")) { state.projectData.process = ["Start", "End"]; window.saveData(); renderTools(); }
}

// Chart Renderers (Run/SPC)
export function renderChart(canvasId = 'mainChart') {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;
    if(ctx.chartInstance) ctx.chartInstance.destroy();
    
    if (chartMode === 'run') renderRunChart(ctx, canvasId);
    else if (chartMode === 'spc') renderSPCChart(ctx, canvasId);
    else if (chartMode === 'histogram') renderHistogram(ctx, canvasId);
    else if (chartMode === 'pareto') renderPareto(ctx, canvasId);
}

function renderRunChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0 && canvasId === 'mainChart') return;
    const sortedD = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = sortedD.map(x => x.date);
    const data = sortedD.map(x => x.value);
    let baselineData = data.slice(0, 12);
    let sortedBase = [...baselineData].sort((a,b)=>a-b);
    let median = sortedBase.length ? sortedBase[Math.floor(sortedBase.length/2)] : 0;

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: data, borderColor: '#2d2e83', backgroundColor: '#2d2e83', tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations: { medianLine: { type: 'line', yMin: median, yMax: median, borderColor: '#94a3b8', borderDash: [5, 5] } } } } }
    });
    ctx.chartInstance = chart;
}

function renderSPCChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    const sortedD = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const data = sortedD.map(x => x.value);
    const avg = data.reduce((a,b)=>a+b,0) / data.length;
    let mRSum = 0; for(let i=1; i<data.length; i++) mRSum += Math.abs(data[i] - data[i-1]);
    const avgMR = mRSum / (data.length - 1);
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedD.map(x => x.date), datasets: [{ label: 'Measure', data: data, borderColor: '#64748b', pointBackgroundColor: data.map(v => (v > ucl || v < lcl) ? '#ef4444' : '#64748b'), tension: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations: { ucl: { type: 'line', yMin: ucl, yMax: ucl, borderColor: '#ef4444', borderDash: [2, 2] }, lcl: { type: 'line', yMin: lcl, yMax: lcl, borderColor: '#ef4444', borderDash: [2, 2] }, avg: { type: 'line', yMin: avg, yMax: avg, borderColor: '#22c55e' } } } } }
    });
    ctx.chartInstance = chart;
}

function renderHistogram(ctx, canvasId) {
    const d = state.projectData.chartData.map(x => x.value);
    if(d.length < 2) return;
    const min = Math.min(...d); const max = Math.max(...d);
    const bins = 5; const step = (max - min) / bins || 1;
    const buckets = new Array(bins).fill(0); const labels = [];
    for(let i=0; i<bins; i++) {
        const low = min + (i*step); const high = low + step;
        labels.push(`${Math.round(low)}-${Math.round(high)}`);
        buckets[i] = d.filter(v => v >= low && (i===bins-1 ? v<=high : v<high)).length;
    }
    const chart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Frequency', data: buckets, backgroundColor: '#8b5cf6' }] }, options: { responsive: true, maintainAspectRatio: false } });
    ctx.chartInstance = chart;
}

function renderPareto(ctx, canvasId) {
    const d = state.projectData.chartData;
    const counts = {}; d.forEach(x => { const cat = x.grade || "Unknown"; counts[cat] = (counts[cat] || 0) + 1; });
    const sortedCats = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
    const values = sortedCats.map(c => counts[c]);
    const total = values.reduce((a,b) => a+b, 0);
    let cum = 0; const cumulative = values.map(v => { cum += v; return (cum / total) * 100; });

    const chart = new Chart(ctx, { type: 'bar', data: { labels: sortedCats, datasets: [ { type: 'line', label: 'Cumulative %', data: cumulative, borderColor: '#f36f21', yAxisID: 'y1' }, { type: 'bar', label: 'Frequency', data: values, backgroundColor: '#2d2e83', yAxisID: 'y' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y1: { position: 'right', max: 100 } } } });
    ctx.chartInstance = chart;
}

export function setChartMode(m) { chartMode = m; renderChart(); }
export function renderFullViewChart() { renderChart('full-view-chart-container'); }
export function addDataPoint() {
    const d = document.getElementById('chart-date').value;
    const v = document.getElementById('chart-value').value;
    const g = document.getElementById('chart-grade').value;
    if(!d || !v) { showToast("Date and Value required", "error"); return; }
    state.projectData.chartData.push({ date: d, value: parseFloat(v), grade: g });
    state.projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
    document.getElementById('chart-value').value = '';
    window.saveData();
    if(window.renderDataView) window.renderDataView();
    showToast("Data point added", "success");
}
export function deleteDataPoint(date) {
    if(confirm('Delete?')) {
        const idx = state.projectData.chartData.findIndex(x => x.date === date);
        if(idx > -1) { state.projectData.chartData.splice(idx, 1); window.saveData(); if(window.renderDataView) window.renderDataView(); }
    }
}
export function downloadCSVTemplate() {
    const csv = "data:text/csv;charset=utf-8,Date,Value,Grade\n2026-01-01,120,A\n2026-01-02,110,B";
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "qip_template.csv");
    document.body.appendChild(link);
    link.click();
}
