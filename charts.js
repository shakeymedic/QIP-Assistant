import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

export let toolMode = 'fishbone';
let zoomLevel = 1.0;

// === VIEW CONTROLS ===
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

// === MAIN TOOL RENDERER ===
export async function renderTools(targetId = 'diagram-canvas', overrideMode = null) {
    if(!state.projectData) return;
    const canvas = document.getElementById(targetId);
    if (!canvas) return;

    // Determine Mode
    const mode = overrideMode || toolMode;
    const viewMode = document.getElementById('view-tools') ? document.getElementById('view-tools').getAttribute('data-view') : 'visual';

    // 1. LIST VIEW RENDERER (Only for main view)
    if(viewMode === 'list' && targetId === 'diagram-canvas') {
        renderDriverList(canvas, mode);
        return;
    }

    // 2. VISUAL RENDERER
    canvas.innerHTML = ''; 
    const ghost = document.getElementById('diagram-ghost');
    
    if (mode === 'fishbone') {
        if(ghost) ghost.classList.add('hidden');
        renderFishboneVisual(canvas);
    } 
    else if (mode === 'driver') {
        if (state.projectData.drivers.primary.length === 0 && targetId === 'diagram-canvas') {
            if(ghost) ghost.classList.remove('hidden');
        } else {
            if(ghost) ghost.classList.add('hidden');
            renderDriverVisual(canvas, targetId === 'diagram-canvas'); // Pass flag to show edit button
        }
    } 
    else if (mode === 'process') {
        if(ghost) ghost.classList.add('hidden');
        renderProcessVisual(canvas, targetId === 'diagram-canvas');
    }
}

// === VISUALIZATION ENGINES ===

