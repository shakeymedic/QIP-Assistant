// emqiat.js
//
// Renders the EM-QIAT (2025 Update) form INSIDE the app, field-for-field
// matching the real RCEM form on kaizenep.com (same numbering as
// kaizen-export.js: 1.1, 2.1-2.2, 3.0-3.5, 4.1-4.4). Replaces the old
// invented "trainee level + 3 generic capabilities" checklist.
//
// Two render modes:
//   - Trainee (readOnly = false): editable textareas/inputs, saved via
//     window.saveEmqiatFormField as the trainee types (onchange, debounced save).
//     "Suggest" buttons offer a derived starting draft from elsewhere in the
//     project (via emqiat-shared.js) without overwriting anything already
//     typed \u2014 the trainee always has to click to accept a suggestion.
//   - Supervisor (readOnly = true): plain read-only text, so a supervisor
//     reviews the trainee's actual real answers before signing off, not a
//     separate summary that could be rubber-stamped without reading anything.

import { state } from "./state.js";
import { escapeHtml } from "./utils.js";
import { deriveStageLabel, deriveTeam, deriveRole, deriveOverview, deriveSharingResults, deriveReflections, deriveNextYearPdp, derivePdpFromJournal, deriveEducationInvolvementFromJournal, deriveEndOfTrainingFromJournal } from "./emqiat-shared.js";

