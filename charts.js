import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

let chartInstance = null;
let fullViewChartInstance = null;
export let toolMode = 'fishbone';
let zoomLevel = 1.0;

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    const buttons = document.querySelectorAll('#tool-nav-ui button');
    buttons.forEach(b => {
        if(b.textContent.toLowerCase().includes(m)) b.className = "px-3 py-1 rounded text-sm font-bold bg-white shadow text-rcem-purple";
        else b.className = "px-3 py-1 rounded text-sm font-bold hover:bg-white/50";
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

export async function renderTools() {
    if(!state.projectData) return;
    const canvas = document.getElementById('diagram-canvas');
    const ghost = document.getElementById('diagram-ghost');
    
    if(document.getElementById('view-tools').getAttribute('data-view') === 'list') return;

    canvas.innerHTML = ''; 
    
    if (toolMode === 'fishbone') {
        ghost.classList.add('hidden');
        renderFishboneVisual(canvas);
    } 
    else if (toolMode === 'driver') {
        if (state.projectData.drivers.primary.length === 0) ghost.classList.remove('hidden'); 
        else {
            ghost.classList.add('hidden');
            renderDriverVisual(canvas);
        }
    } 
    else if (toolMode === 'process') {
        ghost.classList.add('hidden');
        renderProcessVisual(canvas);
    }
}

function renderFishboneVisual(container) {
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
        
        if(!state.isReadOnly) {
            el.onmousedown = (e) => {
                e.preventDefault();
                const startX = e.clientX; const startY = e.clientY;
                const startLeft = parseFloat(el.style.left); const startTop = parseFloat(el.style.top);
                const parentW = container.offsetWidth; const parentH = container.offsetHeight;

                const onMove = (ev) => {
                    const dx = (ev.clientX - startX) / parentW * 100;
                    const dy = (ev.clientY - startY) / parentH * 100;
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
}

function renderDriverVisual(container) {
    const d = state.projectData.drivers;
    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    let mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
    d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
    d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
    d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
    container.innerHTML = `<div class="mermaid w-full h-full flex items-center justify-center text-sm">${mCode}</div>`;
    try { mermaid.run(); } catch(e) { console.error("Mermaid error", e); }
}

function renderProcessVisual(container) {
    const p = state.projectData.process || ["Start", "End"];
    const clean = (t) => t ? t.replace(/["()]/g, '') : '...';
    let mCode = `graph TD\n` + p.map((x,i) => i<p.length-1 ? `  n${i}["${clean(x)}"] --> n${i+1}["${clean(p[i+1])}"]` : `  n${i}["${clean(x)}"]`).join('\n');
    container.innerHTML = `<div class="mermaid w-full h-full flex items-center justify-center text-sm">${mCode}</div>`;
    try { mermaid.run(); } catch(e) { console.error(e); }
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

export function renderChart() {
    const ctx = document.getElementById('mainChart');
    if(!ctx) return;
    if(window.myChart) window.myChart.destroy();
    
    const d = state.projectData.chartData;
    if(d.length === 0) {
        document.getElementById('chart-ghost')?.classList.remove('hidden');
        return;
    }
    document.getElementById('chart-ghost')?.classList.add('hidden');

    const labels = d.map(x => x.date);
    const data = d.map(x => x.value);
    
    let baseline = data.slice(0, 12);
    let mean = baseline.length ? baseline.reduce((a,b)=>a+b,0)/baseline.length : 0;

    const annotations = {
        meanLine: { type: 'line', yMin: mean, yMax: mean, borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 2, label: { display: true, content: `Mean: ${mean.toFixed(1)}`, position: 'end' } }
    };
    
    const pdsaDates = state.projectData.pdsa.map(p => ({ date: p.start, title: p.title }));
    pdsaDates.forEach((p, i) => {
        annotations[`pdsa_${i}`] = { type: 'line', xMin: p.date, xMax: p.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: p.title, backgroundColor: '#f36f21', color: 'white', position: 'start' } };
    });

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Measure',
                data: data,
                borderColor: '#2d2e83',
                backgroundColor: '#2d2e83',
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                annotation: { annotations },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const item = d[context.dataIndex];
                            return `Grade: ${item.grade || 'N/A'}`;
                        }
                    }
                }
            }
        }
    });
}

export function renderFullViewChart() {
    const container = document.getElementById('full-view-chart-container');
    if(!container) return;
    
    container.innerHTML = '<canvas id="fullProjectChart" height="300"></canvas>';
    const ctx = document.getElementById('fullProjectChart').getContext('2d');
    
    if(fullViewChartInstance) fullViewChartInstance.destroy();
    
    const d = state.projectData.chartData;
    if(d.length === 0) { container.innerHTML = '<div class="text-center italic text-slate-400">No Data Available</div>'; return; }

    const labels = d.map(x => x.date);
    const data = d.map(x => x.value);
    
    fullViewChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Measure', data: data, borderColor: '#2d2e83', borderWidth: 2, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

export function addDataPoint() {
    const d = document.getElementById('chart-date').value;
    const v = document.getElementById('chart-value').value;
    const g = document.getElementById('chart-grade').value;
    const cat = document.getElementById('chart-cat')?.value || 'outcome';
    
    if(!d || !v) { showToast("Date and Value required", "error"); return; }
    
    state.projectData.chartData.push({ date: d, value: parseFloat(v), grade: g, type: cat });
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
    const csv = "data:text/csv;charset=utf-8,Date,Value,Grade\n2026-01-01,120,Registrar\n2026-01-02,110,Nurse";
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
