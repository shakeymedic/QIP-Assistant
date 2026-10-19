// ==========================================
// STARTER PROJECT IDEA BANK
// ==========================================
// Fully worked starting points for a first QIP. Each entry can pre-fill the
// problem, a draft aim, the family of measures, the operational definition,
// the data collection plan, the first primary drivers and some change ideas.
// Nothing here claims a baseline figure: the baseline is always "[to be
// measured]" until the trainee has collected it.

import { state } from "./state.js";
import { QI } from "./qi-constants.js";
import { showToast } from "./utils.js";

export const STARTER_PROJECTS = [
    {
        id: 'sepsis-abx', title: 'Sepsis: time to IV antibiotics', area: 'Sepsis', size: 'medium', outcomeKind: 'percentage',
        problem: 'Adults with red-flag sepsis criteria at triage do not reliably receive IV antibiotics within 60 minutes, as NICE guidance recommends for people at high risk.',
        whereToLook: 'EPR sepsis flag or triage NEWS2, plus the drug administration record for the first antibiotic time. Many Trusts already run a sepsis dashboard; ask the sepsis lead or audit team first.',
        aim: 'To increase the percentage of adults with red-flag sepsis who receive IV antibiotics within 60 minutes of triage from [to be measured] to 90% by [date] in the Emergency Department.',
        outcome: 'Percentage of adults with red-flag sepsis receiving a first IV antibiotic within 60 minutes of triage (weekly).',
        process: 'Percentage of red-flag sepsis patients with a sepsis screening tool completed at triage.',
        balancing: 'Number of patients given IV antibiotics who were later judged not to have had an infection (over-treatment), and antibiotic stewardship concerns raised by microbiology.',
        sample: 'Every red-flag sepsis patient in the week (usually fewer than 20), one point per week.',
        drivers: ['Early recognition at triage', 'Prompt prescribing and administration', 'Availability of antibiotics and IV access'],
        changeIdeas: ['Sepsis screening prompt added to the triage template', 'Pre-made sepsis grab bags in resus and majors', 'Nurse-led escalation to the senior doctor when the screen is positive']
    },
    {
        id: 'analgesia', title: 'Time to first analgesia for severe pain', area: 'Pain', size: 'small', outcomeKind: 'time',
        problem: 'Patients who report severe pain at triage wait too long for their first dose of analgesia, and the wait varies a great deal between shifts.',
        whereToLook: 'Triage pain score on the EPR and the drug administration record. RCEM has run national audits on pain in the ED, so your department may already have comparable data.',
        aim: 'To reduce the median time from triage to first analgesia for adults with a triage pain score of 7 or more from [to be measured] to under 30 minutes by [date] in the Emergency Department.',
        outcome: 'Median minutes from triage to first documented analgesia for patients with a pain score of 7 or more (weekly).',
        process: 'Percentage of patients with a pain score recorded at triage.',
        balancing: 'Number of adverse events linked to analgesia (over-sedation, naloxone use) and triage time per patient.',
        sample: '10 to 20 consecutive eligible patients per week.',
        drivers: ['Pain score recorded at triage', 'Nurses able to give first-line analgesia under a PGD', 'Senior review for patients needing opioids'],
        changeIdeas: ['Nurse-led analgesia under a patient group direction at triage', 'Pain score visible on the tracking board', 'Teaching session on the department pain pathway']
    },
    {
        id: 'news2', title: 'NEWS2 escalation: time to review', area: 'Deteriorating patient', size: 'medium', outcomeKind: 'time',
        problem: 'Patients who trigger a high NEWS2 score in the waiting room or majors are not always reviewed by a doctor within the time the escalation policy sets.',
        whereToLook: 'Observation charts or the e-observations system for the NEWS2 trigger time, and the EPR for the time of first doctor review.',
        aim: 'To reduce the median time from a NEWS2 score of 7 or more to documented medical review from [to be measured] to under 30 minutes by [date] in the Emergency Department.',
        outcome: 'Median minutes from first NEWS2 of 7 or more to documented medical review (weekly).',
        process: 'Percentage of triggering patients where the escalation was documented on the chart or EPR.',
        balancing: 'Number of interruptions to senior clinicians per shift (staff survey) and time to review for lower-scoring patients.',
        sample: 'Every patient with NEWS2 of 7 or more in the week, or 10 to 20 consecutive if volume is high.',
        drivers: ['Observations recorded on time', 'Escalation reaches the right clinician', 'Clinician free to respond'],
        changeIdeas: ['Escalation flowchart posted at the nurse station', 'Named "first responder" doctor for each shift', 'Electronic alert when NEWS2 reaches 7']
    },
    {
        id: 'vte', title: 'VTE risk assessment in the observation unit', area: 'Safety', size: 'small', outcomeKind: 'percentage',
        problem: 'Patients admitted to the ED observation unit or CDU do not consistently have a VTE risk assessment completed, which national guidance expects for admitted adults.',
        whereToLook: 'The VTE assessment field on the EPR or the paper drug chart for CDU admissions.',
        aim: 'To increase the percentage of CDU admissions with a VTE risk assessment completed on admission from [to be measured] to 95% by [date].',
        outcome: 'Percentage of CDU admissions with a VTE risk assessment completed on admission (weekly).',
        process: 'Percentage of CDU admission clerkings using the admission template that contains the VTE field.',
        balancing: 'Time taken to complete the CDU admission clerking, and prescribing of prophylaxis to patients with a contraindication.',
        sample: '10 to 20 consecutive CDU admissions per week.',
        drivers: ['Assessment built into the admission workflow', 'Staff know who is responsible', 'Reminders when it is missing'],
        changeIdeas: ['VTE assessment made a mandatory field on the CDU admission template', 'Pharmacist check on the morning CDU round', 'Weekly feedback poster with the run chart']
    },
    {
        id: 'fracture-clinic', title: 'Quality of fracture clinic referrals', area: 'Referrals', size: 'small', outcomeKind: 'percentage',
        problem: 'Referrals from the ED to the virtual fracture clinic often miss key information (mechanism, examination findings, imaging, management given), so patients are called back or seen unnecessarily.',
        whereToLook: 'The fracture clinic referral form or e-referral system; the orthopaedic team can usually tell you how many referrals they reject or query each week.',
        aim: 'To increase the percentage of fracture clinic referrals that contain all the agreed essential fields from [to be measured] to 90% by [date] in the Emergency Department.',
        outcome: 'Percentage of referrals containing all essential fields, judged against an agreed checklist (weekly).',
        process: 'Percentage of referrals made using the structured referral template.',
        balancing: 'Time taken to complete a referral, and the number of patients not referred who should have been.',
        sample: '10 to 20 consecutive referrals per week.',
        drivers: ['A clear agreed standard for the referral', 'A template that prompts the fields', 'Feedback to referrers'],
        changeIdeas: ['Structured referral template agreed with orthopaedics', 'Laminated checklist in the plaster room', 'Monthly feedback on rejected referrals at departmental teaching']
    },
    {
        id: 'discharge-summary', title: 'Timeliness of ED discharge summaries', area: 'Communication', size: 'small', outcomeKind: 'percentage',
        problem: 'Discharge summaries to GPs are sent late or left incomplete, so primary care does not know what happened or what follow-up was planned.',
        whereToLook: 'The EPR discharge module shows when each summary was completed and sent; the IT or informatics team can usually give you a weekly extract.',
        aim: 'To increase the percentage of ED discharge summaries sent to the GP within 24 hours of discharge from [to be measured] to 95% by [date].',
        outcome: 'Percentage of discharge summaries sent within 24 hours of the discharge time (weekly).',
        process: 'Percentage of discharges where the summary was started before the patient left the department.',
        balancing: 'Length of the summaries (are they becoming unhelpfully short?) and clinician time per discharge.',
        sample: 'All discharges that week if the EPR extract is automatic; otherwise 20 consecutive discharges.',
        drivers: ['Summary completed as part of the discharge step', 'Clinicians know the standard', 'Outstanding summaries visible to the team'],
        changeIdeas: ['Discharge summary written before the patient leaves, with the EPR blocking discharge without it', 'Daily list of outstanding summaries sent to the shift lead', 'Pre-populated templates for common presentations']
    },
    {
        id: 'paracetamol-od', title: 'Paracetamol overdose pathway compliance', area: 'Toxicology', size: 'small', outcomeKind: 'percentage',
        problem: 'Patients presenting after paracetamol overdose do not always have bloods taken at the right time or acetylcysteine started when the TOXBASE pathway says it should be.',
        whereToLook: 'Find cases from the coding or triage presenting complaint, then check the EPR for the overdose time, the time of the paracetamol level and the time acetylcysteine was prescribed.',
        aim: 'To increase the percentage of paracetamol overdose presentations managed in line with the TOXBASE pathway (correctly timed paracetamol level and, where indicated, acetylcysteine started without delay) from [to be measured] to 95% by [date].',
        outcome: 'Percentage of presentations fully compliant with the pathway (weekly or fortnightly, since numbers are small).',
        process: 'Percentage of presentations where the department paracetamol proforma was used.',
        balancing: 'Number of patients started on acetylcysteine who did not need it, and ED length of stay for this group.',
        sample: 'Every paracetamol overdose presentation; expect only a few a week, so consider fortnightly points.',
        drivers: ['Overdose time established and recorded', 'Levels taken at the right time', 'Treatment decision made promptly'],
        changeIdeas: ['Paracetamol overdose proforma with a timing calculator', 'Pre-printed acetylcysteine prescription chart', 'Teaching for new doctors at induction']
    },
    {
        id: 'frailty-cfs', title: 'Clinical Frailty Scale recording for older patients', area: 'Older people', size: 'small', outcomeKind: 'percentage',
        problem: 'Patients aged 65 and over do not routinely have a Clinical Frailty Scale score recorded in the ED, so frail patients are not identified early for a frailty or geriatric review.',
        whereToLook: 'The CFS field on the EPR or triage record for patients aged 65 and over.',
        aim: 'To increase the percentage of patients aged 65 and over with a Clinical Frailty Scale score recorded in the ED from [to be measured] to 90% by [date].',
        outcome: 'Percentage of patients aged 65 and over with a CFS score recorded (weekly).',
        process: 'Percentage of triage records for this group where the frailty prompt was answered.',
        balancing: 'Triage time per patient and the number of inappropriate frailty-team referrals.',
        sample: '20 consecutive patients aged 65 and over per week.',
        drivers: ['Prompt at triage', 'Staff confident scoring the CFS', 'The score is used, so people see the point of it'],
        changeIdeas: ['CFS added as a prompt in the triage template', 'Pocket cards and a two-minute teaching video', 'Frailty team uses the score to find patients each morning']
    },
    {
        id: 'delirium-4at', title: 'Delirium screening with the 4AT', area: 'Older people', size: 'small', outcomeKind: 'percentage',
        problem: 'Delirium is often missed in older patients in the ED because no structured screen is done, which delays treatment and increases harm.',
        whereToLook: 'The 4AT field on the EPR or the paper assessment for patients aged 65 and over.',
        aim: 'To increase the percentage of patients aged 65 and over with a completed 4AT in the ED from [to be measured] to 80% by [date].',
        outcome: 'Percentage of patients aged 65 and over with a completed 4AT before admission or discharge (weekly).',
        process: 'Percentage of this group where the 4AT prompt appears in the clerking template.',
        balancing: 'Clerking time and the number of patients referred for delirium who had another cause.',
        sample: '20 consecutive patients aged 65 and over per week.',
        drivers: ['Screen built into the clerking', 'Clinicians know what to do with a positive screen', 'Feedback on completion rates'],
        changeIdeas: ['4AT embedded in the over-65s clerking template', 'Delirium pathway poster with the next steps after a positive screen', 'Run chart shown at the monthly governance meeting']
    },
    {
        id: 'hip-fib', title: 'Fascia iliaca block for hip fracture', area: 'Pain', size: 'medium', outcomeKind: 'time',
        problem: 'Patients with a suspected hip fracture wait a long time for a fascia iliaca block, so they receive more opioid and experience more pain than necessary.',
        whereToLook: 'Hip fracture patients from the National Hip Fracture Database or ED coding; block time from the procedure note on the EPR.',
        aim: 'To reduce the median time from ED arrival to fascia iliaca block for patients with a confirmed hip fracture from [to be measured] to under 2 hours by [date].',
        outcome: 'Median minutes from arrival to block for confirmed hip fractures (weekly).',
        process: 'Percentage of hip fracture patients offered a block (documented offer or contraindication).',
        balancing: 'Block complications and the time the block takes a clinician away from other patients.',
        sample: 'Every confirmed hip fracture that week (typically 5 to 15).',
        drivers: ['Early identification of hip fracture', 'Enough trained clinicians on each shift', 'Equipment ready to hand'],
        changeIdeas: ['Block trolley stocked and checked daily', 'Training sessions so each shift has a trained clinician', 'Hip fracture pathway triggers an early X-ray and a block prompt']
    },
    {
        id: 'safety-netting', title: 'Documented safety netting on discharge', area: 'Safety', size: 'small', outcomeKind: 'percentage',
        problem: 'Discharge notes often do not record the safety-netting advice given, so it is unclear what the patient was told to look out for and when to return.',
        whereToLook: 'A sample of discharge records on the EPR, checked against an agreed definition of adequate safety netting.',
        aim: 'To increase the percentage of ED discharges with documented, specific safety-netting advice from [to be measured] to 90% by [date].',
        outcome: 'Percentage of sampled discharge records with documented specific safety-netting advice (weekly).',
        process: 'Percentage of discharges using the discharge template with a safety-netting field.',
        balancing: 'Unplanned re-attendance within 72 hours and the length of the discharge consultation.',
        sample: '20 consecutive discharges per week.',
        drivers: ['Clinicians know what good safety netting is', 'The template prompts it', 'Written advice leaflets available'],
        changeIdeas: ['Safety-netting field added to the discharge template', 'Condition-specific advice leaflets printed with the discharge summary', 'Short teaching session with examples of good and poor documentation']
    },
    {
        id: 'allergy-documentation', title: 'Allergy status recorded before first prescription', area: 'Medicines safety', size: 'small', outcomeKind: 'percentage',
        problem: 'Drugs are sometimes prescribed in the ED before the patient\'s allergy status has been recorded, which risks a serious allergic reaction.',
        whereToLook: 'The allergy field and the first prescription time on the EPR or drug chart.',
        aim: 'To increase the percentage of patients with allergy status documented before their first ED prescription from [to be measured] to 98% by [date].',
        outcome: 'Percentage of patients with allergy status recorded before the first prescription (weekly).',
        process: 'Percentage of triage assessments where the allergy field was completed.',
        balancing: 'Triage time per patient and delays to time-critical drugs.',
        sample: '20 consecutive patients who received a prescription, per week.',
        drivers: ['Allergy status captured at triage', 'Prescribing system blocks prescriptions without it', 'Pharmacy feedback'],
        changeIdeas: ['Allergy field made mandatory at triage', 'Red allergy wristband applied at triage', 'Pharmacist audit with feedback to the shift lead']
    },
    {
        id: 'asthma-steroids', title: 'Steroids within one hour for acute asthma', area: 'Respiratory', size: 'small', outcomeKind: 'percentage',
        problem: 'Patients with acute asthma do not reliably receive oral or IV steroids within an hour of arrival, as national asthma guidance recommends.',
        whereToLook: 'Asthma presentations from coding or the triage complaint; steroid time from the drug administration record.',
        aim: 'To increase the percentage of adults with acute asthma who receive systemic steroids within 60 minutes of arrival from [to be measured] to 90% by [date].',
        outcome: 'Percentage of acute asthma presentations receiving steroids within 60 minutes (weekly).',
        process: 'Percentage of presentations with a peak flow recorded at triage.',
        balancing: 'Steroids given to patients later found not to have asthma, and ED length of stay for asthma presentations.',
        sample: 'Every acute asthma presentation that week.',
        drivers: ['Asthma recognised at triage', 'Steroid prescribed at first assessment', 'Nurse able to give steroids early'],
        changeIdeas: ['Asthma pathway proforma with steroid prompt', 'Nurse-led steroid administration under a PGD', 'Peak flow meters at every triage desk']
    },
    {
        id: 'head-ct', title: 'CT head within one hour for high-risk head injury', area: 'Imaging', size: 'medium', outcomeKind: 'percentage',
        problem: 'Patients with head injury who meet NICE criteria for a CT within one hour often wait longer, delaying the diagnosis of intracranial bleeding.',
        whereToLook: 'Head injury presentations from the triage complaint; the CT request and scan times from the radiology system.',
        aim: 'To increase the percentage of patients meeting NICE one-hour CT head criteria who are scanned within 60 minutes of the criteria being identified from [to be measured] to 90% by [date].',
        outcome: 'Percentage of eligible patients scanned within 60 minutes (weekly).',
        process: 'Percentage of eligible patients whose CT was requested within 15 minutes of assessment.',
        balancing: 'Number of CT head scans with no clinical indication, and waiting time for other CT requests.',
        sample: 'Every eligible head injury that week, or 10 to 20 consecutive if volume is high.',
        drivers: ['Criteria recognised at triage or first assessment', 'Request made promptly', 'Radiology prioritises the request'],
        changeIdeas: ['Head injury criteria checklist on the triage template', 'Agreement with radiology on a one-hour priority code', 'Senior nurse able to request CT under a protocol']
    },
    {
        id: 'handover', title: 'Structured handover at shift change', area: 'Communication', size: 'small', outcomeKind: 'percentage',
        problem: 'Handover between shifts is unstructured, so outstanding tasks and pending results are missed and have to be rediscovered by the next team.',
        whereToLook: 'Direct observation of handover using a short checklist, or a quick survey of the receiving team at the end of each handover.',
        aim: 'To increase the percentage of handovers that cover all the agreed structured elements for every patient from [to be measured] to 90% by [date].',
        outcome: 'Percentage of observed handovers meeting the agreed standard (two or three observations per week).',
        process: 'Percentage of handovers using the printed handover template.',
        balancing: 'Length of handover in minutes and staff satisfaction with handover (short survey).',
        sample: 'Observe two or three handovers per week with a checklist.',
        drivers: ['An agreed structure everyone knows', 'A tool that supports it', 'Senior leadership of the handover'],
        changeIdeas: ['SBAR-style handover sheet printed from the EPR', 'Handover led by the senior doctor in a protected space', 'Five-minute teaching on the structure for new starters']
    }
];

