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
        owner: null,
        trainingStage: "" // Priority 1.3: 'accs' or 'higher'
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
        outcome_measure: "",
        process_measure: "",
        balance_measure: "",
        
        // Governance
        ethics: "",
        
        // Research
        lit_review: "",
        
        // Closing
        learning_points: "",
        sustainability: "",
        results_text: "",
        results_analysis: "",
        next_pdp: "" // Priority 1.4: Fixed Next Year's PDP missing field
    },
    drivers: {
        primary: [],   // Array of strings
        secondary: [], // Array of strings
        changes: []    // Array of strings
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
    process: ["Start", "End"], // Process Map steps
    
    pdsa: [], // { title, startDate, end, plan, do, study, act }
    
    chartData: [], // { date, value, grade }
    chartSettings: {
        mode: 'run',
        showMedian: true,
        showMean: false,
        ucl: null,
        lcl: null,
        title: '',
        yAxisLabel: '',
        showAnnotations: false
    },
    
    stakeholders: [], // { name, x, y, role }
    
    teamMembers: [], // { id, name, role, grade, initials, responsibilities }
    
    leadershipLogs: [], // { date, note }
    
    gantt: [] // { id, name, start, end, type, owner, dependency, milestone }
};

// ==========================================================================
// DEMO DATA GENERATOR - GOLD STANDARD SEPSIS QIP
// ==========================================================================
// Priority 3.3: Richly populated with 40+ data points, 5 PDSA cycles, full stakeholders, and reflections.

