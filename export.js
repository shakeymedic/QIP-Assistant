import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";
import { renderChart, renderTools, toolMode } from "./charts.js";

// ==========================================================================
// EXPORT UTILITIES
// ==========================================================================

/**
 * Wait for an element to be rendered and contain content
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element|null>}
 */
async function waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element && element.innerHTML.trim() !== '') {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
}

/**
 * Wait for Mermaid diagrams to render
 * @param {Element} container - Container element
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>}
 */
async function waitForMermaid(container, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        // Check if mermaid SVG is present
        const svg = container.querySelector('svg');
        if (svg && svg.getBoundingClientRect().width > 0) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
}

/**
 * Wait for a canvas chart to be rendered
 * @param {string} canvasId - Canvas element ID
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<HTMLCanvasElement|null>}
 */
async function waitForChart(canvasId, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        const canvas = document.getElementById(canvasId);
        if (canvas && canvas.chartInstance) {
            // Give chart a moment to fully render
            await new Promise(resolve => setTimeout(resolve, 200));
            return canvas;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
}

/**
 * Convert canvas to image data URL
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @returns {string|null}
 */
function canvasToDataURL(canvas) {
    try {
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error('Failed to convert canvas to data URL:', e);
        return null;
    }
}

/**
 * Render tools to a temporary container for export
 * @param {string} mode - Tool mode ('driver', 'fishbone', 'process')
 * @returns {Promise<string|null>} - SVG or HTML content
 */
async function renderToolsForExport(mode) {
    // Create temporary container
    const tempContainer = document.createElement('div');
    tempContainer.id = 'export-temp-container';
    tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 800px; height: 600px;';
    document.body.appendChild(tempContainer);
    
    try {
        // Render tools to temp container
        await renderTools('export-temp-container', mode);
        
        // Wait for Mermaid to render if applicable
        if (mode === 'driver' || mode === 'process') {
            await waitForMermaid(tempContainer);
        }
        
        // Get the content
        const content = tempContainer.innerHTML;
        return content;
        
    } finally {
        // Clean up
        document.body.removeChild(tempContainer);
    }
}

// ==========================================================================
// POWERPOINT EXPORT
// ==========================================================================

export async function exportPPTX() {
    if (!state.projectData) {
        showToast("No project data to export", "error");
        return;
    }
    
    showToast("Generating PowerPoint...", "info");
    
    try {
        const pptx = new PptxGenJS();
        const d = state.projectData;
        const cl = d.checklist || {};
        
        // Configure presentation
        pptx.author = 'RCEM QIP Assistant';
        pptx.title = d.meta?.title || 'QIP Export';
        pptx.subject = 'Quality Improvement Project';
        pptx.company = 'Royal College of Emergency Medicine';
        
        // Define colors
        const RCEM_PURPLE = '2d2e83';
        const RCEM_ORANGE = 'f36f21';
        
        // ===========================================
        // SLIDE 1: Title Slide
        // ===========================================
        let slide = pptx.addSlide();
        slide.addText(d.meta?.title || 'Quality Improvement Project', {
            x: 0.5, y: 2, w: 9, h: 1.5,
            fontSize: 36, bold: true, color: RCEM_PURPLE,
            align: 'center', valign: 'middle'
        });
        
        const leadMember = d.teamMembers && d.teamMembers[0] ? d.teamMembers[0].name : 'Project Team';
        slide.addText(leadMember, {
            x: 0.5, y: 3.5, w: 9, h: 0.5,
            fontSize: 18, color: '666666',
            align: 'center'
        });
        
        slide.addText('Created with RCEM QIP Assistant', {
            x: 0.5, y: 5, w: 9, h: 0.3,
            fontSize: 10, color: '999999',
            align: 'center'
        });
        
        // ===========================================
        // SLIDE 2: Problem & Aim
        // ===========================================
        slide = pptx.addSlide();
        slide.addText('Problem & Aim', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: RCEM_PURPLE
        });
        
        // Problem box
        slide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: 1, w: 4.25, h: 2.5,
            fill: { color: 'f8fafc' },
            line: { color: 'e2e8f0', pt: 1 }
        });
        
        slide.addText('Problem', {
            x: 0.7, y: 1.1, w: 4, h: 0.4,
            fontSize: 14, bold: true, color: RCEM_PURPLE
        });
        
        slide.addText(cl.problem_desc || 'Not defined', {
            x: 0.7, y: 1.5, w: 3.9, h: 1.9,
            fontSize: 11, color: '374151',
            valign: 'top', wrap: true
        });
        
        // Aim box
        slide.addShape(pptx.ShapeType.rect, {
            x: 5.25, y: 1, w: 4.25, h: 2.5,
            fill: { color: 'eef2ff' },
            line: { color: 'c7d2fe', pt: 1 }
        });
        
        slide.addText('Aim', {
            x: 5.45, y: 1.1, w: 4, h: 0.4,
            fontSize: 14, bold: true, color: RCEM_PURPLE
        });
        
        slide.addText(cl.aim || 'Not defined', {
            x: 5.45, y: 1.5, w: 3.9, h: 1.9,
            fontSize: 11, color: '312e81', bold: true,
            valign: 'top', wrap: true
        });
        
        // Measures
        slide.addText('Measures', {
            x: 0.5, y: 3.7, w: 9, h: 0.4,
            fontSize: 14, bold: true, color: RCEM_PURPLE
        });
        
        const measures = [
            { label: 'Outcome', value: cl.measure_outcome || 'Not specified' },
            { label: 'Process', value: cl.measure_process || 'Not specified' },
            { label: 'Balancing', value: cl.measure_balance || 'Not specified' }
        ];
        
        measures.forEach((m, i) => {
            slide.addText(`${m.label}: ${m.value}`, {
                x: 0.5, y: 4.2 + (i * 0.4), w: 9, h: 0.35,
                fontSize: 10, color: '666666',
                bullet: { type: 'bullet', color: RCEM_PURPLE }
            });
        });
        
        // ===========================================
        // SLIDE 3: Methodology
        // ===========================================
        slide = pptx.addSlide();
        slide.addText('Methodology', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: RCEM_PURPLE
        });
        
        slide.addText(cl.methodology || 'Model for Improvement with PDSA cycles', {
            x: 0.5, y: 1, w: 9, h: 0.5,
            fontSize: 14, color: '374151'
        });
        
        // Driver diagram info
        if (d.drivers && (d.drivers.primary.length > 0 || d.drivers.changes.length > 0)) {
            slide.addText('Key Drivers:', {
                x: 0.5, y: 1.7, w: 9, h: 0.4,
                fontSize: 12, bold: true, color: RCEM_PURPLE
            });
            
            let yPos = 2.1;
            d.drivers.primary.forEach((driver, i) => {
                if (i < 5) {
                    slide.addText(driver, {
                        x: 0.5, y: yPos, w: 4.25, h: 0.35,
                        fontSize: 10, color: '374151',
                        bullet: { type: 'bullet', color: RCEM_PURPLE }
                    });
                    yPos += 0.35;
                }
            });
            
            if (d.drivers.changes.length > 0) {
                slide.addText('Change Ideas:', {
                    x: 5.25, y: 1.7, w: 4.25, h: 0.4,
                    fontSize: 12, bold: true, color: RCEM_ORANGE
                });
                
                yPos = 2.1;
                d.drivers.changes.forEach((change, i) => {
                    if (i < 5) {
                        slide.addText(change, {
                            x: 5.25, y: yPos, w: 4.25, h: 0.35,
                            fontSize: 10, color: '374151',
                            bullet: { type: 'bullet', color: RCEM_ORANGE }
                        });
                        yPos += 0.35;
                    }
                });
            }
        }
        
        // ===========================================
        // SLIDE 4: Results Chart
        // ===========================================
        slide = pptx.addSlide();
        slide.addText('Results', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: RCEM_PURPLE
        });
        
        // Try to capture the chart
        const mainChart = document.getElementById('mainChart');
        if (mainChart && mainChart.chartInstance) {
            try {
                const chartImage = mainChart.toDataURL('image/png');
                slide.addImage({
                    data: chartImage,
                    x: 0.5, y: 1, w: 9, h: 3.5
                });
            } catch (e) {
                console.error('Chart capture failed:', e);
                slide.addText('Chart data available in application', {
                    x: 0.5, y: 2, w: 9, h: 1,
                    fontSize: 14, color: '999999', italic: true,
                    align: 'center'
                });
            }
        } else {
            // Add data summary if no chart
            if (d.chartData && d.chartData.length > 0) {
                const values = d.chartData.map(x => x.value);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                const first = values[0];
                const last = values[values.length - 1];
                
                slide.addText(`Data Summary: ${d.chartData.length} data points`, {
                    x: 0.5, y: 1.5, w: 9, h: 0.4,
                    fontSize: 14, color: '374151'
                });
                
                slide.addText(`Baseline: ${first?.toFixed(1) || 'N/A'} → Current: ${last?.toFixed(1) || 'N/A'} (Avg: ${avg.toFixed(1)})`, {
                    x: 0.5, y: 2, w: 9, h: 0.4,
                    fontSize: 12, color: '666666'
                });
            }
        }
        
        // Results interpretation
        if (cl.results_text) {
            slide.addText('Interpretation:', {
                x: 0.5, y: 4.6, w: 9, h: 0.3,
                fontSize: 12, bold: true, color: RCEM_PURPLE
            });
            
            slide.addText(cl.results_text, {
                x: 0.5, y: 4.9, w: 9, h: 0.8,
                fontSize: 10, color: '374151',
                valign: 'top', wrap: true
            });
        }
        
        // ===========================================
        // SLIDE 5: PDSA Cycles
        // ===========================================
        if (d.pdsa && d.pdsa.length > 0) {
            slide = pptx.addSlide();
            slide.addText('PDSA Cycles', {
                x: 0.5, y: 0.3, w: 9, h: 0.6,
                fontSize: 24, bold: true, color: RCEM_PURPLE
            });
            
            let yPos = 1;
            d.pdsa.forEach((cycle, i) => {
                if (yPos > 4.5) return; // Prevent overflow
                
                slide.addText(`Cycle ${i + 1}: ${cycle.title || 'Untitled'}`, {
                    x: 0.5, y: yPos, w: 9, h: 0.4,
                    fontSize: 14, bold: true, color: RCEM_PURPLE
                });
                
                yPos += 0.4;
                
                const phases = [
                    { label: 'Plan', text: cycle.desc },
                    { label: 'Do', text: cycle.do },
                    { label: 'Study', text: cycle.study },
                    { label: 'Act', text: cycle.act }
                ];
                
                phases.forEach(phase => {
                    if (phase.text && yPos < 5) {
                        slide.addText(`${phase.label}: ${phase.text.substring(0, 150)}${phase.text.length > 150 ? '...' : ''}`, {
                            x: 0.5, y: yPos, w: 9, h: 0.35,
                            fontSize: 9, color: '666666',
                            bullet: { type: 'bullet', color: RCEM_ORANGE }
                        });
                        yPos += 0.35;
                    }
                });
                
                yPos += 0.3;
            });
        }
        
        // ===========================================
        // SLIDE 6: Learning & Sustainability
        // ===========================================
        slide = pptx.addSlide();
        slide.addText('Learning & Sustainability', {
            x: 0.5, y: 0.3, w: 9, h: 0.6,
            fontSize: 24, bold: true, color: RCEM_PURPLE
        });
        
        // Learning box
        slide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: 1, w: 4.25, h: 2.5,
            fill: { color: 'fef3c7' },
            line: { color: 'fcd34d', pt: 1 }
        });
        
        slide.addText('Key Learning', {
            x: 0.7, y: 1.1, w: 4, h: 0.4,
            fontSize: 14, bold: true, color: '92400e'
        });
        
        slide.addText(cl.learning || 'Not documented', {
            x: 0.7, y: 1.5, w: 3.9, h: 1.9,
            fontSize: 10, color: '78350f',
            valign: 'top', wrap: true
        });
        
        // Sustainability box
        slide.addShape(pptx.ShapeType.rect, {
            x: 5.25, y: 1, w: 4.25, h: 2.5,
            fill: { color: 'd1fae5' },
            line: { color: '6ee7b7', pt: 1 }
        });
        
        slide.addText('Sustainability Plan', {
            x: 5.45, y: 1.1, w: 4, h: 0.4,
            fontSize: 14, bold: true, color: '065f46'
        });
        
        slide.addText(cl.sustain || 'Not documented', {
            x: 5.45, y: 1.5, w: 3.9, h: 1.9,
            fontSize: 10, color: '064e3b',
            valign: 'top', wrap: true
        });
        
        // ===========================================
        // SLIDE 7: Team
        // ===========================================
        if (d.teamMembers && d.teamMembers.length > 0) {
            slide = pptx.addSlide();
            slide.addText('Project Team', {
                x: 0.5, y: 0.3, w: 9, h: 0.6,
                fontSize: 24, bold: true, color: RCEM_PURPLE
            });
            
            let yPos = 1;
            d.teamMembers.forEach((member, i) => {
                if (i < 8) {
                    slide.addText(`${member.name} - ${member.role}${member.grade ? ` (${member.grade})` : ''}`, {
                        x: 0.5, y: yPos, w: 9, h: 0.4,
                        fontSize: 12, color: '374151',
                        bullet: { type: 'bullet', color: RCEM_PURPLE }
                    });
                    yPos += 0.4;
                }
            });
        }
        
        // Generate and download
        const fileName = `${(d.meta?.title || 'QIP').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pptx`;
        await pptx.writeFile({ fileName });
        
        showToast("PowerPoint exported successfully!", "success");
        
    } catch (error) {
        console.error('PPTX export error:', error);
        showToast("Export failed: " + error.message, "error");
    }
}

