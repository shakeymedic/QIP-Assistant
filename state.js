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
// FIXED: Field names now match renderers.js expectations

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
        
        // Measures - FIXED: Using underscore-first format to match renderers.js
        outcome_measure: "",
        process_measure: "",
        balance_measure: "",
        
        // Governance
        ethics: "",
        
        // Research
        lit_review: "",
        
        // Closing - FIXED: Using correct field names
        learning_points: "",
        sustainability: "",
        results_text: "",
        results_analysis: ""
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
    
    // PDSA Cycles - FIXED: Using consistent field names
    pdsa: [], // { title, startDate, end, plan, do, study, act }
    
    // Chart Data
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
    
    // Stakeholder Analysis
    stakeholders: [], // { name, x, y, role }
    
    // Team Members - FIXED: Using "responsibilities" (plural)
    teamMembers: [], // { id, name, role, grade, initials, responsibilities }
    
    // Leadership Log
    leadershipLogs: [], // { date, note }
    
    // Gantt Chart Tasks - FIXED: Using "type" for colours
    gantt: [] // { id, name, start, end, type, owner, dependency, milestone }
};

// ==========================================================================
// DEMO DATA GENERATOR - GOLD STANDARD SEPSIS QIP
// ==========================================================================
// Returns a fully populated project demonstrating best practice for FRCEM portfolio
// FIXED: All field names now match the emptyProject template and renderers.js

