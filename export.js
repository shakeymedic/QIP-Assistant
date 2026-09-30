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
    // SLIDE 3B: SWOT / PEST ANALYSIS (conditional)
    // =======================================
    const swot = c.swot || {};
    const pest = c.pest || {};
    const hasSwot = Object.values(swot).some(v => v && String(v).trim());
    const hasPest = Object.values(pest).some(v => v && String(v).trim());
    if (hasSwot || hasPest) {
        slide = pres.addSlide();
        addHeader(slide, hasSwot ? "SWOT Analysis" : "PEST Analysis");
        const quads = hasSwot
            ? [
                { label: "Strengths", text: swot.strengths, x: 0.5, y: 1.0, fill: "ECFDF5", border: "A7F3D0" },
                { label: "Weaknesses", text: swot.weaknesses, x: 5.1, y: 1.0, fill: "FEF2F2", border: "FECACA" },
                { label: "Opportunities", text: swot.opportunities, x: 0.5, y: 3.0, fill: "EFF6FF", border: "BFDBFE" },
                { label: "Threats", text: swot.threats, x: 5.1, y: 3.0, fill: "FFFBEB", border: "FDE68A" },
              ]
            : [
                { label: "Political", text: pest.political, x: 0.5, y: 1.0, fill: "F5F3FF", border: "DDD6FE" },
                { label: "Economic", text: pest.economic, x: 5.1, y: 1.0, fill: "F0FDFA", border: "99F6E4" },
                { label: "Social", text: pest.social, x: 0.5, y: 3.0, fill: "FDF2F8", border: "FBCFE8" },
                { label: "Technological", text: pest.technological, x: 5.1, y: 3.0, fill: "ECFEFF", border: "A5F3FC" },
              ];
        quads.forEach(q => {
            slide.addText(q.label, { x: q.x, y: q.y, fontSize: 13, bold: true, color: RCEM_PURPLE });
            slide.addText(q.text || '(not completed)', {
                x: q.x, y: q.y + 0.35, w: 4.3, h: 1.5, fontSize: 10, color: SLATE_DARK, valign: 'top',
                fill: q.fill, shape: pres.ShapeType.rect, border: { pt: 1, color: q.border }
            });
        });
    }

    // =======================================
    // SLIDE 3C: RISK ANALYSIS (FMEA, conditional)
    // =======================================
    const fmea = d.fmea || [];
    if (fmea.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, "Risk Analysis — FMEA");
        const fmeaRows = fmea.slice(0, 8).map(row => {
            const rpn = (parseInt(row.likelihood)||1) * (parseInt(row.severity)||1) * (parseInt(row.detectability)||1);
            return [
                row.step || '', row.failureMode || '', String(rpn), (row.mitigation || '').substring(0, 90)
            ];
        });
        fmeaRows.unshift(["Process Step", "Failure Mode", "RPN", "Mitigation"]);
        slide.addTable(fmeaRows, {
            x: 0.5, y: 1.2, w: 9,
            colW: [2, 2.5, 1, 3.5],
            fontSize: 9,
            border: { pt: 1, color: BORDER_COLOR },
            fill: { color: "FFFFFF" },
            headerStyles: { fill: { color: RCEM_PURPLE }, color: "FFFFFF", bold: true },
            rowH: 0.55,
            valign: 'top'
        });
        slide.addText("RPN = Likelihood × Severity × Detectability (1–25 low, 25–50 medium, 50+ high risk)", {
            x: 0.5, y: 1.2 + Math.min(fmeaRows.length, 9) * 0.55 + 0.2, fontSize: 9, italic: true, color: "64748B"
        });
    }

    // =======================================
    // SLIDE 3D: PROJECT TIMELINE (Gantt, conditional)
    // =======================================
    const ganttTasks = d.gantt || [];
    if (ganttTasks.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, "Project Timeline");
        const sortedTasks = [...ganttTasks].sort((a, b) => new Date(a.start||0) - new Date(b.start||0));
        const timelineRows = sortedTasks.slice(0, 12).map(t => [
            t.name || 'Untitled',
            t.start ? new Date(t.start).toLocaleDateString('en-GB') : '',
            t.end ? new Date(t.end).toLocaleDateString('en-GB') : '',
            t.milestone ? 'Milestone' : (t.type || '')
        ]);
        timelineRows.unshift(["Task", "Start", "End", "Type"]);
        slide.addTable(timelineRows, {
            x: 0.5, y: 1.2, w: 9,
            colW: [4, 1.8, 1.8, 1.4],
            fontSize: 9,
            border: { pt: 1, color: BORDER_COLOR },
            fill: { color: "FFFFFF" },
            headerStyles: { fill: { color: RCEM_PURPLE }, color: "FFFFFF", bold: true },
            rowH: 0.4,
            valign: 'top'
        });
        if (ganttTasks.length > 12) {
            slide.addText(`+ ${ganttTasks.length - 12} more tasks not shown — see the full Timeline in-app for the complete Gantt view.`, {
                x: 0.5, y: 1.2 + 13 * 0.4 + 0.1, fontSize: 9, italic: true, color: "64748B"
            });
        }
    }

    // =======================================
    // SLIDE 4: PDSA CYCLES SUMMARY
    // =======================================
    if (d.pdsa && d.pdsa.length > 0) {
        slide = pres.addSlide();
        addHeader(slide, `3. Testing Changes: PDSA Cycles (${d.pdsa.length})`);
        
        // Truncation limits raised well beyond the old 100-150 chars so a
        // thorough write-up isn't cut mid-sentence without the trainee
        // knowing — a footnote below also points to the untruncated version.
        const rows = d.pdsa.map((p, i) => {
            const planText = p.plan ? p.plan.substring(0, 260) + (p.plan.length > 260 ? '\u2026' : '') : 'No plan';
            const predText = p.prediction ? `\nPrediction: ${p.prediction.substring(0, 160)}${p.prediction.length > 160 ? '\u2026' : ''}` : '';
            return [
                `Cycle ${i + 1}:\n${p.title || 'Untitled'}${p.startDate ? '\n' + p.startDate : ''}`,
                planText + predText,
                p.study ? p.study.substring(0, 320) + (p.study.length > 320 ? '\u2026' : '') : 'No study',
                p.act ? p.act.substring(0, 220) + (p.act.length > 220 ? '\u2026' : '') : 'No act'
            ];
        });
        
        rows.unshift(["Cycle / Date", "Plan + Prediction", "Study / Results", "Act / Next Steps"]); 
        
        slide.addTable(rows, {
            x: 0.5, y: 1.2, w: 9,
            colW: [1.5, 3, 3, 1.5],
            fontSize: 8,
            border: { pt: 1, color: BORDER_COLOR },
            fill: { color: "FFFFFF" },
            headerStyles: { fill: { color: RCEM_PURPLE }, color: "FFFFFF", bold: true },
            rowH: 0.8,
            valign: 'top',
            autoPage: true
        });
        slide.addText("Summarised for slide space — see the Full Report PDF (Export Center) for each cycle written out in full.", {
            x: 0.5, y: 6.9, w: 9, fontSize: 8, italic: true, color: "94A3B8"
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
    const resultsSlide = slide; // keep a handle — the loop below reassigns `slide` per extra measure
    
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

        const d = state.projectData;
        const measures = Array.isArray(d?.measures) ? d.measures : [];
        const multiMeasure = measures.length > 1 && typeof window.getPrimaryMeasure === 'function';
        const savedChartData = d.chartData, savedChartSettings = d.chartSettings, savedActiveMeasureId = d.activeMeasureId;

        // Capture every tracked measure (not just the primary one) so a
        // multi-measure project's secondary/balancing measures actually show
        // up in the deck — previously only measures[0] was ever charted.
        // Bounded to 4 measures so the deck can't grow unboundedly.
        const toCapture = multiMeasure ? measures.slice(0, 4) : [window.getPrimaryMeasure ? window.getPrimaryMeasure(d) : { chartData: d.chartData, chartSettings: d.chartSettings }];

        for (let mi = 0; mi < toCapture.length; mi++) {
            const m = toCapture[mi];
            if (mi > 0) {
                slide = pres.addSlide();
                addHeader(slide, `Additional Measure: ${m.name || 'Measure ' + (mi + 1)}`);
            }
            if (!Array.isArray(m.chartData) || m.chartData.length === 0) {
                slide.addText('No data collected yet for this measure.', { x: 0.5, y: 2.5, w: 5.5, fontSize: 12, italic: true, color: '94A3B8' });
                continue;
            }
            d.chartData = m.chartData; d.chartSettings = m.chartSettings;
            if (m.id) d.activeMeasureId = m.id;
            window.__qipExporting = true; // draw without animation so the capture is complete
            if (window.renderChart) window.renderChart('mainChart');
            window.__qipExporting = false;
            try {
                await new Promise(r => setTimeout(r, 150)); // let the canvas finish laying out
                const liveCanvas = document.getElementById('mainChart'); // renderChart replaces the node, so re-fetch it
                const dataUrl = liveCanvas.toDataURL('image/png', 1.0);
                slide.addImage({ data: dataUrl, x: 0.5, y: 1.2, w: 5.5, h: 4.0 });
            } catch (e) {
                console.error(e);
                slide.addText("[Chart image capture failed]", { x: 0.5, y: 2, color: "red" });
            }
        }
        if (multiMeasure && measures.length > 4) {
            slide.addText(`+ ${measures.length - 4} more tracked measure(s) not shown here — see the Data page in-app.`, {
                x: 0.5, y: 5.3, w: 5.5, fontSize: 9, italic: true, color: "94A3B8"
            });
        }

        // Restore whichever measure the trainee actually had open on screen.
        d.chartData = savedChartData; d.chartSettings = savedChartSettings; d.activeMeasureId = savedActiveMeasureId;
        if (window.renderChart) window.renderChart('mainChart');

        if (wasHidden) {
            dataView.classList.add('hidden');
            dataView.style.position = '';
            dataView.style.left = '';
        }
    }

    // Results Analysis Text — goes on the original results slide, not
    // whichever "Additional Measure" slide the loop above last created.
    slide = resultsSlide;
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

// The report PDF is a picture of the Whole Project View, so it is laid out
// at the printed width first (A4 portrait, 10 mm side margins) and page
// breaks are then placed between blocks — or between the lines of a long
// paragraph — so nothing is sliced through or pushed onto a near-blank page.
const PDF_MARGIN_MM = [18, 16, 18, 16];           // top, left, bottom, right
const PDF_INNER_W_MM = 210 - PDF_MARGIN_MM[1] - PDF_MARGIN_MM[3];
const PDF_INNER_H_MM = 297 - PDF_MARGIN_MM[0] - PDF_MARGIN_MM[2];
const PDF_SCALE = 2;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Charts are redrawn at the printed width (and at a higher pixel density so
// they stay sharp), captured as images, then put back as they were.
function captureCharts(source) {
    const images = [];
    source.querySelectorAll('canvas').forEach(cv => {
        const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(cv) : null;
        let url = '';
        try {
            if (chart) {
                chart.stop();
                chart.options.devicePixelRatio = 3;
                chart.resize();
                chart.update('none');
            }
            url = cv.toDataURL('image/png');
        } catch (e) { console.warn('[pdf] chart capture failed', e); }
        images.push(url);
    });
    return images;
}

function restoreCharts(source) {
    source.querySelectorAll('canvas').forEach(cv => {
        const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(cv) : null;
        if (!chart) return;
        try { delete chart.options.devicePixelRatio; chart.resize(); chart.update('none'); } catch (e) { /* leave as is */ }
    });
}

function buildPdfClone(source, chartImages) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-12000px;top:0;';
    const root = document.createElement('div');
    root.className = 'pdf-export';
    root.style.width = PDF_INNER_W_MM + 'mm';
    root.style.background = '#ffffff';
    const clone = source.cloneNode(true);
    clone.querySelectorAll('canvas').forEach((cv, i) => {
        const img = document.createElement('img');
        img.src = chartImages[i] || '';
        img.alt = '';
        img.style.cssText = 'display:block;width:100%;height:auto;';
        if (cv.parentElement) cv.parentElement.style.height = 'auto';
        cv.replaceWith(img);
    });
    // Collapsed "show more" panels print open, without their toggle.
    clone.querySelectorAll('details').forEach(det => {
        const div = document.createElement('div');
        [...det.childNodes].forEach(n => { if (n.nodeName !== 'SUMMARY') div.appendChild(n); });
        det.replaceWith(div);
    });
    clone.querySelectorAll('button, .no-print').forEach(el => el.remove());
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    clone.removeAttribute('id');
    root.appendChild(clone);
    holder.appendChild(root);
    document.body.appendChild(holder);
    return { holder, root };
}

const PDF_OPTIONS = {
    margin: PDF_MARGIN_MM,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: PDF_SCALE, useCORS: true, logging: false, allowTaint: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['legacy'] }
};

// The page height, in CSS pixels, that html2pdf will slice the report at:
// floor(canvas width × page ratio) canvas pixels. The canvas width is
// rounded by html2canvas, so it is measured with a tiny probe of the same
// width rather than worked out.
async function pdfPageHeightPx(root) {
    try {
        const probe = document.createElement('div');
        probe.style.cssText = `width:${PDF_INNER_W_MM}mm;height:4px;background:#fff`;
        const worker = html2pdf().set(PDF_OPTIONS).from(probe);
        await worker.toCanvas();
        const canvas = worker.prop.canvas, ratio = worker.prop.pageSize.inner.ratio;
        if (canvas && canvas.width && ratio) return Math.floor(canvas.width * ratio) / PDF_SCALE;
    } catch (e) { console.warn('[pdf] page probe failed', e); }
    const w = Math.ceil(root.getBoundingClientRect().width);
    return Math.floor(w * PDF_SCALE * (PDF_INNER_H_MM / PDF_INNER_W_MM)) / PDF_SCALE;
}

function paginateForPdf(root, pageH) {
    const PAD = 6;                        // breathing room at the top of a new page
    const originTop = () => root.getBoundingClientRect().top;
    const box = (el) => { const r = el.getBoundingClientRect(); const t = originTop(); return { top: r.top - t, bottom: r.bottom - t, h: r.height }; };
    const pageEndFor = (y) => (Math.floor((y + 0.5) / pageH) + 1) * pageH;
    const isHeading = (el) => /^H[1-6]$/.test(el.tagName);
    const atomicTags = new Set(['IMG', 'svg', 'SVG', 'TR', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD']);

    const makeSpacer = (el, h) => {
        if (el.tagName === 'TR') {
            const tr = document.createElement('tr');
            tr.className = 'pdf-spacer';
            tr.innerHTML = `<td colspan="99" style="height:${h}px;padding:0;border:0;background:#fff"></td>`;
            return tr;
        }
        const d = document.createElement('div');
        d.className = 'pdf-spacer';
        d.style.cssText = `height:${h}px;margin:0;padding:0;`;
        const parent = el.parentElement;
        const ps = parent ? getComputedStyle(parent) : null;
        if (ps && ps.display.includes('grid')) d.style.gridColumn = '1 / -1';
        else if (ps && ps.display.includes('flex') && ps.flexWrap === 'wrap') d.style.cssText += 'flex:0 0 100%;width:100%;';
        return d;
    };
    const setSpacerHeight = (sp, h) => {
        const target = sp.tagName === 'TR' ? sp.firstElementChild : sp;
        target.style.height = Math.max(0, h) + 'px';
    };
    // Push `el` to the top of the next page, correcting for margins/gaps.
    // A short title block (a heading, a small header bar holding one, or a
    // one-line bold label) directly above the element moves with it.
    const isTitle = (el, b) => isHeading(el) || !!el.querySelector('h1,h2,h3,h4,h5,h6') || (b.h <= 40 && /\bfont-(bold|semibold)\b/.test(el.className || ''));
    const titleAbove = (el, pageEnd) => {
        const prev = el.previousElementSibling;
        if (!prev || prev.classList.contains('pdf-spacer')) return null;
        const b = box(prev);
        if (b.h > 90 || pageEndFor(b.top) !== pageEnd) return null;
        return isTitle(prev, b) ? prev : null;
    };
    const withTitles = (el, pageEnd) => {
        for (let k = 0; k < 8; k++) {
            const t = titleAbove(el, pageEnd);
            if (t) { el = t; continue; }
            const parent = el.parentElement;
            // First row of a table body: keep the table's header row with it.
            if (el.tagName === 'TR' && !el.previousElementSibling && parent && parent.tagName === 'TBODY') {
                const table = el.closest('table');
                if (table && pageEndFor(box(table).top) === pageEnd) { el = table; continue; }
            }
            // First thing in its box: the box (and any title above it) moves instead.
            if (!el.previousElementSibling && parent && parent !== root && !/^(TABLE|THEAD|TBODY|TFOOT|TR)$/.test(parent.tagName) && pageEndFor(box(parent).top) === pageEnd) { el = parent; continue; }
            break;
        }
        return el;
    };
    const pushToNextPage = (el, pageEnd) => {
        el = withTitles(el, pageEnd);
        const want = pageEnd + PAD;
        const sp = makeSpacer(el, Math.max(0, want - box(el).top));
        el.parentNode.insertBefore(sp, el);
        for (let k = 0; k < 2; k++) {
            const diff = want - box(el).top;
            if (Math.abs(diff) < 0.5) break;
            const cur = parseFloat((sp.tagName === 'TR' ? sp.firstElementChild : sp).style.height) || 0;
            setSpacerHeight(sp, cur + diff);
        }
    };

    const isInlineOnly = (el) => [...el.children].every(ch => ch.tagName === 'BR' || /^inline/.test(getComputedStyle(ch).display));

    // Line boxes of the text itself (not of inline elements, which can span lines).
    const lineRects = (el) => {
        const t0 = originTop();
        const out = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (!node.length || !node.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            [...range.getClientRects()].forEach(r => { if (r.height > 1 && r.height < 60) out.push({ top: r.top - t0, bottom: r.bottom - t0 }); });
        }
        return out.sort((x, y) => x.top - y.top);
    };
    const charTop = (node, i) => {
        for (let j = i; j < Math.min(node.length, i + 40); j++) {
            const r = document.createRange();
            r.setStart(node, j); r.setEnd(node, j + 1);
            const rect = r.getBoundingClientRect();
            if (rect.height > 0) return rect.top - originTop();
        }
        return null;
    };
    // Insert a line break spacer before the first character on the line
    // starting at `lineTop`, sized so that line opens the next page.
    const splitAtLine = (el, lineTop, pageEnd) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (!node.length) continue;
            const last = charTop(node, Math.max(0, node.length - 1)) ?? charTop(node, 0);
            if (last === null || last < lineTop - 1) continue;
            let lo = 0, hi = node.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                const tm = charTop(node, mid);
                if (tm === null || tm >= lineTop - 1) hi = mid; else lo = mid + 1;
            }
            const rest = lo > 0 ? node.splitText(lo) : node;
            const sp = document.createElement('span');
            sp.className = 'pdf-spacer';
            sp.style.cssText = 'display:block;height:0;';
            rest.parentNode.insertBefore(sp, rest);
            const want = pageEnd + PAD;
            for (let k = 0; k < 3; k++) {
                const now = charTop(rest, 0);
                if (now === null) break;
                const diff = want - now;
                if (Math.abs(diff) < 0.5) break;
                sp.style.height = Math.max(0, (parseFloat(sp.style.height) || 0) + diff) + 'px';
            }
            return true;
        }
        return false;
    };
    // Long text: break between lines at every page boundary it crosses.
    const splitLongText = (el) => {
        let lastTop = -Infinity;
        for (let k = 0; k < 60; k++) {
            const cross = lineRects(el).find(l => l.top > lastTop + 1 && l.bottom > pageEndFor(l.top) + 0.5);
            if (!cross) return;
            const pe = pageEndFor(cross.top);
            if (!splitAtLine(el, cross.top, pe)) return;
            lastTop = pe;          // that line now opens the next page
        }
    };

    const visible = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 || r.width > 0; };

    const visit = (el, depth = 0) => {
        if (depth > 40 || el.classList?.contains('pdf-spacer')) return;
        let r = box(el);
        if (r.h <= 0) return;
        const pageEnd = pageEndFor(r.top);
        // A heading never sits alone at the foot of a page.
        if (isHeading(el) && r.bottom <= pageEnd && pageEnd - r.bottom < 70) { pushToNextPage(el, pageEnd); return; }
        if (r.bottom <= pageEnd + 0.5) return;
        const display = getComputedStyle(el).display;
        const isGrid = display.includes('grid');
        const isFlexRow = display.includes('flex') && !getComputedStyle(el).flexDirection.startsWith('column');
        const small = r.h <= pageH * 0.3;
        if (atomicTags.has(el.tagName) ? r.h <= pageH : small) { pushToNextPage(el, pageEnd); return; }
        const isWrapRow = isFlexRow && getComputedStyle(el).flexWrap === 'wrap';
        if (((isFlexRow && !isWrapRow) || (isGrid && el.children.length <= 1)) && r.h <= pageH) { pushToNextPage(el, pageEnd); return; }
        if (isGrid || isWrapRow) {
            // Break between grid rows with a full-width spacer.
            const items = [...el.children].filter(ch => !ch.classList.contains('pdf-spacer') && visible(ch));
            for (let i = 0; i < items.length; i++) {
                const rowTop = box(items[i]).top;
                const row = items.filter(it => Math.abs(box(it).top - rowTop) < 2);
                if (row[0] !== items[i]) continue;
                const rowBottom = Math.max(...row.map(it => box(it).bottom));
                const end = pageEndFor(rowTop);
                if (rowBottom > end + 0.5) {
                    const rowH = rowBottom - rowTop;
                    if (rowH <= pageH * 0.3 || (row.length > 1 && rowH <= pageH)) pushToNextPage(items[i], end);
                    else row.forEach(it => visit(it, depth + 1));
                }
            }
            return;
        }
        if (!el.children.length || isInlineOnly(el)) { splitLongText(el); return; }
        [...el.children].forEach(ch => visit(ch, depth + 1));
    };

    [...root.children].forEach(ch => visit(ch));
}

