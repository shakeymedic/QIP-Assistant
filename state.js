// localStorage throws when a browser blocks site data; the app must still load.
export const safeStorage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }
};

export const state = {
    currentUser: null,
    currentProjectId: null,
    projectData: null,
    isReadOnly: false,
    isDemoMode: false,
    toolMode: 'driver',
    activeView: 'dashboard',
    historyStack: [],
    redoStack: [],
    MAX_HISTORY: 50,
    aiKey: safeStorage.get('rcem_qip_ai_key') || null
};

export const emptyProject = {
    meta: {
        title: "New QIP",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        owner: null,
        trainingStage: "",
        rotationEnd: "",
        projectKind: ""
    },
    checklist: {
        problem_desc: "",
        problem_context: "",
        problem_evidence: "",
        aim: "",
        aim_measure: "",
        aim_baseline: "",
        aim_target: "",
        aim_date: "",
        outcome_measure: "",
        process_measure: "",
        balance_measure: "",
        ethics: "",
        hraChecklist: { q1: '', q2: '', q3: '', q4: '', notes: '' },
        lit_review: "",
        referencesList: [],
        abstract_background: "",
        abstract_methods: "",
        abstract_results: "",
        abstract_conclusions: "",
        operational_definition: "",
        outcomeKind: "",
        learning_points: "",
        sustainability: "",
        results_text: "",
        results_analysis: "",
        next_pdp: ""
    },
    dataPlan: { source: "", collector: "", cadence: "", sample: "", start: "" },
    drivers: {
        primary: [],
        secondary: [],
        changes: []
    },
    fishbone: {
        categories: [
            { text: "Patient", causes: [] },
            { text: "Staff", causes: [] },
            { text: "Equipment", causes: [] },
            { text: "Process", causes: [] },
            { text: "Environment", causes: [] },
            { text: "Management", causes: [] }
        ]
    },
    process: ["Start", "End"],
    pdsa: [],
    // Multi-measure support: each project can track several independent
    // measures (e.g. "Time to Kit" AND "Knowledge Assessment Score").
    // d.chartData / d.chartSettings below are kept as live references to
    // whichever measure is active, so all existing chart/QIAT/report code
    // that reads d.chartData / d.chartSettings keeps working unmodified.
    measures: [
        {
            id: 'measure_default',
            name: 'Primary Outcome Measure',
            unit: '',
            chartData: [],
            chartSettings: {
                mode: 'run',
                showMedian: true,
                showMean: false,
                ucl: null,
                lcl: null,
                title: '',
                yAxisLabel: '',
                showAnnotations: true
            }
        }
    ],
    activeMeasureId: 'measure_default',
    chartData: [],
    chartSettings: {
        mode: 'run',
        showMedian: true,
        showMean: false,
        ucl: null,
        lcl: null,
        title: '',
        yAxisLabel: '',
        showAnnotations: true
    },
    stakeholders: [],
    teamMembers: [],
    raci: { people: [], tasks: [], agreed: '' },
    charter: {
        preparedBy: '',
        date: '',
        execSponsor: '',
        aim: '',
        rationale: '',
        keyAreaOfFocus: '',
        startDate: '',
        endDate: '',
        objectives: '',
        scopeIn: '',
        scopeOut: '',
        benefits: [],
        costs: [],
        milestones: [
            { phase: 'Start Out', targetDate: '' },
            { phase: 'Define & Scope', targetDate: '' },
            { phase: 'Measure & Understand', targetDate: '' },
            { phase: 'Design & Plan', targetDate: '' },
            { phase: 'Pilot & Implement', targetDate: '' },
            { phase: 'Sustain & Share', targetDate: '' }
        ],
        team: [],
        additionalResources: '',
        lineManagerName: '',
        lineManagerSignatureDate: ''
    },
    actionPlan: [],
    leadershipLogs: [],
    gantt: [],
    surveys: [],
    fivewhys: { problem: '', why1: '', why2: '', why3: '', why4: '', why5: '', rootCause: '' },
    patientFeedback: [],
    qipLeads: [],
    assessment: {
        supervisorComments: '',
        signedOff: false,
        signedOffBy: '',
        signedOffByUid: '',
        signedOffByEmail: '',
        signedOffGmc: '',
        signedOffDate: '',
        lastSupervisorActivityAt: '',
        traineeSeenAt: ''
    },
    // Mirrors the real RCEM EM QIAT (2025 Update) form field-for-field, so what a
    // supervisor reviews here is the same content that gets submitted on
    // kaizenep.com — not a separate invented summary. Deliberately a DIFFERENT
    // key from data.emqiat (the older, separate "EM QIAT Journal" modal’s PDP/
    // education-log/CCT-summary data — see window.showEMQIATModal in app.js) to
    // avoid the two features colliding on the same object.
    emqiatForm: {
        dateOccurred: '',
        endDate: '',
        description: '',
        stageOfTraining: '',
        placement: '',
        dateOfCompletion: '',
        pdp: '', // 1.1
        qiEducationInvolvement: '', // 2.1
        qiEducationLearning: '', // 2.2
        involvedInProject: '', // 3.0 — 'yes' | 'no' | ''
        overview: { // 3.1
            background: '',
            aim: '',
            understandingProblem: '',
            measures: '',
            interventions: '',
            results: '',
            nextSteps: ''
        },
        role: '', // 3.2
        teamStakeholders: '', // 3.3
        sharingResults: '', // 3.4
        qiJourney: { // 4.1
            creatingConditions: false,
            understandingSystems: false,
            developingAims: false,
            testingChanges: false,
            implement: false,
            spread: false,
            leadershipTeams: false,
            projectManagementCommunication: false,
            measurement: false
        },
        reflections: '', // 4.2
        nextYearPdp: '', // 4.3
        endOfTrainingJourney: '' // 4.4
    }
};

// ─── Demo project ────────────────────────────────────────────────────────────
// A fictional Higher-trainee QIP (sepsis antibiotics) that fills in every part
// of the app, so demo mode shows each feature with realistic content: change
// ideas with linked PDSA cycles, several measures of each role and chart type,
// chart event markers, SWOT/PEST, FMEA, 5 Whys, charter, action plan, spread
// plan, references, patient feedback, the EM QIAT form and journal, and a
// supervisor sign-off. The department, people and data are made up.

// Monday-dated weekly points from a start date, one per value.
function weekly(startIso, values, grade, noteFor) {
    const start = new Date(startIso + 'T00:00:00Z');
    return values.map((value, i) => {
        const dt = new Date(start.getTime() + i * 7 * 86400000);
        const point = { date: dt.toISOString().slice(0, 10), value, grade };
        const note = noteFor ? noteFor(i) : '';
        if (note) point.note = note;
        return point;
    });
}

// Phases of the demo's weekly data (start Monday, values) — shared by the
// outcome and process measures so both line up with the PDSA cycles.
const DEMO_PHASES = [
    ['Baseline', '2025-06-02', [38, 44, 40, 42, 45, 39, 43, 41, 44, 42, 46, 40, 43], [96, 92, 99, 94, 90, 101, 93, 97, 95, 92, 89, 98, 94]],
    ['PDSA 1 Teaching', '2025-09-01', [48, 52, 47, 45], [90, 86, 92, 93]],
    ['PDSA 2 Sepsis trolley', '2025-09-29', [55, 58, 62, 60, 65, 63], [80, 76, 72, 74, 69, 71]],
    ['PDSA 3 Nurse PGD', '2025-11-10', [68, 72, 76, 78, 80, 77], [64, 60, 57, 55, 53, 56]],
    ['PDSA 4 EPR prompt', '2026-01-05', [82, 85, 84, 88, 86, 90, 88, 91], [52, 50, 51, 48, 49, 46, 47, 45]],
    ['Sustain', '2026-03-02', [89, 92, 90, 93, 91, 94, 88, 91, 95, 90, 90, 93], [46, 44, 45, 43, 44, 42, 47, 44, 41, 45, 44, 43]]
];

