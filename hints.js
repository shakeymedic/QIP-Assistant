// hints.js — hover / tap hints for each step and field.
//
// Every label or heading whose text matches an entry below gets a small "?"
// button. Hovering (or tapping, on touch screens) shows what the item means,
// what good looks like and worked examples. Examples can be copied, or used
// as a starting point when the field is still empty.
//
// Matching is by the visible label text (see normaliseLabel), so hints follow
// the labels wherever they are rendered — no renderer needs changing. An
// element can also opt in explicitly with data-hint="key".
//
// The examples are illustrative and fictional; they are not RCEM text.

import { escapeHtml } from "./utils.js";

// key → { title, what, tips?, examples? }
// Keys are normalised label text. "context:label" keys apply only inside an
// element with that id (used where the same label means different things).
export const HINTS = {
    // ── Define & Measure ────────────────────────────────────────────────────
    'problem definition': {
        title: 'Problem definition',
        what: 'A short, factual description of the gap between what happens now and what should happen, backed by local data. It explains why the project matters before you suggest any solution.',
        tips: ['Describe the problem, not the fix ("too few patients get X", not "we need a new proforma").', 'Quote your own baseline data and the standard you are measuring against.', 'Say who is affected and where.']
    },
    'problem statement': {
        title: 'Problem statement',
        what: 'One or two sentences stating the problem, its size and why it matters. It should make sense to someone outside your department.',
        tips: ['Include a number from your baseline data.', 'Avoid blaming people; describe the system.', 'Leave the solution out — that comes later.'],
        examples: [
            'Only 42% of adults with red-flag sepsis in our ED receive IV antibiotics within 60 minutes of triage (13 weeks of baseline data, 247 patients), against national guidance of within one hour for people at high risk.',
            'Patients aged 65 and over are rarely screened for delirium in our ED: 21% had a documented 4AT in a 6-week baseline, so delirium is likely to be missed.'
        ]
    },
    'department context & setting': {
        title: 'Department context and setting',
        what: 'The local picture a reader needs to understand your project: size and type of department, staffing, systems and pressures.',
        tips: ['Annual attendances, type of hospital and relevant services.', 'Anything that makes the problem harder here (crowding, staffing, IT).', 'Who sponsored the project and how it was registered.'],
        examples: ['District general hospital ED, about 85,000 attendances a year, 24-hour consultant presence and frequent crowding in Majors. Sepsis screening is part of nurse triage. Registered with the Trust audit and QI team and sponsored by the ED clinical lead.']
    },
    'baseline evidence & data': {
        title: 'Baseline evidence and data',
        what: 'The data showing how big the problem is before you change anything. Ideally collected over time (weekly or daily), so you can plot a run chart and see normal variation.',
        tips: ['Aim for at least 10–12 data points before your first change.', 'Say how and when the data were collected and how many patients were included.', 'Add a breakdown of causes if you have one (a Pareto chart is ideal).'],
        examples: ['Weekly data June–August 2025: median 42% (range 38–46%) received antibiotics within 60 minutes. Median time from triage to antibiotics 94 minutes. Review of 120 late cases: waiting for a prescriber 41, equipment not found 33, difficult cannulation 17.']
    },
    'strengths': { ref: 'swot' }, 'weaknesses': { ref: 'swot' }, 'opportunities': { ref: 'swot' }, 'threats': { ref: 'swot' },
    'swot': {
        title: 'SWOT analysis',
        what: 'Strengths and weaknesses are internal to your team or department; opportunities and threats come from outside it. It helps you plan around risks and use what you already have.',
        examples: ['Strength: engaged sepsis champion. Weakness: no protected QI time. Opportunity: Trust sepsis priority this year. Threat: winter pressures and staff turnover.']
    },
    'political': { ref: 'pest' }, 'economic': { ref: 'pest' }, 'social': { ref: 'pest' }, 'technological': { ref: 'pest' },
    'pest': {
        title: 'PEST analysis',
        what: 'A scan of the wider environment: Political (policy, national priorities), Economic (money, resources), Social (staff and patient attitudes) and Technological (IT, equipment) factors that could help or hinder the project.',
        examples: ['Political: sepsis is a Trust patient-safety priority. Economic: changes must be cost-neutral. Social: nurses want more autonomy. Technological: the EPR can add a triage prompt.']
    },
    'smart aim': {
        title: 'SMART aim',
        what: 'A single statement of what you will improve, by how much and by when. SMART = Specific, Measurable, Achievable, Relevant, Time-bound.',
        tips: ['Pattern: To [increase/decrease] [measure] from [baseline] to [target] by [date] in [setting].', 'Use the same measure as your outcome measure and run chart.', 'Choose a stretching but realistic target and date.']
    },
    'aim statement': {
        title: 'Aim statement',
        what: 'Your SMART aim: what, for whom, from what baseline, to what target, by when, where.',
        tips: ['Pattern: To [increase/decrease] [measure] from [baseline] to [target] by [date] in [setting].', '"Improve" or "raise awareness" alone are not measurable.'],
        examples: [
            'To increase the percentage of adult patients with red-flag sepsis who receive IV antibiotics within 60 minutes of triage in our ED from a median of 42% to 90% by 31 May 2026.',
            'To increase documented 4AT delirium screening in patients aged 65 and over in our ED from 21% to 70% by 31 March 2027.'
        ]
    },
    'numeric target — draws a dashed line on your run chart': {
        title: 'Numeric target',
        what: 'The number from your aim (just the number). It is drawn as a dashed line on your primary run chart so everyone can see how close you are.',
        examples: ['90']
    },
    'secondary smart aim': {
        title: 'Secondary SMART aim (optional)',
        what: 'A second aim for projects with two goals, often a time or experience measure alongside the main outcome. Keep it SMART too.',
        examples: ['To reduce the median time from triage to first IV antibiotic from 94 minutes to under 60 minutes by 31 May 2026.']
    },
    'family of measures': {
        title: 'Family of measures',
        what: 'A small set of measures that together show whether the change is an improvement: outcome (did patients benefit?), process (are we doing the new steps?) and balancing (did we cause a problem elsewhere?).',
        tips: ['One outcome, two or three process and one or two balancing measures is plenty.', 'Each should have a clear operational definition.', 'Track them over time, not just before and after.']
    },
    'outcome measure': {
        title: 'Outcome measure',
        what: 'How the system is performing for patients: the result you are trying to improve. Usually the measure in your aim.',
        tips: ['Write it as a measurable quantity (%, minutes, rate).', 'Say how often it is collected and from where.'],
        examples: ['% of adult red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage (weekly, all eligible patients, from the EPR sepsis flag).']
    },
    'process measure': {
        title: 'Process measure',
        what: 'Whether the steps you changed are actually happening. It explains why the outcome moved (or did not).',
        examples: ['Median minutes from triage to first antibiotic; % of days the sepsis trolley check was completed; % of eligible nurses trained in the PGD.']
    },
    'balancing measure': {
        title: 'Balancing measure',
        what: 'A check that improving one thing has not made something else worse, for example in another part of the department or for other patients.',
        examples: ['Inappropriate antibiotic starts per month (pharmacy review); time to assessment for other Majors patients.']
    },
    'operational definition': {
        title: 'Operational definition',
        what: 'A precise description of how a measure is calculated, so anyone collecting the data would get the same answer: numerator, denominator, inclusions, exclusions, data source and timing.',
        examples: ['Numerator: adults with a red-flag sepsis criterion at triage who receive a first IV antibiotic within 60 minutes of the triage time stamp. Denominator: all adults with a red-flag criterion at triage that week, excluding end-of-life care and transfers already given antibiotics. Source: EPR, extracted every Monday.']
    },
    'ethics & governance': {
        title: 'Ethics and governance',
        what: 'Confirms the project is QI or service evaluation, not research, and is registered with your Trust. Use the HRA decision tool if unsure; QI usually needs local registration but not research ethics approval.',
        tips: ['Record the decision-tool outcome and your local registration reference.', 'Explain how patient data are kept secure and anonymised.']
    },
    'notes / registration reference': {
        title: 'Governance notes and registration',
        what: 'Your local QI or audit registration number and any approvals needed (for example a PGD needs medicines committee approval).',
        examples: ['HRA decision tool completed May 2025: not research. Registered with the Trust audit and QI team (ref QI-2025-031). PGD approved by the medicines committee in October 2025.']
    },
    'literature review': {
        title: 'Literature review',
        what: 'A short summary of the guidance and evidence behind your standard and your change ideas. It shows why the problem matters and what has worked elsewhere.',
        tips: ['Start with national guidance (NICE, RCEM, specialty societies).', 'Add QI studies of similar changes, not just clinical trials.', 'Say how the evidence shaped your choices.']
    },
    'reference list': {
        title: 'Reference list',
        what: 'The sources you used, with one line on why each matters. Five or more good references is a sensible target for a higher-trainee project.',
        examples: ['National Institute for Health and Care Excellence. Suspected sepsis: recognition, diagnosis and early management (NG51). Key point: antibiotics within one hour for people at high risk.']
    },
    'additional notes / narrative': {
        title: 'Literature narrative',
        what: 'A few sentences tying the references together: what the evidence says and how it informed your aim and change ideas.'
    },
    'results & analysis': {
        title: 'Results and analysis',
        what: 'What the data show over time and whether changes led to improvement, judged with run chart or SPC rules rather than before-and-after averages.'
    },
    'analysis of results': {
        title: 'Analysis of results',
        what: 'Interpret your charts: which rules were met (shift, trend, points outside control limits), when, and which PDSA cycle they follow. Mention the balancing measure.',
        tips: ['Shift: 6 or more consecutive points all above or all below the median.', 'Trend: 5 or more consecutive points all going up or all going down.', 'Say honestly when a change made no difference.'],
        examples: ['A shift of six points above the baseline median followed the sepsis trolley, and a second sustained shift followed the nurse PGD. Teaching alone produced no signal. The balancing measure showed only common cause variation. The 90% aim was met from February 2026.']
    },
    'results interpretation': { ref: 'analysis of results' },
    'learning & sustainability': {
        title: 'Learning and sustainability',
        what: 'What you and the team learned, and how the improvement will last after you rotate.'
    },
    'key learning points': {
        title: 'Key learning points',
        what: 'Honest reflections on what worked, what did not and why — about QI methods, teams and yourself, not only the clinical topic.',
        examples: ['System changes beat education: teaching raised awareness but did not move the data; changing where kit lives and who can start treatment did.', 'Involve sceptics early: microbiology concerns about the PGD were solved by adding a balancing measure and a review point.']
    },
    'sustainability summary': {
        title: 'Sustainability',
        what: 'How the change will be kept going: who owns it, how it is built into routine work and how it will be monitored.',
        tips: ['Build changes into systems (checklists, IT, induction) so they do not depend on one person.', 'Name an owner and a monitoring routine with an escalation point.'],
        examples: ['Trolley checks are on the daily nursing checklist; the PGD is in the competency booklet; the EPR prompt is permanent; the outcome is reported monthly at governance with escalation below 85% for two months.']
    },
    'who will adopt this': { title: 'Who will adopt this?', what: 'The next teams or sites that could take up the change.', examples: ['The neighbouring ED in our Trust, then the acute medical unit.'] },
    'infrastructure required': { title: 'Infrastructure required', what: 'What another team would need to copy the change: equipment, training, IT, approvals.', examples: ['A second set of trolleys, PGD training slots and the EPR prompt switched on at the second site.'] },
    'maintenance plan': { title: 'Maintenance plan', what: 'Who keeps the change going day to day and how they will know if it slips.', examples: ['The sepsis champion owns trolley checks and the monthly audit; the consultant sponsor owns the governance report.'] },
    'spread timeline': { title: 'Spread timeline', what: 'When each next team or site is expected to adopt the change.', examples: ['Second ED from September 2026; acute medical unit scoping in early 2027.'] },
    'embedding strategy': { title: 'Embedding strategy', what: 'How the change becomes "the way we do things here" — built into induction, policies, IT and checklists.', examples: ['Built into induction, nursing competencies and the EPR, so it does not depend on one person.'] },
    "next year's pdp": {
        title: "Next year's PDP",
        what: 'Your personal development goals in QI for next year, building on what you learned.',
        examples: ['Lead a QIP at the ED–acute medicine interface, supervise two junior trainees through their first QI projects and complete formal SPC training.']
    },
    'failure mode & effect analysis': {
        title: 'Failure Mode and Effects Analysis (FMEA)',
        what: 'A structured look at each step of a process: how it could fail, what the effect would be, and how likely, severe and detectable each failure is. Multiply the three scores (1–10 each) to get a risk priority number (RPN) and tackle the highest first.',
        examples: ['Step: prescribe first dose. Failure: no prescriber available. Effect: delay of 30+ minutes. Likelihood 8, severity 8, detectability 4 (RPN 256). Mitigation: nurse PGD.']
    },
    'patient and public involvement': {
        title: 'Patient and public involvement',
        what: 'Patient and carer views that shaped or tested your changes. Record feedback without names, dates of birth or NHS numbers.',
        examples: ['"Nobody explained why my mum needed antibiotics before the doctor saw her." Action: added a short explanation for families to the PGD training.']
    },

    // ── Charter & action plan ──────────────────────────────────────────────
    'project charter': {
        title: 'Project charter',
        what: 'A one-page agreement of what the project is, why it matters, its scope, team, milestones and resources, signed off by your sponsor or line manager. It stops scope creep and secures support early.'
    },
    'executive sponsor': { title: 'Executive sponsor', what: 'A senior person (often a consultant or clinical lead) who supports the project and can unblock problems with the wider organisation.', examples: ['Dr P Shah, ED consultant and clinical lead.'] },
    'key area of focus': { title: 'Key area of focus', what: 'The quality domain or priority the project addresses (for example patient safety, timeliness, experience).', examples: ['Patient safety: sepsis.'] },
    'objectives': { title: 'Objectives', what: 'The concrete steps that will deliver the aim, one per line.', examples: ['Collect 12 weeks of baseline data.\nTest at least three change ideas using PDSA cycles.\nReach 90% and hold it for 12 weeks.'] },
    'project scope – in': { title: 'Scope: in', what: 'Exactly which patients, areas and times the project covers.', examples: ['Adults (16+) with red-flag sepsis at triage in Majors and Resus.'] },
    'project scope – out': { title: 'Scope: out', what: 'What the project deliberately does not cover, so it stays manageable.', examples: ['Children; end-of-life care; care after admission to a ward.'] },
    'benefits': { title: 'Benefits', what: 'The expected benefits, how each will be measured and who gains.', examples: ['Faster antibiotics for sepsis — % within 60 minutes — patients.'] },
    'costs': { title: 'Costs', what: 'Money, equipment and staff time needed, and who holds the budget. Many QI projects are cost-neutral; say so.', examples: ['Sepsis trolleys borrowed from theatres — £0 — ED matron.'] },
    'milestones': {
        title: 'Milestones',
        what: 'Key dates for the project, taken from your Timeline. Mark a Timeline task as a milestone to show it here. The NHS QSIR phases are a useful set: scope, measure and understand, design and plan, pilot and implement, sustain and share, from start-out to sustain and share.'
    },
    'project team': { title: 'Project team', what: 'Who is on the team, their role and how much time they will give.', examples: ['Sepsis champion (band 7) — trolley and checks — 2 hours a week.'] },
    'additional resources': { title: 'Additional resources', what: 'Anything else you need, such as analyst time or space on a committee agenda.' },
    'action plan': {
        title: 'Action plan',
        what: 'A list of owned, dated actions that turn objectives and change ideas into work. Update the status as you go so the team can see what is outstanding.',
        examples: ['Objective: let nurses start the first dose. Action: write the PGD and take it to the medicines committee. By: pharmacist, 7 November.']
    },
    'timeline': {
        title: 'Timeline (Gantt chart)',
        what: 'Shows when each phase, PDSA cycle and milestone happens, who owns it and what depends on what. Useful for planning and for your portfolio.'
    },

    // ── Team & stakeholders ─────────────────────────────────────────────────
    'qi team': {
        title: 'QI team',
        what: 'The people doing the work. A multi-disciplinary team (nursing, medical, pharmacy, IT, patients) makes changes stick.',
        tips: ['Include the people who do the process every day.', 'Give everyone a clear role and responsibility.']
    },
    'leadership engagement log': {
        title: 'Leadership engagement log',
        what: 'A dated record of leadership moments: meetings, negotiations, presentations, handling resistance. It is strong evidence for the leadership parts of the QIAT.',
        examples: ['2 Oct 2025: joint meeting with microbiology and pharmacy about nurse-initiated antibiotics; agreed a balancing measure and a three-month review.']
    },
    'stakeholder matrix': {
        title: 'Stakeholder power/interest matrix',
        what: 'Plots everyone affected by the project by their power (influence over it) and interest (how much it affects them). High power, high interest: manage closely. High power, low interest: keep satisfied. Low power, high interest: keep informed. Low power, low interest: monitor.',
        examples: ['Medicines committee: high power, low interest — keep satisfied with short, clear updates before each meeting.']
    },

    // ── Diagnosis tools ─────────────────────────────────────────────────────
    'diagnosis tools': {
        title: 'Diagnosis tools',
        what: 'Tools for understanding the problem before changing anything.',
        tips: ['Driver diagram: links your aim to the factors that drive it and the change ideas to test.', 'Fishbone: groups possible causes (people, methods, equipment, environment, measurement, management).', 'Process map: walks through each step as it really happens, to spot delays and waste.', '5 Whys: keeps asking "why?" to get from a symptom to a root cause.']
    },
    'driver diagram': {
        title: 'Driver diagram',
        what: 'Your theory of change. The aim sits on the left; primary drivers are the main factors that must change to achieve it; secondary drivers are the specific areas you can act on; change ideas are what you will test.',
        examples: ['Aim: 90% antibiotics within 60 minutes → Primary driver: equipment accessibility → Secondary driver: sepsis equipment location → Change idea: dedicated sepsis trolley.']
    },

    // ── PDSA ────────────────────────────────────────────────────────────────
    'pdsa cycles': {
        title: 'PDSA cycles',
        what: 'Plan–Do–Study–Act: small, rapid tests of a change. Each change idea can have several cycles, usually starting small (one shift, one area) and growing as confidence builds.',
        tips: ['Always write a prediction before you start.', 'Study the data against the prediction.', 'Act: adopt, adapt or abandon — abandoning is fine and shows learning.']
    },
    'new change idea': { ref: 'idea title' },
    'idea title': {
        title: 'Change idea',
        what: 'A specific, testable change that comes from your driver diagram. Each change idea can have one or more PDSA cycles.',
        examples: ['Dedicated sepsis trolley', 'Nurse-initiated antibiotics under a PGD', 'EPR sepsis prompt at triage']
    },
    'linked driver change': { title: 'Linked driver', what: 'The driver or change idea on your driver diagram that this idea tests. It keeps your PDSA work connected to your theory of change.' },
    'cycle title': {
        title: 'Cycle title',
        what: 'A short name saying what this cycle tests, and where or for how long.',
        examples: ['PDSA 2a: Sepsis trolley in Majors bays 1–6', 'PDSA 3: PGD pilot on day shifts']
    },
    'cycle template': { title: 'Cycle template', what: 'Pre-filled wording for common kinds of test (for example education, equipment, IT). Edit it to fit your project.' },
    'plan': {
        title: 'Plan',
        what: 'What you will do, who, where, when and for how long, and what data you will collect. Keep the first test small.',
        examples: ['Put one stocked sepsis trolley in Majors bays 1–6; healthcare assistant checks it each morning using a tick list. Run for three weeks and keep collecting the weekly outcome.']
    },
    'prediction': {
        title: 'Prediction',
        what: 'What you expect to happen and why, written before the test. Required for ARCP evidence: comparing results with the prediction is how you learn.',
        examples: ['We predict time from triage to antibiotics will fall by at least 15 minutes in bays 1–6, and the check will be done on at least 80% of days.']
    },
    'do': {
        title: 'Do',
        what: 'What actually happened when you ran the test, including problems and surprises.',
        examples: ['Trolley in place from 29 September. Checked on 19 of 21 days. Two stock-outs of blood culture bottles in week 2.']
    },
    'study': {
        title: 'Study',
        what: 'Compare the results with your prediction. Did the data change on the run chart? What did you learn?',
        examples: ['Median time in bays 1–6 fell from 94 to 74 minutes; overall compliance reached 58–62%. Prediction met.']
    },
    'act — adopt / adapt / abandon': {
        title: 'Act',
        what: 'Decide what to do next: adopt the change, adapt it and test again, or abandon it. Say why.',
        examples: ['Adapt: add a laminated restock list and a second set of culture bottles, then extend to Resus.', 'Abandon teaching as the main change: awareness was not the problem.']
    },

    // ── Data ────────────────────────────────────────────────────────────────
    'data & spc charts': {
        title: 'Data and charts',
        what: 'Plot your measures over time. A run chart (with the median) is enough for most projects; an SPC chart adds control limits to separate common cause from special cause variation.',
        tips: ['Run chart rules: shift = 6+ points one side of the median; trend = 5+ points rising or falling.', 'Use Pareto for categories (such as reasons for delay) and Before/After for paired scores.', 'Mark your PDSA cycles and key events on the chart.']
    },
    'add data': { title: 'Add data', what: 'Add each data point with its date, value and phase. Regular points over time (for example weekly) are far more useful than one before and one after.' },
    'phase — e.g. baseline, pdsa 1': {
        title: 'Phase',
        what: 'Which stage of the project the point belongs to. The earliest phase is treated as your baseline; Before/After charts compare the first and last phases.',
        examples: ['Baseline', 'PDSA 1 Teaching', 'PDSA 2 Sepsis trolley', 'Sustain']
    },
    'note': { title: 'Note', what: 'Anything that explains an unusual point (staffing, IT downtime, a bank holiday). For Pareto data, use it for the category; for Before/After, start it with an ID to pair points.', examples: ['Two agency nurses covering Majors all week', 'Staff 03 — confidence score'] },
    'results & measurements': { title: 'Results and measurements', what: 'All your measures in one place, with their definitions, charts and your interpretation.' },
    'measures': { title: 'Measures', what: 'Each measure you track, tagged as outcome, process or balancing and with a type (proportion, time, count, score or category) so the app picks a suitable chart.' },
    'quick add data point': { title: 'Quick add data point', what: 'Add a point to your primary measure without leaving the dashboard.' },

    // ── Surveys, green, dashboard ───────────────────────────────────────────
    'surveys and feedback': {
        title: 'Surveys and feedback',
        what: 'Import staff or patient survey results (CSV) and summarise what they show. Surveys help understand the problem and test whether changes feel better to the people involved.',
        tips: ['Keep surveys short and anonymous.', 'Use the same question before and after a change if you want to compare.']
    },
    'nhs net zero carbon calculator': {
        title: 'Green ED / carbon',
        what: 'Estimates the carbon saved by your changes (less waste, travel or energy). Sustainability is part of quality, and an estimate strengthens the case for spreading the change.'
    },
    'portfolio readiness': { title: 'Portfolio readiness', what: 'A checklist of what your QIP needs for SLO 11 evidence, scored from what you have entered. Click an item to go to that section.' },
    'arcp countdown': { title: 'ARCP countdown', what: 'Enter your ARCP date to see how long you have left to finish and get sign-off.' },

    // ── Sign-off ────────────────────────────────────────────────────────────
    'slo 11 supervisor review & sign-off': {
        title: 'SLO 11 sign-off',
        what: 'Your supervisor reviews your EM QIAT and signs off SLO 11 here before ARCP. Add your supervisor by email in Settings → Project access so they can see the project.'
    },
    'departmental qip lead visibility': { title: 'QIP Lead visibility', what: 'Departmental QIP Leads can see every QIP in the department by default. You can hide this project from that blanket view; people you add individually can still see it.' },

    // ── EM QIAT overview (only inside the EM QIAT form) ─────────────────────
    'emqiat:background': { title: 'Background', what: 'One or two sentences on the problem and your baseline data.', examples: ['A median of 42% of red-flag sepsis patients in our ED received IV antibiotics within 60 minutes of triage (13 weeks of baseline data, 247 patients).'] },
    'emqiat:aim': { title: 'Aim', what: 'Your SMART aim, as in Define & Measure.', examples: ['Increase this from 42% to 90% by 31 May 2026.'] },
    'emqiat:understanding the problem': { title: 'Understanding the problem', what: 'The diagnostic work you did (process map, fishbone, 5 Whys, Pareto, surveys) and what it showed.', examples: ['Process mapping, a fishbone and a Pareto chart of 120 late cases showed the main causes were waiting for a prescriber and finding equipment.'] },
    'emqiat:measures': { title: 'Measures', what: 'Your outcome, process and balancing measures.', examples: ['Outcome: % within 60 minutes (weekly). Process: median time to antibiotics. Balancing: inappropriate antibiotic starts per month.'] },
    'emqiat:interventions': { title: 'Interventions', what: 'Each PDSA cycle and whether you adopted, adapted or abandoned it.', examples: ['PDSA 1 teaching (abandoned); PDSA 2 sepsis trolley (adopted); PDSA 3 nurse PGD (adapted, then adopted); PDSA 4 EPR prompt (adopted).'] },
    'emqiat:results': { title: 'Results', what: 'What your run or SPC chart showed, with numbers.', examples: ['Shifts after the trolley and the PGD; median 91% over the final 12 weeks, with no rise in inappropriate starts.'] },
    'emqiat:next steps': { title: 'Next steps', what: 'How the change will be sustained and spread.', examples: ['Changes embedded in checklists, competencies and the EPR; spreading to the second ED in the Trust.'] }
};

