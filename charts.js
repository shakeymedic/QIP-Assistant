import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea } from "./utils.js";

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================

export let toolMode = 'driver'; // Options: 'driver', 'fishbone', 'process'
export let chartMode = 'run';   // Options: 'run', 'spc', 'histogram', 'pareto'
let zoomLevel = 1.0;
let myChart = null; // Holds the Chart.js instance

// HELP CONTENT
const TOOL_HELP = {
    fishbone: {
        title: "Fishbone Diagram",
        desc: "Identify root causes of a problem using the Ishikawa (Fishbone) technique.",
        tips: "Double-click a category to add a cause. Drag causes to arrange them. Use '5 Whys' to drill deeper into each cause."
    },
    driver: {
        title: "Driver Diagram",
        desc: "Map your Aim to Drivers and Change Ideas in a hierarchical structure.",
        tips: "Primary Drivers are high-level factors. Secondary Drivers are specific interventions. Change Ideas are the actual tests you will run."
    },
    process: {
        title: "Process Map",
        desc: "Visualize the patient journey or workflow step-by-step.",
        tips: "Map the 'As Is' process first. Identify bottlenecks, delays, and waste. Then design your 'To Be' process."
    }
};

const CHART_EDUCATION = {
    run: {
        title: "Run Chart",
        desc: "A run chart displays data over time with a median line. Look for shifts (6+ points above/below median), trends (5+ consecutive increasing/decreasing points), and other non-random patterns.",
        rules: [
            "Shift: 6 or more consecutive points above or below the median",
            "Trend: 5 or more consecutive points going up or down",
            "Too many/few runs: Compare actual runs to expected",
            "Astronomical point: Unusually high or low value"
        ]
    },
    spc: {
        title: "Statistical Process Control (SPC) Chart",
        desc: "An SPC chart adds Upper and Lower Control Limits (UCL/LCL) to identify special cause variation. Points outside limits or non-random patterns indicate special causes.",
        rules: [
            "Point outside control limits (3σ)",
            "8 consecutive points on one side of the mean",
            "6 consecutive increasing/decreasing points",
            "2 of 3 consecutive points near a control limit"
        ]
    },
    histogram: {
        title: "Histogram",
        desc: "A histogram shows the distribution of your data values. It helps identify the shape (normal, skewed, bimodal), spread, and central tendency.",
        rules: [
            "Normal distribution: Bell-shaped, symmetrical",
            "Skewed: Tail extends to one side",
            "Bimodal: Two peaks (may indicate two processes)",
            "Truncated: Cut off at one end"
        ]
    },
    pareto: {
        title: "Pareto Chart",
        desc: "A Pareto chart combines bars (frequency) with a cumulative line to show the 80/20 rule - often 80% of problems come from 20% of causes.",
        rules: [
            "Focus on the 'vital few' categories on the left",
            "The cumulative line shows total contribution",
            "Address top categories first for maximum impact"
        ]
    }
};