// ==========================================================================
// POSTER PREVIEW & PRINT
// ==========================================================================

export function printPoster() {
    if (!state.projectData) {
        showToast("No project data", "error");
        return;
    }
    
    const d = state.projectData;
    const cl = d.checklist || {};
    
    const modal = document.getElementById('poster-modal');
    const previewArea = document.getElementById('poster-preview-area');
    
    if (!modal || !previewArea) {
        showToast("Poster preview not available", "error");
        return;
    }
    
    // Build poster HTML
    previewArea.innerHTML = `
        <div id="poster-content" class="bg-white shadow-2xl w-full max-w-4xl" style="aspect-ratio: 1/1.414; padding: 40px;">
            <div class="h-full flex flex-col">
                <!-- Header -->
                <div class="text-center border-b-4 border-rcem-purple pb-4 mb-4">
                    <h1 class="text-2xl font-bold text-rcem-purple mb-2">${escapeHtml(d.meta?.title || 'Quality Improvement Project')}</h1>
                    <p class="text-sm text-slate-600">${d.teamMembers && d.teamMembers[0] ? escapeHtml(d.teamMembers[0].name) : 'Project Team'}</p>
                </div>
                
                <!-- Grid Content -->
                <div class="flex-1 grid grid-cols-2 gap-4 text-sm">
                    <!-- Left Column -->
                    <div class="space-y-4">
                        <div class="bg-slate-50 p-4 rounded border border-slate-200">
                            <h3 class="font-bold text-rcem-purple text-xs uppercase mb-2">Background</h3>
                            <p class="text-xs leading-relaxed">${escapeHtml(cl.problem_desc || 'Not defined')}</p>
                        </div>
                        
                        <div class="bg-indigo-50 p-4 rounded border border-indigo-200">
                            <h3 class="font-bold text-rcem-purple text-xs uppercase mb-2">Aim</h3>
                            <p class="text-xs font-bold leading-relaxed">${escapeHtml(cl.aim || 'Not defined')}</p>
                        </div>
                        
                        <div class="bg-slate-50 p-4 rounded border border-slate-200">
                            <h3 class="font-bold text-rcem-purple text-xs uppercase mb-2">Methods</h3>
                            <p class="text-xs leading-relaxed">${escapeHtml(cl.methodology || 'Model for Improvement with PDSA cycles')}</p>
                            ${d.pdsa && d.pdsa.length > 0 ? `<p class="text-xs mt-2">${d.pdsa.length} PDSA cycle(s) completed.</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Right Column -->
                    <div class="space-y-4">
                        <div class="bg-slate-50 p-4 rounded border border-slate-200 flex-1">
                            <h3 class="font-bold text-rcem-purple text-xs uppercase mb-2">Results</h3>
                            <div id="poster-chart-container" class="h-32 mb-2">
                                <canvas id="poster-chart"></canvas>
                            </div>
                            <p class="text-xs leading-relaxed">${escapeHtml(cl.results_text || 'Not documented')}</p>
                        </div>
                        
                        <div class="bg-amber-50 p-4 rounded border border-amber-200">
                            <h3 class="font-bold text-amber-800 text-xs uppercase mb-2">Key Learning</h3>
                            <p class="text-xs leading-relaxed">${escapeHtml(cl.learning || 'Not documented')}</p>
                        </div>
                        
                        <div class="bg-emerald-50 p-4 rounded border border-emerald-200">
                            <h3 class="font-bold text-emerald-800 text-xs uppercase mb-2">Sustainability</h3>
                            <p class="text-xs leading-relaxed">${escapeHtml(cl.sustain || 'Not documented')}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="mt-4 pt-4 border-t border-slate-200 text-center">
                    <p class="text-xs text-slate-400">Created with RCEM QIP Assistant</p>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Render mini chart in poster
    setTimeout(() => {
        const posterCanvas = document.getElementById('poster-chart');
        if (posterCanvas && d.chartData && d.chartData.length > 0) {
            const sortedData = [...d.chartData].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            new Chart(posterCanvas, {
                type: 'line',
                data: {
                    labels: sortedData.map(x => x.date),
                    datasets: [{
                        data: sortedData.map(x => x.value),
                        borderColor: '#2d2e83',
                        backgroundColor: 'rgba(45, 46, 131, 0.1)',
                        pointRadius: 2,
                        fill: true,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: true, ticks: { font: { size: 8 } } }
                    }
                }
            });
        }
    }, 100);
}

export function printPosterOnly() {
    const posterContent = document.getElementById('poster-content');
    if (!posterContent) {
        showToast("No poster to print", "error");
        return;
    }
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("Pop-up blocked. Please allow pop-ups.", "error");
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QIP Poster</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page { size: A4 portrait; margin: 0; }
                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                }
                body { 
                    margin: 0; 
                    padding: 20px; 
                    font-family: system-ui, -apple-system, sans-serif;
                }
            </style>
        </head>
        <body>
            ${posterContent.outerHTML}
            <script>
                setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}