function demoMeasures() {
    const outcome = [];
    const process = [];
    DEMO_PHASES.forEach(([grade, start, pct, mins]) => {
        outcome.push(...weekly(start, pct, grade));
        process.push(...weekly(start, mins, grade));
    });
    // A note on two points shows how notes appear on hover and in the table.
    outcome[11].note = 'Two agency nurses covering Majors all week';
    outcome[37].note = 'Trolley restocking missed over a bank holiday weekend';

    const balance = [
        ['2025-06-01', 3], ['2025-07-01', 2], ['2025-08-01', 4], ['2025-09-01', 3], ['2025-10-01', 2], ['2025-11-01', 3],
        ['2025-12-01', 4], ['2026-01-01', 2], ['2026-02-01', 3], ['2026-03-01', 2], ['2026-04-01', 3], ['2026-05-01', 2]
    ].map(([date, value]) => ({ date, value, grade: date < '2025-11-10' ? 'Before PGD' : 'After PGD', note: 'Pharmacy review of all nurse- and doctor-initiated sepsis antibiotics' }));

    const reasons = [
        ['Waiting for a prescriber', 41], ['Equipment not found', 33], ['Difficult cannulation', 17],
        ['Sepsis not flagged at triage', 14], ['Antibiotic not in stock', 9], ['Other', 6]
    ].map(([category, value]) => ({ date: '2025-08-29', value, grade: 'Baseline', category, note: category }));

    const staff = ['Staff 01', 'Staff 02', 'Staff 03', 'Staff 04', 'Staff 05', 'Staff 06', 'Staff 07', 'Staff 08'];
    const before = [2, 3, 2, 1, 3, 2, 2, 3];
    const after = [4, 5, 4, 4, 5, 4, 3, 5];
    const confidence = [
        ...staff.map((s, i) => ({ date: '2025-08-20', value: before[i], grade: 'Before', note: s + ' — confidence finding sepsis kit (1–5)' })),
        ...staff.map((s, i) => ({ date: '2026-01-21', value: after[i], grade: 'After', note: s + ' — confidence finding sepsis kit (1–5)' }))
    ];

    return [
        { id: 'measure_default', name: '% IV antibiotics within 60 minutes', unit: '%', measureType: 'proportion', role: 'outcome',
          chartData: outcome,
          chartSettings: { mode: 'run', title: 'Red-flag sepsis: IV antibiotics within 60 minutes of triage', yAxisLabel: '% of patients', target: 90, showAnnotations: true } },
        { id: 'measure_time', name: 'Triage to antibiotics (median minutes)', unit: 'minutes', measureType: 'continuous', role: 'process',
          chartData: process,
          chartSettings: { mode: 'spc', title: 'Weekly median time from triage to first IV antibiotic', yAxisLabel: 'Minutes', target: 60, showAnnotations: true } },
        { id: 'measure_reasons', name: 'Reasons for delay (baseline review)', unit: 'cases', measureType: 'categorical', role: 'process',
          chartData: reasons,
          chartSettings: { mode: 'pareto', title: 'Why antibiotics were late: 120 baseline cases', yAxisLabel: 'Cases', target: null, showAnnotations: true } },
        { id: 'measure_confidence', name: 'Staff confidence finding sepsis kit', unit: 'score 1–5', measureType: 'score', role: 'process',
          chartData: confidence,
          chartSettings: { mode: 'beforeafter', title: 'Nursing staff confidence before and after the sepsis trolley', yAxisLabel: 'Score (1–5)', target: null, showAnnotations: true } },
        { id: 'measure_balance', name: 'Inappropriate antibiotic starts', unit: 'per month', measureType: 'count', role: 'balance',
          chartData: balance,
          chartSettings: { mode: 'run', title: 'Balancing measure: inappropriate sepsis antibiotic starts per month', yAxisLabel: 'Starts per month', target: null, showAnnotations: true } }
    ];
}

