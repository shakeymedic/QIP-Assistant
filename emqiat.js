// emqiat.js
//
// Renders the EM QIAT (2025 Update) form INSIDE the app, question-for-question
// matching the live RCEM form on risr/advance: the same intro, Part A, the
// same numbering (1.1, 2.1, 3.0–3.5, 4.1–4.4), the same question wording
// (emqiat-shared.js EMQIAT_PROMPTS) and the Curriculum section.
//
// Two render modes:
//   - Trainee (readOnly = false): editable answers saved as they type, a
//     "Suggest from project data" draft for most questions (never applied
//     without a click), a Copy button per answer for pasting into risr/advance,
//     and an excellence check showing what each answer still needs.
//   - Supervisor / QIP Lead (readOnly = true): the trainee's actual answers,
//     read-only, so sign-off is based on what they really wrote.

import { state } from "./state.js";
import { escapeHtml } from "./utils.js";
import { callAI } from "./ai.js";
import {
    deriveStageLabel, deriveOverview, deriveSharingResults, deriveReflections, deriveNextYearPdp,
    derivePdpFromJournal, deriveEducationInvolvementFromJournal, deriveEndOfTrainingFromJournal,
    deriveRoleNarrative, deriveTeamNarrative, deriveJourneyFromProject, assessEmqiat,
    EMQIAT_INTRO, EMQIAT_NA_NOTE, EMQIAT_PROMPTS, QI_JOURNEY_ITEMS, QI_JOURNEY_URL,
    CURRICULUM_HEADING, CURRICULUM_NOTE, CURRICULUM_KCS, OVERVIEW_PARTS, RCEM_SOURCES, EMQIAT_EXAMPLE
} from "./emqiat-shared.js";

const P = EMQIAT_PROMPTS;
const STATUS_STYLE = {
    strong: ['Strong', 'bg-emerald-100 text-emerald-800', 'check-circle-2'],
    ok: ['Nearly there', 'bg-amber-100 text-amber-800', 'circle-dot'],
    weak: ['Needs work', 'bg-orange-100 text-orange-800', 'alert-circle'],
    missing: ['Not started', 'bg-slate-100 text-slate-600', 'circle']
};

function fieldId(path) { return 'emqiat-' + path.replace(/\./g, '-'); }

function questionHeading(q) {
    return `<span class="font-bold text-slate-800">${q.num} ${escapeHtml(q.label)}</span>${q.prompt ? ` <span class="font-normal text-slate-600">– ${escapeHtml(q.prompt)}</span>` : ''}`;
}

function statusChip(key) {
    return `<span id="emqiat-status-${key}" class="emqiat-status" data-key="${key}"></span>`;
}

