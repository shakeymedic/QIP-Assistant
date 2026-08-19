// kaizen-export.js
//
// Generates copy-paste-ready text matching the ACTUAL current RCEM EM-QIAT
// (2025 Update, v7) form on kaizenep.com/risr-advance — NOT a generic "QIAT"
// layout. Field labels and numbering below (1.1, 2.1, 3.0-3.5, 4.1-4.4) are
// taken directly from that live form so this export can be pasted straight
// into the matching boxes.

import { state } from "./state.js";

function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function nl2br(value) {
    return esc(value).replace(/\n/g, '<br>');
}

function stageLabel(trainingStage) {
    if (trainingStage === 'higher') return 'ST6/ST7 (Higher Specialty Training) — confirm exact ST year';
    if (trainingStage === 'intermediate') return 'ST4/ST5 (Intermediate Training) — confirm exact ST year';
    return trainingStage || '[Add your stage of training, e.g. ST6]';
}

export function exportToKaizen() {
    const data = state.projectData || window.projectData || {};
    const checklist = data.checklist || {};
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];
    const charter = data.charter || {};
    const team = (Array.isArray(charter.team) && charter.team.length) ? charter.team : (data.teamMembers || []);
    const meta = data.meta || {};
    const changeIdeas = Array.isArray(data.changeIdeas) ? data.changeIdeas : (data.drivers?.changes || []);

    const projectAim = charter.aim || checklist.aim || '';
    const hasProject = !!(checklist.problem_desc || pdsa.length || changeIdeas.length);

    const teamString = team.map(m => `${m.name || ''}${m.role ? ' (' + m.role + ')' : ''}`).filter(Boolean).join(', ');

    // 3.1 Project Overview — built using the RCEM-suggested headings (Background, Aim,
    // Understanding the Problem, Measures, Interventions, Results, Next Steps).
    const measuresLines = [checklist.outcome_measure, checklist.process_measure, checklist.balance_measure]
        .filter(Boolean).join('<br><br>');
    const interventionsSummary = changeIdeas.length
        ? changeIdeas.map((c, i) => `${i + 1}. ${typeof c === 'string' ? c : (c.title || c.description || '')}`).filter(l => l.length > 3).join('<br>')
        : (pdsa.length ? pdsa.map((p, i) => `Cycle ${i + 1}: ${p.title || ''}`).join('<br>') : '');
    const resultsSummary = checklist.results_analysis || checklist.results_text || '';
    const nextStepsSummary = checklist.next_pdp || checklist.sustainability || '';

    const projectOverview = hasProject ? `
        <p><strong>Background:</strong> ${nl2br(checklist.problem_desc) || '[Add background]'}</p>
        <p><strong>Aim:</strong> ${nl2br(projectAim) || '[Add your SMART aim]'}</p>
        <p><strong>Understanding the Problem:</strong> ${nl2br(checklist.problem_evidence || checklist.problem_context) || '[Add baseline/scoping evidence]'}</p>
        <p><strong>Measures:</strong> ${measuresLines || '[Add outcome/process/balancing measures]'}</p>
        <p><strong>Interventions:</strong> ${interventionsSummary || '[Add your change ideas / PDSA cycles]'}</p>
        <p><strong>Results:</strong> ${nl2br(resultsSummary) || '[Add results once available]'}</p>
        <p><strong>Next Steps:</strong> ${nl2br(nextStepsSummary) || '[Add next steps]'}</p>
    ` : '[No QI project data found in your project record yet — complete the Problem, Aim and Measures tabs first.]';

    // 3.2 Your Role — infer "Lead" if the account owner appears as project lead.
    const leadEntry = team.find(m => /lead/i.test(m.role || '') && !/deputy|co-|assist/i.test(m.role || ''));
    const roleGuess = leadEntry ? 'Lead' : '[Describe your role — Lead / Co-lead / Team member]';

    // 3.3 Team working and Stakeholders
    const stakeholderNarrative = teamString
        ? `${teamString}${data.stakeholders?.length ? '<br><br>Additional stakeholders engaged: ' + data.stakeholders.map(s => s.name || s).filter(Boolean).join(', ') : ''}`
        : '[List your team members and how you engaged stakeholders]';

    // 3.4 Sharing of results — pull from any dissemination/governance mention in sustainability text.
    const sharingGuess = /governance meeting|consultant meeting|presented/i.test(checklist.sustainability || '')
        ? '[Confirm date/details of your governance or consultant meeting presentation]'
        : '[Add details of any poster, presentation, or meeting where you shared this work]';

    // 4.2 Reflections and Learning
    const reflections = checklist.learning_points || '[Add your reflections — what went well, what didn\'t, what you would do differently]';

    // 4.3 Next Year's PDP
    const nextYearPdp = checklist.next_pdp || '[Add your QI plans for next year]';

    // 4.4 End of training QI development journey — draft skeleton only; this is a
    // personal narrative and should not be fabricated, so we only combine what's
    // already been written elsewhere and flag it clearly as a starting point.
    const journeyDraftParts = [checklist.sustainability, checklist.learning_points].filter(Boolean);
    const journeyDraft = journeyDraftParts.length
        ? `${nl2br(journeyDraftParts.join('\n\n'))}<p style="color:#b45309;"><em>[DRAFT — this field asks for your longitudinal QI/leadership journey across your whole EM training with specific examples from earlier years. The text above is drawn only from this project's sustainability/learning notes — personalise it before submitting.]</em></p>`
        : '[Add a summary of your QI/leadership development across your whole EM training, with specific examples from earlier training years]';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (window.showToast) window.showToast('Please allow pop-ups to export to Kaizen', 'error');
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>EM QIAT (2025 Update) Export</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #2d2e83; padding-bottom: 20px; margin-bottom: 30px; position: relative; }
                .logo { position: absolute; top: 0; right: 0; width: 100px; }
                h1 { color: #2d2e83; font-size: 22px; }
                h2 { color: #2d2e83; font-size: 17px; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                h3 { font-size: 13.5px; color: #444; margin-bottom: 4px; }
                .part-label { display: inline-block; background: #eef2ff; color: #312e81; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: .03em; padding: 2px 8px; border-radius: 3px; margin-bottom: 6px; }
                .section { margin-bottom: 22px; }
                .content-box { background: #f9f9f9; padding: 14px; border: 1px solid #ddd; border-radius: 4px; min-height: 30px; font-size: 13.5px; }
                .content-box p { margin: 0 0 8px; }
                .hint { color: #64748b; font-size: 11.5px; font-style: italic; margin: 2px 0 8px; }
                .btn-print { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #2d2e83; color: white; text-align: center; text-decoration: none; border-radius: 5px; cursor: pointer; border: none; font-size: 14px; }
                @media print { .btn-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="./logo.png" alt="WMEBEM Logo" class="logo">
                <h1>EM Quality Improvement Assessment Tool (2025 Update)</h1>
                <p><strong>Project Title:</strong> ${esc(meta.title) || 'Not specified'}</p>
                <p><strong>Date Exported:</strong> ${new Date().toLocaleDateString()}</p>
                <p class="hint">This mirrors the fields on the live risr/advance "New EM QIAT (2025 Update)" form — copy each box into the matching field there.</p>
            </div>

            <button class="btn-print" onclick="window.print()">Print to PDF</button>

            <div class="section">
                <h2>Header fields</h2>
                <h3>Stage of training</h3>
                <div class="content-box">${esc(stageLabel(meta.trainingStage))}</div>
                <h3>Placement</h3>
                <div class="content-box">[Add your placement/rotation for this training year, e.g. "ST6 year at &lt;hospital&gt;"]</div>
                <h3>Date of completion</h3>
                <div class="content-box">[Add the date you expect to complete/submit this QIAT form]</div>
            </div>

            <div class="section">
                <span class="part-label">Part A</span>
                <h2>1. QI Personal Development Plan &mdash; Current year</h2>
                <h3>1.1 PDP &mdash; summarise your QI PDP for this year and list specific objectives</h3>
                <div class="content-box">
                    <p>This year's QI PDP centred on leading a full-cycle, trainee-initiated Quality Improvement Project (see Section 3 below). Specific objectives:</p>
                    <p>1. Design and lead a multi-arm QI project using the Model for Improvement and PDSA methodology.<br>
                    2. Develop stakeholder engagement and negotiation skills across multidisciplinary and cross-site teams.<br>
                    3. Build competence in QI measurement (run charts, IHI rules, appropriate statistical testing) to produce defensible outcome data.<br>
                    4. Develop supervisory/leadership capability by supporting junior team members with their own portfolio evidence.<br>
                    5. Disseminate findings via departmental governance and, longer-term, regional/national platforms.</p>
                    <p class="hint">[Review and personalise — these objectives are drafted from your project record, not a separate PDP conversation with your ES.]</p>
                </div>
            </div>

            <div class="section">
                <h2>2. QI Education</h2>
                <h3>2.1 Involvement &mdash; describe your engagement with QI education over the past year</h3>
                <div class="content-box">[No data available in your project record for this &mdash; add any online learning, courses, or conference attendance related to QI here.]</div>
                <h3>2.2 Learning &mdash; how has this developed your understanding of QI?</h3>
                <div class="content-box">[No data available in your project record for this &mdash; describe what formal QI education contributed, separate from what you learned by doing the project itself.]</div>
            </div>

            <div class="section">
                <h2>3. Project Involvement</h2>
                <h3>3.0 Were you involved in a QI project in any way?</h3>
                <div class="content-box">${hasProject ? 'Yes' : '[Answer Yes/No]'}</div>

                <h3>3.1 Project Overview</h3>
                <div class="content-box">${projectOverview}</div>

                <h3>3.2 Your Role in the Project</h3>
                <div class="content-box">${roleGuess}</div>

                <h3>3.2.1 QI tools attachment</h3>
                <div class="content-box hint">Attach your driver diagram, fishbone diagram, and run chart as files &mdash; use the PNG/SVG export buttons on the Diagnosis Tools and Data pages, then upload them to this field on the live form.</div>

                <h3>3.3 Team working and Stakeholders</h3>
                <div class="content-box">${stakeholderNarrative}</div>

                <h3>3.4 Sharing of results</h3>
                <div class="content-box">${sharingGuess}</div>

                <h3>3.5 Poster or Presentation</h3>
                <div class="content-box hint">Attach any poster or slide deck as a file upload on the live form.</div>
            </div>

            <div class="section">
                <h2>4. Learning &amp; Development</h2>
                <h3>4.1 The QI Journey &mdash; tick all that apply on the live form</h3>
                <div class="content-box hint">Creating Conditions &middot; Understanding Systems &middot; Developing Aims &middot; Testing Changes &middot; Implement &middot; Spread &middot; Leadership &amp; Teams &middot; Project Management &amp; Communication &middot; Measurement</div>

                <h3>4.2 Reflections and Learning</h3>
                <div class="content-box">${nl2br(reflections)}</div>

                <h3>4.3 Next Year's PDP</h3>
                <div class="content-box">${nl2br(nextYearPdp)}</div>

                <h3>4.4 End of training &mdash; QI development journey</h3>
                <div class="content-box">${journeyDraft}</div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
