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
        title: "Fishbone (Ishikawa) Diagram",
        desc: "A root cause analysis tool using the 6M framework: Manpower, Methods, Machines, Materials, Measurements, Mother Nature (Environment).",
        tips: "Double-click a category to add a cause. Drag labels to reposition. Use the '5 Whys' technique to drill deeper into each cause. Aim for 3-5 causes per category."
    },
    driver: {
        title: "Driver Diagram",
        desc: "Maps your Aim to Primary Drivers (high-level factors), Secondary Drivers (specific interventions), and Change Ideas (tests to run).",
        tips: "Work left-to-right: Aim → Primary → Secondary → Changes. Each column should logically flow from the previous. Click '+' to add items, edit inline, click 'x' to delete."
    },
    process: {
        title: "Process Map",
        desc: "Visualises the patient journey or clinical workflow step-by-step to identify bottlenecks, delays, and waste.",
        tips: "Map the 'As Is' process first. Look for: waiting times, handoffs, decision points, potential failure modes. Then design your 'To Be' (ideal) process."
    }
};

const CHART_EDUCATION = {
    run: {
        title: "Run Chart",
        desc: "Displays data over time with a median line. Used to detect non-random patterns indicating special cause variation.",
        rules: [
            "Shift: 6+ consecutive points above or below the median",
            "Trend: 5+ consecutive points going up or down",
            "Too few/many runs: Compare actual runs to expected",
            "Astronomical point: Unusually high or low value"
        ]
    },
    spc: {
        title: "Statistical Process Control (SPC) Chart",
        desc: "Adds Upper and Lower Control Limits (±3σ) to identify special cause variation requiring investigation.",
        rules: [
            "Rule 1: Single point outside control limits",
            "Rule 2: 8 consecutive points on one side of mean",
            "Rule 3: 6 consecutive increasing/decreasing points",
            "Rule 4: 2 of 3 consecutive points near a control limit (>2σ)"
        ]
    },
    histogram: {
        title: "Histogram",
        desc: "Shows the distribution of your data values to identify central tendency, spread, and shape.",
        rules: [
            "Normal: Bell-shaped, symmetrical distribution",
            "Skewed: Tail extends to one side (left or right)",
            "Bimodal: Two peaks - may indicate two separate processes",
            "Truncated: Cut off at one end - check for data limits"
        ]
    },
    pareto: {
        title: "Pareto Chart",
        desc: "Combines bars (frequency) with a cumulative line to visualise the 80/20 rule - often 80% of problems come from 20% of causes.",
        rules: [
            "Focus improvement on the 'vital few' bars on the left",
            "The cumulative line shows total contribution",
            "Address top 2-3 categories for maximum impact",
            "Re-Pareto after changes to see shifting priorities"
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
            btn.classList.remove('text-slate-500', 'hover:bg-slate-50', 'bg-white');
        } else {
            btn.classList.remove('bg-rcem-purple', 'text-white', 'shadow');
            btn.classList.add('text-slate-500', 'hover:bg-slate-50', 'bg-white');
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

    // Render Tabs and UI only if we are in the main diagram view
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
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderToolUI() {
    const header = document.querySelector('#view-tools header');
    if(!header) return;

    // Build the complete header with tabs and controls
    header.innerHTML = `
        <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="git-branch" class="w-5 h-5 text-rcem-purple"></i>
                Diagnosis Tools
            </h2>
            <div class="flex bg-slate-100 p-1 rounded-lg">
                <button class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'driver' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="driver" onclick="window.setToolMode('driver')">
                    <i data-lucide="git-merge" class="w-4 h-4 inline mr-1"></i> Driver Diagram
                </button>
                <button class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'fishbone' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="fishbone" onclick="window.setToolMode('fishbone')">
                    <i data-lucide="fish" class="w-4 h-4 inline mr-1"></i> Fishbone
                </button>
                <button class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'process' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="process" onclick="window.setToolMode('process')">
                    <i data-lucide="workflow" class="w-4 h-4 inline mr-1"></i> Process Map
                </button>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${toolMode === 'driver' && window.hasAI && window.hasAI() ? `
                <button onclick="window.aiSuggestDrivers()" id="btn-ai-driver" class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-all flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Generate
                </button>
            ` : ''}
            <button onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-rcem-purple p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Help">
                <i data-lucide="help-circle" class="w-5 h-5"></i>
            </button>
        </div>
    `;

    // Inject Help Panel if missing
    let helpPanel = document.getElementById('tool-help-panel');
    const toolsView = document.getElementById('view-tools');
    const relativeContainer = toolsView ? toolsView.querySelector('.relative') : null;
    
    if(!helpPanel && relativeContainer) {
        helpPanel = document.createElement('div');
        helpPanel.id = 'tool-help-panel';
        helpPanel.className = 'absolute top-4 right-4 w-72 bg-white/95 backdrop-blur shadow-xl rounded-xl border border-slate-200 p-5 z-30 hidden transition-all';
        relativeContainer.appendChild(helpPanel);
    }
    
    if (helpPanel) {
        const info = TOOL_HELP[toolMode];
        helpPanel.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h4 class="font-bold text-slate-800 text-sm">${info.title}</h4>
                <button onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <p class="text-xs text-slate-600 mb-4 leading-relaxed">${info.desc}</p>
            <div class="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-800 border border-indigo-100">
                <div class="font-bold mb-1 flex items-center gap-1"><i data-lucide="lightbulb" class="w-3 h-3"></i> Tips</div>
                <p class="leading-relaxed">${info.tips}</p>
            </div>
        `;
    }
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 3. INTERACTIVE DIAGRAM RENDERERS
// ==========================================

// --- FISHBONE DIAGRAM (IMPROVED) ---
function renderFishboneVisual(container, enableInteraction = false) {
    // Set up the container
    container.style.position = 'relative';
    container.style.minHeight = '500px';
    
    // Create SVG for the backbone
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); 
    svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; 
    svg.style.top = '0'; 
    svg.style.left = '0'; 
    svg.style.pointerEvents = 'none';
    svg.style.minHeight = '500px';
    
    // Problem statement (fish head)
    const problem = state.projectData.checklist?.problem_desc?.substring(0, 50) || 'Problem';
    
    // Draw the fishbone structure
    svg.innerHTML = `
        <!-- Main spine -->
        <line x1="8%" y1="50%" x2="92%" y2="50%" stroke="#2d2e83" stroke-width="4" stroke-linecap="round"/>
        <!-- Arrow head (fish head) -->
        <polygon points="92%,47% 98%,50% 92%,53%" fill="#2d2e83"/>
        
        <!-- Upper bones -->
        <line x1="22%" y1="20%" x2="30%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="50%" y1="20%" x2="50%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="78%" y1="20%" x2="70%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        
        <!-- Lower bones -->
        <line x1="22%" y1="80%" x2="30%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="50%" y1="80%" x2="50%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="78%" y1="80%" x2="70%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
    `;
    container.appendChild(svg);

    // Create label function
    const createLabel = (text, x, y, isCat, catIdx, causeIdx) => {
        const el = document.createElement('div');
        el.className = isCat 
            ? 'fishbone-label category' 
            : 'fishbone-label';
        el.innerText = text || '...';
        el.style.left = `${x}%`; 
        el.style.top = `${y}%`;
        
        if(!state.isReadOnly && enableInteraction) {
            makeDraggable(el, container, isCat, catIdx, causeIdx); 
            el.ondblclick = (e) => { 
                e.stopPropagation(); 
                if(isCat) {
                    window.addCauseWithWhys(catIdx); 
                } else {
                    const cause = state.projectData.fishbone.categories[catIdx].causes[causeIdx];
                    const currentText = typeof cause === 'string' ? cause : cause.text;
                    const newText = prompt("Edit Cause:", currentText);
                    if(newText !== null && newText !== '') {
                        if (typeof cause === 'string') {
                            state.projectData.fishbone.categories[catIdx].causes[causeIdx] = { text: newText, x, y };
                        } else {
                            state.projectData.fishbone.categories[catIdx].causes[causeIdx].text = newText;
                        }
                        window.saveData();
                        renderTools();
                    }
                }
            };
            
            // Right-click to delete cause
            if (!isCat) {
                el.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (confirm(`Delete cause: "${text}"?`)) {
                        state.projectData.fishbone.categories[catIdx].causes.splice(causeIdx, 1);
                        window.saveData();
                        renderTools();
                    }
                };
            }
        }
        container.appendChild(el);
    };

    // Default positions for 6 categories (6M framework)
    const categoryPositions = [
        { x: 18, y: 15 },   // Top-left (Manpower)
        { x: 82, y: 15 },   // Top-right (Methods)
        { x: 18, y: 50 },   // Middle-left (Machines)
        { x: 82, y: 50 },   // Middle-right (Materials)
        { x: 18, y: 85 },   // Bottom-left (Measurements)
        { x: 82, y: 85 }    // Bottom-right (Mother Nature)
    ];

    // Render categories and causes
    const categories = state.projectData.fishbone?.categories || [];
    
    categories.forEach((cat, i) => {
        const defaultPos = categoryPositions[i] || { x: 50, y: 50 };
        const catX = cat.x !== undefined ? cat.x : defaultPos.x;
        const catY = cat.y !== undefined ? cat.y : defaultPos.y;
        
        // Render category label
        createLabel(cat.text, catX, catY, true, i);
        
        // Render causes with offset positioning
        if (cat.causes && cat.causes.length > 0) {
            cat.causes.forEach((cause, j) => {
                const isString = typeof cause === 'string';
                const causeText = isString ? cause : cause.text;
                
                // Calculate default position based on category position
                const isLeft = catX < 50;
                const offsetX = isLeft ? (j % 2 === 0 ? -8 : 8) : (j % 2 === 0 ? -8 : 8);
                const offsetY = (j + 1) * 6 * (catY < 50 ? 1 : -1);
                
                const causeX = isString ? (catX + offsetX) : (cause.x || catX + offsetX);
                const causeY = isString ? (catY + offsetY) : (cause.y || catY + offsetY);
                
                createLabel(causeText, causeX, causeY, false, i, j);
            });
        }
    });

    // Add problem/effect label at fish head
    const effectLabel = document.createElement('div');
    effectLabel.className = 'absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm max-w-[150px] text-center shadow-lg';
    effectLabel.innerHTML = `<div class="text-[10px] uppercase opacity-75">Effect</div>${escapeHtml(problem)}...`;
    container.appendChild(effectLabel);
    
    // Add instruction text if interactive
    if (enableInteraction && !state.isReadOnly) {
        const hint = document.createElement('div');
        hint.className = 'absolute bottom-2 left-2 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded';
        hint.innerHTML = '<i data-lucide="mouse-pointer-click" class="w-3 h-3 inline"></i> Double-click category to add cause • Drag to reposition • Right-click cause to delete';
        container.appendChild(hint);
    }
}

// --- DRIVER DIAGRAM (HTML COLUMNS) ---
function renderDriverVisual(container, enableInteraction = false) {
    const d = state.projectData.drivers || { primary: [], secondary: [], changes: [] };
    
    // Main Flex Container
    container.className = "flex flex-col md:flex-row gap-4 items-stretch overflow-x-auto p-4 min-h-[500px]";
    
    // Define the 4 Columns
    const cols = [
        { 
            title: 'Aim', 
            color: 'bg-indigo-50 border-indigo-200 text-indigo-900', 
            items: [state.projectData.checklist?.aim || 'Define Aim in Checklist first'], 
            type: 'aim',
            readonly: true,
            icon: 'target'
        },
        { 
            title: 'Primary Drivers', 
            color: 'bg-blue-50 border-blue-200 text-blue-900', 
            items: d.primary || [], 
            type: 'primary',
            readonly: false,
            icon: 'zap'
        },
        { 
            title: 'Secondary Drivers', 
            color: 'bg-sky-50 border-sky-200 text-sky-900', 
            items: d.secondary || [], 
            type: 'secondary',
            readonly: false,
            icon: 'layers'
        },
        { 
            title: 'Change Ideas', 
            color: 'bg-emerald-50 border-emerald-200 text-emerald-900', 
            items: d.changes || [], 
            type: 'changes',
            readonly: false,
            icon: 'lightbulb'
        }
    ];

    cols.forEach((col, colIdx) => {
        const colDiv = document.createElement('div');
        colDiv.className = "flex-1 min-w-[220px] flex flex-col gap-3";
        
        // Column Header
        colDiv.innerHTML = `
            <div class="font-bold text-center uppercase text-xs text-slate-500 tracking-wider sticky top-0 bg-white z-10 py-2 border-b border-slate-200 flex items-center justify-center gap-2">
                <i data-lucide="${col.icon}" class="w-4 h-4"></i>
                ${col.title}
                <span class="text-slate-300 font-normal">(${col.items.length})</span>
            </div>
        `;
        
        // Items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-1';
        
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
                                    title="Generate Change Ideas from this driver" 
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
            itemsContainer.appendChild(card);
            
            // Trigger auto-resize on initial render
            const textarea = card.querySelector('textarea');
            if(textarea) {
                setTimeout(() => {
                    textarea.style.height = 'auto';
                    textarea.style.height = textarea.scrollHeight + 'px';
                }, 0);
            }
        });
        
        colDiv.appendChild(itemsContainer);

        // "Add" Button
        if (!col.readonly && !state.isReadOnly) {
            const addBtn = document.createElement('button');
            addBtn.className = "w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-rcem-purple hover:text-rcem-purple hover:bg-slate-50 font-bold text-xs transition-colors flex items-center justify-center gap-2 mt-auto";
            addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> Add ${col.title.replace('s', '')}`; 
            addBtn.onclick = () => window.addDriver(col.type);
            colDiv.appendChild(addBtn);
        }

        container.appendChild(colDiv);
    });
    
    // Add connecting arrows between columns (visual indicator)
    const arrows = document.createElement('div');
    arrows.className = 'hidden md:flex absolute inset-0 pointer-events-none items-center justify-around px-[15%]';
    arrows.innerHTML = `
        <div class="text-slate-300"><i data-lucide="arrow-right" class="w-6 h-6"></i></div>
        <div class="text-slate-300"><i data-lucide="arrow-right" class="w-6 h-6"></i></div>
        <div class="text-slate-300"><i data-lucide="arrow-right" class="w-6 h-6"></i></div>
    `;
    // Don't append arrows as they need absolute positioning which conflicts with flex
}

// --- PROCESS MAP ---
function renderProcessVisual(container, enableInteraction = false) {
    const p = state.projectData.process || ["Start", "End"];
    
    container.className = "flex flex-col items-center py-8 min-h-[500px] gap-0 overflow-y-auto";
    
    p.forEach((step, i) => {
        // Draw Connector Arrow
        if (i > 0) {
            const arrow = document.createElement('div');
            arrow.className = "h-8 w-px bg-slate-300 relative";
            arrow.innerHTML = `<div class="absolute bottom-0 left-1/2 -translate-x-1/2 text-slate-400"><i data-lucide="chevron-down" class="w-4 h-4"></i></div>`;
            container.appendChild(arrow);
        }

        const wrapper = document.createElement('div');
        wrapper.className = "relative group w-72 z-10";

        if (state.isReadOnly) {
            wrapper.innerHTML = `<div class="bg-white border-2 border-slate-800 p-4 rounded-lg text-center font-bold shadow-sm">${escapeHtml(step)}</div>`;
        } else {
            const isTerminator = i === 0 || i === p.length - 1;
            // Terminators are Black (Start/End), Steps are White with Border
            const bgClass = isTerminator 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-white border-2 border-slate-800 text-slate-800 shadow-sm';
            
            // Decision point styling (contains "?")
            const isDecision = step.includes('?');
            const shapeClass = isDecision ? 'rotate-45' : '';
            
            wrapper.innerHTML = `
                <div class="${bgClass} p-4 rounded-lg transition-transform hover:scale-[1.01] ${isDecision ? 'border-amber-500' : ''}">
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
        }, 0);
    });
    
    // Add instruction hint
    if (enableInteraction && !state.isReadOnly) {
        const hint = document.createElement('div');
        hint.className = 'mt-4 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg';
        hint.innerHTML = '<i data-lucide="info" class="w-3 h-3 inline"></i> Hover over steps to add or delete. Edit text directly.';
        container.appendChild(hint);
    }
    
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
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white shadow';
            } else {
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50';
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
    
    const d = state.projectData?.chartData || [];
    if (d.length === 0 && canvasId === 'mainChart') {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        // Show empty state message
        context.font = '14px Inter, sans-serif';
        context.fillStyle = '#94a3b8';
        context.textAlign = 'center';
        context.fillText('No data yet. Add data points to see your chart.', ctx.width / 2, ctx.height / 2);
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
                backgroundColor: 'rgba(148, 163, 184, 0.9)',
                font: { size: 10, weight: 'bold' }
            }
        }
    };
    
    // Add target line if we have a target
    const target = parseFloat(state.projectData.checklist?.aim_target);
    if (!isNaN(target)) {
        annotations.targetLine = {
            type: 'line',
            yMin: target,
            yMax: target,
            borderColor: '#22c55e',
            borderWidth: 2,
            borderDash: [10, 5],
            label: {
                display: true,
                content: `Target: ${target}%`,
                position: 'start',
                backgroundColor: 'rgba(34, 197, 94, 0.9)',
                font: { size: 10, weight: 'bold' }
            }
        };
    }
    
    // Add PDSA annotations if enabled
    if (settings.showAnnotations && state.projectData.pdsa && state.projectData.pdsa.length > 0) {
        state.projectData.pdsa.forEach((p, i) => {
            // Support both 'start' and 'startDate' field names
            const startDate = p.startDate || p.start;
            if (startDate) {
                annotations[`pdsa${i}`] = {
                    type: 'line',
                    xMin: startDate,
                    xMax: startDate,
                    borderColor: '#f36f21',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: `PDSA ${i + 1}`,
                        position: 'start',
                        backgroundColor: 'rgba(243, 111, 33, 0.9)',
                        font: { size: 9, weight: 'bold' }
                    }
                };
            }
        });
    }

    // Color points by grade/phase
    const gradeColors = {
        'Baseline': '#64748b',
        'Cycle 1': '#3b82f6',
        'Cycle 2': '#8b5cf6',
        'Cycle 3': '#ec4899',
        'Cycle 4': '#f59e0b',
        'Sustain': '#22c55e',
        'Intervention': '#f36f21'
    };
    
    const pointColors = sortedD.map(x => gradeColors[x.grade] || '#2d2e83');

    const chart = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: labels, 
            datasets: [{
                label: settings.yAxisLabel || 'Measure', 
                data: data, 
                borderColor: '#2d2e83', 
                backgroundColor: '#2d2e83',
                pointBackgroundColor: pointColors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
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
                    color: '#1e293b',
                    padding: { bottom: 20 }
                },
                legend: { display: false },
                annotation: { annotations: annotations },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const point = sortedD[context.dataIndex];
                            return point.grade ? `Phase: ${point.grade}` : '';
                        }
                    }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Date', font: { weight: 'bold' } },
                    ticks: { maxRotation: 45, minRotation: 45 }
                },
                y: { 
                    title: { display: !!settings.yAxisLabel, text: settings.yAxisLabel || '', font: { weight: 'bold' } }, 
                    beginAtZero: false,
                    suggestedMin: Math.min(...data) - 5,
                    suggestedMax: Math.max(...data) + 5
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
    
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    let mRSum = 0; 
    for(let i = 1; i < data.length; i++) { mRSum += Math.abs(data[i] - data[i - 1]); }
    const avgMR = mRSum / (data.length - 1);
    
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));
    
    // Color points outside limits red
    const pointColors = data.map(v => (v > ucl || v < lcl) ? '#ef4444' : '#64748b');

    const annotations = {
        ucl: { 
            type: 'line', yMin: ucl, yMax: ucl, 
            borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 2, 
            label: { display: true, content: `UCL: ${ucl.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(239, 68, 68, 0.9)', font: { size: 9 } } 
        }, 
        lcl: { 
            type: 'line', yMin: lcl, yMax: lcl, 
            borderColor: '#ef4444', borderDash: [2, 2], borderWidth: 2, 
            label: { display: true, content: `LCL: ${lcl.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(239, 68, 68, 0.9)', font: { size: 9 } } 
        }, 
        avg: { 
            type: 'line', yMin: avg, yMax: avg, 
            borderColor: '#22c55e', borderWidth: 2, 
            label: { display: true, content: `Mean: ${avg.toFixed(1)}`, position: 'end', backgroundColor: 'rgba(34, 197, 94, 0.9)', font: { size: 9 } } 
        }
    };

    if (settings.showAnnotations && state.projectData.pdsa) {
        state.projectData.pdsa.forEach((p, i) => {
            const startDate = p.startDate || p.start;
            if (startDate) {
                annotations[`pdsa${i}`] = { 
                    type: 'line', xMin: startDate, xMax: startDate, 
                    borderColor: '#f36f21', borderWidth: 2, borderDash: [5, 5], 
                    label: { display: true, content: `PDSA ${i + 1}`, position: 'start', backgroundColor: 'rgba(243, 111, 33, 0.9)', font: { size: 9 } } 
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
                title: { display: !!settings.title, text: settings.title || '', font: { size: 16, weight: 'bold' }, color: '#1e293b' }, 
                legend: { display: false },
                annotation: { annotations: annotations } 
            }, 
            scales: { 
                x: { ticks: { maxRotation: 45, minRotation: 45 } },
                y: { title: { display: !!settings.yAxisLabel, text: settings.yAxisLabel || '', font: { weight: 'bold' } } } 
            } 
        }
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
                title: { display: true, text: settings.title || 'Data Distribution', font: { size: 16, weight: 'bold' }, color: '#1e293b' },
                legend: { display: false }
            }, 
            scales: { 
                x: { title: { display: true, text: settings.yAxisLabel || 'Value Range', font: { weight: 'bold' } } }, 
                y: { title: { display: true, text: 'Frequency', font: { weight: 'bold' } }, beginAtZero: true, ticks: { stepSize: 1 } } 
            } 
        } 
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
                title: { display: true, text: settings.title || 'Pareto Analysis', font: { size: 16, weight: 'bold' }, color: '#1e293b' } 
            }, 
            scales: { 
                y: { title: { display: true, text: 'Count', font: { weight: 'bold' } }, beginAtZero: true }, 
                y1: { position: 'right', max: 100, title: { display: true, text: 'Cumulative %', font: { weight: 'bold' } }, grid: { drawOnChartArea: false } } 
            } 
        } 
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
    
    if (!state.projectData.chartData) state.projectData.chartData = [];
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
    const csvContent = "data:text/csv;charset=utf-8,Date,Value,Context\n2025-01-01,10,Baseline\n2025-01-02,12,Baseline\n2025-01-08,15,Intervention";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "qip_data_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// FIXED: importCSV now accepts input element directly instead of event
export function importCSV(input) {
    const file = input.files ? input.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        let count = 0;
        if (!state.projectData.chartData) state.projectData.chartData = [];
        lines.forEach((l, i) => {
            if(i === 0) return; // Header
            const parts = l.split(',');
            if(parts.length >= 2) {
                const d = parts[0].trim();
                const v = parseFloat(parts[1].trim());
                if(d && !isNaN(v)) {
                    state.projectData.chartData.push({date: d, value: v, grade: parts[2] ? parts[2].trim() : 'Baseline'});
                    count++;
                }
            }
        });
        window.saveData();
        if(window.renderDataView) window.renderDataView();
        showToast(`Imported ${count} data points`, "success");
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
        if(ideas && Array.isArray(ideas)) {
            if (!state.projectData.drivers.changes) state.projectData.drivers.changes = [];
            state.projectData.drivers.changes.push(...ideas);
            window.saveData();
            renderTools();
            showToast(`${ideas.length} ideas added!`, "success");
        }
    } else {
        showToast("AI module not loaded", "error");
    }
};

window.addCauseWithWhys = (catIdx) => {
    if(state.isReadOnly) return;
    let cause = prompt("What is the cause?");
    if (!cause) return;
    
    const cat = state.projectData.fishbone.categories[catIdx];
    if (!cat.causes) cat.causes = [];
    
    // Calculate position based on category position and existing causes
    const categoryPositions = [
        { x: 18, y: 15 }, { x: 82, y: 15 },
        { x: 18, y: 50 }, { x: 82, y: 50 },
        { x: 18, y: 85 }, { x: 82, y: 85 }
    ];
    const defaultPos = categoryPositions[catIdx] || { x: 50, y: 50 };
    const catX = cat.x !== undefined ? cat.x : defaultPos.x;
    const catY = cat.y !== undefined ? cat.y : defaultPos.y;
    const isLeft = catX < 50;
    const j = cat.causes.length;
    const offsetX = isLeft ? (j % 2 === 0 ? -10 : 10) : (j % 2 === 0 ? -10 : 10);
    const offsetY = (j + 1) * 6 * (catY < 50 ? 1 : -1);
    
    cat.causes.push({ 
        text: cause, 
        x: Math.max(5, Math.min(95, catX + offsetX)),
        y: Math.max(5, Math.min(95, catY + offsetY))
    });
    
    window.saveData();
    renderTools();
    showToast("Cause added - double-click to edit", "success");
};

export function resetProcess() {
    if(state.isReadOnly) return;
    if(confirm("Reset process map to default?")) { 
        state.projectData.process = ["Start", "End"]; 
        window.saveData(); 
        renderTools(); 
        showToast("Process map reset", "info");
    }
}

// Drag Helper for Fishbone
export function makeDraggable(el, container, isCat, catIdx, causeIdx, onDragEnd) {
    if(state.isReadOnly) return;
    
    el.style.cursor = 'grab';
    
    const handleMove = (cx, cy, sl, st, sx, sy) => {
        const pw = container.offsetWidth || 1000;
        const ph = container.offsetHeight || 600;
        const dx = cx - sx;
        const dy = cy - sy;
        const nl = Math.max(2, Math.min(98, sl + (dx / pw * 100)));
        const nt = Math.max(2, Math.min(98, st + (dy / ph * 100)));
        el.style.left = `${nl}%`; 
        el.style.top = `${nt}%`;
        return { x: nl, y: nt };
    };
    
    const handleEnd = () => {
        el.style.cursor = 'grab';
        const nx = parseFloat(el.style.left);
        const ny = parseFloat(el.style.top);
        
        if (onDragEnd) {
            onDragEnd(nx, ny);
        } else {
            if (isCat) { 
                state.projectData.fishbone.categories[catIdx].x = nx; 
                state.projectData.fishbone.categories[catIdx].y = ny; 
            } else { 
                const cause = state.projectData.fishbone.categories[catIdx].causes[causeIdx];
                if (typeof cause === 'string') {
                    state.projectData.fishbone.categories[catIdx].causes[causeIdx] = { text: cause, x: nx, y: ny };
                } else {
                    cause.x = nx;
                    cause.y = ny;
                }
            }
        }
        window.saveData(true);
    };
    
    el.onmousedown = (e) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault(); 
        e.stopPropagation();
        el.style.cursor = 'grabbing';
        const sx = e.clientX, sy = e.clientY, sl = parseFloat(el.style.left) || 0, st = parseFloat(el.style.top) || 0;
        const onMove = (ev) => handleMove(ev.clientX, ev.clientY, sl, st, sx, sy);
        const onUp = () => { 
            document.removeEventListener('mousemove', onMove); 
            document.removeEventListener('mouseup', onUp); 
            handleEnd(); 
        };
        document.addEventListener('mousemove', onMove); 
        document.addEventListener('mouseup', onUp);
    };
    
    el.ontouchstart = (e) => {
        if(e.touches.length > 1) return;
        e.preventDefault(); 
        e.stopPropagation();
        const t = e.touches[0], sx = t.clientX, sy = t.clientY, sl = parseFloat(el.style.left) || 0, st = parseFloat(el.style.top) || 0;
        const onMove = (ev) => handleMove(ev.touches[0].clientX, ev.touches[0].clientY, sl, st, sx, sy);
        const onEnd = () => { 
            document.removeEventListener('touchmove', onMove); 
            document.removeEventListener('touchend', onEnd); 
            handleEnd(); 
        };
        document.addEventListener('touchmove', onMove, {passive: false}); 
        document.addEventListener('touchend', onEnd);
    };
}

export function zoomIn() { zoomLevel = Math.min(2.0, zoomLevel + 0.1); applyZoom(); showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info"); }
export function zoomOut() { zoomLevel = Math.max(0.5, zoomLevel - 0.1); applyZoom(); showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`, "info"); }
export function resetZoom() { zoomLevel = 1.0; applyZoom(); showToast("Zoom reset", "info"); }
function applyZoom() { 
    const c = document.getElementById('diagram-canvas'); 
    if (c) { 
        c.style.transform = `scale(${zoomLevel})`; 
        c.style.transformOrigin = 'center center'; 
    } 
}

export function openChartSettings() { 
    const m = document.getElementById('chart-settings-modal'); 
    if(m) {
        const s = state.projectData.chartSettings || {};
        const t = document.getElementById('chart-setting-title'); if(t) t.value = s.title || '';
        const y = document.getElementById('chart-setting-yaxis'); if(y) y.value = s.yAxisLabel || '';
        const a = document.getElementById('chart-setting-annotations'); if(a) a.checked = s.showAnnotations || false;
        m.classList.remove('hidden'); 
        m.classList.add('flex');
    } 
}

export function saveChartSettings() {
    if (!state.projectData.chartSettings) state.projectData.chartSettings = {};
    const t = document.getElementById('chart-setting-title'); state.projectData.chartSettings.title = t ? t.value : '';
    const y = document.getElementById('chart-setting-yaxis'); state.projectData.chartSettings.yAxisLabel = y ? y.value : '';
    const a = document.getElementById('chart-setting-annotations'); state.projectData.chartSettings.showAnnotations = a ? a.checked : false;
    window.saveData();
    document.getElementById('chart-settings-modal').classList.add('hidden');
    document.getElementById('chart-settings-modal').classList.remove('flex');
    renderChart();
    showToast("Chart settings saved", "success");
}

export function copyChartImage() {
    const c = document.getElementById('mainChart');
    if(c) {
        c.toBlob(b => { 
            if (b) {
                navigator.clipboard.write([new ClipboardItem({'image/png': b})])
                    .then(() => showToast("Chart copied to clipboard!", "success"))
                    .catch(() => showToast("Copy failed - try right-click to save", "error")); 
            }
        });
    }
}

export function updateChartEducation() {
    const p = document.getElementById('chart-education-panel');
    if (!p) return;
    const i = CHART_EDUCATION[chartMode];
    if (i) {
        p.innerHTML = `
            <h4 class="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                <i data-lucide="graduation-cap" class="w-4 h-4 text-rcem-purple"></i>
                ${i.title}
            </h4>
            <p class="text-xs text-slate-600 mb-3 leading-relaxed">${i.desc}</p>
            <div class="space-y-1.5">
                <div class="text-xs font-bold text-slate-500 uppercase">Detection Rules:</div>
                ${i.rules.map(r => `
                    <div class="text-xs text-slate-600 flex items-start gap-2">
                        <span class="text-rcem-purple mt-0.5">•</span>
                        <span>${r}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function renderFullViewChart() {
    const c = document.getElementById('full-view-chart-container');
    if (!c) return;
    let cv = document.getElementById('full-view-chart-canvas');
    if (!cv) { 
        cv = document.createElement('canvas'); 
        cv.id = 'full-view-chart-canvas'; 
        c.innerHTML = ''; 
        c.appendChild(cv); 
    }
    renderChart('full-view-chart-canvas');
}