// Running header (from page 2) and "Page n of N" footer, drawn in the margins.
// jsPDF's built-in font only covers Latin-1, so other characters are simplified.
function addPageFurniture(pdf, title) {
    const plain = (t) => String(t || '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\xff]/g, '');
    const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + '...' : t);
    const pages = pdf.internal.getNumberOfPages();
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const [top, left, bottom, right] = PDF_MARGIN_MM;
    const head = short(plain(title), 95);
    for (let i = 1; i <= pages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        if (i > 1) {
            pdf.text(head, left, top - 8);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.2);
            pdf.line(left, top - 6, w - right, top - 6);
        }
        pdf.text('QIP report - generated by the RCEM QIP Assistant', left, h - bottom + 10);
        pdf.text(`Page ${i} of ${pages}`, w - right, h - bottom + 10, { align: 'right' });
    }
}

export function printPosterOnly() {
    const { state } = window._qipModules || {};
    if (!state?.projectData) { showToast("No project loaded.", "error"); return; }

    const fullView = document.getElementById('view-full');
    if (!fullView) { showToast("Error locating report.", "error"); return; }

    const wasHidden = fullView.classList.contains('hidden');
    let prevView = null;
    if (wasHidden) {
        const active = document.querySelector('.view-section:not(.hidden)');
        if (active) prevView = active.id.replace('view-', '');
        if (window.router) window.router('full');
    }
    const goBack = () => { if (prevView && window.router) window.router(prevView); };

    setTimeout(async () => {
        const exportTarget = document.getElementById('full-project-container');
        if (!exportTarget) { showToast("Could not locate report content.", "error"); return; }
        if (typeof html2pdf === 'undefined') { showToast("PDF library not loaded — try refreshing.", "error"); return; }

        const title = state?.projectData?.meta?.title || 'QIP Report';
        const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_qip_report.pdf';
        showToast("Generating PDF — this may take a few seconds…", "info");

        let holder = null;
        const prevWidth = exportTarget.style.width;
        try {
            exportTarget.style.width = PDF_INNER_W_MM + 'mm';
            await wait(50);
            const chartImages = captureCharts(exportTarget);
            exportTarget.style.width = prevWidth;
            restoreCharts(exportTarget);

            const built = buildPdfClone(exportTarget, chartImages);
            holder = built.holder;
            await Promise.all([...built.root.querySelectorAll('img')].map(img => img.decode ? img.decode().catch(() => {}) : null));
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
            // html2canvas draws an inline SVG at its width/height attributes,
            // so give each one its laid-out size (a "100%" width otherwise
            // renders zoomed in and cropped).
            built.root.querySelectorAll('svg').forEach(svg => {
                const r = svg.getBoundingClientRect();
                if (r.width && r.height) { svg.setAttribute('width', r.width); svg.setAttribute('height', r.height); }
            });
            const pageH = await pdfPageHeightPx(built.root);
            paginateForPdf(built.root, pageH);

            await html2pdf().set({ ...PDF_OPTIONS, filename }).from(built.root).toPdf().get('pdf')
                .then(pdf => addPageFurniture(pdf, title)).save();
            showToast(`PDF saved: ${filename}`, "success");
        } catch (err) {
            console.error("PDF error:", err);
            showToast("PDF generation failed. Try using browser print (Ctrl+P) instead.", "error");
        } finally {
            exportTarget.style.width = prevWidth;
            if (holder) holder.remove();
            goBack();
        }
    }, wasHidden ? 900 : 200);
}
