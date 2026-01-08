export const state = {
    currentUser: null,
    currentProjectId: null,
    projectData: null,
    isDemoMode: false,
    isReadOnly: false,
    historyStack: [],
    redoStack: [],
    MAX_HISTORY: 20
};

export const emptyProject = {
    meta: {
        title: "New QIP",
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    },
    checklist: {
        problem_desc: "",
        aim: "",
        methodology: "Model for Improvement (PDSA Cycles) & Driver Diagram",
        measure_outcome: "",
        measure_process: "",
        measure_balance: "",
        team: "",
        results_text: "",
        learning: "",
        sustain: "",
        context: "", 
        ethics: "Service Evaluation - No Ethics Approval Required (HRA Decision Tool)", 
        lit_review: "" 
    },
    drivers: {
        primary: [],
        secondary: [],
        changes: []
    },
    fishbone: {
        categories: [
            { text: "People", x: 20, y: 15, causes: [] },
            { text: "Process", x: 20, y: 65, causes: [] },
            { text: "Equipment", x: 70, y: 15, causes: [] },
            { text: "Environment", x: 70, y: 65, causes: [] }
        ]
    },
    process: ["Start", "End"],
    chartData: [], 
    pdsa: [], 
    stakeholders: [],
    teamMembers: [], 
    leadershipLogs: [], 
    gantt: [] 
};

