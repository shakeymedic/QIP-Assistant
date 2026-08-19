// kaizen-export.js
//
// Generates copy-paste-ready text matching the ACTUAL current RCEM EM-QIAT
// (2025 Update, v7) form on kaizenep.com/risr-advance — NOT a generic "QIAT"
// layout. Field labels and numbering below (1.1, 2.1, 3.0-3.5, 4.1-4.4) are
// taken directly from that live form so this export can be pasted straight
// into the matching boxes.

import { state } from "./state.js";
import { getProjectExportGaps } from "./utils.js";
import { deriveStageLabel, deriveTeam, deriveRole, deriveOverview, deriveSharingResults, deriveReflections, deriveNextYearPdp, hasAnyProjectData, derivePdpFromJournal, deriveEducationInvolvementFromJournal, deriveEndOfTrainingFromJournal } from "./emqiat-shared.js";

// Field label → friendly name, used only for the "tick all that apply" list below.
const QI_JOURNEY_LABELS = {
    creatingConditions: 'Creating Conditions',
    understandingSystems: 'Understanding Systems',
    developingAims: 'Developing Aims',
    testingChanges: 'Testing Changes',
    implement: 'Implement',
    spread: 'Spread',
    leadershipTeams: 'Leadership & Teams',
    projectManagementCommunication: 'Project Management & Communication',
    measurement: 'Measurement'
};

function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

function nl2br(value) {
    return esc(value).replace(/\n/g, '<br>');
}

export function exportToKaizen() {
    const data = state.projectData || window.projectData || {};
    const gaps = getProjectExportGaps(data);
    if (gaps.length > 0 && window.showConfirmDialog) {
        window.showConfirmDialog(
            'This project is missing some information that would normally appear in the QIAT export — ' + gaps.join(' ') + ' You can still export now and fill those sections in on the live Kaizen form yourself, or go back and add them first.',
            () => runKaizenExport(),
            'Export Anyway',
            'Some sections look incomplete'
        );
        return;
    }
    runKaizenExport();
}