// Lower-case label text without markers (*, ●, ✓), leading numbering
// ("1 ", "3.0 ", "P "), bracketed asides or trailing punctuation.
export function normaliseLabel(text) {
    let s = String(text || '').replace(/[*●✓○]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^\d+(\.\d+)*\s+/, '');
    s = s.replace(/^[A-Z]\s+(?=\S)/, '');
    s = s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/[:?.]+$/, '').trim();
    return s.toLowerCase();
}

function resolve(key) {
    let h = HINTS[key];
    if (h && h.ref) h = HINTS[h.ref];
    return h || null;
}

// The element's own text, ignoring buttons, links, icons and status dots.
function ownText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('button, a, svg, i, input, select, textarea, [title="Complete"], [title="Not yet complete"], .qip-hint-btn').forEach(n => n.remove());
    return clone.textContent;
}

function hintKeyFor(el) {
    if (el.dataset.hint) return resolve(el.dataset.hint) ? el.dataset.hint : null;
    const norm = normaliseLabel(ownText(el));
    if (!norm || norm.length > 70) return null;
    if (el.closest('#emqiat-form-container, #publish-emqiat') && resolve('emqiat:' + norm)) return 'emqiat:' + norm;
    if (norm.startsWith('emqiat:')) return null;
    return resolve(norm) ? norm : null;
}

