// --- STATE MANAGEMENT ---
let project = {
    title: "",
    lead: "",
    team: "",
    problem: "",
    aim: "",
    drivers: { primary: [], secondary: [], changes: [] },
    data: [], // { date, value, series, note }
    pdsa: [] // { title, plan, do, study, act }
};

let chartInstance = null;
let currentZoom = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;

// --- INITIALIZATION ---
window.startApp = () => {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.remove('hidden');
    document.getElementById('app-sidebar').classList.add('flex');
    renderAll();
};

window.loadDemo = () => {
    project = {
        title: "Improving Sepsis 6 Bundle Delivery",
        lead: "Dr. A. Medic",
        team: "Sr. Nurse, Dr. Consultant",
        problem: "Local audit revealed only 45% of Red Flag Sepsis patients receive antibiotics within 1 hour.",
        aim: "To increase delivery of Sepsis 6 bundle within 1 hour to 90% by August 2025.",
        drivers: {
            primary: ["Recognition", "Equipment", "Culture"],
            secondary: ["Triage Tool", "Sepsis Trolley", "Feedback"],
            changes: ["Sepsis Stamp", "Grab Bags", "Weekly Email"]
        },
        data: [
            { date: "2025-01-01", value: 45, series: "outcome", note: "Baseline" },
            { date: "2025-01-08", value: 42, series: "outcome", note: "" },
            { date: "2025-01-15", value: 65, series: "outcome", note: "PDSA 1: Stamp" },
            { date: "2025-01-22", value: 70, series: "outcome", note: "" },
            { date: "2025-01-29", value: 85, series: "outcome", note: "PDSA 2: Bags" }
        ],
        pdsa: [
            { title: "Cycle 1: Sepsis Stamp", plan: "Test rubber stamp in notes", do: "Used for 1 week", study: "Compliance rose", act: "Adopt" }
        ]
    };
    // Fill inputs
    document.getElementById('chk-title').value = project.title;
    document.getElementById('chk-lead').value = project.lead;
    document.getElementById('chk-team').value = project.team;
    document.getElementById('chk-problem').value = project.problem;
    document.getElementById('chk-aim').value = project.aim;
    
    startApp();
};

window.router = (view) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    
    if(view === 'dashboard') renderDashboard();
    if(view === 'tools') renderDriver();
    if(view === 'data') renderChart();
    if(view === 'pdsa') renderPDSA();
    if(view === 'kaizen') renderKaizen();
    if(view === 'poster') renderPoster();
};

// --- DRIVER DIAGRAM ENGINE (PAN/ZOOM) ---
window.setTool = (type) => {
    if(type === 'driver') renderDriver();
    else if(type === 'fishbone') renderFishbone();
};

function initPanZoom() {
    const container = document.getElementById('diagram-viewport');
    const canvas = document.getElementById('diagram-canvas');

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        container.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });
    
    // Reset transform on load
    translateX = 0; translateY = 0; currentZoom = 1;
    updateTransform();
}

