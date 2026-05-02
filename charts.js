import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea } from "./utils.js";

export let toolMode = 'driver'; 
export let chartMode = 'run';   
let zoomLevel = 1.0;

const TOOL_HELP = {
    fishbone: {
        title: "Fishbone Ishikawa Diagram",
        desc: "A root cause analysis tool using the 6M framework.",
        tips: "Double-click a category to add a cause. Drag labels to reposition. Aim for 3-5 causes per category."
    },
    driver: {
        title: "Driver Diagram",
        desc: "Maps your Aim to Primary Drivers, Secondary Drivers, and Change Ideas.",
        tips: "Work left-to-right: Aim, Primary, Secondary, Changes. Click the plus icon to add items."
    },
    process: {
        title: "Process Map",
        desc: "Visualises the patient journey or clinical workflow step-by-step.",
        tips: "Map the current process first. Look for waiting times and bottlenecks."
    }
};

const CHART_EDUCATION = {
    run: {
        title: "Run Chart Guidance",
        desc: "A run chart plots your data chronologically. It adds a median line calculated from your baseline data to help you visualise improvement. Add at least 10 to 12 data points before implementing your first PDSA cycle. Record each data point regularly to establish an accurate baseline.",
        rules: [
            "Shift: Six or more consecutive points fall above or below the median line. This indicates a non-random change.",
            "Trend: Five or more consecutive points consistently go up or down.",
            "Astronomical point: An unusually high or low value that warrants immediate investigation.",
            "Record your baseline data first. Add interventions using the phase dropdown."
        ]
    },
    spc: {
        title: "Statistical Process Control Chart Guidance",
        desc: "SPC charts plot data against a calculated mean and establish Upper and Lower Control Limits. They help distinguish between common cause variation and special cause variation.",
        rules: [
            "Rule 1: A single point falls outside the control limits.",
            "Rule 2: Eight consecutive points fall on the same side of the mean line.",
            "Rule 3: Six consecutive points steadily increase or decrease.",
            "Use this chart to confirm your intervention caused a statistically significant improvement."
        ]
    },
    histogram: {
        title: "Histogram Guidance",
        desc: "Histograms show the frequency distribution of your continuous data. They divide your data into bins to visualise the shape and spread of your measurements. Use this to identify if your process output clusters around a specific value.",
        rules: [
            "Normal: Bell-shaped and symmetrical.",
            "Skewed: The tail extends heavily to the left or right.",
            "Bimodal: Two distinct peaks indicate two separate underlying processes."
        ]
    },
    pareto: {
        title: "Pareto Chart Guidance",
        desc: "A Pareto chart combines a bar chart with a cumulative line graph. It highlights the 80/20 rule, showing that 80 percent of problems often stem from 20 percent of causes. Use this chart to determine which issues to tackle first for maximum impact.",
        rules: [
            "Focus your initial PDSA cycles on the tallest bars on the left.",
            "The orange line shows the cumulative percentage.",
            "Re-run this chart after interventions to observe shifting priorities."
        ]
    }
};

