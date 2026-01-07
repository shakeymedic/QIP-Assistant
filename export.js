import { state } from './state.js';
import { escapeHtml } from './utils.js';

async function getVisualAsset(type) {
    if (!state.projectData) return { success: false, error: "No project data." };

    // Create hidden container if needed
    let container = document.getElementById('asset-staging-area');
    if (!container) {
        container = document.createElement('div');
        container.id = 'asset-staging-area';
        // Place it off-screen but make it "visible" to the browser so rendering works
        container.style.cssText = `position: fixed; top: 0; left: -9999px; width: 1600px; height: 1200px; z-index: -9999; visibility: visible; background-color: white; opacity: 0;`;
        document.body.appendChild(container);
    }
    container.innerHTML = '';

    try {
        if (type === 'chart') {
            if (typeof Chart === 'undefined') throw new Error("Chart.js library missing.");
            
            const canvas = document.createElement('canvas');
            canvas.width = 1600; 
            canvas.height = 900;
            container.appendChild(canvas);

            const data = [...state.projectData.chartData].sort((a,b) => new Date(a.date) - new Date(b.date));
            if (data.length === 0) throw new Error("No data points to chart.");

            const values = data.map(d => Number(d.value));
            const labels = data.map(d => d.date);
            
            // Baseline calc
            let baselinePoints = values.slice(0, 12);
            let sortedBaseline = [...baselinePoints].sort((a,b) => a - b);
            let currentMedian = sortedBaseline.length ? sortedBaseline[Math.floor(sortedBaseline.length/2)] : 0;
            const pointColors = values.map(v => (v > currentMedian ? '#059669' : '#2d2e83')); 
            
            const annotations = { 
                median: { type: 'line', yMin: currentMedian, yMax: currentMedian, borderColor: '#94a3b8', borderDash: [5,5], borderWidth: 2 } 
            };

            data.filter(d => d.note).forEach((d, i) => {
                annotations[`pdsa${i}`] = { type: 'line', xMin: d.date, xMax: d.date, borderColor: '#f36f21', borderWidth: 2, label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' } };
            });

            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: 'Measure', data: values, borderColor: '#2d2e83', backgroundColor: pointColors, pointBackgroundColor: pointColors, pointRadius: 8, tension: 0.1, borderWidth: 3 }] },
                options: { 
                    animation: false, 
                    responsive: false, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        annotation: { annotations }, 
                        legend: { display: false },
                        title: { display: true, text: 'Run Chart', font: { size: 24 } }
                    }, 
                    scales: { y: { beginAtZero: true }, x: { display: true } } 
                }
            });
            
            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));
            return { success: true, img: canvas.toDataURL('image/png') };
        }

        if (type === 'driver' || type === 'fishbone') {
            if (typeof mermaid === 'undefined') throw new Error("Mermaid library missing.");
            
            const clean = (t) => t ? String(t).replace(/["()[\]{}#]/g, '').replace(/\n/g, ' ').trim() : '...';
            let mCode = "";
            
            if (type === 'driver') {
                const d = state.projectData.drivers;
                if(!d.primary.length && !d.secondary.length && !d.changes.length) throw new Error("No drivers defined.");
                mCode = `graph LR\n  AIM[AIM] --> P[Primary Drivers]\n  P --> S[Secondary]\n  S --> C[Change Ideas]\n`;
                d.primary.forEach((x,i) => mCode += `  P --> P${i}["${clean(x)}"]\n`);
                d.secondary.forEach((x,i) => mCode += `  S --> S${i}["${clean(x)}"]\n`);
                d.changes.forEach((x,i) => mCode += `  C --> C${i}["${clean(x)}"]\n`);
            } else {
                const cats = state.projectData.fishbone.categories;
                if (cats.every(c => c.causes.length === 0)) throw new Error("Fishbone empty.");
                mCode = `mindmap\n  root(("${clean(state.projectData.meta.title || 'Problem')}"))\n` + cats.map(c => `    ${clean(c.text)}\n` + c.causes.map(x => `      ${clean(x)}`).join('\n')).join('\n');
            }

            // Create temporary container for mermaid
            const mermaidId = `mermaid-export-${Date.now()}`;
            // We use a PRE element for mermaid to latch onto
            const preEl = document.createElement('pre');
            preEl.className = "mermaid";
            preEl.id = mermaidId;
            preEl.textContent = mCode;
            container.appendChild(preEl);

            // Run Mermaid (v10+ API)
            await mermaid.run({ nodes: [preEl] });
            
            // Extract the generated SVG
            const svgEl = container.querySelector('svg');
            if(!svgEl) throw new Error("Mermaid failed to generate SVG");

            // Prepare SVG for Canvas conversion
            // We must serialize it with specific dimensions to avoid cropping
            const bbox = svgEl.getBoundingClientRect();
            let width = bbox.width;
            let height = bbox.height;
            
            // Force attributes
            svgEl.setAttribute("width", width);
            svgEl.setAttribute("height", height);
            
            const svgString = new XMLSerializer().serializeToString(svgEl);
            const canvas = document.createElement('canvas');
            
            // high-res scale
            const scale = 2; 
            canvas.width = width * scale;
            canvas.height = height * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const img = new Image();
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width * scale, height * scale);
                    URL.revokeObjectURL(url);
                    resolve({ success: true, img: canvas.toDataURL("image/png") });
                };
                img.onerror = (e) => reject(e);
                img.src = url;
            });
        }
    } catch (e) { 
        console.error("Export Error:", e);
        return { success: false, error: e.message }; 
    } finally {
        // Cleanup staging area
        // const stagingArea = document.getElementById('asset-staging-area');
        // if (stagingArea) stagingArea.innerHTML = '';
        // NOTE: Commented out cleanup for debug if needed, but normally should clean up
        document.getElementById('asset-staging-area').innerHTML = '';
    }
    return { success: false, error: "Unknown type" };
}

