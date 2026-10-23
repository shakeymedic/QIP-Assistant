// step-helpers.js
// ─── One-tap starters for the pages that otherwise begin empty ───────────────
// Timeline: draft a plan backwards from the rotation end.
// Surveys: start from a question template.
// Team: common ED roles for the member modal.
// Stakeholders: the usual ED stakeholders.
// Action plan: one action per adopted change idea.
//
// Everything here only fills blanks and never overwrites what the trainee has
// written. Each helper saves and re-renders through the existing window hooks.

import { state } from "./state.js";
import { showToast, escapeHtml } from "./utils.js";
import { QI } from "./qi-constants.js";

// ─── Dates ───────────────────────────────────────────────────────────────────

function iso(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function parseIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function weeksBetween(a, b) { return Math.floor((b - a) / (7 * 24 * 3600 * 1000)); }

// ─── Timeline drafter ────────────────────────────────────────────────────────

// Lay out the standard shape of a trainee project between two dates:
// registration, baseline, diagnosis, as many PDSA cycles as fit, a results
// review and the handover. Returns the task list without saving it.
export function draftTimelineTasks(startIso, endIso) {
    const start = parseIso(startIso), end = parseIso(endIso);
    if (!start || !end || end <= start) return null;
    const totalWeeks = weeksBetween(start, end);
    if (totalWeeks < 8) return { tasks: [], totalWeeks, note: 'fewer than eight weeks' };

    const tasks = [];
    const stamp = Date.now().toString(36);
    let n = 0;
    const push = (name, from, to, type, milestone, owner) => {
        tasks.push({ id: `${stamp}${n++}`, name, start: iso(from), end: iso(to), type, owner: owner || '', milestone: !!milestone, dependency: '' });
    };

    // Fixed ends: handover (2 weeks) and a results review the week before it.
    const handoverStart = addDays(end, -14);
    const reviewDate = addDays(handoverStart, -7);

    // Fixed start: registration and scoping (2 weeks).
    const regEnd = addDays(start, 14);

    // What is left for baseline + cycles.
    const middleWeeks = weeksBetween(regEnd, reviewDate);
    let baselineWeeks = Math.min(QI.BASELINE_TARGET, Math.max(6, Math.floor(middleWeeks * 0.45)));
    let cycleWeeks = 4;
    let cycles = Math.floor((middleWeeks - baselineWeeks) / cycleWeeks);
    if (cycles < 2 && middleWeeks - baselineWeeks >= 6) { cycleWeeks = 3; cycles = Math.floor((middleWeeks - baselineWeeks) / cycleWeeks); }
    if (cycles < 1) { cycles = 1; cycleWeeks = Math.max(2, middleWeeks - baselineWeeks); }
    cycles = Math.min(cycles, 4);
    // Spare weeks go to the baseline first (up to the target), then to the last cycle.
    let spare = middleWeeks - baselineWeeks - cycles * cycleWeeks;
    const extraBaseline = Math.max(0, Math.min(spare, QI.BASELINE_TARGET - baselineWeeks));
    baselineWeeks += extraBaseline; spare -= extraBaseline;
    const lastCycleExtra = Math.max(0, spare);

    push('Register the project, agree the aim with the sponsor', start, regEnd, 'plan', false, 'You');
    const baselineEnd = addDays(regEnd, baselineWeeks * 7);
    push(`Baseline data collection (${baselineWeeks} weekly points)`, regEnd, baselineEnd, 'data', false, 'You');
    push('Process map and driver diagram with the team', addDays(regEnd, 7), addDays(regEnd, 28), 'plan', false, 'Team');
    push('Baseline complete: choose the first change', baselineEnd, baselineEnd, 'review', true, 'You and sponsor');

    let cursor = baselineEnd;
    for (let i = 1; i <= cycles; i++) {
        const cEnd = addDays(cursor, (cycleWeeks + (i === cycles ? lastCycleExtra : 0)) * 7);
        push(`PDSA ${i}: test, study, decide (adopt, adapt or abandon)`, cursor, cEnd, 'pdsa', false, 'Team');
        cursor = cEnd;
    }
    push('Results review at governance', reviewDate, reviewDate, 'review', true, 'You');
    push('Handover note, owner named, sustainability plan', handoverStart, end, 'sustain', false, 'You and sponsor');
    return { tasks, totalWeeks, baselineWeeks, cycles, cycleWeeks };
}

window.draftTimeline = function() {
    const d = state.projectData;
    if (!d || state.isReadOnly) return;
    const today = iso(new Date());
    const rotationEnd = d.meta?.rotationEnd || '';
    window.showInputModal(
        'Draft a timeline',
        [
            { id: 'start', label: 'Project start', type: 'date', required: true, value: today },
            { id: 'end', label: 'Rotation end (handover must be done by then)', type: 'date', required: true, value: rotationEnd }
        ],
        (data) => {
            const result = draftTimelineTasks(data.start, data.end);
            if (!result) { showToast('The end date must be after the start date', 'error'); return; }
            if (!result.tasks.length) { showToast(`Only ${result.totalWeeks} weeks: too short to plan a baseline and a test. Narrow the project or extend the end date.`, 'error'); return; }
            const apply = () => {
                if (!Array.isArray(d.gantt)) d.gantt = [];
                d.gantt.push(...result.tasks);
                if (!d.meta) d.meta = {};
                if (!d.meta.rotationEnd) d.meta.rotationEnd = data.end;
                if (window.saveData) window.saveData();
                if (window.renderGantt) window.renderGantt();
                showToast(`Drafted ${result.tasks.length} tasks: ${result.baselineWeeks}-week baseline and ${result.cycles} PDSA cycle${result.cycles > 1 ? 's' : ''} of ${result.cycleWeeks} weeks. Edit any of them.`, 'success');
            };
            if ((d.gantt || []).length) {
                window.showConfirmDialog(`Add ${result.tasks.length} drafted tasks alongside the ${d.gantt.length} already on the timeline?`, apply, 'Add tasks', 'Draft a timeline');
            } else apply();
        },
        'Draft'
    );
};

// ─── Survey templates ────────────────────────────────────────────────────────

export const SURVEY_TEMPLATES = {
    staffConfidence: {
        title: 'Staff confidence survey (before and after a change)',
        why: 'Run it before the first change and again after; the median confidence score is a useful process measure.',
        questions: ['Timestamp', 'Role (nurse, doctor, HCA, other)', 'Shift (day, night)', 'How confident are you finding the equipment you need for this pathway? (1 not at all – 5 very)', 'How confident are you following the pathway without asking for help? (1–5)', 'What most often gets in the way?', 'One change that would make this easier']
    },
    patientExperience: {
        title: 'Patient and carer experience (short)',
        why: 'Five questions, anonymous, no identifiers. Ask at discharge or by text link. Record what you changed in the PPI log.',
        questions: ['Timestamp', 'Roughly how long did you wait before someone explained what would happen next?', 'Did staff explain the treatment and why it was needed? (yes, partly, no)', 'Were you treated with dignity and respect? (1–5)', 'What was the best part of your care today?', 'What could we have done better?']
    },
    teachingPrePost: {
        title: 'Teaching session: before and after',
        why: 'Shows whether an education cycle changed knowledge or confidence on the day. It does not show whether practice changed; the run chart does that.',
        questions: ['Timestamp', 'Role', 'Before the session: confidence with this topic (1–5)', 'After the session: confidence with this topic (1–5)', 'One thing you will do differently on your next shift', 'What was missing from the session?']
    },
    stakeholderPulse: {
        title: 'Stakeholder pulse check',
        why: 'A quick read of awareness and support, useful before a governance presentation and for the EM QIAT team section.',
        questions: ['Timestamp', 'Role', 'Were you aware of this project before today? (yes, no)', 'Does it address a real problem on your shifts? (1 strongly disagree – 5 strongly agree)', 'What concerns do you have about the change?', 'What would make you more likely to support it?']
    }
};

window.addSurveyFromTemplate = function(key) {
    const t = SURVEY_TEMPLATES[key];
    const d = state.projectData;
    if (!t || !d || state.isReadOnly) return;
    if (!d.surveys) d.surveys = [];
    d.surveys.unshift({
        id: 'surv_' + Date.now().toString(36),
        title: t.title,
        questions: t.questions.slice(),
        responses: [],
        summary: ''
    });
    if (window.saveData) window.saveData();
    if (window.renderSurveys) window.renderSurveys();
    showToast('Survey created from the template; build it in Google Forms with these questions, then import the CSV', 'success');
};

export function surveyTemplateRowHtml() {
    return `
        <div class="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div class="flex items-start gap-2 mb-2">
                <i data-lucide="wand-2" class="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0"></i>
                <div>
                    <p class="text-sm font-bold text-violet-900">Start from a template</p>
                    <p class="text-xs text-violet-800/80 leading-relaxed">Creates a survey with the questions below so you can build it in Google Forms, then import the CSV. Keep it anonymous and never collect patient identifiers.</p>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${Object.entries(SURVEY_TEMPLATES).map(([k, t]) => `
                    <button type="button" onclick="window.addSurveyFromTemplate('${k}')" class="text-left bg-white border border-violet-200 hover:border-rcem-purple rounded-lg p-3 transition-all">
                        <div class="text-xs font-bold text-slate-800">${escapeHtml(t.title)}</div>
                        <div class="text-[11px] text-slate-500 mt-0.5 leading-snug">${escapeHtml(t.why)}</div>
                        <div class="text-[11px] text-violet-700 mt-1">${t.questions.length - 1} questions</div>
                    </button>`).join('')}
            </div>
        </div>`;
}

// ─── Team role presets ───────────────────────────────────────────────────────

export const TEAM_ROLES = [
    { key: 'sponsor', label: 'Consultant sponsor', role: 'Consultant sponsor', grade: 'ED consultant', resp: 'Agrees the aim, unblocks changes that need a consultant, keeps the project alive after the trainee rotates' },
    { key: 'lead', label: 'Project lead (you)', role: 'Project lead', grade: '', resp: 'Runs the PDSA cycles, collects and charts the data, reports to governance' },
    { key: 'nurse', label: 'Nurse lead', role: 'Nurse lead / champion', grade: 'Band 6–7', resp: 'Owns the change on the shop floor; designs and tests it with the nursing team' },
    { key: 'pharm', label: 'Pharmacist', role: 'ED pharmacist', grade: '', resp: 'Medicines governance, PGDs, order sets, stewardship' },
    { key: 'data', label: 'Data / EPR lead', role: 'Data and informatics', grade: '', resp: 'Builds the EPR report or prompt; extracts the weekly data' },
    { key: 'cotrainee', label: 'Co-trainee', role: 'Co-trainee', grade: '', resp: 'Shares data collection and cycles; takes over at handover' },
    { key: 'hca', label: 'HCA / support worker', role: 'Healthcare assistant', grade: '', resp: 'Keeps the kit stocked and tells the team what gets in the way' },
    { key: 'patient', label: 'Patient representative', role: 'Patient or carer representative', grade: '', resp: 'Reviews patient-facing changes and information; part of the PPI log' },
    { key: 'qi', label: 'Trust QI team', role: 'Trust improvement team contact', grade: '', resp: 'Registration, SPC support, help with spread' }
];

window.applyMemberRole = function(key) {
    const r = TEAM_ROLES.find(x => x.key === key);
    if (!r) return;
    const set = (id, val, force) => { const el = document.getElementById(id); if (el && (force || !el.value.trim())) el.value = val; };
    set('member-role', r.role, true);
    set('member-grade', r.grade, false);
    set('member-resp', r.resp, true);
    const nameEl = document.getElementById('member-name');
    if (nameEl && !nameEl.value.trim()) nameEl.focus();
};

// ─── Stakeholder starters ────────────────────────────────────────────────────

const ED_STAKEHOLDERS = [
    { name: 'ED nursing team', role: 'Deliver most changes on the shop floor', organisation: 'ED', x: 72, y: 22 },
    { name: 'ED clinical lead', role: 'Approves changes in the department', organisation: 'ED', x: 82, y: 68 },
    { name: 'ED matron', role: 'Nursing resources, rotas and training', organisation: 'ED', x: 60, y: 60 },
    { name: 'Junior doctors', role: 'Use the pathway; collect data', organisation: 'ED', x: 35, y: 25 },
    { name: 'Pharmacy', role: 'Medicines governance and stock', organisation: 'Trust', x: 55, y: 78 },
    { name: 'IT / EPR team', role: 'Prompts, order sets and reports', organisation: 'Trust', x: 30, y: 72 },
    { name: 'Trust QI and audit team', role: 'Registration, SPC help, spread', organisation: 'Trust', x: 22, y: 50 },
    { name: 'Patients and families', role: 'Receive the care; give feedback', organisation: 'Public', x: 15, y: 20 }
];

window.addStarterStakeholders = function() {
    const d = state.projectData;
    if (!d || state.isReadOnly) return;
    if (!Array.isArray(d.stakeholders)) d.stakeholders = [];
    const have = new Set(d.stakeholders.map(s => (s.name || '').trim().toLowerCase()));
    const add = ED_STAKEHOLDERS.filter(s => !have.has(s.name.toLowerCase()));
    if (!add.length) { showToast('The usual ED stakeholders are already on the map', 'info'); return; }
    window.showConfirmDialog(
        `Add ${add.length} common ED stakeholders to the map? Drag each one to where it really sits on influence and interest, rename them, and delete any that do not apply.`,
        () => {
            add.forEach(s => d.stakeholders.push({ ...s }));
            if (window.saveData) window.saveData();
            if (window.renderStakeholders) window.renderStakeholders();
            showToast(`${add.length} stakeholders added; now drag them into position`, 'success');
        },
        'Add them', 'Common ED stakeholders'
    );
};

// ─── Actions from change ideas ───────────────────────────────────────────────

window.addActionsFromChangeIdeas = function() {
    const d = state.projectData;
    if (!d || state.isReadOnly) return;
    if (!Array.isArray(d.actionPlan)) d.actionPlan = [];
    const ideas = (d.changeIdeas || []).filter(i => i && i.title && i.status !== 'abandoned');
    const linked = new Set(d.actionPlan.map(a => a.changeIdeaId).filter(Boolean));
    const todo = ideas.filter(i => !linked.has(i.id));
    if (!ideas.length) { showToast('No change ideas yet: add them on PDSA Cycles first', 'info'); return; }
    if (!todo.length) { showToast('Every change idea already has an action', 'info'); return; }
    todo.forEach(i => {
        const adopted = (i.pdsaCycles || []).some(c => (c.actDecision || '').toLowerCase() === 'adopted' || (c.actDecision || '').toLowerCase() === 'adopt');
        d.actionPlan.push({
            id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            objective: i.title,
            action: adopted ? `Embed "${i.title}" as standard work: owner, restock or review schedule, induction` : `Run the next PDSA cycle for "${i.title}"`,
            byWhom: '', byWhen: '', possibleIssues: i.description ? i.description.slice(0, 140) : '',
            status: 'not-started', changeIdeaId: i.id
        });
    });
    if (window.saveData) window.saveData();
    if (window.renderActionPlan) window.renderActionPlan();
    showToast(`${todo.length} action${todo.length > 1 ? 's' : ''} added from your change ideas; fill in who and by when`, 'success');
};