function demoChangeIdeas() {
    return [
        {
            id: 'ci-teaching', title: 'Sepsis teaching at handover', status: 'abandoned',
            description: 'Ten-minute sepsis recognition and Sepsis Six refresher at every nursing and medical handover.',
            driverLink: 'Awareness of sepsis criteria', byWhom: 'Alex Morgan', byWhen: '2025-09-30',
            pdsaCycles: [{
                title: 'PDSA 1: Handover teaching for four weeks', startDate: '2025-09-01', start: '2025-09-01', owner: 'Alex Morgan', status: 'complete',
                plan: 'Deliver a 10-minute sepsis refresher at every day and night handover for four weeks, using a one-page sepsis card. Record attendance at each session. Keep collecting the weekly outcome measure.',
                desc: 'Deliver a 10-minute sepsis refresher at every day and night handover for four weeks, using a one-page sepsis card. Record attendance at each session. Keep collecting the weekly outcome measure.',
                prediction: 'We predict compliance will rise from a median of 42% to around 60%, because staff will recognise sepsis sooner and prioritise antibiotics.',
                do: 'Teaching delivered at 42 of 56 handovers (75%). Night shifts were hardest to reach. 20 A4 posters put up across Majors and Resus.',
                study: 'Compliance rose briefly to 52% and then fell back to 45% by week 4: no shift on the run chart, so the prediction was wrong. A quick survey showed staff already knew the standard; the barriers were finding kit and waiting for a prescriber.',
                act: 'Abandon teaching as the main change. Awareness was not the problem. Keep the sepsis card in induction packs and move to the system barriers shown on the Pareto chart.',
                actDecision: 'abandoned'
            }]
        },
        {
            id: 'ci-trolley', title: 'Dedicated sepsis trolley', status: 'completed',
            description: 'A stocked, clearly labelled trolley holding everything needed for the Sepsis Six, checked daily.',
            driverLink: 'Sepsis equipment location', byWhom: 'Sam Patel', byWhen: '2025-11-07',
            pdsaCycles: [
                {
                    title: 'PDSA 2a: Sepsis trolley in Majors bays 1–6', startDate: '2025-09-29', start: '2025-09-29', owner: 'Sam Patel', status: 'complete',
                    plan: 'Put one yellow sepsis trolley in Majors bays 1–6, stocked with cannulas, blood culture bottles, lactate syringes, fluids and the first-line antibiotics. Healthcare assistant to check it at the start of each day shift using a tick list.',
                    desc: 'Put one yellow sepsis trolley in Majors bays 1–6, stocked with cannulas, blood culture bottles, lactate syringes, fluids and the first-line antibiotics. Healthcare assistant to check it at the start of each day shift using a tick list.',
                    prediction: 'We predict time from triage to antibiotics will fall by at least 15 minutes for patients in bays 1–6, and the stock check will be done on at least 80% of days.',
                    do: 'Trolley borrowed from theatres and restocked. Checked on 19 of 21 days (90%). Two stock-outs of blood culture bottles in week 2.',
                    study: 'Median time to antibiotics in bays 1–6 fell from 94 to 74 minutes, and overall compliance reached 58–62%. Prediction met. Staff said the trolley "saves a walk to the store room every time".',
                    act: 'Adapt: add a laminated restock list and a second set of culture bottles, then extend to Resus.',
                    actDecision: 'adapted'
                },
                {
                    title: 'PDSA 2b: Extend the trolley to Resus', startDate: '2025-10-20', start: '2025-10-20', owner: 'Sam Patel', status: 'complete',
                    plan: 'Add a second trolley in Resus with the revised restock list. Measure stock-check completion and outcome compliance for three weeks.',
                    desc: 'Add a second trolley in Resus with the revised restock list. Measure stock-check completion and outcome compliance for three weeks.',
                    prediction: 'We predict overall compliance will pass 60% and stay there, with stock checks done on at least 90% of days.',
                    do: 'Second trolley in place from 20 October. Stock checks done on 20 of 21 days.',
                    study: 'Six weeks in a row above the baseline median: a shift on the run chart. Prediction met. Remaining delays were mostly "waiting for a prescriber".',
                    act: 'Adopt. Trolley checks added to the daily nursing checklist. Next change targets prescribing delays.',
                    actDecision: 'adopted'
                }
            ]
        },
        {
            id: 'ci-pgd', title: 'Nurse-initiated antibiotics (PGD)', status: 'completed',
            description: 'A Patient Group Direction so trained band 6 and 7 nurses can give the first dose of IV antibiotics for red-flag sepsis without waiting for a prescriber.',
            driverLink: 'Nursing autonomy to start treatment', byWhom: 'Jordan Lee', byWhen: '2025-12-19',
            pdsaCycles: [{
                title: 'PDSA 3: PGD pilot on day shifts', startDate: '2025-11-10', start: '2025-11-10', owner: 'Jordan Lee', status: 'complete',
                plan: 'After approval by the medicines committee, train 24 band 6 and 7 nurses and pilot the PGD on day shifts for six weeks. Pharmacy to review every PGD administration.',
                desc: 'After approval by the medicines committee, train 24 band 6 and 7 nurses and pilot the PGD on day shifts for six weeks. Pharmacy to review every PGD administration.',
                prediction: 'We predict compliance will rise above 75% on day shifts, with no increase in inappropriate antibiotic starts (our balancing measure).',
                do: '61 patients treated under the PGD in six weeks. Night shifts not yet covered because fewer trained nurses were on rota.',
                study: 'Compliance rose to a median of 77%. Pharmacy found no inappropriate PGD starts, and the balancing measure stayed within its usual range. Prediction met for day shifts.',
                act: 'Adapt: train night-shift nurses, then adopt across all shifts. Add PGD sign-off to the ED nursing competency booklet.',
                actDecision: 'adapted'
            }]
        },
        {
            id: 'ci-epr', title: 'EPR sepsis prompt', status: 'completed',
            description: 'An electronic patient record prompt when a triage NEWS2 of 5 or more, or any red flag, is recorded, linking to the sepsis order set.',
            driverLink: 'Early sepsis recognition', byWhom: 'Chris Evans', byWhen: '2026-02-27',
            pdsaCycles: [{
                title: 'PDSA 4: Triage prompt and order set', startDate: '2026-01-05', start: '2026-01-05', owner: 'Chris Evans', status: 'complete',
                plan: 'Switch on a triage prompt for NEWS2 of 5 or more or any red-flag criterion, with a one-click sepsis order set. Run for eight weeks and audit prompt overrides.',
                desc: 'Switch on a triage prompt for NEWS2 of 5 or more or any red-flag criterion, with a one-click sepsis order set. Run for eight weeks and audit prompt overrides.',
                prediction: 'We predict compliance will reach 85–90% and the number of cases where sepsis was not flagged at triage will halve.',
                do: 'Prompt live from 5 January. Overridden in 18% of triggers, mostly for known palliative patients.',
                study: 'Compliance reached 88–91%, a second shift on the run chart, and missed triage flags fell from 14 to 5 per review. Prediction met.',
                act: 'Adopt. Prompt stays on, with an override reason added. Monthly data now pulled automatically from the EPR.',
                actDecision: 'adopted'
            }]
        }
    ];
}