function editableTextarea(q, path, value, opts = {}) {
    const id = fieldId(path);
    const suggestion = opts.suggestion || '';
    return `
        <div class="mb-5 scroll-mt-24" id="emqiat-q-${opts.key || path}">
            <label for="${id}" class="block text-sm mb-1.5">${questionHeading(q)}</label>
            <textarea id="${id}" rows="${opts.rows || 4}" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                placeholder="${escapeHtml(opts.placeholder || '')}"
                oninput="window.saveEmqiatFormField('${path}', this.value, true)"
                onchange="window.saveEmqiatFormField('${path}', this.value)">${escapeHtml(value || '')}</textarea>
            <div class="flex items-center gap-3 mt-1 flex-wrap">
                ${statusChip(opts.key || path)}
                <span id="emqiat-wc-${opts.key || path}" class="text-[11px] text-slate-400"></span>
                <span class="ml-auto flex items-center gap-3">
                    ${suggestion ? `<button type="button" onclick="window.suggestEmqiatFormField('${path}', this)" data-suggestion="${escapeHtml(suggestion)}" class="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Suggest from project data</button>` : ''}
                    ${window.hasAI && window.hasAI() ? `<button type="button" onclick="window.aiStrengthenEmqiat('${path}', this)" class="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1" title="AI rewrites your answer to cover what's missing, using only facts from your project"><i data-lucide="wand-2" class="w-3 h-3"></i> Strengthen with AI</button>` : ''}
                    <button type="button" onclick="window.copyEmqiatField('${path}')" class="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1" title="Copy this answer to paste into risr/advance"><i data-lucide="copy" class="w-3 h-3"></i> Copy</button>
                </span>
            </div>
            <ul id="emqiat-todo-${opts.key || path}" class="mt-1.5 space-y-0.5"></ul>
            <div id="emqiat-ai-${opts.key || path}"></div>
            ${exampleBlock(EMQIAT_EXAMPLE[opts.key || path])}
        </div>`;
}

// A fictional worked example of a strong answer, to show depth and structure.
function exampleBlock(text) {
    if (!text) return '';
    return `
        <details class="mt-1.5 group">
            <summary class="text-[11px] text-fuchsia-700 cursor-pointer list-none hover:underline inline-flex items-center gap-1"><i data-lucide="book-open" class="w-3 h-3"></i> See a strong example</summary>
            <div class="mt-1.5 border border-fuchsia-100 bg-fuchsia-50/40 rounded-lg p-3">
                <p class="text-[10px] font-bold text-fuchsia-800 uppercase tracking-wide mb-1">Illustrative example (fictional sepsis project) \u2014 for depth and structure, not to copy</p>
                <div class="text-xs text-slate-700 whitespace-pre-line">${escapeHtml(text)}</div>
            </div>
        </details>`;
}

function editableInput(label, path, value, placeholder, type = 'text') {
    const id = fieldId(path);
    return `
        <div>
            <label for="${id}" class="text-sm font-semibold text-slate-700 block mb-1">${label}</label>
            <input id="${id}" type="${type}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder || '')}"
                class="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                onchange="window.saveEmqiatFormField('${path}', this.value)">
        </div>`;
}

function readOnlyBlock(label, value, emptyText) {
    return `
        <div class="mb-4">
            <div class="text-sm mb-1">${label}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">
                ${value ? escapeHtml(value) : `<span class="text-slate-400 italic">${emptyText || 'Not yet answered'}</span>`}
            </div>
        </div>`;
}

function sectionTitle(text) {
    return `<h4 class="text-base font-bold text-fuchsia-700 mb-3">${text}</h4>`;
}

// 3.2.1 — which of the project's QI tools exist and can be exported to attach.
function toolsAvailable(data) {
    const t = [];
    if ((data.drivers?.primary || []).length) t.push(['Driver diagram', 'tools']);
    if (data.fishbone?.categories?.some(c => (c.causes || []).length)) t.push(['Fishbone diagram', 'tools']);
    if (Array.isArray(data.process) && data.process.length > 2) t.push(['Process map', 'tools']);
    const pts = (Array.isArray(data.measures) && data.measures[0]?.chartData ? data.measures[0].chartData : data.chartData || []).length;
    if (pts) t.push(['Run chart', 'data']);
    if ((data.stakeholders || []).length) t.push(['Stakeholder map', 'stakeholders']);
    if ((data.pdsa || []).length) t.push(['PDSA cycle write-ups', 'pdsa']);
    return t;
}

export function renderEMQIATForm(container, opts = {}) {
    if (!container) return;
    const data = state.projectData;
    if (!data) return;
    const readOnly = !!opts.readOnly;

    if (!data.emqiatForm) data.emqiatForm = {};
    const e = data.emqiatForm;
    // The live form has no "2.2 Learning" question; older versions of this
    // app asked for one. Fold any earlier answer into 2.1 so nothing is lost.
    // (Blanked rather than deleted: saves merge, so a deleted key would come
    // back from the database and be merged again.)
    if (!readOnly && e.qiEducationLearning) {
        const learning = String(e.qiEducationLearning).trim();
        const current = String(e.qiEducationInvolvement || '');
        if (learning && !current.includes(learning)) {
            e.qiEducationInvolvement = [current.trim(), learning].filter(Boolean).join('\n\n');
        }
        e.qiEducationLearning = '';
        if (window.saveData) window.saveData();
    }

    const overview = e.overview || {};
    const qiJourney = e.qiJourney || {};
    const curriculum = e.curriculum || {};
    const derived = deriveOverview(data);
    const derivedStage = deriveStageLabel(data.meta?.trainingStage);
    const suggestions = {
        pdp: derivePdpFromJournal(data),
        qiEducationInvolvement: deriveEducationInvolvementFromJournal(data),
        role: deriveRoleNarrative(data),
        teamStakeholders: deriveTeamNarrative(data),
        sharingResults: deriveSharingResults(data),
        reflections: deriveReflections(data),
        nextYearPdp: deriveNextYearPdp(data),
        endOfTrainingJourney: deriveEndOfTrainingFromJournal(data)
    };
    const ta = (key, opts2 = {}) => readOnly
        ? readOnlyBlock(questionHeading(P[key]), e[key], opts2.emptyText)
        : editableTextarea(P[key], key, e[key], { key, suggestion: suggestions[key], ...opts2 });

    const journeyBlock = readOnly
        ? `<div class="flex flex-wrap gap-2">${QI_JOURNEY_ITEMS.map(([key, label]) => `
            <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${qiJourney[key] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}">
                <i data-lucide="${qiJourney[key] ? 'check-circle' : 'circle'}" class="w-3 h-3"></i> ${label}
            </span>`).join('')}</div>`
        : `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${QI_JOURNEY_ITEMS.map(([key, label]) => `
            <label class="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-rcem-purple">
                <input type="checkbox" class="emqiat-journey" data-key="${key}" ${qiJourney[key] ? 'checked' : ''} onchange="window.toggleEmqiatFormJourney('${key}', this.checked)">
                <span>${label}</span>
            </label>`).join('')}</div>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
                ${statusChip('qiJourney')}
                <button type="button" onclick="window.tickEmqiatJourneyFromProject()" class="ml-auto text-xs text-indigo-600 hover:underline flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Tick the stages my project shows evidence for</button>
            </div>
            <ul id="emqiat-todo-qiJourney" class="mt-1.5 space-y-0.5"></ul>`;

    const curriculumBlock = readOnly
        ? `<div class="space-y-1">${CURRICULUM_KCS.map(([key, label]) => `<div class="text-xs ${curriculum[key] ? 'text-emerald-700' : 'text-slate-400'} flex items-start gap-1.5"><i data-lucide="${curriculum[key] ? 'check-square' : 'square'}" class="w-3.5 h-3.5 flex-shrink-0 mt-0.5"></i> ${escapeHtml(label)}</div>`).join('')}</div>`
        : `<div class="space-y-2">${CURRICULUM_KCS.map(([key, label]) => `
            <label class="flex items-start gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-rcem-purple">
                <input type="checkbox" class="mt-0.5" ${curriculum[key] ? 'checked' : ''} onchange="window.toggleEmqiatCurriculum('${key}', this.checked)">
                <span>${escapeHtml(label)}</span>
            </label>`).join('')}</div>
            <p class="text-[11px] text-slate-400 mt-1.5">These are the Higher SLO11 options. ACCS and Intermediate trainees: pick the matching Key Capabilities for your stage on risr/advance.</p>
            <div class="mt-2">${statusChip('curriculum')}</div>
            <ul id="emqiat-todo-curriculum" class="mt-1.5 space-y-0.5"></ul>`;

    const overviewBlock = readOnly
        ? `<div class="mb-4"><div class="text-sm mb-1">${questionHeading(P.overview)}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 space-y-2">
                ${OVERVIEW_PARTS.map(([k, l]) => `<p><strong>${l}:</strong> ${overview[k] ? escapeHtml(overview[k]).replace(/\n/g, '<br>') : '<span class="text-slate-400 italic">Not yet answered</span>'}</p>`).join('')}
            </div></div>`
        : `<div class="mb-5 scroll-mt-24" id="emqiat-q-overview">
            <div class="text-sm mb-1.5">${questionHeading(P.overview)}</div>
            <p class="text-[11px] text-slate-500 mb-2">Structured under the headings assessors expect; the export and Copy button paste them into the single 3.1 box.</p>
            <div class="border-l-2 border-indigo-100 pl-3">
            ${OVERVIEW_PARTS.map(([k, l]) => `
                <div class="mb-3">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <label for="${fieldId('overview.' + k)}" class="text-xs font-bold text-slate-600 uppercase tracking-wide">${l}</label>
                        ${derived[k] ? `<button type="button" onclick="window.suggestEmqiatFormField('overview.${k}', this)" data-suggestion="${escapeHtml(derived[k])}" class="text-[11px] text-indigo-600 hover:underline flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> Suggest</button>` : ''}
                    </div>
                    <textarea id="${fieldId('overview.' + k)}" rows="2" class="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        oninput="window.saveEmqiatFormField('overview.${k}', this.value, true)" onchange="window.saveEmqiatFormField('overview.${k}', this.value)">${escapeHtml(overview[k] || '')}</textarea>
                </div>`).join('')}
            </div>
            <div class="flex items-center gap-3 mt-1 flex-wrap">
                ${statusChip('overview')}
                <button type="button" onclick="window.copyEmqiatField('overview')" class="ml-auto text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"><i data-lucide="copy" class="w-3 h-3"></i> Copy 3.1</button>
            </div>
            <ul id="emqiat-todo-overview" class="mt-1.5 space-y-0.5"></ul>
            ${exampleBlock(OVERVIEW_PARTS.map(([k, l]) => `${l}: ${EMQIAT_EXAMPLE.overview[k]}`).join('\n\n'))}
        </div>`;

    const tools = toolsAvailable(data);
    const toolsBlock = `
        <div class="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <div class="text-sm mb-1">${questionHeading(P.tools)}</div>
            <p>File upload on risr/advance. ${tools.length ? `Your project has: ${tools.map(([n, v]) => readOnly ? escapeHtml(n) : `<button onclick="window.router('${v}')" class="underline font-semibold">${escapeHtml(n)}</button>`).join(', ')} — export each as an image (PNG) and attach all of them.` : 'Build a driver diagram, fishbone or process map and a run chart in this app, then export and attach them.'}</p>
        </div>`;

    container.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-xl p-4 md:p-6 mb-6" id="emqiat-form">
            <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                    <h3 class="text-lg font-bold text-slate-800">EM QIAT (2025 Update)</h3>
                    <p class="text-sm text-slate-600 mt-1">${escapeHtml(EMQIAT_INTRO)}</p>
                </div>
                ${!readOnly ? `
                <div class="flex gap-2 flex-wrap">
                    <button onclick="window.copyEmqiatAll()" class="text-xs bg-white text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy all</button>
                    <button onclick="window.exportToKaizen()" class="text-xs bg-rcem-purple text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-800 flex items-center gap-1 whitespace-nowrap"><i data-lucide="file-output" class="w-3.5 h-3.5"></i> Export for risr/advance</button>
                </div>` : ''}
            </div>

            ${!readOnly ? `<div id="emqiat-excellence" class="mb-5"></div>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 pb-5 border-b border-slate-100">
                ${readOnly ? readOnlyBlock('Stage of training', e.stageOfTraining) : editableInput('Stage of training', 'stageOfTraining', e.stageOfTraining, derivedStage || 'e.g. ST6')}
                ${readOnly ? readOnlyBlock('Placement', e.placement) : editableInput('Placement', 'placement', e.placement, 'e.g. ST6 year at <your hospital>')}
                ${readOnly ? readOnlyBlock('Date of completion', e.dateOfCompletion) : editableInput('Date of completion', 'dateOfCompletion', e.dateOfCompletion, '', 'date')}
            </div>

            <div class="mb-5">
                <div class="font-bold text-slate-800">Part A</div>
                <p class="text-sm text-slate-600 mt-1">${escapeHtml(EMQIAT_NA_NOTE)}</p>
                <p class="text-sm text-slate-600 mt-1">For information on the QI Journey please click here: <a href="${QI_JOURNEY_URL}" target="_blank" rel="noopener" class="text-fuchsia-700 hover:underline">QI journey</a>.</p>
            </div>

            <div class="mb-6">
                ${sectionTitle('1. QI Personal Development Plan - Current year')}
                ${ta('pdp', { placeholder: 'Broad summary, then one objective per line, e.g.\n1. Lead a departmental QIP through 3+ PDSA cycles\n2. Complete IHI Open School QI modules\n3. Present results at regional meeting' })}
            </div>

            <div class="mb-6">
                ${sectionTitle('2. QI Education')}
                ${ta('qiEducationInvolvement', { placeholder: 'One activity per line — what it was, when, and what you took from it into your project' })}
            </div>

            <div class="mb-6">
                ${sectionTitle('3. Project Involvement')}
                ${readOnly ? readOnlyBlock(questionHeading(P.involvedInProject), e.involvedInProject === 'yes' ? 'Yes' : e.involvedInProject === 'no' ? 'No' : '') : `
                <div class="mb-5" id="emqiat-q-involvedInProject">
                    <label class="text-sm block mb-1">${questionHeading(P.involvedInProject)}</label>
                    <select onchange="window.saveEmqiatFormField('involvedInProject', this.value)" class="w-full sm:w-64 border border-slate-300 rounded-lg p-2 text-sm">
                        <option value="" ${!e.involvedInProject ? 'selected' : ''}>— Select —</option>
                        <option value="yes" ${e.involvedInProject === 'yes' ? 'selected' : ''}>Yes</option>
                        <option value="no" ${e.involvedInProject === 'no' ? 'selected' : ''}>No</option>
                    </select>
                </div>`}
                ${overviewBlock}
                ${ta('role', { rows: 6, placeholder: 'Describe what YOU did, stage by stage of the QI Journey, and a challenge you led the team through.' })}
                ${toolsBlock}
                ${ta('teamStakeholders', { rows: 5, placeholder: 'Who was in the team and their roles, which stakeholders you engaged and how, and how you gained buy-in.' })}
                ${ta('sharingResults', { placeholder: 'Each place you presented or shared it: what, to whom, when — departmental, governance, regional/national, poster.' })}
                <div class="mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                    <div class="text-sm mb-1">${questionHeading(P.poster)}</div>
                    File upload on risr/advance. ${!readOnly ? 'Use Export → poster or presentation in this app, save as PDF, and attach it here.' : ''}
                </div>
            </div>

            <div class="mb-6">
                ${sectionTitle('4 - Learning &amp; Development')}
                <p class="text-sm text-slate-600 mb-3">For information on the QI journey please refer to the following link: <a href="${QI_JOURNEY_URL}" target="_blank" rel="noopener" class="text-fuchsia-700 hover:underline">QI Journey</a></p>
                <div class="mb-5 scroll-mt-24" id="emqiat-q-qiJourney">
                    <div class="text-sm mb-2">${questionHeading(P.qiJourney)}</div>
                    ${journeyBlock}
                </div>
                ${ta('reflections', { rows: 6, placeholder: 'What this year taught you about QI: what worked, what didn’t, a challenge you worked through, and what you would do differently.' })}
                ${ta('nextYearPdp', { placeholder: 'Your QI plans for next year. If you CCT this year, say so and describe your QI plans as a new consultant.' })}
                ${ta('endOfTrainingJourney', { rows: 6, emptyText: 'Not yet answered (only needed at the end of training)', placeholder: 'Final year only (otherwise write N/A): your QI and leadership journey across your whole EM training, with examples from earlier years, and how you will use it as a consultant.' })}
            </div>

            <div class="mb-2 pt-4 border-t border-slate-100 scroll-mt-24" id="emqiat-q-curriculum">
                <div class="font-bold text-slate-800 mb-1">Curriculum</div>
                <p class="text-sm text-slate-600 mb-3">${escapeHtml(CURRICULUM_NOTE)}</p>
                <div class="text-sm font-semibold text-slate-700 mb-2">${escapeHtml(CURRICULUM_HEADING)}</div>
                ${curriculumBlock}
                <p class="text-xs text-slate-500 mt-3">Attach files: add your QI tools, run chart and poster/presentation on risr/advance.</p>
            </div>
        </div>`;

    if (!readOnly) refreshEmqiatChecks();
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
}

// ── Excellence check UI ──────────────────────────────────────────────────────

function renderStatus(item) {
    const [label, cls, icon] = STATUS_STYLE[item.status];
    return `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}"><i data-lucide="${icon}" class="w-3 h-3"></i>${label}</span>`;
}

// RCEM's own grade descriptors, each ticked when the evidence is written down.
function rcemBlock(res) {
    const r = res.rcem;
    if (!r) return '';
    const row = (d) => `<li class="flex items-start gap-1.5 text-xs ${d.ok ? 'text-slate-500' : 'text-slate-700'}"><i data-lucide="${d.ok ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 flex-shrink-0 mt-px ${d.ok ? 'text-emerald-500' : 'text-slate-300'}"></i><span>${escapeHtml(d.text)}<span class="block text-[10px] text-slate-400 italic">RCEM: “${escapeHtml(d.quote)}”</span></span></li>`;
    const sat = r.satisfactory.filter(d => d.ok).length, exc = r.excellent.filter(d => d.ok).length;
    return `
        <div class="grid grid-cols-1 ${r.excellent.length ? 'md:grid-cols-2' : ''} gap-2 mb-4">
            <div class="bg-white border border-slate-200 rounded-lg p-3">
                <div class="text-sm font-bold text-slate-800 mb-2">${r.stage === 'higher' ? 'Higher training: satisfactory/good' : 'RCEM expectations for your stage'} <span class="text-xs font-normal text-slate-500">(${sat}/${r.satisfactory.length} evidenced)</span></div>
                <ul class="space-y-1.5">${r.satisfactory.map(row).join('')}</ul>
            </div>
            ${r.excellent.length ? `
            <div class="bg-white border ${exc === r.excellent.length ? 'border-emerald-300' : 'border-fuchsia-200'} rounded-lg p-3">
                <div class="text-sm font-bold text-fuchsia-800 mb-2">What RCEM describes as excellent <span class="text-xs font-normal text-slate-500">(${exc}/${r.excellent.length} evidenced)</span></div>
                <ul class="space-y-1.5">${r.excellent.map(row).join('')}</ul>
                <p class="text-[10px] text-slate-400 mt-2">The more of these you can genuinely evidence, the stronger the case for excellent.</p>
            </div>` : ''}
        </div>
        ${res.finalYear ? `<p class="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-2 mb-4">ST6: RCEM’s guidance says ST6 QIATs get a final sign-off from the regional QI panel after your educational supervisor, so write 3.1, 3.2 and 4.4 for a reader who doesn’t know your department.</p>` : ''}`;
}

export function refreshEmqiatChecks() {
    const data = state.projectData;
    const panel = document.getElementById('emqiat-excellence');
    if (!data || !panel) return;
    const res = assessEmqiat(data);
    const e = data.emqiatForm || {};

    res.items.forEach(item => {
        const chip = document.getElementById(`emqiat-status-${item.key}`);
        if (chip) chip.innerHTML = item.optional ? '<span class="text-[11px] text-slate-400">Final year only</span>' : renderStatus(item);
        const todo = document.getElementById(`emqiat-todo-${item.key}`);
        if (todo) {
            const unmet = item.checks.filter(c => !c.ok);
            todo.innerHTML = item.optional ? '' : unmet.map(c => `<li class="text-[11px] text-slate-500 flex items-start gap-1.5"><span class="text-amber-500 mt-px">→</span><span>${escapeHtml(c.text)}</span></li>`).join('');
        }
        const wc = document.getElementById(`emqiat-wc-${item.key}`);
        if (wc) {
            const n = String(e[item.key] || '').trim().split(/\s+/).filter(Boolean).length;
            wc.textContent = n ? `${n} word${n !== 1 ? 's' : ''}` : '';
        }
    });

    const pct = res.total ? Math.round((res.strong / res.total) * 100) : 0;
    const order = { missing: 0, weak: 1, ok: 2, strong: 3 };
    const listed = res.items.filter(i => !i.optional).sort((a, b) => order[a.status] - order[b.status]);
    const openState = panel.querySelector('details')?.open;
    panel.innerHTML = `
        <details class="rounded-xl border ${pct === 100 ? 'border-emerald-200 bg-emerald-50/60' : 'border-indigo-200 bg-indigo-50/50'}" ${openState === undefined ? (pct < 100 ? 'open' : '') : (openState ? 'open' : '')}>
            <summary class="cursor-pointer list-none p-4 flex items-center gap-4">
                <div class="relative w-14 h-14 flex-shrink-0">
                    <svg viewBox="0 0 36 36" class="w-14 h-14 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3.5"></circle><circle cx="18" cy="18" r="15.9" fill="none" stroke="${pct === 100 ? '#10b981' : '#4f46e5'}" stroke-width="3.5" stroke-dasharray="${pct} 100" stroke-linecap="round"></circle></svg>
                    <span class="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700">${res.strong}/${res.total}</span>
                </div>
                <div class="flex-1">
                    <div class="font-bold text-slate-800">Excellence check — ${res.strong} of ${res.total} sections strong</div>
                    <div class="text-xs text-slate-600 mt-0.5">${pct === 100 ? 'Every section has what an assessor looks for. Read it through once more in your own voice before you submit.' : 'Work down the list: each item says exactly what the answer still needs.'}</div>
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400"></i>
            </summary>
            <div class="px-4 pb-4">
                ${rcemBlock(res)}
                <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Question by question</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${listed.map(item => `
                        <div class="bg-white border border-slate-200 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-1">
                                ${renderStatus(item)}
                                <button type="button" onclick="window.jumpToEmqiat('${item.key}')" class="text-sm font-semibold text-slate-800 hover:text-rcem-purple text-left">${item.num ? item.num + ' ' : ''}${escapeHtml(item.title)}</button>
                            </div>
                            <ul class="space-y-0.5">
                                ${item.checks.map(c => `<li class="text-[11px] flex items-start gap-1.5 ${c.ok ? 'text-slate-400' : 'text-slate-600'}"><i data-lucide="${c.ok ? 'check' : 'circle'}" class="w-3 h-3 flex-shrink-0 mt-px ${c.ok ? 'text-emerald-500' : 'text-slate-300'}"></i><span>${escapeHtml(c.text)}${!c.ok && c.view ? ` <button onclick="window.router('${c.view}')" class="text-indigo-600 underline">Fix</button>` : ''}</span></li>`).join('')}
                            </ul>
                        </div>`).join('')}
                </div>
                <p class="text-[11px] text-slate-500 mt-3">These checks follow the form’s questions and RCEM’s published QIAT descriptors. They look for the evidence being written down, not its quality, so they can’t guarantee a grade — that is your supervisor’s${res.finalYear ? ' (and, for ST6, the regional QI panel’s)' : ''} judgement. Write in your own words: assessors recognise generic or auto-generated text.</p>
                <p class="text-[11px] text-slate-400 mt-1">Sources: ${RCEM_SOURCES.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener" class="underline hover:text-slate-600">${escapeHtml(t)}</a>`).join(' · ')}</p>
            </div>
        </details>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('emqiat-form') || panel] });
}