export function setToolMode(m) {
    toolMode = m;
    zoomLevel = 1.0;
    applyZoom();
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
    
    if (!canvas) {
        return;
    }

    if (targetId === 'diagram-canvas') {
        renderToolUI();
    }

    const mode = overrideMode || toolMode;
    canvas.innerHTML = ''; 
    
    try {
        if (mode === 'fishbone') {
            renderFishboneVisual(canvas, targetId === 'diagram-canvas');
        } else if (mode === 'driver') {
            renderDriverVisual(canvas, targetId === 'diagram-canvas');
        } else if (mode === 'process') {
            renderProcessVisual(canvas, targetId === 'diagram-canvas');
        }
    } catch (error) {
        canvas.innerHTML = `<div class="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
            <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2"></i>
            <p class="font-bold">Failed to render diagram</p>
            <p class="text-sm mt-1 text-red-400">${error.message}</p>
        </div>`;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderToolUI() {
    const header = document.querySelector('#view-tools header');
    if(!header) return;

    header.innerHTML = `
        <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="git-branch" class="w-5 h-5 text-rcem-purple"></i>
                Diagnosis Tools
            </h2>
            <div class="flex bg-slate-100 p-1 rounded-lg">
                <button aria-label="Open Driver Diagram" class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'driver' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="driver" onclick="window.setToolMode('driver')">
                    <i data-lucide="git-merge" class="w-4 h-4 inline mr-1"></i> Driver Diagram
                </button>
                <button aria-label="Open Fishbone Diagram" class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'fishbone' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="fishbone" onclick="window.setToolMode('fishbone')">
                    <i data-lucide="fish" class="w-4 h-4 inline mr-1"></i> Fishbone
                </button>
                <button aria-label="Open Process Map" class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'process' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="process" onclick="window.setToolMode('process')">
                    <i data-lucide="workflow" class="w-4 h-4 inline mr-1"></i> Process Map
                </button>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${toolMode === 'fishbone' ? `
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
                    <span class="text-xs text-slate-500 mr-1">Zoom</span>
                    <button aria-label="Zoom Out" onclick="window.zoomOut()" class="text-slate-600 hover:text-rcem-purple p-1 rounded hover:bg-white transition-all" title="Zoom out"><i data-lucide="minus" class="w-4 h-4"></i></button>
                    <button aria-label="Reset Zoom" onclick="window.resetZoom()" class="text-xs text-slate-600 hover:text-rcem-purple px-2 py-1 rounded hover:bg-white transition-all font-mono" title="Reset zoom">100%</button>
                    <button aria-label="Zoom In" onclick="window.zoomIn()" class="text-slate-600 hover:text-rcem-purple p-1 rounded hover:bg-white transition-all" title="Zoom in"><i data-lucide="plus" class="w-4 h-4"></i></button>
                </div>
            ` : ''}
            ${toolMode === 'driver' && window.hasAI && window.hasAI() ? `
                <button aria-label="Auto-generate Drivers" onclick="window.aiSuggestDrivers()" id="btn-ai-driver" class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-all flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Generate
                </button>
            ` : ''}
            <button aria-label="Toggle Help" onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-rcem-purple p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Help">
                <i data-lucide="help-circle" class="w-5 h-5"></i>
            </button>
        </div>
    `;

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
                <button aria-label="Close Help" onclick="window.toggleToolHelp()" class="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
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

function renderFishboneVisual(container, enableInteraction = false) {
    container.style.position = 'relative';
    container.style.minHeight = '500px';
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%"); 
    svg.setAttribute("height", "100%"); 
    svg.style.position = 'absolute'; 
    svg.style.top = '0'; 
    svg.style.left = '0'; 
    svg.style.pointerEvents = 'none';
    svg.style.minHeight = '500px';
    
    const problem = state.projectData.checklist?.problem_desc?.substring(0, 50) || 'Problem';
    
    svg.innerHTML = `
        <line x1="8%" y1="50%" x2="92%" y2="50%" stroke="#2d2e83" stroke-width="4" stroke-linecap="round"/>
        <polygon points="92%,47% 98%,50% 92%,53%" fill="#2d2e83"/>
        
        <line x1="22%" y1="20%" x2="30%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="50%" y1="20%" x2="50%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="78%" y1="20%" x2="70%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        
        <line x1="22%" y1="80%" x2="30%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="50%" y1="80%" x2="50%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
        <line x1="78%" y1="80%" x2="70%" y2="50%" stroke="#94a3b8" stroke-width="2"/>
    `;
    container.appendChild(svg);

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
                    window.showInputModal(
                        'Edit Cause',
                        [{ id: 'text', label: 'Cause', type: 'text', placeholder: 'Describe the cause…', value: currentText, required: true }],
                        (data) => {
                            if (typeof cause === 'string') {
                                state.projectData.fishbone.categories[catIdx].causes[causeIdx] = { text: data.text, x, y };
                            } else {
                                state.projectData.fishbone.categories[catIdx].causes[causeIdx].text = data.text;
                            }
                            window.saveData();
                            renderTools();
                        },
                        'Save'
                    );
                }
            };
            
            if (!isCat) {
                el.oncontextmenu = (e) => {
                    e.preventDefault();
                    window.showConfirmDialog(`Delete cause: "${text}"?`, () => {
                        state.projectData.fishbone.categories[catIdx].causes.splice(causeIdx, 1);
                        window.saveData();
                        renderTools();
                    }, 'Delete', 'Delete Cause');
                };
            }
        }
        container.appendChild(el);
    };

    const categoryPositions = [
        { x: 18, y: 15 },   
        { x: 82, y: 15 },   
        { x: 18, y: 50 },   
        { x: 82, y: 50 },   
        { x: 18, y: 85 },   
        { x: 82, y: 85 }    
    ];

    if (!state.projectData.fishbone) {
        state.projectData.fishbone = { categories: [] };
    }
    
    let categories = state.projectData.fishbone.categories || [];
    if (categories.length === 0) {
        categories = [
            { text: "Patient", causes: [] },
            { text: "Staff", causes: [] },
            { text: "Equipment", causes: [] },
            { text: "Process", causes: [] },
            { text: "Environment", causes: [] },
            { text: "Management", causes: [] }
        ];
        state.projectData.fishbone.categories = categories;
    }
    
    categories.forEach((cat, i) => {
        const defaultPos = categoryPositions[i] || { x: 50, y: 50 };
        const catX = cat.x !== undefined ? cat.x : defaultPos.x;
        const catY = cat.y !== undefined ? cat.y : defaultPos.y;
        
        createLabel(cat.text, catX, catY, true, i);
        
        if (cat.causes && cat.causes.length > 0) {
            cat.causes.forEach((cause, j) => {
                const isString = typeof cause === 'string';
                const causeText = isString ? cause : cause.text;
                
                const isLeft = catX < 50;
                const offsetX = isLeft ? (j % 2 === 0 ? -8 : 8) : (j % 2 === 0 ? -8 : 8);
                const offsetY = (j + 1) * 6 * (catY < 50 ? 1 : -1);
                
                const causeX = isString ? (catX + offsetX) : (cause.x || catX + offsetX);
                const causeY = isString ? (catY + offsetY) : (cause.y || catY + offsetY);
                
                createLabel(causeText, causeX, causeY, false, i, j);
            });
        }
    });

    const effectLabel = document.createElement('div');
    effectLabel.className = 'absolute right-2 top-1/2 -translate-y-1/2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm max-w-[150px] text-center shadow-lg';
    effectLabel.innerHTML = `<div class="text-[10px] uppercase opacity-75">Effect</div>${escapeHtml(problem)}...`;
    container.appendChild(effectLabel);
    
    if (enableInteraction && !state.isReadOnly) {
        const hint = document.createElement('div');
        hint.className = 'absolute bottom-2 left-2 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded';
        hint.innerHTML = '<i data-lucide="mouse-pointer-click" class="w-3 h-3 inline"></i> Double-click category to add cause. Drag to reposition. Right-click cause to delete.';
        container.appendChild(hint);
    }
}