export function getDemoData() {
    return {
        meta: {
            title: "Improving Sepsis 6 Delivery in the Emergency Department",
            created: "2023-06-01T08:00:00Z",
            updated: new Date().toISOString(),
            owner: "Dr. J. Bloggs"
        },
        checklist: {
            // Problem Definition
            problem_desc: "Retrospective audit of 150 consecutive patients with Red Flag Sepsis over 3 months revealed only 42% received IV antibiotics within 60 minutes of the sepsis trigger. This is significantly below the RCEM Clinical Standard of 90%. Root cause analysis identified multiple barriers: equipment scattered across the department, lack of nursing autonomy to initiate antibiotics, poor sepsis screening compliance at triage, and cultural acceptance of delays during periods of crowding.",
            problem_context: "District General Hospital Emergency Department with approximately 85,000 attendances per year. 24-hour consultant presence with typical staffing of 2-3 middle grades and 4-6 junior doctors. Average 4-hour performance of 72%. Regular corridor care with occupancy often exceeding 150%.",
            problem_evidence: "Baseline audit: 42% compliance (n=150). National Confidential Enquiry into Patient Outcome and Death (NCEPOD) 2015 'Just Say Sepsis' highlighted delays in antibiotic administration as a key driver of preventable mortality. RCEM Sepsis Audit 2022 showed national median of 67%.",
            
            // SMART Aim
            aim: "To increase the percentage of patients with Red Flag Sepsis who receive IV antibiotics within 60 minutes of the sepsis trigger from 42% to 90% within 12 months (June 2023 to June 2024).",
            aim_measure: "Percentage of patients receiving antibiotics within 60 minutes",
            aim_baseline: "42%",
            aim_target: "90%",
            aim_date: "2024-06-01",
            
            // Measures - FIXED: Using correct field names
            outcome_measure: "% of Red Flag Sepsis patients receiving IV antibiotics within 60 minutes of trigger",
            process_measure: "Door-to-needle time in minutes; % of patients screened at triage; % of Sepsis 6 bundles completed",
            balance_measure: "Inappropriate antibiotic prescribing rate; patient complaints about cannulation; staff overtime hours",
            
            // Governance
            ethics: "Registered as Service Evaluation with local Audit Department (Ref: AUD-2023-0142). No individual patient consent required as per HRA decision tool. Caldicott approval obtained for data extraction. Project reviewed by ED Clinical Governance lead.",
            
            // Literature Review
            lit_review: `RCEM Clinical Standards for Emergency Departments (2022):
• 90% of patients with Red Flag Sepsis should receive IV antibiotics within 60 minutes

NICE Guideline NG51 - Sepsis: recognition, diagnosis and early management (2017):
• Recommends immediate empirical IV antibiotics for patients with high-risk criteria
• Emphasises the importance of the Sepsis 6 bundle

Surviving Sepsis Campaign: International Guidelines (2021):
• Strong recommendation for antibiotics within 1 hour of sepsis recognition
• Each hour delay associated with 7.6% increased mortality

NHS England - Commissioning for Quality and Innovation (CQUIN):
• Sepsis screening and antibiotic administration are key quality indicators

Local Trust Antimicrobial Guidelines (2023):
• First-line empirical therapy: Piperacillin-Tazobactam 4.5g IV or Co-amoxiclav 1.2g IV + Gentamicin`,
            
            // Conclusions - FIXED: Using correct field names
            learning_points: `Key Learning Points:

1. SYSTEM CHANGES trump education: Initial educational interventions (Cycle 1) produced only marginal, unsustained improvement. The most effective changes were physical (Sepsis Trolley) and procedural (Nurse PGD).

2. EQUIPMENT ACCESSIBILITY is critical: The Sepsis Trolley eliminated the 'hunting for kit' phenomenon that caused most delays in our baseline analysis.

3. NURSING EMPOWERMENT is transformative: The Patient Group Directive enabling nurses to initiate antibiotics was the single most impactful intervention. It removed the bottleneck of waiting for a doctor to prescribe.

4. IT INTEGRATION reinforces behaviour: The EPR best practice alert served as a reliable safety net and data capture mechanism.

5. SUSTAINABILITY requires OWNERSHIP: Assigning a Sepsis Champion (Band 7 nurse) with protected time was essential for maintaining gains.

6. DATA must be VISIBLE: Weekly run chart display at the nursing station created healthy competition and peer accountability.`,
            
            sustainability: `Sustainability Plan:

STRUCTURAL:
• Sepsis Trolley maintenance added to HCA daily checklist
• Band 7 Sepsis Champion role with 2 hours/week protected time
• PGD embedded in Trust formulary with annual review

EDUCATIONAL:
• Sepsis training mandatory for all new starters (part of ED induction)
• Annual competency assessment for PGD nurses
• Bi-annual simulation scenario for the MDT

MONITORING:
• Automated monthly data extraction from EPR
• Dashboard displayed at ED Quality Board
• Quarterly reporting to Trust Sepsis Committee
• Annual re-audit planned for June 2025

ESCALATION:
• Alert to Clinical Lead if monthly compliance <85%
• Root cause analysis for any sepsis-related SI/mortality`,
            
            results_text: `Analysis of Run Chart Data:

BASELINE (June-August 2023):
• Median compliance: 42%
• No special cause variation
• 150 patients audited

POST CYCLE 1 - Education (September 2023):
• Slight improvement to 48%
• No sustained shift - improvement faded within 2 weeks
• Staff reported 'forgetting' during busy periods

POST CYCLE 2 - Sepsis Trolley (October 2023):
• Immediate improvement to 62%
• SHIFT detected: 6 consecutive points above median
• Qualitative feedback: "No more hunting for kit"

POST CYCLE 3 - Nurse PGD (November 2023):
• Step change to 78%
• Time to antibiotics reduced by average 22 minutes
• Zero inappropriate administrations recorded

POST CYCLE 4 - IT Alert (January 2024):
• Sustained improvement >85%
• NEW MEDIAN established at 88%

CURRENT STATE (June 2024):
• 92% compliance (exceeds 90% target)
• 47 consecutive weeks with compliance >80%
• Door-to-needle time reduced from 72 to 38 minutes (median)`,
            
            results_analysis: "Statistical analysis demonstrates sustained special cause variation with a new process mean of 88% compliance, exceeding the 90% target. The improvement journey shows clear step-changes corresponding to each PDSA cycle intervention."
        },
        
        // Driver Diagram
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
                "Team communication",
                "Clear antibiotic guidelines",
                "Reduced decision points",
                "IT system support"
            ],
            changes: [
                "Mandatory NEWS2 + sepsis screen at triage",
                "Sepsis awareness poster campaign",
                "Hourly consultant walk-rounds",
                "Dedicated Sepsis Trolley in Majors",
                "Sepsis Grab Bags in Resus/Paeds",
                "Blood culture bottles on trolley",
                "Nurse PGD for IV antibiotics",
                "Sepsis Champion role (Band 7)",
                "Daily safety huddle feedback",
                "Simplified antibiotic flowchart",
                "Pre-printed Sepsis 6 proforma",
                "EPR Best Practice Alert"
            ]
        },
        
        // Fishbone Diagram - 6Ms Analysis
        fishbone: {
            categories: [
                { 
                    text: "Manpower", 
                    x: 15, 
                    y: 20,
                    causes: [
                        { text: "Reliance on agency staff", x: 8, y: 12 },
                        { text: "Junior doctor rotation", x: 22, y: 10 },
                        { text: "Inadequate sepsis training", x: 10, y: 28 },
                        { text: "Variable skill mix", x: 24, y: 26 }
                    ] 
                },
                { 
                    text: "Methods", 
                    x: 85, 
                    y: 20,
                    causes: [
                        { text: "No PGD for nurses", x: 78, y: 10 },
                        { text: "Paper screening lost", x: 92, y: 12 },
                        { text: "Complex pathway", x: 80, y: 28 },
                        { text: "Waiting for doctor", x: 90, y: 26 }
                    ] 
                },
                { 
                    text: "Machines", 
                    x: 15, 
                    y: 50,
                    causes: [
                        { text: "Slow EPR system", x: 8, y: 42 },
                        { text: "No alerting system", x: 22, y: 44 },
                        { text: "Broken syringe drivers", x: 10, y: 58 }
                    ] 
                },
                { 
                    text: "Materials", 
                    x: 85, 
                    y: 50,
                    causes: [
                        { text: "Cannulas missing", x: 78, y: 42 },
                        { text: "Expired blood bottles", x: 92, y: 44 },
                        { text: "Drug keys lost", x: 82, y: 58 },
                        { text: "Antibiotics locked", x: 88, y: 56 }
                    ] 
                },
                { 
                    text: "Measurements", 
                    x: 15, 
                    y: 80,
                    causes: [
                        { text: "No real-time audit", x: 8, y: 72 },
                        { text: "Poor feedback loops", x: 22, y: 74 },
                        { text: "Unclear targets", x: 12, y: 88 }
                    ] 
                },
                { 
                    text: "Mother Nature", 
                    x: 85, 
                    y: 80,
                    causes: [
                        { text: "Department overcrowding", x: 78, y: 72 },
                        { text: "Corridor care normalised", x: 92, y: 74 },
                        { text: "Distance to drug room", x: 82, y: 88 },
                        { text: "Poor lighting at triage", x: 88, y: 86 }
                    ] 
                }
            ]
        },
        
        // Process Map
        process: [
            "Patient Arrival",
            "Triage Assessment (NEWS2)",
            "Sepsis Screen Applied",
            "Red Flag Positive?",
            "Immediate Senior Review",
            "Sepsis 6 Bundle Initiated",
            "Bloods & Cultures Taken",
            "IV Access Obtained",
            "Antibiotics Administered",
            "Fluid Resuscitation",
            "Lactate Measured",
            "Urine Output Monitored",
            "Reassess at 1 Hour",
            "Disposition Decision"
        ],
        
        // PDSA Cycles - FIXED: Using startDate and plan fields
        pdsa: [
            {
                title: "Cycle 1: Education Campaign",
                startDate: "2023-09-01",
                start: "2023-09-01",  // Keep both for backward compatibility
                end: "2023-09-30",
                plan: "PLAN: Deliver 10-minute sepsis teaching at every handover for 4 weeks. Display high-visibility posters showing Sepsis 6 bundle in all clinical areas. Distribute pocket cards to all clinical staff. Target: Increase compliance to 60%.\n\nPrediction: We predicted education alone would significantly improve compliance as staff would be more aware of the importance of timely antibiotics.",
                desc: "PLAN: Deliver 10-minute sepsis teaching at every handover for 4 weeks. Display high-visibility posters showing Sepsis 6 bundle in all clinical areas. Distribute pocket cards to all clinical staff. Target: Increase compliance to 60%.\n\nPrediction: We predicted education alone would significantly improve compliance as staff would be more aware of the importance of timely antibiotics.",
                do: "Teaching delivered at 42/56 handovers (75% coverage). 12 A3 posters displayed across department. 200 pocket cards distributed. Attendance logged.",
                study: "Compliance improved marginally from 42% to 48% in the first 2 weeks, but dropped back to 45% by week 4. Staff surveys revealed: 'We know it's important, but can't find the equipment' and 'Waiting for doctor to prescribe'. Education necessary but not sufficient.",
                act: "ABANDON as sole intervention. Education created awareness but did not address systemic barriers. Proceed to test physical interventions targeting equipment accessibility."
            },
            {
                title: "Cycle 2: Sepsis Trolley",
                startDate: "2023-10-01",
                start: "2023-10-01",
                end: "2023-10-31",
                plan: "PLAN: Introduce a dedicated bright yellow 'Sepsis Trolley' in Majors containing everything needed for Sepsis 6 bundle: IV cannulas, blood bottles, culture bottles, giving sets, fluids, and antibiotics (Co-amoxiclav, Pip-Taz). Position in Bay 1 (highest acuity). HCA to check and restock daily using checklist.\n\nPrediction: Eliminating the 'hunting for kit' barrier will reduce time to treatment by 15+ minutes.",
                desc: "PLAN: Introduce a dedicated bright yellow 'Sepsis Trolley' in Majors containing everything needed for Sepsis 6 bundle: IV cannulas, blood bottles, culture bottles, giving sets, fluids, and antibiotics (Co-amoxiclav, Pip-Taz). Position in Bay 1 (highest acuity). HCA to check and restock daily using checklist.\n\nPrediction: Eliminating the 'hunting for kit' barrier will reduce time to treatment by 15+ minutes.",
                do: "Trolley procured and stocked (cost: £450). Positioned in Bay 1. Daily checklist implemented. Staff informed via email and huddle. Photo guide created showing trolley contents.",
                study: "Immediate improvement observed. Compliance rose to 62% within 2 weeks. SHIFT detected on run chart (6 consecutive points above median). Time to cannulation reduced by average 12 minutes. Positive feedback: 'It's all there - no hunting'. Issues: Trolley raided for non-sepsis patients, sometimes found empty.",
                act: "ADOPT and ADAPT. Roll out second trolley to Resus. Implement 'SEPSIS ONLY' labelling. Add daily check to HCA task list. Consider grab bags for high-turnover items."
            },
            {
                title: "Cycle 3: Nurse PGD for Antibiotics",
                startDate: "2023-11-01",
                start: "2023-11-01",
                end: "2023-12-15",
                plan: "PLAN: Develop and implement Patient Group Directive enabling Band 6+ nurses to initiate IV antibiotics (Co-amoxiclav 1.2g or Piperacillin-Tazobactam 4.5g) for patients meeting Red Flag Sepsis criteria, without waiting for medical prescription. Requires: Trust approval, nurse training, competency assessment.\n\nPrediction: Removing the 'waiting for doctor' bottleneck will reduce door-to-antibiotic time by 20+ minutes.",
                desc: "PLAN: Develop and implement Patient Group Directive enabling Band 6+ nurses to initiate IV antibiotics (Co-amoxiclav 1.2g or Piperacillin-Tazobactam 4.5g) for patients meeting Red Flag Sepsis criteria, without waiting for medical prescription. Requires: Trust approval, nurse training, competency assessment.\n\nPrediction: Removing the 'waiting for doctor' bottleneck will reduce door-to-antibiotic time by 20+ minutes.",
                do: "PGD drafted and approved by Drugs & Therapeutics Committee (6-week process). Training delivered to 24 nurses (18 Band 6+, 6 Band 5 for awareness). Competency assessment completed. Go-live 15th November.",
                study: "Dramatic improvement. Compliance rose from 62% to 78% within 4 weeks. Median door-to-needle time reduced from 58 to 36 minutes. ZERO inappropriate antibiotic administrations in audit of 50 cases. Nurse feedback overwhelmingly positive: 'Feel empowered', 'Can act immediately'. One near-miss identified (penicillin allergy) - process adapted.",
                act: "ADOPT. Extend training to all Band 5 nurses. Add allergy check prompt to sepsis proforma. Share learning with neighbouring Trusts. Celebrate success at Trust Quality Awards."
            },
            {
                title: "Cycle 4: EPR Best Practice Alert",
                startDate: "2024-01-02",
                start: "2024-01-02",
                end: "2024-02-28",
                plan: "PLAN: Implement electronic Best Practice Alert (BPA) in the Electronic Patient Record triggered when NEWS2 ≥7 or sepsis screening positive. Alert prompts: 'Has Sepsis 6 been initiated? Antibiotics given? Document time.' Data captured automatically for audit.\n\nPrediction: IT prompt will serve as safety net for busy periods and automate data collection.",
                desc: "PLAN: Implement electronic Best Practice Alert (BPA) in the Electronic Patient Record triggered when NEWS2 ≥7 or sepsis screening positive. Alert prompts: 'Has Sepsis 6 been initiated? Antibiotics given? Document time.' Data captured automatically for audit.\n\nPrediction: IT prompt will serve as safety net for busy periods and automate data collection.",
                do: "BPA designed with EPR team (4 iterations based on user feedback). Piloted for 2 weeks in Majors. Refined alert timing to avoid 'alert fatigue'. Full rollout 1st February.",
                study: "Compliance stabilised at 85-92% range. Run chart shows new median established at 88%. Automated reporting enabled weekly monitoring without manual audit. Alert override rate 8% - within acceptable limits. Staff initially resistant ('another popup') but adapted.",
                act: "ADOPT as standard. Link to sepsis mortality reporting. Share design with other departments. Plan quarterly review of alert thresholds."
            },
            {
                title: "Cycle 5: Sustainability - Sepsis Champion",
                startDate: "2024-03-01",
                start: "2024-03-01",
                end: "2024-04-30",
                plan: "PLAN: Establish Band 7 Sepsis Champion role with 2 hours/week protected time. Responsibilities: Weekly trolley audit, monthly data review, new starter training, case review for any sepsis deaths/SIs.\n\nPrediction: Dedicated ownership will maintain improvements and enable rapid response to any deterioration.",
                desc: "PLAN: Establish Band 7 Sepsis Champion role with 2 hours/week protected time. Responsibilities: Weekly trolley audit, monthly data review, new starter training, case review for any sepsis deaths/SIs.\n\nPrediction: Dedicated ownership will maintain improvements and enable rapid response to any deterioration.",
                do: "Role agreed with Matron and Clinical Lead. Job description written. Existing Band 7 (Sarah, interested in sepsis) volunteered. Protected time agreed on Wednesday afternoons.",
                study: "6 weeks into role: All trolleys consistently stocked (100% compliance on spot checks). Monthly reports now routinely presented at governance. One near-miss identified early and mitigated. Staff feedback: 'Nice to have a go-to person'.",
                act: "SUSTAIN. Role embedded in department structure. Include in annual job planning cycle. Create succession plan for leave/departure. Link with Trust Sepsis Committee."
            }
        ],
        
        // Chart Data - Extended dataset showing improvement journey
        chartData: [
            // Baseline Period - June to August 2023
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
            
            // Cycle 1 - Education (September 2023)
            { date: "2023-09-04", value: 48, grade: "Cycle 1" },
            { date: "2023-09-11", value: 52, grade: "Cycle 1" },
            { date: "2023-09-18", value: 47, grade: "Cycle 1" },
            { date: "2023-09-25", value: 45, grade: "Cycle 1" },
            
            // Cycle 2 - Sepsis Trolley (October 2023)
            { date: "2023-10-02", value: 55, grade: "Cycle 2" },
            { date: "2023-10-09", value: 58, grade: "Cycle 2" },
            { date: "2023-10-16", value: 62, grade: "Cycle 2" },
            { date: "2023-10-23", value: 60, grade: "Cycle 2" },
            { date: "2023-10-30", value: 65, grade: "Cycle 2" },
            
            // Cycle 3 - Nurse PGD (November-December 2023)
            { date: "2023-11-06", value: 64, grade: "Cycle 3" },
            { date: "2023-11-13", value: 68, grade: "Cycle 3" },
            { date: "2023-11-20", value: 72, grade: "Cycle 3" },
            { date: "2023-11-27", value: 76, grade: "Cycle 3" },
            { date: "2023-12-04", value: 78, grade: "Cycle 3" },
            { date: "2023-12-11", value: 80, grade: "Cycle 3" },
            { date: "2023-12-18", value: 77, grade: "Cycle 3" },
            
            // Cycle 4 - IT Alert (January-February 2024)
            { date: "2024-01-08", value: 82, grade: "Cycle 4" },
            { date: "2024-01-15", value: 85, grade: "Cycle 4" },
            { date: "2024-01-22", value: 84, grade: "Cycle 4" },
            { date: "2024-01-29", value: 88, grade: "Cycle 4" },
            { date: "2024-02-05", value: 86, grade: "Cycle 4" },
            { date: "2024-02-12", value: 90, grade: "Cycle 4" },
            { date: "2024-02-19", value: 88, grade: "Cycle 4" },
            { date: "2024-02-26", value: 91, grade: "Cycle 4" },
            
            // Sustainability Phase (March-June 2024)
            { date: "2024-03-04", value: 89, grade: "Sustain" },
            { date: "2024-03-11", value: 92, grade: "Sustain" },
            { date: "2024-03-18", value: 90, grade: "Sustain" },
            { date: "2024-03-25", value: 93, grade: "Sustain" },
            { date: "2024-04-01", value: 91, grade: "Sustain" },
            { date: "2024-04-08", value: 94, grade: "Sustain" },
            { date: "2024-04-15", value: 88, grade: "Sustain" },
            { date: "2024-04-22", value: 92, grade: "Sustain" },
            { date: "2024-04-29", value: 95, grade: "Sustain" },
            { date: "2024-05-06", value: 91, grade: "Sustain" },
            { date: "2024-05-13", value: 93, grade: "Sustain" },
            { date: "2024-05-20", value: 92, grade: "Sustain" },
            { date: "2024-05-27", value: 94, grade: "Sustain" },
            { date: "2024-06-03", value: 92, grade: "Sustain" }
        ],
        
        // Chart Settings
        chartSettings: {
            title: "Sepsis 6 Compliance: Antibiotics Within 60 Minutes",
            yAxisLabel: "% Compliance",
            showAnnotations: true
        },
        
        // Team Members - FIXED: Using "responsibilities" (plural)
        teamMembers: [
            { id: "1", name: "Dr. James Bloggs", role: "Project Lead", grade: "ST6 Emergency Medicine", initials: "JB", responsibilities: "Overall project coordination, data analysis, PDSA design, stakeholder engagement" },
            { id: "2", name: "Sarah Mitchell", role: "Sepsis Champion", grade: "Band 7 Sister", initials: "SM", responsibilities: "Nursing lead, PGD implementation, trolley oversight, staff training" },
            { id: "3", name: "Dr. Priya Sharma", role: "Consultant Sponsor", grade: "ED Consultant", initials: "PS", responsibilities: "Clinical governance, senior support, Trust-level advocacy" },
            { id: "4", name: "Mike Thompson", role: "IT Lead", grade: "EPR Analyst", initials: "MT", responsibilities: "Best Practice Alert design, automated data extraction" },
            { id: "5", name: "Jenny Williams", role: "Pharmacy Rep", grade: "ED Pharmacist", initials: "JW", responsibilities: "PGD development, antibiotic stewardship, trolley stocking" },
            { id: "6", name: "Dr. Hassan Ali", role: "Microbiologist", grade: "Consultant", initials: "HA", responsibilities: "Antibiotic guideline review, sepsis pathway validation" }
        ],
        
        // Stakeholder Analysis - with roles for enhanced display
        stakeholders: [
            { name: "ED Nursing Team", x: 85, y: 90, role: "Key Implementers" },
            { name: "ED Consultants", x: 90, y: 95, role: "Clinical Sponsors" },
            { name: "Junior Doctors", x: 75, y: 40, role: "End Users" },
            { name: "ED Matron", x: 95, y: 85, role: "Nursing Lead" },
            { name: "Trust Sepsis Lead", x: 60, y: 80, role: "Strategic Advisor" },
            { name: "Pharmacy", x: 50, y: 70, role: "PGD Support" },
            { name: "IT Department", x: 40, y: 50, role: "Technical Support" },
            { name: "Microbiology", x: 45, y: 60, role: "Clinical Advisor" },
            { name: "Site Manager", x: 30, y: 65, role: "Operational Support" },
            { name: "Patients/Relatives", x: 85, y: 25, role: "Beneficiaries" },
            { name: "Porters", x: 20, y: 30, role: "Support Staff" },
            { name: "Procurement", x: 25, y: 45, role: "Equipment Supply" }
        ],
        
        // Leadership Engagement Log
        leadershipLogs: [
            { date: "2023-06-05", note: "Initial meeting with Clinical Lead Dr. Patel - project scope agreed, consultant sponsor assigned" },
            { date: "2023-06-15", note: "Presented baseline audit at ED Governance meeting - 42% compliance shocked the team, unanimous support for QIP" },
            { date: "2023-07-03", note: "Met with Matron to discuss nursing engagement - identified Sarah Mitchell as potential Sepsis Champion" },
            { date: "2023-07-20", note: "Pharmacy meeting - concerns about antibiotic stewardship addressed, agreed PGD development plan" },
            { date: "2023-08-10", note: "Presented at Trust Sepsis Committee - CEO present, project highlighted as priority" },
            { date: "2023-09-01", note: "Kick-off meeting with full team - roles assigned, timeline agreed" },
            { date: "2023-09-28", note: "Conflict resolution - ED consultants initially resistant to nurse PGD, arranged joint meeting with Pharmacy and Microbiology to address concerns" },
            { date: "2023-10-15", note: "Site visit to neighbouring Trust with successful sepsis trolley implementation - team motivated" },
            { date: "2023-11-20", note: "Presented interim results at Regional RCEM Meeting - positive reception, offered to share resources" },
            { date: "2023-12-05", note: "Meeting with Medical Director to discuss sustainability and workforce implications" },
            { date: "2024-01-18", note: "IT steering group approval for EPR alert - 6-week implementation timeline agreed" },
            { date: "2024-02-28", note: "Presented at Trust Quality Awards - project shortlisted for Patient Safety category" },
            { date: "2024-03-20", note: "Handover planning meeting - succession strategy for when I rotate in August" },
            { date: "2024-04-25", note: "Abstract submitted to RCEM Annual Scientific Conference" },
            { date: "2024-05-15", note: "Final presentation to Trust Board - project cited as exemplar QI work" },
            { date: "2024-06-01", note: "12-month review - target achieved (92% vs 90% target), sustainability plan activated" }
        ],
        
        // Gantt Chart Tasks - FIXED: Using "type" for colours
        gantt: [
            { id: "1", name: "Baseline Audit", start: "2023-06-01", end: "2023-08-31", type: "study", owner: "JB", milestone: false },
            { id: "2", name: "Literature Review", start: "2023-06-01", end: "2023-06-30", type: "plan", owner: "JB", milestone: false },
            { id: "3", name: "Stakeholder Mapping", start: "2023-06-15", end: "2023-07-15", type: "plan", owner: "JB", milestone: false },
            { id: "4", name: "Root Cause Analysis", start: "2023-07-01", end: "2023-08-15", type: "plan", owner: "SM", milestone: false },
            { id: "5", name: "Baseline Complete", start: "2023-08-31", end: "2023-09-01", type: "plan", owner: "JB", milestone: true },
            { id: "6", name: "Cycle 1: Education", start: "2023-09-01", end: "2023-09-30", type: "do", owner: "SM", dependency: "5" },
            { id: "7", name: "Cycle 2: Sepsis Trolley", start: "2023-10-01", end: "2023-10-31", type: "do", owner: "SM", dependency: "6" },
            { id: "8", name: "PGD Development", start: "2023-10-01", end: "2023-11-15", type: "plan", owner: "JW" },
            { id: "9", name: "Cycle 3: Nurse PGD", start: "2023-11-15", end: "2023-12-15", type: "pdsa", owner: "SM", dependency: "8" },
            { id: "10", name: "EPR Alert Design", start: "2023-12-01", end: "2024-01-31", type: "plan", owner: "MT" },
            { id: "11", name: "Cycle 4: IT Alert", start: "2024-02-01", end: "2024-02-28", type: "pdsa", owner: "MT", dependency: "10" },
            { id: "12", name: "Cycle 5: Sustainability", start: "2024-03-01", end: "2024-04-30", type: "act", owner: "SM" },
            { id: "13", name: "Target Achieved", start: "2024-05-31", end: "2024-06-01", type: "sustain", owner: "JB", milestone: true },
            { id: "14", name: "Final Write-up", start: "2024-05-01", end: "2024-06-15", type: "review", owner: "JB" }
        ]
    };
}
