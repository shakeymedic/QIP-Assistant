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
    const checklist = data.checklist || {};
    return checklist.sustainability && /governance meeting|consultant meeting|presented/i.test(checklist.sustainability)
        ? checklist.sustainability
        : '';
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
