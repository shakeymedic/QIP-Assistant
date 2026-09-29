// emqiat-shared.js
//
// Pure derivation helpers shared between:
//   - emqiat.js       (the in-app EM-QIAT form, used as placeholder/"suggested"
//                       text so a trainee sees a sensible starting point without
//                       it silently becoming their submitted answer)
//   - kaizen-export.js (the copy-paste export, which now PREFERS whatever the
//                       trainee actually typed into d.emqiat.* and only falls
//                       back to these derivations when a field is still empty)
//
// Keeping this logic in one place means the export and the in-app form can
// never drift apart the way the old invented tri-level checklist did from the
// real RCEM form.

export function deriveStageLabel(trainingStage) {
    if (trainingStage === 'higher') return 'ST6/ST7 (Higher Specialty Training) \u2014 confirm exact ST year';
    if (trainingStage === 'intermediate') return 'ST4/ST5 (Intermediate Training) \u2014 confirm exact ST year';
    return trainingStage || '';
}

export function deriveTeam(data) {
    const charter = data.charter || {};
    const team = (Array.isArray(charter.team) && charter.team.length) ? charter.team : (data.teamMembers || []);
    return team.map(m => `${m.name || ''}${m.role ? ' (' + m.role + ')' : ''}`).filter(Boolean).join(', ');
}

export function deriveRole(data) {
    const charter = data.charter || {};
    const team = (Array.isArray(charter.team) && charter.team.length) ? charter.team : (data.teamMembers || []);
    const leadEntry = team.find(m => /lead/i.test(m.role || '') && !/deputy|co-|assist/i.test(m.role || ''));
    return leadEntry ? 'Lead' : '';
}

export function deriveOverview(data) {
    const checklist = data.checklist || {};
    const charter = data.charter || {};
    const changeIdeas = Array.isArray(data.changeIdeas) ? data.changeIdeas : (data.drivers?.changes || []);
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];

    const measuresLines = [checklist.outcome_measure, checklist.process_measure, checklist.balance_measure]
        .filter(Boolean).join('\n\n');
    const interventionsSummary = changeIdeas.length
        ? changeIdeas.map((c, i) => `${i + 1}. ${typeof c === 'string' ? c : (c.title || c.description || '')}`).filter(l => l.length > 3).join('\n')
        : (pdsa.length ? pdsa.map((p, i) => `Cycle ${i + 1}: ${p.title || ''}`).join('\n') : '');

    return {
        background: checklist.problem_desc || '',
        aim: charter.aim || checklist.aim || '',
        understandingProblem: checklist.problem_evidence || checklist.problem_context || '',
        measures: measuresLines,
        interventions: interventionsSummary,
        results: checklist.results_analysis || checklist.results_text || '',
        nextSteps: checklist.next_pdp || checklist.sustainability || ''
    };
}

export function deriveSharingResults(data) {
    // Pull out just the dissemination-relevant sentence(s) from the
    // sustainability plan rather than dumping the whole plan (which also
    // covers unrelated governance-handover / induction-embedding content
    // that does not answer "how and when were results shared").
    const checklist = data.checklist || {};
    const sustainability = checklist.sustainability || '';
    if (!sustainability) return '';
    const lines = sustainability.split(/\n+/).filter(Boolean);
    const disseminationLines = lines.filter(l => /disseminat|consultant meeting|governance meeting|present|spread|submission|network|publicat/i.test(l));
    return disseminationLines.length ? disseminationLines.join('\n') : '';
}

export function deriveReflections(data) {
    return (data.checklist || {}).learning_points || '';
}

export function deriveNextYearPdp(data) {
    return (data.checklist || {}).next_pdp || '';
}

// ---------------------------------------------------------------------------
// The app already had a separate, richer "EM-QIAT Journal" modal (see
// window.showEMQIATModal in app.js) storing PDP goals/review, a structured QI
// education log, and a CCT summary under data.emqiat.* (a DIFFERENT object to
// data.emqiatForm.* used by the newer inline form below — the two were kept
// on separate keys specifically to avoid collisions). Where that existing
// data is more specific/structured than anything we could derive ourselves,
// prefer it as the suggestion source instead of a generic placeholder.
// ---------------------------------------------------------------------------

export function derivePdpFromJournal(data) {
    return (data.emqiat || {}).pdpGoals || '';
}

export function deriveEducationInvolvementFromJournal(data) {
    const log = (data.emqiat || {}).educationLog;
    if (!Array.isArray(log) || log.length === 0) return '';
    return log.map(entry => {
        const parts = [entry.type, entry.provider, entry.date ? `(${entry.date})` : '', entry.hours ? `${entry.hours}h` : ''].filter(Boolean);
        const line = parts.join(' — ');
        return entry.reflection ? `${line}: ${entry.reflection}` : line;
    }).filter(Boolean).join('\n');
}

export function deriveEndOfTrainingFromJournal(data) {
    return (data.emqiat || {}).cctSummary || '';
}

export function hasAnyProjectData(data) {
    const checklist = data.checklist || {};
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];
    const changeIdeas = Array.isArray(data.changeIdeas) ? data.changeIdeas : [];
    return !!(checklist.problem_desc || pdsa.length || changeIdeas.length);
}

import { chooseBaseline, median, runChartSignals, primaryChartData } from "./project-metrics.js";

// ---------------------------------------------------------------------------
// The live form's wording (risr/advance "EM QIAT (2025 Update)"), kept in one
// place so the in-app form, the export and the checker all say exactly what
// the real form says.
// ---------------------------------------------------------------------------