window.jumpToEmqiat = function(key) {
    if (key === 'project') { window.router && window.router('checklist'); return; }
    const target = document.getElementById(`emqiat-q-${key}`) || document.getElementById(fieldId(key)) || document.getElementById('emqiat-form');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = target.querySelector('textarea, input, select');
        if (input) setTimeout(() => input.focus({ preventScroll: true }), 400);
    }
};

// ── Field save handlers (trainee editing only — blocked upstream by isReadOnly) ──

let checkTimer = null;
function scheduleChecks() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(refreshEmqiatChecks, 250);
}

window.saveEmqiatFormField = function(path, value, typing) {
    if (!state.projectData) return;
    if (!state.projectData.emqiatForm) state.projectData.emqiatForm = {};
    const parts = path.split('.');
    let obj = state.projectData.emqiatForm;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    scheduleChecks();
    if (typing) return; // saved on change/blur; keep typing smooth
    if (window.saveDataDebounced) window.saveDataDebounced();
    else if (window.saveData) window.saveData();
};

window.toggleEmqiatFormJourney = function(key, checked) {
    if (!state.projectData) return;
    if (!state.projectData.emqiatForm) state.projectData.emqiatForm = {};
    if (!state.projectData.emqiatForm.qiJourney) state.projectData.emqiatForm.qiJourney = {};
    state.projectData.emqiatForm.qiJourney[key] = !!checked;
    scheduleChecks();
    if (window.saveDataDebounced) window.saveDataDebounced();
    else if (window.saveData) window.saveData();
};

