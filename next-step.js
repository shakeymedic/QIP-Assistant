// ==========================================
// NEXT STEP COACH AND HANDOVER NOTE
// ==========================================
// One function reads the whole project and says what to do next, in order
// of what a first project needs. The dashboard banner shows it; nothing
// else duplicates the logic.

import { state } from "./state.js";
import { QI } from "./qi-constants.js";
import { escapeHtml, formatDate } from "./utils.js";
import { primaryChartData, chooseBaseline, baselineMedian, withUnit } from "./project-metrics.js";

const PLACEHOLDER = /\[(to be measured|baseline|measure|target|timeframe|date|setting)\]/i;

function daysUntil(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).split('-').map(Number);
    const t = (y && m && d) ? new Date(y, m - 1, d) : new Date(iso);
    if (isNaN(t)) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((t - today) / 86400000);
}

export function nextStep(d) {
    d = d || {};
    const c = d.checklist || {};
    const meta = d.meta || {};
    const pts = primaryChartData(d).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const pdsa = Array.isArray(d.pdsa) ? d.pdsa : [];
    const baseline = chooseBaseline(pts, pdsa);
    const n = baseline.count;
    const total = pts.length;
    const hra = c.hraChecklist || {};
    const plan = d.dataPlan || {};
    const drivers = d.drivers || {};
    const team = Array.isArray(d.teamMembers) ? d.teamMembers : [];
    const hasSponsor = team.some(m => /sponsor|consultant/i.test(m.role || '') || /consultant/i.test(m.grade || '')) || !!(d.charter && d.charter.execSponsor);
    const rotDays = daysUntil(meta.rotationEnd);
    const latestCycle = pdsa.length ? pdsa[pdsa.length - 1] : null;
    const allAdopted = pdsa.length > 0 && pdsa.every(p => (p.actDecision || '').toLowerCase() === 'adopted' || /adopt/i.test(p.act || ''));

    const step = (stage, title, text, view, label, icon = 'lightbulb', tone = 'amber') => ({ stage, title, text, action: { view, label }, icon, tone });

    if (!String(c.problem_desc || '').trim()) return step(1, 'Choose and describe the problem', 'Start with one specific problem in one place. The setup wizard walks you through it and offers starter projects that are known to work for a first QIP.', 'wizard', 'Open the setup wizard', 'compass');
    if (!String(c.aim || '').trim()) return step(2, 'Draft your aim', 'One sentence: direction, measure, from [to be measured] to a target, by a date, in a place. The aim coach on Define & Measure checks it as you type.', 'checklist', 'Draft the aim', 'target');
    if (!(c.outcome_measure && c.process_measure && c.balance_measure)) return step(3, 'Complete the family of measures', 'An outcome, a process and a balancing measure are all expected on the EM QIAT. The balancing measure is the one most first projects forget.', 'checklist', 'Add the measures', 'ruler');
    if (!String(plan.source || '').trim()) return step(4, 'Write the data collection plan', 'Where the data comes from, who collects it, how often and from how many patients. Writing it down now stops the baseline and the later points being collected differently.', 'checklist', 'Write the plan', 'clipboard-list');
    if (hra.q3 !== 'yes') return step(5, hra.q3 === 'pending' ? 'Chase the registration' : 'Register the project', hra.q3 === 'pending' ? 'You have applied to register with the audit or clinical governance department. Until it is confirmed, do not extract patient data; chase it and record the reference once it arrives.' : 'Register with your Trust audit or clinical governance department before looking at patient records. It is usually a short form and takes a week or two.', 'checklist', 'Record the registration', 'shield-check');
    if (!hasSponsor) return step(6, 'Agree a consultant sponsor', 'A consultant who agrees the aim and will keep the project alive after you rotate. Add them to the team so they appear on the charter and the sign-off.', 'team', 'Add the sponsor', 'user-check');
    if (pdsa.length === 0 && n < QI.BASELINE_MIN) return step(7, `Collect the baseline: ${n} of ${QI.BASELINE_TARGET} points`, `Add one point per ${plan.cadence || 'week'} from ${plan.sample || QI.SAMPLE_PER_POINT + ' patients'}. Do not test a change yet: with fewer than ${QI.BASELINE_MIN} points the run chart cannot tell signal from noise.`, 'data', 'Add a data point', 'bar-chart-2', 'blue');
    if (PLACEHOLDER.test(c.aim) && n >= QI.BASELINE_MIN) {
        const med = baselineMedian(pts, pdsa);
        return step(8, 'Finalise the aim', `You have ${n} baseline points and a median of ${med === null ? 'see Data & SPC' : withUnit(med, (d.chartSettings || {}).unit || '')}. Replace "[to be measured]" with that figure, set a target you can defend and agree it with your sponsor.`, 'checklist', 'Finalise the aim', 'target');
    }
    if (!(Array.isArray(drivers.primary) && drivers.primary.length)) return step(9, 'Work out why it happens', 'Build a driver diagram with the team: what has to be true for the aim to be met, and which change ideas address each driver. The fishbone and 5 whys help if you are stuck.', 'tools', 'Open the diagnosis tools', 'git-branch');
    if (pdsa.length === 0) return step(10, 'Plan the first PDSA cycle', 'Pick one change idea and test it small: one shift, one desk, five patients. Write a prediction before you start, so the Study step has something to compare against.', 'pdsa', 'Plan the first cycle', 'refresh-cw', 'emerald');
    if (latestCycle && !String(latestCycle.prediction || '').trim()) return step(11, 'Write a prediction for the current cycle', `"${escapeHtml((latestCycle.title || 'The latest cycle').slice(0, 60))}" has no prediction. A prediction is a number and a reason: "screening on that desk will reach 50% because the prompt removes the need to remember". "It will improve" is not a prediction.`, 'pdsa', 'Add the prediction', 'refresh-cw');
    if (rotDays !== null && rotDays <= 56 && !String(c.sustainability || '').trim()) return step(12, rotDays < 0 ? 'Your rotation has ended: write the handover' : `Rotation ends in ${rotDays} days: plan the handover`, 'Write who owns each change after you leave, how the measure will keep being collected and who will see the run chart. Then export the handover note and give it to your sponsor and your successor.', 'checklist', 'Write the sustainability plan', 'rocket', 'rose');
    if (total >= QI.BASELINE_MIN && !String(c.results_analysis || '').trim()) return step(13, 'Interpret the run chart', 'Say what the chart shows, in words: the baseline median, whether there is a shift or trend, and which cycle it lines up with. "No change yet" is a valid interpretation and the templates on Data & SPC write it for you.', 'data', 'Interpret the chart', 'activity', 'blue');
    if (allAdopted) return step(14, 'Scale up what worked', 'Every cycle so far was adopted. The next cycle should test the same change at a bigger scale: more shifts, the whole week, a second area. Keep the measure running so the run chart shows whether the gain holds.', 'pdsa', 'Plan the next cycle', 'trending-up', 'emerald');
    if (latestCycle && !String(latestCycle.study || '').trim()) return step(15, 'Study the current cycle', `Compare what happened in "${escapeHtml((latestCycle.title || 'the latest cycle').slice(0, 60))}" with the prediction, then decide: adopt, adapt or abandon.`, 'pdsa', 'Complete the Study step', 'refresh-cw');
    return step(16, 'Keep the cycles going', 'Test, study, decide, repeat. When the run chart shows a sustained shift, move to sustainability and the EM QIAT sign-off. The Golden Thread Validator checks the story hangs together.', 'supervisor', 'Open the sign-off page', 'trophy', 'purple');
}