export function getDemoData() {
    return {
        meta: { title: "Sepsis 6 Compliance", created: new Date().toISOString() },
        checklist: {
            problem_desc: "An audit of 50 patient notes in Jan 2026 revealed only 45% of patients with Red Flag Sepsis received IV antibiotics within 1 hour. This falls below the RCEM benchmark of 95%.",
            aim: "To increase the delivery of IV antibiotics within 1 hour for patients with Red Flag Sepsis in the ED from 45% to 90% by August 2026.",
            methodology: "We used the Model for Improvement. A Fishbone diagram identified barriers, and a Driver Diagram helped prioritise change ideas. We tested changes using sequential PDSA cycles.",
            measure_outcome: "% of eligible patients receiving IV Abx <1hr (Weekly)",
            measure_process: "% of Sepsis Grab Bags fully stocked (Daily audit)",
            measure_balance: "Rate of anaphylaxis (to ensure speed doesn't compromise safety checking)",
            team: "Dr. A (Reg - Lead), Sr. B (Nurse Champion), Pharm C (Pharmacy)",
            results_text: "Baseline median was 45%. Following PDSA 1 (Education), there was no significant shift. PDSA 2 (Grab Bags) resulted in a 'Shift' of 8 points above the mean, raising the new median to 88%. This has been sustained for 6 weeks.",
            learning: "Education alone is rarely sufficient for sustainable change. 'Forcing functions' like the Grab Bags, which put equipment directly at the bedside, were far more effective.",
            sustain: "Sepsis Nurse Champion role formalised in job plan. Grab bag stocking added to HCA daily checklist. Sepsis module added to induction app.",
            context: "A busy District General Hospital ED seeing 90,000 patients/year with high agency staff usage.",
            ethics: "Confirmed as Service Evaluation via HRA decision tool. registered with Hospital Audit Department (Ref: ED-2026-004).",
            lit_review: "The 'Surviving Sepsis Campaign' guidelines mandate 1-hour antibiotic delivery. Previous studies (Smith et al, 2023) show grab bags can reduce time-to-needle by 20 mins."
        },
        drivers: {
            primary: ["Staff Knowledge", "Equipment Accessibility", "Early Identification"],
            secondary: ["Regular Teaching", "Grab Bags in Resus", "Triage Tool update", "Feedback to staff"],
            changes: ["Weekly simulation training", "Stock checklist for bags", "Electronic triage alert", "Poster campaign in staff room"]
        },
        fishbone: { 
            categories: [
                {
                    text: "People", x: 20, y: 15, 
                    causes: [
                        {text: "Rotational Staff", x: 25, y: 25}, 
                        {text: "Agency Nurses", x: 15, y: 35},
                        {text: "Cognitive Load", x: 28, y: 18}
                    ]
                }, 
                {
                    text: "Process", x: 20, y: 65, 
                    causes: [
                        {text: "Protocol hard to find", x: 25, y: 75},
                        {text: "No PGD for nurses", x: 15, y: 60}
                    ]
                },
                {
                    text: "Equipment", x: 70, y: 15,
                    causes: [
                        {text: "Drugs locked away", x: 75, y: 25},
                        {text: "Missing flushes", x: 65, y: 20}
                    ]
                },
                {
                    text: "Environment", x: 70, y: 65, 
                    causes: [
                        {text: "Overcrowding", x: 75, y: 70},
                        {text: "Computer shortage", x: 65, y: 60}
                    ]
                }
            ] 
        },
        process: ["Patient Arrives", "Triage (NEWS2)", "Sepsis Screen Positive", "Alert Triggered", "Doctor Assessment", "Sepsis 6 Started", "Antibiotics Given"],
        chartData: [
            { date: "2026-01-01", value: 45, note: "Baseline", grade: "Consultant", category: "outcome" },
            { date: "2026-01-08", value: 42, grade: "Junior", category: "outcome" },
            { date: "2026-01-15", value: 48, grade: "Middle Grade", category: "outcome" },
            { date: "2026-01-22", value: 46, grade: "Nurse", category: "outcome" },
            { date: "2026-01-29", value: 44, grade: "Nurse", category: "outcome" },
            { date: "2026-02-05", value: 65, note: "PDSA 1: Education", grade: "Middle Grade", category: "outcome" },
            { date: "2026-02-12", value: 62, grade: "Junior", category: "outcome" },
            { date: "2026-02-19", value: 68, grade: "Junior", category: "outcome" },
            { date: "2026-02-26", value: 85, note: "PDSA 2: Grab Bags", grade: "Consultant", category: "outcome" },
            { date: "2026-03-05", value: 92, grade: "Nurse", category: "outcome" },
            { date: "2026-03-12", value: 88, grade: "Registrar", category: "outcome" },
            { date: "2026-03-19", value: 90, grade: "ACP", category: "outcome" }
        ],
        pdsa: [
            { title: "Cycle 1: Education", desc: "Posters and teaching sessions.", do: "Ran 3 sessions over 1 week.", study: "Knowledge improved but compliance didn't change significantly.", act: "Need system change (forcing function).", start: "2026-02-01", end: "2026-02-07" },
            { title: "Cycle 2: Grab Bags", desc: "Pre-filled bags in Resus.", do: "Implemented in Resus bays only.", study: "Immediate jump in compliance to 85%.", act: "Adopt and spread to Majors.", start: "2026-02-20", end: "2026-03-01" }
        ],
        stakeholders: [
            { name: "ED Consultants", x: 90, y: 90 },
            { name: "Junior Doctors", x: 80, y: 60 },
            { name: "Pharmacy", x: 40, y: 70 },
            { name: "Management", x: 30, y: 90 }
        ],
        teamMembers: [
            { name: "Dr. A. Jones", role: "Project Lead", initials: "AJ", grade: "Registrar", responsibilities: "Overall coordination & Data" },
            { name: "Sr. B. Smith", role: "Nurse Champion", initials: "BS", grade: "Nurse", responsibilities: "Grab bag maintenance" }
        ],
        leadershipLogs: [
            { date: "2026-01-10", note: "Met with Clinical Lead. Approval given for grab bags trial." },
            { date: "2026-02-15", note: "Pharmacy agreed to stock pre-packs for the bags." }
        ],
        gantt: [
            { id: "1", name: "Define Aim", start: "2026-01-01", end: "2026-01-07", type: "plan", owner: "AJ", milestone: true },
            { id: "2", name: "Collect Baseline", start: "2026-01-08", end: "2026-01-28", type: "study", owner: "AJ", dependency: "1" },
            { id: "3", name: "Design Grab Bags", start: "2026-02-01", end: "2026-02-14", type: "do", owner: "BS", dependency: "2" }
        ]
    };
}
