// ==========================================================================
// STATE MANAGEMENT & DATA STRUCTURES
// ==========================================================================

export const state = {
    // User Authentication
    currentUser: null,
    
    // Project Selection
    currentProjectId: null,
    projectData: null, // This holds the active QIP JSON
    
    // Application Modes
    isReadOnly: false,  // For shared links
    isDemoMode: false,  // For guest users trying the demo
    
    // UI State
    toolMode: 'driver', // 'driver' | 'process'
    activeView: 'dashboard',
    
    // History Stack for Undo/Redo
    historyStack: [],
    redoStack: [],
    MAX_HISTORY: 50, // Prevent memory bloat
    
    // Global Settings
    aiKey: localStorage.getItem('rcem_qip_ai_key') || null
};

// ==========================================================================
// EMPTY PROJECT TEMPLATE
// ==========================================================================
// This defines the schema for a new project.
// All fields must be initialized to avoid null pointer errors in renderers.

export const emptyProject = {
    meta: {
        title: "New QIP",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        owner: null
    },
    checklist: {
        // Problem
        problem_desc: "",
        problem_context: "",
        problem_evidence: "",
        
        // Aim (SMART)
        aim: "",
        aim_measure: "",
        aim_baseline: "",
        aim_target: "",
        aim_date: "",
        
        // Measures
        measure_outcome: "",
        measure_process: "",
        measure_balance: "",
        
        // Governance
        ethics: "",
        
        // Research
        lit_review: "",
        
        // Closing
        learning: "",
        sustain: "",
        results_text: ""
    },
    drivers: {
        primary: [],   // Array of strings
        secondary: [], // Array of strings
        changes: []    // Array of strings
    },
    // Fishbone schema (Legacy support, though focusing on Drivers now)
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
    process: ["Start", "End"], // Process Map steps
    
    // PDSA Cycles
    pdsa: [], // { title, start, end, desc, do, study, act }
    
    // Chart Data
    chartData: [], // { date, value, grade }
    chartSettings: {
        mode: 'run',
        showMedian: true,
        showMean: false,
        ucl: null,
        lcl: null
    },
    
    // Stakeholder Analysis
    stakeholders: [], // { name, x, y, role }
    
    // Team Members
    teamMembers: [], // { id, name, role, grade, initials, responsibilities }
    
    // Leadership Log
    leadershipLogs: [], // { date, note }
    
    // Gantt Chart Tasks
    gantt: [] // { id, name, start, end, type, owner, dependency, milestone }
};

// ==========================================================================
// DEMO DATA GENERATOR
// ==========================================================================
// Returns a fully populated project for the "Gold Standard" example.