window.tickEmqiatJourneyFromProject = function() {
    if (!state.projectData || state.isReadOnly) return;
    const evidence = deriveJourneyFromProject(state.projectData);
    let added = 0;
    Object.entries(evidence).forEach(([key, ok]) => {
        if (!ok) return;
        const box = document.querySelector(`.emqiat-journey[data-key="${key}"]`);
        if (box && !box.checked) { box.checked = true; added++; }
        if (!state.projectData.emqiatForm.qiJourney) state.projectData.emqiatForm.qiJourney = {};
        state.projectData.emqiatForm.qiJourney[key] = true;
    });
    if (window.saveData) window.saveData();
    scheduleChecks();
    if (window.showToast) window.showToast(added ? `Ticked ${added} stage${added !== 1 ? 's' : ''} your project shows evidence for — make sure 3.2 and 4.2 describe them` : 'Nothing new to tick from your project data', 'info');
};

window.toggleEmqiatCurriculum = function(key, checked) {
    if (!state.projectData) return;
    if (!state.projectData.emqiatForm) state.projectData.emqiatForm = {};
    if (!state.projectData.emqiatForm.curriculum) state.projectData.emqiatForm.curriculum = {};
    state.projectData.emqiatForm.curriculum[key] = !!checked;
    scheduleChecks();
    if (window.saveData) window.saveData();
};