const SCAN_SELECTOR = '#content-area label, #content-area h1, #content-area h2, #content-area h3, #content-area h4, [data-hint]';

function scan() {
    document.querySelectorAll(SCAN_SELECTOR).forEach(el => {
        if (el.dataset.hintDone) return;
        el.dataset.hintDone = '1';
        // Labels that wrap a radio/checkbox ("Yes", "No") are answers, not questions.
        if (el.tagName === 'LABEL' && el.querySelector('input[type="radio"], input[type="checkbox"]')) return;
        // The full project view and exports are read-through pages: skip them.
        if (el.closest('#view-full, #view-intro, #view-learn')) return;
        const key = hintKeyFor(el);
        if (!key) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qip-hint-btn no-print';
        btn.dataset.hintKey = key;
        btn.setAttribute('aria-label', 'Help: ' + (resolve(key).title || key));
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '?';
        el.appendChild(btn);
    });
}

// ── Popover ──────────────────────────────────────────────────────────────────
let pop = null;
let openBtn = null;
let pinned = false;
let hideTimer = null;

function fieldFor(btn) {
    const label = btn.parentElement;
    if (!label || label.tagName !== 'LABEL') return null;
    const sel = 'textarea, input[type="text"], input:not([type])';
    // The label's own field first (wrapped, or via for=); only fall back to
    // the surrounding block when the label wraps nothing of its own.
    const field = label.querySelector(sel)
        || (label.control && label.control.matches(sel) ? label.control : null)
        || (label.parentElement && label.parentElement.querySelector(sel));
    if (!field || field.readOnly || field.disabled) return null;
    return field;
}

