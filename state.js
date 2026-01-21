// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================

export const state = {
    currentUser: null,
    currentProjectId: null,
    projectData: null,
    isDemoMode: false,
    isReadOnly: false,
    historyStack: [],
    redoStack: [],
    MAX_HISTORY: 50,
    aiKey: localStorage.getItem('rcem_qip_ai_key') || null // AI Key Persistence
};

// Empty Project Template
export const emptyProject = {
    meta: {
        title: "New QIP",
        created: new Date().toISOString(),
        updated: new Date().toISOString()
    },
    checklist: {
        aim: "",
        aim_measure: "",
        aim_baseline: "",
        aim_target: "",
        aim_date: "",
        problem_desc: "",
        problem_context: "",
        problem_evidence: "",
        problem_specific: "",
        measure_outcome: "",
        measure_process: "",
        measure_balance: "",
        results_text: "",
        learning: "",
        sustain: "",
        ethics: "",
        context: "",
        lit_review: "",
        methodology: "Model for Improvement with PDSA cycles"
    },
    chartData: [],
    chartSettings: {
        title: "",
        yAxisLabel: "",
        showAnnotations: false
    },
    pdsa: [],
    drivers: {
        primary: [],
        secondary: [],
        changes: []
    },
    fishbone: {
        categories: [
            { text: "People", x: 20, y: 20, causes: [] },
            { text: "Process", x: 70, y: 20, causes: [] },
            { text: "Environment", x: 20, y: 80, causes: [] },
            { text: "Equipment", x: 70, y: 80, causes: [] }
        ]
    },
    process: ["Start", "End"],
    stakeholders: [],
    gantt: [],
    teamMembers: [],
    leadershipLogs: []
};