function renderDriverVisual(container, enableInteraction = false) {
    const d = state.projectData.drivers || { primary: [], secondary: [], changes: [] };
    
    container.className = "flex flex-col md:flex-row gap-4 items-stretch overflow-x-auto p-4 min-h-[500px]";
    
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
        
        colDiv.innerHTML = `
            <div class="font-bold text-center uppercase text-xs text-slate-500 tracking-wider sticky top-0 bg-white z-10 py-2 border-b border-slate-200 flex items-center justify-center gap-2">
                <i data-lucide="${col.icon}" class="w-4 h-4"></i>
                ${col.title}
                <span class="text-slate-300 font-normal">(${col.items.length})</span>
            </div>
        `;
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-1';
        
        col.items.forEach((item, itemIdx) => {
            const card = document.createElement('div');
            card.className = `${col.color} p-4 rounded-lg border shadow-sm text-sm font-medium relative group hover:shadow-md transition-all`;
            
            if (col.readonly) {
                card.innerHTML = `<div class="italic leading-relaxed text-slate-700">${escapeHtml(item)}</div>`;
            } else {
                if (state.isReadOnly) {
                    card.textContent = item;
                } else {
                    let aiBtn = '';
                    if (col.type === 'secondary' && window.hasAI && window.hasAI()) {
                        aiBtn = `
                            <button aria-label="Generate Change Idea" onclick="window.runChangeGen('${col.type}', ${itemIdx})" 
                                    title="Generate Change Ideas from this driver" 
                                    class="absolute -top-2 -right-2 bg-white text-emerald-600 border border-emerald-200 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-emerald-50 transition-all z-20">
                                <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                            </button>`;
                    }

                    card.innerHTML = `
                        <textarea 
                            class="w-full bg-transparent border-none focus:ring-0 p-0 resize-none text-sm leading-relaxed overflow-hidden outline-none" 
                            oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
                            onchange="window.updateDriver('${col.type}', ${itemIdx}, this.value)">${escapeHtml(item)}</textarea>
                        <button aria-label="Remove Driver" onclick="window.removeDriver('${col.type}', ${itemIdx})" 
                                class="absolute top-1 right-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/50">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                        ${aiBtn}
                    `;
                }
            }
            itemsContainer.appendChild(card);
            
            const textarea = card.querySelector('textarea');
            if(textarea) {
                setTimeout(() => {
                    textarea.style.height = 'auto';
                    textarea.style.height = textarea.scrollHeight + 'px';
                }, 0);
            }
        });
        
        colDiv.appendChild(itemsContainer);

        if (!col.readonly && !state.isReadOnly) {
            const addBtn = document.createElement('button');
            addBtn.setAttribute('aria-label', `Add ${col.title}`);
            addBtn.className = "w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-rcem-purple hover:text-rcem-purple hover:bg-slate-50 font-bold text-xs transition-colors flex items-center justify-center gap-2 mt-auto";
            addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> Add ${col.title.replace('s', '')}`; 
            addBtn.onclick = () => window.addDriver(col.type);
            colDiv.appendChild(addBtn);
        }

        container.appendChild(colDiv);
    });
}

function renderProcessVisual(container, enableInteraction = false) {
    const p = state.projectData.process || ["Start", "End"];
    
    container.className = "flex flex-col items-center py-8 min-h-[500px] gap-0 overflow-y-auto";
    
    p.forEach((step, i) => {
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
            const bgClass = isTerminator 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'bg-white border-2 border-slate-800 text-slate-800 shadow-sm';
            
            const isDecision = step.includes('?');
            
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
                    <button aria-label="Add Process Step" onclick="window.addStep(${i})" class="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded" title="Add Step After">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </button>
                    ${!isTerminator ? `
                    <button aria-label="Remove Process Step" onclick="window.removeStep(${i})" class="text-red-600 hover:bg-red-50 p-1.5 rounded" title="Delete Step">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>` : ''}
                </div>
            `;
        }
        container.appendChild(wrapper);
        
        setTimeout(() => {
            const ta = wrapper.querySelector('textarea');
            if(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
        }, 0);
    });
    
    if (enableInteraction && !state.isReadOnly) {
        const hint = document.createElement('div');
        hint.className = 'mt-4 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg';
        hint.innerHTML = '<i data-lucide="info" class="w-3 h-3 inline"></i> Hover over steps to add or delete. Edit text directly.';
        container.appendChild(hint);
    }
}

