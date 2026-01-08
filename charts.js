import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

// Global state for this module
export let toolMode = 'fishbone';       // For Diagrams (Fishbone/Driver/Process)
export let chartMode = 'run';           // For Graphs (Run/SPC/Histogram/Pareto)
let zoomLevel = 1.0;

// ==========================================
// 1. EDUCATIONAL CONTENT (The "Data Coach")
// ==========================================
const CHART_EDUCATION = {
    run: {
        title: "The Run Chart (Time Series)",
        what: "Plots your data over time with a median line.",
        when: "Use this for almost every QIP. It is the FRCEM standard for showing improvement.",
        rules: "<strong>Look for 'Shifts':</strong> 6 or more consecutive points either all above or all below the median. This proves your change made a real difference."
    },
    spc: {
        title: "SPC Control Chart (Shewhart)",
        what: "A Run Chart that adds 'Control Limits' (Sigma lines) based on mathematical variation.",
        when: "Use when you want to be rigorous about 'Common Cause' vs 'Special Cause' variation.",
        rules: "Points outside the dotted lines (Control Limits) indicate a statistically significant event (Special Cause)."
    },
    histogram: {
        title: "Frequency Histogram",
        what: "Stacks your data into 'bins' to show the shape of your process.",
        when: "Use this to check consistency. A wide, flat shape means your process is unreliable. A tall, narrow peak means it is consistent.",
        rules: "Look for 'Skew'. Are most patients treated quickly, with a long 'tail' of delays?"
    },
    pareto: {
        title: "Pareto Chart (The 80/20 Rule)",
        what: "A bar chart sorted by frequency, with a line showing cumulative percentage.",
        when: "Use this in the <strong>Diagnostic Phase</strong>. It helps you decide WHICH problem to fix.",
        rules: "Focus on the 'Vital Few' (the tall bars on the left). Fixing these solves 80% of the problem."
    }
};

// ==========================================
// 2. VIEW CONTROLS
// ==========================================

// -- Diagram Controls --
export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    const buttons = document.querySelectorAll('#tool-nav-ui button');
    buttons.forEach(b => {
        if(b.textContent.toLowerCase().includes(m)) b.className = "px-3 py-1 rounded text-sm font-bold bg-white shadow text-rcem-purple transition-all";
        else b.className = "px-3 py-1 rounded text-sm font-bold hover:bg-white/50 text-slate-500 transition-all";
    });
    renderTools();
}

export function zoomIn() { zoomLevel += 0.1; applyZoom(); }
export function zoomOut() { zoomLevel = Math.max(0.5, zoomLevel - 0.1); applyZoom(); }
export function resetZoom() { zoomLevel = 1.0; applyZoom(); }

function applyZoom() {
    const el = document.getElementById('diagram-canvas');
    if(el) el.style.transform = `scale(${zoomLevel})`;
}

// -- Graph Controls --
export function setChartMode(m) {
    chartMode = m;
    renderChart();
    updateChartEducation();
    
    const buttons = document.querySelectorAll('#chart-mode-controls button');
    buttons.forEach(b => {
        if(b.getAttribute('data-mode') === m) b.className = "px-3 py-1 rounded text-xs font-bold bg-slate-800 text-white shadow transition-all";
        else b.className = "px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all";
    });
}

