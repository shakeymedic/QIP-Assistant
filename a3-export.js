// a3-export.js
// UHB-style A3 problem-solving summary — opens a print-ready landscape page.

import { state } from "./state.js";

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

function changeIdeaActions(data) {
    return (data.changeIdeas || []).map(idea => ({
        action: idea.title || idea.description || '',
        byWhom: '',
        byWhen: '',
        status: idea.status || 'not-started'
    })).filter(item => item.action);
}

export function exportToA3() {
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
    const benefits = (charter.benefits || []).map(item => item.benefit || item.measure || item.stakeholder).filter(Boolean).join('\n');
    const nextSteps = checklist.next_pdp || latestPdsa.act || checklist.sustainability || '';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        if (window.showToast) window.showToast('Please allow pop-ups to export the A3 summary', 'error');
        return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
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
                    <div class="field"><div class="label">Estimated Completion Date</div>${text(charter.endDate)}</div>
                </div>
                <div class="grid" style="margin-top:8px">
                    <div class="field span-2"><div class="label">Problem Description</div>${text(checklist.problem_desc)}</div>
                    <div class="field"><div class="label">Problem Category</div>${text(charter.keyAreaOfFocus)}</div>
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
            </div>
            <button class="print" onclick="window.print()">Print to PDF</button>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
        </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