export function getDemoData() {
    return {
        meta: {
            title: "Improving Sepsis 6 Delivery in ED",
            created: "2023-09-01T10:00:00Z",
            updated: new Date().toISOString()
        },
        checklist: {
            problem_desc: "Audit showed only 45% of sepsis patients received antibiotics within 1 hour. This leads to increased mortality and length of stay.",
            problem_context: "District General Hospital ED, 80k attendances/year.",
            aim: "To increase percentage of patients receiving antibiotics within 1h of red flag sepsis trigger from 45% to 90% by August 2024.",
            aim_measure: "% receiving Abx < 1h",
            aim_baseline: "45%",
            aim_target: "90%",
            aim_date: "2024-08-01",
            measure_outcome: "% patients receiving Abx <1hr",
            measure_process: "Door-to-needle time (minutes)",
            measure_balance: "Inappropriate antibiotic prescribing rates",
            learning: "Nurse-led initiation was the key driver for success. Culture change takes time.",
            sustain: "Sepsis lead nurse appointed to audit monthly. Sepsis eLearning mandatory for new starters.",
            results_text: "Significant improvement seen after introduction of Sepsis Trolley (Cycle 2) and PGD (Cycle 3). Shift maintained above median for 6 months.",
            ethics: "Registered as Service Evaluation with local audit department. No individual patient consent required."
        },
        drivers: {
            primary: ["Staff Knowledge", "Equipment Availability", "Process Efficiency"],
            secondary: ["Sepsis identification training", "Cannulation packs ready", "PGD for nurses", "Early senior review"],
            changes: ["Sepsis trolley in Resus", "Teaching sessions", "Poster campaign", "Nurse PGD", "Sepsis Sticker"]
        },
        fishbone: {
             categories: [
                { text: "Patient", causes: [{text: "Late presentation", x:30, y:40}] },
                { text: "Staff", causes: [{text: "Rotational fatigue", x:40, y:60}] },
                { text: "Equipment", causes: [] },
                { text: "Process", causes: [] },
                { text: "Environment", causes: [] },
                { text: "Management", causes: [] }
             ]
        },
        process: ["Triage", "Sepsis Screen Positive", "Senior Review", "Cannulation", "Antibiotics Administered"],
        pdsa: [
            {
                title: "Cycle 1: The Sepsis Trolley",
                start: "2023-10-01",
                end: "2023-10-14",
                desc: "Plan: Introduce a dedicated trolley with all Sepsis 6 equipment in Majors A to reduce time hunting for kit.",
                do: "Trolley stocked and placed. Staff informed via huddle.",
                study: "Audit showed 10% improvement, but trolley often raided for other fluids, leaving it empty.",
                act: "Label trolley clearly 'SEPSIS ONLY' and move to central hub. Assign HCA to restock daily."
            },
            {
                title: "Cycle 2: Nurse PGD",
                start: "2023-11-01",
                end: "2023-12-01",
                desc: "Plan: Allow Band 6+ nurses to initiate IV antibiotics via PGD to bypass wait for doctor prescription.",
                do: "PGD signed off by Trust. Training delivered to 20 nurses.",
                study: "Time to antibiotics dropped to 35 mins average. Zero inappropriate administrations.",
                act: "Roll out training to all Band 5 nurses."
            }
        ],
        chartData: [
            { date: "2023-09-01", value: 45, grade: "Baseline" },
            { date: "2023-09-08", value: 42, grade: "Baseline" },
            { date: "2023-09-15", value: 48, grade: "Baseline" },
            { date: "2023-09-22", value: 46, grade: "Baseline" },
            { date: "2023-10-01", value: 55, grade: "Intervention 1" },
            { date: "2023-10-08", value: 60, grade: "Intervention 1" },
            { date: "2023-10-15", value: 58, grade: "Intervention 1" },
            { date: "2023-11-01", value: 75, grade: "Intervention 2" },
            { date: "2023-11-08", value: 82, grade: "Intervention 2" },
            { date: "2023-11-15", value: 85, grade: "Intervention 2" },
            { date: "2023-11-22", value: 88, grade: "Intervention 2" },
            { date: "2023-11-29", value: 91, grade: "Intervention 2" },
            { date: "2023-12-06", value: 89, grade: "Sustain" }
        ],
        teamMembers: [
            { id: "1", name: "Dr. J. Bloggs", role: "Project Lead", grade: "ST4", initials: "JB" },
            { id: "2", name: "Sr. M. Smith", role: "Nursing Lead", grade: "Band 7", initials: "MS" }
        ],
        stakeholders: [
            { name: "ED Consultants", x: 90, y: 90 },
            { name: "Junior Doctors", x: 80, y: 30 },
            { name: "Site Manager", x: 20, y: 70 },
            { name: "Patients", x: 90, y: 10 }
        ],
        leadershipLogs: [
             { date: "2023-09-01", note: "Met with Clinical Lead to discuss project feasibility. Approved." },
             { date: "2023-10-15", note: "Presented interim results to Governance meeting. Feedback: Focus on sustainability." },
             { date: "2023-11-30", note: "Conflict resolution: Pharmacist concerned about PGD. Meeting held, safeguards agreed." }
        ],
        gantt: [
             { id: "1", name: "Baseline Audit", start: "2023-09-01", end: "2023-09-30", type: "study", owner: "JB" },
             { id: "2", name: "Sepsis Trolley Design", start: "2023-09-15", end: "2023-09-25", type: "plan", owner: "MS" },
             { id: "3", name: "Implementation Cycle 1", start: "2023-10-01", end: "2023-10-14", type: "do", owner: "JB" },
             { id: "4", name: "PGD Approval", start: "2023-10-15", end: "2023-11-01", type: "act", owner: "JB" }
        ]
    };
}
