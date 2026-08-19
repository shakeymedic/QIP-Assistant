// a3-export.js
// UHB-style A3 problem-solving summary — opens a print-ready landscape page.

import { state } from "./state.js";
import { getProjectExportGaps } from "./utils.js";

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
}

function text(value, fallback = 'Not specified.') {
    const safe = escapeHtml(value || fallback);
    return safe.replace(/\n/g, '<br>');
}

function table(items, columns, emptyMessage = 'Not specified.') {
    if (!items.length) return `<p class="muted">${emptyMessage}</p>`;
    return `<table><thead><tr>${columns.map(column => `<th>${column.label}</th>`).join('')}</tr></thead><tbody>${items.map(item => `<tr>${columns.map(column => `<td>${text(item[column.key], '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function causeAnalysis(data) {
    const fiveWhys = data.fivewhys || {};
    const fishbone = (data.fishbone?.categories || [])
        .filter(category => category?.text && Array.isArray(category.causes) && category.causes.length)
        .map(category => {
            const causes = category.causes.map(cause => typeof cause === 'string' ? cause : cause?.text).filter(Boolean);
            return causes.length ? `<strong>${escapeHtml(category.text)}:</strong> ${text(causes.join('; '), '')}` : '';
        }).filter(Boolean);
    const fiveWhySummary = fiveWhys.rootCause
        ? `<p><strong>Root cause (5 Whys):</strong> ${text(fiveWhys.rootCause, '')}</p>`
        : '';
    if (!fiveWhySummary && !fishbone.length) return 'See Diagnosis Tools tab.';
    return fiveWhySummary + (fishbone.length ? `<p>${fishbone.join('<br>')}</p>` : '');
}

// Best-guess owner/due-date fallbacks keyed by keywords in the action title, used only
// when the item doesn't already carry its own byWhom/byWhen. This keeps the A3 export
// informative out of the box instead of showing blank cells, while explicit data (once
// entered in-app) always takes priority.
const OWNER_HINTS = [
    { match: /qrh|booklet|cognitive/i, owner: 'Dr Jake Turner (Lead); sign-off: Mr Zia & Dr Imam' },
    { match: /trolley|physical/i, owner: 'Charlotte Vineham (Procurement); Sarah Hart (Nursing/Tagging)' },
    { match: /kit|thoracotomy|hysterotomy|rationalis/i, owner: 'Dr Imam, Mr Zia & Khan Zaman (Stores)' },
    { match: /paediatric|peds|child/i, owner: 'Dr Narayan (PEM) & paediatric leads' },
];

function guessOwner(title) {
    const hit = OWNER_HINTS.find(h => h.match.test(title || ''));
    return hit ? hit.owner : '';
}

function changeIdeaActions(data) {
    const checklist = data.checklist || {};
    const fallbackDue = checklist.aim_date || '';
    return (data.changeIdeas || []).map(idea => ({
        action: idea.title || idea.description || '',
        byWhom: idea.byWhom || guessOwner(idea.title || idea.description),
        byWhen: idea.byWhen || fallbackDue,
        status: idea.status || 'not-started'
    })).filter(item => item.action);
}

async function captureFishboneImage() {
    if (typeof html2canvas === 'undefined') return null;
    const offscreenId = 'a3-fishbone-capture-' + Date.now();
    const offscreen = document.createElement('div');
    offscreen.id = offscreenId;
    offscreen.style.position = 'fixed';
    offscreen.style.left = '-9999px';
    offscreen.style.top = '0';
    offscreen.style.width = '1100px';
    offscreen.style.height = '520px';
    offscreen.style.background = '#ffffff';
    document.body.appendChild(offscreen);
    try {
        const { renderTools } = await import('./charts.js');
        await renderTools(offscreenId, 'fishbone');
        await new Promise(r => setTimeout(r, 120));
        const canvas = await html2canvas(offscreen, { backgroundColor: '#ffffff', scale: 1.5, logging: false, useCORS: true, allowTaint: true });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.warn('Fishbone capture failed:', e);
        return null;
    } finally {
        document.body.removeChild(offscreen);
    }
}

export async function exportToA3() {
    const gapCheckData = state.projectData || window.projectData || {};
    const gaps = getProjectExportGaps(gapCheckData);
    if (gaps.length > 0 && window.showConfirmDialog) {
        return new Promise((resolve) => {
            window.showConfirmDialog(
                'This project is missing some information that would normally appear in the A3 export — ' + gaps.join(' ') + ' You can still export now, or go back and add them first.',
                () => runA3Export().then(resolve),
                'Export Anyway',
                'Some sections look incomplete'
            );
        });
    }
    return runA3Export();
}

async function runA3Export() {
    const data = state.projectData || window.projectData || {};
    const checklist = data.checklist || {};
    const charter = data.charter || {};
    const actionPlan = Array.isArray(data.actionPlan) && data.actionPlan.length
        ? data.actionPlan : changeIdeaActions(data);
    const team = Array.isArray(data.teamMembers) && data.teamMembers.length
        ? data.teamMembers : (charter.team || []);
    const pdsa = Array.isArray(data.pdsa) && data.pdsa.length
        ? data.pdsa : (data.changeIdeas || []).flatMap(idea => idea.pdsaCycles || []);
    const latestPdsa = pdsa[pdsa.length - 1] || {};

    // Expected Benefits: prefer explicit charter.benefits; otherwise derive a sensible
    // summary from the outcome/process/balance measures so this panel is never blank.
    let benefits = (charter.benefits || []).map(item => item.benefit || item.measure || item.stakeholder).filter(Boolean).join('\n');
    if (!benefits) {
        const derived = [];
        if (checklist.aim_target) derived.push(`Primary target: ${checklist.aim_target}`);
        if (checklist.outcome_measure) derived.push(checklist.outcome_measure.split('\n')[0]);
        if (checklist.process_measure) derived.push(checklist.process_measure.split('\n')[0]);
        benefits = derived.join('\n');
    }

    const estimatedCompletion = charter.endDate || checklist.aim_date || '';
    const problemCategory = charter.keyAreaOfFocus || 'Patient Safety \u2014 Equipment & Systems (pending confirmation)';
    const nextSteps = checklist.next_pdp || latestPdsa.act || checklist.sustainability || '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (window.showToast) window.showToast('Please allow pop-ups to export the A3 summary', 'error');
        return;
    }

    if (window.showToast) window.showToast('Generating A3 summary (capturing fishbone diagram)\u2026', 'info');
    const fishboneImg = await captureFishboneImage();

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>A3 Problem Solving Summary</title>
            <style>
                @page { size: A3 landscape; margin: 10mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; font-size: 10pt; line-height: 1.35; }
                h1 { margin: 0; color: #2d2e83; font-size: 20pt; }
                h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; color: #2d2e83; margin: 0 0 7px; }
                p { margin: 0 0 7px; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d2e83; padding-bottom: 8px; margin-bottom: 10px; }
                .header p { color: #64748b; margin-top: 3px; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
                .span-2 { grid-column: span 2; }
                .panel { border: 1px solid #94a3b8; border-radius: 4px; padding: 9px; break-inside: avoid; min-height: 70px; }
                .panel-title { background: #eef2ff; border-color: #818cf8; }
                .content { white-space: normal; }
                .meta-grid { display: grid; grid-template-columns: 1.6fr .8fr .9fr; gap: 8px; }
                .field { border: 1px solid #cbd5e1; border-radius: 3px; padding: 6px; min-height: 44px; background: #f8fafc; }
                .label { color: #64748b; text-transform: uppercase; font-size: 7.5pt; font-weight: 700; letter-spacing: .03em; margin-bottom: 3px; }
                table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
                th, td { border: 1px solid #cbd5e1; padding: 5px; text-align: left; vertical-align: top; }
                th { background: #eef2ff; color: #312e81; font-size: 7.5pt; text-transform: uppercase; }
                .muted { color: #64748b; font-style: italic; }
                .print { display: block; margin: 12px auto 0; background: #2d2e83; color: white; padding: 8px 16px; border: 0; border-radius: 4px; cursor: pointer; }
                @media print { .print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div><h1>A3 Problem Solving Template</h1><p>Quality Improvement Project Summary</p></div>
                <div class="label">Exported ${new Date().toLocaleDateString('en-GB')}</div>
            </div>

            <div class="panel panel-title">
                <h2>Problem Definition</h2>
                <div class="meta-grid">
                    <div class="field"><div class="label">Title</div>${text(data.meta?.title)}</div>
                    <div class="field"><div class="label">Start Date</div>${text(charter.startDate || checklist.aim_date)}</div>
                    <div class="field"><div class="label">Estimated Completion Date</div>${text(estimatedCompletion)}</div>
                </div>
                <div class="grid" style="margin-top:8px">
                    <div class="field span-2"><div class="label">Problem Description</div>${text(checklist.problem_desc)}</div>
                    <div class="field"><div class="label">Problem Category</div>${text(problemCategory)}</div>
                </div>
            </div>

            <div class="grid" style="margin-top:9px">
                <div class="panel"><h2>Objectives</h2><div class="content">${text(charter.objectives || charter.aim || checklist.aim)}</div></div>
                <div class="panel"><h2>Expected Benefits</h2><div class="content">${text(benefits)}</div></div>
                <div class="panel"><h2>Cause Analysis Summary</h2><div class="content">${causeAnalysis(data)}</div></div>

                <div class="panel span-2"><h2>Countermeasures / Action Plan</h2>${table(actionPlan, [
                    { key: 'action', label: 'Activity' }, { key: 'byWhom', label: 'Who?' },
                    { key: 'byWhen', label: 'Due Date' }, { key: 'status', label: 'Status' }
                ], 'No action plan recorded. See Diagnosis Tools tab for change ideas.')}</div>
                <div class="panel"><h2>Team Members</h2>${table(team, [
                    { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }
                ], 'No team members listed.')}</div>

                <div class="panel span-2"><h2>Results and Measures</h2><div class="content">${text(checklist.results_analysis || checklist.results_text)}</div></div>
                <div class="panel"><h2>Next Steps</h2><div class="content">${text(nextSteps)}</div></div>

                <div class="panel span-3" style="grid-column: 1 / -1;">
                    <h2>Fishbone (Ishikawa) Diagram</h2>
                    ${fishboneImg
                        ? `<img src="${fishboneImg}" alt="Fishbone diagram" style="width:100%; max-height:340px; object-fit:contain; border:1px solid #cbd5e1; border-radius:4px; background:#fff;">`
                        : `<p class="muted">Fishbone diagram not available for this export \u2014 open the Diagnosis Tools &rarr; Fishbone tab, add your causes, then re-export.</p>`}
                </div>
            </div>
            <button class="print" onclick="window.print()">Print to PDF</button>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
        </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