export function getDemoData() {
    return {
        meta: {
            title: "Improving Sepsis 6 Delivery in the Emergency Department",
            created: "2023-06-01T08:00:00Z",
            updated: new Date().toISOString(),
            owner: "Dr. J. Bloggs",
            trainingStage: "higher" // Demonstrates leadership
        },
        checklist: {
            problem_desc: "Retrospective audit of 150 consecutive patients with Red Flag Sepsis over 3 months revealed only 42% received IV antibiotics within 60 minutes of the sepsis trigger. This is significantly below the RCEM Clinical Standard of 90%. Root cause analysis identified multiple barriers: equipment scattered across the department, lack of nursing autonomy to initiate antibiotics, poor sepsis screening compliance at triage, and cultural acceptance of delays during periods of crowding.",
            problem_context: "District General Hospital Emergency Department with approximately 85,000 attendances per year. 24-hour consultant presence with typical staffing of 2-3 middle grades and 4-6 junior doctors. Average 4-hour performance of 72%. Regular corridor care with occupancy often exceeding 150%.",
            problem_evidence: "Baseline audit: 42% compliance (n=150). National Confidential Enquiry into Patient Outcome and Death (NCEPOD) 2015 'Just Say Sepsis' highlighted delays in antibiotic administration as a key driver of preventable mortality. RCEM Sepsis Audit 2022 showed national median of 67%.",
            
            aim: "To increase the percentage of patients with Red Flag Sepsis who receive IV antibiotics within 60 minutes of the sepsis trigger from 42% to 90% by June 2024 in the Emergency Department.",
            aim_measure: "Percentage of patients receiving antibiotics within 60 minutes",
            aim_baseline: "42%",
            aim_target: "90%",
            aim_date: "2024-06-01",
            
            outcome_measure: "% of Red Flag Sepsis patients receiving IV antibiotics within 60 minutes of trigger",
            process_measure: "Door-to-needle time in minutes; % of patients screened at triage; % of Sepsis 6 bundles completed",
            balance_measure: "Inappropriate antibiotic prescribing rate; patient complaints about cannulation; staff overtime hours",
            
            ethics: "Registered as Service Evaluation with local Audit Department (Ref: AUD-2023-0142). No individual patient consent required as per HRA decision tool. Caldicott approval obtained for data extraction. Project reviewed by ED Clinical Governance lead.",
            
            lit_review: `RCEM Clinical Standards for Emergency Departments (2022):
• 90% of patients with Red Flag Sepsis should receive IV antibiotics within 60 minutes

NICE Guideline NG51 - Sepsis: recognition, diagnosis and early management (2017):
• Recommends immediate empirical IV antibiotics for patients with high-risk criteria
• Emphasises the importance of the Sepsis 6 bundle

Surviving Sepsis Campaign: International Guidelines (2021):
• Strong recommendation for antibiotics within 1 hour of sepsis recognition
• Each hour delay associated with 7.6% increased mortality`,
            
            learning_points: `Key Learning Points:

1. SYSTEM CHANGES trump education: Initial educational interventions (Cycle 1) produced only marginal, unsustained improvement. The most effective changes were physical (Sepsis Trolley) and procedural (Nurse PGD).

2. LEADERSHIP & ENGAGEMENT: As a Higher Trainee, I learned that influencing consultant colleagues required data-driven conversations. I successfully navigated resistance to the nurse PGD by bringing Microbiology and Pharmacy into a joint stakeholder meeting.

3. NURSING EMPOWERMENT is transformative: The Patient Group Directive enabling nurses to initiate antibiotics was the single most impactful intervention. It removed the bottleneck of waiting for a doctor to prescribe.

4. SUSTAINABILITY requires OWNERSHIP: Assigning a Sepsis Champion (Band 7 nurse) with protected time was essential for maintaining gains.

5. DATA must be VISIBLE: Weekly run chart display at the nursing station created healthy competition and peer accountability.`,
            
            next_pdp: `In my next year of training, I aim to develop my skills in cross-specialty quality improvement. Having successfully implemented change within the ED footprint, my next project will focus on the interface between ED and Acute Medicine, specifically addressing the safety of patients waiting in ED corridors for ward beds. I will also complete the QIR (Quality Improvement at RCEM) advanced module to formalise my theoretical knowledge.`,

            sustainability: `Sustainability Plan:

STRUCTURAL:
• Sepsis Trolley maintenance added to HCA daily checklist
• Band 7 Sepsis Champion role with 2 hours/week protected time
• PGD embedded in Trust formulary with annual review

EDUCATIONAL:
• Sepsis training mandatory for all new starters (part of ED induction)
• Annual competency assessment for PGD nurses

MONITORING:
• Automated monthly data extraction from EPR
• Dashboard displayed at ED Quality Board
• Escalation alert to Clinical Lead if monthly compliance <85%`,
            
            results_text: `Analysis of Run Chart Data:

BASELINE (June-August 2023):
• Median compliance: 42%

POST CYCLE 2 - Sepsis Trolley (October 2023):
• Immediate improvement to 62%
• SHIFT detected: 6 consecutive points above median

POST CYCLE 3 - Nurse PGD (November 2023):
• Step change to 78%
• Time to antibiotics reduced by average 22 minutes

CURRENT STATE (June 2024):
• 92% compliance (exceeds 90% target)
• NEW MEDIAN established at 88%
• 47 consecutive weeks with compliance >80%`,
            
            results_analysis: "Statistical analysis demonstrates sustained special cause variation with a new process mean of 88% compliance, exceeding the 90% target. The improvement journey shows clear step-changes corresponding to each PDSA cycle intervention. Our SPC chart confirms rule 2 (8 consecutive points above the mean) was met following Cycle 3."
        },
        
        drivers: {
            primary: [
                "Early Sepsis Recognition",
                "Equipment Accessibility", 
                "Staff Empowerment & Culture",
                "Efficient Clinical Pathways"
            ],
            secondary: [
                "Triage screening accuracy",
                "Awareness of sepsis criteria",
                "Senior support availability",
                "Sepsis equipment location",
                "Drug cupboard access",
                "Blood culture availability",
                "Nursing autonomy to prescribe",
                "Confidence to escalate",
                "IT system support"
            ],
            changes: [
                "Mandatory NEWS2 + sepsis screen at triage",
                "Dedicated Sepsis Trolley in Majors",
                "Sepsis Grab Bags in Resus/Paeds",
                "Nurse PGD for IV antibiotics",
                "Sepsis Champion role (Band 7)",
                "Pre-printed Sepsis 6 proforma",
                "EPR Best Practice Alert"
            ]
        },
        
        fishbone: {
            categories: [
                { 
                    text: "Manpower", x: 15, y: 20,
                    causes: [
                        { text: "Reliance on agency staff", x: 8, y: 12 },
                        { text: "Inadequate sepsis training", x: 10, y: 28 },
                        { text: "Variable skill mix", x: 24, y: 26 }
                    ] 
                },
                { 
                    text: "Methods", x: 85, y: 20,
                    causes: [
                        { text: "No PGD for nurses", x: 78, y: 10 },
                        { text: "Waiting for doctor", x: 90, y: 26 }
                    ] 
                },
                { 
                    text: "Machines", x: 15, y: 50,
                    causes: [
                        { text: "Slow EPR system", x: 8, y: 42 },
                        { text: "No alerting system", x: 22, y: 44 }
                    ] 
                },
                { 
                    text: "Materials", x: 85, y: 50,
                    causes: [
                        { text: "Cannulas missing", x: 78, y: 42 },
                        { text: "Antibiotics locked", x: 88, y: 56 }
                    ] 
                },
                { 
                    text: "Measurements", x: 15, y: 80,
                    causes: [
                        { text: "No real-time audit", x: 8, y: 72 },
                        { text: "Poor feedback loops", x: 22, y: 74 }
                    ] 
                },
                { 
                    text: "Mother Nature", x: 85, y: 80,
                    causes: [
                        { text: "Department overcrowding", x: 78, y: 72 },
                        { text: "Distance to drug room", x: 82, y: 88 }
                    ] 
                }
            ]
        },
        
        process: [
            "Patient Arrival",
            "Triage Assessment (NEWS2)",
            "Sepsis Screen Applied",
            "Red Flag Positive?",
            "Wait for Doctor Review",
            "Doctor Prescribes Antibiotics",
            "Nurse Hunts for Equipment",
            "Bloods & Cultures Taken",
            "IV Access Obtained",
            "Antibiotics Administered"
        ],
        
        pdsa: [
            {
                title: "Cycle 1: Education Campaign",
                startDate: "2023-09-01",
                start: "2023-09-01",
                status: "complete",
                plan: "PLAN: Deliver 10-minute sepsis teaching at every handover for 4 weeks. Target: Increase compliance to 60%.\n\nPREDICTION: We predicted education alone would significantly improve compliance as staff would be more aware.",
                desc: "PLAN: Deliver 10-minute sepsis teaching at every handover for 4 weeks. Target: Increase compliance to 60%.\n\nPREDICTION: We predicted education alone would significantly improve compliance as staff would be more aware.",
                do: "Teaching delivered at 42/56 handovers (75% coverage). 12 A3 posters displayed across department.",
                study: "Compliance improved marginally from 42% to 48%, but dropped back to 45% by week 4. Prediction was incorrect. Staff surveys revealed: 'We know it's important, but can't find the equipment'.",
                act: "ABANDON as sole intervention. Education created awareness but did not address systemic barriers."
            },
            {
                title: "Cycle 2: Sepsis Trolley",
                startDate: "2023-10-01",
                start: "2023-10-01",
                status: "complete",
                plan: "PLAN: Introduce a dedicated bright yellow 'Sepsis Trolley' in Majors containing everything needed. HCA to check daily.\n\nPREDICTION: Eliminating the 'hunting for kit' barrier will reduce time to treatment by 15+ minutes.",
                desc: "PLAN: Introduce a dedicated bright yellow 'Sepsis Trolley' in Majors containing everything needed. HCA to check daily.\n\nPREDICTION: Eliminating the 'hunting for kit' barrier will reduce time to treatment by 15+ minutes.",
                do: "Trolley procured and stocked. Positioned in Bay 1. Daily checklist implemented.",
                study: "Immediate improvement observed. Compliance rose to 62%. SHIFT detected on run chart. Prediction was accurate.",
                act: "ADOPT and ADAPT. Roll out second trolley to Resus. Implement 'SEPSIS ONLY' labelling."
            },
            {
                title: "Cycle 3: Nurse PGD for Antibiotics",
                startDate: "2023-11-01",
                start: "2023-11-01",
                status: "complete",
                plan: "PLAN: Implement PGD enabling Band 6+ nurses to initiate IV antibiotics for Red Flag Sepsis without waiting for doctor.\n\nPREDICTION: Removing the doctor bottleneck will cause a massive step-change in compliance.",
                desc: "PLAN: Implement PGD enabling Band 6+ nurses to initiate IV antibiotics for Red Flag Sepsis without waiting for doctor.\n\nPREDICTION: Removing the doctor bottleneck will cause a massive step-change in compliance.",
                do: "PGD approved by D&T Committee. Training delivered to 24 nurses. Go-live 15th November.",
                study: "Dramatic improvement. Compliance rose from 62% to 78%. ZERO inappropriate antibiotic administrations in audit of 50 cases.",
                act: "ADOPT. Extend training to all Band 5 nurses. Share learning with neighbouring Trusts."
            }
        ],
        
        chartData: [
            // Baseline
            { date: "2023-06-05", value: 38, grade: "Baseline" },
            { date: "2023-06-12", value: 44, grade: "Baseline" },
            { date: "2023-06-19", value: 40, grade: "Baseline" },
            { date: "2023-06-26", value: 42, grade: "Baseline" },
            { date: "2023-07-03", value: 45, grade: "Baseline" },
            { date: "2023-07-10", value: 39, grade: "Baseline" },
            { date: "2023-07-17", value: 43, grade: "Baseline" },
            { date: "2023-07-24", value: 41, grade: "Baseline" },
            { date: "2023-07-31", value: 44, grade: "Baseline" },
            { date: "2023-08-07", value: 42, grade: "Baseline" },
            { date: "2023-08-14", value: 46, grade: "Baseline" },
            { date: "2023-08-21", value: 40, grade: "Baseline" },
            { date: "2023-08-28", value: 43, grade: "Baseline" },
            // Cycle 1
            { date: "2023-09-04", value: 48, grade: "PDSA 1" },
            { date: "2023-09-11", value: 52, grade: "PDSA 1" },
            { date: "2023-09-18", value: 47, grade: "PDSA 1" },
            { date: "2023-09-25", value: 45, grade: "PDSA 1" },
            // Cycle 2
            { date: "2023-10-02", value: 55, grade: "PDSA 2" },
            { date: "2023-10-09", value: 58, grade: "PDSA 2" },
            { date: "2023-10-16", value: 62, grade: "PDSA 2" },
            { date: "2023-10-23", value: 60, grade: "PDSA 2" },
            { date: "2023-10-30", value: 65, grade: "PDSA 2" },
            // Cycle 3
            { date: "2023-11-06", value: 64, grade: "PDSA 3" },
            { date: "2023-11-13", value: 68, grade: "PDSA 3" },
            { date: "2023-11-20", value: 72, grade: "PDSA 3" },
            { date: "2023-11-27", value: 76, grade: "PDSA 3" },
            { date: "2023-12-04", value: 78, grade: "PDSA 3" },
            { date: "2023-12-11", value: 80, grade: "PDSA 3" },
            { date: "2023-12-18", value: 77, grade: "PDSA 3" },
            // Cycle 4
            { date: "2024-01-08", value: 82, grade: "PDSA 4" },
            { date: "2024-01-15", value: 85, grade: "PDSA 4" },
            { date: "2024-01-22", value: 84, grade: "PDSA 4" },
            { date: "2024-01-29", value: 88, grade: "PDSA 4" },
            { date: "2024-02-05", value: 86, grade: "PDSA 4" },
            { date: "2024-02-12", value: 90, grade: "PDSA 4" },
            { date: "2024-02-19", value: 88, grade: "PDSA 4" },
            { date: "2024-02-26", value: 91, grade: "PDSA 4" },
            // Sustain
            { date: "2024-03-04", value: 89, grade: "Sustain" },
            { date: "2024-03-11", value: 92, grade: "Sustain" },
            { date: "2024-03-18", value: 90, grade: "Sustain" },
            { date: "2024-03-25", value: 93, grade: "Sustain" },
            { date: "2024-04-01", value: 91, grade: "Sustain" },
            { date: "2024-04-08", value: 94, grade: "Sustain" },
            { date: "2024-04-15", value: 88, grade: "Sustain" },
            { date: "2024-04-22", value: 92, grade: "Sustain" },
            { date: "2024-04-29", value: 95, grade: "Sustain" }
        ],
        
        chartSettings: {
            title: "Sepsis 6 Compliance: Antibiotics Within 60 Minutes",
            yAxisLabel: "% Compliance",
            showAnnotations: true
        },
        
        teamMembers: [
            { id: "1", name: "Dr. James Bloggs", role: "Project Lead", grade: "ST6 Emergency Medicine", initials: "JB", responsibilities: "Overall project coordination, stakeholder engagement" },
            { id: "2", name: "Sarah Mitchell", role: "Sepsis Champion", grade: "Band 7 Sister", initials: "SM", responsibilities: "Nursing lead, PGD implementation, trolley oversight" },
            { id: "3", name: "Dr. Priya Sharma", role: "Consultant Sponsor", grade: "ED Consultant", initials: "PS", responsibilities: "Clinical governance, Trust-level advocacy" },
            { id: "4", name: "Mike Thompson", role: "IT Lead", grade: "EPR Analyst", initials: "MT", responsibilities: "Best Practice Alert design, data extraction" },
            { id: "5", name: "Jenny Williams", role: "Pharmacy Rep", grade: "ED Pharmacist", initials: "JW", responsibilities: "PGD development, antibiotic stewardship" }
        ],
        
        stakeholders: [
            { name: "ED Nursing Team", x: 85, y: 90, role: "Key Implementers" },
            { name: "ED Consultants", x: 90, y: 95, role: "Clinical Sponsors" },
            { name: "Junior Doctors", x: 75, y: 40, role: "End Users" },
            { name: "ED Matron", x: 95, y: 85, role: "Nursing Lead" },
            { name: "Pharmacy", x: 50, y: 70, role: "PGD Support" },
            { name: "IT Department", x: 40, y: 50, role: "Technical Support" },
            { name: "Microbiology", x: 45, y: 60, role: "Clinical Advisor" }
        ],
        
        leadershipLogs: [
            { date: "2023-06-05", note: "Initial meeting with Clinical Lead Dr. Patel - project scope agreed, consultant sponsor assigned" },
            { date: "2023-06-15", note: "Presented baseline audit at ED Governance meeting - 42% compliance shocked the team" },
            { date: "2023-07-20", note: "Pharmacy meeting - concerns about antibiotic stewardship addressed, agreed PGD development plan" },
            { date: "2023-09-28", note: "Conflict resolution - arranged joint meeting with Pharmacy and Microbiology to address consultant concerns regarding PGD" },
            { date: "2023-11-20", note: "Presented interim results at Regional RCEM Meeting" },
            { date: "2024-05-15", note: "Final presentation to Trust Board - project cited as exemplar QI work" }
        ],
        
        gantt: [
            { id: "1", name: "Baseline Audit", start: "2023-06-01", end: "2023-08-31", type: "study", owner: "JB", milestone: false },
            { id: "2", name: "Stakeholder Mapping", start: "2023-06-15", end: "2023-07-15", type: "plan", owner: "JB", milestone: false },
            { id: "3", name: "Root Cause Analysis", start: "2023-07-01", end: "2023-08-15", type: "plan", owner: "SM", milestone: false },
            { id: "4", name: "Cycle 1: Education", start: "2023-09-01", end: "2023-09-30", type: "do", owner: "SM" },
            { id: "5", name: "Cycle 2: Sepsis Trolley", start: "2023-10-01", end: "2023-10-31", type: "pdsa", owner: "SM" },
            { id: "6", name: "PGD Development", start: "2023-10-01", end: "2023-11-15", type: "plan", owner: "JW" },
            { id: "7", name: "Cycle 3: Nurse PGD", start: "2023-11-15", end: "2023-12-15", type: "pdsa", owner: "SM", dependency: "6" },
            { id: "8", name: "Cycle 4: IT Alert", start: "2024-02-01", end: "2024-02-28", type: "act", owner: "MT" },
            { id: "9", name: "Target Achieved", start: "2024-05-31", end: "2024-06-01", type: "sustain", owner: "JB", milestone: true }
        ]
    };
}