function runKaizenExport() {
    const data = state.projectData || window.projectData || {};
    const checklist = data.checklist || {};
    const meta = data.meta || {};
    const emqiatForm = data.emqiatForm || {};
    const overview = emqiatForm.overview || {};
    const derivedOverview = deriveOverview(data);
    const hasProject = hasAnyProjectData(data);

    // Every field below PREFERS what the trainee actually typed into the
    // in-app EM-QIAT form (data.emqiatForm.*) and only falls back to a derived
    // suggestion from elsewhere in the project, then a bracketed placeholder,
    // if the trainee hasn't filled it in yet. This keeps the export and the
    // in-app form from ever drifting apart.
    const stage = emqiatForm.stageOfTraining || deriveStageLabel(meta.trainingStage) || '[Add your stage of training, e.g. ST6]';
    const placement = emqiatForm.placement || '[Add your placement/rotation for this training year, e.g. "ST6 year at &lt;hospital&gt;"]';
    const dateOfCompletion = emqiatForm.dateOfCompletion || '[Add the date you expect to complete/submit this QIAT form]';
    const pdp = emqiatForm.pdp || derivePdpFromJournal(data) || `This year's QI PDP centred on leading a full-cycle, trainee-initiated Quality Improvement Project (see Section 3 below).<p class="hint">[No PDP text entered yet on the EM-QIAT tab — add your own, or use "Suggest from project data" there.]</p>`;
    const qiEducationInvolvement = emqiatForm.qiEducationInvolvement || deriveEducationInvolvementFromJournal(data) || '[No data available for this — add any online learning, courses, or conference attendance related to QI here.]';
    const qiEducationLearning = emqiatForm.qiEducationLearning || '[No data available for this — describe what formal QI education contributed, separate from what you learned by doing the project itself.]';
    const involvedAnswer = emqiatForm.involvedInProject === 'yes' ? 'Yes'
        : emqiatForm.involvedInProject === 'no' ? 'No'
        : (hasProject ? 'Yes' : '[Answer Yes/No]');

    const ov = {
        background: overview.background || derivedOverview.background || '[Add background]',
        aim: overview.aim || derivedOverview.aim || '[Add your SMART aim]',
        understandingProblem: overview.understandingProblem || derivedOverview.understandingProblem || '[Add baseline/scoping evidence]',
        measures: overview.measures || derivedOverview.measures || '[Add outcome/process/balancing measures]',
        interventions: overview.interventions || derivedOverview.interventions || '[Add your change ideas / PDSA cycles]',
        results: overview.results || derivedOverview.results || '[Add results once available]',
        nextSteps: overview.nextSteps || derivedOverview.nextSteps || '[Add next steps]'
    };
    const projectOverview = hasProject || Object.values(overview).some(Boolean) ? `
        <p><strong>Background:</strong> ${nl2br(ov.background)}</p>
        <p><strong>Aim:</strong> ${nl2br(ov.aim)}</p>
        <p><strong>Understanding the Problem:</strong> ${nl2br(ov.understandingProblem)}</p>
        <p><strong>Measures:</strong> ${nl2br(ov.measures)}</p>
        <p><strong>Interventions:</strong> ${nl2br(ov.interventions)}</p>
        <p><strong>Results:</strong> ${nl2br(ov.results)}</p>
        <p><strong>Next Steps:</strong> ${nl2br(ov.nextSteps)}</p>
    ` : '[No QI project data found yet — complete the Problem, Aim and Measures tabs, or fill in the EM-QIAT tab directly, first.]';

    const roleGuess = emqiatForm.role || deriveRole(data) || '[Describe your role — Lead / Co-lead / Team member]';

    const teamDerived = deriveTeam(data);
    const stakeholderNarrative = emqiatForm.teamStakeholders || (teamDerived
        ? `${teamDerived}${data.stakeholders?.length ? '<br><br>Additional stakeholders engaged: ' + data.stakeholders.map(s => s.name || s).filter(Boolean).join(', ') : ''}`
        : '[List your team members and how you engaged stakeholders]');

    const sharingGuess = emqiatForm.sharingResults || deriveSharingResults(data) || '[Add details of any poster, presentation, or meeting where you shared this work]';

    // 4.1 QI Journey — now a real tracked checklist (data.emqiatForm.qiJourney),
    // not just an instruction to go tick it on the live form.
    const qiJourney = emqiatForm.qiJourney || {};
    const qiJourneyList = Object.entries(QI_JOURNEY_LABELS)
        .map(([key, label]) => `${qiJourney[key] ? '☑' : '☐'} ${label}`)
        .join(' &nbsp;&middot;&nbsp; ');

    const reflections = emqiatForm.reflections || deriveReflections(data) || '[Add your reflections — what went well, what didn\'t, what you would do differently]';
    const nextYearPdp = emqiatForm.nextYearPdp || deriveNextYearPdp(data) || '[Add your QI plans for next year]';

    // 4.4 End of training QI development journey — this is a personal narrative
    // and should not be fabricated. Prefer the trainee's own text; only fall
    // back to a clearly-marked draft skeleton if they haven't written anything.
    const journeyDraftParts = [checklist.sustainability, checklist.learning_points].filter(Boolean);
    const journeyDraft = emqiatForm.endOfTrainingJourney || deriveEndOfTrainingFromJournal(data) || (journeyDraftParts.length
        ? `${nl2br(journeyDraftParts.join('\n\n'))}<p style="color:#b45309;"><em>[DRAFT — this field asks for your longitudinal QI/leadership journey across your whole EM training with specific examples from earlier years. The text above is drawn only from this project's sustainability/learning notes — personalise it before submitting.]</em></p>`
        : '[Add a summary of your QI/leadership development across your whole EM training, with specific examples from earlier training years]');

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
                <div class="content-box">${nl2br(stage)}</div>
                <h3>Placement</h3>
                <div class="content-box">${nl2br(placement)}</div>
                <h3>Date of completion</h3>
                <div class="content-box">${nl2br(dateOfCompletion)}</div>
            </div>

            <div class="section">
                <span class="part-label">Part A</span>
                <h2>1. QI Personal Development Plan &mdash; Current year</h2>
                <h3>1.1 PDP &mdash; summarise your QI PDP for this year and list specific objectives</h3>
                <div class="content-box">${nl2br(pdp)}</div>
            </div>

            <div class="section">
                <h2>2. QI Education</h2>
                <h3>2.1 Involvement &mdash; describe your engagement with QI education over the past year</h3>
                <div class="content-box">${nl2br(qiEducationInvolvement)}</div>
                <h3>2.2 Learning &mdash; how has this developed your understanding of QI?</h3>
                <div class="content-box">${nl2br(qiEducationLearning)}</div>
            </div>

            <div class="section">
                <h2>3. Project Involvement</h2>
                <h3>3.0 Were you involved in a QI project in any way?</h3>
                <div class="content-box">${involvedAnswer}</div>

                <h3>3.1 Project Overview</h3>
                <div class="content-box">${projectOverview}</div>

                <h3>3.2 Your Role in the Project</h3>
                <div class="content-box">${nl2br(roleGuess)}</div>

                <h3>3.2.1 QI tools attachment</h3>
                <div class="content-box hint">Attach your driver diagram, fishbone diagram, and run chart as files &mdash; use the PNG/SVG export buttons on the Diagnosis Tools and Data pages, then upload them to this field on the live form.</div>

                <h3>3.3 Team working and Stakeholders</h3>
                <div class="content-box">${nl2br(stakeholderNarrative)}</div>

                <h3>3.4 Sharing of results</h3>
                <div class="content-box">${nl2br(sharingGuess)}</div>

                <h3>3.5 Poster or Presentation</h3>
                <div class="content-box hint">Attach any poster or slide deck as a file upload on the live form.</div>
            </div>

            <div class="section">
                <h2>4. Learning &amp; Development</h2>
                <h3>4.1 The QI Journey</h3>
                <div class="content-box">${qiJourneyList}</div>

                <h3>4.2 Reflections and Learning</h3>
                <div class="content-box">${nl2br(reflections)}</div>

                <h3>4.3 Next Year's PDP</h3>
                <div class="content-box">${nl2br(nextYearPdp)}</div>

                <h3>4.4 End of training &mdash; QI development journey</h3>
                <div class="content-box">${nl2br(journeyDraft)}</div>
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
