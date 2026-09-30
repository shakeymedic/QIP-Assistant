// kaizen-export.js
//
// Export of the EM QIAT (2025 Update) laid out exactly like the live form on
// risr/advance (kaizenep.com): the intro, header fields, Part A with the same
// numbering and question wording (1.1, 2.1, 3.0–3.5, 4.1–4.4) and the
// Curriculum section — each answer in its own box with a Copy button, so it
// can be pasted straight into the matching field.
//
// Each answer is what the trainee wrote on the EM QIAT form in the app. If a
// box is empty, a draft built from the project data is shown instead, clearly
// marked as a draft; failing that, a marked reminder of what to write.

import { state } from "./state.js";
import { getProjectExportGaps } from "./utils.js";
import {
    deriveStageLabel, deriveOverview, deriveSharingResults, deriveReflections, deriveNextYearPdp,
    hasAnyProjectData, derivePdpFromJournal, deriveEducationInvolvementFromJournal, deriveEndOfTrainingFromJournal,
    deriveRoleNarrative, deriveTeamNarrative, assessEmqiat, isFinalYear,
    EMQIAT_INTRO, EMQIAT_NA_NOTE, EMQIAT_PROMPTS, QI_JOURNEY_ITEMS, QI_JOURNEY_URL,
    CURRICULUM_HEADING, CURRICULUM_NOTE, CURRICULUM_KCS, OVERVIEW_PARTS
} from "./emqiat-shared.js";

// Escapes HTML special characters. Apply only to user/derived text.
function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
}

// Text for a CSS content string (page header): quotes, backslashes and
// line breaks escaped, and "<" escaped so it cannot close the <style> block.
function cssString(value) {
    return String(value || '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3C ');
}

function nl2br(value) {
    return esc(value).replace(/\n/g, '<br>');
}

export function exportToKaizen() {
    const data = state.projectData || window.projectData || {};
    const gaps = getProjectExportGaps(data);
    if (gaps.length > 0 && window.showConfirmDialog) {
        window.showConfirmDialog(
            'This project is missing some information that would normally appear in the QIAT export — ' + gaps.join(' ') + ' You can still export now and fill those sections in on the live form yourself, or go back and add them first.',
            () => runKaizenExport(),
            'Export Anyway',
            'Some sections look incomplete'
        );
        return;
    }
    runKaizenExport();
}

// One answer box: the trainee's text, else a marked draft, else a marked reminder.
function answerBox(typed, draft, reminder) {
    if (typed && String(typed).trim()) return `<div class="content-box" data-copy="${esc(typed)}">${nl2br(typed)}</div>`;
    if (draft && String(draft).trim()) {
        return `<div class="content-box draft" data-copy="${esc(draft)}"><div class="flag no-copy">Draft from your project data — not yet written by you. Rewrite in your own words and fill in any [bracketed] parts before pasting.</div>${nl2br(draft)}</div>`;
    }
    return reminder === 'N/A' ? `<div class="content-box" data-copy="N/A">N/A</div>` : `<div class="content-box todo no-copy">${esc(reminder)}</div>`;
}

function question(q) {
    return `<h3>${esc(q.num)} ${esc(q.label)}${q.prompt ? ` <span class="prompt">- ${esc(q.prompt)}</span>` : ''}</h3>${q.hint ? `<p class="prompt">${esc(q.hint)}</p>` : ''}`;
}