export function setChartMode(m) { 
    chartMode = m; 
    
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
    const oldCtx = document.getElementById(canvasId);
    if (!oldCtx) return;

    if (oldCtx.chartInstance) {
        oldCtx.chartInstance.destroy();
        oldCtx.chartInstance = null;
    }

    const newCtx = oldCtx.cloneNode(true);
    oldCtx.parentNode.replaceChild(newCtx, oldCtx);
    const ctx = newCtx;

    const d = state.projectData?.chartData || [];
    
    if (d.length === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: { labels: ['No Data'], datasets: [{ data: [] }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'No Data Yet - Add points to see your chart', color: '#94a3b8', font: { weight: 'normal' } }
                },
                scales: {
                    x: { display: true },
                    y: { display: true, min: 0, max: 100 }
                }
            }
        });
        ctx.chartInstance = chart;
        return;
    }
    
    try {
        if (chartMode === 'run') renderRunChart(ctx, canvasId);
        else if (chartMode === 'spc') renderSPCChart(ctx, canvasId);
        else if (chartMode === 'histogram') renderHistogram(ctx, canvasId);
        else if (chartMode === 'pareto') renderPareto(ctx, canvasId);
    } catch (error) {
        console.error("[renderChart] Error drawing chart:", error);
    }
}

function getPDSAAnnotations() {
    const annotations = {};
    if (state.projectData.pdsa && state.projectData.pdsa.length > 0) {
        state.projectData.pdsa.forEach((p, i) => {
            const startDate = p.startDate || p.start;
            if (startDate) {
                // Short label: cycle number + first 20 chars of title
                const title = p.title ? p.title.substring(0, 20) + (p.title.length > 20 ? '…' : '') : `Cycle ${i + 1}`;
                annotations[`pdsa_${i}`] = {
                    type: 'line',
                    xMin: startDate,
                    xMax: startDate,
                    borderColor: '#f36f21',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: `C${i + 1}: ${title}`,
                        position: 'start',
                        backgroundColor: 'rgba(243, 111, 33, 0.9)',
                        color: 'white',
                        font: { size: 10, weight: 'bold' }
                    }
                };
            }
        });
    }
    return annotations;
}

