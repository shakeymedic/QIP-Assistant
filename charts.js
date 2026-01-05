import { state } from './state.js';
import { escapeHtml } from './utils.js';

let chartInstance = null;
let fullViewChartInstance = null;
export let toolMode = 'fishbone';
let zoomLevel = 2.0;

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 2.0; 
    document.querySelectorAll('.tool-tab').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-rcem-purple'));
    document.getElementById(`tab-${m}`).classList.add('bg-white', 'shadow-sm', 'text-rcem-purple');
    renderTools();
}

export function zoomIn() { zoomLevel += 0.2; updateZoom(); }
export function zoomOut() { zoomLevel = Math.max(0.5, zoomLevel - 0.2); updateZoom(); }
export function resetZoom() { zoomLevel = 2.0; updateZoom(); }

function updateZoom() {
    const el = document.getElementById('diagram-canvas');
    if(el) el.style.transform = `scale(${zoomLevel})`;
}

export async function renderTools() {
    const toolInfo = {
        fishbone: { title: "Fishbone", desc: "Root Cause Analysis", how: "Ask 'Why?' 5 times." },
        driver: { title: "Driver Diagram", desc: "Theory of Change", how: "Primary -> Secondary -> Changes" },
        process: { title: "Process Map", desc: "Workflow", how: "Map patient journey." }
    };
    
    document.getElementById('tool-explainer').innerHTML = `
        <h2 class="text-xl font-bold text-indigo-900 mb-1 flex items-center gap-2"><i data-lucide="info" class="w-5 h-5"></i> ${toolInfo[toolMode].title}</h2>
        <p class="text-indigo-800 mb-3 text-sm">${toolInfo[toolMode].desc} - ${toolInfo[toolMode].how}</p>
    `;
    
    if(!state.projectData) return;
    const canvas = document.getElementById('diagram-canvas');
    const controls = document.getElementById('tool-controls');
    const ghost = document.getElementById('diagram-ghost');
    
    let mCode = '';
    let ctrls = '';
    
    if (toolMode === 'fishbone') {
        const cats = state.projectData.fishbone.categories;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        mCode = `mindmap\n  root(("${clean(state.projectData.meta.title || 'Problem')}"))\n` + 
            cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
        
        ctrls = cats.map(c => `<button ${state.isReadOnly?'disabled':''} onclick="window.addCauseWithWhys(${c.id})" class="whitespace-nowrap px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-200 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> ${c.text}</button>`).join('');
        if (cats.every(c => c.causes.length === 0)) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'driver') {
        const d = state.projectData.drivers;
        const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
        mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
        d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
        d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
        d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
        ctrls = `<button ${state.isReadOnly?'disabled':''} onclick="window.addDriver('primary')" class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded">Add Primary</button> <button ${state.isReadOnly?'disabled':''} onclick="window.addDriver('secondary')" class="px-4 py-2 bg-blue-100 text-blue-800 rounded">Add Secondary</button> <button ${state.isReadOnly?'disabled':''} onclick="window.addDriver('changes')" class="px-4 py-2 bg-purple-100 text-purple-800 rounded">Add Change Idea</button>`;
        if (d.primary.length === 0) ghost.classList.remove('hidden'); else ghost.classList.add('hidden');

    } else if (toolMode === 'process') {
         const p = state.projectData.process;
         const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
         mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
         ctrls = `<button ${state.isReadOnly?'disabled':''} onclick="window.addStep()" class="px-4 py-2 bg-white border border-slate-300 rounded">Add Step</button> <button ${state.isReadOnly?'disabled':''} onclick="window.resetProcess()" class="px-4 py-2 text-red-500">Reset</button>`;
         ghost.classList.add('hidden');
    }

    canvas.innerHTML = `<div class="mermaid">${mCode}</div>`;
    controls.innerHTML = ctrls;
    updateZoom(); 
    try { await mermaid.run(); } catch(e) { console.error("Mermaid error:", e); }
    lucide.createIcons();
}

