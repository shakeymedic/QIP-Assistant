import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea } from "./utils.js";
import { fishboneSVG, fishboneProblem } from "./diagrams.js";
import {
    chooseBaseline, median as medianOf, runChartSignals, spcCalc, histogramBins, paretoData,
    dateToAxisPosition, formatUkDate, formatValue, withUnit, parseNumericInput
} from "./project-metrics.js";

export let toolMode = 'driver'; 
export let chartMode = 'run';   
let zoomLevel = 1.0;

const TOOL_HELP = {
    fishbone: {
        title: "Fishbone Ishikawa Diagram",
        desc: "A root cause analysis tool using the 6M framework.",
        tips: "Click + beside a category to add a cause, a cause to edit or remove it, and a category to rename it. Aim for 3-5 causes per category."
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
    },
    fivewhys: {
        title: "5 Whys Analysis",
        desc: "Iteratively ask 'Why?' to drill down to the root cause of a problem. Usually 5 levels is enough to reach the systemic root cause.",
        tips: "Start with a specific problem statement. Each 'Why' should be answerable from the previous level. Stop when you reach something you can act on."
    }
};

const CHART_EDUCATION = {
    run: {
        title: "Run Chart Guidance",
        desc: "A run chart plots your data in date order against the median of your baseline. The baseline is your earliest Phase if you tag points with phases, otherwise the points before your first PDSA cycle, otherwise your first 12 points. The median is drawn solid over the baseline and dashed where it is extended. Aim for 10 to 12 baseline points before your first change.",
        rules: [
            "Shift: 6 or more consecutive points all above or all below the median. Points exactly on the median neither count nor break the run.",
            "Trend: 5 or more consecutive points all going up or all going down. A repeated value neither counts nor breaks it.",
            "Astronomical point: a value obviously different from the rest. This is a judgement call; the app highlights values far outside the spread of your data as a prompt to look.",
            "PDSA cycles (orange) and your own event markers are drawn at their dates, between points where needed."
        ]
    },
    spc: {
        title: "Statistical Process Control (XmR) Chart Guidance",
        desc: "An XmR (individuals) chart plots your data against the mean with upper and lower control limits (mean ± 2.66 × the average moving range). It helps separate common cause variation from special cause variation. Limits are provisional until you have around 15 points.",
        rules: [
            "Rule 1: a single point outside the control limits.",
            "Rule 2: 8 or more consecutive points on the same side of the mean.",
            "Rule 3: 2 out of 3 consecutive points beyond 2 sigma on the same side of the mean.",
            "Rule 4: a moving range (jump between consecutive points) more than 3.27 × the average moving range.",
            "Caveat: for proportions (e.g. '% compliance') with varying denominators a p-chart is more statistically correct. Treat XmR signals on percentage measures as indicative rather than definitive."
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
        desc: "A Pareto chart ranks causes or categories from most to least frequent, with a cumulative percentage line. It shows the 'vital few' categories that usually account for most of the problem. Enter one row per category: the category in the Note and how many times it happened in the Value (or one row per occurrence with a value of 1). Keep this in its own measure so it doesn't mix with your run chart data.",
        rules: [
            "Focus your first PDSA cycles on the tallest bars on the left (darker bars are the 'vital few' up to 80%).",
            "The orange line is the cumulative percentage; the red dashed line marks 80%.",
            "Re-collect and re-chart after your changes to see whether priorities have shifted."
        ]
    },
    beforeafter: {
        title: "Before / After Chart Guidance",
        desc: "Compares your earliest data 'Phase' against your latest data 'Phase' side by side — ideal for small-N paired data like a pre- vs post-intervention knowledge assessment. Points are paired using the label at the start of each point's note (e.g. 'ST3 — pre-QRH...' pairs with 'ST3 — post-QRH...'). Tag your data points with a Phase (e.g. 'Baseline' and 'Post-Intervention') and a short ID in the note to use this view.",
        rules: [
            "Grey bars = your earliest Phase (Before). Green bars = your latest Phase (After).",
            "Dashed lines show the median for each phase.",
            "Best for small samples (e.g. N<20) being compared before vs after a single change — for larger continuous datasets, use the Run or SPC chart instead.",
            "If pairing fails (labels don't match 1:1), points are compared in entry order instead."
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
        } else if (mode === 'fivewhys') {
            renderFiveWhysVisual(canvas);
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
        <div class="flex items-center gap-4 flex-wrap">
            <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <i data-lucide="git-branch" class="w-5 h-5 text-rcem-purple"></i>
                Diagnosis Tools
            </h2>
            <div class="flex bg-slate-100 p-1 rounded-lg flex-wrap gap-0.5">
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
                <button aria-label="Open 5 Whys" class="tool-tab-btn px-4 py-2 rounded-md text-sm font-bold transition-all ${toolMode === 'fivewhys' ? 'bg-rcem-purple text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}" 
                        data-mode="fivewhys" onclick="window.setToolMode('fivewhys')">
                    <i data-lucide="layers" class="w-4 h-4 inline mr-1"></i> 5 Whys
                </button>
            </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
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
            <!-- Export buttons — always present, not lost on re-render -->
            <button aria-label="Export Diagram as PNG" onclick="window.exportDiagramPNG()" class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded font-medium flex items-center gap-1 text-sm hover:bg-indigo-100 transition-all" title="Download diagram as PNG">
                <i data-lucide="image-down" class="w-4 h-4"></i> PNG
            </button>
            <button aria-label="Export Diagram as SVG" onclick="window.exportDiagramSVG()" class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded font-medium flex items-center gap-1 text-sm hover:bg-emerald-100 transition-all" title="Download diagram as SVG">
                <i data-lucide="vector" class="w-4 h-4"></i> SVG
            </button>
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

// Fishbone: drawn as one SVG (diagrams.js) so causes sit on their bones and
// never overlap, and the SVG export contains the whole diagram. Click a
// category to rename it, "+" to add a cause, a cause to edit or remove it.
function renderFishboneVisual(container, enableInteraction = false) {
    const d = state.projectData;
    if (!d.fishbone) d.fishbone = { categories: [] };
    if (!Array.isArray(d.fishbone.categories) || d.fishbone.categories.length === 0) {
        d.fishbone.categories = ['Patient', 'Staff', 'Equipment', 'Process', 'Environment', 'Management'].map(text => ({ text, causes: [] }));
    }
    const interactive = enableInteraction && !state.isReadOnly;
    // The driver/process views restyle this container; reset it for the fishbone.
    container.className = 'w-full p-4';
    container.style.position = 'relative';
    container.style.minHeight = '';
    container.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div class="min-w-[900px]">${fishboneSVG(d.fishbone, fishboneProblem(d), { interactive, maxCauses: interactive ? 8 : 6 })}</div>
        </div>
        ${interactive ? `
        <div class="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <button type="button" data-fb="add-cat" class="bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-semibold text-slate-700">+ Category</button>
            <button type="button" data-fb="problem" class="bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-semibold text-slate-700">Edit problem label</button>
            <span class="text-slate-400 ml-1">Click a category to rename it, <strong>+</strong> to add a cause, or a cause to edit or remove it.</span>
        </div>` : ''}`;
    if (!interactive) return;

    const cats = d.fishbone.categories;
    const redraw = () => { window.saveData(); renderTools(); };
    const causeText = (c) => typeof c === 'string' ? c : (c && c.text) || '';
    container.querySelectorAll('.fb-add').forEach(el => el.addEventListener('click', () => {
        const cat = cats[+el.dataset.cat];
        window.showInputModal(`Add a cause to ${cat.text || 'this category'}`,
            [{ id: 'text', label: 'Cause', type: 'text', placeholder: 'e.g. Kit stored in locked cupboards', required: true }],
            (v) => { const t = (v.text || '').trim(); if (!t) return; (cat.causes = cat.causes || []).push({ text: t }); redraw(); }, 'Add');
    }));
    container.querySelectorAll('.fb-cat').forEach(el => el.addEventListener('click', () => {
        const idx = +el.dataset.cat, cat = cats[idx];
        window.showInputModal('Rename category',
            [{ id: 'name', label: 'Category name', type: 'text', value: cat.text || '', hint: 'Clear the name to remove this category and its causes.' }],
            (v) => {
                const t = (v.name || '').trim();
                if (t) { cat.text = t; redraw(); return; }
                window.showConfirmDialog(`Remove "${cat.text}" and its ${(cat.causes || []).length} cause(s)?`, () => { cats.splice(idx, 1); redraw(); }, 'Remove', 'Remove category');
            }, 'Save');
    }));
    container.querySelectorAll('.fb-cause').forEach(el => el.addEventListener('click', () => {
        const cat = cats[+el.dataset.cat], k = +el.dataset.cause;
        window.showInputModal('Edit cause',
            [{ id: 'text', label: 'Cause', type: 'text', value: causeText(cat.causes[k]), hint: 'Clear the text to remove this cause.' }],
            (v) => {
                const t = (v.text || '').trim();
                if (t) cat.causes[k] = { ...(typeof cat.causes[k] === 'object' ? cat.causes[k] : {}), text: t };
                else cat.causes.splice(k, 1);
                redraw();
            }, 'Save');
    }));
    container.querySelector('[data-fb="add-cat"]')?.addEventListener('click', () => {
        window.showInputModal('Add a category', [{ id: 'name', label: 'Category', type: 'text', placeholder: 'e.g. Patients', required: true }],
            (v) => { const t = (v.name || '').trim(); if (t) { cats.push({ text: t, causes: [] }); redraw(); } }, 'Add');
    });
    container.querySelector('[data-fb="problem"]')?.addEventListener('click', () => {
        window.showInputModal('Problem (effect) label', [{ id: 'p', label: 'Short problem statement', type: 'text', value: d.fishbone.problem || fishboneProblem(d), hint: 'Shown in the red box at the head of the fish. Keep it short.' }],
            (v) => { d.fishbone.problem = (v.p || '').trim(); redraw(); }, 'Save');
    });
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

function renderFiveWhysVisual(container) {
    const fw = state.projectData?.fivewhys || {};
    const readOnly = state.isReadOnly || state.isDemoMode;
    const inputClass = 'w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rcem-purple bg-white';
    const disabledAttr = readOnly ? 'disabled' : '';

    const saveFW = (field, val) => {
        if (readOnly) return;
        if (!state.projectData.fivewhys) state.projectData.fivewhys = {};
        state.projectData.fivewhys[field] = val;
        if (window.saveData) window.saveData();
    };

    container.innerHTML = `
        <div class="p-6 max-w-2xl mx-auto space-y-3">
            <div class="mb-2">
                <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Problem Statement</label>
                <textarea ${disabledAttr} class="${inputClass} min-h-[60px] bg-red-50 border-red-200 font-medium" placeholder="What is the specific problem?" oninput="if(!this.disabled){if(!state.projectData.fivewhys)state.projectData.fivewhys={};state.projectData.fivewhys.problem=this.value;if(window.saveData)window.saveData();}">${escapeHtml(fw.problem || '')}</textarea>
            </div>
            ${['why1','why2','why3','why4','why5'].map((k, idx) => `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold mt-1">${idx+1}</div>
                <div class="flex-1">
                    <label class="block text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Why ${idx+1}?</label>
                    <textarea ${disabledAttr} class="${inputClass} min-h-[50px]" placeholder="Why does that happen?" oninput="if(!this.disabled){if(!state.projectData.fivewhys)state.projectData.fivewhys={};state.projectData.fivewhys['${k}']=this.value;if(window.saveData)window.saveData();}">${escapeHtml(fw[k] || '')}</textarea>
                </div>
            </div>`).join('')}
            <div class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label class="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">&#x2713; Root Cause</label>
                <textarea ${disabledAttr} class="${inputClass} min-h-[60px] bg-emerald-50 border-emerald-300 font-medium" placeholder="What is the underlying systemic cause?" oninput="if(!this.disabled){if(!state.projectData.fivewhys)state.projectData.fivewhys={};state.projectData.fivewhys.rootCause=this.value;if(window.saveData)window.saveData();}">${escapeHtml(fw.rootCause || '')}</textarea>
            </div>
            <p class="text-xs text-slate-400 text-center pt-2">Changes save automatically. Use this analysis to inform your Driver Diagram change ideas.</p>
        </div>
    `;
}

function syncChartModeButtons(m) {
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
}

export function setChartMode(m) { 
    chartMode = m; 
    syncChartModeButtons(m);
    // Persist the chosen mode against the ACTIVE measure so each measure
    // remembers its own preferred chart type when you switch tabs.
    if (state.projectData && state.projectData.chartSettings) {
        state.projectData.chartSettings.mode = m;
        if (window.saveViewChoice) window.saveViewChoice(); // a view choice, not an Undo step
    }
    // Proactively flag the proportion/% SPC caveat (rather than relying on
    // the user opening the guidance panel) — shown once per measure per
    // session so it nudges without nagging on every click.
    if (m === 'spc' && window.getActiveMeasure) {
        const active = window.getActiveMeasure();
        if (active && active.measureType === 'proportion') {
            const flagKey = 'qipSpcProportionNoted_' + active.id;
            let alreadyShown = false;
            try { alreadyShown = sessionStorage.getItem(flagKey) === '1'; } catch (e) { /* ignore */ }
            if (!alreadyShown) {
                showToast('This measure is tagged as a proportion/% — SPC control limits here use continuous-data maths. See the caveat below for details.', 'warning');
                try { sessionStorage.setItem(flagKey, '1'); } catch (e) { /* ignore */ }
            }
        }
    }
    renderChart(); 
    updateChartEducation();
}

// ── Shared chart plumbing ────────────────────────────────────────────────────

const CHART_FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const PHASE_PALETTE = ['#64748b', '#4f46e5', '#0891b2', '#db2777', '#ca8a04', '#16a34a', '#9333ea', '#ea580c'];
const SIGNAL_COLOURS = { astronomical: '#dc2626', shift: '#f59e0b', trend: '#f97316' };

// The measure whose data is currently being charted. renderFullViewChart
// temporarily points d.chartData at the primary measure, so match by array
// identity first rather than trusting activeMeasureId.
function chartedMeasure() {
    const d = state.projectData || {};
    const measures = Array.isArray(d.measures) ? d.measures : [];
    const m = measures.find(x => x.chartData === d.chartData)
        || measures.find(x => x.id === d.activeMeasureId)
        || measures[0] || null;
    return { measure: m, isPrimary: !measures.length || m === measures[0] };
}

// Unit, target and labels for the charted measure. The SMART-aim target on
// the checklist belongs to the primary measure only; any measure can have its
// own target in Chart Settings.
function chartContext() {
    const d = state.projectData || {};
    const settings = d.chartSettings || {};
    const { measure, isPrimary } = chartedMeasure();
    const aimTargetRaw = d.checklist?.aim_target;
    let unit = (measure?.unit || '').trim();
    if (!unit && isPrimary && /^\s*[<>≤≥=]*\s*\d+(\.\d+)?\s*%\s*$/.test(String(aimTargetRaw || ''))) unit = '%';
    if (!unit && measure?.measureType === 'proportion') unit = '%';
    let target = null;
    if (settings.target !== undefined && settings.target !== null && settings.target !== '') {
        target = parseNumericInput(settings.target);
    } else if (isPrimary && aimTargetRaw !== undefined && aimTargetRaw !== null && aimTargetRaw !== '') {
        target = parseNumericInput(aimTargetRaw);
    }
    if (isNaN(target)) target = null;
    return {
        settings, unit, target,
        yLabel: settings.yAxisLabel || unit || '',
        isPercent: unit === '%' || measure?.measureType === 'proportion',
        showMarkers: settings.showAnnotations !== false
    };
}

function sortedPoints() {
    return [...(state.projectData?.chartData || [])]
        .filter(p => p && p.date && p.value !== '' && p.value !== null && p.value !== undefined && !isNaN(Number(p.value)))
        .map(p => ({ ...p, value: Number(p.value) }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Only the interactive chart animates; report/export charts draw instantly
// so an image capture can never catch one half-drawn.
let animateCurrent = true;

function baseOptions(ctxInfo) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: animateCurrent ? { duration: 350 } : false,
        layout: { padding: { top: 4, right: 12, bottom: 0, left: 4 } },
        font: { family: CHART_FONT },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            title: {
                display: !!ctxInfo.settings.title, text: ctxInfo.settings.title || '',
                font: { size: 15, weight: 'bold', family: CHART_FONT }, color: '#1e293b', padding: { bottom: 4 }
            },
            subtitle: { display: false },
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.92)', padding: 10, cornerRadius: 8,
                titleFont: { family: CHART_FONT, weight: 'bold' }, bodyFont: { family: CHART_FONT }, footerFont: { family: CHART_FONT, weight: 'normal' },
                displayColors: false
            }
        }
    };
}

// y-axis range that always shows the data, the median/mean and the target line.
function yRange(values, extras, isPercent) {
    const all = values.concat(extras.filter(v => v !== null && v !== undefined && !isNaN(v)));
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
    let min = lo - pad, max = hi + pad;
    if (lo >= 0 && min < 0) min = 0;
    if (isPercent && hi <= 100 && max > 100) max = 100;
    return { suggestedMin: min, suggestedMax: max };
}

function valueTick(unit) {
    return (v) => unit === '%' ? `${formatValue(v, 1)}%` : formatValue(v, 2);
}

// PDSA cycles and custom event markers, positioned by date between points on
// the category axis. Dates outside the charted range are counted, not drawn.
function dateMarkers(dates) {
    const d = state.projectData || {};
    const ann = {};
    let outside = 0;
    (d.pdsa || []).forEach((p, i) => {
        const start = p && (p.startDate || p.start);
        if (!start) return;
        const x = dateToAxisPosition(dates, start);
        if (x === null) { outside++; return; }
        const name = p.title ? (p.title.length > 22 ? p.title.slice(0, 21) + '…' : p.title) : `Cycle ${i + 1}`;
        ann[`pdsa_${i}`] = {
            type: 'line', xMin: x, xMax: x, borderColor: 'rgba(243, 111, 33, 0.85)', borderWidth: 2, borderDash: [5, 4],
            label: {
                display: true, content: `PDSA ${i + 1}: ${name}`, position: 'start', yAdjust: -(i % 3) * 22,
                backgroundColor: 'rgba(243, 111, 33, 0.92)', color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4,
                font: { size: 10, weight: 'bold', family: CHART_FONT }
            }
        };
    });
    (d.chartEvents || []).forEach((ev, i) => {
        if (!ev || !ev.date) return;
        const x = dateToAxisPosition(dates, ev.date);
        if (x === null) { outside++; return; }
        const colour = /^#[0-9a-f]{3,8}$/i.test(ev.color || '') ? ev.color : '#14b8a6';
        ann[`event_${i}`] = {
            type: 'line', xMin: x, xMax: x, borderColor: colour, borderWidth: 2, borderDash: [2, 3],
            label: {
                display: true, content: ev.label || 'Event', position: 'end', yAdjust: (i % 3) * 22,
                backgroundColor: colour, color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4,
                font: { size: 10, weight: 'bold', family: CHART_FONT }
            }
        };
    });
    return { ann, outside };
}

function phaseColours(points) {
    const order = [];
    points.forEach(p => { const g = p.grade || ''; if (g && !order.includes(g)) order.push(g); });
    const map = {};
    order.forEach((g, i) => { map[g] = PHASE_PALETTE[i % PHASE_PALETTE.length]; });
    return { map, order };
}

// Friendly message in place of a chart (no data yet, not enough data, wrong
// kind of data). On the Data page it's an overlay with an action; elsewhere
// (report, exports) a blank chart carrying the message as its title.
function showChartMessage(ctx, title, detail, action) {
    const wrap = ctx.parentElement;
    if (wrap && wrap.id === 'chart-wrapper') {
        clearChartMessage(ctx);
        ctx.style.visibility = 'hidden';
        const ov = document.createElement('div');
        ov.className = 'chart-empty absolute inset-0 flex flex-col items-center justify-center text-center px-6';
        ov.innerHTML = `
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-rcem-purple flex items-center justify-center mb-3"><i data-lucide="${action?.icon || 'line-chart'}" class="w-6 h-6"></i></div>
            <p class="font-bold text-slate-700">${escapeHtml(title)}</p>
            ${detail ? `<p class="text-sm text-slate-500 mt-1 max-w-md">${escapeHtml(detail)}</p>` : ''}
            ${action && !state.isReadOnly ? `<button type="button" class="chart-empty-action mt-4 bg-rcem-purple text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-800">${escapeHtml(action.label)}</button>` : ''}`;
        wrap.appendChild(ov);
        const btn = ov.querySelector('.chart-empty-action');
        if (btn && action.run) btn.addEventListener('click', action.run);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [ov] });
        return;
    }
    ctx.chartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: title, color: '#94a3b8', font: { weight: 'normal', size: 14 } } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function clearChartMessage(ctx) {
    const wrap = ctx && ctx.parentElement;
    if (wrap) wrap.querySelectorAll('.chart-empty').forEach(el => el.remove());
    if (ctx) ctx.style.visibility = '';
}

const addFirstPoint = { label: 'Add your first data point', icon: 'plus-circle', run: () => { if (window.setDataEntryTab) window.setDataEntryTab('single'); document.getElementById('chart-value')?.focus(); } };
const pasteData = { label: 'Paste data from a spreadsheet', icon: 'clipboard-paste', run: () => { if (window.setDataEntryTab) window.setDataEntryTab('paste'); document.getElementById('paste-data')?.focus(); } };

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
    clearChartMessage(ctx);
    animateCurrent = canvasId === 'mainChart' && !window.__qipExporting;
    if (canvasId === 'mainChart') window.lastRunChartSignals = null;

    // Pick up whichever chart mode is saved against the ACTIVE measure.
    const savedMode = state.projectData?.chartSettings?.mode;
    if (savedMode && savedMode !== chartMode) chartMode = savedMode;
    syncChartModeButtons(chartMode);

    if (sortedPoints().length === 0) {
        showChartMessage(ctx, 'No data yet', 'Add points one at a time, or paste a column of dates and values from Excel. Your run chart, median and signals appear automatically.', window.innerWidth < 640 ? addFirstPoint : pasteData);
        return;
    }

    try {
        if (chartMode === 'run') renderRunChart(ctx, canvasId);
        else if (chartMode === 'spc') renderSPCChart(ctx, canvasId);
        else if (chartMode === 'histogram') renderHistogram(ctx, canvasId);
        else if (chartMode === 'pareto') renderPareto(ctx, canvasId);
        else if (chartMode === 'beforeafter') renderBeforeAfter(ctx, canvasId);
        else renderRunChart(ctx, canvasId);
    } catch (error) {
        console.error("[renderChart] Error drawing chart:", error);
        showChartMessage(ctx, 'This chart could not be drawn', 'Check the data table for a value or date that looks wrong.');
    }
    if (canvasId === 'mainChart') updateChartEducation();
}

function baselineSummary(b) {
    if (b.source === 'phase') return `${b.count} "${b.phase}" point${b.count !== 1 ? 's' : ''}`;
    if (b.source === 'pre-pdsa') return `${b.count} point${b.count !== 1 ? 's' : ''} before the first PDSA cycle`;
    return `the first ${b.count} point${b.count !== 1 ? 's' : ''}`;
}

function renderRunChart(ctx, canvasId) {
    const pts = sortedPoints();
    const info = chartContext();
    const dates = pts.map(p => p.date);
    const values = pts.map(p => p.value);
    const labels = dates.map(dt => formatUkDate(dt, true));

    const baseline = chooseBaseline(pts, state.projectData.pdsa);
    const med = medianOf(baseline.values);
    const sig = runChartSignals(values, med);

    // Last index of the baseline period, for drawing the median solid over
    // the baseline and dashed (extended) beyond it.
    let baselineEnd = baseline.count - 1;
    if (baseline.source === 'phase') {
        pts.forEach((p, i) => { if ((p.grade || 'Ungraded') === baseline.phase) baselineEnd = i; });
    }

    if (canvasId === 'mainChart' || !window.lastRunChartSignals) {
        window.lastRunChartSignals = {
            flags: sig.flags, median: med, data: values, labels: dates,
            rule1: sig.astronomical, rule2: sig.shift, rule3: sig.trend,
            baseline: { count: baseline.count, source: baseline.source, phase: baseline.phase, text: baselineSummary(baseline) },
            unit: info.unit
        };
    }

    let annotations = {};
    if (med !== null) {
        const medLabel = {
            display: true, content: `Median ${withUnit(med, info.unit)}`, position: 'end',
            backgroundColor: 'rgba(71, 85, 105, 0.9)', color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4,
            font: { size: 10, weight: 'bold', family: CHART_FONT }
        };
        if (baselineEnd < pts.length - 1 && baselineEnd >= 0) {
            annotations.medianBaseline = { type: 'line', yMin: med, yMax: med, xMin: 0, xMax: baselineEnd, borderColor: '#475569', borderWidth: 2 };
            annotations.medianExtended = { type: 'line', yMin: med, yMax: med, xMin: baselineEnd, xMax: pts.length - 1, borderColor: '#94a3b8', borderWidth: 2, borderDash: [6, 5], label: medLabel };
        } else {
            annotations.medianLine = { type: 'line', yMin: med, yMax: med, borderColor: '#475569', borderWidth: 2, label: medLabel };
        }
    }
    if (info.target !== null) {
        annotations.targetLine = {
            type: 'line', yMin: info.target, yMax: info.target, borderColor: '#16a34a', borderWidth: 2, borderDash: [10, 5],
            label: {
                display: true, content: `Target ${withUnit(info.target, info.unit)}`, position: 'start',
                backgroundColor: 'rgba(22, 163, 74, 0.9)', color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4,
                font: { size: 10, weight: 'bold', family: CHART_FONT }
            }
        };
    }

    // Shade baseline vs after the first PDSA cycle, split where it started.
    const firstStart = (state.projectData.pdsa || []).map(p => p && (p.startDate || p.start)).filter(Boolean).sort()[0];
    const split = firstStart ? dateToAxisPosition(dates, firstStart) : null;
    if (split !== null && split > 0 && split < pts.length - 1) {
        annotations.baselineZone = { type: 'box', xMin: 0, xMax: split, backgroundColor: 'rgba(148,163,184,0.08)', borderWidth: 0 };
        annotations.interventionZone = { type: 'box', xMin: split, xMax: pts.length - 1, backgroundColor: 'rgba(34,197,94,0.05)', borderWidth: 0 };
    }

    let markersOutside = 0;
    if (info.showMarkers) {
        const m = dateMarkers(dates);
        annotations = { ...annotations, ...m.ann };
        markersOutside = m.outside;
    }

    const phases = phaseColours(pts);
    const pointColours = pts.map((p, i) => {
        const f = sig.flags[i];
        if (f.includes('astronomical')) return SIGNAL_COLOURS.astronomical;
        if (f.includes('shift')) return SIGNAL_COLOURS.shift;
        if (f.includes('trend')) return SIGNAL_COLOURS.trend;
        return phases.map[p.grade || ''] || '#2d2e83';
    });
    const pointRadii = sig.flags.map(f => f.length ? 7 : (pts.length > 40 ? 3 : 5));

    const legendItems = [];
    phases.order.forEach(g => legendItems.push({ text: g, fillStyle: phases.map[g], strokeStyle: phases.map[g], pointStyle: 'circle' }));
    if (sig.shift) legendItems.push({ text: 'Shift (6+ one side)', fillStyle: SIGNAL_COLOURS.shift, strokeStyle: SIGNAL_COLOURS.shift, pointStyle: 'circle' });
    if (sig.trend) legendItems.push({ text: 'Trend (5+ rising/falling)', fillStyle: SIGNAL_COLOURS.trend, strokeStyle: SIGNAL_COLOURS.trend, pointStyle: 'circle' });
    if (sig.astronomical) legendItems.push({ text: 'Unusual point', fillStyle: SIGNAL_COLOURS.astronomical, strokeStyle: SIGNAL_COLOURS.astronomical, pointStyle: 'circle' });

    const subtitleBits = [];
    if (med !== null) subtitleBits.push(`Median from ${baselineSummary(baseline)}`);
    if (markersOutside) subtitleBits.push(`${markersOutside} marker${markersOutside !== 1 ? 's' : ''} outside the data range not shown`);

    const opts = baseOptions(info);
    opts.plugins.subtitle = { display: subtitleBits.length > 0, text: subtitleBits.join(' · '), color: '#64748b', font: { size: 11, family: CHART_FONT }, padding: { bottom: 8 } };
    opts.plugins.legend = {
        display: legendItems.length > 0, position: 'bottom', onClick: () => {},
        labels: { usePointStyle: true, boxWidth: 8, padding: 12, font: { size: 11, family: CHART_FONT }, generateLabels: () => legendItems }
    };
    opts.plugins.annotation = { annotations, clip: false };
    opts.plugins.tooltip.callbacks = {
        title: (items) => items.length ? formatUkDate(pts[items[0].dataIndex].date) : '',
        label: (c) => withUnit(c.parsed.y, info.unit, 6),
        afterLabel: (c) => {
            const p = pts[c.dataIndex], f = sig.flags[c.dataIndex], lines = [];
            if (p.grade) lines.push(`Phase: ${p.grade}`);
            if (p.note) lines.push(p.note.length > 80 ? p.note.slice(0, 79) + '…' : p.note);
            if (f.includes('shift')) lines.push('Part of a shift (6+ points one side of the median)');
            if (f.includes('trend')) lines.push('Part of a trend (5+ points rising or falling)');
            if (f.includes('astronomical')) lines.push('Unusually far from the rest — worth checking');
            return lines;
        }
    };
    opts.scales = {
        x: { ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12, font: { size: 11, family: CHART_FONT }, color: '#64748b' }, grid: { display: false } },
        y: {
            title: { display: !!info.yLabel, text: info.yLabel, font: { weight: 'bold', family: CHART_FONT }, color: '#475569' },
            ...yRange(values, [med, info.target], info.isPercent),
            ticks: { callback: valueTick(info.unit), font: { size: 11, family: CHART_FONT }, color: '#64748b' },
            grid: { color: 'rgba(148,163,184,0.18)' }
        }
    };

    ctx.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: info.settings.yAxisLabel || 'Measure',
                data: values,
                borderColor: '#2d2e83', borderWidth: 2,
                backgroundColor: '#2d2e83',
                pointBackgroundColor: pointColours, pointBorderColor: '#fff', pointBorderWidth: 2,
                pointRadius: pointRadii, pointHoverRadius: 8,
                tension: 0, fill: false
            }]
        },
        options: opts
    });
}

function renderSPCChart(ctx, canvasId) {
    const pts = sortedPoints();
    const info = chartContext();
    if (pts.length < 2) {
        showChartMessage(ctx, 'An SPC chart needs at least 2 data points', 'Add more points — control limits are only provisional until you have about 15.', addFirstPoint);
        return;
    }
    const dates = pts.map(p => p.date);
    const values = pts.map(p => p.value);
    const labels = dates.map(dt => formatUkDate(dt, true));
    const allNonNegative = values.every(v => v >= 0);
    const spc = spcCalc(values, { floor: allNonNegative ? 0 : null, ceiling: info.isPercent && values.every(v => v <= 100) ? 100 : null });
    const { mean, ucl, lcl, flags, movingRanges, mrLimit } = spc;

    const colourFor = (f) => f.includes('ooc') ? '#ef4444' : f.includes('run') ? '#f59e0b' : f.includes('twoOfThree') ? '#8b5cf6' : f.includes('movingRange') ? '#0f766e' : '#64748b';
    const lineLabel = (text, pos, bg) => ({ display: true, content: text, position: pos, backgroundColor: bg, color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4, font: { size: 10, weight: 'bold', family: CHART_FONT } });

    let annotations = {
        band: { type: 'box', yMin: lcl, yMax: ucl, backgroundColor: 'rgba(99, 102, 241, 0.05)', borderWidth: 0 },
        ucl: { type: 'line', yMin: ucl, yMax: ucl, borderColor: '#ef4444', borderDash: [4, 4], borderWidth: 2, label: lineLabel(`UCL ${withUnit(ucl, info.unit)}`, 'end', 'rgba(239, 68, 68, 0.9)') },
        lcl: { type: 'line', yMin: lcl, yMax: lcl, borderColor: '#ef4444', borderDash: [4, 4], borderWidth: 2, label: lineLabel(`LCL ${withUnit(lcl, info.unit)}`, 'end', 'rgba(239, 68, 68, 0.9)') },
        avg: { type: 'line', yMin: mean, yMax: mean, borderColor: '#16a34a', borderWidth: 2, label: lineLabel(`Mean ${withUnit(mean, info.unit)}`, 'start', 'rgba(22, 163, 74, 0.9)') }
    };
    if (info.target !== null) {
        annotations.targetLine = { type: 'line', yMin: info.target, yMax: info.target, borderColor: '#0f766e', borderWidth: 1.5, borderDash: [10, 5], label: lineLabel(`Target ${withUnit(info.target, info.unit)}`, 'center', 'rgba(15, 118, 110, 0.85)') };
    }
    if (info.showMarkers) annotations = { ...annotations, ...dateMarkers(dates).ann };

    const present = new Set(flags.flat());
    const legendItems = [
        present.has('ooc') && { text: 'Outside the limits', fillStyle: '#ef4444', strokeStyle: '#ef4444', pointStyle: 'circle' },
        present.has('run') && { text: '8+ one side of the mean', fillStyle: '#f59e0b', strokeStyle: '#f59e0b', pointStyle: 'circle' },
        present.has('twoOfThree') && { text: '2 of 3 near a limit', fillStyle: '#8b5cf6', strokeStyle: '#8b5cf6', pointStyle: 'circle' },
        present.has('movingRange') && { text: 'Unusually big jump', fillStyle: '#0f766e', strokeStyle: '#0f766e', pointStyle: 'circle' }
    ].filter(Boolean);

    const opts = baseOptions(info);
    opts.plugins.subtitle = {
        display: true,
        text: pts.length < 15
            ? `XmR chart · limits are provisional with fewer than 15 points (you have ${pts.length})`
            : `XmR chart · limits from all ${pts.length} points`,
        color: '#64748b', font: { size: 11, family: CHART_FONT }, padding: { bottom: 8 }
    };
    opts.plugins.legend = {
        display: legendItems.length > 0, position: 'bottom', onClick: () => {},
        labels: { usePointStyle: true, boxWidth: 8, padding: 12, font: { size: 11, family: CHART_FONT }, generateLabels: () => legendItems }
    };
    opts.plugins.annotation = { annotations, clip: false };
    opts.plugins.tooltip.callbacks = {
        title: (items) => items.length ? formatUkDate(pts[items[0].dataIndex].date) : '',
        label: (c) => withUnit(c.parsed.y, info.unit, 6),
        afterLabel: (c) => {
            const f = flags[c.dataIndex], lines = [];
            const p = pts[c.dataIndex];
            if (p.grade) lines.push(`Phase: ${p.grade}`);
            if (f.includes('ooc')) lines.push('Outside the control limits');
            if (f.includes('run')) lines.push('Part of 8+ points on one side of the mean');
            if (f.includes('twoOfThree')) lines.push('2 of 3 points beyond 2 sigma on one side');
            if (f.includes('movingRange')) lines.push(`Jump of ${formatValue(movingRanges[c.dataIndex])} is more than 3.27 × the average moving range (${formatValue(mrLimit)})`);
            if (!f.length) lines.push('Common cause variation');
            return lines;
        }
    };
    opts.scales = {
        x: { ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12, font: { size: 11, family: CHART_FONT }, color: '#64748b' }, grid: { display: false } },
        y: {
            title: { display: !!info.yLabel, text: info.yLabel, font: { weight: 'bold', family: CHART_FONT }, color: '#475569' },
            ...yRange(values, [ucl, lcl, mean, info.target], info.isPercent),
            ticks: { callback: valueTick(info.unit), font: { size: 11, family: CHART_FONT }, color: '#64748b' },
            grid: { color: 'rgba(148,163,184,0.18)' }
        }
    };

    ctx.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: info.settings.yAxisLabel || 'Measure', data: values,
                borderColor: '#64748b', borderWidth: 2, backgroundColor: 'transparent',
                pointBackgroundColor: flags.map(colourFor), pointBorderColor: '#fff', pointBorderWidth: 2,
                pointRadius: flags.map(f => f.length ? 7 : (pts.length > 40 ? 3 : 5)), pointHoverRadius: 8,
                tension: 0, fill: false
            }]
        },
        options: opts
    });
}

function renderHistogram(ctx, canvasId) {
    const pts = sortedPoints();
    const info = chartContext();
    const values = pts.map(p => p.value);
    if (values.length < 5) {
        showChartMessage(ctx, 'A histogram needs at least 5 data points', `You have ${values.length}. It shows how your values are spread, so it only becomes useful with more data.`, addFirstPoint);
        return;
    }
    const bins = histogramBins(values);
    const step = bins.length > 1 ? bins[0].high - bins[0].low : 0;
    const dp = step && step < 1 ? 2 : step && step < 10 ? 1 : 0;
    const f = (v) => formatValue(v, dp);
    const labels = bins.map(b => bins.length === 1 ? f(b.low) : `${f(b.low)}–${f(b.high)}`);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const med = medianOf(values);
    const min = bins[0].low;
    const pos = (v) => step ? Math.min(bins.length - 0.5, Math.max(-0.5, (v - min) / step - 0.5)) : 0;
    const lineLabel = (text, where, bg) => ({ display: true, content: text, position: where, backgroundColor: bg, color: '#fff', padding: { x: 6, y: 3 }, borderRadius: 4, font: { size: 10, weight: 'bold', family: CHART_FONT } });

    const opts = baseOptions(info);
    opts.plugins.title = { display: true, text: info.settings.title || 'How your values are spread', font: { size: 15, weight: 'bold', family: CHART_FONT }, color: '#1e293b', padding: { bottom: 4 } };
    opts.plugins.subtitle = { display: true, text: `n = ${values.length} · mean ${withUnit(mean, info.unit)} · median ${withUnit(med, info.unit)}`, color: '#64748b', font: { size: 11, family: CHART_FONT }, padding: { bottom: 8 } };
    opts.plugins.annotation = {
        annotations: {
            meanLine: { type: 'line', xMin: pos(mean), xMax: pos(mean), borderColor: '#4f46e5', borderWidth: 2, borderDash: [5, 5], label: lineLabel(`Mean ${withUnit(mean, info.unit)}`, 'end', 'rgba(79,70,229,0.9)') },
            medianLine: { type: 'line', xMin: pos(med), xMax: pos(med), borderColor: '#c026d3', borderWidth: 2, borderDash: [2, 3], label: lineLabel(`Median ${withUnit(med, info.unit)}`, 'start', 'rgba(192,38,211,0.9)') }
        }
    };
    opts.plugins.tooltip.callbacks = {
        title: (items) => items.length ? `${labels[items[0].dataIndex]}${info.unit && info.unit !== '%' ? ' ' + info.unit : info.unit}` : '',
        label: (c) => `${c.parsed.y} point${c.parsed.y !== 1 ? 's' : ''}`
    };
    opts.scales = {
        x: { title: { display: true, text: info.yLabel || 'Value', font: { weight: 'bold', family: CHART_FONT }, color: '#475569' }, grid: { display: false }, ticks: { font: { size: 11, family: CHART_FONT }, color: '#64748b' } },
        y: { title: { display: true, text: 'Number of points', font: { weight: 'bold', family: CHART_FONT }, color: '#475569' }, beginAtZero: true, ticks: { precision: 0, font: { size: 11, family: CHART_FONT }, color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.18)' } }
    };

    ctx.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Points', data: bins.map(b => b.count), backgroundColor: 'rgba(79, 70, 229, 0.75)', hoverBackgroundColor: '#4f46e5', borderRadius: 6, categoryPercentage: 0.96, barPercentage: 0.96 }] },
        options: opts
    });
}

function renderPareto(ctx, canvasId) {
    const info = chartContext();
    const type = chartedMeasure().measure?.measureType || '';
    const usesNotes = !type || type === 'categorical' || type === 'count';
    const pd = paretoData((state.projectData.chartData || []).map(p => usesNotes ? p : { ...p, note: '' }));
    if (pd.categories.length < 2) {
        showChartMessage(ctx, 'A Pareto chart needs categories', 'Add one row per category: put the category (e.g. "Kit missing") in the Note and how many times it happened in the Value. Tip: a separate measure keeps these apart from your run chart data.', state.isReadOnly ? null : { label: 'Add a measure for categories', icon: 'bar-chart-3', run: () => window.addMeasure && window.addMeasure() });
        return;
    }
    const { categories, values, cumulative, total } = pd;
    const vital = cumulative.findIndex(c => c >= 80);
    const colours = categories.map((_, i) => i <= vital ? 'rgba(45, 46, 131, 0.9)' : 'rgba(45, 46, 131, 0.35)');

    const opts = baseOptions(info);
    opts.plugins.title = { display: true, text: info.settings.title || 'Pareto: where to focus first', font: { size: 15, weight: 'bold', family: CHART_FONT }, color: '#1e293b', padding: { bottom: 4 } };
    opts.plugins.subtitle = { display: true, text: `${vital + 1} of ${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'} account for ${Math.round(cumulative[vital])}% of ${formatValue(total)} in total`, color: '#64748b', font: { size: 11, family: CHART_FONT }, padding: { bottom: 8 } };
    opts.plugins.legend = { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11, family: CHART_FONT } } };
    opts.plugins.annotation = {
        annotations: {
            eighty: { type: 'line', yMin: 80, yMax: 80, yScaleID: 'y1', borderColor: '#ef4444', borderWidth: 1.5, borderDash: [6, 3], label: { display: true, content: '80%', position: 'start', backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff', padding: { x: 5, y: 2 }, borderRadius: 4, font: { size: 10, weight: 'bold', family: CHART_FONT } } }
        }
    };
    opts.plugins.tooltip.callbacks = {
        label: (c) => c.datasetIndex === 0
            ? `Cumulative ${formatValue(c.parsed.y)}%`
            : `${formatValue(c.parsed.y)} (${formatValue((values[c.dataIndex] / total) * 100)}% of total)`,
        afterLabel: (c) => c.datasetIndex === 1 && c.dataIndex <= vital ? 'In the "vital few" — tackle these first' : ''
    };
    opts.scales = {
        x: { grid: { display: false }, ticks: { font: { size: 11, family: CHART_FONT }, color: '#475569', callback: function(v) { const l = this.getLabelForValue(v); return l.length > 18 ? l.slice(0, 17) + '…' : l; } } },
        y: { title: { display: true, text: info.yLabel || 'Count', font: { weight: 'bold', family: CHART_FONT }, color: '#475569' }, beginAtZero: true, grid: { color: 'rgba(148,163,184,0.18)' }, ticks: { font: { size: 11, family: CHART_FONT }, color: '#64748b' } },
        y1: { position: 'right', min: 0, max: 100, title: { display: true, text: 'Cumulative %', font: { weight: 'bold', family: CHART_FONT }, color: '#475569' }, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%', font: { size: 11, family: CHART_FONT }, color: '#64748b' } }
    };

    ctx.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                { type: 'line', label: 'Cumulative %', data: cumulative, borderColor: '#f36f21', backgroundColor: '#f36f21', pointBackgroundColor: '#f36f21', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 4, yAxisID: 'y1', tension: 0, order: 1 },
                { type: 'bar', label: info.yLabel || 'Count', data: values, backgroundColor: colours, borderRadius: 6, yAxisID: 'y', order: 2 }
            ]
        },
        options: opts
    });
}

// Extracts a short pairing label from the start of a data point's note field,
// e.g. "ST3 \u2014 pre-QRH: 3 critical points missed" -> "ST3". Falls back to a
// positional label if no usable text is found.
function extractPairLabel(point, fallback) {
    if (point && point.note) {
        const m = point.note.match(/^([^\u2014(:-]+)/);
        if (m && m[1].trim()) return m[1].trim();
    }
    return fallback;
}

// De-duplicates repeated labels within a group (e.g. two points both
// labelled "ST4") by appending an occurrence count, so paired bars stay
// distinguishable on the x-axis.
function dedupeLabels(labels) {
    const seen = {};
    return labels.map(l => {
        seen[l] = (seen[l] || 0) + 1;
        return seen[l] > 1 ? `${l} (${seen[l]})` : l;
    });
}

function median(values) {
    const v = values.filter(x => x !== null && x !== undefined && !isNaN(x)).slice().sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// "Before / After" chart: contrasts the earliest data Phase against the
// latest data Phase, pairing individual points (e.g. by trainee ID found in
// each point's note) so small-N pre/post comparisons — like a knowledge
// assessment taken before and after a QRH intervention — read clearly as
// paired bars rather than clustering on a single timeline.
function renderBeforeAfter(ctx, canvasId) {
    const raw = state.projectData.chartData || [];
    const settings = state.projectData.chartSettings || {};

    const info = chartContext();
    if (raw.length < 2) {
        showChartMessage(ctx, 'Before / After needs data from two phases', 'Tag your points with a Phase, e.g. "Baseline" and "Post-intervention".', addFirstPoint);
        return;
    }

    // Group points by Phase (the "grade" field), ordered chronologically by
    // each phase's earliest date. Before = earliest phase, After = latest.
    const phaseEarliestDate = {};
    raw.forEach(p => {
        const g = p.grade || 'Ungraded';
        const t = new Date(p.date).getTime() || 0;
        if (!(g in phaseEarliestDate) || t < phaseEarliestDate[g]) phaseEarliestDate[g] = t;
    });
    const phaseOrder = Object.keys(phaseEarliestDate).sort((a, b) => phaseEarliestDate[a] - phaseEarliestDate[b]);

    if (phaseOrder.length < 2) {
        showChartMessage(ctx, 'Only one phase found', `All your points are in "${phaseOrder[0]}". Set a different Phase on the points collected after your change (edit them in the data table below), and this chart compares the two.`);
        return;
    }

    const beforePhase = phaseOrder[0];
    const afterPhase = phaseOrder[phaseOrder.length - 1];
    const beforePts = raw.filter(p => (p.grade || 'Ungraded') === beforePhase);
    const afterPts = raw.filter(p => (p.grade || 'Ungraded') === afterPhase);

    const beforeLabels = dedupeLabels(beforePts.map((p, i) => extractPairLabel(p, `Point ${i + 1}`)));
    const afterLabels = dedupeLabels(afterPts.map((p, i) => extractPairLabel(p, `Point ${i + 1}`)));

    const beforeMap = {}; beforePts.forEach((p, i) => beforeMap[beforeLabels[i]] = p.value);
    const afterMap = {}; afterPts.forEach((p, i) => afterMap[afterLabels[i]] = p.value);
    const labelsMatch = beforeLabels.length === afterLabels.length && beforeLabels.every(l => l in afterMap);

    // Different numbers of points and no matching IDs: this isn't paired
    // data, so compare the two groups (median bar + every point) instead of
    // inventing pairs.
    if (!labelsMatch && beforePts.length !== afterPts.length) {
        renderGroupComparison(ctx, info, beforePhase, afterPhase, beforePts.map(p => Number(p.value)), afterPts.map(p => Number(p.value)));
        return;
    }

    let pairedLabels, beforeValues, afterValues;
    if (labelsMatch) {
        pairedLabels = beforeLabels;
        beforeValues = pairedLabels.map(l => beforeMap[l]);
        afterValues = pairedLabels.map(l => afterMap[l]);
    } else {
        // Labels didn't line up 1:1 — fall back to pairing by entry order.
        const n = Math.max(beforePts.length, afterPts.length);
        pairedLabels = Array.from({ length: n }, (_, i) => `#${i + 1}`);
        beforeValues = Array.from({ length: n }, (_, i) => beforePts[i] ? beforePts[i].value : null);
        afterValues = Array.from({ length: n }, (_, i) => afterPts[i] ? afterPts[i].value : null);
    }

    const beforeMedian = median(beforeValues);
    const afterMedian = median(afterValues);
    let changeText = '';
    if (beforeMedian !== null && afterMedian !== null) {
        if (beforeMedian === 0) {
            changeText = afterMedian === 0 ? 'No change in median' : 'Median rose from 0';
        } else {
            const pct = ((afterMedian - beforeMedian) / beforeMedian) * 100;
            changeText = `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% median change (N=${pairedLabels.length} pairs)`;
        }
    }

    const baChartAnnotations = {};
    if (beforeMedian !== null) {
        baChartAnnotations.beforeMedianLine = {
            type: 'line', yMin: beforeMedian, yMax: beforeMedian,
            borderColor: '#94a3b8', borderWidth: 2, borderDash: [6, 4],
            label: { display: true, content: `${beforePhase} median ${withUnit(beforeMedian, info.unit)}`, position: 'start',
                backgroundColor: 'rgba(100,116,139,0.9)', color: 'white', font: { size: 10, weight: 'bold' } }
        };
    }
    if (afterMedian !== null) {
        baChartAnnotations.afterMedianLine = {
            type: 'line', yMin: afterMedian, yMax: afterMedian,
            borderColor: '#10b981', borderWidth: 2, borderDash: [6, 4],
            label: { display: true, content: `${afterPhase} median ${withUnit(afterMedian, info.unit)}`, position: 'end',
                backgroundColor: 'rgba(16,185,129,0.9)', color: 'white', font: { size: 10, weight: 'bold' } }
        };
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: pairedLabels,
            datasets: [
                { label: beforePhase, data: beforeValues, backgroundColor: '#94a3b8', borderRadius: 6, minBarLength: 3 },
                { label: afterPhase, data: afterValues, backgroundColor: '#10b981', borderRadius: 6, minBarLength: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: animateCurrent ? { duration: 350 } : false,
            plugins: {
                title: { display: true, text: settings.title || `${beforePhase} vs ${afterPhase}`, font: { size: 16, weight: 'bold' }, color: '#1e293b', padding: { bottom: 4 } },
                subtitle: { display: !!changeText, text: changeText, font: { size: 12, weight: 'normal' }, color: '#475569', padding: { bottom: 12 } },
                legend: { display: true, position: 'top' },
                annotation: { annotations: baChartAnnotations },
                tooltip: {
                    callbacks: {
                        afterBody: function() {
                            return [
                                `${beforePhase} median: ${beforeMedian ?? 'n/a'}`,
                                `${afterPhase} median: ${afterMedian ?? 'n/a'}`,
                                labelsMatch ? 'Paired by ID from data point notes' : 'Paired by entry order (labels did not match)'
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Paired data points' }, grid: { display: false } },
                y: { title: { display: true, text: info.yLabel || 'Value' }, beginAtZero: true, ticks: { callback: valueTick(info.unit) }, grid: { color: 'rgba(148,163,184,0.18)' } }
            }
        }
    });
    ctx.chartInstance = chart;
}

// Data entry lives in data-entry.js; re-exported so existing imports keep working.
export { addDataPoint, deleteDataPoint, downloadCSVTemplate, importCSV } from "./data-entry.js";

// Unpaired Before/After: a bar for each phase's median with the individual
// points drawn over it, so the spread is visible as well as the middle.
function renderGroupComparison(ctx, info, beforePhase, afterPhase, before, after) {
    const mb = medianOf(before), ma = medianOf(after);
    let change = '';
    if (mb !== null && ma !== null) {
        change = mb === 0 ? (ma === 0 ? 'No change in median' : 'Median rose from 0')
            : `${ma - mb > 0 ? '+' : ''}${Math.round(((ma - mb) / mb) * 100)}% change in median`;
    }
    const opts = baseOptions(info);
    opts.plugins.title = { display: true, text: info.settings.title || `${beforePhase} vs ${afterPhase}`, font: { size: 15, weight: 'bold', family: CHART_FONT }, color: '#1e293b', padding: { bottom: 4 } };
    opts.plugins.subtitle = { display: true, text: `${change} · ${before.length} vs ${after.length} points (not paired)`, color: '#64748b', font: { size: 11, family: CHART_FONT }, padding: { bottom: 8 } };
    opts.plugins.legend = { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11, family: CHART_FONT } } };
    opts.plugins.tooltip.callbacks = {
        label: (c) => c.datasetIndex === 0 ? `Median ${withUnit(c.parsed.y, info.unit, 6)}` : withUnit(c.parsed.y, info.unit, 6)
    };
    opts.scales = {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold', family: CHART_FONT }, color: '#334155' } },
        y: { title: { display: !!info.yLabel, text: info.yLabel, font: { weight: 'bold', family: CHART_FONT }, color: '#475569' }, beginAtZero: true, ticks: { callback: valueTick(info.unit) }, grid: { color: 'rgba(148,163,184,0.18)' } }
    };
    ctx.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [beforePhase, afterPhase],
            datasets: [
                { type: 'bar', label: 'Median', data: [mb, ma], backgroundColor: ['rgba(148,163,184,0.55)', 'rgba(16,185,129,0.55)'], borderRadius: 8, barPercentage: 0.55, order: 2 },
                { type: 'scatter', label: 'Individual points', data: before.map(v => ({ x: beforePhase, y: v })).concat(after.map(v => ({ x: afterPhase, y: v }))),
                  backgroundColor: 'rgba(45,46,131,0.55)', borderColor: '#fff', borderWidth: 1, pointRadius: 5, order: 1 }
            ]
        },
        options: opts
    });
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
    if (state.isReadOnly || !state.projectData) return;
    if(window.generateChangeIdeas) {
        const driverName = state.projectData.drivers?.[type]?.[index];
        if (!driverName) return;
        showToast("Generating ideas...", "info");
        const raw = await window.generateChangeIdeas(driverName);
        // Keep only real text, and skip ideas already on the diagram.
        const existing = new Set((state.projectData.drivers.changes || []).map(c => String(c).trim().toLowerCase()));
        const ideas = Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.trim() && !existing.has(x.trim().toLowerCase())).map(x => x.trim()).slice(0, 8) : null;
        if (raw && !ideas?.length) { showToast("No new ideas came back — try again.", "info"); return; }
        if(ideas && ideas.length) {
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
    if (!m || !state.projectData) return;
    const s = state.projectData.chartSettings || {};
    const { isPrimary } = chartedMeasure();
    const aimTarget = state.projectData.checklist?.aim_target;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('chart-setting-title', s.title || '');
    set('chart-setting-yaxis', s.yAxisLabel || '');
    set('chart-setting-target', s.target !== undefined && s.target !== null ? s.target : '');
    const hint = document.getElementById('chart-setting-target-hint');
    if (hint) {
        hint.textContent = isPrimary && aimTarget
            ? `Leave blank to use the target from your SMART aim (${aimTarget}).`
            : 'Draws a dashed green line. Leave blank for no target line.';
    }
    const a = document.getElementById('chart-setting-annotations');
    if (a) a.checked = s.showAnnotations !== false;
    m.classList.remove('hidden');
    m.classList.add('flex');
    setTimeout(() => document.getElementById('chart-setting-title')?.focus(), 50);
}

export function saveChartSettings() {
    if (!state.projectData) return;
    if (state.isReadOnly) { showToast("You're viewing this project read-only — settings aren't saved.", 'info'); return; }
    if (!state.projectData.chartSettings) state.projectData.chartSettings = {};
    const cs = state.projectData.chartSettings;
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const targetRaw = val('chart-setting-target');
    if (targetRaw !== '' && isNaN(parseNumericInput(targetRaw))) {
        showToast('Target must be a number (e.g. 90 or 120)', 'error');
        return;
    }
    cs.title = val('chart-setting-title');
    cs.yAxisLabel = val('chart-setting-yaxis');
    cs.target = targetRaw === '' ? null : parseNumericInput(targetRaw);
    const a = document.getElementById('chart-setting-annotations');
    cs.showAnnotations = a ? a.checked : true;
    window.saveData();
    const modal = document.getElementById('chart-settings-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    renderChart();
    showToast("Chart settings saved", "success");
}

export function copyChartImage() {
    const c = document.getElementById('mainChart');
    if (!c) { showToast("No chart to copy.", "error"); return; }
    // Fallback to download if Clipboard API is unavailable (non-HTTPS, Firefox, etc.)
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
        downloadChartPNG();
        return;
    }
    chartToWhiteBackgroundBlob(c, b => {
        if (!b) { showToast("Chart export failed.", "error"); return; }
        navigator.clipboard.write([new ClipboardItem({'image/png': b})])
            .then(() => showToast("Chart copied to clipboard.", "success"))
            .catch(() => { downloadChartPNG(); });
    });
}

// ============================================================
// DOWNLOAD CHART PNG (reliable cross-browser download)
// Uses offscreen canvas to ensure white background
// ============================================================
function chartToWhiteBackgroundBlob(canvas, callback) {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
    offCtx.drawImage(canvas, 0, 0);
    offscreen.toBlob(callback, 'image/png', 1.0);
}

export function downloadChartPNG() {
    const canvas = document.getElementById('mainChart');
    if (!canvas) { showToast("No chart to export.", "error"); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'chart').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const chartType = typeof chartMode !== 'undefined' ? chartMode : 'chart';
    chartToWhiteBackgroundBlob(canvas, blob => {
        if (!blob) { showToast("Chart export failed.", "error"); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}_${chartType}_${new Date().toISOString().slice(0,10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast("Chart PNG downloaded.", "success");
    });
}

// ============================================================
// GANTT EXPORTS (PNG + PDF)
// html2canvas is bundled with html2pdf but also loaded standalone
// ============================================================
export function exportGanttPNG() {
    const container = document.getElementById('gantt-container');
    if (!container) { showToast("No Gantt chart found.", "error"); return; }
    if (typeof html2canvas === 'undefined') { showToast("Export library not loaded — please refresh.", "error"); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'gantt').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    showToast("Generating Gantt PNG…", "info");
    html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        logging: false, allowTaint: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) { showToast("Gantt PNG export failed.", "error"); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}_gantt_${new Date().toISOString().slice(0,10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            showToast("Gantt PNG downloaded.", "success");
        }, 'image/png');
    }).catch(err => {
        console.error('Gantt PNG export:', err);
        showToast("PNG export failed — try PDF instead.", "error");
    });
}

export function exportGanttPDF() {
    const container = document.getElementById('gantt-container');
    if (!container) { showToast("No Gantt chart found.", "error"); return; }
    if (typeof html2pdf === 'undefined') { showToast("PDF library not loaded — please refresh.", "error"); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'gantt').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${title}_gantt_${new Date().toISOString().slice(0,10)}.pdf`;
    showToast("Generating Gantt PDF…", "info");
    html2pdf().set({
        margin: 8,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true },
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
        pagebreak: { mode: 'avoid-all' }
    }).from(container).save()
      .then(() => showToast("Gantt PDF downloaded.", "success"))
      .catch(err => { console.error('Gantt PDF export:', err); showToast("PDF export failed.", "error"); });
}

// ============================================================
// DIAGRAM EXPORTS (PNG + SVG)
// ============================================================
export function exportDiagramPNG() {
    const container = document.getElementById('diagram-canvas');
    if (!container) { showToast("No diagram found.", "error"); return; }
    if (typeof html2canvas === 'undefined') { showToast("Export library not loaded — please refresh.", "error"); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'diagram').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    showToast("Generating diagram PNG…", "info");
    html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: '#f8fafc',
        logging: false, allowTaint: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) { showToast("Diagram PNG export failed.", "error"); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}_diagram_${new Date().toISOString().slice(0,10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            showToast("Diagram PNG downloaded.", "success");
        }, 'image/png');
    }).catch(err => {
        console.error('Diagram PNG export:', err);
        showToast("Diagram PNG export failed.", "error");
    });
}

export function exportDiagramSVG() {
    const container = document.getElementById('diagram-canvas');
    if (!container) { showToast("No diagram found.", "error"); return; }
    const svg = container.querySelector('svg');
    if (!svg) { showToast("No SVG diagram — try PNG export instead.", "info"); exportDiagramPNG(); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'diagram').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svg);
    if (!svgStr.includes('xmlns=')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_diagram_${new Date().toISOString().slice(0,10)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast("Diagram SVG downloaded.", "success");
}

// ============================================================
// STAKEHOLDER MAP EXPORT (PNG)
// ============================================================
export function exportStakeholderPNG() {
    const container = document.getElementById('stakeholder-canvas');
    if (!container) { showToast("No stakeholder map found.", "error"); return; }
    if (typeof html2canvas === 'undefined') { showToast("Export library not loaded — please refresh.", "error"); return; }
    const d = state.projectData;
    const title = (d?.meta?.title || 'stakeholders').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    showToast("Generating stakeholder map PNG…", "info");
    html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        logging: false, allowTaint: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) { showToast("Stakeholder PNG export failed.", "error"); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title}_stakeholders_${new Date().toISOString().slice(0,10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            showToast("Stakeholder map PNG downloaded.", "success");
        }, 'image/png');
    }).catch(err => {
        console.error('Stakeholder PNG export:', err);
        showToast("Stakeholder PNG export failed.", "error");
    });
}

export function updateChartEducation() {
    const p = document.getElementById('chart-education-panel');
    if (!p) return;
    const i = CHART_EDUCATION[chartMode];
    if (!i) { p.innerHTML = ''; return; }
    // Open by default while a project is still getting going; tucked away once
    // there's enough data that the chart speaks for itself.
    const n = (state.projectData?.chartData || []).length;
    const wasOpen = p.querySelector('details')?.dataset.mode === chartMode ? p.querySelector('details').open : n < 10;
    p.innerHTML = `
        <details data-mode="${chartMode}" ${wasOpen ? 'open' : ''}>
            <summary class="font-bold text-slate-700 text-sm flex items-center gap-2 cursor-pointer list-none">
                <i data-lucide="graduation-cap" class="w-4 h-4 text-rcem-purple"></i>
                How to read this: ${escapeHtml(i.title.replace(/ Guidance$/, ''))}
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 ml-auto"></i>
            </summary>
            <p class="text-xs text-slate-600 my-3 leading-relaxed">${escapeHtml(i.desc)}</p>
            <ul class="space-y-1.5">
                ${i.rules.map(r => `<li class="text-xs text-slate-600 flex items-start gap-2"><span class="text-rcem-purple mt-0.5">•</span><span>${escapeHtml(r)}</span></li>`).join('')}
            </ul>
        </details>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [p] });
}

export function renderFullViewChart() {
    // One chart per measure that has data, each drawn with that measure's own
    // settings. d.chartData / d.chartSettings are pointed at each measure in
    // turn and restored afterwards (they normally track the active measure).
    const d = state.projectData;
    if (!d) return;
    const measures = (Array.isArray(d.measures) && d.measures.length)
        ? d.measures.filter(m => Array.isArray(m.chartData) && m.chartData.length)
        : ((d.chartData || []).length ? [{ chartData: d.chartData, chartSettings: d.chartSettings }] : []);
    const savedData = d.chartData, savedSettings = d.chartSettings, savedMode = chartMode;
    measures.forEach((m, i) => {
        if (!document.getElementById(`full-view-chart-canvas-${i}`)) return;
        d.chartData = m.chartData;
        d.chartSettings = { ...(m.chartSettings || {}), mode: (m.chartSettings && m.chartSettings.mode) || 'run' };
        try { renderChart(`full-view-chart-canvas-${i}`); } catch (e) { console.error('[renderFullViewChart]', e); }
    });
    d.chartData = savedData;
    d.chartSettings = savedSettings;
    chartMode = savedMode;
}
