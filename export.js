import { state } from './state.js';
import { escapeHtml, showToast } from './utils.js';
import { renderChart, renderTools } from './charts.js';

// === UNIFIED EXPORT PREVIEW (THE "POSTER" MODAL) ===
export function printPoster() {
    if (!state.projectData) { alert("Please load a project first."); return; }
    
    const d = state.projectData;
    const modal = document.getElementById('poster-modal');
    const previewArea = document.getElementById('poster-preview-area');
    
    // 1. Build the HTML Structure
    previewArea.innerHTML = `
        <div id="poster-content-wrapper" class="bg-white p-4 w-full">
            <div class="poster-grid">
                <div class="poster-header">
                    <div class="poster-title-area">
                        <h1 class="text-3xl font-bold text-white mb-2">${escapeHtml(d.meta.title)}</h1>
                        <p class="text-white opacity-90">${escapeHtml(d.checklist.team) || 'QI Team'}</p>
                    </div>
                    <div class="poster-actions no-print flex gap-3 ml-auto">
                         <button onclick="window.exportPPTX()" class="bg-white text-rcem-purple px-4 py-2 rounded font-bold shadow hover:bg-slate-100 flex items-center gap-2"><i data-lucide="presentation" class="w-4 h-4"></i> Download PowerPoint</button>
                    </div>
                </div>
                
                <div class="poster-col">
                    <div class="poster-box"><h2>Problem</h2><p>${escapeHtml(d.checklist.problem_desc)}</p></div>
                    <div class="poster-box aim-box"><h2>Aim</h2><p class="aim-statement">${escapeHtml(d.checklist.aim)}</p></div>
                    <div class="poster-box">
                        <h2>Driver Diagram</h2>
                        <div id="poster-driver-container" class="mermaid flex justify-center items-center min-h-[200px]"></div>
                    </div>
                </div>
                
                <div class="poster-col">
                    <div class="poster-box">
                        <h2>Results (Run Chart)</h2>
                        <div class="chart-holder" style="height: 400px; position: relative;">
                            <canvas id="poster-chart-canvas"></canvas>
                        </div>
                        <div class="analysis-box mt-4"><p>${escapeHtml(d.checklist.results_text)}</p></div>
                    </div>
                </div>
                
                <div class="poster-col">
                    <div class="poster-box"><h2>Learning</h2><p>${escapeHtml(d.checklist.learning)}</p></div>
                    <div class="poster-box sustain-box"><h2>Sustainability</h2><p>${escapeHtml(d.checklist.sustain)}</p></div>
                    <div class="poster-box"><h2>Contact</h2><p>${escapeHtml(state.currentUser ? state.currentUser.email : 'N/A')}</p></div>
                </div>
            </div>
        </div>
    `;

    // 2. Render Live Assets into the Modal
    setTimeout(() => {
        // Render Chart
        renderChart('poster-chart-canvas');
        
        // Render Driver Diagram
        renderTools('poster-driver-container', 'driver');
        
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }, 100);

    // 3. Show Modal
    modal.classList.remove('hidden');
}

export function printPosterOnly() {
    const container = document.getElementById('print-container');
    const modalContent = document.getElementById('poster-content-wrapper').innerHTML;
    
    container.innerHTML = modalContent;
    container.style.display = 'block';
    
    document.body.classList.add('printing-poster');
    window.print();
    
    // Cleanup
    setTimeout(() => {
        document.body.classList.remove('printing-poster');
        container.style.display = 'none';
        container.innerHTML = '';
    }, 500);
}

// === POWERPOINT EXPORT (FROM LIVE ASSETS) ===
export async function exportPPTX() {
    if (typeof PptxGenJS === 'undefined') { alert("PowerPoint library not loaded."); return; }
    
    const btn = document.querySelector("button[onclick='window.exportPPTX()']");
    const originalText = btn ? btn.innerHTML : '';
    if(btn) { btn.disabled = true; btn.innerHTML = 'Generating...'; }

    try {
        const d = state.projectData;
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9'; pres.author = 'RCEM QIP Assistant'; pres.title = d.meta.title;

        // 1. Capture Assets from the VISIBLE modal
        const chartCanvas = document.getElementById('poster-chart-canvas');
        const driverContainer = document.querySelector('#poster-driver-container svg');
        
        let chartImg = null;
        let driverImg = null;

        if (chartCanvas) {
            chartImg = chartCanvas.toDataURL('image/png');
        }

        if (driverContainer) {
            const svgData = new XMLSerializer().serializeToString(driverContainer);
            const canvas = document.createElement('canvas');
            const bbox = driverContainer.getBoundingClientRect();
            // High resolution capture
            canvas.width = bbox.width * 2; 
            canvas.height = bbox.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const img = new Image();
            const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            
            await new Promise((resolve) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    driverImg = canvas.toDataURL('image/png');
                    resolve();
                };
                img.src = url;
            });
        }

        // 2. Build Slides
        const RCEM_NAVY = '2d2e83'; const SLATE_500 = '64748b';

        pres.defineSlideMaster({
            title: 'RCEM_MASTER', background: { color: 'FFFFFF' },
            objects: [
                { rect: { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: RCEM_NAVY } } },
                { rect: { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: RCEM_NAVY } } },
                { text: { text: d.meta.title, options: { x: 0.3, y: 5.48, w: 7, fontSize: 9, color: 'FFFFFF' } } }
            ]
        });

        const addContentSlide = (title) => {
            const s = pres.addSlide({ masterName: 'RCEM_MASTER' });
            s.addText(title, { x: 0.4, y: 0.25, w: 9.2, h: 0.5, fontSize: 24, bold: true, color: RCEM_NAVY });
            return s;
        };

        // Title Slide
        const s1 = pres.addSlide(); s1.background = { color: RCEM_NAVY };
        s1.addText(d.meta.title, { x: 0.8, y: 1.8, w: 8.4, h: 1.2, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
        
        // Summary
        const s2 = addContentSlide('Executive Summary');
        s2.addText(`Problem: ${d.checklist.problem_desc}`, { x: 0.4, y: 1.0, w: 9, h: 0.5, fontSize: 14, color: SLATE_500 });
        s2.addText(d.checklist.aim, { x: 0.4, y: 1.6, w: 9, h: 0.8, fontSize: 16, italic: true, color: RCEM_NAVY, fill: { color: 'EFF6FF' } });
        s2.addText(`Results: ${d.checklist.results_text}`, { x: 0.4, y: 2.6, w: 9, h: 1.5, fontSize: 14, color: SLATE_500 });

        // Assets
        if (chartImg) { const sC = addContentSlide('Run Chart'); sC.addImage({ data: chartImg, x: 0.5, y: 1.2, w: 9.0, h: 4.0, sizing: { type: 'contain' } }); }
        if (driverImg) { const sD = addContentSlide('Driver Diagram'); sD.addImage({ data: driverImg, x: 0.5, y: 1.2, w: 9.0, h: 4.0, sizing: { type: 'contain' } }); }

        pres.writeFile({ fileName: `${d.meta.title.replace(/[^a-z0-9]/gi, '_')}_QIP.pptx` });

    } catch (err) {
        console.error(err);
        alert('Export Error: ' + err.message);
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = originalText; if(typeof lucide !=='undefined') lucide.createIcons(); }
    }
}