function runKaizenExport() {
    const data = state.projectData || window.projectData || {};
    const meta = data.meta || {};
    const e = data.emqiatForm || {};
    const overview = e.overview || {};
    const derivedOverview = deriveOverview(data);
    const hasProject = hasAnyProjectData(data);
    const P = EMQIAT_PROMPTS;
    const finalYear = isFinalYear(data);
    const check = assessEmqiat(data);

    const involved = e.involvedInProject === 'yes' ? 'Yes' : e.involvedInProject === 'no' ? 'No' : (hasProject ? 'Yes' : '');

    // 3.1: the trainee's structured overview, falling back part by part to a draft.
    const ovTyped = OVERVIEW_PARTS.some(([k]) => (overview[k] || '').trim());
    const ovRows = OVERVIEW_PARTS.map(([k, l]) => {
        const typed = (overview[k] || '').trim();
        const draft = (derivedOverview[k] || '').trim();
        if (typed) return `<p><strong>${l}:</strong> ${nl2br(typed)}</p>`;
        if (draft) return `<p class="draft-inline"><strong>${l}:</strong> ${nl2br(draft)} <span class="flag-inline no-copy">(draft from project data)</span></p>`;
        return `<p class="todo-inline"><strong>${l}:</strong> [To complete]</p>`;
    }).join('');
    const overviewBox = (ovTyped || hasProject)
        ? `<div class="content-box" data-copy="${esc(OVERVIEW_PARTS.map(([k, l]) => { const t = (overview[k] || '').trim() || (derivedOverview[k] || '').trim(); return t ? `${l}: ${t}` : ''; }).filter(Boolean).join('\n\n'))}">${ovRows}</div>`
        : `<div class="content-box todo">[To complete: background, aim, understanding the problem, measures, interventions, results and next steps]</div>`;

    const journey = e.qiJourney || {};
    const ticked = QI_JOURNEY_ITEMS.filter(([k]) => journey[k]).map(([, l]) => l);
    const curriculum = e.curriculum || {};
    const kcs = CURRICULUM_KCS.filter(([k]) => curriculum[k]).map(([, l]) => l);

    const weak = check.items.filter(i => !i.optional && i.status !== 'strong');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (window.showToast) window.showToast('Please allow pop-ups to open the export', 'error');
        return;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en-GB">
<head>
    <meta charset="UTF-8">
    <title>EM QIAT (2025 Update) — ${esc(meta.title || 'QIP')}</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; line-height: 1.55; color: #1e293b; padding: 36px; max-width: 900px; margin: 0 auto; font-size: 14px; }
        h1 { color: #2d2e83; font-size: 21px; margin: 0 0 4px; }
        .sub { color: #64748b; font-size: 12px; margin: 0 0 18px; }
        .intro { margin: 0 0 14px; }
        .hdr { display: grid; grid-template-columns: 170px 1fr; gap: 4px 12px; margin-bottom: 16px; font-size: 13.5px; }
        .hdr span:nth-child(odd) { color: #475569; }
        h2 { color: #a21caf; font-size: 17px; font-weight: normal; margin: 26px 0 10px; }
        h3 { font-size: 13.5px; color: #1e293b; margin: 14px 0 5px; font-weight: bold; }
        h3 .prompt { font-weight: normal; color: #475569; }
        .content-box { position: relative; background: #f8fafc; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 6px; min-height: 22px; font-size: 13.5px; }
        .content-box p { margin: 0 0 8px; }
        .content-box.draft { background: #fffbeb; border-color: #fcd34d; }
        .content-box.todo, .todo-inline { color: #b45309; font-style: italic; }
        .draft-inline { background: #fffbeb; }
        .flag { font-size: 11.5px; color: #92400e; font-weight: bold; margin-bottom: 6px; }
        .flag-inline { font-size: 11px; color: #92400e; font-style: italic; }
        .note { color: #64748b; font-size: 12px; font-style: italic; }
        .copy { position: absolute; top: 6px; right: 6px; font-size: 11px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 8px; cursor: pointer; color: #334155; }
        .copy:hover { background: #eef2ff; }
        .check { border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 8px; padding: 12px 14px; margin: 0 0 20px; font-size: 13px; }
        .check.good { border-color: #a7f3d0; background: #ecfdf5; }
        .check ul { margin: 6px 0 0; padding-left: 18px; }
        .toolbar { display: flex; gap: 8px; justify-content: center; margin: 0 0 20px; }
        .toolbar button { padding: 9px 16px; background: #2d2e83; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
        a { color: #a21caf; }
        .tip { text-align: center; color: #64748b; font-size: 12px; margin: -12px 0 18px; }
        /* Printed page: real margins, a running header and page numbers. */
        @page {
            size: A4;
            margin: 20mm 18mm 20mm 18mm;
            @top-left { content: "EM QIAT (2025 Update)"; font: 8pt Arial, Helvetica, sans-serif; color: #64748b; }
            @top-right { content: "${cssString((meta.title || '').length > 70 ? (meta.title || '').slice(0, 69) + '…' : meta.title)}"; font: 8pt Arial, Helvetica, sans-serif; color: #64748b; }
            @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, Helvetica, sans-serif; color: #64748b; }
        }
        @page :first { @top-left { content: none; } @top-right { content: none; } }
        @media print {
            .toolbar, .tip, .copy, .check, .no-copy { display: none !important; }
            html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { padding: 0; max-width: none; font-size: 10.5pt; line-height: 1.45; }
            h1 { font-size: 17pt; }
            .sub { font-size: 9pt; }
            h2 { font-size: 13pt; margin: 18pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #f0abfc; break-after: avoid; page-break-after: avoid; }
            h3 { font-size: 10.5pt; margin: 10pt 0 4pt; break-after: avoid; page-break-after: avoid; }
            .hdr { font-size: 10.5pt; break-inside: avoid; }
            .content-box { font-size: 10.5pt; padding: 8pt 10pt; orphans: 3; widows: 3; }
            .content-box.draft { background: #f8fafc; border-color: #e2e8f0; }
            p { orphans: 3; widows: 3; }
            a { color: inherit; text-decoration: none; }
        }
    </style>
</head>
<body>
    <h1>EM QIAT (2025 Update)</h1>
    <p class="sub">${esc(meta.title || 'Untitled QIP')} · exported ${new Date().toLocaleDateString('en-GB')} · copy each box into the matching field on risr/advance</p>

    <div class="toolbar"><button onclick="window.print()">Print / save as PDF</button></div>
    <p class="tip">In the print window, choose <strong>Save as PDF</strong>, leave <strong>Margins</strong> on <strong>Default</strong> and untick <strong>Headers and footers</strong> — page numbers are already included.</p>

    <div class="check ${weak.length ? '' : 'good'}">
        <strong>Excellence check: ${check.strong} of ${check.total} sections strong.</strong>
        ${weak.length ? `<ul>${weak.map(i => `<li><strong>${esc(i.num ? i.num + ' ' : '')}${esc(i.title)}:</strong> ${esc(i.checks.filter(c => !c.ok).map(c => c.text).join('; '))}</li>`).join('')}</ul>` : ' Every section has what an assessor looks for.'}
        ${check.rcem && check.rcem.excellent.length ? `<div style="margin-top:8px"><strong>RCEM “excellent” descriptors evidenced: ${check.rcem.excellent.filter(d => d.ok).length} of ${check.rcem.excellent.length}.</strong><ul>${check.rcem.excellent.filter(d => !d.ok).map(d => `<li>Not yet evidenced: ${esc(d.text)}</li>`).join('')}</ul></div>` : ''}
        <div class="note" style="margin-top:6px">A content check, not a grade — the assessment is your supervisor’s judgement. Not shown when printed.</div>
    </div>

    <p class="intro">${esc(EMQIAT_INTRO)}</p>
    <div class="hdr">
        <span>Stage of training</span><span>${e.stageOfTraining ? esc(e.stageOfTraining) : `<em class="todo-inline">${esc(deriveStageLabel(meta.trainingStage) || '[To complete, e.g. ST6]')}</em>`}</span>
        <span>Placement</span><span>${e.placement ? esc(e.placement) : '<em class="todo-inline">[To complete, e.g. ST6 year at &lt;hospital&gt;]</em>'}</span>
        <span>Date of completion</span><span>${e.dateOfCompletion ? esc(new Date(e.dateOfCompletion + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) : '<em class="todo-inline">[To complete]</em>'}</span>
    </div>

    <p><strong>Part A</strong></p>
    <p>${esc(EMQIAT_NA_NOTE)}</p>
    <p>For information on the QI Journey please click here: <a href="${QI_JOURNEY_URL}" target="_blank" rel="noopener">QI journey</a>.</p>

    <h2>1. QI Personal Development Plan - Current year</h2>
    ${question(P.pdp)}
    ${answerBox(e.pdp, derivePdpFromJournal(data), '[To complete: a broad summary of your QI goals this year, then 3–4 specific objectives, one per line]')}

    <h2>2. QI Education</h2>
    ${question(P.qiEducationInvolvement)}
    ${answerBox(e.qiEducationInvolvement, deriveEducationInvolvementFromJournal(data), '[To complete: named courses, e-learning and meetings, and what you took from each into your project]')}
    ${question(P.qiEducationLearning)}
    ${answerBox(e.qiEducationLearning, '', '[To complete: how this developed your understanding of QI and how it will help your future QI work, mapped to the QI Journey stages in 4.1]')}

    <h2>3. Project Involvement</h2>
    ${question(P.involvedInProject)}
    <div class="content-box" data-copy="${esc(involved)}">${involved ? esc(involved) : '<span class="todo-inline">[Yes / No]</span>'}</div>
    ${question(P.overview)}
    ${overviewBox}
    ${question(P.role)}
    ${answerBox(e.role, deriveRoleNarrative(data), '[To complete: your role, stage by stage of the QI Journey, and a challenge you led the team through]')}
    ${question(P.tools)}
    <div class="content-box no-copy note">File upload: attach your driver diagram, fishbone/process map, run chart and PDSA write-ups (export them as images from this app).</div>
    ${question(P.teamStakeholders)}
    ${answerBox(e.teamStakeholders, deriveTeamNarrative(data), '[To complete: team roles, stakeholder groups, how you engaged them and how you gained buy-in]')}
    ${question(P.sharingResults)}
    ${answerBox(e.sharingResults, deriveSharingResults(data), '[To complete: each meeting, poster or presentation — what, to whom, when]')}
    ${question(P.poster)}
    <div class="content-box no-copy note">File upload: attach your poster or presentation.</div>

    <h2>4 - Learning &amp; Development</h2>
    <p>For information on the QI journey please refer to the following link: <a href="${QI_JOURNEY_URL}" target="_blank" rel="noopener">QI Journey</a></p>
    ${question(P.qiJourney)}
    <div class="content-box" data-copy="${esc(ticked.join(', '))}">${ticked.length ? esc(ticked.join(', ')) : '<span class="todo-inline">[Tick the stages you gained experience in]</span>'}</div>
    ${question(P.reflections)}
    ${answerBox(e.reflections, deriveReflections(data), '[To complete: what this year taught you about QI, a challenge you worked through, and what you would do differently]')}
    ${question(P.nextYearPdp)}
    ${answerBox(e.nextYearPdp, deriveNextYearPdp(data), '[To complete: your QI plans for next year (or, if you CCT this year, your QI plans as a new consultant)]')}
    ${question(P.endOfTrainingJourney)}
    ${answerBox(e.endOfTrainingJourney, deriveEndOfTrainingFromJournal(data), finalYear ? '[To complete: your QI and leadership journey across your whole EM training, with examples from earlier years, and how you will apply it as an EM consultant]' : 'N/A')}

    <p style="margin-top:26px"><strong>Curriculum</strong></p>
    <p>${esc(CURRICULUM_NOTE)}</p>
    <h3>${esc(CURRICULUM_HEADING)}</h3>
    <div class="content-box" data-copy="${esc(kcs.join(' , '))}">${kcs.length ? esc(kcs.join(' , ')) : '<span class="todo-inline">[Select the Key Capabilities for your stage, e.g. Higher SLO11 Key Capability 1 and 2]</span>'}</div>
    <p class="note">Attach files</p>

    <script>
        // A Copy button on every answer box, copying just the answer text.
        document.querySelectorAll('.content-box[data-copy]').forEach(function (box) {
            if (!box.dataset.copy) return;
            var btn = document.createElement('button');
            btn.className = 'copy';
            btn.textContent = 'Copy';
            btn.onclick = function () {
                var text = box.dataset.copy;
                navigator.clipboard.writeText(text).then(function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); });
            };
            box.appendChild(btn);
        });
    </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