function popoverHTML(key, btn) {
    const h = resolve(key);
    const field = fieldFor(btn);
    const canUse = field && !field.value.trim() && !document.body.classList.contains('readonly-mode');
    const tips = (h.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
    const examples = (h.examples || []).map((ex, i) => `
        <div class="qip-hint-example">
            <p>${escapeHtml(ex).replace(/\n/g, '<br>')}</p>
            <div class="qip-hint-actions">
                <button type="button" data-hint-copy="${i}">Copy</button>
                ${canUse ? `<button type="button" data-hint-use="${i}">Use as a starting point</button>` : ''}
            </div>
        </div>`).join('');
    return `
        <div class="qip-hint-title">${escapeHtml(h.title || '')}</div>
        <p class="qip-hint-what">${escapeHtml(h.what || '')}</p>
        ${tips ? `<ul class="qip-hint-tips">${tips}</ul>` : ''}
        ${examples ? `<div class="qip-hint-label">${h.examples.length > 1 ? 'Examples' : 'Example'}</div>${examples}<p class="qip-hint-foot">Illustrative example from a fictional project: adapt it to your own.</p>` : ''}`;
}

function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'qip-hint-pop';
    pop.className = 'no-print';
    pop.setAttribute('role', 'tooltip');
    pop.hidden = true;
    pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    pop.addEventListener('mouseleave', () => { if (!pinned) scheduleHide(); });
    pop.addEventListener('click', e => {
        const copy = e.target.closest('[data-hint-copy]');
        const use = e.target.closest('[data-hint-use]');
        if (!copy && !use || !openBtn) return;
        const h = resolve(openBtn.dataset.hintKey);
        const text = h.examples[Number((copy || use).dataset.hintCopy ?? (copy || use).dataset.hintUse)];
        if (copy) {
            const done = () => window.showToast && window.showToast('Example copied', 'success');
            if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
        } else {
            const field = fieldFor(openBtn);
            if (field && !field.value.trim()) {
                field.value = text;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                field.focus();
                hide();
            }
        }
    });
    document.body.appendChild(pop);
    return pop;
}