function renderRunChart(ctx, canvasId) {
    const d = state.projectData.chartData;
    if(d.length === 0) return;
    
    const settings = state.projectData.chartSettings || {};
    const sortedD = [...d].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedD.map(x => x.date);
    const data = sortedD.map(x => x.value);
    
    let baselineData = data.slice(0, Math.min(12, data.length));
    let sortedBase = [...baselineData].sort((a, b) => a - b);
    let median = sortedBase.length ? sortedBase[Math.floor(sortedBase.length / 2)] : 0;

    let annotations = {
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
    
    // Show PDSA annotations by default if any cycles have start dates, or if explicitly enabled
    const hasPDSADates = (state.projectData.pdsa || []).some(p => p.startDate || p.start);
    if (settings.showAnnotations !== false && hasPDSADates) {
        const pdsaAnnotations = getPDSAAnnotations();
        annotations = { ...annotations, ...pdsaAnnotations };
    }

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
    const avgMR = mRSum / (data.length - 1) || 1;
    
    const ucl = avg + (2.66 * avgMR);
    const lcl = Math.max(0, avg - (2.66 * avgMR));
    
    const pointColors = data.map(v => (v > ucl || v < lcl) ? '#ef4444' : '#64748b');

    let annotations = {
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

    // Show PDSA annotations by default if any cycles have start dates
    const hasPDSADatesSPC = (state.projectData.pdsa || []).some(p => p.startDate || p.start);
    if (settings.showAnnotations !== false && hasPDSADatesSPC) {
        const pdsaAnnotations = getPDSAAnnotations();
        annotations = { ...annotations, ...pdsaAnnotations };
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
    if(d.length < 2) { 
        showToast("Need at least 2 data points for histogram", "info"); 
        const chart = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['No Data'], datasets: [{ data: [] }] },
            options: { plugins: { title: { display: true, text: 'Add more data for histogram' } } }
        });
        ctx.chartInstance = chart;
        return; 
    }
    
    const settings = state.projectData.chartSettings || {};
    const min = Math.min(...d); 
    const max = Math.max(...d);
    const range = max - min || 1;
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
                    label: 'Cumulative Percentage', 
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
                y1: { position: 'right', max: 100, title: { display: true, text: 'Cumulative Percentage', font: { weight: 'bold' } }, grid: { drawOnChartArea: false } } 
            } 
        } 
    });
    ctx.chartInstance = chart;
}

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
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    if (!state.projectData.chartData) state.projectData.chartData = [];
    state.projectData.chartData.push({ id: id, date: d, value: parsedValue, grade: g });
    state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (valueInput) valueInput.value = '';
    window.saveData();
    if(window.renderDataView) window.renderDataView();
    showToast("Data point added", "success");
}

export function deleteDataPoint(idOrDate) {
    window.showConfirmDialog('Delete this data point?', () => {
        const idx = state.projectData.chartData.findIndex(x => x.id === idOrDate || x.date === idOrDate);
        if (idx > -1) { 
            state.projectData.chartData.splice(idx, 1); 
            window.saveData(); 
            if (window.renderDataView) window.renderDataView();
            showToast('Data point deleted', 'info');
        }
    }, 'Delete', 'Delete Data Point');
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

export function importCSV(input) {
    const file = input.files ? input.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        let count = 0;
        if (!state.projectData.chartData) state.projectData.chartData = [];

        const header = lines[0].toLowerCase();
        let dateIdx = 0;
        let valIdx = 1;
        let gradeIdx = 2;

        const isEHR = header.includes('arrival') || header.includes('epic') || header.includes('cerner');
        if (isEHR) {
            const parts = header.split(',');
            dateIdx = parts.findIndex(p => p.includes('date') || p.includes('time') || p.includes('arrival'));
            valIdx = parts.findIndex(p => p.includes('value') || p.includes('result') || p.includes('duration'));
            if (dateIdx === -1) dateIdx = 0;
            if (valIdx === -1) valIdx = 1;
        }

        lines.forEach((l, i) => {
            if(i === 0) return;
            const parts = l.split(',');
            if(parts.length >= 2) {
                const d = parts[dateIdx] ? parts[dateIdx].trim() : '';
                const v = parseFloat(parts[valIdx] ? parts[valIdx].trim() : '');
                if(d && !isNaN(v)) {
                    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                    const g = parts[gradeIdx] ? parts[gradeIdx].trim() : 'Baseline';
                    state.projectData.chartData.push({id: id, date: d, value: v, grade: g});
                    count++;
                }
            }
        });
        window.saveData();
        if(window.renderDataView) window.renderDataView();
        showToast("Imported data points successfully", "success");
    };
    reader.readAsText(file);
    input.value = '';
}