// ==========================================
// 2. TOOL & TAB MANAGEMENT
// ==========================================

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    applyZoom();
    // Update active tab styling
    document.querySelectorAll('.tool-tab-btn').forEach(btn => {
        if(btn.dataset.mode === m) {
            btn.classList.add('bg-rcem-purple', 'text-white', 'shadow');
            btn.classList.remove('text-slate-500', 'hover:bg-slate-50');
        } else {
            btn.classList.remove('bg-rcem-purple', 'text-white', 'shadow');
            btn.classList.add('text-slate-500', 'hover:bg-slate-50');
        }
    });
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

    // Render Tabs only if we are in the main diagram view
    if (targetId === 'diagram-canvas') {
        renderToolUI();
    }

    const mode = overrideMode || toolMode;
    canvas.innerHTML = ''; 
    
    // Dispatch to specific renderer
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

    // Inject Help Panel if missing
    let helpPanel = document.getElementById('tool-help-panel');
    const toolsView = document.getElementById('view-tools');
    const relativeContainer = toolsView ? toolsView.querySelector('.relative') : null;
    
    if(!helpPanel && relativeContainer) {
        helpPanel = document.createElement('div');
        helpPanel.id = 'tool-help-panel';
        helpPanel.className = 'absolute top-4 right-4 w-64 bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-200 p-4 z-30 hidden transition-all';
        relativeContainer.appendChild(helpPanel);
    }
    
    if (helpPanel) {
        const info = TOOL_HELP[toolMode];
        helpPanel.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-slate-800">${info.title}</h4>
                <button onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-slate-800"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <p class="text-xs text-slate-600 mb-3">${info.desc}</p>
            <div class="bg-indigo-50 p-2 rounded text-[10px] text-indigo-800 font-medium border border-indigo-100">
                <strong>Tip:</strong> ${info.tips}
            </div>
        `;
    }
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 3. INTERACTIVE DIAGRAM RENDERERS
// ==========================================

// --- FISHBONE DIAGRAM ---
function renderFishboneVisual(container, enableInteraction = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); 
    svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; 
    svg.style.top = '0'; 
    svg.style.left = '0'; 
    svg.style.pointerEvents = 'none'; // Allow clicks to pass through to labels
    
    // Draw the "bones"
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
        el.style.left = `${x}%`; 
        el.style.top = `${y}%`;
        
        if(!state.isReadOnly && enableInteraction) {
            makeDraggable(el, container, isCat, catIdx, causeIdx); 
            el.ondblclick = (e) => { 
                e.stopPropagation(); 
                if(isCat) {
                    window.addCauseWithWhys(catIdx); 
                } else {
                    const newText = prompt("Edit Cause:", text);
                    if(newText !== null && newText !== '') {
                        state.projectData.fishbone.categories[catIdx].causes[causeIdx].text = newText;
                        window.saveData();
                        renderTools();
                    }
                }
            };
        }
        container.appendChild(el);
    };

    // Render Data
    state.projectData.fishbone.categories.forEach((cat, i) => {
        const defaultX = i % 2 === 0 ? 20 : 70;
        const defaultY = i < 2 ? 20 : 80;
        createLabel(cat.text, cat.x || defaultX, cat.y || defaultY, true, i);
        
        cat.causes.forEach((cause, j) => {
            const causeText = typeof cause === 'string' ? cause : cause.text;
            const causeX = typeof cause === 'object' ? (cause.x || (cat.x || defaultX) + (j * 5)) : ((cat.x || defaultX) + (j * 5));
            const causeY = typeof cause === 'object' ? (cause.y || (cat.y || defaultY) + (j * 5)) : ((cat.y || defaultY) + (j * 5));
            createLabel(causeText, causeX, causeY, false, i, j);
        });
    });
}

// --- DRIVER DIAGRAM (HTML COLUMNS) ---
function renderDriverVisual(container, enableInteraction = false) {
    const d = state.projectData.drivers;
    
    // Main Flex Container
    container.className = "flex flex-col md:flex-row gap-4 items-stretch overflow-x-auto p-4 min-h-[500px]";
    
    // Define the 4 Columns
    const cols = [
        { 
            title: 'Aim', 
            color: 'bg-indigo-50 border-indigo-200 text-indigo-900', 
            items: [state.projectData.checklist?.aim || 'Define Aim in Checklist first'], 
            type: 'aim',
            readonly: true 
        },
        { 
            title: 'Primary Drivers', 
            color: 'bg-blue-50 border-blue-200 text-blue-900', 
            items: d.primary, 
            type: 'primary',
            readonly: false 
        },
        { 
            title: 'Secondary Drivers', 
            color: 'bg-sky-50 border-sky-200 text-sky-900', 
            items: d.secondary, 
            type: 'secondary',
            readonly: false 
        },
        { 
            title: 'Change Ideas', 
            color: 'bg-emerald-50 border-emerald-200 text-emerald-900', 
            items: d.changes, 
            type: 'changes',
            readonly: false 
        }
    ];

    cols.forEach((col, colIdx) => {
        const colDiv = document.createElement('div');
        colDiv.className = "flex-1 min-w-[220px] flex flex-col gap-3";
        
        // Column Header
        colDiv.innerHTML = `<h4 class="font-bold text-center uppercase text-xs text-slate-500 mb-2 tracking-wider sticky top-0 bg-white z-10 py-2 border-b border-transparent">${col.title}</h4>`;
        
        // Render Items
        col.items.forEach((item, itemIdx) => {
            const card = document.createElement('div');
            card.className = `${col.color} p-4 rounded-lg border shadow-sm text-sm font-medium relative group hover:shadow-md transition-all`;
            
            if (col.readonly) {
                // Aim is read-only here
                card.innerHTML = `<div class="italic leading-relaxed text-slate-700">${escapeHtml(item)}</div>`;
            } else {
                // Editable Textareas
                if (state.isReadOnly) {
                    card.textContent = item;
                } else {
                    // AI Button for Secondary Drivers
                    let aiBtn = '';
                    if (col.type === 'secondary' && window.hasAI && window.hasAI()) {
                        aiBtn = `
                            <button onclick="window.runChangeGen('${escapeHtml(item.replace(/'/g, "\\'"))}')" 
                                    title="Generate Change Ideas" 
                                    class="absolute -top-2 -right-2 bg-white text-emerald-600 border border-emerald-200 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-emerald-50 transition-all z-20">
                                <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                            </button>`;
                    }

                    // Textarea with auto-resize logic
                    card.innerHTML = `
                        <textarea 
                            class="w-full bg-transparent border-none focus:ring-0 p-0 resize-none text-sm leading-relaxed overflow-hidden outline-none" 
                            oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
                            onchange="window.updateDriver('${col.type}', ${itemIdx}, this.value)">${escapeHtml(item)}</textarea>
                        <button onclick="window.removeDriver('${col.type}', ${itemIdx})" 
                                class="absolute top-1 right-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/50">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                        ${aiBtn}
                    `;
                }
            }
            colDiv.appendChild(card);
            
            // Trigger auto-resize on initial render
            const textarea = card.querySelector('textarea');
            if(textarea) {
                setTimeout(() => {
                        textarea.style.height = 'auto';
                        textarea.style.height = textarea.scrollHeight + 'px';
                }, 0);
            }
        });

        // "Add" Button
        if (!col.readonly && !state.isReadOnly) {
            const addBtn = document.createElement('button');
            addBtn.className = "w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-rcem-purple hover:text-rcem-purple hover:bg-slate-50 font-bold text-xs transition-colors flex items-center justify-center gap-2 mt-auto";
            addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> Add ${col.title.slice(0, -1)}`; 
            addBtn.onclick = () => window.addDriver(col.type);
            colDiv.appendChild(addBtn);
        }

        container.appendChild(colDiv);
    });
}

