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