window.addDriver = (type) => {
    if (!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
    if (!state.projectData.drivers[type]) state.projectData.drivers[type] = [];
    state.projectData.drivers[type].push("New Item");
    window.saveData();
    renderTools('diagram-canvas', 'driver');
};

window.updateDriver = (type, index, value) => {
    if (state.projectData.drivers && state.projectData.drivers[type]) {
        state.projectData.drivers[type][index] = value;
        window.saveData();
    }
};

window.removeDriver = (type, index) => {
    window.showConfirmDialog('Remove this driver diagram item?', () => {
        state.projectData.drivers[type].splice(index, 1);
        window.saveData();
        renderTools('diagram-canvas', 'driver');
    }, 'Remove', 'Remove Item');
};

window.addStep = (index) => {
    if(!state.projectData.process) state.projectData.process = ["Start", "End"];
    state.projectData.process.splice(index + 1, 0, "New Step");
    window.saveData();
    renderTools('diagram-canvas', 'process'); 
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
    renderTools('diagram-canvas', 'process'); 
};

window.runChangeGen = async (type, index) => {
    if(window.generateChangeIdeas) {
        const driverName = state.projectData.drivers[type][index];
        showToast("Generating ideas...", "info");
        const ideas = await window.generateChangeIdeas(driverName);
        if(ideas && Array.isArray(ideas)) {
            if (!state.projectData.drivers.changes) state.projectData.drivers.changes = [];
            state.projectData.drivers.changes.push(...ideas);
            window.saveData();
            renderTools('diagram-canvas', 'driver');
            showToast(`${ideas.length} ideas added.`, "success");
        }
    } else {
        showToast("AI module not loaded", "error");
    }
};

window.addCauseWithWhys = (catIdx) => {
    if (state.isReadOnly) return;
    const catName = state.projectData.fishbone?.categories?.[catIdx]?.text || 'this category';
    window.showInputModal(
        `Add Cause — ${catName}`,
        [{ id: 'cause', label: 'Cause', type: 'text', placeholder: 'e.g. Lack of training / Equipment not available', required: true }],
        (data) => {
            const cat = state.projectData.fishbone.categories[catIdx];
            if (!cat.causes) cat.causes = [];
            const categoryPositions = [
                { x: 18, y: 15 }, { x: 82, y: 15 },
                { x: 18, y: 50 }, { x: 82, y: 50 },
                { x: 18, y: 85 }, { x: 82, y: 85 }
            ];
            const defaultPos = categoryPositions[catIdx] || { x: 50, y: 50 };
            const catX = cat.x !== undefined ? cat.x : defaultPos.x;
            const catY = cat.y !== undefined ? cat.y : defaultPos.y;
            const j = cat.causes.length;
            const offsetX = j % 2 === 0 ? -10 : 10;
            const offsetY = (j + 1) * 6 * (catY < 50 ? 1 : -1);
            cat.causes.push({ 
                text: data.cause, 
                x: Math.max(5, Math.min(95, catX + offsetX)),
                y: Math.max(5, Math.min(95, catY + offsetY))
            });
            window.saveData();
            renderTools('diagram-canvas', 'fishbone');
            showToast('Cause added. Double-click to edit.', 'success');
        },
        'Add Cause'
    );
};

export function resetProcess() {
    if (state.isReadOnly) return;
    window.showConfirmDialog('Reset the process map to default? All current steps will be lost.', () => {
        state.projectData.process = ['Start', 'End'];
        window.saveData();
        renderTools('diagram-canvas', 'process');
        showToast('Process map reset', 'info');
    }, 'Reset', 'Reset Process Map');
}

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
        if (e.button !== 0) return; 
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
                    .then(() => showToast("Chart copied to clipboard.", "success"))
                    .catch(() => showToast("Copy failed. Try right-click to save.", "error")); 
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
                        <span class="text-rcem-purple mt-0.5">-</span>
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