function renderFishboneVisual(container) {
    // Draw SVG Spine
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
        
        if(!state.isReadOnly && container.id === 'diagram-canvas') {
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
            el.ondblclick = (e) => {
                e.stopPropagation();
                if(isCat) window.addCauseWithWhys(catIdx);
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
    
    if(showEditBtn) {
        const editBtn = document.createElement('button');
        editBtn.className = "absolute top-4 right-4 bg-white/90 text-slate-600 px-3 py-1 rounded shadow text-xs font-bold border border-slate-300 hover:text-rcem-purple z-20 transition-all";
        editBtn.innerHTML = `<i data-lucide="edit-3" class="w-3 h-3 inline mr-1"></i> Edit Data`;
        editBtn.onclick = () => window.toggleToolList();
        container.appendChild(editBtn);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }

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

    if(showEditBtn) {
        const editBtn = document.createElement('button');
        editBtn.className = "absolute top-4 right-4 bg-white/90 text-slate-600 px-3 py-1 rounded shadow text-xs font-bold border border-slate-300 hover:text-rcem-purple z-20 transition-all";
        editBtn.innerHTML = `<i data-lucide="edit-3" class="w-3 h-3 inline mr-1"></i> Edit Steps`;
        editBtn.onclick = () => window.toggleToolList();
        container.appendChild(editBtn);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }

    try { mermaid.run({ nodes: [wrapper] }); } catch(e) { console.error(e); }
}

function renderDriverList(container, mode) {
    if (mode === 'driver') {
        const d = state.projectData.drivers;
        container.innerHTML = `
        <div class="p-8 bg-white h-full overflow-y-auto">
            <h3 class="font-bold text-slate-800 mb-4 flex justify-between">Edit Driver Diagram Data <button onclick="window.toggleToolList()" class="text-xs bg-slate-100 px-2 py-1 rounded">Switch to Visual</button></h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="space-y-3"><h4 class="text-xs font-bold uppercase text-rcem-purple border-b pb-1">Primary Drivers</h4>${d.primary.map((x,i)=>`<div class="flex gap-2"><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.drivers.primary[${i}]=this.value;window.saveData()"><button onclick="state.projectData.drivers.primary.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addDriver('primary')" class="text-xs text-sky-600 font-bold">+ Add Primary</button></div>
                <div class="space-y-3"><h4 class="text-xs font-bold uppercase text-rcem-purple border-b pb-1">Secondary Drivers</h4>${d.secondary.map((x,i)=>`<div class="flex gap-2"><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.drivers.secondary[${i}]=this.value;window.saveData()"><button onclick="state.projectData.drivers.secondary.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addDriver('secondary')" class="text-xs text-sky-600 font-bold">+ Add Secondary</button></div>
                <div class="space-y-3"><h4 class="text-xs font-bold uppercase text-rcem-purple border-b pb-1">Change Ideas</h4>${d.changes.map((x,i)=>`<div class="flex gap-2"><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.drivers.changes[${i}]=this.value;window.saveData()"><button onclick="state.projectData.drivers.changes.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}<button onclick="window.addDriver('changes')" class="text-xs text-sky-600 font-bold">+ Add Idea</button></div>
            </div>
        </div>`;
    } else if (mode === 'process') {
        const p = state.projectData.process;
        container.innerHTML = `
        <div class="p-8 bg-white h-full overflow-y-auto">
             <h3 class="font-bold text-slate-800 mb-4 flex justify-between">Edit Process Steps <button onclick="window.toggleToolList()" class="text-xs bg-slate-100 px-2 py-1 rounded">Switch to Visual</button></h3>
             <div class="max-w-md space-y-2">
                ${p.map((x,i) => `<div class="flex gap-2 items-center"><span class="text-xs font-mono text-slate-400 w-6">${i+1}.</span><input class="w-full p-2 border rounded text-sm" value="${x}" onchange="state.projectData.process[${i}]=this.value;window.saveData()"><button onclick="state.projectData.process.splice(${i},1);window.saveData();renderTools()" class="text-red-400"><i data-lucide="x" class="w-3 h-3"></i></button></div>`).join('')}
                <div class="flex gap-2 mt-4">
                    <button onclick="window.addStep()" class="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold">+ Add Step</button>
                    <button onclick="window.resetProcess()" class="text-red-500 text-xs font-bold ml-auto">Reset</button>
                </div>
             </div>
        </div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// === CHART SETTINGS ===
export function openChartSettings() {
    const s = state.projectData.chartSettings || { title: 'Run Chart', yAxis: 'Measure', showAnnotations: true };
    document.getElementById('chart-setting-title').value = s.title;
    document.getElementById('chart-setting-yaxis').value = s.yAxis;
    document.getElementById('chart-setting-annotations').checked = s.showAnnotations;
    document.getElementById('chart-settings-modal').classList.remove('hidden');
}

export function saveChartSettings() {
    state.projectData.chartSettings = {
        title: document.getElementById('chart-setting-title').value,
        yAxis: document.getElementById('chart-setting-yaxis').value,
        showAnnotations: document.getElementById('chart-setting-annotations').checked
    };
    window.saveData();
    document.getElementById('chart-settings-modal').classList.add('hidden');
    renderChart();
    showToast("Settings saved", "success");
}

export function copyChartImage() {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    canvas.toBlob(blob => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(() => showToast("Chart copied to clipboard!", "success"))
            .catch(() => showToast("Failed to copy image.", "error"));
    });
}

// === CHARTING ENGINE ===
export function renderChart(canvasId = 'mainChart') {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;
    
    // Clear existing chart instance if it exists
    if(ctx.chartInstance) ctx.chartInstance.destroy(); // Attach instance to element to track it
    
    const d = state.projectData.chartData;
    if(d.length === 0 && canvasId === 'mainChart') {
        document.getElementById('chart-ghost')?.classList.remove('hidden');
        return;
    }
    if(canvasId === 'mainChart') document.getElementById('chart-ghost')?.classList.add('hidden');

    const sortedD = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = sortedD.map(x => x.date);
    const data = sortedD.map(x => x.value);
    
    const settings = state.projectData.chartSettings || { title: 'Run Chart', yAxis: 'Measure', showAnnotations: true };

    let baselineData = data.slice(0, 12);
    let mean = baselineData.length ? baselineData.reduce((a,b)=>a+b,0)/baselineData.length : 0;

    // SPC RULE DETECTION
    const pointColors = data.map(() => '#2d2e83'); 
    const pointRadii = data.map(() => 5);

    // Rule 1: Shift
    for(let i=0; i <= data.length - 6; i++) {
        const subset = data.slice(i, i+6);
        if(subset.every(v => v > mean) || subset.every(v => v < mean)) {
            for(let k=0; k<6; k++) pointColors[i+k] = '#f36f21'; 
        }
    }

    // Rule 2: Trend
    for(let i=0; i <= data.length - 5; i++) {
        const subset = data.slice(i, i+5);
        let increasing = true, decreasing = true;
        for(let k=0; k < 4; k++) {
            if(subset[k+1] <= subset[k]) increasing = false;
            if(subset[k+1] >= subset[k]) decreasing = false;
        }
        if(increasing || decreasing) {
             for(let k=0; k<5; k++) pointColors[i+k] = '#3b82f6'; 
        }
    }

    const annotations = {
        meanLine: { type: 'line', yMin: mean, yMax: mean, borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, label: { display: true, content: `Baseline Mean: ${mean.toFixed(1)}`, position: 'end' } }
    };
    
    if(settings.showAnnotations) {
        const pdsaDates = state.projectData.pdsa.map(p => ({ date: p.start, title: p.title }));
        pdsaDates.forEach((p, i) => {
            annotations[`pdsa_${i}`] = { type: 'line', xMin: p.date, xMax: p.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: p.title, backgroundColor: '#f36f21', color: 'white', position: 'start' } };
        });
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: settings.yAxis,
                data: data,
                borderColor: '#2d2e83',
                backgroundColor: '#2d2e83',
                pointBackgroundColor: pointColors,
                pointBorderColor: pointColors,
                tension: 0.1,
                pointRadius: pointRadii,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                annotation: { annotations },
                title: { display: true, text: settings.title, font: { size: 16 } },
                legend: { display: false }
            },
            scales: {
                y: { title: { display: true, text: settings.yAxis } }
            }
        }
    });

    if(canvasId === 'mainChart') window.myChart = chart;
    else ctx.chartInstance = chart; // Store instance for cleanup
}

export function renderFullViewChart() {
    renderChart('fullProjectChart');
}

// === DATA HELPERS ===
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

export function importCSV(input) {
    if(state.isReadOnly) return;
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n');
        let count = 0;
        rows.forEach(row => {
            const cols = row.split(',');
            if (cols.length >= 2) {
                const date = cols[0].trim();
                const value = parseFloat(cols[1].trim());
                const grade = cols[2] ? cols[2].trim() : 'Imported';
                if (!isNaN(value) && !isNaN(Date.parse(date))) {
                    state.projectData.chartData.push({ date: new Date(date).toISOString().split('T')[0], value: value, grade: grade });
                    count++;
                }
            }
        });
        state.projectData.chartData.sort((a,b) => new Date(a.date) - new Date(b.date));
        window.saveData(); 
        if(window.renderDataView) window.renderDataView();
        showToast(`Imported ${count} points`, "success");
    };
    reader.readAsText(file);
    input.value = '';
}

// === DIAGRAM HELPERS ===
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