function place(btn) {
    const r = btn.getBoundingClientRect();
    const w = Math.min(360, window.innerWidth - 24);
    pop.style.width = w + 'px';
    let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    pop.style.left = left + 'px';
    const below = r.bottom + 8;
    const ph = pop.offsetHeight;
    let top = (below + ph > window.innerHeight - 8 && r.top - ph - 8 > 8) ? r.top - ph - 8 : below;
    // Never run off the bottom of a small screen: pull it up, and let the
    // popover's own scrollbar handle anything still too tall.
    if (top + ph > window.innerHeight - 8) top = Math.max(8, window.innerHeight - 8 - ph);
    pop.style.top = top + 'px';
}

function show(btn, pin) {
    clearTimeout(hideTimer);
    ensurePop();
    if (openBtn && openBtn !== btn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = btn;
    pinned = !!pin;
    pop.innerHTML = popoverHTML(btn.dataset.hintKey, btn);
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    place(btn);
}

function hide() {
    clearTimeout(hideTimer);
    if (pop) pop.hidden = true;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = null;
    pinned = false;
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 250);
}

const hoverCapable = () => window.matchMedia && window.matchMedia('(hover: hover)').matches;

document.addEventListener('mouseover', e => {
    const btn = e.target.closest && e.target.closest('.qip-hint-btn');
    if (btn && hoverCapable() && !pinned) show(btn, false);
});
document.addEventListener('mouseout', e => {
    const btn = e.target.closest && e.target.closest('.qip-hint-btn');
    if (btn && !pinned && !(e.relatedTarget && pop && pop.contains(e.relatedTarget))) scheduleHide();
});
// Click/tap pins the hint open (and is how touch screens open it). Capture
// phase, so a heading that toggles its section on click is not toggled.
document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.qip-hint-btn');
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (openBtn === btn && pinned) hide(); else show(btn, true);
        return;
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) hide();
}, true);
document.addEventListener('focusin', e => {
    if (e.target.classList && e.target.classList.contains('qip-hint-btn') && !pinned) show(e.target, false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) { const b = openBtn; hide(); if (b) b.focus(); } });
window.addEventListener('resize', () => { if (pop && !pop.hidden && openBtn) place(openBtn); });
document.addEventListener('scroll', () => { if (pop && !pop.hidden && !pinned) hide(); else if (pop && !pop.hidden && openBtn) place(openBtn); }, true);

// Re-scan whenever a view re-renders.
let queued = false;
function queueScan() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
}
if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
}
queueScan();