export function updateChartEducation() {
    const el = document.getElementById('chart-education-content');
    if(!el) return;
    const info = CHART_EDUCATION[chartMode];
    el.innerHTML = `
        <h4 class="font-bold text-rcem-purple text-sm mb-2 flex items-center gap-2"><i data-lucide="info" class="w-4 h-4"></i> ${info.title}</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div class="bg-indigo-50 p-3 rounded border border-indigo-100"><strong>What is it?</strong><p class="mt-1">${info.what}</p></div>
            <div class="bg-emerald-50 p-3 rounded border border-emerald-100"><strong>When to use?</strong><p class="mt-1">${info.when}</p></div>
            <div class="bg-amber-50 p-3 rounded border border-amber-100"><strong>Interpretation</strong><p class="mt-1">${info.rules}</p></div>
        </div>
    `;
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 3. GRAPH ENGINES (The New "Scientific" Charts)
// ==========================================

export function renderChart(canvasId = 'mainChart') {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;
    
    if(ctx.chartInstance) ctx.chartInstance.destroy();
    
    if (chartMode === 'run') renderRunChart(ctx, canvasId);
    else if (chartMode === 'spc') renderSPCChart(ctx, canvasId);
    else if (chartMode === 'histogram') renderHistogram(ctx, canvasId);
    else if (chartMode === 'pareto') renderPareto(ctx, canvasId);
}

// --- Engine A: Run Chart ---
function renderRunChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0 && canvasId === 'mainChart') { document.getElementById('chart-ghost')?.classList.remove('hidden'); return; }
    if(canvasId === 'mainChart') document.getElementById('chart-ghost')?.classList.add('hidden');

    const sortedD = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = sortedD.map(x => x.date);
    const data = sortedD.map(x => x.value);
    
    let baselineData = data.slice(0, 12);
    let sortedBase = [...baselineData].sort((a,b)=>a-b);
    let median = sortedBase.length ? sortedBase[Math.floor(sortedBase.length/2)] : 0;

    const pointColors = data.map(() => '#2d2e83'); 
    for(let i=0; i <= data.length - 6; i++) {
        const subset = data.slice(i, i+6);
        if(subset.every(v => v > median) || subset.every(v => v < median)) {
            for(let k=0; k<6; k++) pointColors[i+k] = '#f36f21'; 
        }
    }

    const annotations = {
        medianLine: { type: 'line', yMin: median, yMax: median, borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, label: { display: true, content: `Median: ${median}`, position: 'end' } }
    };
    addPDSALines(annotations);

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: data, borderColor: '#2d2e83', backgroundColor: '#2d2e83', pointBackgroundColor: pointColors, pointRadius: 5, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations }, legend: { display: false }, title: { display: true, text: 'Run Chart' } } }
    });
    if(canvasId === 'mainChart') window.myChart = chart; else ctx.chartInstance = chart;
}

// --- Engine B: SPC Chart ---
function renderSPCChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    const sortedD = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const data = sortedD.map(x => x.value);
    
    const avg = data.reduce((a,b)=>a+b,0) / data.length;
    let mRSum = 0;
    for(let i=1; i<data.length; i++) mRSum += Math.abs(data[i] - data[i-1]);
    const avgMR = mRSum / (data.length - 1);
    
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));

    const annotations = {
        ucl: { type: 'line', yMin: ucl, yMax: ucl, borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 1, label: { display: true, content: 'UCL', position: 'start', color: '#ef4444' } },
        lcl: { type: 'line', yMin: lcl, yMax: lcl, borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 1, label: { display: true, content: 'LCL', position: 'start', color: '#ef4444' } },
        avg: { type: 'line', yMin: avg, yMax: avg, borderColor: '#22c55e', borderWidth: 2, label: { display: true, content: 'Mean', position: 'end', color: '#22c55e' } }
    };
    addPDSALines(annotations);

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedD.map(x => x.date), datasets: [{ label: 'Measure', data: data, borderColor: '#64748b', pointBackgroundColor: data.map(v => (v > ucl || v < lcl) ? '#ef4444' : '#64748b'), tension: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { annotation: { annotations }, legend: { display: false }, title: { display: true, text: 'SPC Chart (XmR)' } } }
    });
    ctx.chartInstance = chart;
}

// --- Engine C: Histogram ---
function renderHistogram(ctx, canvasId) {
    const d = state.projectData.chartData.map(x => x.value);
    if(d.length < 2) return;

    const min = Math.min(...d);
    const max = Math.max(...d);
    const bins = 5;
    const step = (max - min) / bins || 1;
    
    const buckets = new Array(bins).fill(0);
    const labels = [];
    
    for(let i=0; i<bins; i++) {
        const low = min + (i*step);
        const high = low + step;
        labels.push(`${Math.round(low)}-${Math.round(high)}`);
        buckets[i] = d.filter(v => v >= low && (i===bins-1 ? v<=high : v<high)).length;
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Frequency', data: buckets, backgroundColor: '#8b5cf6', borderColor: '#7c3aed', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Frequency Histogram' } } }
    });
    ctx.chartInstance = chart;
}