export function getDemoData() {
    const measures = demoMeasures();
    const changeIdeas = demoChangeIdeas();
    const d = {
        meta: {
            title: 'Improving time to IV antibiotics for red-flag sepsis in the ED',
            created: '2025-05-12T08:00:00Z',
            updated: new Date().toISOString(),
            owner: 'Dr Alex Morgan (ST6)',
            trainingStage: 'higher',
            arcpDate: '2026-12-04',
            rotationEnd: '2026-08-04',
            projectKind: 'qip'
        },
        dataPlan: { source: 'EPR sepsis flag and drug administration record, weekly extract by the audit team', collector: 'Dr Alex Morgan with the audit and QI team', cadence: 'weekly', sample: 'All eligible patients that week (about 15 to 25)', start: '2025-06-02' },
        checklist: {
            problem_desc: 'Patients with red-flag sepsis in our ED wait too long for their first dose of IV antibiotics. Over 13 weeks of baseline data (June to August 2025, 247 patients) a median of 42% received antibiotics within 60 minutes of triage. National guidance (NICE NG51) recommends antibiotics within one hour for people at high risk of severe illness or death from sepsis. Case review of 120 late doses found the main causes were waiting for a prescriber and hunting for equipment.',
            problem_context: 'Fictional district general hospital ED with about 85,000 attendances a year, 24-hour consultant presence and frequent crowding in Majors. Sepsis screening is part of nurse triage. The project was registered with the Trust audit and QI team and sponsored by the ED clinical lead.',
            problem_evidence: 'Baseline weekly data June–August 2025: median 42% (range 38–46%) of red-flag sepsis patients received IV antibiotics within 60 minutes of triage. Median time from triage to first antibiotic 94 minutes. Pareto analysis of 120 late cases: waiting for a prescriber 41, equipment not found 33, difficult cannulation 17, sepsis not flagged at triage 14, antibiotic not in stock 9, other 6.',
            aim: 'To increase the percentage of adult patients with red-flag sepsis who receive IV antibiotics within 60 minutes of triage in our ED from a median of 42% to 90% by 31 May 2026.',
            aim_measure: '% of adult red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage',
            aim_baseline: '42%',
            aim_target: '90',
            aim_date: '2026-05-31',
            aim2: 'To reduce the median time from triage to first IV antibiotic from 94 minutes to under 60 minutes by 31 May 2026.',
            outcome_measure: '% of adult red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage (weekly, all eligible patients from the EPR sepsis flag).',
            process_measure: 'Median minutes from triage to first IV antibiotic (weekly); reasons for delay in late cases (Pareto); sepsis trolley daily check completion; staff confidence finding sepsis kit (1–5 survey, before and after).',
            balance_measure: 'Inappropriate sepsis antibiotic starts per month (pharmacy review); time to assessment for other Majors patients; prompt override rate.',
            outcomeKind: 'percentage',
            operational_definition: 'Numerator: adults (16+) with a red-flag sepsis criterion recorded at triage who receive a first IV antibiotic dose within 60 minutes of the triage time stamp. Denominator: all adults with a red-flag sepsis criterion recorded at triage in that week, excluding patients on an end-of-life pathway and transfers who received antibiotics before arrival. Source: EPR sepsis flag and drug administration record, extracted every Monday for the previous week (Monday to Sunday).',
            ethics: 'Classed as service evaluation and quality improvement using the HRA decision tool, so no research ethics review was needed. Registered with the Trust audit and QI team. Data were extracted without patient identifiers and stored on the Trust network. The PGD was approved by the Trust medicines committee before PDSA 3.',
            hraChecklist: { q1: 'no', q2: 'no', q3: 'yes', q4: 'no', notes: 'HRA decision tool completed May 2025: not research. Registered with the Trust audit and QI team (fictional reference QI-2025-031).' },
            swot: {
                strengths: 'Engaged band 7 sepsis champion; consultant sponsor; sepsis flag already in the EPR, so data are easy to extract.',
                weaknesses: 'Crowding in Majors; high agency nurse use on nights; no protected QI time.',
                opportunities: 'Trust sepsis priority this year; pharmacy keen to develop PGDs; borrowed trolley from theatres at no cost.',
                threats: 'Antimicrobial stewardship concerns about nurse-initiated antibiotics; winter pressures; staff turnover.'
            },
            pest: {
                political: 'Sepsis is a national and Trust patient-safety priority.',
                economic: 'Cost-neutral changes only; a trolley was borrowed rather than bought.',
                social: 'Nursing staff wanted more autonomy; patients and families value faster treatment.',
                technological: 'The EPR can add a triage prompt and order set with analyst support.'
            },
            swotMode: 'swot',
            swotOpen: true,
            lit_review: 'National guidance (NICE NG51) sets out recognition and early treatment of suspected sepsis, including antibiotics within one hour for people at high risk. The Surviving Sepsis Campaign international guidelines also recommend antibiotics as soon as possible for likely sepsis. Observational studies of septic shock have linked each hour of delay to higher mortality. QI literature shows education alone gives small, short-lived gains, while system changes (standard kit, nurse-initiated treatment, electronic prompts) are more reliable.',
            referencesList: [
                { authors: 'National Institute for Health and Care Excellence', year: '2016 (updated)', title: 'Suspected sepsis: recognition, diagnosis and early management (NG51)', keyFinding: 'Recommends IV antibiotics within one hour for people at high risk of severe illness or death from sepsis.' },
                { authors: 'Evans L, et al.', year: '2021', title: 'Surviving Sepsis Campaign: international guidelines for management of sepsis and septic shock 2021', keyFinding: 'Recommends giving antimicrobials as soon as possible for possible septic shock or high likelihood of sepsis.' },
                { authors: 'Kumar A, et al.', year: '2006', title: 'Duration of hypotension before initiation of effective antimicrobial therapy is the critical determinant of survival in human septic shock', keyFinding: 'Each hour of delay in effective antibiotics after hypotension was associated with lower survival.' },
                { authors: 'Langley GJ, et al.', year: '2009', title: 'The Improvement Guide (2nd edition)', keyFinding: 'The Model for Improvement and PDSA cycles used to structure this project.' },
                { authors: 'Perla RJ, Provost LP, Murray SK', year: '2011', title: 'The run chart: a simple analytical tool for learning from variation in healthcare processes', keyFinding: 'Run chart rules (shift, trend, runs, astronomical point) used to judge whether changes led to improvement.' },
                { authors: 'NHS England (formerly NHS Improvement)', year: 'n.d.', title: 'Making Data Count: statistical process control guidance', keyFinding: 'Guide to statistical process control charts used for the process measure.' }
            ],
            results_text: 'Baseline median 42% (June–August 2025). PDSA 1 (teaching) gave no shift. A shift followed PDSA 2 (sepsis trolley), and a second shift followed PDSA 3 (nurse PGD). After PDSA 4 (EPR prompt) compliance stayed between 88% and 95%, with a median of 91% over the final 12 weeks. Median time to antibiotics fell from 94 to 44 minutes.',
            results_analysis: 'The run chart shows special cause variation: a shift of six or more points above the baseline median after the sepsis trolley, and a further sustained shift after the nurse PGD and EPR prompt. Teaching alone did not change the process. The SPC chart of time to antibiotics shows points below the lower control limit after PDSA 3, confirming a real change. The balancing measure (inappropriate antibiotic starts) showed only common cause variation, so faster antibiotics did not come at the cost of stewardship. The aim of 90% was met from February 2026.',
            learning_points: '1. System changes beat education: teaching raised awareness but did not move the data; changing where kit lives and who can start treatment did.\n2. Predictions make PDSA cycles honest: writing a prediction first meant we could see quickly when we were wrong.\n3. Involve sceptics early: microbiology concerns about the PGD were solved by adding a balancing measure and a review point.\n4. Visible data drives engagement: a weekly run chart in the staff room kept the team interested.\n5. Plan sustainability before the last cycle, not after it.',
            sustainability: 'Trolley checks are on the daily nursing checklist, with the sepsis champion auditing monthly. The PGD is in the nursing competency booklet and induction, with annual review by the medicines committee. The EPR prompt is permanent and the outcome measure is now extracted automatically and reported monthly at ED governance, with escalation if compliance falls below 85% for two months.',
            spreadPlan: {
                whoAdopts: 'Neighbouring hospital ED in the same Trust, then the acute medical unit.',
                infrastructure: 'Second set of trolleys, PGD training slots, EPR prompt switched on at the second site.',
                maintenancePlan: 'Sepsis champion (band 7) owns trolley checks and the monthly audit; ED consultant sponsor owns the governance report.',
                spreadTimeline: 'Second ED from September 2026; acute medical unit scoping in early 2027.',
                embeddingStrategy: 'Built into induction, nursing competencies and the EPR, so it does not depend on one person.'
            },
            next_pdp: 'Lead a second QIP at the ED–acute medicine interface, supervise two junior trainees through their first QI projects, and complete formal SPC training so I can teach it locally.',
            abstract_background: 'Timely antibiotics improve outcomes in sepsis. At baseline only 42% of red-flag sepsis patients in our ED received IV antibiotics within 60 minutes of triage.',
            abstract_methods: 'Model for Improvement with four change ideas tested over five PDSA cycles (September 2025 to February 2026). Weekly outcome and process measures were plotted on run and SPC charts, with a balancing measure for inappropriate antibiotic use.',
            abstract_results: 'Compliance rose from a median of 42% to 91% and median time to antibiotics fell from 94 to 44 minutes. Teaching alone had no effect; a sepsis trolley, a nurse PGD and an EPR prompt each produced a shift. Inappropriate antibiotic starts did not increase.',
            abstract_conclusions: 'System changes, not education, achieved and sustained the improvement. The package is now spreading to a second ED.'
        },
        drivers: {
            primary: ['Early sepsis recognition', 'Equipment accessibility', 'Timely prescribing and administration', 'Staff culture and confidence'],
            secondary: ['Triage screening accuracy', 'Awareness of sepsis criteria', 'Sepsis equipment location', 'Antibiotic availability', 'Nursing autonomy to start treatment', 'Prescriber availability in crowding', 'Feedback on performance'],
            changes: ['Sepsis teaching at handover', 'Dedicated sepsis trolley', 'Nurse-initiated antibiotics (PGD)', 'EPR sepsis prompt', 'Weekly run chart in the staff room']
        },
        fishbone: {
            problem: 'Only 42% of red-flag sepsis patients get IV antibiotics within 60 minutes',
            categories: [
                { text: 'People', causes: [{ text: 'High agency nurse use on nights' }, { text: 'Junior doctors busy with other patients' }, { text: 'Variable confidence starting treatment' }] },
                { text: 'Methods', causes: [{ text: 'Only doctors can prescribe the first dose' }, { text: 'Sepsis screen done late in triage' }] },
                { text: 'Equipment', causes: [{ text: 'Cannulas and cultures in different rooms' }, { text: 'Antibiotics in a locked cupboard away from Majors' }] },
                { text: 'Environment', causes: [{ text: 'Crowding and corridor care' }, { text: 'Long walk to the store room' }] },
                { text: 'Measurement', causes: [{ text: 'No regular feedback on performance' }, { text: 'Time of first dose not always recorded' }] },
                { text: 'Management', causes: [{ text: 'No protected time for a sepsis champion' }] }
            ]
        },
        process: ['Patient arrives', 'Triage and NEWS2', 'Sepsis screen', 'Red flag present?', 'Wait for doctor review', 'Doctor prescribes antibiotic', 'Nurse finds equipment', 'Cannula, cultures and lactate', 'Antibiotic drawn up', 'First dose given'],
        fivewhys: {
            problem: 'Antibiotics are given more than 60 minutes after triage',
            why1: 'Because the first dose is not prescribed promptly.',
            why2: 'Because the patient has to wait for a doctor to review them.',
            why3: 'Because only a prescriber can authorise the first dose.',
            why4: 'Because there is no protocol allowing nurses to start antibiotics.',
            why5: 'Because nurse-initiated treatment had never been proposed to the medicines committee.',
            rootCause: 'No mechanism (such as a PGD) for trained nurses to give the first dose without waiting for a prescriber.'
        },
        fmea: [
            { step: 'Sepsis screen at triage', failureMode: 'Red flag missed', effect: 'Treatment delayed', likelihood: 6, severity: 9, detectability: 5, mitigation: 'EPR prompt for NEWS2 5+ or any red flag (PDSA 4)' },
            { step: 'Gather equipment', failureMode: 'Kit not found or out of stock', effect: 'Delay of 10–20 minutes', likelihood: 7, severity: 6, detectability: 3, mitigation: 'Sepsis trolley with daily check list (PDSA 2)' },
            { step: 'Prescribe first dose', failureMode: 'No prescriber available', effect: 'Delay of 30+ minutes', likelihood: 8, severity: 8, detectability: 4, mitigation: 'Nurse PGD for the first dose (PDSA 3)' },
            { step: 'Give antibiotic', failureMode: 'Wrong antibiotic for allergy', effect: 'Patient harm', likelihood: 2, severity: 9, detectability: 3, mitigation: 'Allergy check built into PGD and order set; pharmacy review' }
        ],
        changeIdeas,
        pdsa: changeIdeas.flatMap(ci => ci.pdsaCycles),
        measures,
        activeMeasureId: 'measure_default',
        chartData: measures[0].chartData,
        chartSettings: measures[0].chartSettings,
        chartEvents: [
            { id: 'ev1', date: '2025-08-26', label: 'Baseline presented at governance', color: '#6366f1' },
            { id: 'ev2', date: '2025-12-22', label: 'Christmas: no data collection', color: '#f59e0b' },
            { id: 'ev3', date: '2026-02-16', label: 'Aim of 90% reached', color: '#14b8a6' }
        ],
        teamMembers: [
            { id: '1', name: 'Alex Morgan', role: 'Project lead', grade: 'ST6 Emergency Medicine', initials: 'AM', responsibilities: 'Leads the project, runs PDSA planning, analyses the data and reports to governance.' },
            { id: '2', name: 'Sam Patel', role: 'Sepsis champion', grade: 'Band 7 sister', initials: 'SP', responsibilities: 'Nursing lead; owns the trolley and the daily checks.' },
            { id: '3', name: 'Dr Priya Shah', role: 'Consultant sponsor', grade: 'ED consultant', initials: 'PS', responsibilities: 'Clinical sponsor; unblocks issues with the Trust and other specialties.' },
            { id: '4', name: 'Jordan Lee', role: 'PGD lead', grade: 'ED pharmacist', initials: 'JL', responsibilities: 'Writes the PGD, trains nurses and reviews every PGD dose.' },
            { id: '5', name: 'Chris Evans', role: 'Data and IT', grade: 'EPR analyst', initials: 'CE', responsibilities: 'Builds the EPR prompt and the weekly data extract.' },
            { id: '6', name: 'Taylor Brooks', role: 'Data collection', grade: 'CT2 ACCS', initials: 'TB', responsibilities: 'Reviews late cases and records reasons for delay.' }
        ],
        stakeholders: [
            { name: 'ED nursing team', role: 'Deliver the changes', organisation: 'ED', x: 85, y: 70 },
            { name: 'ED clinical lead', role: 'Approves changes in the department', organisation: 'ED', x: 75, y: 90 },
            { name: 'Medicines committee', role: 'Approves the PGD', organisation: 'Trust', x: 35, y: 85 },
            { name: 'Microbiology', role: 'Antimicrobial stewardship', organisation: 'Pathology', x: 40, y: 65 },
            { name: 'Junior doctors', role: 'Prescribers and data collectors', organisation: 'ED', x: 70, y: 30 },
            { name: 'Patients and families', role: 'Receive care; give feedback', organisation: 'Public', x: 65, y: 20 },
            { name: 'Estates', role: 'Space for trolleys', organisation: 'Trust', x: 15, y: 25 }
        ],
        raci: {
            people: [
                { id: 'rp_lead', memberId: '1', name: 'Alex Morgan', role: 'Project lead' },
                { id: 'rp_nurse', memberId: '2', name: 'Sam Patel', role: 'Sepsis champion' },
                { id: 'rp_sponsor', memberId: '3', name: 'Dr Priya Shah', role: 'Consultant sponsor' },
                { id: 'rp_pharm', memberId: '4', name: 'Jordan Lee', role: 'PGD lead' },
                { id: 'rp_data', memberId: '5', name: 'Chris Evans', role: 'Data and IT' },
                { id: 'rp_ct', memberId: '6', name: 'Taylor Brooks', role: 'Data collection' },
                { id: 'rp_cl', name: 'ED clinical lead', role: 'Approves changes in the department' },
                { id: 'rp_mc', name: 'Medicines committee', role: 'Approves the PGD' }
            ],
            tasks: [
                { id: 'rt1', phase: 'Set up', task: 'Agree the aim and scope', cells: { rp_lead: 'R', rp_sponsor: 'A', rp_nurse: 'C', rp_pharm: 'C', rp_cl: 'I' } },
                { id: 'rt2', phase: 'Set up', task: 'Register the project with the Trust audit / QI team', cells: { rp_lead: 'R', rp_sponsor: 'A' } },
                { id: 'rt3', phase: 'Set up', task: 'Agree the data plan and collect baseline data', cells: { rp_lead: 'A', rp_data: 'R', rp_ct: 'R', rp_nurse: 'C' } },
                { id: 'rt4', phase: 'Diagnose', task: 'Run the process mapping / fishbone session', cells: { rp_lead: 'A', rp_nurse: 'R', rp_ct: 'R', rp_pharm: 'C', rp_sponsor: 'I' } },
                { id: 'rt5', phase: 'Test changes', task: 'Design and stock the sepsis trolley', cells: { rp_nurse: 'A', rp_lead: 'R', rp_ct: 'R', rp_pharm: 'C' } },
                { id: 'rt6', phase: 'Test changes', task: 'Write and approve the antibiotic PGD', cells: { rp_pharm: 'R', rp_mc: 'A', rp_sponsor: 'C', rp_nurse: 'C', rp_cl: 'I' } },
                { id: 'rt7', phase: 'Test changes', task: 'Build the EPR sepsis prompt', cells: { rp_data: 'R', rp_lead: 'A', rp_nurse: 'C', rp_cl: 'I' } },
                { id: 'rt8', phase: 'Test changes', task: 'Collect and chart the data every week', cells: { rp_lead: 'A', rp_ct: 'R', rp_data: 'R', rp_sponsor: 'I', rp_nurse: 'I' } },
                { id: 'rt9', phase: 'Sustain & share', task: 'Present the results at ED governance', cells: { rp_lead: 'R', rp_cl: 'A', rp_sponsor: 'C', rp_nurse: 'C' } },
                { id: 'rt10', phase: 'Sustain & share', task: 'Hand over: named owner and sustainability plan', cells: { rp_lead: 'R', rp_sponsor: 'A', rp_nurse: 'R', rp_ct: 'C', rp_cl: 'I' } }
            ],
            agreed: '2025-06-09'
        },
        leadershipLogs: [
            { date: '2025-05-19', note: 'Agreed scope and sponsorship with the ED clinical lead; registered the project with the audit and QI team.' },
            { date: '2025-06-09', note: 'Ran a process-mapping session with nurses, junior doctors and pharmacy.' },
            { date: '2025-08-26', note: 'Presented baseline data at ED governance; agreed to test system changes rather than more teaching.' },
            { date: '2025-10-02', note: 'Joint meeting with microbiology and pharmacy about nurse-initiated antibiotics; agreed a balancing measure and a three-month review.' },
            { date: '2026-03-18', note: 'Presented results at ED governance and handed trolley checks to the nursing team.' },
            { date: '2026-04-22', note: 'Oral presentation at the regional EM trainee QI day.' }
        ],
        gantt: [
            { id: 'g1', name: 'Scoping and registration', start: '2025-05-12', end: '2025-05-30', type: 'plan', owner: 'AM', milestone: false, dependency: '' },
            { id: 'g2', name: 'Baseline data collection', start: '2025-06-02', end: '2025-08-31', type: 'data', owner: 'TB', milestone: false, dependency: 'g1' },
            { id: 'g3', name: 'Process map and fishbone', start: '2025-06-09', end: '2025-07-11', type: 'plan', owner: 'AM', milestone: false, dependency: '' },
            { id: 'g4', name: 'PDSA 1: handover teaching', start: '2025-09-01', end: '2025-09-28', type: 'pdsa', owner: 'AM', milestone: false, dependency: 'g2' },
            { id: 'g5', name: 'PDSA 2: sepsis trolley', start: '2025-09-29', end: '2025-11-09', type: 'pdsa', owner: 'SP', milestone: false, dependency: 'g4' },
            { id: 'g6', name: 'PDSA 3: nurse PGD', start: '2025-11-10', end: '2025-12-21', type: 'pdsa', owner: 'JL', milestone: false, dependency: 'g5' },
            { id: 'g7', name: 'PDSA 4: EPR prompt', start: '2026-01-05', end: '2026-03-01', type: 'pdsa', owner: 'CE', milestone: false, dependency: 'g6' },
            { id: 'g8', name: 'Results review at governance', start: '2026-03-18', end: '2026-03-18', type: 'review', owner: 'AM', milestone: true, dependency: 'g7' },
            { id: 'g9', name: 'Sustain and monitor', start: '2026-03-02', end: '2026-05-31', type: 'sustain', owner: 'SP', milestone: false, dependency: 'g7' }
        ],
        charter: {
            preparedBy: 'Alex Morgan (ST6)', date: '2025-05-19', execSponsor: 'Dr Priya Shah, ED consultant',
            aim: 'Increase the percentage of adult red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage from 42% to 90% by 31 May 2026.',
            rationale: 'Delays to antibiotics in sepsis are linked to worse outcomes, and our baseline is well below national guidance.',
            keyAreaOfFocus: 'Patient safety: sepsis', startDate: '2025-05-19', endDate: '2026-05-31',
            objectives: 'Collect 12 weeks of baseline data.\nTest at least three change ideas using PDSA cycles.\nReach 90% compliance and hold it for 12 weeks.\nHand over a sustainability plan to the nursing team.',
            scopeIn: 'Adults (16+) with red-flag sepsis at triage in the ED (Majors and Resus).',
            scopeOut: 'Children; patients on an end-of-life pathway; care after admission to a ward.',
            benefits: [
                { benefit: 'Faster antibiotics for patients with sepsis', measure: '% within 60 minutes; median minutes', stakeholder: 'Patients' },
                { benefit: 'Less time hunting for kit', measure: 'Staff confidence score', stakeholder: 'ED nurses' }
            ],
            costs: [
                { description: 'Sepsis trolleys (borrowed from theatres)', estimatedCost: '£0', stakeholder: 'ED matron' },
                { description: 'PGD training (2 hours per nurse, in protected teaching time)', estimatedCost: 'Staff time only', stakeholder: 'Nursing education' }
            ],
            // Milestones and the team are read from the Timeline and QI Team
            aimMigrated: true, teamMigrated: true, milestonesMigrated: true,
            additionalResources: 'EPR analyst time for the prompt and data extract; space in the medicines committee agenda.',
            lineManagerName: 'Dr Priya Shah',
            lineManagerSignatureDate: '2025-05-21'
        },
        actionPlan: [
            { id: 'ap1', objective: 'Make sepsis kit easy to find', action: 'Borrow and stock two trolleys; write the restock list', byWhom: 'Sam Patel', byWhen: '2025-10-20', possibleIssues: 'Stock-outs at weekends', status: 'done', changeIdeaId: 'ci-trolley' },
            { id: 'ap2', objective: 'Let nurses start the first dose', action: 'Write the PGD and take it to the medicines committee', byWhom: 'Jordan Lee', byWhen: '2025-11-07', possibleIssues: 'Stewardship concerns from microbiology', status: 'done', changeIdeaId: 'ci-pgd' },
            { id: 'ap3', objective: 'Cover night shifts', action: 'Train 12 night-shift nurses in the PGD', byWhom: 'Jordan Lee', byWhen: '2026-01-31', possibleIssues: 'Releasing staff for training', status: 'done', changeIdeaId: 'ci-pgd' },
            { id: 'ap4', objective: 'Spread to the second ED', action: 'Share the toolkit and support their baseline data collection', byWhom: 'Alex Morgan', byWhen: '2026-09-30', possibleIssues: 'Different EPR configuration', status: 'in-progress', changeIdeaId: null },
            { id: 'ap5', objective: 'Publish the work', action: 'Submit an abstract to a national EM conference', byWhom: 'Alex Morgan', byWhen: '2026-11-30', possibleIssues: '', status: 'not-started', changeIdeaId: null }
        ],
        surveys: [{
            id: 'demo_survey', title: 'Staff survey after the sepsis trolley',
            questions: ['Timestamp', 'Role', 'Confidence finding sepsis kit (1-5)', 'Confidence starting the Sepsis Six (1-5)', 'Comments'],
            responses: [
                { 'Timestamp': '2026-01-21 08:30', 'Role': 'Band 5 nurse', 'Confidence finding sepsis kit (1-5)': '5', 'Confidence starting the Sepsis Six (1-5)': '4', 'Comments': 'Trolley saves a trip to the store room.' },
                { 'Timestamp': '2026-01-21 09:10', 'Role': 'Band 6 nurse', 'Confidence finding sepsis kit (1-5)': '4', 'Confidence starting the Sepsis Six (1-5)': '5', 'Comments': 'PGD means I can start straight away.' },
                { 'Timestamp': '2026-01-21 11:45', 'Role': 'FY2 doctor', 'Confidence finding sepsis kit (1-5)': '4', 'Confidence starting the Sepsis Six (1-5)': '5', 'Comments': '' },
                { 'Timestamp': '2026-01-22 14:05', 'Role': 'Healthcare assistant', 'Confidence finding sepsis kit (1-5)': '5', 'Confidence starting the Sepsis Six (1-5)': '3', 'Comments': 'Would like a clearer escalation route.' }
            ],
            summary: 'Staff confidence finding sepsis equipment rose after the trolley (median 4.5 of 5). Healthcare assistants asked for a clearer escalation route, which was added to the trolley card.'
        }],
        patientFeedback: [
            { date: '2026-02-03', feedback: 'My father was seen quickly and the nurse started his drip straight away; we felt he was taken seriously.', action: 'Shared with the team at handover as positive feedback.', pdsaLink: 'PDSA 3: PGD pilot on day shifts' },
            { date: '2026-03-11', feedback: 'Nobody explained why my mum needed antibiotics before the doctor saw her.', action: 'Added a short explanation for families to the PGD training.', pdsaLink: 'PDSA 4: Triage prompt and order set' }
        ],
        emqiat: {
            pdpGoals: 'Lead a complete QIP with a family of measures and at least three PDSA cycles; complete Making Data Count training; present at a regional meeting.',
            pdpReview: 'All three goals met. The project reached its aim, I completed the training in November 2025 and presented regionally in April 2026.',
            cctSummary: 'From audit in ACCS, to joining a QIP in ST3, to leading a multi-disciplinary project that spread to a second site.',
            qiJourney: {
                creatingConditions: { rating: 4, evidence: 'Secured a sponsor and built a multi-disciplinary team before testing changes.' },
                understandingSystems: { rating: 4, evidence: 'Process map, fishbone, 5 Whys and Pareto of 120 late cases.' },
                developingAims: { rating: 3, evidence: 'SMART aim with an operational definition and a family of measures.' },
                leadershipTeams: { rating: 4, evidence: 'Negotiated the PGD with microbiology and pharmacy.' },
                projectManagement: { rating: 3, evidence: 'Charter, Gantt chart and action plan kept the project on track.' }
            },
            educationLog: [
                { date: '2025-10-15', type: 'Online Module (e.g. IHI)', provider: 'IHI Open School', hours: 6, reflection: 'Model for Improvement and PDSA ramps: start small and test fast.' },
                { date: '2025-11-20', type: 'National QI Course', provider: 'NHS England Making Data Count', hours: 7, reflection: 'Run chart and SPC rules; report shifts, not averages.' },
                { date: '2026-02-12', type: 'Regional QI Training Day', provider: 'Regional EM training programme', hours: 6, reflection: 'Stakeholder mapping and measurement plans.' },
                { date: '2026-03-18', type: 'Departmental QI Meeting', provider: 'ED governance', hours: 2, reflection: 'Presented results; feedback on sustainability.' }
            ],
            lat: {
                patientSafety: 'Promoted a no-blame review of late cases and shared learning at huddles.',
                teamCulture: 'Gave nurses ownership of the trolley and PGD.',
                emotionalIntelligence: 'Listened to microbiology concerns before proposing a solution.',
                strategicInfluence: 'Linked the project to the Trust sepsis priority to secure EPR time.',
                serviceImprovement: 'Sustained the change through checklists, competencies and the EPR.'
            }
        },
        emqiatForm: {
            dateOccurred: '2025-05-19', endDate: '2026-05-31', description: 'Time to IV antibiotics for red-flag sepsis in the ED',
            stageOfTraining: 'Higher (ST4–ST6)', placement: 'Emergency Department, fictional district general hospital', dateOfCompletion: '2026-06-15',
            pdp: 'My QI PDP this year was to move from taking part in QI to leading a complete project.\n1. Lead a departmental QIP through at least three PDSA cycles with a family of measures.\n2. Complete Making Data Count training.\n3. Present the results at governance and a regional meeting.',
            qiEducationInvolvement: '1. IHI Open School improvement modules (October 2025): I learned the Model for Improvement and applied it to plan each PDSA cycle with a written prediction.\n2. NHS England Making Data Count (November 2025): taught me run chart and SPC rules, which I used to judge every change.\n3. Regional QI training day (February 2026): a session on stakeholder mapping that helped me win over microbiology.\n4. Departmental governance teaching session (March 2026), where I taught juniors how to read our run chart.',
            qiEducationLearning: 'Making Data Count changed how I judge whether a change has worked: for Measurement, I now look for shifts and trends on a run chart rather than comparing two averages. The IHI modules gave me the habit of small, fast Testing Changes, which is why PDSA 2 started in six bays rather than the whole department. The stakeholder session improved my Leadership & Teams work, because I mapped people by power and interest before asking for anything. In future, and as a consultant, I will start every project with a baseline run chart and a stakeholder map before choosing any change.',
            involvedInProject: 'yes',
            overview: {
                background: 'A median of 42% of red-flag sepsis patients in our ED received IV antibiotics within 60 minutes of triage (13 weeks of baseline data, 247 patients).',
                aim: 'Increase this from 42% to 90% by 31 May 2026.',
                understandingProblem: 'Process mapping, a fishbone, 5 Whys and a Pareto chart of 120 late cases showed the main causes were waiting for a prescriber and finding equipment.',
                measures: 'Outcome: % within 60 minutes (weekly). Process: median time to antibiotics; reasons for delay; staff confidence. Balancing: inappropriate antibiotic starts per month.',
                interventions: 'PDSA 1 teaching (abandoned); PDSA 2a and 2b sepsis trolley (adapted, then adopted); PDSA 3 nurse PGD (adapted, then adopted); PDSA 4 EPR prompt (adopted).',
                results: 'Shifts after the trolley and the PGD; median 91% over the final 12 weeks. Median time to antibiotics fell from 94 to 44 minutes, with no rise in inappropriate starts.',
                nextSteps: 'Changes embedded in checklists, competencies and the EPR; spreading to the second ED in the Trust.'
            },
            role: 'I led the project from start to finish. For Creating Conditions, I recruited a consultant sponsor, a sepsis champion nurse, a pharmacist and an EPR analyst, and linked the work to the Trust sepsis priority. For Understanding Systems, I ran the process mapping session, the fishbone and the Pareto analysis of 120 late cases, which showed that waiting for a prescriber and finding equipment were the main causes. For Developing Aims, I wrote the SMART aim and agreed the family of measures with the team. For Testing Changes, I planned each PDSA cycle with a written prediction and reviewed the run chart every week; when the teaching cycle failed I abandoned it rather than pressing on. For Measurement, I built the run and SPC charts and checked them against the rules. The hardest challenge was the nurse PGD: microbiology were concerned about overtreatment, so I negotiated a balancing measure and a review point, and delegated the competency sign-off to the sepsis champion. For Implement and Spread, I worked with the EPR team on a triage prompt and handed the project to the second ED\'s lead.',
            teamStakeholders: 'The core team was a consultant sponsor, a sepsis champion nurse, a pharmacist, an EPR analyst and a core trainee. We met for 20 minutes every fortnight, kept an action log, and I sent a short email update after each meeting. I mapped stakeholders by power and interest: the nursing sister and matron were high power, so I briefed them in person before each change. Microbiology had concerns about nurses giving antibiotics under a PGD; I won over the consultant microbiologist by adding a balancing measure for inappropriate starts and agreeing a three-month review. Staff feedback came through a short survey before and after, and through huddles on the shop floor.',
            sharingResults: 'I presented the run chart and PDSA learning at ED governance in March 2026 to about 30 consultants and nurses. I presented a poster at the regional EM trainee QI day in April 2026. A summary appeared in the Trust patient-safety newsletter in May 2026, and the second ED in the Trust has asked for the trolley and PGD.',
            qiJourney: { creatingConditions: true, understandingSystems: true, developingAims: true, testingChanges: true, implement: true, spread: true, leadershipTeams: true, projectManagementCommunication: true, measurement: true },
            curriculum: { higherSlo11Kc1: true, higherSlo11Kc2: true },
            reflections: 'My first prediction, that teaching would fix the problem, was wrong, and the run chart showed it within four weeks. I learned to let the data challenge my assumptions instead of defending my first idea. I also realised that a change people can see and touch, like the sepsis trolley, spreads faster than an instruction. The biggest challenge was the PGD: I underestimated how long pharmacy and microbiology sign-off would take, and the project stalled for six weeks. Next time I would involve sceptical stakeholders at the very start, before choosing the change, and I would book the governance dates for the whole year in advance. I would also collect the balancing measure from the first week rather than adding it later. Overall I understand QI much better as a team activity: my job was less to have the ideas and more to create the conditions, keep the data honest and make it easy for others to act.',
            nextYearPdp: 'I CCT in 2027, so my QI plans are as a new consultant.\n1. Lead a QIP at the ED and acute medicine interface on time to specialty review.\n2. Supervise two junior trainees through their first QI projects.\n3. Hand over and sustain the sepsis project by agreeing a named consultant owner and a monthly run chart at governance.',
            endOfTrainingJourney: 'My QI journey began as a foundation (F2) doctor, when I collected data for a falls audit without understanding why the results never changed practice. In ACCS I took part in a QIP on cannula documentation and first used a run chart, but I did not lead it. In ST4 I led a small project on analgesia in triage, which taught me about PDSA cycles but stalled because I had no consultant sponsor. In ST5 and ST6 I applied those lessons to the sepsis project: I secured a sponsor first, built a team, led the diagnostic work and used a family of measures. The biggest change across my training is that I now see QI as leadership rather than data collection: leading a team, negotiating with other specialties and making the change easy to adopt. As an EM consultant I will apply this by sponsoring trainee projects, insisting on a baseline run chart and a stakeholder map before any change, and using governance meetings to review run charts rather than single audit results. I will also lead the department\'s sepsis work and help spread it to other sites.'
        },
        assessment: {
            supervisorComments: 'An excellent, well-led project with clear predictions, honest learning from an abandoned change and good use of run and SPC charts. Meets SLO 11 at the level expected of a higher trainee.',
            signedOff: true, signedOffBy: 'Dr Priya Shah (demo supervisor)', signedOffByUid: '', signedOffByEmail: '', signedOffGmc: '',
            signedOffDate: '15/06/2026', lastSupervisorActivityAt: '2026-06-15T10:00:00Z', traineeSeenAt: '2026-06-16T09:00:00Z'
        },
        visibility: { hideFromDeptQIPLead: false }
    };
    // A saved restore point, so the History (snapshots) feature has an entry.
    d.snapshots = [{
        id: 'snap1', label: 'Before PDSA 3 (nurse PGD)', timestamp: '2025-11-07T17:00:00Z',
        data: JSON.parse(JSON.stringify({ checklist: d.checklist, changeIdeas: changeIdeas.slice(0, 2), pdsa: changeIdeas.slice(0, 2).flatMap(ci => ci.pdsaCycles), chartData: measures[0].chartData.slice(0, 23), measures: [{ ...measures[0], chartData: measures[0].chartData.slice(0, 23) }], activeMeasureId: 'measure_default' }))
    }];
    return d;
}

