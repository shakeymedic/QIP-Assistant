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

    const LOGO_URL = 'https://wmebemqipassist.netlify.app/logo.png';

    // Helper function for slide headers
    const addHeader = (slideObj, titleText) => {
        slideObj.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.8, fill: RCEM_PURPLE });
        slideObj.addText(titleText, { x: 0.5, y: 0.1, w: 8, h: 0.6, fontSize: 22, bold: true, color: "FFFFFF", valign: 'middle' });
        try { slideObj.addImage({ path: LOGO_URL, x: 8.8, y: 0.05, w: 0.7, h: 0.7 }); } catch(e) {}
    };

    const c = d.checklist || {};

    // =======================================
    // SLIDE 1: TITLE SLIDE
    // =======================================
    let slide = pres.addSlide();
    slide.background = { color: "FFFFFF" };
    
    // Decorative top bar
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.4, fill: RCEM_PURPLE });
    try { slide.addImage({ path: LOGO_URL, x: 4.15, y: 0.9, w: 1.7, h: 1.7 }); } catch(e) {}
    
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
    // Aim Target badge
    if (c.aim_target) {
        slide.addText(`Target: ${c.aim_target}`, {
            x: 5.1, y: 2.4, w: 1.8, h: 0.3,
            fontSize: 11, bold: true, color: "FFFFFF",
            fill: "16A34A", shape: pres.ShapeType.rect, align: 'center'
        });
    }

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
        
        const rows = d.pdsa.map((p, i) => {
            const planText = p.plan ? p.plan.substring(0, 120) + (p.plan.length > 120 ? '...' : '') : 'No plan';
            const predText = p.prediction ? `\nPrediction: ${p.prediction.substring(0, 80)}${p.prediction.length > 80 ? '...' : ''}` : '';
            return [
                `Cycle ${i + 1}:\n${p.title || 'Untitled'}${p.startDate ? '\n' + p.startDate : ''}`,
                planText + predText,
                p.study ? p.study.substring(0, 150) + (p.study.length > 150 ? '...' : '') : 'No study',
                p.act ? p.act.substring(0, 100) + (p.act.length > 100 ? '...' : '') : 'No act'
            ];
        });
        
        rows.unshift(["Cycle / Date", "Plan + Prediction", "Study / Results", "Act / Next Steps"]); 
        
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
    // SLIDE 4B: CHANGE PACKAGE (conditional)
    // =======================================
    const adoptedCycles = (d.pdsa || []).filter(p => p.status === 'complete' || p.status === 'acting');
    if (adoptedCycles.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, "Adopted Changes — Change Package");
        slide.addText("The following interventions have been tested, adopted and embedded into practice:", {
            x: 0.5, y: 1.0, w: 9, fontSize: 11, color: "64748B", italic: true
        });
        let cpY = 1.4;
        adoptedCycles.slice(0, 4).forEach((p, i) => {
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: cpY, w: 9, h: 1.0, fill: "F0FDF4", line: { color: "BBF7D0", pt: 1 } });
            slide.addText(`Cycle ${(d.pdsa || []).indexOf(p) + 1}: ${p.title || 'Untitled'}`, {
                x: 0.7, y: cpY + 0.05, w: 8.6, fontSize: 11, bold: true, color: "15803D"
            });
            slide.addText(p.act ? p.act.substring(0, 180) : 'No act recorded', {
                x: 0.7, y: cpY + 0.35, w: 8.6, fontSize: 10, color: SLATE_DARK
            });
            cpY += 1.1;
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

    // =======================================
    // SLIDE 7: RCEM ABSTRACT
    // =======================================
    const hasAbstract = d.abstract_background || d.abstract_methods || d.abstract_results || d.abstract_conclusions;
    if (hasAbstract) {
        slide = pres.addSlide();
        addHeader(slide, "RCEM Abstract (250 words)");
        const sections = [
            { label: "Background",   text: d.abstract_background   || '', fill: "EFF6FF", border: "BFDBFE", x: 0.5,  y: 1.0 },
            { label: "Methods",      text: d.abstract_methods      || '', fill: "F0FDF4", border: "BBF7D0", x: 5.1,  y: 1.0 },
            { label: "Results",      text: d.abstract_results      || '', fill: "FFFBEB", border: "FDE68A", x: 0.5,  y: 3.0 },
            { label: "Conclusions",  text: d.abstract_conclusions  || '', fill: "EEF2FF", border: "C7D2FE", x: 5.1,  y: 3.0 },
        ];
        sections.forEach(s => {
            slide.addText(s.label, { x: s.x, y: s.y, w: 4.3, fontSize: 12, bold: true, color: RCEM_PURPLE });
            slide.addText(s.text || '(not yet completed)', {
                x: s.x, y: s.y + 0.3, w: 4.3, h: 1.7,
                fontSize: 10, color: SLATE_DARK, valign: 'top',
                fill: s.fill, shape: pres.ShapeType.rect, border: { pt: 1, color: s.border }
            });
        });
    }

    // =======================================
    // SLIDE 8: EVIDENCE BASE & ETHICS
    // =======================================
    const hasEvidenceContent = c.lit_review || (d.referencesList && d.referencesList.length > 0) || c.ethics;
    if (hasEvidenceContent) {
        slide = pres.addSlide();
        addHeader(slide, "Evidence Base & Ethics");

        // References
        const refs = d.referencesList || [];
        if (refs.length > 0) {
            slide.addText("Key References", { x: 0.5, y: 1.0, fontSize: 13, bold: true, color: RCEM_PURPLE });
            refs.slice(0, 5).forEach((r, i) => {
                const refStr = `${i + 1}. ${r.authors || ''} (${r.year || ''}) ${r.title || ''}${r.keyFinding ? ' — ' + r.keyFinding.substring(0, 60) : ''}`;
                slide.addText(refStr, { x: 0.5, y: 1.3 + (i * 0.45), w: 5.8, fontSize: 9, color: SLATE_DARK });
            });
        } else if (c.lit_review) {
            slide.addText("Literature Review", { x: 0.5, y: 1.0, fontSize: 13, bold: true, color: RCEM_PURPLE });
            slide.addText(c.lit_review.substring(0, 400), {
                x: 0.5, y: 1.3, w: 5.8, h: 3.5, fontSize: 10, color: SLATE_DARK, valign: 'top',
                fill: SLATE_LIGHT, shape: pres.ShapeType.rect
            });
        }

        // Ethics / HRA
        slide.addText("Ethics & Governance", { x: 6.6, y: 1.0, fontSize: 13, bold: true, color: RCEM_PURPLE });
        const hra = c.hraChecklist || {};
        const hraAnswered = [hra.q1, hra.q2, hra.q3, hra.q4].filter(v => v && v !== '').length === 4;
        const needsEthics = hra.q2 === 'yes';
        const hraVerdict = hraAnswered
            ? (needsEthics ? 'Likely requires formal ethics approval' : 'Qualifies as Service Evaluation — no formal ethics approval required')
            : 'HRA checklist not yet completed';
        slide.addText(hraVerdict, {
            x: 6.6, y: 1.3, w: 2.9, h: 0.7,
            fontSize: 10, bold: true,
            color: hraAnswered && needsEthics ? 'C41E3A' : '15803D',
            fill: hraAnswered && needsEthics ? 'FEF2F2' : 'F0FDF4',
            shape: pres.ShapeType.rect, border: { pt: 1, color: hraAnswered && needsEthics ? 'FECACA' : 'BBF7D0' },
            valign: 'middle'
        });
        if (c.ethics) {
            slide.addText(c.ethics.substring(0, 200), {
                x: 6.6, y: 2.1, w: 2.9, h: 2.5,
                fontSize: 9, color: SLATE_DARK, valign: 'top',
                fill: SLATE_LIGHT, shape: pres.ShapeType.rect
            });
        }

        // Operational definition
        if (d.checklist?.operational_definition) {
            slide.addText("Operational Definition", { x: 0.5, y: 4.55, fontSize: 11, bold: true, color: RCEM_PURPLE });
            slide.addText(d.checklist.operational_definition.substring(0, 200), {
                x: 0.5, y: 4.85, w: 5.8, h: 0.7, fontSize: 9, color: SLATE_DARK, valign: 'top',
                fill: "F5F3FF", shape: pres.ShapeType.rect, border: { pt: 1, color: "DDD6FE" }
            });
        }
    }

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