export const EMQIAT_INTRO = 'This form is used to summarise all your QI activity in your current year of training. It should be completed prior to ARCP and sent to an appropriate supervisor/assessor for review';
export const EMQIAT_NA_NOTE = 'Where a section is not applicable, please add N/A.';
export const QI_JOURNEY_URL = 'https://learn.nes.nhs.scot/4095/quality-improvement-zone/quality-improvement-journey';

export const EMQIAT_PROMPTS = {
    pdp: { num: '1.1', label: 'PDP', prompt: 'Please summarise your QI PDP for this year in broad terms and list specific objectives below.' },
    qiEducationInvolvement: { num: '2.1', label: 'Involvement', prompt: 'Please describe your engagement with QI education over the past year. This can include online learning or attendance at local/national courses.' },
    qiEducationLearning: { num: '2.2', label: 'Learning', prompt: 'How has this developed your understanding of QI? How do you feel this will help your future QI work? Please map to the QI journey in section 4.1 where relevant.', hint: 'Separate reflections can also be uploaded to risr/advance and then linked to SLO 11.' },
    involvedInProject: { num: '3.0', label: 'Were you involved in a QI project in any way?', prompt: '' },
    overview: { num: '3.1', label: 'Project Overview', prompt: 'Please provide an overview of any QI-related project you have been involved with during this training year.' },
    role: { num: '3.2', label: 'Your Role in the Project', prompt: 'Please describe your personal involvement with the project and relate to the QI journey. If you did not lead on the project, what role did you have?' },
    tools: { num: '3.2.1', label: 'Please attach any QI tools you may have used.', prompt: '' },
    teamStakeholders: { num: '3.3', label: 'Team working and Stakeholders', prompt: 'Please describe the teamworking aspects of the project(s) you have been involved in and how you engaged with stakeholders.' },
    sharingResults: { num: '3.4', label: 'Sharing of results', prompt: 'Did you have the opportunity to share your work with a wider audience? Please share details linking in any posters or presentations.' },
    poster: { num: '3.5', label: 'Poster or Presentation File upload', prompt: '' },
    qiJourney: { num: '4.1', label: 'The QI Journey', prompt: 'In which aspect(s) of the QI Journey did you feel you gained experience this year?' },
    reflections: { num: '4.2', label: 'Reflections and Learning', prompt: 'Please outline what this year has contributed to your development and knowledge of QI.' },
    nextYearPdp: { num: '4.3', label: 'Next Year’s PDP', prompt: 'Please describe your plans for next year in QI.' },
    endOfTrainingJourney: { num: '4.4', label: 'End of training - QI development journey', prompt: 'Please provide a summary of your development journey in QI and leadership throughout your EM training, with references to specific examples. How will you apply your development in QI as an EM consultant?' }
};

export const QI_JOURNEY_ITEMS = [
    ['creatingConditions', 'Creating Conditions'],
    ['understandingSystems', 'Understanding Systems'],
    ['developingAims', 'Developing Aims'],
    ['testingChanges', 'Testing Changes'],
    ['implement', 'Implement'],
    ['spread', 'Spread'],
    ['leadershipTeams', 'Leadership & Teams'],
    ['projectManagementCommunication', 'Project Management & Communication'],
    ['measurement', 'Measurement']
];

export const CURRICULUM_HEADING = '2021 EM Curriculum (2025 Update)';
export const CURRICULUM_NOTE = 'Should you want to link to the curriculum, please expand the relevant Curriculum LO/SLO, and select the appropriate Key Capabilities only.';
export const CURRICULUM_KCS = [
    ['higherSlo11Kc1', 'Higher SLO11 Key Capability 1: be able to provide clinical leadership on effective Quality Improvement work (2025 Update)'],
    ['higherSlo11Kc2', 'Higher SLO11 Key Capability 2: be able to support and develop a culture of departmental safety and good clinical governance (2025 Update)']
];

export const OVERVIEW_PARTS = [
    ['background', 'Background'],
    ['aim', 'Aim'],
    ['understandingProblem', 'Understanding the Problem'],
    ['measures', 'Measures'],
    ['interventions', 'Interventions'],
    ['results', 'Results'],
    ['nextSteps', 'Next Steps']
];

// ── Richer, factual drafts for the fields trainees most often leave thin ─────

function teamList(data) {
    const charter = data.charter || {};
    return (Array.isArray(charter.team) && charter.team.length) ? charter.team : (data.teamMembers || []);
}

function cycleTitle(p, i) {
    return (p && p.title ? String(p.title) : `Cycle ${i + 1}`).trim();
}

// Which QI Journey stages the project itself shows evidence of.
export function deriveJourneyFromProject(data) {
    const c = data.checklist || {};
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];
    const team = teamList(data);
    const drivers = data.drivers || {};
    const logs = data.leadershipLogs || [];
    const measures = Array.isArray(data.measures) && data.measures.length ? data.measures : [{ chartData: data.chartData || [] }];
    const points = measures.reduce((n, m) => n + (Array.isArray(m.chartData) ? m.chartData.length : 0), 0);
    return {
        creatingConditions: (data.stakeholders || []).length > 0 || logs.length > 0 || team.length > 1,
        understandingSystems: !!(data.fishbone?.categories?.some(cat => (cat.causes || []).length) || (drivers.primary || []).length || (Array.isArray(data.process) && data.process.length > 2) || c.problem_evidence),
        developingAims: !!c.aim,
        testingChanges: pdsa.length > 0,
        implement: pdsa.some(p => p && (p.status === 'complete' || /adopt/i.test(p.act || ''))),
        spread: /spread|other (site|department|trust|hospital)|region|network|roll/i.test([c.sustainability, c.spreadPlan?.whoAdopts, c.spreadPlan?.maintenancePlan].filter(Boolean).join(' ')),
        leadershipTeams: logs.length >= 1 || team.some(m => /lead/i.test(m.role || '')),
        projectManagementCommunication: (data.gantt || []).length > 0 || logs.length >= 2,
        measurement: points >= 10
    };
}