// --- Engine D: Pareto ---
function renderPareto(ctx, canvasId) {
    const d = state.projectData.chartData;
    const counts = {};
    d.forEach(x => { const cat = x.grade || "Unknown"; counts[cat] = (counts[cat] || 0) + 1; });

    const sortedCats = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
    const values = sortedCats.map(c => counts[c]);
    const total = values.reduce((a,b) => a+b, 0);
    
    let cum = 0;
    const cumulative = values.map(v => { cum += v; return (cum / total) * 100; });

    const chart = new Chart(ctx, {
        type: 'bar',
        data: { labels: sortedCats, datasets: [ { type: 'line', label: 'Cumulative %', data: cumulative, borderColor: '#f36f21', borderWidth: 2, yAxisID: 'y1' }, { type: 'bar', label: 'Frequency', data: values, backgroundColor: '#2d2e83', yAxisID: 'y' } ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Pareto Analysis' } }, scales: { y: { beginAtZero: true, position: 'left' }, y1: { beginAtZero: true, position: 'right', max: 100, grid: { drawOnChartArea: false } } } }
    });
    ctx.chartInstance = chart;
}

// ==========================================
// 4. DIAGRAM ENGINES (Fishbone / Driver)
// ==========================================

export async function renderTools(targetId = 'diagram-canvas', overrideMode = null) {
    if(!state.projectData) return;
    const canvas = document.getElementById(targetId);
    if (!canvas) return;

    const mode = overrideMode || toolMode;
    const viewMode = document.getElementById('view-tools') ? document.getElementById('view-tools').getAttribute('data-view') : 'visual';

    // List View Handler
    if(viewMode === 'list' && targetId === 'diagram-canvas') {
        renderDriverList(canvas, mode);
        return;
    }

    // Visual View Handler
    canvas.innerHTML = ''; 
    const ghost = document.getElementById('diagram-ghost');
    
    if (mode === 'fishbone') {
        if(ghost) ghost.classList.add('hidden');
        renderFishboneVisual(canvas, targetId === 'diagram-canvas');
    } 
    else if (mode === 'driver') {
        if (state.projectData.drivers.primary.length === 0 && targetId === 'diagram-canvas') {
            if(ghost) ghost.classList.remove('hidden');
        } else {
            if(ghost) ghost.classList.add('hidden');
            renderDriverVisual(canvas, targetId === 'diagram-canvas');
        }
    } 
    else if (mode === 'process') {
        if(ghost) ghost.classList.add('hidden');
        renderProcessVisual(canvas, targetId === 'diagram-canvas');
    }
}

function renderFishboneVisual(container, showEditBtn = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; svg.style.top = '0'; svg.style.left = '0'; svg.style.pointerEvents = 'none';
    svg.innerHTML = `
        <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="#2d2e83" stroke-width="4" stroke-linecap="round"/>
        <path d="M 95% 50% L 92% 48% L 92% 52% Z" fill="#2d2e83"/>
        <line x1="20%" y1="20%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="20%" y1="80%" x2="30%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="70%" y1="20%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
        <line x1="70%" y1="80%" x2="60%" y2="50%" stroke="#cbd5e1" stroke-width="2"/>
    `;
    container.appendChild(svg);

    const createLabel = (text, x, y, isCat, catIdx, causeIdx) => {
        const el = document.createElement('div');
        el.className = `fishbone-label ${isCat ? 'category' : ''}`;
        el.innerText = text;
        el.style.left = `${x}%`; el.style.top = `${y}%`;
        
        if(!state.isReadOnly && showEditBtn) {
            el.onmousedown = (e) => {
                e.preventDefault();
                const startX = e.clientX; const startY = e.clientY;
                const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
                const parentW = container.offsetWidth || 1000; const parentH = container.offsetHeight || 600;

                const onMove = (ev) => {
                    const dx = (ev.clientX - startX) / parentW * 100;
                    const dy = (ev.clientY - startY) / parentH * 100;
                    el.style.left = `${startLeft + dx}%`; el.style.top = `${startTop + dy}%`;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
                    const newX = parseFloat(el.style.left); const newY = parseFloat(el.style.top);
                    if (isCat) { 
                        state.projectData.fishbone.categories[catIdx].x = newX; 
                        state.projectData.fishbone.categories[catIdx].y = newY; 
                    } else { 
                        state.projectData.fishbone.categories[catIdx].causes[causeIdx].x = newX; 
                        state.projectData.fishbone.categories[catIdx].causes[causeIdx].y = newY; 
                    }
                    window.saveData(true);
                };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            };
            el.ondblclick = (e) => { e.stopPropagation(); if(isCat) window.addCauseWithWhys(catIdx); };
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

    if(showEditBtn) addEditOverlay(container);
}

function renderDriverVisual(container, showEditBtn = false) {
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
    if(showEditBtn) addEditOverlay(container, "Edit Data");
    try { mermaid.run({ nodes: [wrapper] }); } catch(e) { console.error("Mermaid error", e); }
}

function renderProcessVisual(container, showEditBtn = false) {
    const p = state.projectData.process || ["Start", "End"];
    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    let mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid w-full h-full flex items-center justify-center text-sm';
    wrapper.textContent = mCode;
    container.appendChild(wrapper);
    if(showEditBtn) addEditOverlay(container, "Edit Steps");
    try { mermaid.run({ nodes: [wrapper] }); } catch(e) { console.error(e); }
}

function renderDriverList(container, mode) {
    // List rendering logic (reused from previous steps)
    if (mode === 'driver') {
        const d = state.projectData.drivers;
        container.innerHTML = `<div class="p-8 bg-white h-full overflow-y-auto"><h3 class="font-bold text-slate-800 mb-4 flex justify-between">Edit Driver Diagram Data <button onclick="window.toggleToolList()" class="text-xs bg-slate-100 px-2 py-1 rounded">Switch to Visual</button></h3><div class="grid grid-cols-1 md:grid-cols-3 gap-6">` +
        ['primary', 'secondary', 'changes'].map(type => `<div class="space-y-3"><h4 class="text-xs font-bold uppercase text-rcem-purple border-b pb-1">${type}</h4>${d[type].map((x,i)=>`<div class="flex gap-2"><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.drivers.${type}[${i}]=this.value;window.saveData()"><button onclick="state.projectData.drivers.${type}.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addDriver('${type}')" class="text-xs text-sky-600 font-bold">+ Add</button></div>`).join('') + `</div></div>`;
    } else if (mode === 'process') {
        const p = state.projectData.process;
        container.innerHTML = `<div class="p-8 bg-white h-full overflow-y-auto"><h3 class="font-bold text-slate-800 mb-4 flex justify-between">Edit Process <button onclick="window.toggleToolList()" class="text-xs bg-slate-100 px-2 py-1 rounded">Switch to Visual</button></h3><div class="max-w-md space-y-2">${p.map((x,i) => `<div class="flex gap-2 items-center"><span class="text-xs font-mono text-slate-400 w-6">${i+1}.</span><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.process[${i}]=this.value;window.saveData()"><button onclick="state.projectData.process.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<div class="flex gap-2 mt-4"><button onclick="window.addStep()" class="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold">+ Add Step</button><button onclick="window.resetProcess()" class="text-red-500 text-xs font-bold ml-auto">Reset</button></div></div></div>`;
    } else {
        container.innerHTML = `<div class="p-8 bg-white h-full overflow-y-auto"><h3 class="font-bold text-slate-800 mb-4 flex justify-between">Edit Fishbone <button onclick="window.toggleToolList()" class="text-xs bg-slate-100 px-2 py-1 rounded">Switch to Visual</button></h3><div class="grid grid-cols-1 md:grid-cols-2 gap-8">${state.projectData.fishbone.categories.map((cat, i) => `<div class="bg-slate-50 p-4 rounded border border-slate-200"><input class="font-bold bg-transparent border-b border-slate-300 w-full mb-2 outline-none text-rcem-purple" value="${cat.text}" onchange="window.updateFishCat(${i}, this.value)"><div class="space-y-2 pl-4 border-l-2 border-slate-200">${cat.causes.map((c, j) => `<div class="flex gap-2"><input class="text-sm w-full p-1 border rounded bg-white" value="${typeof c === 'string' ? c : c.text}" onchange="window.updateFishCause(${i}, ${j}, this.value)"><button onclick="window.removeFishCause(${i}, ${j})" class="text-red-400 hover:bg-red-50 p-1 rounded"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addFishCause(${i})" class="text-xs text-sky-600 font-bold mt-2 flex items-center gap-1 hover:underline"><i data-lucide="plus" class="w-3 h-3"></i> Add Cause</button></div></div>`).join('')}</div></div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === HELPERS ===
function addEditOverlay(container, text="Edit Data") {
    const editBtn = document.createElement('button');
    editBtn.className = "absolute top-4 right-4 bg-white/90 text-slate-600 px-3 py-1 rounded shadow text-xs font-bold border border-slate-300 hover:text-rcem-purple z-20 transition-all";
    editBtn.innerHTML = `<i data-lucide="edit-3" class="w-3 h-3 inline mr-1"></i> ${text}`;
    editBtn.onclick = () => window.toggleToolList();
    container.appendChild(editBtn);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function addPDSALines(annotations) {
    const settings = state.projectData.chartSettings || { showAnnotations: true };
    if(settings.showAnnotations) {
        state.projectData.pdsa.forEach((p, i) => {
            annotations[`pdsa_${i}`] = { 
                type: 'line', xMin: p.start, xMax: p.start, 
                borderColor: '#f36f21', borderWidth: 2, borderDash: [2,2],
                label: { display: true, content: p.title, position: 'start', backgroundColor: 'rgba(243, 111, 33, 0.8)', color: 'white', font: {size: 10} } 
            };
        });
    }
}

// === EXPORT HELPERS (Data Manipulation) ===
export function addDataPoint() {
    const d = document.getElementById('chart-date').value;
    const v = document.getElementById('chart-value').value;
    const g = document.getElementById('chart-grade').value;
    const cat = document.getElementById('chart-cat')?.value || 'outcome';
    
    if(!d || !v) { showToast("Date and Value required", "error"); return; }
    
    state.projectData.chartData.push({ date: d, value: parseFloat(v), grade: g, category: cat });
    state.projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    document.getElementById('chart-value').value = '';
    window.saveData();
    if(window.renderDataView) window.renderDataView();
    showToast("Data point added", "success");
}

export function deleteDataPoint(date) {
    if(confirm('Delete this point?')) {
        const idx = state.projectData.chartData.findIndex(x => x.date === date);
        if(idx > -1) { 
            state.projectData.chartData.splice(idx, 1); 
            window.saveData(); 
            if(window.renderDataView) window.renderDataView();
            showToast("Point deleted", "info");
        }
    }
}

export function downloadCSVTemplate() {
    const csv = "data:text/csv;charset=utf-8,Date,Value,Grade,Type\n2026-01-01,120,Registrar,outcome\n2026-01-02,110,Nurse,process";
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "qip_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Template downloaded", "success");
}

export function addCauseWithWhys(catIdx) {
    if(state.isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    if (confirm(`Do you want to drill down into "${cause}" using the 5 Whys technique?`)) {
        let root = cause;
        for (let i = 1; i <= 5; i++) {
            let deeper = prompt(`Why does "${root}" happen? (Why #${i})`);
            if (!deeper) break;
            root = deeper;
        }
        if (root !== cause && confirm(`Root cause found: "${root}". Add this instead of "${cause}"?`)) cause = root;
    }
    const cat = state.projectData.fishbone.categories[catIdx];
    cat.causes.push({ text: cause, x: cat.x + 5, y: cat.y + 5 });
    window.saveData();
    renderTools();
}

export function addDriver(type) {
    if(state.isReadOnly) return;
    const v = prompt(`Add ${type} Driver:`);
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

export function renderFullViewChart() { renderChart('fullProjectChart'); }