// Fills a field with the suggestion shown on its button. Never overwrites
// an existing answer without asking.
window.suggestEmqiatFormField = function(path, btnEl) {
    const suggestion = btnEl?.dataset?.suggestion || '';
    const el = document.getElementById(fieldId(path));
    if (!el || !suggestion) return;
    const apply = () => {
        el.value = suggestion;
        window.saveEmqiatFormField(path, suggestion);
        if (window.showToast) window.showToast('Draft added — rewrite it in your own words and fill in the [bracketed] parts before submitting', 'info');
    };
    if (el.value.trim() && window.showConfirmDialog) {
        window.showConfirmDialog('Replace your current answer with the suggested draft?', apply, 'Replace', 'Replace answer');
    } else apply();
};

export function overviewText(overview) {
    return OVERVIEW_PARTS.map(([k, l]) => (overview?.[k] || '').trim() ? `${l}: ${overview[k].trim()}` : '').filter(Boolean).join('\n\n');
}

window.copyEmqiatField = function(path) {
    const e = state.projectData?.emqiatForm || {};
    const text = path === 'overview' ? overviewText(e.overview) : (document.getElementById(fieldId(path))?.value ?? e[path] ?? '');
    if (!String(text).trim()) { window.showToast && window.showToast('Nothing to copy yet', 'info'); return; }
    navigator.clipboard.writeText(text).then(
        () => window.showToast && window.showToast('Copied — paste it into the matching box on risr/advance', 'success'),
        () => window.showToast && window.showToast('Copy failed — select the text and copy it manually', 'error')
    );
};