// 3.2: a factual draft built only from what the project records, laid out
// against the QI Journey, ending with the parts only the trainee can write.
export function deriveRoleNarrative(data) {
    const c = data.checklist || {};
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];
    const team = teamList(data);
    const stakeholders = data.stakeholders || [];
    const logs = data.leadershipLogs || [];
    const lines = [];
    const lead = deriveRole(data);
    if (lead) lines.push('I was the project lead.');
    if (team.length > 1 || stakeholders.length) {
        lines.push(`Creating Conditions: I brought together a team of ${team.length} (${team.map(m => m.role || m.name).filter(Boolean).slice(0, 6).join(', ')})${stakeholders.length ? ` and mapped ${stakeholders.length} stakeholder groups by influence and interest` : ''}.`);
    }
    const sys = [];
    if (data.fishbone?.categories?.some(cat => (cat.causes || []).length)) sys.push('a fishbone diagram');
    if ((data.drivers?.primary || []).length) sys.push('a driver diagram');
    if (Array.isArray(data.process) && data.process.length > 2) sys.push('a process map');
    if (sys.length) lines.push(`Understanding Systems: I used ${sys.join(', ')} to understand the causes of the problem.`);
    if (c.aim) lines.push(`Developing Aims: I set the aim — "${String(c.aim).trim().replace(/\s+/g, ' ')}"`);
    if (pdsa.length) lines.push(`Testing Changes: I led ${pdsa.length} PDSA cycle${pdsa.length !== 1 ? 's' : ''}: ${pdsa.map(cycleTitle).join('; ')}.`);
    const points = (Array.isArray(data.measures) && data.measures[0]?.chartData ? data.measures[0].chartData : data.chartData || []).length;
    if (points) lines.push(`Measurement: I collected ${points} data points and analysed them on a run chart.`);
    if (logs.length) lines.push(`Leadership & Teams: I recorded ${logs.length} leadership interactions, including: ${logs.slice(0, 3).map(l => l.note).filter(Boolean).join('; ')}.`);
    if (!lines.length) return '';
    lines.push('[In your own words: what you personally did at each stage, a challenge you had to lead the team through, and how you handled it.]');
    return lines.join('\n');
}

// 3.3: team roles, stakeholder groups and the engagement actually logged.
export function deriveTeamNarrative(data) {
    const team = teamList(data);
    const stakeholders = data.stakeholders || [];
    const logs = data.leadershipLogs || [];
    const lines = [];
    if (team.length) lines.push(`Core team: ${team.map(m => `${m.name || ''}${m.role ? ' (' + m.role + ')' : ''}`.trim()).filter(Boolean).join(', ')}.`);
    if (stakeholders.length) lines.push(`Stakeholders engaged: ${stakeholders.map(s => `${s.name || s}${s.role ? ' — ' + s.role : ''}`).join(', ')}.`);
    if (logs.length) lines.push(`How I engaged them:\n${logs.map(l => `• ${l.date ? l.date + ': ' : ''}${l.note || ''}`).join('\n')}`);
    if (!lines.length) return '';
    lines.push('[Add: how you worked as a team (meetings, roles, delegation), any resistance or conflict and how you resolved it.]');
    return lines.join('\n');
}

// ── Excellence checker ───────────────────────────────────────────────────────
// Checks each answer against what the question asks for and the features an
// assessor looks for in a strong answer. These are heuristics built from the
// form's own questions: they can't read quality, and the grade is always the
// assessor's decision.

const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const itemCount = (t) => String(t || '').split(/\n+|;|(?:^|\s)(?:\d+[.)]|[-•*])\s/).map(s => s.trim()).filter(s => s.length > 8).length;
const has = (t, re) => re.test(String(t || ''));
const isNA = (t) => /^\s*n\/?a\b/i.test(String(t || ''));

export function isFinalYear(data) {
    const e = data.emqiatForm || {};
    const stage = `${e.stageOfTraining || ''} ${data.meta?.trainingStage || ''}`;
    return /\b(st6|st7|cct|final)\b/i.test(stage) || /\bcct\b/i.test(e.nextYearPdp || '');
}

const CHALLENGE_RE = /\b(challeng|barrier|resist|conflict|difficult|problem|hardest|concern|stall|obstacle|setback|push-?back|struggl|constrain)\w*/i;
// Words that show each QI Journey stage was actually done.
const JOURNEY_EVIDENCE = {
    creatingConditions: /creating conditions|sponsor|support|buy-in|engag|vision|shared purpose/i,
    understandingSystems: /understanding systems|process map|fishbone|root cause|driver diagram|survey|baseline/i,
    developingAims: /\baims?\b|smart/i,
    testingChanges: /pdsa|test|cycle/i,
    implement: /implement|adopt|embed|business as usual|standard/i,
    spread: /spread|another (hospital|site|department)|neighbouring|rolled out|adopted/i,
    leadershipTeams: /\blead|\bled\b|leader|delegat|team/i,
    projectManagementCommunication: /project manag|communicat|timeline|gantt|action log|update|meeting/i,
    measurement: /measure|run chart|data|median|spc/i
};