// Demo Data (Gold Standard Example)
export function getDemoData() {
    return {
        meta: {
            title: "Improving Sepsis 6 Bundle Delivery",
            created: "2025-06-01T09:00:00.000Z",
            updated: new Date().toISOString()
        },
        checklist: {
            aim: "To increase completion of all Sepsis 6 interventions within 1 hour of diagnosis from 45% to 90% by August 2026.",
            aim_measure: "delivery of complete Sepsis 6 bundle within 1 hour",
            aim_baseline: "45%",
            aim_target: "90%",
            aim_date: "August 2026",
            problem_desc: "Sepsis remains a leading cause of mortality in our Emergency Department. Current audit data shows that only 45% of patients with suspected sepsis receive all 6 components of the Sepsis 6 bundle within 1 hour of diagnosis. This delay is associated with increased mortality and morbidity.",
            problem_context: "This project takes place in a busy district general hospital ED seeing approximately 200 patients per day. The department has 24 cubicles and a dedicated resuscitation area.",
            problem_evidence: "Internal audit (Q1 2025) showed 45% compliance with Sepsis 6 <1hr. National benchmarks suggest target should be >90%.",
            problem_specific: "The gap between current (45%) and target (90%) performance represents significant potential to improve patient outcomes.",
            measure_outcome: "Percentage of sepsis patients receiving complete Sepsis 6 bundle within 1 hour",
            measure_process: "Time from sepsis diagnosis to completion of each Sepsis 6 element",
            measure_balance: "Door-to-doctor time for non-sepsis patients (monitoring for unintended delays)",
            results_text: "Following implementation of the sepsis trolley and education program, compliance improved from 45% baseline to 78% in PDSA 1, then to 92% after PDSA 2. The improvement has been sustained for 8 weeks. Run chart analysis shows a significant shift above the median after intervention.",
            learning: "Key learning: (1) Physical accessibility of equipment matters - the sepsis trolley reduced equipment gathering time by 8 minutes on average. (2) Brief, focused education sessions were more effective than lengthy training. (3) Real-time feedback via the sepsis dashboard maintained awareness.",
            sustain: "Sustainability plan: The sepsis trolley is now part of standard equipment checks. Monthly audit data is presented at governance meetings. New staff induction includes sepsis bundle training. The intervention is incorporated into the departmental protocol.",
            ethics: "Service Evaluation - Registered with Clinical Audit Department. No ethical approval required as this represents routine quality improvement activity using anonymised audit data.",
            context: "40-bed Emergency Department in a 600-bed district general hospital. Average 200 attendances per day. Nursing establishment: 1:4 ratio. Medical staffing includes 24/7 consultant presence.",
            lit_review: "Rhodes A et al. Surviving Sepsis Campaign guidelines (2021) recommend all elements within 1 hour. Kumar et al. demonstrated 7.6% increase in mortality for each hour delay in antibiotics. NHS England Sepsis guidance mandates Sepsis 6 completion <1 hour.",
            methodology: "Model for Improvement with iterative PDSA cycles"
        },
        chartData: [
            { date: "2025-06-01", value: 42, grade: "Baseline" },
            { date: "2025-06-08", value: 48, grade: "Baseline" },
            { date: "2025-06-15", value: 44, grade: "Baseline" },
            { date: "2025-06-22", value: 46, grade: "Baseline" },
            { date: "2025-06-29", value: 45, grade: "Baseline" },
            { date: "2025-07-06", value: 43, grade: "Baseline" },
            { date: "2025-07-13", value: 47, grade: "Baseline" },
            { date: "2025-07-20", value: 44, grade: "Baseline" },
            { date: "2025-07-27", value: 46, grade: "Baseline" },
            { date: "2025-08-03", value: 45, grade: "Baseline" },
            { date: "2025-08-10", value: 48, grade: "Baseline" },
            { date: "2025-08-17", value: 44, grade: "Baseline" },
            { date: "2025-08-24", value: 55, grade: "Intervention" },
            { date: "2025-08-31", value: 62, grade: "Intervention" },
            { date: "2025-09-07", value: 68, grade: "Intervention" },
            { date: "2025-09-14", value: 72, grade: "Intervention" },
            { date: "2025-09-21", value: 75, grade: "Intervention" },
            { date: "2025-09-28", value: 78, grade: "Intervention" },
            { date: "2025-10-05", value: 76, grade: "Intervention" },
            { date: "2025-10-12", value: 80, grade: "Intervention" },
            { date: "2025-10-19", value: 82, grade: "Post-Intervention" },
            { date: "2025-10-26", value: 85, grade: "Post-Intervention" },
            { date: "2025-11-02", value: 88, grade: "Post-Intervention" },
            { date: "2025-11-09", value: 86, grade: "Post-Intervention" },
            { date: "2025-11-16", value: 90, grade: "Post-Intervention" },
            { date: "2025-11-23", value: 92, grade: "Post-Intervention" },
            { date: "2025-11-30", value: 91, grade: "Post-Intervention" },
            { date: "2025-12-07", value: 93, grade: "Post-Intervention" },
            { date: "2025-12-14", value: 92, grade: "Post-Intervention" },
            { date: "2025-12-21", value: 94, grade: "Post-Intervention" },
            { date: "2025-12-28", value: 91, grade: "Post-Intervention" },
            { date: "2026-01-04", value: 93, grade: "Post-Intervention" }
        ],
        chartSettings: {
            title: "Sepsis 6 Bundle Compliance",
            yAxisLabel: "% Complete <1 Hour",
            showAnnotations: true
        },
        pdsa: [
            {
                title: "Sepsis Equipment Trolley",
                start: "2025-08-20",
                end: "2025-09-20",
                desc: "Create a dedicated 'Sepsis Trolley' stocked with all Sepsis 6 equipment, positioned in the resuscitation area. Hypothesis: If equipment is immediately available, we will reduce time to completion by removing the 'searching for equipment' step.",
                do: "Trolley designed with pharmacy and nursing input. Stocked with IV access equipment, blood culture bottles, antibiotics, fluids, lactate cartridges, and oxygen delivery devices. Placed in resus. Staff briefed via 5-minute huddles over 3 days.",
                study: "Weekly audits showed compliance rose from 45% to 78% over 4 weeks. Staff feedback highlighted reduced frustration finding equipment. Time to first antibiotic reduced by average 12 minutes.",
                act: "Adopt trolley as standard. Expand to second trolley for majors area. Add trolley check to daily equipment checklist."
            },
            {
                title: "Education & Visual Prompts",
                start: "2025-09-25",
                end: "2025-10-25",
                desc: "Implement targeted education sessions for all staff and visual reminder cards. Hypothesis: Knowledge gaps and lack of awareness of performance contribute to missed bundle elements.",
                do: "Created laminated 'Sepsis 6' pocket cards for all clinical staff. Delivered 15-minute focused training to 85% of nursing staff and 90% of medical staff. Installed visual prompt posters in resus and majors.",
                study: "Compliance improved from 78% to 92% over 4 weeks. Knowledge quiz scores improved from 65% to 94%. Staff reported increased confidence in sepsis recognition and management.",
                act: "Incorporate into mandatory induction. Create online module for new starters. Plan refresher sessions every 6 months."
            }
        ],
        drivers: {
            primary: [
                "Early Recognition of Sepsis",
                "Rapid Access to Equipment",
                "Staff Knowledge & Confidence",
                "Reliable Process & Workflow"
            ],
            secondary: [
                "Screening Tool Compliance",
                "Equipment Availability",
                "Training Coverage",
                "Clear Escalation Pathways",
                "Real-time Feedback"
            ],
            changes: [
                "Dedicated Sepsis Trolley",
                "Pocket Reference Cards",
                "15-minute Training Sessions",
                "Visual Prompt Posters",
                "Daily Compliance Dashboard",
                "Sepsis Champions Programme"
            ]
        },
        fishbone: {
            categories: [
                { 
                    text: "People", 
                    x: 18, 
                    y: 18, 
                    causes: [
                        { text: "Knowledge gaps", x: 12, y: 28 },
                        { text: "High turnover", x: 8, y: 35 },
                        { text: "Time pressures", x: 15, y: 42 }
                    ] 
                },
                { 
                    text: "Process", 
                    x: 72, 
                    y: 18, 
                    causes: [
                        { text: "No standard workflow", x: 78, y: 28 },
                        { text: "Unclear escalation", x: 82, y: 35 },
                        { text: "Delayed recognition", x: 75, y: 42 }
                    ] 
                },
                { 
                    text: "Environment", 
                    x: 18, 
                    y: 78, 
                    causes: [
                        { text: "Overcrowding", x: 12, y: 68 },
                        { text: "Equipment scattered", x: 8, y: 61 }
                    ] 
                },
                { 
                    text: "Equipment", 
                    x: 72, 
                    y: 78, 
                    causes: [
                        { text: "Antibiotics unavailable", x: 78, y: 68 },
                        { text: "Blood culture stock-outs", x: 82, y: 61 }
                    ] 
                }
            ]
        },
        process: [
            "Patient Arrival",
            "Triage Assessment",
            "NEWS Score Calculated",
            "Sepsis Screening Triggered",
            "Senior Review",
            "Sepsis 6 Initiated",
            "Trolley Deployed",
            "Bundle Completed",
            "Handover to Specialty"
        ],
        stakeholders: [
            { name: "Clinical Director", x: 75, y: 85 },
            { name: "ED Nursing Lead", x: 80, y: 70 },
            { name: "Pharmacy", x: 60, y: 55 },
            { name: "Microbiology", x: 40, y: 45 },
            { name: "IT Department", x: 25, y: 30 },
            { name: "Junior Doctors", x: 70, y: 50 },
            { name: "Porters", x: 20, y: 25 }
        ],
        gantt: [
            { id: "1", name: "Baseline Audit", start: "2025-06-01", end: "2025-07-31", type: "plan", owner: "QI Lead", milestone: false },
            { id: "2", name: "Stakeholder Engagement", start: "2025-07-01", end: "2025-07-31", type: "plan", owner: "QI Lead", milestone: false },
            { id: "3", name: "Trolley Design", start: "2025-08-01", end: "2025-08-15", type: "do", owner: "Nursing Lead", milestone: false },
            { id: "4", name: "PDSA 1: Trolley", start: "2025-08-20", end: "2025-09-20", type: "do", owner: "QI Lead", milestone: false },
            { id: "5", name: "Education Rollout", start: "2025-09-25", end: "2025-10-25", type: "do", owner: "Education Lead", milestone: false },
            { id: "6", name: "Data Analysis", start: "2025-10-26", end: "2025-11-15", type: "study", owner: "QI Lead", milestone: false },
            { id: "7", name: "Sustainability Planning", start: "2025-11-16", end: "2025-12-15", type: "act", owner: "QI Lead", milestone: false },
            { id: "8", name: "Final Report", start: "2025-12-16", end: "2026-01-15", type: "act", owner: "QI Lead", milestone: true }
        ],
        teamMembers: [
            { id: "1", name: "Dr. J. Bloggs", role: "Project Lead", grade: "ST6 EM", responsibilities: "Overall project coordination, data analysis, report writing", initials: "JB" },
            { id: "2", name: "Sister M. Smith", role: "Nursing Lead", grade: "Band 7", responsibilities: "Trolley design, nursing engagement, training delivery", initials: "MS" },
            { id: "3", name: "Dr. A. Khan", role: "Consultant Sponsor", grade: "Consultant", responsibilities: "Senior oversight, governance liaison, sustainability", initials: "AK" },
            { id: "4", name: "P. Jones", role: "Pharmacy Advisor", grade: "Band 8a", responsibilities: "Antibiotic supply, drug chart review, protocol input", initials: "PJ" }
        ],
        leadershipLogs: [
            { date: "01/07/2025", note: "Initial meeting with Clinical Director to secure support and resources for sepsis QIP." },
            { date: "15/07/2025", note: "Presented baseline data at departmental governance meeting. Gained approval to proceed." },
            { date: "05/08/2025", note: "Met with pharmacy lead to discuss antibiotic availability and trolley stocking." },
            { date: "20/08/2025", note: "Delivered presentation at nursing handover to introduce sepsis trolley initiative." },
            { date: "01/10/2025", note: "Progress update at Trust Quality Committee. Received positive feedback on early results." },
            { date: "15/11/2025", note: "Met with IT to discuss dashboard development for ongoing monitoring." }
        ]
    };
}
