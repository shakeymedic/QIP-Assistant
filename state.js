// modules/state.js
export const state = {
    currentUser: null,
    currentProjectId: null,
    projectData: null,
    isDemoMode: false,
    isReadOnly: false,
    historyStack: [],
    redoStack: [],
    unsubscribeProject: null,
    MAX_HISTORY: 20
};

export const emptyProject = {
    meta: { title: "New Project", created: new Date().toISOString() },
    checklist: { results_text: "", aim: "", leadership_evidence: "" },
    drivers: { primary: [], secondary: [], changes: [] },
    fishbone: { categories: [{ id: 1, text: "People", causes: [] }, { id: 2, text: "Methods", causes: [] }, { id: 3, text: "Environment", causes: [] }, { id: 4, text: "Equipment", causes: [] }] },
    process: ["Start", "End"],
    pdsa: [],
    chartData: [],
    gantt: [],
    stakeholders: [],
    teamMembers: [], 
    leadershipLogs: []
};

// Returns the full demo dataset for the "Show Example" toggle
export function getDemoData() {
    const demoData = JSON.parse(JSON.stringify(emptyProject));
    demoData.meta.title = "Improving Sepsis 6 Delivery in ED";
    demoData.meta.created = new Date().toISOString();
    
    demoData.checklist = {
        problem_desc: "A baseline audit of 50 patients (Oct-Dec 2023) presenting with 'Red Flag' sepsis revealed that only 42% received the complete Sepsis 6 bundle within 1 hour of arrival. \n\nDelayed antibiotic administration in sepsis increases mortality by 7.6% per hour (Kumar et al., 2006). This performance is significantly below the RCEM quality standard (90%).",
        evidence: "1. RCEM Sepsis Quality Improvement Guide (2023)\n2. NICE NG51: Sepsis: recognition, diagnosis and early management\n3. Surviving Sepsis Campaign Guidelines",
        aim: "To increase the percentage of eligible 'Red Flag' sepsis patients receiving IV antibiotics within 60 minutes of arrival from 42% to 90% by 1st August 2024.",
        outcome_measures: "Percentage of Red Flag Sepsis patients receiving IV antibiotics < 60 mins from arrival.",
        process_measures: "1. Time from arrival to Triage.\n2. Percentage of patients with 'Sepsis Screen' completed at Triage.\n3. Time from medical review to antibiotic prescription.",
        balance_measures: "1. Rate of C. Difficile infections (Antibiotic stewardship).\n2. Percentage of patients triggered as 'Sepsis' who did not have infection (False positives).",
        team: "", 
        leadership_evidence: "", 
        ethics: "Registered with Trust Clinical Audit Department (Ref: QIP-24-055). This project is a service evaluation against national standards and does not require Research Ethics Committee approval.",
        ppi: "The project plan was presented to the Patient Liaison Group (PLG). They highlighted that 'waiting for a doctor' was a key frustration. We incorporated this feedback by empowering nurses to cannulate immediately via PGD.",
        learning: "The biggest barrier was not knowledge, but 'cognitive load'. Staff knew *what* to do, but the environment made it hard. \n\nThe 'Sepsis Trolley' (Cycle 2) worked because it reduced the friction of finding equipment. \n\nThe IT Alert (Cycle 3) was the most effective intervention because it functioned as a 'forcing function', preventing the doctor from closing the file without addressing the sepsis risk.",
        sustain: "1. The IT Alert is now a permanent feature of the EPR (Forcing Function).\n2. Sepsis Trolley checklist added to HCA daily duties (Process).\n3. Monthly data reporting automated to the governance dashboard (Automation).\n4. Sepsis induction training updated for new rotators.",
        results_text: "The Run Chart demonstrates a robust improvement.\n\n- Baseline median was 42%.\n- Following Cycle 2 (Trolleys), a 'Shift' occurred (6 points above median), indicating a non-random improvement.\n- Cycle 3 (IT Alert) pushed compliance to >90% consistently.\n- The new median is established at 92%.\n- Special cause variation is evident and sustained."
    };
    
    demoData.drivers = { 
        primary: ["Early Recognition", "Equipment Availability", "Safety Culture", "Efficient Pathways"], 
        secondary: ["Triage Screening Accuracy", "Nursing Empowerment", "Access to Antibiotics", "Feedback Loops"], 
        changes: ["Mandatory Sepsis Screen at Triage", "Sepsis Grab Bags in Resus", "Dedicated Sepsis Trolley", "PGD for Nurse Initiation", "IT Best Practice Alert", "Daily Safety Huddle Feedback"] 
    };

    demoData.fishbone = { 
        categories: [
            { id: 1, text: "People", causes: ["Reliance on Agency Staff", "Lack of ownership", "Fear of prescribing broad spectrum", "Junior doctor rotation turnover"] }, 
            { id: 2, text: "Methods", causes: ["Paper screening tool often lost", "No PGD for nurses (must wait for doctor)", "Complex pathway for blood cultures"] }, 
            { id: 3, text: "Environment", causes: ["Overcrowding in Majors", "Distance to drug cupboard", "No dedicated space for septic patients", "Poor lighting in triage"] }, 
            { id: 4, text: "Equipment", causes: ["Cannulas missing from trolleys", "Antibiotic cupboard keys missing", "Computers slow to load", "Blood culture bottles expired"] }
        ] 
    };
    
    demoData.process = ["Patient Arrives in ED", "Triage Assessment (15 mins)", "Sepsis Screening Tool Applied", "Red Flag Sepsis Triggered?", "Medical Review (Immediate)", "Sepsis 6 Bundle Initiated", "IV Antibiotics Administered", "Transfer to Ward/ICU"];

    demoData.pdsa = [
        {id: 1, title: "Cycle 1: Education", plan: "Deliver 10-min teaching at handover for 2 weeks. Display posters in staff room.", do: "Teaching delivered to 80% of nursing staff. Posters up.", study: "Compliance rose slightly to 48% but effect wore off quickly. Staff reported 'forgetting' in busy periods.", act: "Abandon as sole intervention. Education is necessary but not sufficient.", isStepChange: false},
        {id: 2, title: "Cycle 2: Sepsis Trolley", plan: "Introduce a bright yellow 'Sepsis Trolley' in Majors containing everything needed (bloods, cultures, fluids, abx).", do: "Trolley stocked and placed in Bay 1. Checked daily by HCA.", study: "Immediate improvement. Time to cannulation dropped by 15 mins. Staff feedback positive ('saves hunting for keys').", act: "Adopt. Roll out to Resus area as well.", isStepChange: true},
        {id: 3, title: "Cycle 3: PGD & Nurse Empowerment", plan: "Introduce Patient Group Direction (PGD) allowing Band 6 nurses to give first dose antibiotics.", do: "Approved by Pharmacy committee. Training rolled out.", study: "Mixed results. Some nurses confident, others reluctant. Process measure improved but variation remained.", act: "Adapt. focus on 'Sepsis Champions' on each shift.", isStepChange: false},
        {id: 4, title: "Cycle 4: Electronic Alert", plan: "IT modification: 'Pop-up' alert on Cerner when NEWS2 > 5 + Infection suspected.", do: "Live on April 1st. Required clinician reason to dismiss.", study: "Compliance hit 95%. Screening tool completion 100%.", act: "Adopt. Standard operating procedure.", isStepChange: true}
    ];

    demoData.chartData = [
        {date:"2023-10-01", value:40, type:'outcome'}, {date:"2023-10-08", value:45, type:'outcome'}, {date:"2023-10-15", value:35, type:'outcome'},
        {date:"2023-10-22", value:50, type:'outcome'}, {date:"2023-10-29", value:42, type:'outcome'}, {date:"2023-11-05", value:38, type:'outcome'},
        {date:"2023-11-12", value:48, type:'outcome'}, {date:"2023-11-19", value:41, type:'outcome'}, {date:"2023-11-26", value:44, type:'outcome'},
        {date:"2023-12-03", value:55, type:'outcome', note:"Cycle 1: Education"}, {date:"2023-12-10", value:52, type:'outcome'}, {date:"2023-12-17", value:45, type:'outcome'},
        {date:"2024-01-07", value:65, type:'outcome', note:"Cycle 2: Trolleys"}, {date:"2024-01-14", value:72, type:'outcome'}, {date:"2024-01-21", value:68, type:'outcome'},
        {date:"2024-01-28", value:75, type:'outcome'}, {date:"2024-02-04", value:70, type:'outcome'}, {date:"2024-02-11", value:78, type:'outcome'},
        {date:"2024-02-18", value:76, type:'outcome', note:"Cycle 3: PGD"}, {date:"2024-02-25", value:80, type:'outcome'}, {date:"2024-03-03", value:75, type:'outcome'},
        {date:"2024-03-10", value:92, type:'outcome', note:"Cycle 4: IT Alert"}, {date:"2024-03-17", value:95, type:'outcome'}, {date:"2024-03-24", value:94, type:'outcome'},
        {date:"2024-03-31", value:91, type:'outcome'}, {date:"2024-04-07", value:96, type:'outcome'}, {date:"2024-04-14", value:93, type:'outcome'},
        {date:"2024-04-21", value:95, type:'outcome'}, {date:"2024-04-28", value:94, type:'outcome'}, {date:"2024-05-05", value:97, type:'outcome'}
    ];

    demoData.stakeholders = [
        { name: "ED Consultants", power: 90, interest: 80 }, 
        { name: "Nursing Staff", power: 60, interest: 90 },
        { name: "Junior Doctors", power: 30, interest: 85 },
        { name: "Hospital Mgmt", power: 80, interest: 20 },
        { name: "Pharmacy", power: 50, interest: 60 }
    ];

    demoData.teamMembers = [
        { id: 't1', name: 'Dr. J. Bloggs', role: 'Project Lead', initials: 'JB' },
        { id: 't2', name: 'Dr. A. Consultant', role: 'Sponsor', initials: 'AC' },
        { id: 't3', name: 'Sr. M. Smith', role: 'Nursing Lead', initials: 'MS' },
        { id: 't4', name: 'P. Jones', role: 'Pharmacist', initials: 'PJ' }
    ];

    demoData.leadershipLogs = [
        "Chaired weekly 'Sepsis Taskforce' meetings with MDT.",
        "Delegated data collection to junior doctors (Mentoring).",
        "Presented business case for new trolleys to Clinical Director.",
        "Resolved conflict between nursing/medical staff regarding cannulation roles."
    ];

    demoData.gantt = [
        { id: 1, name: "Planning & Stakeholders", start: "2023-09-01", end: "2023-09-30", type: "plan", ownerId: 't1' },
        { id: 2, name: "Baseline Data Collection", start: "2023-10-01", end: "2023-11-30", type: "study", ownerId: 't3' },
        { id: 3, name: "Driver Diagram Workshop", start: "2023-11-15", end: "2023-11-20", type: "plan", ownerId: 't1' },
        { id: 4, name: "Cycle 1: Education", start: "2023-12-01", end: "2023-12-20", type: "act", ownerId: 't3' },
        { id: 5, name: "Cycle 2: Sepsis Trolleys", start: "2024-01-05", end: "2024-02-01", type: "act", ownerId: 't2' },
        { id: 6, name: "Cycle 4: IT Alert Go-Live", start: "2024-03-01", end: "2024-05-01", type: "act", ownerId: 't1' },
        { id: 7, name: "Write Up & Presentation", start: "2024-05-01", end: "2024-06-01", type: "plan", ownerId: 't1' }
    ];

    return demoData;
}
