import { state } from "./state.js";
import { showToast, formatDate } from "./utils.js";

// ==========================================================================
// POWERPOINT EXPORT (PptxGenJS)
// ==========================================================================

export async function exportPPTX() {
    // 1. Verify Library Availability
    if (typeof PptxGenJS === 'undefined') {
        showToast("Export library loading... check internet or try again.", "error");
        return;
    }

    // 2. Verify Data
    const d = state.projectData;
    if (!d) {
        showToast("No project data to export.", "error");
        return;
    }

    showToast("Generating PowerPoint...", "info");

    // 3. Initialize Presentation
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';
    pres.title = d.meta.title;
    pres.subject = "RCEM Quality Improvement Project";
    
    // --- BRANDING COLORS ---
    const RCEM_PURPLE = "2d2e83";
    const RCEM_LIGHT = "4a4bc4";
    const SLATE_DARK = "0f172a";
    const SLATE_LIGHT = "F8FAFC";
    const BORDER_COLOR = "E2E8F0";

    // Helper function for slide headers
    const addHeader = (slideObj, titleText) => {
        slideObj.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: RCEM_PURPLE });
        slideObj.addText(titleText, { x: 0.5, y: 0.1, w: 9, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF", valign: 'middle' });
    };

    const c = d.checklist || {};

    // =======================================
    // SLIDE 1: TITLE SLIDE
    // =======================================
    let slide = pres.addSlide();
    slide.background = { color: "FFFFFF" };
    
    // Decorative top bar
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.4, fill: RCEM_PURPLE });
    
    // Title
    slide.addText(d.meta?.title || "Quality Improvement Project", { 
        x: 1, y: 2.5, w: 8, 
        fontSize: 36, bold: true, color: RCEM_PURPLE, align: 'left',
        breakLine: true
    });
    
    // Subtitle / Date
    slide.addText(`RCEM QIP Portfolio Submission | ${new Date().toLocaleDateString('en-GB')}`, { 
        x: 1, y: 4, w: 8, 
        fontSize: 16, color: "64748B", align: 'left'
    });
    
    // Authors / Team
    if(d.teamMembers && d.teamMembers.length > 0) {
        const teamStr = d.teamMembers.map(m => `${m.name} (${m.role})`).join(' | ');
        slide.addText(`Project Team: ${teamStr}`, {
            x: 1, y: 4.8, w: 8, fontSize: 14, color: RCEM_LIGHT, italic: true
        });
    }

    // =======================================
    // SLIDE 2: BACKGROUND, AIM & MEASURES
    // =======================================
    slide = pres.addSlide();
    addHeader(slide, "1. Background, Aim & Measures");
    
    // Background / Problem Statement
    slide.addText("Problem Statement", { x: 0.5, y: 1.0, fontSize: 13, bold: true, color: RCEM_PURPLE });
    slide.addText(c.problem_desc || "No problem statement defined.", { 
        x: 0.5, y: 1.3, w: 4.2, h: 1.2, 
        fontSize: 11, color: SLATE_DARK, valign: 'top', fill: SLATE_LIGHT, shape: pres.ShapeType.rect
    });

    // Department Context
    if (c.problem_context) {
        slide.addText("Department Context & Setting", { x: 0.5, y: 2.65, fontSize: 12, bold: true, color: RCEM_PURPLE });
        slide.addText(c.problem_context, { 
            x: 0.5, y: 2.95, w: 4.2, h: 1.0, 
            fontSize: 10, color: SLATE_DARK, valign: 'top', fill: "F0FDF4", shape: pres.ShapeType.rect, border: { pt: 1, color: "BBF7D0" }
        });
    }

    // Baseline Evidence
    if (c.problem_evidence) {
        slide.addText("Baseline Evidence", { x: 0.5, y: 4.1, fontSize: 12, bold: true, color: RCEM_PURPLE });
        slide.addText(c.problem_evidence, { 
            x: 0.5, y: 4.4, w: 4.2, h: 0.9, 
            fontSize: 10, color: SLATE_DARK, valign: 'top', fill: "FFFBEB", shape: pres.ShapeType.rect, border: { pt: 1, color: "FDE68A" }
        });
    }
    
    // SMART Aim
    slide.addText("SMART Aim", { x: 5.1, y: 1.0, fontSize: 13, bold: true, color: RCEM_PURPLE });
    slide.addText(c.aim || "No aim defined.", { 
        x: 5.1, y: 1.3, w: 4.4, h: 1.0, 
        fontSize: 12, bold: true, color: RCEM_PURPLE, valign: 'middle', fill: "EEF2FF", shape: pres.ShapeType.rect, border: { pt: 1, color: "C7D2FE" }
    });

    // Secondary Aim (if present)
    if (c.aim2) {
        slide.addText("Secondary SMART Aim", { x: 5.1, y: 2.45, fontSize: 11, bold: true, color: "6366F1" });
        slide.addText(c.aim2, { 
            x: 5.1, y: 2.75, w: 4.4, h: 0.7, 
            fontSize: 10, color: RCEM_PURPLE, valign: 'middle', fill: "EEF2FF", shape: pres.ShapeType.rect, border: { pt: 1, color: "C7D2FE" }
        });
    }

    // Measures
    slide.addText("Family of Measures", { x: 5.1, y: 3.6, fontSize: 13, bold: true, color: RCEM_PURPLE });
    slide.addText(`Outcome: ${c.outcome_measure || 'TBC'}\nProcess: ${c.process_measure || 'TBC'}\nBalancing: ${c.balance_measure || 'TBC'}`, { 
        x: 5.1, y: 3.95, w: 4.4, h: 1.3, 
        fontSize: 11, color: SLATE_DARK, valign: 'top', fill: SLATE_LIGHT, shape: pres.ShapeType.rect, bullet: true
    });

    // =======================================
    // SLIDE 3: DIAGNOSIS (Driver Diagram)
    // =======================================
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    if (drivers.primary.length > 0 || drivers.changes.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, "2. Diagnosis: Driver Diagram");
        
        // Primary
        slide.addText("Primary Drivers", { x: 0.5, y: 1.0, fontSize: 14, bold: true });
        let yPos = 1.4;
        drivers.primary.slice(0, 5).forEach(p => {
            slide.addText(p, { 
                x: 0.5, y: yPos, w: 2.8, h: 0.8, 
                fontSize: 11, fill: "EFF6FF", border: { pt: 1, color: "BFDBFE" }, align: 'center' 
            });
            yPos += 0.9;
        });

        // Secondary
        slide.addText("Secondary Drivers", { x: 3.6, y: 1.0, fontSize: 14, bold: true });
        yPos = 1.4;
        drivers.secondary.slice(0, 5).forEach(s => {
            slide.addText(s, { 
                x: 3.6, y: yPos, w: 2.8, h: 0.8, 
                fontSize: 11, fill: "F0F9FF", border: { pt: 1, color: "BAE6FD" }, align: 'center' 
            });
            yPos += 0.9;
        });
        
        // Changes
        slide.addText("Change Ideas", { x: 6.7, y: 1.0, fontSize: 14, bold: true });
        yPos = 1.4;
        drivers.changes.slice(0, 5).forEach(ch => {
            slide.addText(ch, { 
                x: 6.7, y: yPos, w: 2.8, h: 0.8, 
                fontSize: 11, fill: "ECFDF5", border: { pt: 1, color: "A7F3D0" }, align: 'center' 
            });
            yPos += 0.9;
        });
    }

    // =======================================
    // SLIDE 4: PDSA CYCLES SUMMARY
    // =======================================
    if (d.pdsa && d.pdsa.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, `3. Testing Changes: PDSA Cycles (${d.pdsa.length})`);
        
        const rows = d.pdsa.map((p, i) => [
            `Cycle ${i + 1}:\n${p.title || 'Untitled'}`,
            p.plan ? p.plan.substring(0, 150) + (p.plan.length > 150 ? '...' : '') : 'No plan',
            p.study ? p.study.substring(0, 150) + (p.study.length > 150 ? '...' : '') : 'No study',
            p.act ? p.act.substring(0, 100) + (p.act.length > 100 ? '...' : '') : 'No act'
        ]);
        
        rows.unshift(["Cycle / Intervention", "Plan / Prediction", "Study / Results", "Act / Next Steps"]); 
        
        slide.addTable(rows, {
            x: 0.5, y: 1.2, w: 9,
            colW: [1.5, 3, 3, 1.5],
            fontSize: 9,
            border: { pt: 1, color: BORDER_COLOR },
            fill: { color: "FFFFFF" },
            headerStyles: { fill: { color: RCEM_PURPLE }, color: "FFFFFF", bold: true },
            rowH: 0.8,
            valign: 'top'
        });
    }

    // =======================================
    // SLIDE 5: RESULTS (Chart & Analysis)
    // =======================================
    slide = pres.addSlide();
    addHeader(slide, "4. Results & Data Analysis");
    
    const canvas = document.getElementById('mainChart');
    const dataView = document.getElementById('view-data');
    let wasHidden = false;

    // Temporarily show the chart to grab the image if it's hidden
    if (canvas && dataView) {
        if (dataView.classList.contains('hidden')) {
            wasHidden = true;
            dataView.style.position = 'absolute';
            dataView.style.left = '-9999px';
            dataView.classList.remove('hidden');
        }

        try {
            await new Promise(r => setTimeout(r, 100)); // Small wait for chart render
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            slide.addImage({ data: dataUrl, x: 0.5, y: 1.2, w: 5.5, h: 4.0 });
        } catch (e) {
            console.error(e);
            slide.addText("[Chart image capture failed]", { x: 0.5, y: 2, color: "red" });
        } finally {
            if (wasHidden) {
                dataView.classList.add('hidden');
                dataView.style.position = '';
                dataView.style.left = '';
            }
        }
    }

    // Results Analysis Text
    slide.addText("Data Interpretation", { x: 6.2, y: 1.2, fontSize: 14, bold: true, color: RCEM_PURPLE });
    slide.addText(c.results_analysis || c.results_text || "No analysis provided.", {
        x: 6.2, y: 1.6, w: 3.3, h: 3.6,
        fontSize: 11, color: SLATE_DARK,
        shape: pres.ShapeType.rect, fill: SLATE_LIGHT, valign: 'top'
    });

    // =======================================
    // SLIDE 5B: SURVEYS & FEEDBACK
    // =======================================
    if (d.surveys && d.surveys.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, "Surveys & Feedback");
        
        let yPos = 1.2;
        d.surveys.slice(0, 3).forEach(s => {
            slide.addText(s.title || "Untitled Survey", { x: 0.5, y: yPos, fontSize: 14, bold: true, color: RCEM_PURPLE });
            slide.addText(`${s.responses ? s.responses.length : 0} responses`, { x: 0.5, y: yPos + 0.3, fontSize: 10, color: "64748B" });
            slide.addText(s.summary || "No summary provided.", {
                x: 0.5, y: yPos + 0.6, w: 9, h: 1.0,
                fontSize: 11, color: SLATE_DARK, fill: SLATE_LIGHT, shape: pres.ShapeType.rect, valign: 'top'
            });
            yPos += 2.0;
        });
    }

    // =======================================
    // SLIDE 6: SUSTAINABILITY & LEARNING
    // =======================================
    slide = pres.addSlide();
    addHeader(slide, "5. Sustainability & Reflections");
    
    // Sustainability
    slide.addText("Sustainability Plan", { x: 0.5, y: 1.0, fontSize: 14, bold: true, color: RCEM_PURPLE });
    slide.addText(c.sustainability || "No sustainability plan documented.", { 
        x: 0.5, y: 1.4, w: 4.2, h: 3.8, 
        fontSize: 11, color: SLATE_DARK, valign: 'top', fill: SLATE_LIGHT, shape: pres.ShapeType.rect
    });
    
    // Reflections & Learning
    slide.addText("Key Learning Points", { x: 5.1, y: 1.0, fontSize: 14, bold: true, color: RCEM_PURPLE });
    slide.addText(c.learning_points || "No reflections documented.", { 
        x: 5.1, y: 1.4, w: 4.4, h: 3.8, 
        fontSize: 11, color: SLATE_DARK, valign: 'top', fill: "EEF2FF", shape: pres.ShapeType.rect
    });

    // 4. Save File
    const safeTitle = d.meta.title ? d.meta.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30) : 'QIP';
    pres.writeFile({ fileName: `RCEM_QIP_${safeTitle}.pptx` });
    showToast("PowerPoint generated successfully", "success");
}

// ==========================================================================
// PRINT POSTER (Browser Print Helper)
// ==========================================================================

export function printPoster() {
    printPosterOnly();
}

export function printPosterOnly() {
    const fullView = document.getElementById('view-full');
    if (!fullView) { 
        showToast("Error locating report structure.", "error"); 
        return; 
    }
    
    // Check if we are currently on the full view, if not, temporarily route there
    const currentViewHidden = fullView.classList.contains('hidden');
    let previousViewId = null;
    
    if (currentViewHidden) {
        const activeEl = document.querySelector('.view-section:not(.hidden)');
        if (activeEl) previousViewId = activeEl.id.replace('view-', '');
        
        if (window.router) {
            window.router('full');
            // Ensure full view charts render before printing
            setTimeout(() => executePrint(), 500);
            return;
        }
    }
    
    executePrint();

    function executePrint() {
        document.body.classList.add('printing-poster-mode');
        window.print();
        
        // Cleanup after print dialog closes
        setTimeout(() => {
            document.body.classList.remove('printing-poster-mode');
            if (previousViewId && window.router) {
                window.router(previousViewId);
            }
        }, 1000);
    }
}