function updateTransform() {
    const canvas = document.getElementById('diagram-canvas');
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

window.zoomDiagram = (delta) => {
    currentZoom = Math.max(0.2, Math.min(3, currentZoom + delta));
    updateTransform();
};
window.resetZoom = () => {
    currentZoom = 1; translateX = 0; translateY = 0;
    updateTransform();
};

async function renderDriver() {
    const d = project.drivers;
    const def = `graph LR
    Aim[AIM: ${project.aim.substring(0,30)}...] --> P[Primary Drivers]
    P --> S[Secondary Drivers]
    S --> C[Change Ideas]
    style Aim fill:#2d2e83,color:#fff,stroke-width:0px
    style P fill:#f4f6f8,stroke:#2d2e83
    style S fill:#f4f6f8,stroke:#2d2e83
    style C fill:#fff,stroke:#f36f21,stroke-dasharray: 5 5
    
    ${d.primary.map((x,i) => `P --> P${i}["${x}"]`).join('\n')}
    ${d.secondary.map((x,i) => `S --> S${i}["${x}"]`).join('\n')}
    ${d.changes.map((x,i) => `C --> C${i}["${x}"]`).join('\n')}
    `;
    
    const element = document.getElementById('diagram-canvas');
    element.innerHTML = `<div class="mermaid">${def}</div>`;
    await mermaid.run();
    initPanZoom();
}

window.addDriverItem = (type) => {
    const val = prompt(`Enter ${type} driver text:`);
    if(val) {
        if(type === 'primary') project.drivers.primary.push(val);
        if(type === 'secondary') project.drivers.secondary.push(val);
        if(type === 'change') project.drivers.changes.push(val);
        renderDriver();
    }
};

// --- DATA & CHARTING ---
window.addData = () => {
    const date = document.getElementById('data-date').value;
    const val = document.getElementById('data-val').value;
    const series = document.getElementById('data-series').value;
    const note = document.getElementById('data-note').value;
    
    if(date && val) {
        project.data.push({ date, value: parseFloat(val), series, note });
        project.data.sort((a,b) => new Date(a.date) - new Date(b.date));
        renderChart();
        renderDataTable();
        // Clear inputs
        document.getElementById('data-val').value = '';
        document.getElementById('data-note').value = '';
    }
};

function renderDataTable() {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = project.data.map((d, i) => `
        <tr class="border-b hover:bg-slate-50">
            <td class="p-3">${d.date}</td>
            <td class="p-3 uppercase text-xs font-bold ${d.series === 'outcome' ? 'text-rcem-purple' : 'text-blue-600'}">${d.series}</td>
            <td class="p-3">${d.value}</td>
            <td class="p-3 text-xs text-slate-500">${d.note}</td>
            <td class="p-3"><button onclick="window.deleteData(${i})" class="text-red-500 hover:text-red-700">x</button></td>
        </tr>
    `).join('');
}

window.deleteData = (i) => { project.data.splice(i,1); renderChart(); renderDataTable(); };

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    // Filter for Outcome mainly, but allows expansion
    const outcomeData = project.data.filter(d => d.series === 'outcome');
    
    // Annotations for notes
    const annotations = {};
    outcomeData.forEach((d, i) => {
        if(d.note) {
            annotations[`note${i}`] = {
                type: 'line',
                xMin: d.date, xMax: d.date,
                borderColor: '#f36f21', borderWidth: 2, borderDash: [5,5],
                label: { display: true, content: d.note, position: 'start', backgroundColor: '#f36f21', color: 'white' }
            };
        }
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: outcomeData.map(d => d.date),
            datasets: [{
                label: 'Outcome Measure',
                data: outcomeData.map(d => d.value),
                borderColor: '#2d2e83',
                backgroundColor: '#2d2e83',
                tension: 0,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                annotation: { annotations: annotations },
                legend: { position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Measure Value' } }
            }
        }
    });
}

// --- PDSA ---
window.addPDSA = () => {
    project.pdsa.push({ title: `Cycle ${project.pdsa.length + 1}`, plan: "", do: "", study: "", act: "" });
    renderPDSA();
};

function renderPDSA() {
    const container = document.getElementById('pdsa-container');
    container.innerHTML = project.pdsa.map((c, i) => `
        <div class="bg-white p-6 rounded-xl shadow border-l-4 border-rcem-purple">
            <input class="font-bold text-lg w-full mb-4 border-b" value="${c.title}" onchange="project.pdsa[${i}].title = this.value">
            <div class="grid grid-cols-2 gap-4">
                ${['Plan','Do','Study','Act'].map(stage => `
                    <div>
                        <label class="text-xs font-bold uppercase text-slate-500">${stage}</label>
                        <textarea class="w-full border p-2 rounded text-sm h-20" onchange="project.pdsa[${i}].${stage.toLowerCase()} = this.value">${c[stage.toLowerCase()] || ''}</textarea>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// --- KAIZEN WRITER (The "Perfect" Helper) ---
function renderKaizen() {
    // Collect data from inputs just in case
    project.title = document.getElementById('chk-title').value;
    project.problem = document.getElementById('chk-problem').value;
    project.aim = document.getElementById('chk-aim').value;

    const fields = [
        { 
            id: 'k-problem', 
            label: '1. Problem / Background', 
            content: `**Problem:** ${project.problem}\n\n**Evidence:** Baseline data collected from [Date] to [Date] showed that... (insert data details). This impacts patient safety because...` 
        },
        { 
            id: 'k-aim', 
            label: '2. SMART Aim', 
            content: project.aim 
        },
        { 
            id: 'k-process', 
            label: '3. Strategy & Drivers', 
            content: `We utilized a Driver Diagram to identify key areas for improvement.\n\n**Primary Drivers:** ${project.drivers.primary.join(', ')}.\n**Interventions:** ${project.drivers.changes.join(', ')}.` 
        },
        { 
            id: 'k-pdsa', 
            label: '4. PDSA Cycles', 
            content: project.pdsa.map(p => `**${p.title}:**\n- Plan: ${p.plan}\n- Do: ${p.do}\n- Study: ${p.study}\n- Act: ${p.act}`).join('\n\n') 
        },
        { 
            id: 'k-measures', 
            label: '5. Measures', 
            content: `**Outcome Measure:** ${project.aim}\n**Process Measure:** Compliance with [Specific Intervention].\n**Balancing Measure:** Ensuring no delay in [Other Area].` 
        }
    ];

    document.getElementById('kaizen-output').innerHTML = fields.map(f => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-rcem-purple">${f.label}</h3>
                <button onclick="navigator.clipboard.writeText(this.dataset.text); alert('Copied!')" data-text="${f.content.replace(/"/g, '&quot;')}" class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-100">Copy for Portfolio</button>
            </div>
            <pre class="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 p-4 rounded border border-slate-100">${f.content}</pre>
        </div>
    `).join('');
}

// --- A0 POSTER RENDERER ---
async function renderPoster() {
    // 1. Sync Data
    document.getElementById('p-title').textContent = document.getElementById('chk-title').value || "Untitled Project";
    document.getElementById('p-authors').textContent = document.getElementById('chk-lead').value || "Author Name";
    document.getElementById('p-intro').textContent = document.getElementById('chk-problem').value;
    document.getElementById('p-aim').textContent = document.getElementById('chk-aim').value;
    
    // 2. Render Driver Diagram SVG specifically for poster
    const driverDiv = document.getElementById('p-driver');
    // Using a simpler graph for the poster view to ensure it fits
    const d = project.drivers;
    const mermaidCode = `graph TD
      A[Aim] --> P[Primary Drivers]
      P --> C[Changes]
      ${d.primary.slice(0,3).map((x,i)=>`P-->P${i}("${x}")`).join('\n')}
      ${d.changes.slice(0,3).map((x,i)=>`C-->C${i}("${x}")`).join('\n')}
    `;
    driverDiv.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
    await mermaid.run({ nodes: [driverDiv.querySelector('.mermaid')] });

    // 3. Render High-Res Chart Image
    const canvas = document.getElementById('mainChart');
    if(canvas) {
        document.getElementById('p-chart-img').src = canvas.toDataURL('image/png', 1.0);
    }
    
    // 4. Results Text
    const improvement = project.data.length > 1 ? (project.data[project.data.length-1].value - project.data[0].value).toFixed(1) : 0;
    document.getElementById('p-results-text').textContent = `Baseline data (n=...) showed an average of ${project.data[0]?.value || 0}. Following interventions, the measure changed to ${project.data[project.data.length-1]?.value || 0}. Total improvement: ${improvement}.`;

    // 5. PDSAs
    document.getElementById('p-pdsa-list').innerHTML = project.pdsa.map(p => `
        <div class="border-l-4 border-rcem-orange pl-4">
            <h4 class="font-bold text-lg text-rcem-purple">${p.title}</h4>
            <p class="text-sm"><strong>Act:</strong> ${p.act}</p>
        </div>
    `).join('');

    // 6. Conclusion
    document.getElementById('p-conc').textContent = "The project successfully demonstrated improvement. Key learning points included the importance of engaging nursing staff early and the effectiveness of visual reminders (stamps). Future work will focus on sustainability via the new induction protocol.";

    // Show
    document.getElementById('view-poster').classList.remove('hidden');
}

// --- PPTX EXPORT (Advanced) ---
window.exportPPTX = () => {
    let pptx = new PptxGenJS();
    
    // Slide 1: Title
    let slide1 = pptx.addSlide();
    slide1.addText(project.title, { x: 1, y: 2, fontSize: 32, bold: true, color: '2d2e83' });
    slide1.addText(project.lead, { x: 1, y: 3.5, fontSize: 18 });

    // Slide 2: Problem & Aim
    let slide2 = pptx.addSlide();
    slide2.addText("Problem & Aim", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    slide2.addText("Problem:", { x: 0.5, y: 1.5, bold: true });
    slide2.addText(project.problem, { x: 0.5, y: 2, w: '90%' });
    slide2.addText("SMART Aim:", { x: 0.5, y: 4, bold: true });
    slide2.addText(project.aim, { x: 0.5, y: 4.5, w: '90%' });

    // Slide 3: Chart
    let slide3 = pptx.addSlide();
    slide3.addText("Results", { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2d2e83' });
    const canvas = document.getElementById('mainChart');
    if(canvas) slide3.addImage({ data: canvas.toDataURL(), x: 0.5, y: 1.5, w: 9, h: 4.5 });

    pptx.writeFile({ fileName: "RCEM_QIP.pptx" });
};

function renderDashboard() {
    // Helper to render stats on dash
    if(project.data.length > 0) {
        document.getElementById('dash-latest').innerText = project.data[project.data.length-1].value;
    }
    document.getElementById('dash-pdsa').innerText = project.pdsa.length;
}

function renderAll() {
    // Helper to refresh everything
    if(!document.getElementById('view-dashboard').classList.contains('hidden')) renderDashboard();
}

// Initial Run
lucide.createIcons();