// Operational definition templates by measure type. The trainee edits them;
// they exist so the "what counts" questions are asked before the first point.
export const OP_DEF_TEMPLATES = {
    percentage: 'Numerator: number of [patients/episodes] in the sample who [met the standard, e.g. received X within 60 minutes of Y]. Denominator: all [eligible patients] in the sample, excluding [stated exclusions]. Eligible means [definition]. Source: [EPR field / chart / observation]. Collected [weekly] by [who], from [sample rule, e.g. the first 20 eligible patients that week].',
    time: 'Measure: minutes from [start event, e.g. triage time stamp] to [end event, e.g. first documented dose]. Each weekly point is the median of [10 to 20 consecutive eligible patients]. Eligible means [definition], excluding [stated exclusions]. Source: [EPR fields]. Collected [weekly] by [who].',
    count: 'Count of [events, e.g. incidents, missed doses, calls] per [week/100 patients]. An event counts when [definition]. Source: [where the events are recorded]. Collected [weekly] by [who]. Denominator for a rate: [e.g. ED attendances that week].'
};

export function starterById(id) {
    return STARTER_PROJECTS.find(s => s.id === id) || null;
}

// Fill the project from a starter. Only empty fields are written unless
// `overwrite` is true, so a trainee who has started typing keeps their words.
export function applyStarterProject(id, overwrite = false) {
    const s = starterById(id);
    const d = state.projectData;
    if (!s || !d) return false;
    if (!d.checklist) d.checklist = {};
    const c = d.checklist;
    const put = (key, val) => { if (overwrite || !String(c[key] || '').trim()) c[key] = val; };
    put('problem_desc', s.problem);
    put('problem_evidence', 'Where to look for a baseline: ' + s.whereToLook);
    put('aim', s.aim);
    put('outcome_measure', s.outcome);
    put('process_measure', s.process);
    put('balance_measure', s.balancing);
    put('outcomeKind', s.outcomeKind);
    put('operational_definition', OP_DEF_TEMPLATES[s.outcomeKind] || OP_DEF_TEMPLATES.percentage);
    if (!d.dataPlan || typeof d.dataPlan !== 'object') d.dataPlan = {};
    if (overwrite || !String(d.dataPlan.source || '').trim()) d.dataPlan.source = s.whereToLook;
    if (overwrite || !String(d.dataPlan.sample || '').trim()) d.dataPlan.sample = s.sample;
    if (overwrite || !String(d.dataPlan.cadence || '').trim()) d.dataPlan.cadence = 'weekly';
    if (!d.meta) d.meta = {};
    if (overwrite || !d.meta.title || d.meta.title === 'New QIP') d.meta.title = s.title;
    d.meta.starterId = s.id;

    if (!d.drivers || typeof d.drivers !== 'object') d.drivers = { primary: [], secondary: [], changes: [] };
    ['primary', 'secondary', 'changes'].forEach(k => { if (!Array.isArray(d.drivers[k])) d.drivers[k] = []; });
    if (overwrite || d.drivers.primary.length === 0) d.drivers.primary = s.drivers.slice();
    if (!Array.isArray(d.changeIdeas)) d.changeIdeas = [];
    if (overwrite || d.changeIdeas.length === 0) {
        d.changeIdeas = s.changeIdeas.map((t, i) => ({
            id: 'ci-' + Date.now() + '-' + i, title: t, description: '', driverLink: s.drivers[Math.min(i, s.drivers.length - 1)] || '',
            status: 'active', pdsaCycles: []
        }));
        d.pdsa = d.changeIdeas.flatMap(ci => ci.pdsaCycles || []);
    }
    if (window.saveData) window.saveData(true);
    showToast('Starter project applied. Everything it filled in is yours to edit.', 'success');
    return true;
}

