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
        // Wizard Fields
        problem_context: "",
        problem_evidence: "",
        problem_specific: "",
        aim_measure: "",
        aim_baseline: "",
        aim_target: "",
        aim_date: "",
        
        // Compiled Fields
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
        meta: { 
            title: "Improving Sepsis 6 Compliance", 
            created: new Date().toISOString() 
        },
        checklist: {
            // Wizard breakdown
            problem_context: "Sepsis is a leading cause of avoidable death. Early antibiotics are critical.",
            problem_evidence: "Local audit (Jan 2026) showed 55% of Red Flag Sepsis patients breached the 1-hour target.",
            problem_specific: "Delays occur mainly during the 'hiding' of equipment and drugs.",
            aim_measure: "delivery of IV antibiotics within 1 hour",
            aim_baseline: "45%",
            aim_target: "90%",
            aim_date: "August 2026",

            // Compiled Text
            problem_desc: "Sepsis is a leading cause of avoidable death. A local audit (Jan 2026) revealed only 45% of Red Flag Sepsis patients received IV antibiotics within 1 hour. This correlates with a 7.6% increase in mortality risk per hour of delay (Kumar et al).",
            aim: "To increase the delivery of IV antibiotics within 1 hour for patients with Red Flag Sepsis in the ED from 45% to 90% by August 2026.",
            methodology: "We used the Model for Improvement. A Fishbone diagram identified 'Human Factors' barriers (cognitive load) and a Driver Diagram to prioritised high-leverage changes (forcing functions).",
            measure_outcome: "% of eligible patients receiving IV Abx <1hr (Weekly)",
            measure_process: "% of Sepsis Grab Bags fully stocked (Daily audit)",
            measure_balance: "Rate of anaphylaxis (Ensuring speed does not bypass safety checks)",
            team: "Dr. A (Reg - Lead), Sr. B (Nurse Champion), Pharm C (Pharmacy), Mr. D (ED Consultant Sponsor)",
            results_text: "Baseline median compliance was 45%. PDSA 1 (Education) showed no sustained shift. PDSA 2 (Grab Bags) created a 'Step Change' (Special Cause Variation), raising the median to 88%. This meets the Rules for Shift (6 points above median).",
            learning: "We learned that 'Education' is a weak intervention. Relying on staff memory during high-stress periods failed. The 'Grab Bags' acted as a forcing function, reducing cognitive load and putting the right equipment at the bedside.",
            sustain: "Sepsis Nurse Champion role formalised in job plan (0.5 PA). Grab bag stocking added to HCA daily checklist. Sepsis module added to induction app.",
            context: "A busy District General Hospital ED seeing 90,000 patients/year with high agency staff usage (30%).",
            ethics: "Confirmed as Service Evaluation via HRA decision tool. Registered with Hospital Audit Department (Ref: ED-2026-004).",
            lit_review: "Surviving Sepsis Guidelines mandate 1-hour antibiotic delivery. NCEPOD 'Just Say Sepsis' highlighted delays in recognition."
        },
        drivers: {
            primary: ["Staff Knowledge & Culture", "Equipment Accessibility", "Early Identification Systems"],
            secondary: ["Regular Teaching", "Standardised 'Grab Bags'", "Triage Tool Sensitivity", "Feedback Loop to Staff"],
            changes: ["Simulation Training (Weekly)", "Pre-filled Sepsis Trolleys", "Electronic Triage Alert", " 'Sepsis Star' of the Month Award"]
        },
        fishbone: { 
            categories: [
                {
                    text: "People (Human Factors)", x: 20, y: 15, 
                    causes: [
                        {text: "High Cognitive Load", x: 25, y: 25}, 
                        {text: "Agency Staff (Unfamiliar)", x: 15, y: 35},
                        {text: "Fear of criticism", x: 28, y: 18}
                    ]
                }, 
                {
                    text: "Process", x: 20, y: 65, 
                    causes: [
                        {text: "Protocol on Intranet (Hard to find)", x: 25, y: 75},
                        {text: "No PGD for Nurse prescribing", x: 15, y: 60}
                    ]
                },
                {
                    text: "Equipment", x: 70, y: 15,
                    causes: [
                        {text: "Antibiotics locked in cupboard", x: 75, y: 25},
                        {text: "Fluids in separate room", x: 65, y: 20}
                    ]
                },
                {
                    text: "Environment", x: 70, y: 65, 
                    causes: [
                        {text: "Overcrowding in Resus", x: 75, y: 70},
                        {text: "Computer shortage", x: 65, y: 60}
                    ]
                }
            ] 
        },
        process: ["Patient Arrives", "Triage (NEWS2 >5)", "Sepsis Screen Positive", "Alert Triggered", "Grab Bag Collected", "Cannulation & Bloods", "Antibiotics Administered"],
        chartData: [
            { date: "2026-01-01", value: 45, note: "Baseline Start", grade: "Audit", category: "outcome" },
            { date: "2026-01-08", value: 42, grade: "Audit", category: "outcome" },
            { date: "2026-01-15", value: 48, grade: "Audit", category: "outcome" },
            { date: "2026-01-22", value: 46, grade: "Audit", category: "outcome" },
            { date: "2026-01-29", value: 44, grade: "Audit", category: "outcome" },
            { date: "2026-02-05", value: 47, grade: "Audit", category: "outcome" },
            { date: "2026-02-12", value: 65, note: "PDSA 1: Education Posters", grade: "Audit", category: "outcome" },
            { date: "2026-02-19", value: 55, grade: "Audit", category: "outcome" },
            { date: "2026-02-26", value: 52, grade: "Audit", category: "outcome" },
            { date: "2026-03-05", value: 85, note: "PDSA 2: Grab Bags Introduced", grade: "Audit", category: "outcome" },
            { date: "2026-03-12", value: 92, grade: "Audit", category: "outcome" },
            { date: "2026-03-19", value: 88, grade: "Audit", category: "outcome" },
            { date: "2026-03-26", value: 90, grade: "Audit", category: "outcome" },
            { date: "2026-04-02", value: 89, grade: "Audit", category: "outcome" },
            { date: "2026-04-09", value: 91, note: "Sustained Shift", grade: "Audit", category: "outcome" }
        ],
        pdsa: [
            { 
                title: "Cycle 1: Education Campaign", 
                desc: "We hypothesised that staff didn't know the protocol. Plan: Put posters in the staff room.", 
                do: "Posters displayed for 2 weeks.", 
                study: "Compliance rose transiently to 65% then fell back. Staff reported 'poster blindness'.", 
                act: "Abandon. Education is insufficient. We need a system change.", 
                start: "2026-02-12", end: "2026-02-26" 
            },
            { 
                title: "Cycle 2: Sepsis Grab Bags", 
                desc: "Hypothesis: Gathering equipment takes too long. Plan: Create pre-filled 'Grab Bags' containing Fluids, Giving Set, Blood Bottles, and Abx/Fluids PGD.", 
                do: "Implemented in Resus bays only for 2 weeks.", 
                study: "Median compliance jumped to 88%. 'Time to antibiotic' dropped by 14 mins average.", 
                act: "Adopt and Spread to Majors/Ambulatory Care.", 
                start: "2026-03-05", end: "2026-03-19" 
            }
        ],
        stakeholders: [
            { name: "ED Consultants (Sponsors)", x: 90, y: 90 },
            { name: "Nursing Staff (Users)", x: 80, y: 60 },
            { name: "Pharmacy (Supply)", x: 40, y: 70 },
            { name: "Infection Control", x: 30, y: 40 }
        ],
        teamMembers: [
            { name: "Dr. A. Jones", role: "Project Lead", initials: "AJ", grade: "ST4", responsibilities: "Data collection & PDSA Lead" },
            { name: "Sr. B. Smith", role: "Nurse Champion", initials: "BS", grade: "Band 7", responsibilities: "Equipment sourcing" }
        ],
        leadershipLogs: [
            { date: "2026-01-10", note: "Presented Baseline Data to Governance meeting. Approval for project granted." },
            { date: "2026-02-15", note: "Conflict: Pharmacy initially refused to pre-pack bags. Negotiated a 2-week trial using ED staff to pack them." }
        ],
        gantt: [
            { id: "1", name: "Baseline Audit", start: "2026-01-01", end: "2026-01-28", type: "study", owner: "AJ", milestone: true },
            { id: "2", name: "PDSA 1 (Posters)", start: "2026-02-01", end: "2026-02-14", type: "do", owner: "AJ", dependency: "1" },
            { id: "3", name: "Bag Design Workshop", start: "2026-02-15", end: "2026-02-28", type: "plan", owner: "BS", dependency: "2" },
            { id: "4", name: "PDSA 2 (Bags)", start: "2026-03-01", end: "2026-03-30", type: "do", owner: "BS", dependency: "3" }
        ]
    };
}