// Two lighter fictional projects at earlier stages, plus the main demo, for
// the demo Supervisor and QIP Lead views.
export function getDemoCohort() {
    const delirium = {
        meta: { title: 'Delirium screening with the 4AT for patients aged 65 and over', created: '2026-08-04T09:00:00Z', updated: '2026-10-06T16:20:00Z', owner: 'Dr Sam Okafor (ST4)', trainingStage: 'higher' },
        checklist: {
            problem_desc: 'Only about 1 in 5 patients aged 65 and over in our ED have a documented delirium screen.',
            aim: 'To increase documented 4AT screening in patients aged 65 and over from 21% to 70% by 31 March 2027.',
            outcome_measure: '% of patients aged 65+ with a documented 4AT in the ED',
            process_measure: '% of triage nurses trained in the 4AT',
            balance_measure: 'Time from arrival to clinician assessment'
        },
        drivers: { primary: ['Recognition of delirium', 'Screening at triage'], secondary: ['Staff knowledge of the 4AT'], changes: ['4AT in the triage form'] },
        teamMembers: [{ id: '1', name: 'Sam Okafor', role: 'Project lead', grade: 'ST4', initials: 'SO', responsibilities: 'Lead' }],
        stakeholders: [{ name: 'Triage nurses', role: 'Screeners', x: 80, y: 60 }],
        changeIdeas: [{ id: 'ci-1', title: '4AT in the triage form', status: 'active', description: '', driverLink: 'Screening at triage', pdsaCycles: [
            { title: 'PDSA 1: 4AT prompt on one triage desk', startDate: '2026-09-14', start: '2026-09-14', status: 'studying', plan: 'Add a 4AT prompt to one triage desk for two weeks.', prediction: 'We predict screening on that desk will reach 50%.', do: 'Prompt in place on desk 1.', study: 'Screening rose to 46% on desk 1.', act: '' }
        ] }],
        measures: [{ id: 'measure_default', name: '% with documented 4AT', unit: '%', measureType: 'proportion', role: 'outcome',
            chartData: weekly('2026-08-03', [19, 22, 21, 24, 18, 21, 30, 38, 41], 'Baseline').map((p, i) => i >= 6 ? { ...p, grade: 'PDSA 1' } : p),
            chartSettings: { mode: 'run', title: '% of patients 65+ with a 4AT', yAxisLabel: '%', target: 70, showAnnotations: true } }],
        gantt: [{ id: 'g1', name: 'Baseline data', start: '2026-08-03', end: '2026-09-13', type: 'data', owner: 'SO', milestone: false }]
    };
    delirium.pdsa = delirium.changeIdeas.flatMap(ci => ci.pdsaCycles);

    const analgesia = {
        meta: { title: 'Time to analgesia for suspected hip fracture', created: '2026-09-22T09:00:00Z', updated: '2026-09-29T12:00:00Z', owner: 'Dr Rowan Hughes (ACCS CT2)', trainingStage: 'accs' },
        checklist: {
            problem_desc: 'Patients with a suspected hip fracture often wait more than 60 minutes for their first analgesia.',
            aim: ''
        },
        teamMembers: [{ id: '1', name: 'Rowan Hughes', role: 'Project lead', grade: 'ACCS CT2', initials: 'RH', responsibilities: 'Lead' }]
    };

    const main = getDemoData();
    return [
        { traineeName: 'Dr Alex Morgan', traineeEmail: 'alex.morgan@example.nhs.uk', addedAt: '2025-05-20T09:00:00Z', data: main },
        { traineeName: 'Dr Sam Okafor', traineeEmail: 'sam.okafor@example.nhs.uk', addedAt: '2026-08-05T09:00:00Z', data: delirium },
        { traineeName: 'Dr Rowan Hughes', traineeEmail: 'rowan.hughes@example.nhs.uk', addedAt: '2026-09-23T09:00:00Z', data: analgesia }
    ];
}