export function starterCardHtml(s, escapeHtml) {
    const sizeLabel = s.size === 'small' ? 'Small: fits one rotation' : 'Medium: needs a team and a full rotation';
    return `
        <div class="border border-slate-200 p-3 rounded-lg hover:bg-slate-50">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">${escapeHtml(s.title)}</h4>
                    <p class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(s.area)} · ${sizeLabel} · ${s.outcomeKind === 'time' ? 'Time measure' : s.outcomeKind === 'count' ? 'Count measure' : 'Percentage measure'}</p>
                </div>
                <button type="button" onclick="window.selectTopic('${s.id}')" class="flex-shrink-0 text-xs bg-rcem-purple text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-800">Use this starter</button>
            </div>
            <p class="text-xs text-slate-600 mt-2">${escapeHtml(s.problem)}</p>
            <details class="mt-2">
                <summary class="text-xs text-indigo-600 cursor-pointer">What it fills in</summary>
                <div class="text-xs text-slate-600 mt-2 space-y-1">
                    <p><strong>Draft aim:</strong> ${escapeHtml(s.aim)}</p>
                    <p><strong>Outcome:</strong> ${escapeHtml(s.outcome)}</p>
                    <p><strong>Process:</strong> ${escapeHtml(s.process)}</p>
                    <p><strong>Balancing:</strong> ${escapeHtml(s.balancing)}</p>
                    <p><strong>Where to look for the data:</strong> ${escapeHtml(s.whereToLook)}</p>
                    <p><strong>Sample:</strong> ${escapeHtml(s.sample)}</p>
                    <p><strong>First drivers:</strong> ${s.drivers.map(escapeHtml).join('; ')}</p>
                    <p><strong>Change ideas to test:</strong> ${s.changeIdeas.map(escapeHtml).join('; ')}</p>
                </div>
            </details>
        </div>`;
}

export const BASELINE_NOTE = `Collect ${QI.BASELINE_MIN} to ${QI.BASELINE_TARGET} baseline points before you change anything.`;