// --- PROCESS MAP ---
function renderProcessVisual(container, enableInteraction = false) {
    const p = state.projectData.process || ["Start", "End"];
    const clean = (t) => t ? t.replace(/["()]/g, '').substring(0, 30) : '...';
    
    container.className = "flex flex-col items-center py-8 min-h-[500px] gap-0";
    
    p.forEach((step, i) => {
        // Draw Connector Arrow
        if (i > 0) {
            const arrow = document.createElement('div');
            arrow.className = "h-8 w-px bg-slate-300 relative";
            arrow.innerHTML = `<div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-slate-300"><i data-lucide="chevron-down" class="w-4 h-4"></i></div>`;
            container.appendChild(arrow);
        }

        const wrapper = document.createElement('div');
        wrapper.className = "relative group w-72 z-10";

        if (state.isReadOnly) {
                wrapper.innerHTML = `<div class="bg-white border-2 border-slate-800 p-4 rounded-lg text-center font-bold shadow-sm">${escapeHtml(step)}</div>`;
        } else {
            const isTerminator = i === 0 || i === p.length - 1;
            // Terminators are Black, Steps are White with Border
            const bgClass = isTerminator 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-white border-2 border-slate-800 text-slate-800 shadow-sm';
            
            wrapper.innerHTML = `
                <div class="${bgClass} p-4 rounded-lg transition-transform hover:scale-[1.01]">
                    <textarea 
                        class="w-full bg-transparent text-center font-bold outline-none resize-none overflow-hidden ${isTerminator ? 'text-white placeholder-slate-400' : 'text-slate-800'}"
                        placeholder="Step Description"
                        rows="1"
                        oninput="this.style.height='';this.style.height=this.scrollHeight+'px'"
                        onchange="window.updateStep(${i}, this.value)">${escapeHtml(step)}</textarea>
                </div>
                
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg shadow-lg border border-slate-100 z-20">
                        <button onclick="window.addStep(${i})" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded" title="Add Step After">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                        ${!isTerminator ? `
                        <button onclick="window.removeStep(${i})" class="text-red-600 hover:bg-red-50 p-1.5 rounded" title="Delete Step">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>` : ''}
                </div>
            `;
        }
        container.appendChild(wrapper);
        
        // Auto resize initial
        setTimeout(() => {
            const ta = wrapper.querySelector('textarea');
            if(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
        },0);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 4. CHART RENDERING (CHART.JS)
// ==========================================

export function setChartMode(m) { 
    chartMode = m; 
    
    // Update button styles
    const modeControls = document.getElementById('chart-mode-controls');
    if (modeControls) {
        modeControls.querySelectorAll('button').forEach(btn => {
            const btnMode = btn.getAttribute('data-mode');
            if (btnMode === m) {
                btn.className = 'px-3 py-1 rounded text-xs font-bold bg-slate-800 text-white shadow';
            } else {
                btn.className = 'px-3 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50';
            }
        });
    }
    
    renderChart(); 
    updateChartEducation();
}

export function renderChart(canvasId = 'mainChart') {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;
    
    // Destroy existing chart instance
    if(ctx.chartInstance) {
        ctx.chartInstance.destroy();
        ctx.chartInstance = null;
    }
    
    const d = state.projectData.chartData;
    if (d.length === 0 && canvasId === 'mainChart') {
        const context = ctx.getContext('2d');
        context.clearRect(0,0,ctx.width, ctx.height);
        return;
    }
    
    if (chartMode === 'run') renderRunChart(ctx, canvasId);
    else if (chartMode === 'spc') renderSPCChart(ctx, canvasId);
    else if (chartMode === 'histogram') renderHistogram(ctx, canvasId);
    else if (chartMode === 'pareto') renderPareto(ctx, canvasId);
}

function renderRunChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0) return;
    
    const settings = state.projectData.chartSettings || {};
    const sortedD = [...d].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedD.map(x => x.date);
    const data = sortedD.map(x => x.value);
    
    // Calculate median from baseline data (first 12 points or all if less)
    let baselineData = data.slice(0, Math.min(12, data.length));
    let sortedBase = [...baselineData].sort((a, b) => a - b);
    let median = sortedBase.length ? sortedBase[Math.floor(sortedBase.length / 2)] : 0;

    // Build annotations
    const annotations = {
        medianLine: { 
            type: 'line', 
            yMin: median, 
            yMax: median, 
            borderColor: '#94a3b8', 
            borderDash: [5, 5],
            borderWidth: 2,
            label: {
                display: true,
                content: `Median: ${median.toFixed(1)}`,
                position: 'end',
                backgroundColor: 'rgba(148, 163, 184, 0.8)',
                font: { size: 10 }
            }
        }
    };
    
    // Add PDSA annotations if enabled
    if (settings.showAnnotations && state.projectData.pdsa && state.projectData.pdsa.length > 0) {
        state.projectData.pdsa.forEach((p, i) => {
            if (p.start) {
                annotations[`pdsa${i}`] = {
                    type: 'line',
                    xMin: p.start,
                    xMax: p.start,
                    borderColor: '#f36f21',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: `PDSA ${i + 1}`,
                        position: 'start',
                        backgroundColor: 'rgba(243, 111, 33, 0.8)',
                        font: { size: 9 }
                    }
                };
            }
        });
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: labels, 
            datasets: [{
                label: settings.yAxisLabel || 'Measure', 
                data: data, 
                borderColor: '#2d2e83', 
                backgroundColor: '#2d2e83',
                pointBackgroundColor: '#2d2e83',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                tension: 0.1,
                fill: false
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                title: { display: !!settings.title, text: settings.title || '', font: { size: 16, weight: 'bold' }, color: '#1e293b' },
                legend: { display: true, position: 'top' },
                annotation: { annotations: annotations }
            },
            scales: {
                x: { title: { display: true, text: 'Date', font: { weight: 'bold' } } },
                y: { title: { display: !!settings.yAxisLabel, text: settings.yAxisLabel || '', font: { weight: 'bold' } }, beginAtZero: false }
            }
        }
    });
    ctx.chartInstance = chart;
}

function renderSPCChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length < 2) return;
    
    const settings = state.projectData.chartSettings || {};
    const sortedD = [...d].sort((a, b) => new Date(a.date) - new Date(b.date));
    const data = sortedD.map(x => x.value);
    const labels = sortedD.map(x => x.date);
    
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    let mRSum = 0; 
    for(let i = 1; i < data.length; i++) { mRSum += Math.abs(data[i] - data[i - 1]); }
    const avgMR = mRSum / (data.length - 1);
    
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));
    
    const pointColors = data.map(v => (v > ucl || v < lcl) ? '#ef4444' : '#64748b');

    const annotations = {
        ucl: { type: 'line', yMin: ucl, yMax: ucl, borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 2, label: { display: true, content: `UCL: ${ucl.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(239, 68, 68, 0.8)', font: { size: 9 } } }, 
        lcl: { type: 'line', yMin: lcl, yMax: lcl, borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 2, label: { display: true, content: `LCL: ${lcl.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(239, 68, 68, 0.8)', font: { size: 9 } } }, 
        avg: { type: 'line', yMin: avg, yMax: avg, borderColor: '#22c55e', borderWidth: 2, label: { display: true, content: `Mean: ${avg.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(34, 197, 94, 0.8)', font: { size: 9 } } }
    };

    if (settings.showAnnotations && state.projectData.pdsa) {
        state.projectData.pdsa.forEach((p, i) => {
            if (p.start) {
                annotations[`pdsa${i}`] = { type: 'line', xMin: p.start, xMax: p.start, borderColor: '#f36f21', borderWidth: 2, borderDash: [5, 5], label: { display: true, content: `PDSA ${i + 1}`, position: 'start', backgroundColor: 'rgba(243, 111, 33, 0.8)', font: { size: 9 } } };
            }
        });
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: settings.yAxisLabel || 'Measure', data: data, borderColor: '#64748b', backgroundColor: '#64748b', pointBackgroundColor: pointColors, pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 6, tension: 0, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: !!settings.title, text: settings.title || '', font: { size: 16, weight: 'bold' }, color: '#1e293b' }, annotation: { annotations: annotations } }, scales: { y: { title: { display: !!settings.yAxisLabel, text: settings.yAxisLabel || '', font: { weight: 'bold' } } } } }
    });
    ctx.chartInstance = chart;
}

function renderHistogram(ctx, canvasId) {
    const d = state.projectData.chartData.map(x => x.value);
    if(d.length < 2) { showToast("Need at least 2 data points for histogram", "info"); return; }
    
    const settings = state.projectData.chartSettings || {};
    const min = Math.min(...d); 
    const max = Math.max(...d);
    const range = max - min;
    const bins = Math.max(3, Math.min(10, Math.ceil(Math.log2(d.length) + 1)));
    const step = range / bins || 1;
    
    const buckets = new Array(bins).fill(0); 
    const labels = [];
    
    for(let i = 0; i < bins; i++) {
        const low = min + (i * step); 
        const high = low + step;
        labels.push(`${Math.round(low)}-${Math.round(high)}`);
        buckets[i] = d.filter(v => {
            if (i === bins - 1) return v >= low && v <= high;
            return v >= low && v < high;
        }).length;
    }
    
    const chart = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: labels, datasets: [{ label: 'Frequency', data: buckets, backgroundColor: '#8b5cf6', borderColor: '#7c3aed', borderWidth: 1 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: !!settings.title, text: settings.title || 'Data Distribution', font: { size: 16, weight: 'bold' }, color: '#1e293b' } }, scales: { x: { title: { display: true, text: settings.yAxisLabel || 'Value Range', font: { weight: 'bold' } } }, y: { title: { display: true, text: 'Frequency', font: { weight: 'bold' } }, beginAtZero: true, ticks: { stepSize: 1 } } } } 
    });
    ctx.chartInstance = chart;
}

function renderPareto(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0) return;
    
    const settings = state.projectData.chartSettings || {};
    const counts = {}; 
    d.forEach(x => { const cat = x.grade || x.category || "Uncategorised"; counts[cat] = (counts[cat] || 0) + 1; });
    
    const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const values = sortedCats.map(c => counts[c]);
    const total = values.reduce((a, b) => a + b, 0);
    
    let cum = 0; 
    const cumulative = values.map(v => { cum += v; return (cum / total) * 100; });

    const chart = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: sortedCats, datasets: [ { type: 'line', label: 'Cumulative %', data: cumulative, borderColor: '#f36f21', backgroundColor: 'rgba(243, 111, 33, 0.1)', pointBackgroundColor: '#f36f21', pointRadius: 4, yAxisID: 'y1', tension: 0.2, fill: false }, { type: 'bar', label: 'Frequency', data: values, backgroundColor: '#2d2e83', borderColor: '#1e1f5c', borderWidth: 1, yAxisID: 'y' } ] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: !!settings.title, text: settings.title || 'Pareto Analysis', font: { size: 16, weight: 'bold' }, color: '#1e293b' } }, scales: { y: { title: { display: true, text: 'Count', font: { weight: 'bold' } }, beginAtZero: true }, y1: { position: 'right', max: 100, title: { display: true, text: 'Cumulative %', font: { weight: 'bold' } }, grid: { drawOnChartArea: false } } } } 
    });
    ctx.chartInstance = chart;
}

// ==========================================
// 5. DATA HELPERS
// ==========================================

export function addDataPoint() {
    const dateInput = document.getElementById('chart-date');
    const valueInput = document.getElementById('chart-value');
    const gradeInput = document.getElementById('chart-grade');
    
    const d = dateInput ? dateInput.value : '';
    const v = valueInput ? valueInput.value : '';
    const g = gradeInput ? gradeInput.value : '';
    
    if(!d || v === '') { showToast("Date and Value are required", "error"); return; }
    
    const parsedValue = parseFloat(v);
    if (isNaN(parsedValue)) { showToast("Value must be a number", "error"); return; }
    
    state.projectData.chartData.push({ date: d, value: parsedValue, grade: g });
    state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (valueInput) valueInput.value = '';
    window.saveData();
    if(window.renderDataView) window.renderDataView();
    showToast("Data point added", "success");
}

export function deleteDataPoint(date) {
    if(confirm('Delete this data point?')) {
        const idx = state.projectData.chartData.findIndex(x => x.date === date);
        if(idx > -1) { 
            state.projectData.chartData.splice(idx, 1); 
            window.saveData(); 
            if(window.renderDataView) window.renderDataView();
            showToast("Data point deleted", "info");
        }
    }
}

export function downloadCSVTemplate() {
    const csvContent = "data:text/csv;charset=utf-8,Date,Value,Context\n2025-01-01,10,Baseline\n2025-01-02,12,Intervention";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "qip_data_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function importCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        let count = 0;
        lines.forEach((l, i) => {
            if(i === 0) return; // Header
            const parts = l.split(',');
            if(parts.length >= 2) {
                const d = parts[0].trim();
                const v = parseFloat(parts[1].trim());
                if(d && !isNaN(v)) {
                    state.projectData.chartData.push({date: d, value: v, grade: parts[2]?parts[2].trim():'Baseline'});
                    count++;
                }
            }
        });
        window.saveData();
        if(window.renderDataView) window.renderDataView();
        showToast(`Imported ${count} points`, "success");
    };
    reader.readAsText(file);
    input.value = '';
}

// ==========================================
// 6. GLOBAL WINDOW EXPORTS
// ==========================================

window.addDriver = (type) => {
    if (!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
    if (!state.projectData.drivers[type]) state.projectData.drivers[type] = [];
    state.projectData.drivers[type].push("New Item");
    window.saveData();
    renderTools();
};

window.updateDriver = (type, index, value) => {
    if (state.projectData.drivers && state.projectData.drivers[type]) {
        state.projectData.drivers[type][index] = value;
        window.saveData();
        // Do not re-render to keep focus
    }
};

window.removeDriver = (type, index) => {
    if(confirm("Remove this item?")) {
        state.projectData.drivers[type].splice(index, 1);
        window.saveData();
        renderTools();
    }
};

window.addStep = (index) => {
    if(!state.projectData.process) state.projectData.process = ["Start", "End"];
    state.projectData.process.splice(index + 1, 0, "New Step");
    window.saveData();
    renderTools(null, 'process'); 
};

window.updateStep = (index, val) => {
    if(!state.projectData.process) return;
    state.projectData.process[index] = val;
    window.saveData();
};

window.removeStep = (index) => {
    if(!state.projectData.process) return;
    state.projectData.process.splice(index, 1);
    window.saveData();
    renderTools(null, 'process'); 
};

window.runChangeGen = async (driverName) => {
    if(window.generateChangeIdeas) {
         showToast("Generating ideas...", "info");
         const ideas = await window.generateChangeIdeas(driverName);
         if(ideas) {
             state.projectData.drivers.changes.push(...ideas);
             window.saveData();
             renderTools();
             showToast("Ideas added!", "success");
         }
    } else {
        alert("AI module not loaded");
    }
};

window.addCauseWithWhys = (catIdx) => {
    if(state.isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    const cat = state.projectData.fishbone.categories[catIdx];
    const defaultX = catIdx % 2 === 0 ? 20 : 70;
    const defaultY = catIdx < 2 ? 20 : 80;
    cat.causes.push({ 
        text: cause, 
        x: (cat.x || defaultX) + (cat.causes.length * 3) + 5, 
        y: (cat.y || defaultY) + (cat.causes.length * 3) + 5 
    });
    window.saveData();
    renderTools();
};

export function resetProcess() {
    if(state.isReadOnly) return;
    if(confirm("Reset process map?")) { 
        state.projectData.process = ["Start", "End"]; 
        window.saveData(); 
        renderTools(); 
    }
}

// Drag Helper for Fishbone
export function makeDraggable(el, container, isCat, catIdx, causeIdx, onDragEnd) {
    if(state.isReadOnly) return;
    const handleMove = (cx, cy, sl, st, sx, sy) => {
        const pw = container.offsetWidth || 1000;
        const ph = container.offsetHeight || 600;
        const dx = cx - sx;
        const dy = cy - sy;
        const nl = Math.max(0, Math.min(100, sl + (dx / pw * 100)));
        const nt = Math.max(0, Math.min(100, st + (dy / ph * 100)));
        el.style.left = `${nl}%`; el.style.top = `${nt}%`;
        return { x: nl, y: nt };
    };
    const handleEnd = () => {
        const nx = parseFloat(el.style.left);
        const ny = parseFloat(el.style.top);
        
        if (onDragEnd) {
            onDragEnd(nx, ny);
        } else {
            if (isCat) { 
                state.projectData.fishbone.categories[catIdx].x = nx; 
                state.projectData.fishbone.categories[catIdx].y = ny; 
            } else { 
                state.projectData.fishbone.categories[catIdx].causes[causeIdx].x = nx; 
                state.projectData.fishbone.categories[catIdx].causes[causeIdx].y = ny; 
            }
        }
        window.saveData(true);
    };
    el.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, sl = parseFloat(el.style.left)||0, st = parseFloat(el.style.top)||0;
        const onMove = (ev) => handleMove(ev.clientX, ev.clientY, sl, st, sx, sy);
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); handleEnd(); };
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    };
    el.ontouchstart = (e) => {
        if(e.touches.length > 1) return;
        e.preventDefault(); e.stopPropagation();
        const t = e.touches[0], sx = t.clientX, sy = t.clientY, sl = parseFloat(el.style.left)||0, st = parseFloat(el.style.top)||0;
        const onMove = (ev) => handleMove(ev.touches[0].clientX, ev.touches[0].clientY, sl, st, sx, sy);
        const onEnd = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); handleEnd(); };
        document.addEventListener('touchmove', onMove, {passive: false}); document.addEventListener('touchend', onEnd);
    };
}

export function zoomIn() { zoomLevel = Math.min(2.0, zoomLevel + 0.1); applyZoom(); showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info"); }
export function zoomOut() { zoomLevel = Math.max(0.5, zoomLevel - 0.1); applyZoom(); showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info"); }
export function resetZoom() { zoomLevel = 1.0; applyZoom(); showToast("Zoom reset", "info"); }
function applyZoom() { const c = document.getElementById('diagram-canvas'); if (c) { c.style.transform = `scale(${zoomLevel})`; c.style.transformOrigin = 'center center'; } }

export function openChartSettings() { 
    const m = document.getElementById('chart-settings-modal'); 
    if(m) {
        const s = state.projectData.chartSettings || {};
        const t = document.getElementById('chart-setting-title'); if(t) t.value = s.title || '';
        const y = document.getElementById('chart-setting-yaxis'); if(y) y.value = s.yAxisLabel || '';
        const a = document.getElementById('chart-setting-annotations'); if(a) a.checked = s.showAnnotations || false;
        m.classList.remove('hidden'); 
    } 
}
export function saveChartSettings() {
    if (!state.projectData.chartSettings) state.projectData.chartSettings = {};
    const t = document.getElementById('chart-setting-title'); state.projectData.chartSettings.title = t ? t.value : '';
    const y = document.getElementById('chart-setting-yaxis'); state.projectData.chartSettings.yAxisLabel = y ? y.value : '';
    const a = document.getElementById('chart-setting-annotations'); state.projectData.chartSettings.showAnnotations = a ? a.checked : false;
    window.saveData();
    document.getElementById('chart-settings-modal').classList.add('hidden');
    renderChart();
    showToast("Settings saved", "success");
}
export function copyChartImage() {
    const c = document.getElementById('mainChart');
    if(c) c.toBlob(b => { 
        navigator.clipboard.write([new ClipboardItem({'image/png': b})]).then(() => showToast("Copied!", "success")).catch(() => showToast("Copy failed", "error")); 
    });
}
export function updateChartEducation() {
    const p = document.getElementById('chart-education-panel');
    if (!p) return;
    const i = CHART_EDUCATION[chartMode];
    if (i) p.innerHTML = `<h4 class="font-bold text-slate-800 text-sm mb-2">${i.title}</h4><p class="text-xs text-slate-600 mb-3">${i.desc}</p><div class="space-y-1">${i.rules.map(r => `<div class="text-[10px] text-slate-500 flex items-start gap-2"><span class="text-rcem-purple">•</span><span>${r}</span></div>`).join('')}</div>`;
}
export function renderFullViewChart() {
    const c = document.getElementById('full-view-chart-container');
    if (!c) return;
    let cv = document.getElementById('full-view-chart-canvas');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'full-view-chart-canvas'; c.innerHTML = ''; c.appendChild(cv); }
    renderChart('full-view-chart-canvas');
}