const QI_JOURNEY_ITEMS = [
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

function fieldId(path) { return 'emqiat-' + path.replace(/\./g, '-'); }

function editableTextarea(label, path, value, opts = {}) {
    const id = fieldId(path);
    const suggestion = opts.suggestion || '';
    const rows = opts.rows || 3;
    return `
        <div class="mb-4">
            <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <label for="${id}" class="text-sm font-semibold text-slate-700">${label}</label>
                ${suggestion ? `<button type="button" onclick="window.suggestEmqiatFormField('${path}', this)" data-suggestion="${escapeHtml(suggestion)}" class="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Suggest from project data</button>` : ''}
            </div>
            <textarea id="${id}" rows="${rows}" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                placeholder="${escapeHtml(opts.placeholder || '')}"
                onchange="window.saveEmqiatFormField('${path}', this.value)">${escapeHtml(value || '')}</textarea>
        </div>`;
}

function editableInput(label, path, value, placeholder, type = 'text') {
    const id = fieldId(path);
    return `
        <div class="mb-4">
            <label for="${id}" class="text-sm font-semibold text-slate-700 block mb-1">${label}</label>
            <input id="${id}" type="${type}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder || '')}"
                class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                onchange="window.saveEmqiatFormField('${path}', this.value)">
        </div>`;
}

function readOnlyBlock(label, value, emptyText) {
    return `
        <div class="mb-4">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">${label}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">
                ${value ? escapeHtml(value) : `<span class="text-slate-400 italic">${emptyText || 'Not yet answered'}</span>`}
            </div>
        </div>`;
}

export function renderEMQIATForm(container, opts = {}) {
    if (!container) return;
    const data = state.projectData;
    if (!data) return;
    const readOnly = !!opts.readOnly;

    const e = data.emqiatForm || {};
    const overview = e.overview || {};
    const qiJourney = e.qiJourney || {};
    const derived = deriveOverview(data);
    const derivedStage = deriveStageLabel(data.meta?.trainingStage);
    const derivedTeam = deriveTeam(data);
    const derivedRole = deriveRole(data);
    const derivedSharing = deriveSharingResults(data);
    const derivedReflections = deriveReflections(data);
    const derivedNextYearPdp = deriveNextYearPdp(data);
    // Prefer the richer, already-structured data from the separate EM-QIAT
    // Journal (PDP goals, education log, CCT summary) over a generic fallback.
    const derivedPdp = derivePdpFromJournal(data);
    const derivedEducation = deriveEducationInvolvementFromJournal(data);
    const derivedEndOfTraining = deriveEndOfTrainingFromJournal(data);

    const journeyBlock = readOnly
        ? `<div class="flex flex-wrap gap-2">${QI_JOURNEY_ITEMS.map(([key, label]) => `
            <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${qiJourney[key] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}">
                <i data-lucide="${qiJourney[key] ? 'check-circle' : 'circle'}" class="w-3 h-3"></i> ${label}
            </span>`).join('')}</div>`
        : `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${QI_JOURNEY_ITEMS.map(([key, label]) => `
            <label class="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-rcem-purple">
                <input type="checkbox" ${qiJourney[key] ? 'checked' : ''} onchange="window.toggleEmqiatFormJourney('${key}', this.checked)">
                <span>${label}</span>
            </label>`).join('')}</div>`;

    const html = `
        <div class="bg-white border border-slate-200 rounded-xl p-4 md:p-6 mb-6">
            <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
                <div>
                    <h3 class="text-lg font-bold text-slate-800">EM-QIAT (2025 Update)</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Mirrors the real RCEM form field-for-field so this is what your supervisor reviews \u2014 not a separate summary. ${readOnly ? 'Read-only \u2014 you are viewing the trainee\\'s actual answers.' : 'Fill this in yourself, or click \u201cSuggest from project data\u201d for a derived starting draft you can edit.'}</p>
                </div>
                ${!readOnly ? `<button onclick="window.exportToKaizen()" class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 flex items-center gap-1 whitespace-nowrap"><i data-lucide="file-output" class="w-3.5 h-3.5"></i> Export copy/paste version</button>` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 pb-5 border-b border-slate-100">
                ${readOnly ? readOnlyBlock('Stage of training', e.stageOfTraining || derivedStage) : editableInput('Stage of training', 'stageOfTraining', e.stageOfTraining, derivedStage || 'e.g. ST6')}
                ${readOnly ? readOnlyBlock('Placement', e.placement) : editableInput('Placement', 'placement', e.placement, 'e.g. ST6 year at Birmingham Heartlands Hospital')}
                ${readOnly ? readOnlyBlock('Date of completion', e.dateOfCompletion) : editableInput('Date of completion', 'dateOfCompletion', e.dateOfCompletion, '', 'date')}
            </div>

            <div class="mb-6">
                <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Part A \u2014 1. QI Personal Development Plan \u2014 Current year</div>
                ${readOnly ? readOnlyBlock('1.1 PDP \u2014 QI PDP for this year & specific objectives', e.pdp || derivedPdp) : editableTextarea('1.1 PDP \u2014 summarise your QI PDP for this year and list specific objectives', 'pdp', e.pdp, { suggestion: derivedPdp, rows: 4, placeholder: 'Your QI PDP for this year...' })}
                ${!readOnly && derivedPdp ? `<p class="text-[11px] text-slate-400 mb-4 -mt-3">Suggestion pulled from your PDP Goals in the <button onclick="window.showEMQIATModal()" class="text-indigo-600 hover:underline">EM-QIAT Journal</button>.</p>` : ''}
            </div>

            <div class="mb-6">
                <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">2. QI Education</div>
                ${readOnly ? readOnlyBlock('2.1 Involvement \u2014 QI education over the past year', e.qiEducationInvolvement || derivedEducation, 'Not yet answered \u2014 no derivable data for this field.') : editableTextarea('2.1 Involvement \u2014 describe your engagement with QI education over the past year', 'qiEducationInvolvement', e.qiEducationInvolvement, { suggestion: derivedEducation, placeholder: 'Online learning, courses, conferences...' })}
                ${!readOnly && derivedEducation ? `<p class="text-[11px] text-slate-400 mb-4 -mt-3">Suggestion pulled from your <button onclick="window.showEMQIATModal()" class="text-indigo-600 hover:underline">EM-QIAT Journal</button> education log.</p>` : ''}
                ${readOnly ? readOnlyBlock('2.2 Learning \u2014 how this developed your understanding of QI', e.qiEducationLearning, 'Not yet answered \u2014 no derivable data for this field.') : editableTextarea('2.2 Learning \u2014 how has this developed your understanding of QI?', 'qiEducationLearning', e.qiEducationLearning, { placeholder: 'What did formal QI education add on top of doing the project itself?' })}
            </div>

            <div class="mb-6">
                <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">3. Project Involvement</div>

                ${readOnly ? readOnlyBlock('3.0 Were you involved in a QI project in any way?', e.involvedInProject === 'yes' ? 'Yes' : e.involvedInProject === 'no' ? 'No' : '') : `
                <div class="mb-4">
                    <label class="text-sm font-semibold text-slate-700 block mb-1">3.0 Were you involved in a QI project in any way?</label>
                    <select onchange="window.saveEmqiatFormField('involvedInProject', this.value)" class="w-full sm:w-64 border border-slate-300 rounded-lg p-2 text-sm">
                        <option value="" ${!e.involvedInProject ? 'selected' : ''}>\u2014 Select \u2014</option>
                        <option value="yes" ${e.involvedInProject === 'yes' ? 'selected' : ''}>Yes</option>
                        <option value="no" ${e.involvedInProject === 'no' ? 'selected' : ''}>No</option>
                    </select>
                </div>`}

                <div class="text-sm font-semibold text-slate-700 mb-2">3.1 Project Overview</div>
                ${readOnly ? readOnlyBlock('Background', overview.background || derived.background) : editableTextarea('Background', 'overview.background', overview.background, { suggestion: derived.background, placeholder: 'What was the problem?' })}
                ${readOnly ? readOnlyBlock('Aim', overview.aim || derived.aim) : editableTextarea('Aim', 'overview.aim', overview.aim, { suggestion: derived.aim, placeholder: 'Your SMART aim' })}
                ${readOnly ? readOnlyBlock('Understanding the Problem', overview.understandingProblem || derived.understandingProblem) : editableTextarea('Understanding the Problem', 'overview.understandingProblem', overview.understandingProblem, { suggestion: derived.understandingProblem, placeholder: 'Baseline/scoping evidence, root cause analysis...' })}
                ${readOnly ? readOnlyBlock('Measures', overview.measures || derived.measures) : editableTextarea('Measures', 'overview.measures', overview.measures, { suggestion: derived.measures, placeholder: 'Outcome / process / balancing measures' })}
                ${readOnly ? readOnlyBlock('Interventions', overview.interventions || derived.interventions) : editableTextarea('Interventions', 'overview.interventions', overview.interventions, { suggestion: derived.interventions, placeholder: 'Your change ideas / PDSA cycles' })}
                ${readOnly ? readOnlyBlock('Results', overview.results || derived.results) : editableTextarea('Results', 'overview.results', overview.results, { suggestion: derived.results, placeholder: 'What happened' })}
                ${readOnly ? readOnlyBlock('Next Steps', overview.nextSteps || derived.nextSteps) : editableTextarea('Next Steps', 'overview.nextSteps', overview.nextSteps, { suggestion: derived.nextSteps, placeholder: 'What next' })}

                ${readOnly ? readOnlyBlock('3.2 Your Role in the Project', e.role || derivedRole) : editableInput('3.2 Your Role in the Project', 'role', e.role, derivedRole || 'e.g. Lead / Co-lead / Team member')}

                <div class="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                    <i data-lucide="upload" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
                    <span><strong>3.2.1 QI tools</strong> \u2014 file upload only on the real form. Export your driver diagram, fishbone diagram, and run chart as images from the Diagnosis Tools / Data pages, then attach them there.</span>
                </div>

                ${readOnly ? readOnlyBlock('3.3 Team working and Stakeholders', e.teamStakeholders || derivedTeam) : editableTextarea('3.3 Team working and Stakeholders', 'teamStakeholders', e.teamStakeholders, { suggestion: derivedTeam, placeholder: 'Team members and how you engaged stakeholders' })}
                ${readOnly ? readOnlyBlock('3.4 Sharing of results', e.sharingResults || derivedSharing) : editableTextarea('3.4 Sharing of results', 'sharingResults', e.sharingResults, { suggestion: derivedSharing, placeholder: 'How and when you shared/presented results' })}

                <div class="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                    <i data-lucide="upload" class="w-4 h-4 flex-shrink-0 mt-0.5"></i>
                    <span><strong>3.5 Poster or Presentation</strong> \u2014 file upload only on the real form. Attach any poster or slide deck directly there.</span>
                </div>
            </div>

            <div class="mb-2">
                <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">4. Learning &amp; Development</div>
                <div class="mb-4">
                    <div class="text-sm font-semibold text-slate-700 mb-2">4.1 The QI Journey</div>
                    ${journeyBlock}
                </div>
                ${readOnly ? readOnlyBlock('4.2 Reflections and Learning', e.reflections || derivedReflections) : editableTextarea('4.2 Reflections and Learning', 'reflections', e.reflections, { suggestion: derivedReflections, rows: 4, placeholder: 'What went well, what didn\'t, what would you do differently' })}
                ${readOnly ? readOnlyBlock('4.3 Next Year\'s PDP', e.nextYearPdp || derivedNextYearPdp) : editableTextarea('4.3 Next Year\'s PDP', 'nextYearPdp', e.nextYearPdp, { suggestion: derivedNextYearPdp, placeholder: 'Your QI plans for next year' })}
                ${readOnly ? readOnlyBlock('4.4 End of training \u2014 QI development journey', e.endOfTrainingJourney || derivedEndOfTraining, 'Not yet answered \u2014 this is a personal narrative and is never auto-filled.') : editableTextarea('4.4 End of training \u2014 QI development journey (required at end of training)', 'endOfTrainingJourney', e.endOfTrainingJourney, { suggestion: derivedEndOfTraining, rows: 4, placeholder: 'Your longitudinal QI/leadership journey across your whole EM training, with examples from earlier years' })}
                ${!readOnly && derivedEndOfTraining ? `<p class="text-[11px] text-slate-400 mb-2 -mt-3">Suggestion pulled from your CCT Summary in the <button onclick="window.showEMQIATModal()" class="text-indigo-600 hover:underline">EM-QIAT Journal</button>.</p>` : ''}
            </div>
        </div>`;

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

// ─── Field save handlers (trainee editing only \u2014 blocked upstream by isReadOnly) ───

window.saveEmqiatFormField = function(path, value) {
    if (!state.projectData) return;
    if (!state.projectData.emqiatForm) state.projectData.emqiatForm = {};
    const parts = path.split('.');
    let obj = state.projectData.emqiatForm;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    if (window.saveDataDebounced) window.saveDataDebounced();
    else if (window.saveData) window.saveData();
};

window.toggleEmqiatFormJourney = function(key, checked) {
    if (!state.projectData) return;
    if (!state.projectData.emqiatForm) state.projectData.emqiatForm = {};
    if (!state.projectData.emqiatForm.qiJourney) state.projectData.emqiatForm.qiJourney = {};
    state.projectData.emqiatForm.qiJourney[key] = !!checked;
    if (window.saveDataDebounced) window.saveDataDebounced();
    else if (window.saveData) window.saveData();
};

// Fills a field with the derived suggestion shown on its "Suggest" button,
// then saves it immediately \u2014 the trainee can still edit it afterwards,
// this just avoids typing from a blank page.
window.suggestEmqiatFormField = function(path, btnEl) {
    const suggestion = btnEl?.dataset?.suggestion || '';
    const el = document.getElementById(fieldId(path));
    if (!el || !suggestion) return;
    el.value = suggestion;
    window.saveEmqiatFormField(path, suggestion);
    if (window.showToast) window.showToast('Suggestion added \u2014 edit it to make it your own before submitting', 'info');
};
