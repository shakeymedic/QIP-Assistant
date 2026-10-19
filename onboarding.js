import { state } from "./state.js";
import { QI } from "./qi-constants.js";
import { escapeHtml, showToast } from "./utils.js";
import { coachAim, coachHtml } from "./aim-coach.js";
import { OP_DEF_TEMPLATES } from "./idea-bank.js";

// ==========================================
// ONBOARDING WIZARD LOGIC
// ==========================================
// Six short steps that take a trainee who has never done a QIP from "is this
// even a QIP?" to a draft aim, a family of measures, a data collection plan
// and a first set of drivers and change ideas. Nothing here is final: every
// field is editable afterwards on Define & Measure and the Tools pages.

let currentStep = 1;
const totalSteps = 6;
const STEP_TITLES = ['Is this a QIP?', 'Choose a problem', 'Sponsor and registration', 'Draft your aim', 'Measures and data plan', 'Causes and change ideas'];

function ensureShapes() {
    const d = state.projectData;
    if (!d) return null;
    if (!d.checklist) d.checklist = {};
    if (!d.meta) d.meta = {};
    if (!d.dataPlan || typeof d.dataPlan !== 'object') d.dataPlan = { source: '', collector: '', cadence: '', sample: '', start: '' };
    if (!d.drivers || typeof d.drivers !== 'object') d.drivers = { primary: [], secondary: [], changes: [] };
    ['primary', 'secondary', 'changes'].forEach(k => { if (!Array.isArray(d.drivers[k])) d.drivers[k] = []; });
    if (!Array.isArray(d.changeIdeas)) d.changeIdeas = [];
    if (!Array.isArray(d.teamMembers)) d.teamMembers = [];
    if (!d.checklist.hraChecklist) d.checklist.hraChecklist = { q1: '', q2: '', q3: '', q4: '', notes: '' };
    if (!d.charter || typeof d.charter !== 'object') d.charter = {};
    return d;
}

export function startOnboarding(step = 1) {
    currentStep = Math.min(Math.max(1, step), totalSteps);
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderOnboardingStep();
    }
}

const stepHeader = (n, colour, title) => `
    <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-full ${colour} text-white flex items-center justify-center font-bold shadow">${n}</div>
        <h4 class="text-xl font-bold text-slate-800">${title}</h4>
        <span class="ml-auto text-xs text-slate-400">Step ${n} of ${totalSteps}</span>
    </div>`;

const exampleLink = (section, label) => `<button type="button" onclick="window.showExample('${section}')" class="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 inline-flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> ${label || 'Show me an example'}</button>`;