// The whole form as plain text, in the live form's order (for "Copy all").
export function emqiatPlainText(data) {
    const e = data?.emqiatForm || {};
    const a = (v) => (v && String(v).trim()) ? String(v).trim() : '[not answered yet]';
    const q = (key) => `${P[key].num} ${P[key].label}${P[key].prompt ? ' - ' + P[key].prompt : ''}`;
    const journey = QI_JOURNEY_ITEMS.filter(([k]) => e.qiJourney?.[k]).map(([, l]) => l).join(', ');
    const kcs = CURRICULUM_KCS.filter(([k]) => e.curriculum?.[k]).map(([, l]) => l).join(' , ');
    return [
        EMQIAT_INTRO,
        `Stage of training: ${a(e.stageOfTraining)}\nPlacement: ${a(e.placement)}\nDate of completion: ${a(e.dateOfCompletion)}`,
        `Part A\n${EMQIAT_NA_NOTE}`,
        `1. QI Personal Development Plan - Current year\n${q('pdp')}\n${a(e.pdp)}`,
        `2. QI Education\n${q('qiEducationInvolvement')}\n${a(e.qiEducationInvolvement)}`,
        `3. Project Involvement\n${q('involvedInProject')} ${e.involvedInProject === 'yes' ? 'Yes' : e.involvedInProject === 'no' ? 'No' : '[not answered yet]'}`,
        `${q('overview')}\n${a(overviewText(e.overview))}`,
        `${q('role')}\n${a(e.role)}`,
        `${q('teamStakeholders')}\n${a(e.teamStakeholders)}`,
        `${q('sharingResults')}\n${a(e.sharingResults)}`,
        `4 - Learning & Development\n${q('qiJourney')}\n${a(journey)}`,
        `${q('reflections')}\n${a(e.reflections)}`,
        `${q('nextYearPdp')}\n${a(e.nextYearPdp)}`,
        `${q('endOfTrainingJourney')}\n${a(e.endOfTrainingJourney)}`,
        `Curriculum\n${CURRICULUM_HEADING}: ${a(kcs)}`
    ].join('\n\n');
}

