import { state } from './state.js';
import { showToast, escapeHtml } from './utils.js';

export let toolMode = 'fishbone';
export let chartMode = 'run'; 
let zoomLevel = 1.0;

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
        tips: "Primary Drivers are high-level factors affecting your aim. Secondary Drivers are more specific. Change Ideas are specific interventions you can test."
    },
    process: {
        title: "Process Map",
        desc: "Visualize the patient journey or workflow step-by-step.",
        tips: "Map the 'As Is' process first. Identify bottlenecks, delays, and waste. Then design your 'To Be' process."
    }
};

// CHART EDUCATION CONTENT
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
            "Point outside control limits",
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
// 1. TOOL & TAB MANAGEMENT
// ==========================================

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    applyZoom();
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
    const toolsView = document.getElementById('view-tools');
    const relativeContainer = toolsView ? toolsView.querySelector('.relative') : null;
    
    if(!helpPanel && relativeContainer) {
        helpPanel = document.createElement('div');
        helpPanel.id = 'tool-help-panel';
        helpPanel.className = 'absolute top-4 right-4 w-64 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-30 hidden';
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
            <div class="bg-indigo-50 p-2 rounded text-[10px] text-indigo-800 font-medium">
                <strong>Tip:</strong> ${info.tips}
            </div>
        `;
    }
    
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

        // Clamp values to stay within bounds
        const clampedLeft = Math.max(0, Math.min(100, newLeft));
        const clampedTop = Math.max(0, Math.min(100, newTop));

        el.style.left = `${clampedLeft}%`;
        el.style.top = `${clampedTop}%`;
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
        e.preventDefault(); 
        e.stopPropagation();
        const startX = e.clientX; 
        const startY = e.clientY;
        const startLeft = parseFloat(el.style.left) || 0; 
        const startTop = parseFloat(el.style.top) || 0;
        
        const onMove = (ev) => handleMove(ev.clientX, ev.clientY, startLeft, startTop, startX, startY);
        const onUp = () => { 
            document.removeEventListener('mousemove', onMove); 
            document.removeEventListener('mouseup', onUp); 
            handleEnd(); 
        };
        document.addEventListener('mousemove', onMove); 
        document.addEventListener('mouseup', onUp);
    };

    // Touch
    el.ontouchstart = (e) => {
        if(e.touches.length > 1) return;
        e.preventDefault(); 
        e.stopPropagation();
        const touch = e.touches[0];
        const startX = touch.clientX; 
        const startY = touch.clientY;
        const startLeft = parseFloat(el.style.left) || 0; 
        const startTop = parseFloat(el.style.top) || 0;
        
        const onTouchMove = (ev) => handleMove(ev.touches[0].clientX, ev.touches[0].clientY, startLeft, startTop, startX, startY);
        const onTouchEnd = () => { 
            document.removeEventListener('touchmove', onTouchMove); 
            document.removeEventListener('touchend', onTouchEnd); 
            handleEnd(); 
        };
        document.addEventListener('touchmove', onTouchMove, {passive: false}); 
        document.addEventListener('touchend', onTouchEnd);
    };
}

function renderFishboneVisual(container, enableInteraction = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); 
    svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; 
    svg.style.top = '0'; 
    svg.style.left = '0'; 
    svg.style.pointerEvents = 'none';
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

function renderDriverVisual(container, enableInteraction = false) {
    const d = state.projectData.drivers;
    const clean = (t) => t ? t.replace(/["()]/g, '').substring(0, 30) : '...';
    
    let mCode = `graph LR\n`;
    mCode += `  AIM["<b>AIM</b><br/>${clean(state.projectData.checklist?.aim || 'Define your aim')}"]\n`;
    mCode += `  AIM --> P["<b>Primary Drivers</b>"]\n`;
    mCode += `  P --> S["<b>Secondary</b>"]\n`;
    mCode += `  S --> C["<b>Change Ideas</b>"]\n`;
    
    d.primary.forEach((x, i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
    d.secondary.forEach((x, i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
    d.changes.forEach((x, i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid w-full h-full flex items-center justify-center text-sm';
    wrapper.textContent = mCode;
    container.appendChild(wrapper);
    
    try { 
        if (typeof mermaid !== 'undefined') {
            mermaid.run({ nodes: [wrapper] }); 
        }
    } catch(e) { 
        console.error("Mermaid rendering error:", e); 
    }

    // Editor Overlay
    if (enableInteraction && !state.isReadOnly) {
        const overlay = document.createElement('div');
        overlay.className = "absolute top-0 right-0 w-64 h-full bg-white/95 border-l border-slate-200 shadow-lg flex flex-col p-4 overflow-y-auto";
        overlay.innerHTML = `
            <h4 class="font-bold text-slate-800 text-sm mb-4">Edit Diagram</h4>
            
            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Primary Drivers</div>
                ${d.primary.map((x, i) => `
                    <div class="flex gap-1 mb-1">
                        <input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.primary[${i}]=this.value;window.saveData();window.renderTools()">
                        <button onclick="state.projectData.drivers.primary.splice(${i},1);window.saveData();window.renderTools()" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                    </div>
                `).join('')}
                <button onclick="window.addDriver('primary')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Primary</button>
            </div>
            
            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Secondary Drivers</div>
                ${d.secondary.map((x, i) => `
                    <div class="flex gap-1 mb-1">
                        <input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.secondary[${i}]=this.value;window.saveData();window.renderTools()">
                        <button onclick="state.projectData.drivers.secondary.splice(${i},1);window.saveData();window.renderTools()" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                    </div>
                `).join('')}
                <button onclick="window.addDriver('secondary')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Secondary</button>
            </div>

            <div class="mb-4">
                <div class="text-[10px] font-bold uppercase text-rcem-purple mb-1">Change Ideas</div>
                ${d.changes.map((x, i) => `
                    <div class="flex gap-1 mb-1">
                        <input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.drivers.changes[${i}]=this.value;window.saveData();window.renderTools()">
                        <button onclick="state.projectData.drivers.changes.splice(${i},1);window.saveData();window.renderTools()" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                    </div>
                `).join('')}
                <button onclick="window.addDriver('changes')" class="text-xs text-blue-600 hover:underline font-bold">+ Add Change Idea</button>
            </div>
        `;
        container.appendChild(overlay);
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function renderProcessVisual(container, enableInteraction = false) {
    const p = state.projectData.process || ["Start", "End"];
    const clean = (t) => t ? t.replace(/["()]/g, '').substring(0, 25) : '...';
    
    let mCode = `graph TD\n`;
    p.forEach((step, i) => {
        if (i < p.length - 1) {
            mCode += `  n${i}["${clean(step)}"] --> n${i + 1}["${clean(p[i + 1])}"]\n`;
        }
    });
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid w-full h-full flex items-center justify-center text-sm';
    wrapper.textContent = mCode;
    container.appendChild(wrapper);
    
    if (enableInteraction && !state.isReadOnly) {
        const overlay = document.createElement('div');
        overlay.className = "absolute top-0 right-0 w-64 h-full bg-white/95 border-l border-slate-200 shadow-lg flex flex-col p-4 overflow-y-auto";
        overlay.innerHTML = `
            <h4 class="font-bold text-slate-800 text-sm mb-4">Edit Process</h4>
            ${p.map((x, i) => `
                <div class="flex gap-1 mb-1">
                    <span class="text-xs w-4 text-slate-400">${i + 1}.</span>
                    <input class="text-xs border rounded p-1 w-full" value="${escapeHtml(x)}" onchange="state.projectData.process[${i}]=this.value;window.saveData();window.renderTools()">
                    <button onclick="state.projectData.process.splice(${i},1);window.saveData();window.renderTools()" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
            `).join('')}
            <div class="flex gap-2 mt-4">
                <button onclick="window.addStep()" class="text-xs bg-slate-800 text-white px-3 py-1.5 rounded font-bold">+ Add Step</button>
                <button onclick="window.resetProcess()" class="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-red-200">Reset</button>
            </div>
        `;
        container.appendChild(overlay);
    }
    
    try { 
        if (typeof mermaid !== 'undefined') {
            mermaid.run({ nodes: [wrapper] }); 
        }
    } catch(e) { 
        console.error("Mermaid rendering error:", e); 
    }
}

// === TOOL ACTION EXPORTS ===
export function addCauseWithWhys(catIdx) {
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
}

export function addDriver(type) {
    if(state.isReadOnly) return;
    const labels = {
        primary: "Primary Driver",
        secondary: "Secondary Driver",
        changes: "Change Idea"
    };
    const v = prompt(`Add ${labels[type] || type}:`);
    if(v) { 
        state.projectData.drivers[type].push(v); 
        window.saveData(); 
        renderTools(); 
    }
}

export function addStep() {
    if(state.isReadOnly) return;
    const v = prompt("Step Description:");
    if(v) { 
        if(!state.projectData.process) state.projectData.process = ["Start", "End"];
        // Insert before the last element ("End")
        state.projectData.process.splice(state.projectData.process.length - 1, 0, v);
        window.saveData(); 
        renderTools(); 
    }
}

export function resetProcess() {
    if(state.isReadOnly) return;
    if(confirm("Reset process map to default? This will remove all steps.")) { 
        state.projectData.process = ["Start", "End"]; 
        window.saveData(); 
        renderTools(); 
    }
}

// ==========================================
// 3. ZOOM CONTROLS
// ==========================================

export function zoomIn() {
    zoomLevel = Math.min(2.0, zoomLevel + 0.1);
    applyZoom();
    showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info");
}

export function zoomOut() {
    zoomLevel = Math.max(0.5, zoomLevel - 0.1);
    applyZoom();
    showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info");
}

export function resetZoom() {
    zoomLevel = 1.0;
    applyZoom();
    showToast("Zoom reset to 100%", "info");
}

function applyZoom() {
    const canvas = document.getElementById('diagram-canvas');
    if (canvas) {
        canvas.style.transform = `scale(${zoomLevel})`;
        canvas.style.transformOrigin = 'center center';
    }
}

// ==========================================
// 4. CHART SETTINGS
// ==========================================

export function openChartSettings() {
    const modal = document.getElementById('chart-settings-modal');
    if (!modal) {
        showToast("Settings modal not found", "error");
        return;
    }
    
    const settings = state.projectData.chartSettings || {};
    
    const titleInput = document.getElementById('chart-setting-title');
    const yAxisInput = document.getElementById('chart-setting-yaxis');
    const annotationsInput = document.getElementById('chart-setting-annotations');
    
    if (titleInput) titleInput.value = settings.title || '';
    if (yAxisInput) yAxisInput.value = settings.yAxisLabel || '';
    if (annotationsInput) annotationsInput.checked = settings.showAnnotations || false;
    
    modal.classList.remove('hidden');
}

export function saveChartSettings() {
    if (!state.projectData.chartSettings) state.projectData.chartSettings = {};
    
    const titleInput = document.getElementById('chart-setting-title');
    const yAxisInput = document.getElementById('chart-setting-yaxis');
    const annotationsInput = document.getElementById('chart-setting-annotations');
    
    state.projectData.chartSettings.title = titleInput ? titleInput.value : '';
    state.projectData.chartSettings.yAxisLabel = yAxisInput ? yAxisInput.value : '';
    state.projectData.chartSettings.showAnnotations = annotationsInput ? annotationsInput.checked : false;
    
    window.saveData();
    document.getElementById('chart-settings-modal').classList.add('hidden');
    renderChart();
    showToast("Chart settings saved", "success");
}

export function copyChartImage() {
    const canvas = document.getElementById('mainChart');
    if (!canvas) {
        showToast("No chart to copy", "error");
        return;
    }
    
    try {
        canvas.toBlob((blob) => {
            if (!blob) {
                showToast("Failed to create image", "error");
                return;
            }
            
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item]).then(() => {
                showToast("Chart copied to clipboard", "success");
            }).catch(err => {
                console.error("Clipboard write failed:", err);
                // Fallback: Open in new tab
                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'chart.png';
                link.href = url;
                link.click();
                showToast("Chart downloaded (clipboard not available)", "info");
            });
        }, 'image/png');
    } catch (err) {
        console.error("Copy chart error:", err);
        showToast("Failed to copy chart: " + err.message, "error");
    }
}

export function updateChartEducation() {
    const educationPanel = document.getElementById('chart-education-panel');
    if (!educationPanel) return;
    
    const info = CHART_EDUCATION[chartMode];
    if (!info) return;
    
    educationPanel.innerHTML = `
        <h4 class="font-bold text-slate-800 text-sm mb-2">${info.title}</h4>
        <p class="text-xs text-slate-600 mb-3">${info.desc}</p>
        <div class="space-y-1">
            ${info.rules.map(rule => `
                <div class="text-[10px] text-slate-500 flex items-start gap-2">
                    <span class="text-rcem-purple">•</span>
                    <span>${rule}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ==========================================
// 5. CSV IMPORT/EXPORT
// ==========================================

export function importCSV(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                showToast("CSV file is empty or has no data rows", "error");
                return;
            }
            
            // Parse headers (case-insensitive)
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            
            const dateIdx = headers.findIndex(h => h === 'date' || h === 'dates');
            const valueIdx = headers.findIndex(h => h === 'value' || h === 'values' || h === 'measure');
            const gradeIdx = headers.findIndex(h => h === 'grade' || h === 'type' || h === 'category' || h === 'context');
            const noteIdx = headers.findIndex(h => h === 'note' || h === 'notes' || h === 'comment' || h === 'comments');
            
            if (dateIdx === -1) {
                showToast("CSV must have a 'Date' column", "error");
                return;
            }
            
            if (valueIdx === -1) {
                showToast("CSV must have a 'Value' column", "error");
                return;
            }
            
            let imported = 0;
            let skipped = 0;
            
            for (let i = 1; i < lines.length; i++) {
                // Handle CSV parsing with possible quoted values
                const cols = parseCSVLine(lines[i]);
                
                const dateVal = cols[dateIdx]?.trim();
                const valueVal = cols[valueIdx]?.trim();
                
                if (!dateVal || !valueVal) {
                    skipped++;
                    continue;
                }
                
                const parsedValue = parseFloat(valueVal);
                if (isNaN(parsedValue)) {
                    skipped++;
                    continue;
                }
                
                // Parse Date (UK Format Support DD/MM/YYYY)
                let parsedDateStr = '';
                if (dateVal.includes('/')) {
                    const parts = dateVal.split('/');
                    if (parts.length === 3) {
                        // Assume DD/MM/YYYY or DD/MM/YY
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        let year = parts[2];
                        if (year.length === 2) year = '20' + year;
                        parsedDateStr = `${year}-${month}-${day}`;
                    } else {
                         parsedDateStr = new Date(dateVal).toISOString().split('T')[0];
                    }
                } else {
                    // Try ISO
                    const d = new Date(dateVal);
                    if (!isNaN(d.getTime())) {
                        parsedDateStr = d.toISOString().split('T')[0];
                    }
                }

                if (!parsedDateStr || isNaN(new Date(parsedDateStr).getTime())) {
                    skipped++;
                    continue;
                }
                
                const dataPoint = {
                    date: parsedDateStr,
                    value: parsedValue,
                    grade: gradeIdx !== -1 ? (cols[gradeIdx]?.trim() || '') : '',
                    note: noteIdx !== -1 ? (cols[noteIdx]?.trim() || '') : ''
                };
                
                state.projectData.chartData.push(dataPoint);
                imported++;
            }
            
            // Sort by date
            state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            window.saveData();
            if (window.renderDataView) window.renderDataView();
            
            let message = `Imported ${imported} data point${imported !== 1 ? 's' : ''}`;
            if (skipped > 0) {
                message += ` (${skipped} row${skipped !== 1 ? 's' : ''} skipped/invalid)`;
            }
            showToast(message, "success");
            
        } catch (err) {
            console.error("CSV import error:", err);
            showToast("Failed to parse CSV: " + err.message, "error");
        }
    };
    
    reader.onerror = () => {
        showToast("Failed to read file", "error");
    };
    
    reader.readAsText(file);
    input.value = ''; // Reset input for future uploads
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

export function downloadCSVTemplate() {
    const csvContent = `Date,Value,Grade,Note
01/01/2026,85,Baseline,Initial measurement
08/01/2026,87,Baseline,Second baseline point
15/01/2026,82,Baseline,Third baseline point
22/01/2026,90,Intervention,First intervention started
29/01/2026,92,Intervention,Improvement noted
05/02/2026,95,Intervention,Sustained improvement`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "qip_data_template.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    showToast("Template downloaded", "success");
}

// ==========================================
// 6. CHART RENDERERS
// ==========================================

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
        // Show empty state message
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
                title: {
                    display: !!settings.title,
                    text: settings.title || '',
                    font: { size: 16, weight: 'bold' },
                    color: '#1e293b'
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                annotation: { 
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    title: {
                        display: !!settings.yAxisLabel,
                        text: settings.yAxisLabel || '',
                        font: { weight: 'bold' }
                    },
                    beginAtZero: false
                }
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
    
    // Calculate mean
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    
    // Calculate moving range and average moving range
    let mRSum = 0; 
    for(let i = 1; i < data.length; i++) {
        mRSum += Math.abs(data[i] - data[i - 1]);
    }
    const avgMR = mRSum / (data.length - 1);
    
    // Calculate control limits (using 2.66 constant for individuals chart)
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));
    
    // Identify special cause points
    const pointColors = data.map(v => {
        if (v > ucl || v < lcl) return '#ef4444'; // Red for out of control
        return '#64748b';
    });

    // Build annotations
    const annotations = {
        ucl: { 
            type: 'line', 
            yMin: ucl, 
            yMax: ucl, 
            borderColor: '#ef4444', 
            borderDash: [2, 2],
            borderWidth: 2,
            label: {
                display: true,
                content: `UCL: ${ucl.toFixed(1)}`,
                position: 'end',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                font: { size: 9 }
            }
        }, 
        lcl: { 
            type: 'line', 
            yMin: lcl, 
            yMax: lcl, 
            borderColor: '#ef4444', 
            borderDash: [2, 2],
            borderWidth: 2,
            label: {
                display: true,
                content: `LCL: ${lcl.toFixed(1)}`,
                position: 'end',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                font: { size: 9 }
            }
        }, 
        avg: { 
            type: 'line', 
            yMin: avg, 
            yMax: avg, 
            borderColor: '#22c55e',
            borderWidth: 2,
            label: {
                display: true,
                content: `Mean: ${avg.toFixed(1)}`,
                position: 'end',
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                font: { size: 9 }
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
                borderColor: '#64748b',
                backgroundColor: '#64748b',
                pointBackgroundColor: pointColors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                tension: 0,
                fill: false
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                title: {
                    display: !!settings.title,
                    text: settings.title || '',
                    font: { size: 16, weight: 'bold' },
                    color: '#1e293b'
                },
                annotation: { 
                    annotations: annotations 
                }
            },
            scales: {
                y: {
                    title: {
                        display: !!settings.yAxisLabel,
                        text: settings.yAxisLabel || '',
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
    ctx.chartInstance = chart;
}

function renderHistogram(ctx, canvasId) {
    const d = state.projectData.chartData.map(x => x.value);
    if(d.length < 2) {
        showToast("Need at least 2 data points for histogram", "info");
        return;
    }
    
    const settings = state.projectData.chartSettings || {};
    const min = Math.min(...d); 
    const max = Math.max(...d);
    const range = max - min;
    
    // Calculate optimal number of bins using Sturges' rule
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
        data: { 
            labels: labels, 
            datasets: [{
                label: 'Frequency', 
                data: buckets, 
                backgroundColor: '#8b5cf6',
                borderColor: '#7c3aed',
                borderWidth: 1
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!settings.title,
                    text: settings.title || 'Data Distribution',
                    font: { size: 16, weight: 'bold' },
                    color: '#1e293b'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: settings.yAxisLabel || 'Value Range',
                        font: { weight: 'bold' }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency',
                        font: { weight: 'bold' }
                    },
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        } 
    });
    ctx.chartInstance = chart;
}

function renderPareto(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0) return;
    
    const settings = state.projectData.chartSettings || {};
    
    // Count frequencies by grade/category
    const counts = {}; 
    d.forEach(x => { 
        const cat = x.grade || x.category || "Uncategorised"; 
        counts[cat] = (counts[cat] || 0) + 1; 
    });
    
    // Sort categories by frequency (descending)
    const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const values = sortedCats.map(c => counts[c]);
    const total = values.reduce((a, b) => a + b, 0);
    
    // Calculate cumulative percentages
    let cum = 0; 
    const cumulative = values.map(v => { 
        cum += v; 
        return (cum / total) * 100; 
    });

    const chart = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: sortedCats, 
            datasets: [ 
                { 
                    type: 'line', 
                    label: 'Cumulative %', 
                    data: cumulative, 
                    borderColor: '#f36f21',
                    backgroundColor: 'rgba(243, 111, 33, 0.1)',
                    pointBackgroundColor: '#f36f21',
                    pointRadius: 4,
                    yAxisID: 'y1',
                    tension: 0.2,
                    fill: false
                }, 
                { 
                    type: 'bar', 
                    label: 'Frequency', 
                    data: values, 
                    backgroundColor: '#2d2e83',
                    borderColor: '#1e1f5c',
                    borderWidth: 1,
                    yAxisID: 'y'
                } 
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!settings.title,
                    text: settings.title || 'Pareto Analysis',
                    font: { size: 16, weight: 'bold' },
                    color: '#1e293b'
                }
            },
            scales: { 
                y: {
                    title: {
                        display: true,
                        text: 'Count',
                        font: { weight: 'bold' }
                    },
                    beginAtZero: true
                },
                y1: { 
                    position: 'right', 
                    max: 100,
                    title: {
                        display: true,
                        text: 'Cumulative %',
                        font: { weight: 'bold' }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        } 
    });
    ctx.chartInstance = chart;
}

// ==========================================
// 7. CHART MODE & RENDER EXPORTS
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

export function renderFullViewChart() { 
    // Check if canvas exists, if not create it
    const container = document.getElementById('full-view-chart-container');
    if (!container) return;
    
    let canvas = document.getElementById('full-view-chart-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'full-view-chart-canvas';
        container.innerHTML = '';
        container.appendChild(canvas);
    }
    
    renderChart('full-view-chart-canvas'); 
}

export function addDataPoint() {
    const dateInput = document.getElementById('chart-date');
    const valueInput = document.getElementById('chart-value');
    const gradeInput = document.getElementById('chart-grade');
    
    const d = dateInput ? dateInput.value : '';
    const v = valueInput ? valueInput.value : '';
    const g = gradeInput ? gradeInput.value : '';
    
    if(!d) { 
        showToast("Date is required", "error"); 
        return; 
    }
    
    if(!v && v !== 0) { 
        showToast("Value is required", "error"); 
        return; 
    }
    
    const parsedValue = parseFloat(v);
    if (isNaN(parsedValue)) {
        showToast("Value must be a number", "error");
        return;
    }
    
    // Validate date
    const parsedDate = new Date(d);
    if (isNaN(parsedDate.getTime())) {
        showToast("Invalid date format", "error");
        return;
    }
    
    state.projectData.chartData.push({ 
        date: d, 
        value: parsedValue, 
        grade: g 
    });
    
    // Sort by date
    state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Clear input
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