function renderOnboardingStep() {
    const content = document.getElementById('onboarding-content');
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnNext = document.getElementById('btn-onboarding-next');
    const d = ensureShapes();
    if (!content || !d) return;
    const c = d.checklist;

    btnPrev.classList.toggle('hidden', currentStep === 1);
    btnNext.textContent = currentStep === totalSteps ? 'Finish setup' : 'Next step';

    let html = '';

    if (currentStep === 1) {
        const stage = d.meta.trainingStage || '';
        const kind = d.meta.projectKind || '';
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(1, 'bg-rcem-purple', 'Is this a QIP?')}
                <p class="text-sm text-slate-600 leading-relaxed">An <strong>audit</strong> measures practice against a standard and reports the gap. A <strong>quality improvement project</strong> goes further: it tests changes, measures over time and tries to close the gap. The EM QIAT, run charts and PDSA cycles in this app are for the second kind. Both are valuable; this just makes sure you use the right tools.</p>
                <div class="grid md:grid-cols-2 gap-3 text-xs">
                    <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p class="font-bold text-slate-700 mb-1">It is an audit if…</p>
                        <ul class="list-disc pl-4 space-y-0.5 text-slate-600"><li>you compare notes against a guideline once (or twice)</li><li>the output is a report of the compliance rate</li><li>no change is tested between measurements</li></ul>
                    </div>
                    <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <p class="font-bold text-indigo-800 mb-1">It is a QIP if…</p>
                        <ul class="list-disc pl-4 space-y-0.5 text-indigo-800"><li>you have an aim with a number and a date</li><li>you measure the same thing weekly, before and after changes</li><li>you test small changes in cycles and keep what works</li></ul>
                    </div>
                </div>
                <div class="bg-white border border-slate-200 rounded-lg p-3">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">What are you planning?</label>
                    <div class="flex flex-col gap-1.5 text-sm">
                        <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="onboarding-kind" value="qip" ${kind === 'qip' ? 'checked' : ''} class="text-rcem-purple"> A quality improvement project (test changes over time)</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="onboarding-kind" value="audit-to-qip" ${kind === 'audit-to-qip' ? 'checked' : ''} class="text-rcem-purple"> An audit that I want to turn into a QIP</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="onboarding-kind" value="audit" ${kind === 'audit' ? 'checked' : ''} class="text-rcem-purple"> A one-off audit only</label>
                    </div>
                    <p id="onboarding-kind-note" class="text-xs text-slate-500 mt-2"></p>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">Training stage — this changes what "good" looks like throughout the app</label>
                    <div class="flex flex-wrap gap-3">
                        <label class="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" name="onboarding-stage" value="accs" ${stage === 'accs' ? 'checked' : ''} class="text-rcem-purple"> ACCS <span class="text-xs text-slate-400">(participation)</span></label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" name="onboarding-stage" value="intermediate" ${stage === 'intermediate' ? 'checked' : ''} class="text-rcem-purple"> Intermediate <span class="text-xs text-slate-400">(participation, data and evaluation)</span></label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm"><input type="radio" name="onboarding-stage" value="higher" ${stage === 'higher' ? 'checked' : ''} class="text-rcem-purple"> Higher <span class="text-xs text-slate-400">(leadership)</span></label>
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">When does this rotation end?</label>
                        <input type="date" id="onboarding-rotation-end" value="${escapeHtml(d.meta.rotationEnd || '')}" class="w-full p-2 border border-slate-300 rounded text-sm">
                        <p class="text-[11px] text-slate-400 mt-1">Your aim date and handover plan work back from this.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">ARCP date (if known)</label>
                        <input type="date" id="onboarding-arcp" value="${escapeHtml(d.meta.arcpDate || '')}" class="w-full p-2 border border-slate-300 rounded text-sm">
                        <p class="text-[11px] text-slate-400 mt-1">The EM QIAT is completed once a year before your ARCP.</p>
                    </div>
                </div>
            </div>`;
    } else if (currentStep === 2) {
        const f = d.meta.feasibility || {};
        const q = [
            { key: 'data', label: 'I can get the data from records that already exist (EPR, drug chart, observation chart) without designing a new form.', why: 'Projects that need a new form to be filled in by busy staff usually stall at the baseline. Pick something the EPR already records.' },
            { key: 'weekly', label: 'I could measure it every week from a sample of about ' + QI.SAMPLE_PER_POINT + ' patients.', why: 'If the event only happens once a month you will never get ' + QI.BASELINE_MIN + ' baseline points. Choose a more common process, or widen the definition.' },
            { key: 'scope', label: 'It is one process in one area, small enough to show a change before my rotation ends.', why: 'Whole-pathway projects ("improve sepsis care") rarely finish. Narrow it to one step ("time to first antibiotic").' },
            { key: 'people', label: 'A consultant and the nurses who do the work think it matters and would support a change.', why: 'Changes to a process need the people who run it. Ask a senior nurse and a consultant before you commit.' }
        ];
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(2, 'bg-red-500', 'Choose a problem')}
                <p class="text-sm text-slate-600 leading-relaxed">Describe one specific problem in one place: what goes wrong, for whom, and why it matters. Keep it to a sentence or two; the numbers come later from your baseline.</p>
                <textarea id="onboarding-problem" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[90px] focus:ring-2 focus:ring-rcem-purple outline-none" placeholder="e.g. Adults with red-flag sepsis at triage do not reliably receive IV antibiotics within 60 minutes, which NICE recommends for people at high risk.">${escapeHtml(c.problem_desc || '')}</textarea>
                <div class="flex flex-wrap gap-2 items-center">
                    <button type="button" onclick="window.openTopicBank()" class="text-xs bg-rcem-purple text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-800 font-medium inline-flex items-center gap-1"><i data-lucide="library" class="w-3 h-3"></i> Pick a starter project</button>
                    ${exampleLink('problem')}
                    <span class="text-[11px] text-slate-400">A starter fills in a draft aim, measures, data plan, drivers and change ideas for you to edit.</span>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-slate-600 uppercase mb-2">Is it a sensible first project? Tick what is true.</p>
                    <div class="space-y-2">
                        ${q.map(x => `
                            <label class="flex items-start gap-2 text-sm cursor-pointer">
                                <input type="checkbox" class="onboarding-feas mt-0.5 text-rcem-purple" data-key="${x.key}" ${f[x.key] ? 'checked' : ''} onchange="window.onboardingFeasibilityChanged()">
                                <span>${escapeHtml(x.label)}<span class="block text-xs text-amber-700 mt-0.5 feas-why ${f[x.key] ? 'hidden' : ''}" data-why="${x.key}">${escapeHtml(x.why)}</span></span>
                            </label>`).join('')}
                    </div>
                    <p id="onboarding-feas-summary" class="text-xs mt-2"></p>
                </div>
            </div>`;
    } else if (currentStep === 3) {
        const sponsor = d.teamMembers.find(m => /sponsor/i.test(m.role || '')) || null;
        const reg = (c.hraChecklist || {}).q3 || '';
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(3, 'bg-amber-500', 'Sponsor and registration')}
                <p class="text-sm text-slate-600 leading-relaxed">Two things before any data: a <strong>consultant sponsor</strong> who agrees the project matters and will help it survive after you rotate, and <strong>registration</strong> with your Trust's audit or clinical governance department, which is how most Trusts give permission to look at patient records for improvement work.</p>
                <div class="grid md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Consultant sponsor</label>
                        <input type="text" id="onboarding-sponsor" value="${escapeHtml(sponsor ? sponsor.name : (d.charter.execSponsor || ''))}" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="e.g. Dr A Khan, ED consultant">
                        <p class="text-[11px] text-slate-400 mt-1">Added to your team and to the project charter. Leave blank if not yet agreed.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Registered with audit / clinical governance?</label>
                        <div class="flex gap-3 text-sm mt-1">
                            <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-reg" value="yes" ${reg === 'yes' ? 'checked' : ''} class="text-emerald-500"> Yes</label>
                            <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-reg" value="pending" ${reg === 'pending' ? 'checked' : ''} class="text-amber-500"> Applied</label>
                            <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-reg" value="no" ${reg === 'no' ? 'checked' : ''} class="text-red-500"> Not yet</label>
                        </div>
                        <input type="text" id="onboarding-reg-ref" value="${escapeHtml(c.ethics || '')}" class="w-full p-2 border border-slate-300 rounded text-sm mt-2" placeholder="Registration reference, if you have one">
                    </div>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
                    <strong>Why this matters:</strong> looking at patient records without registration can be an information governance breach, and a project without a sponsor usually ends when you leave. Both take a week or two to arrange, so start now. The full ethics and governance questions are on Define &amp; Measure.
                </div>
            </div>`;
    } else if (currentStep === 4) {
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(4, 'bg-blue-500', 'Draft your aim')}
                <p class="text-sm text-slate-600 leading-relaxed">One sentence: <em>To [increase/reduce] [the measure] from [baseline] to [target] by [date] in [place]</em>. You do not know the baseline yet, so write <strong>[to be measured]</strong> and come back once you have about ${QI.BASELINE_MIN} baseline points.</p>
                <textarea id="onboarding-aim" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[90px] focus:ring-2 focus:ring-blue-500 outline-none" oninput="window.onboardingAimChanged()" placeholder="To increase the percentage of adults with red-flag sepsis who receive IV antibiotics within 60 minutes from [to be measured] to 90% by June 2027 in the Emergency Department.">${escapeHtml(c.aim || '')}</textarea>
                <div id="onboarding-aim-coach"></div>
                <div class="flex flex-wrap gap-2 items-center">
                    <button type="button" onclick="window.openSmartAimBuilder()" class="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg inline-flex items-center gap-1 hover:bg-slate-50 font-medium"><i data-lucide="edit-3" class="w-3 h-3"></i> Build it step by step</button>
                    ${exampleLink('aim')}
                </div>
                <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 leading-relaxed">
                    <strong>Choosing a target:</strong> 100% is almost never credible. Most first projects aim for 90% or 95% for a compliance measure, or a clear cut in a time (for example "under 30 minutes"). Agree the target with your sponsor once you have seen the baseline.
                </div>
            </div>`;
    } else if (currentStep === 5) {
        const mt = c.outcomeKind || '';
        const plan = d.dataPlan;
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(5, 'bg-emerald-500', 'Measures and data plan')}
                <p class="text-sm text-slate-600 leading-relaxed">Three measures, one data plan. The <strong>outcome</strong> is the thing patients care about; the <strong>process</strong> measure shows whether the steps are happening; the <strong>balancing</strong> measure checks you are not making something else worse. All three are expected on the EM QIAT.</p>
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">What kind of number is your outcome measure?</label>
                    <div class="flex flex-wrap gap-3 text-sm">
                        <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-mtype" value="percentage" ${mt === 'percentage' ? 'checked' : ''} onchange="window.onboardingMeasureTypeChanged(this.value)"> A percentage (e.g. % within 60 minutes)</label>
                        <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-mtype" value="time" ${mt === 'time' ? 'checked' : ''} onchange="window.onboardingMeasureTypeChanged(this.value)"> A time (e.g. median minutes to X)</label>
                        <label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="onboarding-mtype" value="count" ${mt === 'count' ? 'checked' : ''} onchange="window.onboardingMeasureTypeChanged(this.value)"> A count (e.g. incidents per week)</label>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-1">Choosing one writes a template for your operational definition below, with the gaps you need to fill.</p>
                </div>
                <div class="grid md:grid-cols-3 gap-3">
                    <div><label class="block text-xs font-bold text-emerald-700 mb-1">● Outcome measure *</label><textarea id="onboarding-outcome" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="e.g. % of red-flag sepsis patients given IV antibiotics within 60 minutes, weekly">${escapeHtml(c.outcome_measure || '')}</textarea></div>
                    <div><label class="block text-xs font-bold text-blue-700 mb-1">● Process measure *</label><textarea id="onboarding-process" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="e.g. % with the sepsis screen completed at triage">${escapeHtml(c.process_measure || '')}</textarea></div>
                    <div><label class="block text-xs font-bold text-amber-700 mb-1">● Balancing measure *</label><textarea id="onboarding-balance" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="e.g. antibiotics given to patients later found not to be septic">${escapeHtml(c.balance_measure || '')}</textarea></div>
                </div>
                <div class="flex flex-wrap gap-2 items-center">${exampleLink('measures')}</div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Operational definition — what exactly counts, so anyone would collect it the same way</label>
                    <textarea id="onboarding-opdef" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[80px]" placeholder="Choose a measure type above to get a template.">${escapeHtml(c.operational_definition || '')}</textarea>
                </div>
                <div class="bg-white border border-slate-200 rounded-lg p-3">
                    <p class="text-xs font-bold text-slate-600 uppercase mb-2">Data collection plan</p>
                    <div class="grid md:grid-cols-2 gap-3 text-sm">
                        <div><label class="block text-[11px] font-bold text-slate-500 mb-1">Where the data comes from</label><input type="text" id="onboarding-plan-source" value="${escapeHtml(plan.source || '')}" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="e.g. EPR sepsis flag and drug chart"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 mb-1">Who collects it</label><input type="text" id="onboarding-plan-collector" value="${escapeHtml(plan.collector || '')}" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="e.g. me, with the audit department's weekly extract"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 mb-1">How often</label>
                            <select id="onboarding-plan-cadence" class="w-full p-2 border border-slate-300 rounded text-sm">
                                ${['', 'daily', 'weekly', 'fortnightly', 'monthly'].map(v => `<option value="${v}" ${plan.cadence === v ? 'selected' : ''}>${v ? v[0].toUpperCase() + v.slice(1) : 'Choose…'}</option>`).join('')}
                            </select></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 mb-1">Sample per point</label><input type="text" id="onboarding-plan-sample" value="${escapeHtml(plan.sample || '')}" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="e.g. first ${QI.SAMPLE_PER_POINT} eligible patients each week"></div>
                        <div><label class="block text-[11px] font-bold text-slate-500 mb-1">Baseline starts</label><input type="date" id="onboarding-plan-start" value="${escapeHtml(plan.start || '')}" class="w-full p-2 border border-slate-300 rounded text-sm"></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">Weekly is right for most ED projects. ${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET} weekly points is about three months of baseline, so start as soon as registration allows.</p>
                </div>
            </div>`;
    } else if (currentStep === 6) {
        const prim = d.drivers.primary;
        const ideas = d.changeIdeas.map(ci => ci.title);
        const inputs = (idPrefix, values, n, ph) => Array.from({ length: n }, (_, i) => `<input type="text" id="${idPrefix}-${i}" value="${escapeHtml(values[i] || '')}" class="w-full p-2 border border-slate-300 rounded text-sm mb-1.5" placeholder="${escapeHtml(ph[i] || '')}">`).join('');
        html = `
            <div class="space-y-4 animate-fade-in">
                ${stepHeader(6, 'bg-indigo-600', 'Causes and change ideas')}
                <p class="text-sm text-slate-600 leading-relaxed">Before testing anything, write down <strong>why</strong> the problem happens (the drivers) and the <strong>small changes</strong> you could test against each one. These seed your driver diagram; you will refine them with the team on the Tools page.</p>
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Why does it go wrong? (primary drivers)</label>
                        ${inputs('onboarding-driver', prim, 3, ['e.g. Sepsis not recognised at triage', 'e.g. Antibiotics not prescribed promptly', 'e.g. Drugs not to hand in resus'])}
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Small changes you could test (change ideas)</label>
                        ${inputs('onboarding-idea', ideas, 3, ['e.g. Sepsis prompt on the triage screen', 'e.g. Pre-made sepsis grab bag', 'e.g. Nurse escalates straight to the senior doctor'])}
                    </div>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <i data-lucide="info" class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"></i>
                    <p class="text-xs text-amber-800 leading-relaxed"><strong>Do not test anything yet.</strong> Collect your baseline first: ${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET} points for the outcome measure, usually one a week. Collecting the baseline is not a PDSA cycle. When the baseline is in, pick one change idea and plan the first PDSA cycle on the PDSA page; the dashboard will tell you when you are ready.</p>
                </div>
            </div>`;
    }

    html += `
        <div class="mt-6 pt-4 border-t border-slate-100">
            <div class="flex justify-center gap-2">
                ${Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => `<button type="button" title="${escapeHtml(STEP_TITLES[i - 1])}" onclick="window.goToOnboardingStep(${i})" class="w-9 h-1.5 rounded-full transition-colors ${i === currentStep ? 'bg-rcem-purple' : i < currentStep ? 'bg-indigo-200' : 'bg-slate-200'}"></button>`).join('')}
            </div>
            <p class="text-center text-[11px] text-slate-400 mt-2">${escapeHtml(STEP_TITLES[currentStep - 1])}</p>
        </div>`;

    content.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (currentStep === 1) {
        document.querySelectorAll('input[name="onboarding-kind"]').forEach(r => r.addEventListener('change', updateKindNote));
        updateKindNote();
    }
    if (currentStep === 2) window.onboardingFeasibilityChanged();
    if (currentStep === 4) window.onboardingAimChanged();
}

function updateKindNote() {
    const note = document.getElementById('onboarding-kind-note');
    const v = document.querySelector('input[name="onboarding-kind"]:checked')?.value;
    if (!note) return;
    note.textContent = v === 'audit' ? 'Fine: you can still use the Define & Measure page and the data table, but the PDSA, run-chart and EM QIAT sections assume you will test changes. If you later decide to close the gap you found, this becomes a QIP.'
        : v === 'audit-to-qip' ? 'Good: your audit result is the baseline evidence. The audit standard becomes the target in your aim, and the next step is to measure the same thing weekly rather than once.'
        : v === 'qip' ? 'Good. The rest of this setup takes you through the problem, the aim, the measures and the first ideas.'
        : '';
}

window.goToOnboardingStep = function (n) {
    saveCurrentStepData();
    currentStep = Math.min(Math.max(1, n), totalSteps);
    renderOnboardingStep();
};

window.onboardingFeasibilityChanged = function () {
    const boxes = Array.from(document.querySelectorAll('.onboarding-feas'));
    if (!boxes.length) return;
    boxes.forEach(b => {
        const why = document.querySelector(`.feas-why[data-why="${b.dataset.key}"]`);
        if (why) why.classList.toggle('hidden', b.checked);
    });
    const n = boxes.filter(b => b.checked).length;
    const sum = document.getElementById('onboarding-feas-summary');
    if (!sum) return;
    if (n === 4) { sum.className = 'text-xs mt-2 text-emerald-700 font-medium'; sum.textContent = 'All four: this looks like a sensible first project.'; }
    else if (n >= 2) { sum.className = 'text-xs mt-2 text-amber-700'; sum.textContent = `${n} of 4. Read the notes on the unticked items; they are the usual reasons first projects stall.`; }
    else { sum.className = 'text-xs mt-2 text-red-700'; sum.textContent = `${n} of 4. Consider a narrower problem or one of the starter projects, which are all chosen to pass these checks.`; }
};

window.onboardingAimChanged = function () {
    const el = document.getElementById('onboarding-aim');
    const box = document.getElementById('onboarding-aim-coach');
    if (!el || !box) return;
    const d = state.projectData || {};
    const items = coachAim(el.value, { rotationEnd: d.meta?.rotationEnd, arcpDate: d.meta?.arcpDate, baselineCount: window.baselinePointCount ? window.baselinePointCount() : 0 });
    box.innerHTML = coachHtml(items, escapeHtml);
};

window.onboardingMeasureTypeChanged = function (type) {
    const el = document.getElementById('onboarding-opdef');
    if (!el) return;
    const current = el.value.trim();
    const isTemplate = !current || Object.values(OP_DEF_TEMPLATES).includes(current);
    if (isTemplate) el.value = OP_DEF_TEMPLATES[type] || '';
    else showToast('Your operational definition was kept. Clear it to get the template.', 'info');
};

export function nextOnboardingStep() {
    saveCurrentStepData();
    if (currentStep < totalSteps) {
        currentStep++;
        renderOnboardingStep();
    } else {
        finishOnboarding();
    }
}

export function prevOnboardingStep() {
    saveCurrentStepData();
    if (currentStep > 1) {
        currentStep--;
        renderOnboardingStep();
    }
}

const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };

function saveCurrentStepData() {
    const d = ensureShapes();
    if (!d) return;
    const c = d.checklist;

    if (currentStep === 1) {
        const kind = document.querySelector('input[name="onboarding-kind"]:checked');
        if (kind) d.meta.projectKind = kind.value;
        const stageEl = document.querySelector('input[name="onboarding-stage"]:checked');
        if (stageEl) d.meta.trainingStage = stageEl.value;
        const rot = val('onboarding-rotation-end'); if (rot !== null) d.meta.rotationEnd = rot;
        const arcp = val('onboarding-arcp'); if (arcp !== null) d.meta.arcpDate = arcp;
    } else if (currentStep === 2) {
        const p = val('onboarding-problem'); if (p !== null) c.problem_desc = p;
        const boxes = Array.from(document.querySelectorAll('.onboarding-feas'));
        if (boxes.length) { d.meta.feasibility = {}; boxes.forEach(b => { d.meta.feasibility[b.dataset.key] = b.checked; }); }
    } else if (currentStep === 3) {
        const name = (val('onboarding-sponsor') || '').trim();
        if (name) {
            const existing = d.teamMembers.find(m => /sponsor/i.test(m.role || ''));
            if (existing) existing.name = name;
            else d.teamMembers.push({ id: 'tm-' + Date.now(), name, role: 'Consultant sponsor', grade: 'Consultant', responsibilities: 'Agrees the aim, unblocks changes and keeps the project going after rotation', initials: name.replace(/^dr\.?\s+/i, '').split(' ').map(w => w[0] || '').join('').substring(0, 3).toUpperCase() });
            d.charter.execSponsor = name;
        }
        const reg = document.querySelector('input[name="onboarding-reg"]:checked');
        if (reg) c.hraChecklist.q3 = reg.value;
        const ref = val('onboarding-reg-ref'); if (ref !== null) c.ethics = ref;
    } else if (currentStep === 4) {
        const a = val('onboarding-aim'); if (a !== null) c.aim = a;
    } else if (currentStep === 5) {
        const mt = document.querySelector('input[name="onboarding-mtype"]:checked');
        if (mt) c.outcomeKind = mt.value;
        const o = val('onboarding-outcome'); if (o !== null) c.outcome_measure = o;
        const p = val('onboarding-process'); if (p !== null) c.process_measure = p;
        const b = val('onboarding-balance'); if (b !== null) c.balance_measure = b;
        const od = val('onboarding-opdef'); if (od !== null) c.operational_definition = od;
        ['source', 'collector', 'cadence', 'sample', 'start'].forEach(k => { const v = val('onboarding-plan-' + k); if (v !== null) d.dataPlan[k] = v; });
    } else if (currentStep === 6) {
        const drivers = [0, 1, 2].map(i => (val('onboarding-driver-' + i) || '').trim()).filter(Boolean);
        if (document.getElementById('onboarding-driver-0')) {
            // Replace only the first three slots, keep anything added elsewhere
            const rest = d.drivers.primary.slice(3);
            d.drivers.primary = drivers.concat(rest);
        }
        if (document.getElementById('onboarding-idea-0')) {
            [0, 1, 2].forEach(i => {
                const t = (val('onboarding-idea-' + i) || '').trim();
                const existing = d.changeIdeas[i];
                if (existing) { if (t) existing.title = t; }
                else if (t) d.changeIdeas.push({ id: 'ci-' + Date.now() + '-' + i, title: t, description: '', driverLink: drivers[i] || '', status: 'active', pdsaCycles: [] });
            });
            d.pdsa = d.changeIdeas.flatMap(ci => ci.pdsaCycles || []);
        }
    }

    if (window.saveData) window.saveData(true);
}

function finishOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    showToast('Setup complete. Next: register the project and start your baseline.', 'success');
    if (window.router) window.router('checklist');
    if (window.renderChecklist) window.renderChecklist();
}

// Bind event listeners natively so they work automatically
document.addEventListener('DOMContentLoaded', () => {
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnPrev = document.getElementById('btn-onboarding-prev');

    if (btnNext) btnNext.addEventListener('click', nextOnboardingStep);
    if (btnPrev) btnPrev.addEventListener('click', prevOnboardingStep);

    // Expose globally for inline HTML calls
    window.startOnboarding = startOnboarding;
    window.nextOnboardingStep = nextOnboardingStep;
    window.prevOnboardingStep = prevOnboardingStep;
});