window.copyEmqiatAll = function() {
    const text = emqiatPlainText(state.projectData);
    navigator.clipboard.writeText(text).then(
        () => window.showToast && window.showToast('Whole form copied', 'success'),
        () => window.showToast && window.showToast('Copy failed', 'error')
    );
};

// ── AI: strengthen one answer without inventing anything ─────────────────────

function projectFacts(data) {
    const c = data.checklist || {};
    const cut = (t, n = 600) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
    const team = (data.charter?.team?.length ? data.charter.team : data.teamMembers || []).map(m => `${m.role || ''}${m.grade ? ' (' + m.grade + ')' : ''}`).filter(Boolean);
    const lines = [
        `Title: ${cut(data.meta?.title, 200)}`,
        c.problem_desc && `Problem: ${cut(c.problem_desc)}`,
        c.aim && `Aim: ${cut(c.aim, 400)}`,
        c.outcome_measure && `Outcome measure: ${cut(c.outcome_measure, 300)}`,
        c.process_measure && `Process measure: ${cut(c.process_measure, 300)}`,
        c.balance_measure && `Balancing measure: ${cut(c.balance_measure, 300)}`,
        (data.pdsa || []).length && `PDSA cycles:\n${data.pdsa.map((p, i) => `- ${p.title || 'Cycle ' + (i + 1)}${p.startDate ? ' (' + p.startDate + ')' : ''}: ${cut(p.study || p.do || '', 250)} ${p.act ? 'Act: ' + cut(p.act, 150) : ''}`).join('\n')}`,
        c.results_analysis && `Results: ${cut(c.results_analysis)}`,
        team.length && `Team roles: ${team.join(', ')}`,
        (data.stakeholders || []).length && `Stakeholders: ${data.stakeholders.map(s => s.name + (s.role ? ' (' + s.role + ')' : '')).join(', ')}`,
        (data.leadershipLogs || []).length && `Leadership log:\n${data.leadershipLogs.map(l => `- ${l.date || ''}: ${cut(l.note, 200)}`).join('\n')}`,
        c.learning_points && `Learning points: ${cut(c.learning_points)}`,
        c.sustainability && `Sustainability: ${cut(c.sustainability)}`
    ];
    return lines.filter(Boolean).join('\n');
}

