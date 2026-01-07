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
        measure_outcome: "",
        measure_process: "",
        measure_balance: "",
        team: "",
        results_text: "",
        learning: "",
        sustain: "",
        context: "",
        ethics: "Service Evaluation (No Ethics Required)",
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
            problem_desc: "Audit showed only 45% of sepsis patients received antibiotics within 1 hour.",
            aim: "We aim to increase the delivery of IV antibiotics within 1 hour for patients with Red Flag Sepsis from 45% to 90% by August 2025.",
            measure_outcome: "% of patients receiving Abx <1hr",
            measure_process: "Stock level of Sepsis Grab Bags",
            measure_balance: "Rate of anaphylaxis (checking safety)",
            team: "Dr. A (Lead), Nurse B (Champion), Pharm C",
            results_text: "We achieved a sustained shift in compliance, reaching a median of 88% after PDSA Cycle 3.",
            learning: "Human factors were key. Education alone didn't work; we needed 'forcing functions'.",
            sustain: "Sepsis nurse champion appointed to continue monthly audits.",
            context: "A busy District General Hospital ED seeing 90,000 patients/year.",
            ethics: "Service Evaluation (No Ethics Required)",
            lit_review: "The 'Surviving Sepsis Campaign' guidelines mandate 1-hour antibiotic delivery."
        },
        drivers: {
            primary: ["Staff Knowledge", "Equipment Access", "Early Identification"],
            secondary: ["Teaching Sessions", "Grab Bags in Resus", "Triage Tool update"],
            changes: ["Weekly simulaton", "Stock checklist", "Electronic alert"]
        },
        fishbone: { 
            categories: [
                {text:"People", x: 20, y: 15, causes:[{text: "Rotational Staff", x: 25, y: 25}, {text: "Agency Nurses", x: 15, y: 35}]}, 
                {text:"Process", x: 20, y: 65, causes:[{text: "Protocol hard to find", x: 25, y: 75}]}
            ] 
        },
        chartData: [
            { date: "2024-01-01", value: 45, note: "Baseline", grade: "Consultant" },
            { date: "2024-01-08", value: 42, grade: "Junior" },
            { date: "2024-01-15", value: 48, grade: "Middle Grade" },
            { date: "2024-01-22", value: 46, grade: "Nurse" },
            { date: "2024-01-29", value: 65, note: "PDSA 1: Education", grade: "Middle Grade" },
            { date: "2024-02-05", value: 62, grade: "Junior" },
            { date: "2024-02-19", value: 85, note: "PDSA 2: Grab Bags", grade: "Consultant" },
            { date: "2024-03-05", value: 92, grade: "Nurse" }
        ],
        pdsa: [
            { title: "Cycle 1: Education", desc: "Posters and teaching sessions.", do: "Ran 3 sessions.", study: "Knowledge improved but compliance didn't.", act: "Need system change.", start: "2024-01-29", end: "2024-02-05" },
            { title: "Cycle 2: Grab Bags", desc: "Pre-filled bags in Resus.", do: "Implemented.", study: "Immediate jump in compliance.", act: "Adopt and spread.", start: "2024-02-19", end: "2024-03-01" }
        ],
        stakeholders: [],
        teamMembers: [
            { name: "Dr. A. Jones", role: "Project Lead", initials: "AJ", grade: "Registrar", responsibilities: "Overall coordination" }
        ],
        leadershipLogs: [],
        gantt: [] 
    };
}