// ---------- Handover note ----------

function cyclesSummary(d) {
    const ideas = Array.isArray(d.changeIdeas) ? d.changeIdeas : [];
    const rows = [];
    ideas.forEach(ci => (ci.pdsaCycles || []).forEach(p => rows.push({ idea: ci.title || '', cycle: p.title || '', start: p.startDate || p.start || '', decision: p.actDecision || '', learning: p.study || '' })));
    return rows;
}

export function handoverNoteHtml(d) {
    const c = d.checklist || {};
    const meta = d.meta || {};
    const plan = d.dataPlan || {};
    const pts = primaryChartData(d).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const pdsa = Array.isArray(d.pdsa) ? d.pdsa : [];
    const baseline = chooseBaseline(pts, pdsa);
    const med = baselineMedian(pts, pdsa);
    const team = Array.isArray(d.teamMembers) ? d.teamMembers : [];
    const sponsor = team.find(m => /sponsor/i.test(m.role || '')) || null;
    const spread = c.spreadPlan || {};
    const text = (v) => v ? escapeHtml(String(v)) : '<span class="muted">Not recorded</span>';
    const section = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
    const box = (v) => `<div class="box">${text(v)}</div>`;
    const cycles = cyclesSummary(d);
    const last = pts.length ? pts[pts.length - 1] : null;
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title>Handover note</title>
<style>body{font-family:Arial,sans-serif;color:#1e293b;line-height:1.45;padding:32px;max-width:900px;margin:auto}h1{color:#2d2e83;margin:0 0 4px;font-size:24px}h2{color:#2d2e83;font-size:15px;margin:20px 0 6px}.sub{color:#64748b;font-size:13px;margin-bottom:16px}.box{background:#f8fafc;border:1px solid #cbd5e1;padding:10px;border-radius:4px;white-space:pre-wrap;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.muted{color:#94a3b8;font-style:italic}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}th{background:#eef2ff}.print{display:block;margin:20px auto;padding:10px 18px;background:#2d2e83;color:#fff;border:0;border-radius:4px;cursor:pointer}.todo{border-left:4px solid #f59e0b;background:#fffbeb;padding:10px;font-size:13px}@media print{body{padding:0}.print{display:none}section{break-inside:avoid}}</style></head><body>
<h1>Handover note: ${text(meta.title || 'Untitled QIP')}</h1>
<p class="sub">Prepared ${escapeHtml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}${meta.owner ? ' by ' + escapeHtml(meta.owner) : ''}${meta.rotationEnd ? ' · rotation ends ' + escapeHtml(formatDate(meta.rotationEnd)) : ''}</p>
<div class="todo"><strong>For whoever takes this on:</strong> keep collecting the measure exactly as the data plan says, keep the run chart visible to the team, and carry on the PDSA cycles from the "What next" section. The consultant sponsor is the person to ask.</div>
${section('Aim', box(c.aim))}
${section('The problem', box(c.problem_desc))}
<div class="grid">
${section('Consultant sponsor', box(sponsor ? `${sponsor.name}${sponsor.responsibilities ? ' — ' + sponsor.responsibilities : ''}` : (d.charter && d.charter.execSponsor) || ''))}
${section('Registration', box(c.ethics || ((c.hraChecklist || {}).q3 === 'yes' ? 'Registered (reference not recorded)' : '')))}
</div>
${section('Measures', `<div class="grid">${box('Outcome: ' + (c.outcome_measure || ''))}${box('Process: ' + (c.process_measure || ''))}${box('Balancing: ' + (c.balance_measure || ''))}${box('Operational definition: ' + (c.operational_definition || ''))}</div>`)}
${section('How the data are collected', box([plan.source && 'From: ' + plan.source, plan.collector && 'By: ' + plan.collector, plan.cadence && 'Every: ' + plan.cadence, plan.sample && 'Sample: ' + plan.sample, plan.start && 'Baseline from: ' + formatDate(plan.start)].filter(Boolean).join('\n')))}
${section('Where the data stand', box(pts.length ? `${pts.length} points on the primary measure, last one ${formatDate(last.date)} (${last.value}). Baseline: ${baseline.count} points${med !== null ? ', median ' + med : ''}. ${c.results_analysis ? '\n\nInterpretation: ' + c.results_analysis : ''}` : ''))}
${section('Changes tested', cycles.length ? `<table><tr><th>Change idea</th><th>Cycle</th><th>Started</th><th>Decision</th><th>What we learned</th></tr>${cycles.map(r => `<tr><td>${escapeHtml(r.idea)}</td><td>${escapeHtml(r.cycle)}</td><td>${escapeHtml(r.start ? formatDate(r.start) : '')}</td><td>${escapeHtml(r.decision)}</td><td>${escapeHtml(r.learning)}</td></tr>`).join('')}</table>` : box(''))}
${section('Who owns each change now', box(spread.maintenancePlan || c.sustainability))}
${section('What next', box([spread.spreadTimeline, spread.embeddingStrategy, c.next_pdp].filter(Boolean).join('\n\n')))}
${section('Team', team.length ? `<table><tr><th>Name</th><th>Role</th><th>Contribution</th></tr>${team.map(m => `<tr><td>${escapeHtml(m.name || '')}</td><td>${escapeHtml(m.role || '')}</td><td>${escapeHtml(m.responsibilities || '')}</td></tr>`).join('')}</table>` : box(''))}
<button class="print" onclick="window.print()">Print to PDF</button>
<script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
</body></html>`;
}

window.openHandoverNote = function () {
    const d = state.projectData;
    if (!d) return;
    const popup = window.open('', '_blank');
    if (!popup) { if (window.showToast) window.showToast('Allow pop-ups to open the handover note.', 'error'); return; }
    popup.document.write(handoverNoteHtml(d));
    popup.document.close();
};