window.aiStrengthenEmqiat = async function(path, btn) {
    const data = state.projectData;
    if (!data || state.isReadOnly) return;
    const key = path;
    const q = P[key];
    const slot = document.getElementById(`emqiat-ai-${key}`);
    if (!q || !slot) return;
    const current = document.getElementById(fieldId(path))?.value || '';
    const item = assessEmqiat(data).items.find(i => i.key === key);
    const missing = item ? item.checks.filter(c => !c.ok).map(c => '- ' + c.text).join('\n') : '';
    const prompt = `You are helping an Emergency Medicine trainee write one answer on the RCEM EM QIAT (2025 Update) form.

QUESTION ${q.num} ${q.label}: ${q.prompt}

THEIR CURRENT ANSWER:
${current.trim() || '(empty)'}

WHAT A STRONG ANSWER STILL NEEDS:
${missing || '- Already covers the essentials; tighten and improve clarity.'}

WHAT RCEM LOOKS FOR (Higher training QIAT):
- Satisfactory/good: a QI project the trainee led; mature reflection on the experience and conduct of the project; evidence of multi-disciplinary working; an account of the QI methods used and leadership skills deployed; stakeholder engagement, implementation of change and monitoring of impact.
- Excellent: significant improvement in clinical care; presentation at a regional or national meeting; innovation, QI team leadership or perseverance in making change; findings and learning taken to more than one project or setting.
Only claim these where the facts support them; otherwise add a [bracketed prompt].

FACTS FROM THEIR PROJECT (the only facts you may use):
${projectFacts(data)}

RULES:
- Write the answer in the first person, as the trainee, in British English, as plain text (no markdown, no headings).
- Use ONLY facts from their current answer and the project facts above. Never invent names, numbers, dates, events, courses, meetings or outcomes.
- Where a strong answer needs something that isn't in those facts, put a short prompt in square brackets for the trainee to fill in, e.g. [name the regional meeting and date].
- Keep everything true that they already wrote. Relate it to the RCEM/NES QI Journey stages where relevant.
- No patient-identifiable information.
- Length: about 150–250 words (about 80–150 for 3.4 and 4.3).
Return only the rewritten answer.`;
    const original = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Working…'; }
    try {
        const out = await callAI(prompt);
        if (!out) return;
        const text = String(out).replace(/^```\w*\n?|```$/g, '').trim();
        slot.innerHTML = `
            <div class="mt-2 border border-purple-200 bg-purple-50/60 rounded-lg p-3">
                <div class="text-[11px] font-bold text-purple-800 mb-1">AI suggestion — check every sentence is true and fill in any [brackets]</div>
                <div class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(text)}</div>
                <div class="flex gap-2 mt-2">
                    <button type="button" class="ai-use text-xs font-bold bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">Use this</button>
                    <button type="button" class="ai-discard text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1">Discard</button>
                </div>
            </div>`;
        slot.querySelector('.ai-use').onclick = () => {
            const el = document.getElementById(fieldId(path));
            if (el) el.value = text;
            window.saveEmqiatFormField(path, text);
            slot.innerHTML = '';
        };
        slot.querySelector('.ai-discard').onclick = () => { slot.innerHTML = ''; };
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }
    }
};