export function renderChart() {
    if(!state.projectData) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    const data = [...state.projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
    
    if (data.length === 0) { 
        document.getElementById('chart-ghost').classList.remove('hidden'); 
        if(chartInstance) chartInstance.destroy(); 
        return; 
    }
    document.getElementById('chart-ghost').classList.add('hidden');

    const values = data.map(d => Number(d.value));
    const labels = data.map(d => d.date);
    
    let baselinePoints = values.slice(0, 12); 
    let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
    let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
    const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83'));

    if (chartInstance) chartInstance.destroy();
    
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 }
    };
    
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 6, tension: 0.1 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { annotation: { annotations } },
            onClick: (e, activeEls) => {
                if (state.isReadOnly || activeEls.length === 0) return;
                const i = activeEls[0].index;
                const note = prompt(`Annotate point:`, data[i].note || "");
                if (note !== null) { data[i].note = note; window.saveData(); renderChart(); }
            }
        }
    });
    
    document.getElementById('data-history').innerHTML = data.slice().reverse().map((d, i) => `
        <div class="flex justify-between border-b border-slate-100 py-2 items-center group">
            <span><span class="font-mono text-xs text-slate-400 mr-2">${d.date}</span> <strong>${d.value}</strong>${d.note ? `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">${escapeHtml(d.note)}</span>` : ''}</span>
            ${!state.isReadOnly ? `<button onclick="window.deleteDataPoint(${data.length - 1 - i})" class="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
        </div>`).join('');
    lucide.createIcons();
}

export function renderFullViewChart() {
    if(!state.projectData) return;
    const canvas = document.getElementById('fullProjectChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const data = [...state.projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
    if (data.length === 0) return;

    const values = data.map(d => Number(d.value));
    const labels = data.map(d => d.date);
    let baselinePoints = values.slice(0, 12); 
    let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
    let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
    const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83'));

    if (fullViewChartInstance) fullViewChartInstance.destroy();
    
    const annotations = {
        median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 }
    };
    
    data.filter(d => d.note).forEach((d, i) => {
        annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
    });

    fullViewChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 4, tension: 0.1 }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { annotation: { annotations }, legend: { display: false } },
            scales: { x: { ticks: { maxTicksLimit: 10 } } }
        }
    });
}

// Helper Wrappers for Tool Actions
export function addCauseWithWhys(id) {
    if(state.isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    if (confirm(`Do you want to drill down into "${cause}" using the 5 Whys technique?`)) {
        let root = cause;
        for (let i = 1; i <= 3; i++) {
            let deeper = prompt(`Why does "${root}" happen?`);
            if (!deeper) break;
            root = deeper;
        }
        if (root !== cause && confirm(`Root cause found: "${root}". Add this instead?`)) cause = root;
    }
    state.projectData.fishbone.categories.find(c=>c.id===id).causes.push(cause);
    window.saveData(); renderTools();
}
export function addDriver(t) { if(state.isReadOnly) return; const v=prompt("Driver:"); if(v){state.projectData.drivers[t].push(v); window.saveData(); renderTools();} }
export function addStep() { if(state.isReadOnly) return; const v=prompt("Step Description:"); if(v){state.projectData.process.push(v); window.saveData(); renderTools();} }
export function resetProcess() { if(state.isReadOnly) return; if(confirm("Start over?")){state.projectData.process=["Start","End"]; window.saveData(); renderTools();} }
export function deleteDataPoint(index) {
    if (state.isReadOnly) return;
    if (confirm("Delete?")) {
        const sortedData = [...state.projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
        const itemToDelete = sortedData[index];
        const originalIndex = state.projectData.chartData.findIndex(d => d.date === itemToDelete.date && d.value === itemToDelete.value);
        if (originalIndex !== -1) { state.projectData.chartData.splice(originalIndex, 1); }
        window.saveData(); renderChart();
    }
}
export function addDataPoint() {
    if (state.isReadOnly) return;
    const d = { date: document.getElementById('chart-date').value, value: document.getElementById('chart-value').value, type: document.getElementById('chart-cat').value };
    if (d.date && d.value) { state.projectData.chartData.push(d); window.saveData(); renderChart(); }
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
        state.historyStack.push(JSON.stringify(state.projectData));
        rows.forEach(row => {
            const cols = row.split(',');
            if (cols.length >= 2) {
                const date = cols[0].trim();
                const value = parseFloat(cols[1].trim());
                if (!isNaN(value) && !isNaN(Date.parse(date))) {
                    state.projectData.chartData.push({ date: new Date(date).toISOString().split('T')[0], value: value, type: 'outcome' });
                    count++;
                }
            }
        });
        window.saveData(); renderChart();
        alert(`Imported ${count} points.`);
    };
    reader.readAsText(file);
    input.value = '';
}