export async function exportPPTX() {
    if (!state.projectData) { alert("Please load a project first."); return; }
    if (typeof PptxGenJS === 'undefined') { alert("PowerPoint library not loaded."); return; }
    const exportBtn = document.querySelector("button[onclick='exportPPTX()']");
    const originalHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) { exportBtn.disabled = true; exportBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generating...'; lucide.createIcons(); }

    try {
        const d = state.projectData;
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9'; pres.author = 'RCEM QIP Assistant'; pres.title = d.meta.title;
        
        // Generate assets first
        const driverRes = await getVisualAsset('driver');
        const chartRes = await getVisualAsset('chart');

        const RCEM_NAVY = '2d2e83'; const RCEM_ORANGE = 'f36f21'; const SLATE_500 = '64748b';

        pres.defineSlideMaster({
            title: 'RCEM_MASTER', background: { color: 'FFFFFF' },
            objects: [
                { rect: { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: RCEM_NAVY } } },
                { rect: { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: RCEM_NAVY } } },
                { text: { text: d.meta.title, options: { x: 0.3, y: 5.48, w: 7, fontSize: 9, color: 'FFFFFF' } } }
            ]
        });

        const addContentSlide = (title, subtitle = null) => {
            const s = pres.addSlide({ masterName: 'RCEM_MASTER' });
            s.addText(title, { x: 0.4, y: 0.25, w: 9.2, h: 0.5, fontSize: 24, bold: true, color: RCEM_NAVY });
            if (subtitle) s.addText(subtitle, { x: 0.4, y: 0.7, w: 9.2, h: 0.3, fontSize: 12, color: SLATE_500 });
            return s;
        };

        const s1 = pres.addSlide(); s1.background = { color: RCEM_NAVY };
        s1.addText(d.meta.title, { x: 0.8, y: 1.8, w: 8.4, h: 1.2, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
        
        const s2 = addContentSlide('Executive Summary');
        s2.addText(d.checklist.aim || 'No aim defined', { x: 0.4, y: 1.5, w: 9.2, h: 1.0, fontSize: 16, italic: true, color: RCEM_NAVY, fill: { color: 'EFF6FF' } });
        
        if (chartRes.success) { const sC = addContentSlide('Run Chart'); sC.addImage({ data: chartRes.img, x: 0.4, y: 1.2, w: 9.2, h: 4.0, sizing: { type: 'contain' } }); }
        if (driverRes.success) { const sD = addContentSlide('Driver Diagram'); sD.addImage({ data: driverRes.img, x: 0.4, y: 1.2, w: 9.2, h: 4.0, sizing: { type: 'contain' } }); }

        pres.writeFile({ fileName: `${d.meta.title.replace(/[^a-z0-9]/gi, '_')}_QIP.pptx` });

    } catch (err) { console.error(err); alert('Error: ' + err.message); } 
    finally { if (exportBtn) { exportBtn.disabled = false; exportBtn.innerHTML = originalHTML; lucide.createIcons(); } }
}

export async function printPoster() {
    if (!state.projectData) { alert("Please load a project first."); return; }
    const d = state.projectData;
    const container = document.getElementById('print-container');
    const modal = document.getElementById('poster-modal');
    const previewArea = document.getElementById('poster-preview-area');
    
    // Generate Assets
    let chartImgHtml = '<p class="text-slate-400 italic">No chart data available</p>';
    const chartRes = await getVisualAsset('chart');
    if (chartRes.success) chartImgHtml = `<img src="${chartRes.img}" class="img-fluid" alt="Run Chart" style="max-height: 400px; width: auto; margin: 0 auto;">`;

    let driverImgHtml = '';
    const driverRes = await getVisualAsset('driver');
    if (driverRes.success) driverImgHtml = `<div class="driver-holder"><img src="${driverRes.img}" class="img-fluid" alt="Driver Diagram"></div>`;

    container.innerHTML = `
        <div class="poster-grid">
            <div class="poster-header">
                <div class="poster-title-area"><h1>${escapeHtml(d.meta.title)}</h1><p>${escapeHtml(d.checklist.team) || 'QI Team'}</p></div>
            </div>
            <div class="poster-col">
                <div class="poster-box"><h2>Problem</h2><p>${escapeHtml(d.checklist.problem_desc)}</p></div>
                <div class="poster-box aim-box"><h2>Aim</h2><p class="aim-statement">${escapeHtml(d.checklist.aim)}</p></div>
                <div class="poster-box"><h2>Drivers</h2>${driverImgHtml}</div>
            </div>
            <div class="poster-col">
                <div class="poster-box"><h2>Results</h2><div class="chart-holder">${chartImgHtml}</div><div class="analysis-box"><p>${escapeHtml(d.checklist.results_text)}</p></div></div>
            </div>
            <div class="poster-col">
                <div class="poster-box"><h2>Learning</h2><p>${escapeHtml(d.checklist.learning)}</p></div>
                <div class="poster-box sustain-box"><h2>Sustainability</h2><p>${escapeHtml(d.checklist.sustain)}</p></div>
            </div>
        </div>
    `;

    // Clone content to preview modal
    previewArea.innerHTML = container.innerHTML;
    
    // Show Modal
    modal.classList.remove('hidden');
    container.classList.remove('hidden'); // Keep in DOM for printing but hidden via modal overlay or z-index
}

export function printPosterOnly() {
    document.body.classList.add('printing-poster');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('printing-poster');
    }, 500);
}