// Bracketed prompts like "[add the date]" are reminders, not answers.
const stripPrompts = (t) => String(t || '').replace(/\[[^\]]*\]/g, ' ').trim();
const hasPrompts = (t) => /\[[^\]]+\]/.test(String(t || ''));

export function assessEmqiat(data) {
    const raw = data.emqiatForm || {};
    const e = {};
    Object.keys(raw).forEach(k => { e[k] = typeof raw[k] === 'string' ? stripPrompts(raw[k]) : raw[k]; });
    e.overview = {};
    Object.keys(raw.overview || {}).forEach(k => { e.overview[k] = stripPrompts(raw.overview[k]); });
    const ov = e.overview;
    const c = data.checklist || {};
    const pdsa = Array.isArray(data.pdsa) ? data.pdsa : [];
    const journey = e.qiJourney || {};
    const ticked = QI_JOURNEY_ITEMS.filter(([k]) => journey[k]).map(([, l]) => l);
    const higher = data.meta?.trainingStage === 'higher' || /st[4-7]|higher/i.test(e.stageOfTraining || '');
    const finalYear = isFinalYear(data);
    const items = [];
    const add = (key, num, title, checks, extra = {}) => {
        const rawText = key === 'overview' ? Object.values(raw.overview || {}).join(' ') : raw[key];
        if (typeof rawText === 'string' && hasPrompts(rawText)) checks = [...checks, { ok: false, text: 'Fill in or delete the [bracketed] reminders' }];
        const passed = checks.filter(ch => ch.ok).length;
        const empty = extra.empty === true;
        const status = empty ? 'missing' : passed === checks.length ? 'strong' : passed >= Math.ceil(checks.length / 2) ? 'ok' : 'weak';
        items.push({ key, num, title, status, checks, ...extra });
    };

    add('header', '', 'Stage, placement and date', [
        { ok: !!e.stageOfTraining, text: 'Stage of training filled in (e.g. ST6)' },
        { ok: !!e.placement, text: 'Placement named (e.g. "ST6 year at <hospital>")' },
        { ok: !!e.dateOfCompletion, text: 'Date of completion set' }
    ], { empty: !e.stageOfTraining && !e.placement && !e.dateOfCompletion });

    add('pdp', '1.1', 'QI PDP for this year', [
        { ok: words(e.pdp) >= 30, text: 'A broad summary of your QI goals this year (at least a few sentences)' },
        { ok: itemCount(e.pdp) >= 3, text: 'At least 3 specific objectives listed (one per line)' },
        { ok: has(e.pdp, /\b(lead|led|present|poster|pdsa|course|teach|run chart|spread|publish)\w*/i), text: 'Objectives are concrete and checkable (e.g. "lead a QIP through 3+ PDSA cycles", "present at a regional meeting")' }
    ], { empty: !e.pdp });

    add('qiEducationInvolvement', '2.1', 'QI education', [
        { ok: itemCount(e.qiEducationInvolvement) >= 3 || (data.emqiat?.educationLog || []).length >= 3, text: 'At least 3 separate learning activities listed' },
        { ok: has(e.qiEducationInvolvement, /IHI|Open School|Making Data Count|NHS (England|Improvement|Elect)|RCEM|FutureLearn|Q community|Health Foundation|course|module|webinar|conference|teaching session/i), text: 'Named courses or resources (e.g. IHI Open School modules, NHS England "Making Data Count", RCEM QI guide, local QI training)' },
        { ok: has(e.qiEducationInvolvement, /\b(learn|learnt|learned|applied|used this|helped me|taught me|so that)\b/i), text: 'Says what you learned from them or how you applied it to your project' }
    ], { empty: !e.qiEducationInvolvement });

    add('qiEducationLearning', '2.2', 'What QI education taught you', [
        { ok: words(e.qiEducationLearning) >= 60, text: 'A real reflection, not a line (aim for 60+ words)' },
        { ok: QI_JOURNEY_ITEMS.filter(([, l]) => has(e.qiEducationLearning, new RegExp(l.split(' ')[0].replace('&', ''), 'i'))).length >= 2, text: 'Maps your learning to QI Journey stages by name (e.g. Measurement, Testing Changes)' },
        { ok: has(e.qiEducationLearning, /\b(future|next|will|going forward|consultant)\b/i), text: 'Says how it will help your future QI work' }
    ], { empty: !e.qiEducationLearning });

    add('involvedInProject', '3.0', 'Involved in a QI project', [
        { ok: e.involvedInProject === 'yes', text: 'Answered "Yes" (if you led a project)' }
    ], { empty: !e.involvedInProject });

    const ovText = OVERVIEW_PARTS.map(([k]) => ov[k] || '').join(' ');
    add('overview', '3.1', 'Project overview', [
        { ok: OVERVIEW_PARTS.every(([k]) => (ov[k] || '').trim()), text: 'Every part filled in: background, aim, understanding the problem, measures, interventions, results, next steps' },
        { ok: has(ov.aim, /\d/) && has(ov.aim, /\b(by|within|month|week|20\d\d)\b/i), text: 'Aim is SMART: has a number and a date' },
        { ok: has(ov.measures, /outcome/i) && has(ov.measures, /process/i) && has(ov.measures, /balanc/i), text: 'Family of measures: outcome, process and balancing' },
        { ok: has(ov.interventions, /pdsa|cycle/i) || pdsa.length >= 2, text: 'Interventions tested in PDSA cycles (2 or more)' },
        { ok: has(ov.results, /\d/) && has(ov.results, /median|run chart|shift|trend|spc|baseline/i), text: 'Results quote numbers and interpret the run chart (baseline median, shift/trend)' }
    ], { empty: !ovText.trim() });

    add('role', '3.2', 'Your role, related to the QI Journey', [
        { ok: words(e.role) >= 80, text: 'A proper description, not a one-word answer (aim for 150–250 words)' },
        { ok: QI_JOURNEY_ITEMS.filter(([, l]) => has(e.role, new RegExp(l.split(' ')[0].replace('&', ''), 'i'))).length >= 3, text: 'Relates your role to at least 3 QI Journey stages by name (e.g. Understanding Systems, Testing Changes, Spread)' },
        { ok: !higher || has(e.role, /\b(led|lead|chaired|delegated|negotiat|persuad|motivat|coordinat|facilitat)\w*/i), text: higher ? 'Shows leadership, not just participation (led, chaired, negotiated, delegated)' : 'Describes your personal contribution' },
        { ok: has(e.role, CHALLENGE_RE), text: 'Describes a challenge you handled' }
    ], { empty: !e.role });

    add('teamStakeholders', '3.3', 'Team working and stakeholders', [
        { ok: words(e.teamStakeholders) >= 60, text: 'More than a list — describes how you worked together (aim for 100+ words)' },
        { ok: (String(e.teamStakeholders || '').match(/consultant|nurs|sister|matron|hca|sho|registrar|pharm|manager|porter|it\b|lead|staff|team|edp|acp|physician associate|housekeep/gi) || []).length >= 3, text: 'Names at least 3 different staff groups or roles' },
        { ok: has(e.teamStakeholders, /\b(meeting|email|survey|feedback|huddle|engag|consult|present|brief|stakeholder map|newsletter|whatsapp|teams)\w*/i), text: 'Says how you engaged stakeholders (meetings, feedback, surveys, briefings)' },
        { ok: has(e.teamStakeholders, /\b(resist|concern|conflict|buy-in|won over|persuad|negotiat|barrier)\w*/i), text: 'Shows how you handled resistance or gained buy-in' }
    ], { empty: !e.teamStakeholders });

    add('sharingResults', '3.4', 'Sharing of results', [
        { ok: words(e.sharingResults) >= 20, text: 'Details, not just a venue name (what you presented, to whom, when)' },
        { ok: has(e.sharingResults, /\b(20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*/i), text: 'Includes dates' },
        { ok: has(e.sharingResults, /\b(regional|national|conference|poster|abstract|trust|governance|board|network|rcem|published|newsletter|other (site|hospital|department))\b/i), text: 'Shared beyond your own department (governance, trust-wide, regional or national, poster)' }
    ], { empty: !e.sharingResults });

    add('qiJourney', '4.1', 'The QI Journey', [
        { ok: ticked.length >= 6, text: `Several stages ticked (${ticked.length} of 9) — tick every one you genuinely have evidence for` },
        { ok: ticked.length > 0 && QI_JOURNEY_ITEMS.filter(([k]) => journey[k]).every(([k]) => JOURNEY_EVIDENCE[k].test(`${e.role || ''} ${e.teamStakeholders || ''} ${e.reflections || ''} ${e.sharingResults || ''} ${ovText}`)), text: 'Each ticked stage is backed up somewhere in your written answers (3.2 and 4.2 are the best places)' }
    ], { empty: ticked.length === 0 });

    add('reflections', '4.2', 'Reflections and learning', [
        { ok: words(e.reflections) >= 100, text: 'A developed reflection (aim for 150–300 words)' },
        { ok: has(e.reflections, /\b(learn|learnt|learned|realis|understand|taught me)\w*/i), text: 'States what you learned about QI' },
        { ok: has(e.reflections, /\b(differently|next time|would|in future|if i were)\b/i), text: 'Says what you would do differently next time' },
        { ok: has(e.reflections, CHALLENGE_RE), text: 'Describes a challenge and how you worked through it (e.g. cost-neutral constraints, staffing)' }
    ], { empty: !e.reflections });

    add('nextYearPdp', '4.3', 'Next year’s PDP', finalYear ? [
        { ok: words(e.nextYearPdp) >= 30, text: 'If you CCT this year, say so — and still set out your QI plans as a new consultant (don’t just write N/A)' },
        { ok: has(e.nextYearPdp, /\b(consultant|supervis|sustain|spread|hand ?over|mentor|lead)\w*/i), text: 'Covers sustaining/handing over this project and your QI role as a consultant' }
    ] : [
        { ok: words(e.nextYearPdp) >= 30, text: 'Specific plans, not a single line' },
        { ok: itemCount(e.nextYearPdp) >= 2, text: 'At least 2 concrete objectives for next year' }
    ], { empty: !e.nextYearPdp || (isNA(e.nextYearPdp) && words(e.nextYearPdp) < 5) });

    add('endOfTrainingJourney', '4.4', 'End of training — QI journey', finalYear ? [
        { ok: words(e.endOfTrainingJourney) >= 150, text: 'A full summary across your whole EM training (aim for 250–400 words)' },
        { ok: has(e.endOfTrainingJourney, /\b(st[1-7]|accs|core|intermediate|f[12]|earlier|previous|first year|foundation)\b/i), text: 'Specific examples from earlier training years, not just this project' },
        { ok: has(e.endOfTrainingJourney, /\bconsultant\b/i), text: 'Answers "How will you apply this as an EM consultant?"' },
        { ok: has(e.endOfTrainingJourney, /\b(leader|leading|led|lead)\w*/i), text: 'Covers leadership as well as QI methods' }
    ] : [
        { ok: true, text: 'Only needed at the end of training — write N/A if this is not your final year' }
    ], { empty: finalYear && !e.endOfTrainingJourney, optional: !finalYear });

    const cur = e.curriculum || {};
    add('curriculum', '', 'Curriculum link', [
        { ok: !higher || !!cur.higherSlo11Kc1, text: 'Higher SLO11 Key Capability 1 selected (clinical leadership on effective QI work)' },
        { ok: !higher || !!cur.higherSlo11Kc2 || !has(`${e.reflections || ''} ${e.role || ''} ${ovText}`, /safety|governance|incident|risk/i), text: 'Key Capability 2 selected if your project touches departmental safety or governance' }
    ], { empty: higher && !cur.higherSlo11Kc1 && !cur.higherSlo11Kc2 });

    // Project evidence behind the answers — fixed elsewhere in the app.
    const pts = (Array.isArray(data.measures) && data.measures[0]?.chartData ? data.measures[0].chartData : data.chartData || []).length;
    add('project', '', 'Project evidence behind your answers', [
        { ok: !!c.aim_target, text: 'Numeric target set for your aim (Define & Measure)', view: 'checklist' },
        { ok: !!(c.outcome_measure && c.process_measure && c.balance_measure), text: 'Outcome, process and balancing measures defined (Define & Measure)', view: 'checklist' },
        { ok: pts >= 12, text: `12+ data points on your run chart (you have ${pts})`, view: 'data' },
        { ok: pdsa.length >= 3, text: `3+ PDSA cycles (you have ${pdsa.length})`, view: 'pdsa' },
        { ok: pdsa.length > 0 && pdsa.every(p => has(`${p.plan || ''} ${p.desc || ''} ${p.prediction || ''}`, /predict/i) && (p.study || '').trim()), text: 'Every PDSA cycle has a prediction and a Study write-up', view: 'pdsa' },
        { ok: (data.stakeholders || []).length >= 3, text: 'Stakeholder map with 3+ groups', view: 'stakeholders' },
        { ok: !!(c.sustainability && c.learning_points), text: 'Sustainability plan and learning points written', view: 'checklist' }
    ]);

    const scored = items.filter(i => !i.optional);
    const strong = scored.filter(i => i.status === 'strong').length;
    return { items, strong, total: scored.length, finalYear, higher, rcem: rcemDescriptors(data, { higher, ovText, ticked }) };
}

// ── RCEM grade descriptors ───────────────────────────────────────────────────
// Descriptors RCEM gives for grading a Higher-training QIAT (satisfactory/good
// vs excellent), from its QIAT how-to guide and 2025 SLO11 guidance. Each is
// matched against the trainee's written answers and, where possible, the
// project's own data. A match means the evidence is written down, not that
// the assessor will agree it meets the standard.
export const RCEM_SOURCES = [
    ['RCEM: SLO 11 \u2013 Quality Improvement Guidance and QIAT Support (Nov 2025)', 'https://rcem.ac.uk/wp-content/uploads/2025/11/SLO11-Participate-in-and-promote-activity-to-improve-the-quality-and-safety-of-patient-care.pdf'],
    ['RCEM: The QI Assessment \u2013 A How-To Guide (v4, 2022)', 'https://rcemcurriculum.co.uk/wp-content/uploads/2022/09/Generic-QIAT-How-to-Guide-v4.pdf'],
    ['RCEM Quality Improvement Guide (2022)', 'https://rcem.ac.uk/wp-content/uploads/2022/09/RCEM_Quality_Improvement_Guide_2022_v4.pdf'],
    ['NES Quality Improvement Journey', QI_JOURNEY_URL]
];

function projectShowsImprovement(data) {
    const pts = [...primaryChartData(data)]
        .filter(p => p && p.date && !isNaN(Number(p.value)))
        .map(p => ({ ...p, value: Number(p.value) }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (pts.length < 10) return false;
    const med = median(chooseBaseline(pts, data.pdsa).values);
    const sig = runChartSignals(pts.map(p => p.value), med);
    return sig.shift || sig.trend;
}

function rcemDescriptors(data, ctx) {
    const src = data.emqiatForm || {};
    const e = {};
    Object.keys(src).forEach(k => { e[k] = typeof src[k] === 'string' ? stripPrompts(src[k]) : src[k]; });
    const all = [e.role, e.teamStakeholders, e.sharingResults, e.reflections, e.endOfTrainingJourney, ctx.ovText].join(' ');
    const t = (v, re) => re.test(String(v || ''));
    const staffGroups = (String(e.teamStakeholders || '').match(/consultant|nurs|sister|matron|hca|sho|registrar|pharm|manager|porter|\bit\b|staff|edp|acp|physician associate|housekeep|paramedic|radiograph|lab/gi) || []).length;

    if (!ctx.higher) {
        return {
            stage: 'other',
            satisfactory: [
                { ok: e.involvedInProject === 'yes' || words(e.qiEducationInvolvement) >= 30, text: 'Participation in QI activity this year', quote: 'ACCS: records participation in QI activity' },
                { ok: words(e.reflections) >= 80 && t(e.reflections, /learn|realis|understand/i), text: 'Basic understanding of key QI principles, with reflection', quote: 'a basic understanding of key QI principles, reflection' },
                { ok: staffGroups >= 2, text: 'Appreciation of the team-based nature of QI', quote: 'appreciation of the team-based nature of QI work' },
                { ok: t(ctx.ovText, /median|run chart|data|baseline/i) && t(ctx.ovText, /result|improv|change/i), text: 'Intermediate: data analysis and an evaluation of change', quote: 'Intermediate: a project requiring data analysis and an evaluation of change' }
            ],
            excellent: []
        };
    }

    return {
        stage: 'higher',
        satisfactory: [
            { ok: e.involvedInProject === 'yes' && t(e.role, /\b(led|lead|leading|chaired|project lead)\b/i), text: 'A QI project you led (to be completed by the end of training)', quote: 'a project that the trainee has led on, with completion of the project by the end of training' },
            { ok: words(e.reflections) >= 120 && t(e.reflections, /learn|realis|understand|taught me/i) && t(e.reflections, /differently|next time|would|in future/i), text: 'Mature reflection on the experience and conduct of the project (4.2)', quote: 'mature reflection on the experience and conduct of the project' },
            { ok: staffGroups >= 3, text: 'Evidence of multi-disciplinary working (3.3)', quote: 'evidence of multi-disciplinary working' },
            { ok: QI_JOURNEY_ITEMS.filter(([, l]) => t(e.role, new RegExp(l.split(' ')[0].replace('&', ''), 'i'))).length >= 3 && t(e.role, /\b(led|lead|chaired|delegated|negotiat|persuad|motivat|coordinat|facilitat)\w*/i), text: 'An account of the QI methods used and leadership skills deployed (3.2)', quote: 'satisfactory account of the QI methods used and leadership skills deployed' },
            { ok: t(e.teamStakeholders, /engag|meeting|consult|feedback|survey|brief/i) && (ctx.ticked.includes('Implement') || t(ctx.ovText, /implement|embedded|adopted|standard/i)) && t(ctx.ovText, /median|run chart|data|monitor/i), text: 'Stakeholder engagement, implementation of change and monitoring of impact', quote: 'a quality improvement project, including engagement with stakeholders, implementation of change and monitoring of impact' }
        ],
        excellent: [
            { ok: t(e.sharingResults, /\b(regional|national|conference|rcem|international|poster|abstract|published|publication)\b/i), text: 'Presented at a regional or national meeting (3.4 and upload at 3.5)', quote: 'presentation of QI project at regional or national meeting' },
            { ok: projectShowsImprovement(data) && t(ctx.ovText, /\d/), text: 'Significant improvement in clinical care, shown on your run chart (a shift or trend) and quoted with numbers in 3.1', quote: 'high quality QI project leading to significant improvement in clinical care' },
            { ok: t(all, /\b(innovat|novel|first time|new approach|persever|persist|despite|overcame|won over)\w*/i) && t(all, /\b(led|lead|chaired|motivat|delegat)\w*/i), text: 'Evidence of innovation, QI team leadership or perseverance in making change (3.2, 4.2)', quote: 'evidence of innovation/QI team leadership/perseverance in making change' },
            { ok: t(all, /\b(another|other|second|neighbouring|sister) (hospital|site|trust|department|ed|area|project)|spread (to|across)|rolled out|adopted (by|at|in)|more than one (project|setting)\b/i), text: 'Learning taken to more than one project or setting, e.g. spread to another department or hospital', quote: 'presentation of the findings and actions from more than one project or in more than one setting; translation of findings and learning into another area of practice or another hospital' }
        ]
    };
}

// ── Worked example ───────────────────────────────────────────────────────────
// A fictional Higher-trainee QIAT (sepsis antibiotics project) written to the
// standard of RCEM's descriptors, shown beside each question as a model of
// depth and structure. Illustrative only: not an RCEM example and not to be
// copied.
export const EMQIAT_EXAMPLE = {
    pdp: `My QI PDP this year was to move from taking part in QI to leading a complete project and developing others in QI.
1. Lead a departmental QIP through at least three PDSA cycles, with a run chart and a family of measures.
2. Complete the IHI Open School improvement modules and NHS England "Making Data Count" training.
3. Present my results at departmental governance and at a regional or national meeting.
4. Supervise an FY2 through their first audit-to-QI cycle.`,
    qiEducationInvolvement: `IHI Open School QI 101–105 (Oct 2025): the Model for Improvement and PDSA ramps, which I used to plan small, fast tests rather than one big change.
NHS England "Making Data Count" workshop (Nov 2025): run chart and SPC rules; I now report shifts and trends rather than before-and-after averages.
Regional QI teaching day (Feb 2026): stakeholder mapping and measurement plans; I applied the power/interest grid to our nursing and pharmacy colleagues.
Monthly departmental audit and QI meetings: presented twice and gave feedback on two other trainees' projects.`,
    qiEducationLearning: `The Making Data Count training changed how I judge whether a change has worked (Measurement): I now plot data over time and look for shifts rather than comparing two averages. The IHI modules gave me the habit of small, fast tests (Testing Changes), which is why my first PDSA was on one shift rather than the whole department. In future QI work I will set up a run chart and a family of measures before making any change, and use stakeholder mapping at the start (Creating Conditions) rather than when I meet resistance.`,
    overview: {
        background: 'Only 42% of patients with red-flag sepsis in our ED received IV antibiotics within 60 minutes (baseline audit of 50 cases, June 2025), against the RCEM standard.',
        aim: 'Increase the proportion of red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage from 42% to 90% by May 2026.',
        understandingProblem: 'Process mapping and a fishbone with nursing, pharmacy and junior doctors showed the main delays were finding equipment and waiting for a prescriber. A staff survey (n=38) confirmed this.',
        measures: 'Outcome: % receiving antibiotics within 60 minutes (weekly, 10 random cases). Process: time from triage to cannulation; trolley stock checks completed. Balancing: inappropriate antibiotic use and C. difficile rates.',
        interventions: 'PDSA 1: handover teaching (abandoned: awareness rose but compliance did not). PDSA 2: dedicated sepsis trolley (adopted). PDSA 3: nurse-initiated antibiotics under a PGD (adapted, then adopted). PDSA 4: EPR prompt (adopted).',
        results: 'The run chart showed a shift after PDSA 2 and a further shift after PDSA 3; compliance rose from a baseline median of 42% to a median of 91% over the final 12 weeks, with no rise in inappropriate antibiotic use.',
        nextSteps: 'The trolley check is in the daily nursing checklist and the PGD is in induction. The neighbouring hospital ED has adopted the trolley and PGD, and I am supporting their data collection.'
    },
    role: `I led this project from start to finish. In Creating Conditions I secured a consultant sponsor and the matron's support, and built a team of a band 7 sister, a pharmacist, an EPR analyst and two SHOs. In Understanding Systems I ran the process-mapping session and the fishbone, which moved our focus from "education" to equipment and prescribing delays. In Developing Aims I wrote a SMART aim and agreed our family of measures with the team. In Testing Changes I planned each PDSA cycle with a written prediction, coordinated data collection, and made the call to abandon the teaching intervention when the data showed no effect. In Implement I negotiated the nurse PGD with pharmacy and microbiology, which was the hardest part: microbiology were concerned about stewardship, so I arranged a joint meeting, added a balancing measure for inappropriate antibiotics and agreed a review point, which won their support. In Spread I shared the toolkit with the neighbouring ED. Leading a team with no line-management authority taught me to delegate clearly and keep momentum through regular short updates.`,
    teamStakeholders: `Our core team was multi-disciplinary: a band 7 sister (sepsis champion), an ED pharmacist, an EPR analyst, two SHOs collecting data, and a consultant sponsor. I met the team fortnightly for 20 minutes, kept a shared action log and delegated each PDSA cycle to an owner.
I mapped stakeholders by power and interest. The matron and clinical lead were engaged early through one-to-one meetings; nursing staff through huddle briefings and a survey; pharmacy and microbiology through a joint meeting. Microbiology initially resisted nurse-initiated antibiotics; adding a balancing measure and a three-month review gained their buy-in. I sent a monthly run-chart update to the whole department, which kept engagement high.`,
    sharingResults: `ED clinical governance meeting (March 2026): presented baseline data and PDSA 1–3 results to consultants, matrons and the divisional lead.
Regional EM trainee QI day (April 2026): oral presentation; the neighbouring hospital ED then adopted the trolley and PGD.
RCEM Annual Scientific Conference (2026): poster accepted — see upload at 3.5.
Trust patient-safety newsletter (May 2026): short article on the sepsis trolley.`,
    reflections: `This year taught me that QI is about systems rather than individuals. My first prediction, that teaching would fix the problem, was wrong; the run chart made that obvious within four weeks, and I learned to let the data challenge my assumptions and to abandon a change quickly.
I learned how much of QI is relationship work. The nurse PGD stalled for six weeks until I understood microbiology's concern and designed a balancing measure around it; I now involve sceptical stakeholders at the start rather than after the plan is made.
The biggest challenge was working cost-neutrally with limited time; persevering through small tests, and borrowing an unused trolley, kept us moving.
If I did this again I would set up automated data extraction from the start, and I would spend more time on sustainability planning before the final cycle rather than after it.`,
    nextYearPdp: `I complete training (CCT) this year, so my plans are as a new consultant.
1. Hand over this project with a sustainability plan and quarterly run-chart review at governance.
2. Act as QI lead for trainees in my new department, supervising at least two trainee projects.
3. Complete formal SPC training so I can teach it locally.`,
    endOfTrainingJourney: `My QI journey started in ACCS (ST1) with a departmental audit of analgesia in fractured neck of femur, where I learned the audit cycle but not how to create change. In ST3 I joined a colleague's QIP on handover and saw how PDSA cycles and run charts work in practice. In ST4–5 I led a small project on paediatric pain scoring that stalled because I had not engaged nursing staff early — a lesson I carried directly into this year's sepsis project.
As a senior trainee I have moved from doing QI to leading and teaching it: this year I led a multi-disciplinary team, negotiated with other specialties and spread the change to another hospital.
As an EM consultant I will use this by building QI into governance, making data visible to the whole team, and supporting trainees to run small, well-measured tests of change rather than large one-off projects.`,
    qiJourney: Object.fromEntries(QI_JOURNEY_ITEMS.map(([k]) => [k, true])),
    curriculum: { higherSlo11Kc1: true, higherSlo11Kc2: true }
};
