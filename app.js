import { auth, db, getFirebaseStatus } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, collectionGroup, onSnapshot, addDoc, deleteDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { state, emptyProject, getDemoData, safeStorage } from "./state.js";
import { escapeHtml, jsArg, updateOnlineStatus, showToast } from "./utils.js";
window.showToast = showToast; // expose for non-module files (e.g. patient-tracker.js)
import { callAI } from "./ai.js";

import { 
    renderChart, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, 
    zoomIn, zoomOut, resetZoom, resetProcess, 
    setToolMode, setChartMode, updateChartEducation, renderTools, toolMode,
    openChartSettings, saveChartSettings, copyChartImage, renderFullViewChart,
    toggleToolHelp,
    downloadChartPNG, exportGanttPNG, exportGanttPDF,
    exportDiagramPNG, exportDiagramSVG, exportStakeholderPNG
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";
import { startOnboarding } from "./onboarding.js";
import { exportToKaizen } from "./kaizen-export.js";
import { exportToA3 } from "./a3-export.js";
import { renderSupervisorDashboard, renderSupervisorOverview } from "./supervisor.js";
import { getQIPLeadProjects, addQIPLeadToProject, removeQIPLeadFromProject, renderQIPLeadPanel, renderQIPLeadDashboard } from "./qip-lead.js";
import { logRoleAuditEvent, logProjectAccessEvent } from "./audit-log.js";

import { renderSurveys, addSurvey, deleteSurvey, importSurveyCSV, updateSurveySummary, updateSurveyTitle, aiAnalyseSurvey } from "./surveys.js";
import { renderLearn } from "./learn.js";
import { computeReadiness, allMeasurePoints, lastActivityDate, normaliseDateInput, parseNumericInput, formatUkDate, chooseBaseline, median, runChartSignals } from "./project-metrics.js";
import "./measures.js"; // multi-measure management (self-registers window.addMeasure etc.)
import "./export-center.js"; // unified Export Center (self-registers window.openExportCenter etc.)

// ─── Master Admin ───────────────────────────────────────────────────────
const ADMIN_EMAIL = 'emevidence999@gmail.com';

// ─── Project data migration ───────────────────────────────────────────────────
function migrateProjectData(d) {
    if (!d) return;
    // Charter and action-plan fields were added after early projects existed.
    // Keep migration additive so users' existing project data is untouched.
    if (!d.charter || typeof d.charter !== 'object') d.charter = {};
    const charterDefaults = {
        preparedBy: '', date: '', execSponsor: '', aim: '', rationale: '', keyAreaOfFocus: '',
        startDate: '', endDate: '', objectives: '', scopeIn: '', scopeOut: '', benefits: [], costs: [],
        milestones: [
            { phase: 'Start Out', targetDate: '' },
            { phase: 'Define & Scope', targetDate: '' },
            { phase: 'Measure & Understand', targetDate: '' },
            { phase: 'Design & Plan', targetDate: '' },
            { phase: 'Pilot & Implement', targetDate: '' },
            { phase: 'Sustain & Share', targetDate: '' }
        ],
        team: [], additionalResources: '', lineManagerName: '', lineManagerSignatureDate: ''
    };
    Object.keys(charterDefaults).forEach(key => {
        if (d.charter[key] === undefined || d.charter[key] === null) d.charter[key] = charterDefaults[key];
    });
    if (!Array.isArray(d.charter.benefits)) d.charter.benefits = [];
    if (!Array.isArray(d.charter.costs)) d.charter.costs = [];
    if (!Array.isArray(d.charter.team)) d.charter.team = [];
    if (!Array.isArray(d.charter.milestones) || d.charter.milestones.length !== 6) {
        d.charter.milestones = charterDefaults.milestones;
    }
    if (!Array.isArray(d.actionPlan)) d.actionPlan = [];
    // Ensure changeIdeas exists
    if (!Array.isArray(d.changeIdeas)) d.changeIdeas = [];
    // One-time migration: move any flat d.pdsa cycles into a default change idea
    if (Array.isArray(d.pdsa) && d.pdsa.length > 0 && d.changeIdeas.length === 0) {
        d.changeIdeas = [{
            id: 'ci-legacy',
            title: 'Change Idea 1',
            description: '',
            driverLink: '',
            status: 'active',
            pdsaCycles: JSON.parse(JSON.stringify(d.pdsa))
        }];
        // d.pdsa kept intact so charts/export keep working
    }

    // ─── Multi-measure migration ───────────────────────────────────────────
    // Older projects (and legacy Firestore documents) only have a single
    // flat d.chartData / d.chartSettings. Wrap that into measures[0] so the
    // app can support tracking several independent measures at once.
    if (!Array.isArray(d.measures) || d.measures.length === 0) {
        d.measures = [{
            id: 'measure_default',
            name: defaultMeasureName(d.checklist && d.checklist.outcome_measure),
            unit: '',
            role: 'outcome',
            chartData: Array.isArray(d.chartData) ? d.chartData : [],
            chartSettings: (d.chartSettings && typeof d.chartSettings === 'object') ? d.chartSettings : {
                mode: 'run', showMedian: true, showMean: false, ucl: null, lcl: null,
                title: '', yAxisLabel: '', showAnnotations: true
            }
        }];
        d.activeMeasureId = 'measure_default';
    }
    // Keep d.chartData / d.chartSettings as live references to the active
    // measure so all existing chart/QIAT/report code keeps working unmodified.
    if (!d.activeMeasureId || !d.measures.find(m => m.id === d.activeMeasureId)) {
        d.activeMeasureId = d.measures[0].id;
    }
    const activeMeasure = d.measures.find(m => m.id === d.activeMeasureId) || d.measures[0];
    if (!Array.isArray(activeMeasure.chartData)) activeMeasure.chartData = [];
    if (!activeMeasure.chartSettings || typeof activeMeasure.chartSettings !== 'object') {
        activeMeasure.chartSettings = { mode: 'run', showMedian: true, showMean: false, ucl: null, lcl: null, title: '', yAxisLabel: '', showAnnotations: true };
    }
    d.chartData = activeMeasure.chartData;
    d.chartSettings = activeMeasure.chartSettings;

    // ─── EM-QIAT (2025 Update) form migration ──────────────────────────────
    // Replaces the old invented "trainee level + 3 generic capabilities"
    // supervisor checklist with fields that mirror the real RCEM EM-QIAT form
    // field-for-field. Stored under d.emqiatForm — deliberately a DIFFERENT
    // key from d.emqiat (the older, separate "EM-QIAT Journal" modal below,
    // window.showEMQIATModal) so the two never collide on the same object.
    // Additive only — never overwrites data already there.
    if (!d.emqiatForm || typeof d.emqiatForm !== 'object') d.emqiatForm = {};
    const emqiatFormDefaults = {
        dateOccurred: '', endDate: '', description: '',
        stageOfTraining: '', placement: '', dateOfCompletion: '',
        pdp: '', qiEducationInvolvement: '', qiEducationLearning: '',
        involvedInProject: '', role: '', teamStakeholders: '', sharingResults: '',
        reflections: '', nextYearPdp: '', endOfTrainingJourney: ''
    };
    Object.keys(emqiatFormDefaults).forEach(key => {
        if (d.emqiatForm[key] === undefined || d.emqiatForm[key] === null) d.emqiatForm[key] = emqiatFormDefaults[key];
    });
    if (!d.emqiatForm.overview || typeof d.emqiatForm.overview !== 'object') d.emqiatForm.overview = {};
    ['background', 'aim', 'understandingProblem', 'measures', 'interventions', 'results', 'nextSteps'].forEach(key => {
        if (d.emqiatForm.overview[key] === undefined || d.emqiatForm.overview[key] === null) d.emqiatForm.overview[key] = '';
    });
    if (!d.emqiatForm.qiJourney || typeof d.emqiatForm.qiJourney !== 'object') d.emqiatForm.qiJourney = {};
    ['creatingConditions', 'understandingSystems', 'developingAims', 'testingChanges', 'implement', 'spread', 'leadershipTeams', 'projectManagementCommunication', 'measurement'].forEach(key => {
        if (d.emqiatForm.qiJourney[key] === undefined || d.emqiatForm.qiJourney[key] === null) d.emqiatForm.qiJourney[key] = false;
    });

    // Assessment: drop the old traineeLevel/capabilitiesMet fields (superseded
    // by d.emqiatForm.stageOfTraining and d.emqiatForm.qiJourney above) and add the
    // identity-binding fields for sign-off.
    if (!d.assessment || typeof d.assessment !== 'object') d.assessment = {};
    const assessmentDefaults = {
        supervisorComments: '', signedOff: false, signedOffBy: '', signedOffByUid: '',
        signedOffByEmail: '', signedOffGmc: '', signedOffDate: '',
        lastSupervisorActivityAt: '', traineeSeenAt: ''
    };
    Object.keys(assessmentDefaults).forEach(key => {
        if (d.assessment[key] === undefined || d.assessment[key] === null) d.assessment[key] = assessmentDefaults[key];
    });
    delete d.assessment.traineeLevel;
    delete d.assessment.capabilitiesMet;
}

// Short tab-friendly measure name from a free-text outcome measure, e.g.
// "PRIMARY OUTCOME 1 — 'Time to Kit' (seconds):\nMethod: ..." -> "'Time to Kit' (seconds)".
function defaultMeasureName(outcomeMeasure) {
    let s = String(outcomeMeasure || '').split('\n')[0].trim();
    s = s.replace(/^(primary|secondary)?\s*outcome(\s+measure)?\s*\d*\s*[—–:-]\s*/i, '');
    if (s.includes(':')) s = s.split(':')[0].trim();
    if (s.length > 48) s = s.slice(0, 48).replace(/\s+\S*$/, '') + '…';
    return s || 'Primary Outcome Measure';
}

// Fills in every field the views expect, whichever way a project was opened
// (own project, QIP Lead view, Supervisor view), so older or sparse projects
// never crash a tab.
function normaliseProjectData(d) {
    if (!d) return d;
    if (!d.meta || typeof d.meta !== 'object') d.meta = { title: 'Untitled QIP' };
    if (!d.checklist) d.checklist = {};
    if (!d.drivers) d.drivers = { primary: [], secondary: [], changes: [] };
    ['primary', 'secondary', 'changes'].forEach(k => { if (!Array.isArray(d.drivers[k])) d.drivers[k] = []; });
    if (!d.fishbone) d.fishbone = JSON.parse(JSON.stringify(emptyProject.fishbone));
    if (!d.pdsa) d.pdsa = [];
    if (!d.chartData) d.chartData = [];
    if (!d.stakeholders) d.stakeholders = [];
    if (!d.gantt) d.gantt = [];
    if (!d.teamMembers) d.teamMembers = [];
    if (!d.chartSettings) d.chartSettings = {};
    if (!d.process) d.process = ["Start", "End"];
    if (!d.leadershipLogs) d.leadershipLogs = [];
    if (!d.patientFeedback) d.patientFeedback = [];
    if (!d.surveys) d.surveys = [];
    migrateProjectData(d);
    return d;
}

// Summary figures shown on QIP Lead / Supervisor cards. Uses the same
// readiness scoring as the trainee's own dashboard so the numbers agree.
function summariseProject(d) {
    d = d || {};
    const readiness = computeReadiness(d);
    const last = lastActivityDate(d);
    return {
        _progress: readiness.percent,
        _readinessMet: readiness.metCount,
        _readinessTotal: readiness.total,
        _dataPoints: allMeasurePoints(d).length,
        _pdsaCount: (d.pdsa || []).length,
        _teamCount: (d.teamMembers || []).length,
        _stage: d.meta?.trainingStage || '',
        _lastActivity: last ? last.toISOString() : '',
        _signedOff: !!d.assessment?.signedOff,
        _signedOffBy: d.assessment?.signedOffBy || '',
        _signedOffDate: d.assessment?.signedOffDate || ''
    };
}

async function fetchProjectDoc(ownerUid, projectId) {
    if (!db || !ownerUid || !projectId) return null;
    try {
        const snap = await getDoc(doc(db, `users/${ownerUid}/projects`, projectId));
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.warn('[Project] fresh fetch failed, using cached copy:', e);
        return null;
    }
}

// Leaves whatever project is open (own, lead-viewed or supervised) and
// stops its live listener, so a later snapshot of the user's own project
// can't overwrite a trainee project being reviewed.
// JSON with object keys sorted, so two copies of a project compare equal
// whatever order Firestore returns their fields in.
function stableJson(v) {
    return JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val))
        ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {})
        : val);
}

function leaveProjectContext() {
    flushPendingSave();
    if (window.unsubscribeProject) { window.unsubscribeProject(); window.unsubscribeProject = null; }
    state.currentProjectId = null;
    state.projectData = null;
    state.isReadOnly = false;
    state.isLeadViewing = false;
    state.isSupervisorViewing = false;
    state.supervisorTargetUid = null;
    state.leadTargetUid = null;
    state._readOnlySnapshot = null;
    stopReadOnlyLock();
    const ind = document.getElementById('readonly-indicator');
    if (ind) ind.classList.add('hidden');
    document.body.classList.remove('readonly-mode');
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.add('hidden');
    const renameBtn = document.getElementById('btn-rename-project');
    if (renameBtn) renameBtn.style.display = 'none';
}

// Returns the primary/first measure — used for QIAT scoring, dashboard
// counts, and auto-generated report text so those stay consistent
// regardless of which measure tab the user currently has open.
function getPrimaryMeasure(d) {
    if (!d) return null;
    if (Array.isArray(d.measures) && d.measures.length > 0) return d.measures[0];
    return { chartData: d.chartData || [], chartSettings: d.chartSettings || {} };
}
window.getPrimaryMeasure = getPrimaryMeasure;

// ─── Clinical Templates ───────────────────────────────────────────────────────
const CLINICAL_TEMPLATES = [
    {
        id: 'mental-health-self-harm',
        title: 'Mental Health: Self-Harm',
        year: '2025 — check 2026 status',
        stage: 'All stages',
        color: 'rose',
        description: 'Risk assessment, safety planning, and early referral pathways for patients presenting with self-harm or suicidal ideation. Ran as an RCEM national QIP through 2025 (its final year); RCEM\u2019s 2026 national topics are Care of Older People, Adolescent Mental Health, and Time Critical Medications \u2014 double-check rcem.ac.uk/quality-improvement if you want this one to count as national-programme evidence rather than a locally-relevant topic.',
        checklist: {
            problem_desc: 'Inconsistent risk assessment and safety planning documentation for patients presenting to the ED with self-harm or suicidal ideation.',
            aim: 'To improve compliance with RCEM self-harm standards by 30% within 12 months, ensuring all patients presenting with self-harm receive a documented risk assessment and safety plan before discharge.',
            outcome_measure: 'Proportion of patients presenting with self-harm who have a completed, documented risk assessment and safety plan prior to discharge.',
            process_measure: 'Proportion of clinicians using the trust safety planning proforma; number of patients referred to mental health liaison within 4 hours.',
            balance_measure: 'Average ED length of stay for mental health presentations; unplanned re-attendance rate within 72 hours.'
        },
        changeIdeas: [
            { title: 'Implement standardised safety planning proforma in EPR', description: 'Embed a mandatory safety planning template within the EPR clerking for all mental health triage presentations.' },
            { title: 'Targeted education session for ED clinicians', description: 'Run a focused training session on NICE self-harm guidelines and local referral pathways for all grades.' }
        ]
    },
    {
        id: 'delirium-screening',
        title: 'Care of Older People: Delirium Screening',
        year: '2025–2026',
        stage: 'ST4–ST6',
        color: 'blue',
        description: 'Improve 4AT delirium screening rates for patients aged 75+ presenting to the Emergency Department.',
        checklist: {
            problem_desc: 'Delirium is under-recognised in the ED, with low rates of formal 4AT screening in patients aged 75 and older.',
            aim: 'To improve the rate of documented 4AT delirium screening from 10% to 20% for patients aged 75+ presenting to the ED by August 2026.',
            outcome_measure: 'Percentage of patients aged 75+ receiving a documented delirium screen upon ED presentation.',
            process_measure: 'Type of screening tool utilised; screening rates across different shifts; role of the screening clinician.',
            balance_measure: 'Total ED length of stay for geriatric patients; time to initial clinical assessment.'
        },
        changeIdeas: [
            { title: 'Focused education on 4AT screening tool', description: 'Deliver education sessions on identifying delirium and using 4AT for all nursing and medical staff.' },
            { title: 'Establish inter-departmental handover protocol', description: 'Create a formal handover protocol between ED and geriatric medicine to ensure screening results are communicated at admission.' }
        ]
    },
    {
        id: 'time-critical-medications',
        title: 'Time-Critical Medications',
        year: '2025–2026',
        stage: 'All stages',
        color: 'amber',
        description: 'Eliminate delays in administering essential pharmacotherapy such as antibiotics in sepsis or anticonvulsants in status epilepticus.',
        checklist: {
            problem_desc: 'Delays in administration of time-critical medications in the ED result in avoidable patient harm.',
            aim: 'To reduce the median time to administration of antibiotics in sepsis to under 60 minutes from ED arrival, achieving compliance with RCEM time-critical medication standards.',
            outcome_measure: 'Median time (minutes) from ED arrival to first antibiotic dose in suspected sepsis.',
            process_measure: 'Proportion of sepsis cases with antibiotics prescribed within 30 minutes; rate of blood cultures prior to antibiotic administration.',
            balance_measure: 'Rate of inappropriate antibiotic prescribing; incidence of documented antibiotic allergy reactions.'
        },
        changeIdeas: [
            { title: 'Sepsis recognition prompt in triage EPR', description: 'Embed a mandatory sepsis screening question and automatic antibiotic alert within the triage EPR module.' },
            { title: 'Pre-draw antibiotic protocol for resus bay', description: 'Implement a nurse-initiated protocol to pre-draw and administer antibiotics in confirmed sepsis without waiting for a prescription.' }
        ]
    },
    {
        id: 'adolescent-mental-health',
        title: 'Adolescent Mental Health (HEEADSSS)',
        year: '2025–2026',
        stage: 'All stages',
        color: 'purple',
        description: 'Multi-domain HEEADSSS psychosocial screening for adolescent psychiatric emergencies in the ED.',
        checklist: {
            problem_desc: 'Adolescents presenting to the ED with mental health crises are not consistently receiving structured HEEADSSS psychosocial assessments, resulting in missed safeguarding concerns.',
            aim: 'To achieve compliance with HEEADSSS psychosocial screening documentation in 60% of adolescent mental health presentations within 12 months.',
            outcome_measure: 'Proportion of adolescent mental health presentations with a documented HEEADSSS assessment.',
            process_measure: 'Proportion of presentations with onward mental health referral documented; rate of safeguarding alerts raised.',
            balance_measure: 'ED length of stay for adolescent mental health presentations; rate of re-attendance within 7 days.'
        },
        changeIdeas: [
            { title: 'Introduce HEEADSSS proforma in EPR', description: 'Create an EPR proforma embedding the HEEADSSS domains for all adolescent mental health assessments.' },
            { title: 'Multi-disciplinary teaching on adolescent safeguarding', description: 'Deliver joint teaching with CAMHS on adolescent safeguarding, referral thresholds, and HEEADSSS assessment.' }
        ]
    },
    {
        id: 'paracetamol-overdose',
        title: 'Paracetamol Overdose Management',
        year: 'Not a national QIP',
        stage: 'All stages',
        color: 'emerald',
        description: 'Standardise blood testing timelines and treatment regimens for paracetamol overdose presentations. This is a genuinely useful clinical topic, but it doesn\u2019t currently carry RCEM national-programme status like the other starters here \u2014 good as your own locally-led QIP, just don\u2019t badge it as a national one on your ARCP paperwork.',
        checklist: {
            problem_desc: 'Variation in blood test timing and treatment decision-making in paracetamol overdose presentations to the ED.',
            aim: 'To achieve 90% compliance with RCEM paracetamol overdose blood testing timelines and treatment protocols, reducing variation in clinical management.',
            outcome_measure: 'Proportion of paracetamol overdose presentations with blood tests taken at the correct time (4 hours post-ingestion, or time of presentation if >4 hours).',
            process_measure: 'Proportion of cases with treatment decision documented using the paracetamol nomogram; rate of Pharmacy involvement.',
            balance_measure: 'Rate of under- or over-treatment; unplanned re-attendance rate within 72 hours.'
        },
        changeIdeas: [
            { title: 'Standardised paracetamol overdose EPR proforma', description: 'Introduce a structured EPR clerking proforma for all paracetamol overdose presentations with auto-calculated treatment prompts.' },
            { title: 'Treatment nomogram poster and EPR hyperlink', description: 'Place visual nomogram decision aids in resus and majors; embed as a hyperlink in the EPR drug prescribing module.' }
        ]
    },
    {
        id: 'generic-local-topic',
        title: 'Locally-Chosen Topic (Generic Starter)',
        year: 'Any',
        stage: 'All stages',
        color: 'slate',
        description: 'Not doing one of the 5 national topics above? Use this generic starter for a locally-chosen QIP. It fills in example outcome/process/balancing measures for the most common data types (proportion, time-based, and count) so you can see the pattern, then edit every field to match your own topic.',
        checklist: {
            problem_desc: '[Describe your local problem here] e.g. "Compliance with [local guideline/standard] is inconsistent in our department, leading to [patient impact]."',
            aim: '[Write your SMART aim here] e.g. "To improve [process] from X% to Y% for [patient group] by [date], as measured by [outcome measure]."',
            outcome_measure: 'Pick the data type that fits your topic and adapt the wording:\n- Proportion/%: Proportion of patients receiving [intervention] within [target time/standard].\n- Time-based: Median time (minutes) from [start event] to [end event].\n- Count: Number of documented errors/incidents/omissions per [week/month].',
            process_measure: 'Example: Proportion of staff using the new proforma/checklist/pathway; number of teaching sessions delivered; rate of correct tool selection.',
            balance_measure: 'Are you inadvertently slowing another process down or increasing workload elsewhere? Example: department length of stay, staff time burden, or an unintended rise in a different error type.'
        },
        changeIdeas: []
    }
];

window.CLINICAL_TEMPLATES = CLINICAL_TEMPLATES;
window.R = R; // expose renderer module for applyTemplate and other dynamic callers

console.log('App starting...');
window._qipModules = { state }; // expose for export functions
// Expose QIP Lead panel renderer for supervisor.js
window.renderQIPLeadPanelFn = function() {
    const panel = document.getElementById('qip-lead-panel');
    if (panel && state.currentUser) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
};

// QIP Lead runtime state
state.isQIPLead = false;
state.qipLeadProjects = [];

// Master Admin runtime state
state.isMasterAdmin = false;
state.adminAllProjects = [];

(function cleanURL() {
    const url = new URL(window.location.href);
    const sensitiveParams = ['password', 'pass', 'pwd', 'passwd', 'secret', 'token', 'key', 'apikey'];
    let needsClean = false;
    
    sensitiveParams.forEach(param => {
        if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            needsClean = true;
        }
    });
    
    if (url.searchParams.has('email') && !url.searchParams.has('share')) {
        url.searchParams.delete('email');
        needsClean = true;
    }
    
    if (needsClean) {
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
})();

Object.defineProperty(window, 'projectData', { get: () => state.projectData, set: (v) => state.projectData = v });

// ─── Collapsible sidebar nav groups ────────────────────────────────────────
// Maps each collapsible sidebar group id to the router view names it
// contains, so we can auto-expand the right group whenever the user
// navigates to a view inside a currently-collapsed section.
const NAV_GROUP_VIEWS = {
    define: ['dashboard', 'intro', 'full', 'checklist', 'team', 'charter'],
    diagnose: ['tools', 'stakeholders', 'gantt', 'action-plan'],
    test: ['data', 'results', 'aireview', 'learn', 'pdsa', 'surveys'],
    review: ['supervisor'],
    share: ['publish', 'green']
};
const NAV_GROUP_COLLAPSE_KEY = (groupId) => `qipNavGroupCollapsed_${groupId}`;

// Toggles (or forces via `expand`) a sidebar nav group open/closed, rotates
// its chevron, and persists the collapsed state to localStorage so it
// survives reloads.
// Only a click by the user is remembered (`persist`); automatic expansion on
// load or navigation isn't, so it can't be mistaken for a user preference.
window.toggleNavGroup = (groupId, expand, persist = true) => {
    const items = document.getElementById(`nav-group-items-${groupId}`);
    const header = document.querySelector(`.nav-group[data-group="${groupId}"] .nav-group-header`);
    if (!items) return;

    const shouldExpand = (typeof expand === 'boolean') ? expand : items.classList.contains('hidden');

    if (shouldExpand) {
        items.classList.remove('hidden');
    } else {
        items.classList.add('hidden');
    }

    const chevron = header ? header.querySelector('.nav-group-chevron') : null;
    if (chevron) chevron.style.transform = shouldExpand ? 'rotate(0deg)' : 'rotate(-90deg)';

    if (!persist) return;
    try {
        safeStorage.set(NAV_GROUP_COLLAPSE_KEY(groupId), shouldExpand ? '0' : '1');
    } catch (e) { /* localStorage unavailable — ignore */ }
};

// Force-expands whichever sidebar group contains the given view, e.g. so
// navigating straight to 'results' always reveals the Test & Learn group
// even if the user had collapsed it.
window.expandNavGroupForView = (view) => {
    const groupId = Object.keys(NAV_GROUP_VIEWS).find(g => NAV_GROUP_VIEWS[g].includes(view));
    if (groupId) window.toggleNavGroup(groupId, true, false);
};

// Applies any saved collapse state to all nav groups on load. Safe to call
// at top level here since app.js is a deferred `type="module"` script, so
// the DOM is already parsed by the time this file executes.
window.initNavGroups = () => {
    Object.keys(NAV_GROUP_VIEWS).forEach(groupId => {
        let collapsed = false;
        try { collapsed = safeStorage.get(NAV_GROUP_COLLAPSE_KEY(groupId)) === '1'; } catch (e) { /* ignore */ }
        window.toggleNavGroup(groupId, !collapsed, false);
    });
};
window.initNavGroups();

// First-time-ever nudge: a brand-new project (no checklist fields filled
// in at all) starts with only "Define & Measure" expanded, so a first-time
// ST4 sees a short list of steps rather than 16 destinations across 5
// groups on day one. Only fires once ever, and only if the user has never
// manually customised a nav group before (so it never fights an explicit
// preference on later projects).
window.applyProgressiveNavDisclosure = () => {
    try {
        const anyCustomised = Object.keys(NAV_GROUP_VIEWS).some(g => safeStorage.get(NAV_GROUP_COLLAPSE_KEY(g)) !== null);
        if (anyCustomised) return;
        const c = (state.projectData && state.projectData.checklist) || {};
        const fields = ['problem_desc', 'problem_context', 'problem_evidence', 'aim', 'outcome_measure', 'process_measure', 'balance_measure', 'ethics', 'lit_review', 'learning_points', 'sustainability', 'results_analysis'];
        const filled = fields.filter(f => c[f] && String(c[f]).trim()).length;
        if (filled === 0) {
            Object.keys(NAV_GROUP_VIEWS).forEach(g => { if (g !== 'define') window.toggleNavGroup(g, false); });
        }
    } catch (e) { /* localStorage unavailable — ignore, groups stay expanded */ }
};

window.router = (view) => {
    if (view !== 'projects' && view !== 'learn' && !state.projectData) { 
        showToast("Please select a project first.", "error"); 
        return; 
    }
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');
    // nav-learn has a teal base colour — use inline style to guarantee white text when active
    const navLearnBtn = document.getElementById('nav-learn');
    if (navLearnBtn) navLearnBtn.style.color = (view === 'learn') ? 'white' : '';
    window.expandNavGroupForView(view);

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('z-50')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }

    if (state.isReadOnly && state.projectData && !state._readOnlySnapshot) {
        state._readOnlySnapshot = JSON.stringify(state.projectData);
    }

    if (view === 'supervisor') {
        renderSupervisorDashboard();
    } else if (view === 'learn') {
        renderLearn();
    } else {
        R.renderAll(view);
    }

    if (state.isReadOnly) startReadOnlyLock();
};

// ─── Read-only lock ───────────────────────────────────────────────────────────
// Anyone browsing someone else's project (QIP Lead, supervisor, admin, public
// share link) sees every field locked. saveData() already refuses to write;
// this stops the page looking editable. Controls inside [data-readonly-allow]
// (the supervisor's own comment/sign-off form) stay usable.
const READONLY_LOCK_SELECTOR = '.view-section input, .view-section textarea, .view-section select[data-edits], .view-section [contenteditable="true"]';
const READONLY_SKIP_INPUTS = new Set(['search', 'range', 'button', 'submit', 'hidden', 'reset']);
let readOnlyObserver = null;
let readOnlyLockQueued = false;

function lockReadOnlyControls() {
    readOnlyLockQueued = false;
    if (!state.isReadOnly) return;
    document.querySelectorAll(READONLY_LOCK_SELECTOR).forEach(el => {
        if (el.dataset.readonlyLocked || el.closest('[data-readonly-allow]')) return;
        if (el.getAttribute('contenteditable') === 'true') {
            el.setAttribute('contenteditable', 'false');
        } else if (el.tagName === 'INPUT' && READONLY_SKIP_INPUTS.has(el.type)) {
            return;
        } else if (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && ['checkbox', 'radio', 'file', 'date', 'color', 'month', 'week'].includes(el.type))) {
            if (el.disabled) return;
            el.disabled = true;
        } else {
            if (el.readOnly) return;
            el.readOnly = true;
        }
        el.dataset.readonlyLocked = '1';
    });
}

function queueReadOnlyLock() {
    if (readOnlyLockQueued) return;
    readOnlyLockQueued = true;
    requestAnimationFrame(lockReadOnlyControls);
}

function startReadOnlyLock() {
    queueReadOnlyLock();
    if (readOnlyObserver) return;
    const root = document.getElementById('view-dashboard')?.parentElement;
    if (!root || typeof MutationObserver === 'undefined') return;
    readOnlyObserver = new MutationObserver(() => { if (state.isReadOnly) queueReadOnlyLock(); });
    readOnlyObserver.observe(root, { childList: true, subtree: true });
}

function stopReadOnlyLock() {
    if (readOnlyObserver) { readOnlyObserver.disconnect(); readOnlyObserver = null; }
    document.querySelectorAll('[data-readonly-locked]').forEach(el => {
        if (el.getAttribute('contenteditable') === 'false') el.setAttribute('contenteditable', 'true');
        else if ('disabled' in el && el.disabled) el.disabled = false;
        if ('readOnly' in el) el.readOnly = false;
        delete el.dataset.readonlyLocked;
    });
}

// Viewing choices (which measure tab, which chart type) change the project
// object too. In read-only mode, accept them as the new baseline instead of
// reverting them as if they were edits — otherwise viewers can't change view.
// Real edits can't be pending here: they are reverted as soon as they're saved.
window.acceptReadOnlyViewChange = function() {
    if (state.isReadOnly && state.projectData) state._readOnlySnapshot = JSON.stringify(state.projectData);
};
// Stores a viewing choice: kept locally when read-only, otherwise saved
// without becoming an Undo step.
window.saveViewChoice = function() {
    if (state.isReadOnly) window.acceptReadOnlyViewChange();
    else if (window.saveData) window.saveData(true);
};

// Called when saveData() is refused in read-only mode: put back the copy of
// the project we opened, redraw, and say why nothing was saved.
let lastReadOnlyToast = 0;
let lastReadOnlyRedraw = 0;
let revertingReadOnly = false;
function revertReadOnlyEdit() {
    const snap = state._readOnlySnapshot;
    if (revertingReadOnly || !snap || !state.projectData) return;
    if (JSON.stringify(state.projectData) === snap) return;
    state.projectData = JSON.parse(snap);
    if (window.syncActiveMeasureRefs) window.syncActiveMeasureRefs();
    // Redraw so the screen matches the data again — but never in a loop, in
    // case a page saves while it renders.
    const current = document.querySelector('.view-section:not(.hidden)');
    const view = current ? current.id.replace('view-', '') : 'dashboard';
    if (view !== 'projects' && Date.now() - lastReadOnlyRedraw > 500) {
        lastReadOnlyRedraw = Date.now();
        revertingReadOnly = true;
        try { window.router(view); } finally { revertingReadOnly = false; }
    }
    if (Date.now() - lastReadOnlyToast > 4000) {
        lastReadOnlyToast = Date.now();
        showToast("You're viewing this project read-only — changes aren't saved.", 'info');
    }
}

// ==========================================
// HOW-TO GUIDE MODAL
// ==========================================
// ─── Education Hub (Learn Panel) — redirects to full Learn view ──────────────
window.showLearnPanel = function() { window.router('learn'); };

/* LEGACY MODAL — kept as comment for reference, replaced by view-learn / learn.js
const _legacyLearnModal = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto overflow-hidden" style="max-height:90vh;display:flex;flex-direction:column">
                <div class="bg-gradient-to-r from-rcem-purple to-indigo-600 text-white px-6 py-5 flex-shrink-0">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <i data-lucide="graduation-cap" class="w-6 h-6"></i>
                            <div>
                                <h2 class="text-lg font-bold">QI Learning Hub</h2>
                                <p class="text-xs text-indigo-200">Resources, guidance, and the FRCEM marking rubric</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('learn-panel-modal').remove()" class="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                <div class="overflow-y-auto p-6 space-y-6">

                    <!-- Stage guide -->
                    <div>
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2"><i data-lucide="map" class="w-4 h-4 text-rcem-purple"></i> What is Expected at Each Stage?</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <div class="font-bold text-blue-800 text-sm mb-1">ACCS (ST1–ST2)</div>
                                <p class="text-xs text-blue-700 leading-relaxed">Contribute to a departmental project. Demonstrate basic understanding of QI principles and reflect on team dynamics.</p>
                            </div>
                            <div class="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                                <div class="font-bold text-indigo-800 text-sm mb-1">Intermediate (ST3)</div>
                                <p class="text-xs text-indigo-700 leading-relaxed">Understand QI methods, execute data analysis, and evaluate the impact of clinical changes. At least 2 PDSA cycles.</p>
                            </div>
                            <div class="bg-purple-50 rounded-xl p-4 border border-purple-100">
                                <div class="font-bold text-purple-800 text-sm mb-1">HST (ST4–ST6)</div>
                                <p class="text-xs text-purple-700 leading-relaxed">Provide clinical leadership, drive safety culture, and manage governance. ST6: lead, complete, and write up a robust QIP. 3+ iterative PDSA cycles for Excellent.</p>
                            </div>
                        </div>
                    </div>

                    <!-- FRCEM Marking Rubric -->
                    <div>
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2"><i data-lucide="clipboard-check" class="w-4 h-4 text-emerald-600"></i> FRCEM Marking Rubric at a Glance</h3>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-50">
                                        <th class="text-left p-2 border border-slate-200 font-bold text-slate-700">Domain</th>
                                        <th class="text-left p-2 border border-slate-200 font-bold text-amber-700">Satisfactory</th>
                                        <th class="text-left p-2 border border-slate-200 font-bold text-emerald-700">Excellent</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td class="p-2 border border-slate-200 font-medium">Narrative Structure</td><td class="p-2 border border-slate-200 text-slate-600">Clear problem ID; relevant local context; cohesive structure</td><td class="p-2 border border-slate-200 text-slate-600">Compelling narrative flow; fluid transitions; clear logical progression</td></tr>
                                    <tr class="bg-slate-50"><td class="p-2 border border-slate-200 font-medium">Engagement & Team</td><td class="p-2 border border-slate-200 text-slate-600">Identified team members; defined roles; documented contributions</td><td class="p-2 border border-slate-200 text-slate-600">Interdisciplinary team; documented management of resistance; patient co-design</td></tr>
                                    <tr><td class="p-2 border border-slate-200 font-medium">Problem Analysis</td><td class="p-2 border border-slate-200 text-slate-600">Baseline audit; critical appraisal of clinical literature</td><td class="p-2 border border-slate-200 text-slate-600">Multiple analysis tools (SWOT, PEST, Ishikawa, FMEA); option appraisal</td></tr>
                                    <tr class="bg-slate-50"><td class="p-2 border border-slate-200 font-medium">Change Management</td><td class="p-2 border border-slate-200 text-slate-600">Basic Model for Improvement; <strong>at least 2 PDSA cycles</strong></td><td class="p-2 border border-slate-200 text-slate-600">Gantt charts; stakeholder forcefields; <strong>3+ distinct, iterative PDSA cycles</strong></td></tr>
                                    <tr><td class="p-2 border border-slate-200 font-medium">Measuring Outcomes</td><td class="p-2 border border-slate-200 text-slate-600">Outcome, process, and balancing measures; basic data tables</td><td class="p-2 border border-slate-200 text-slate-600">Annotated run charts or SPC charts; justified metrics</td></tr>
                                    <tr class="bg-slate-50"><td class="p-2 border border-slate-200 font-medium">Reflection</td><td class="p-2 border border-slate-200 text-slate-600">Basic personal reflection; future project steps identified</td><td class="p-2 border border-slate-200 text-slate-600">Deep, self-aware reflection; personal strengths/weaknesses; sustainability analysis</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p class="text-xs text-slate-400 mt-2">Word count: 3,000–4,000 words. Formatting: 11pt double-spaced Arial/Times New Roman. Referencing: Vancouver.</p>
                    </div>

                    <!-- Educational resources -->
                    <div>
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-blue-600"></i> Curated Learning Resources</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a href="https://www.ihi.org/education/IHIOpenSchool/Pages/default.aspx" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 hover:border-blue-300 transition-colors group">
                                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-blue-700">IHI Open School</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Basic Certificate in QI & Safety. Free modules: Model for Improvement, PDSA cycles, Run/Control Charting. All training stages.</div>
                                </div>
                            </a>
                            <a href="https://www.nhselect.nhs.uk/training-development/improvement" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 hover:border-emerald-300 transition-colors group">
                                <div class="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-emerald-700">NHS Elect — QI Practitioner Programme</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Four modules: QI Fundamentals; Measurement Frameworks & Driver Diagrams; Run Chart Interpretation; Sustaining Change. For HST trainees & operational leads.</div>
                                </div>
                            </a>
                            <a href="https://www.hqip.org.uk/resource/guide-to-quality-improvement-tools" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100 hover:border-orange-300 transition-colors group">
                                <div class="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-orange-700">HQIP — Guide to QI Tools</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Technical overview of 11 improvement tools: Root Cause Analysis, clinical audit, Lean, SPC, and more. For all healthcare professionals.</div>
                                </div>
                            </a>
                            <a href="https://awsem.co.uk/outside-the-ed/quality-improvement/" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-colors group">
                                <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-indigo-700">AWSEM — EM Quality Improvement Hub</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Emergency Medicine-specific QI resources, templates, and guidance tailored to the ED environment.</div>
                                </div>
                            </a>
                            <a href="https://rcem.ac.uk/rcem-curriculum/" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors group">
                                <div class="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-slate-700">RCEM SLO 11 Guidance</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Official RCEM curriculum guidance for SLO 11 — QI competencies, EM-QIAT requirements, and ARCP expectations at each stage.</div>
                                </div>
                            </a>
                            <a href="https://www.gsqia.nhs.uk/" target="_blank" rel="noopener"
                               class="flex items-start gap-3 p-4 bg-teal-50 rounded-xl border border-teal-100 hover:border-teal-300 transition-colors group">
                                <div class="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="external-link" class="w-4 h-4 text-white"></i>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-slate-800 group-hover:text-teal-700">GSQIA Silver Templates</div>
                                    <div class="text-xs text-slate-500 mt-0.5">Downloadable cause-and-effect diagrams, SPC calculators, phased run charts, and progress slides. For core and HST trainees.</div>
                                </div>
                            </a>
                        </div>
                    </div>

                    <!-- Key terminology -->
                    <div>
                        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2"><i data-lucide="help-circle" class="w-4 h-4 text-purple-600"></i> Key Concepts</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${[
                                ['Driver Diagram', 'A visual map linking your Aim to Primary Drivers (main categories of causes), Secondary Drivers (specific contributing factors), and Change Ideas (interventions to test).'],
                                ['PDSA Cycle', 'Plan (what you will test & predict), Do (run the test), Study (analyse results vs prediction), Act (adopt, adapt, or abandon). Each cycle builds on the last.'],
                                ['Change Idea', 'A specific intervention to be tested through PDSA cycles. You can have multiple change ideas within one project, each with their own iterative cycles.'],
                                ['Run Chart', 'A graph of your data over time with the median marked. Used to spot trends, shifts, and the impact of your change ideas on outcomes.'],
                                ['Outcome Measure', 'What ultimately changes for the patient (e.g. % receiving a correct diagnosis).'],
                                ['Process Measure', 'Whether the clinical process you changed is being followed (e.g. % of forms completed).'],
                                ['Balancing Measure', 'Unintended consequences of your change — things that might get worse while you improve the target (e.g. length of stay).'],
                                ['SPC Chart', 'Statistical Process Control: a run chart with control limits to detect special-cause variation — a signal that your change is having a real, non-random effect.']
                            ].map(([term, def]) => `
                            <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <div class="font-bold text-xs text-slate-700 mb-0.5">${term}</div>
                                <p class="text-xs text-slate-500 leading-relaxed">${def}</p>
                            </div>`).join('')}
                        </div>
                    </div>

                </div>
                <div class="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button onclick="document.getElementById('learn-panel-modal').remove()" class="w-full py-2 text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors">Close</button>
                </div>
            </div>
        `;
*/

// ─── Read-only review exit dispatcher ─────────────────────────────────────────
// Called by the Exit button in the amber read-only banner (works from any page)
window.exitReadOnlyReview = function() {
    if (state.isSupervisorViewing) {
        window.returnFromSupervisorView();
    } else if (state.isLeadViewing) {
        window.returnFromLeadView();
    } else {
        window.returnToProjects();
    }
};

// Shows the amber read-only banner with a contextual Exit button.
// context: 'lead' | 'supervisor' | null (null = no exit target, e.g. public share link)
function showReadOnlyBanner(projectTitle, context) {
    const ind = document.getElementById('readonly-indicator');
    const lbl = document.getElementById('readonly-indicator-label');
    const exitBtn = document.getElementById('readonly-indicator-exit');
    if (!ind) return;
    ind.classList.remove('hidden');
    document.body.classList.add('readonly-mode');
    if (lbl) {
        lbl.textContent = projectTitle ? `Read-Only Mode — ${projectTitle}` : 'Read-Only Mode';
    }
    if (exitBtn) {
        if (context === 'lead') {
            exitBtn.textContent = 'Exit to QIP Lead Overview';
            exitBtn.classList.remove('hidden');
        } else if (context === 'supervisor') {
            exitBtn.textContent = 'Exit to Supervisor Overview';
            exitBtn.classList.remove('hidden');
        } else {
            exitBtn.classList.add('hidden');
        }
    }
}


// ─── Rename Project ───────────────────────────────────────────────────────────
window.renameProject = function() {
    if (!state.projectData || state.isReadOnly || state.isSupervisorViewing) return;
    const currentTitle = state.projectData.meta?.title || '';
    showInputModal(
        'Rename Project',
        [{ id: 'new_title', label: 'Project Title', type: 'text', value: currentTitle, placeholder: 'Enter project title...' }],
        async (vals) => {
            const newTitle = (vals.new_title || '').trim();
            if (!newTitle) { showToast('Title cannot be empty', 'error'); return; }
            if (newTitle === currentTitle) return;
            if (!state.projectData.meta) state.projectData.meta = {};
            state.projectData.meta.title = newTitle;
            const headerTitle = document.getElementById('project-header-title');
            if (headerTitle) headerTitle.textContent = newTitle;
            await window.saveData(false);
            showToast('Project renamed to "' + newTitle + '"', 'success');
        },
        'Rename'
    );
};

// ─── Clinical Templates Modal ─────────────────────────────────────────────────
window.showTemplatesModal = function() {
    let modal = document.getElementById('templates-modal');
    if (!modal) {
        const colorMap = {
            rose: 'bg-rose-50 border-rose-200 text-rose-800',
            blue: 'bg-blue-50 border-blue-200 text-blue-800',
            amber: 'bg-amber-50 border-amber-200 text-amber-800',
            purple: 'bg-purple-50 border-purple-200 text-purple-800',
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
            slate: 'bg-slate-50 border-slate-300 text-slate-800'
        };
        const btnMap = {
            rose: 'bg-rose-600 hover:bg-rose-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
            amber: 'bg-amber-600 hover:bg-amber-700',
            purple: 'bg-purple-600 hover:bg-purple-700',
            emerald: 'bg-emerald-600 hover:bg-emerald-700',
            slate: 'bg-slate-600 hover:bg-slate-700'
        };
        modal = document.createElement('div');
        modal.id = 'templates-modal';
        modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden" style="max-height:90vh;display:flex;flex-direction:column">
                <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 flex-shrink-0">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <i data-lucide="layout-template" class="w-6 h-6"></i>
                            <div>
                                <h2 class="text-lg font-bold">RCEM Clinical Templates</h2>
                                <p class="text-xs text-amber-100">2025–2026 national QIP topics — pre-filled aims, measures & change ideas</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('templates-modal').remove()" class="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                <div class="overflow-y-auto p-6 space-y-4">
                    <p class="text-sm text-slate-600">Select a template to pre-fill your current project's aim statement, measures, and change ideas. <strong>Your existing data will not be overwritten</strong> unless a field is currently empty.</p>
                    ${CLINICAL_TEMPLATES.map(t => `
                    <div class="border-2 ${colorMap[t.color]||'border-slate-200 bg-slate-50'} rounded-xl p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 flex-wrap mb-1">
                                    <span class="font-bold text-sm">${t.title}</span>
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/70 border font-medium">${t.year}</span>
                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/70 border font-medium">${t.stage}</span>
                                </div>
                                <p class="text-xs leading-relaxed opacity-80">${t.description}</p>
                                <div class="mt-2 flex flex-wrap gap-1">
                                    ${t.changeIdeas.map(ci => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white/60 border opacity-80">${ci.title}</span>`).join('')}
                                </div>
                            </div>
                            <button onclick="window.applyTemplate('${t.id}')" class="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors ${btnMap[t.color]||'bg-slate-600 hover:bg-slate-700'}">
                                Apply
                            </button>
                        </div>
                    </div>`).join('')}
                </div>
                <div class="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button onclick="document.getElementById('templates-modal').remove()" class="w-full py-2 text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.applyTemplate = function(templateId) {
    const t = CLINICAL_TEMPLATES.find(x => x.id === templateId);
    if (!t) return;

    if (!state.projectData) {
        showToast('Open a project first to apply a template.', 'info');
        return;
    }

    const d = state.projectData;
    if (!d.checklist) d.checklist = {};

    // Apply checklist fields only if currently empty
    Object.entries(t.checklist).forEach(([k, v]) => {
        if (!d.checklist[k]) d.checklist[k] = v;
    });

    // Add change ideas (always adds — user can delete unwanted ones)
    if (!Array.isArray(d.changeIdeas)) d.changeIdeas = [];
    t.changeIdeas.forEach(ci => {
        d.changeIdeas.push({
            id: 'ci-tmpl-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            title: ci.title,
            description: ci.description,
            driverLink: '',
            status: 'planning',
            pdsaCycles: []
        });
    });

    // Sync flat pdsa
    d.pdsa = (d.changeIdeas || []).flatMap(idea => (idea.pdsaCycles || []));

    if (window.saveData) window.saveData();

    // Close modal and navigate
    const modal = document.getElementById('templates-modal');
    if (modal) modal.remove();

    showToast('Template applied — change ideas added and aim fields pre-filled where empty.', 'success');

    // Re-render current view
    const currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        const viewName = currentView.id.replace('view-', '');
        if (viewName === 'pdsa') { if (window.R?.renderPDSA) window.R.renderPDSA(); }
        else if (viewName === 'checklist') { if (window.R?.renderChecklist) window.R.renderChecklist(); }
    }
};

// ─── EM-QIAT Journal ─────────────────────────────────────────────────────────
const QI_JOURNEY_PHASES = [
    { id: 'creatingConditions', title: 'Creating Conditions', description: 'Securing organisational support, building relationships, establishing governance, and creating the conditions necessary for improvement work to begin.' },
    { id: 'understandingSystems', title: 'Understanding Systems', description: 'Mapping processes, collecting baseline data, conducting root cause analysis (driver diagrams, fishbone, 5 Whys), and understanding the problem from a systems perspective.' },
    { id: 'developingAims', title: 'Developing Aims', description: 'Writing a SMART aim, defining outcome, process, and balancing measures, and linking the aim to national standards and local context.' },
    { id: 'leadershipTeams', title: 'Leadership & Teams', description: 'Recruiting and engaging the improvement team, managing stakeholders, facilitating meetings, addressing resistance, and demonstrating leadership skills.' },
    { id: 'projectManagement', title: 'Project Management & Communication', description: 'Planning and running PDSA cycles, managing timelines, presenting progress to governance, and disseminating findings.' }
];
const RATING_LABELS = { 1: 'Awareness', 2: 'Understanding', 3: 'Ability', 4: 'Proficiency' };
const RATING_COLORS = { 1: 'bg-red-100 text-red-700', 2: 'bg-amber-100 text-amber-700', 3: 'bg-blue-100 text-blue-700', 4: 'bg-emerald-100 text-emerald-700' };
const LAT_DOMAINS = [
    { id: 'patientSafety', title: 'Patient Safety Culture', desc: 'Demonstrate leadership in promoting a culture of safety, openness, and learning from error.' },
    { id: 'teamCulture', title: 'Team Working & Culture', desc: 'Build and sustain effective teams, manage conflict, and support colleague development.' },
    { id: 'emotionalIntelligence', title: 'Emotional Intelligence', desc: 'Show self-awareness, empathy, and the ability to manage your own and others\' emotional responses under pressure.' },
    { id: 'strategicInfluence', title: 'Strategic Influence & Vision', desc: 'Communicate a clear vision, influence decision-makers, and align improvement work with organisational priorities.' },
    { id: 'serviceImprovement', title: 'Service Improvement Leadership', desc: 'Lead systematic improvement, facilitate change, and sustain new standards beyond the initial project.' }
];
const ED_LOG_TYPES = ['Regional QI Training Day', 'National QI Course', 'Online Module (e.g. IHI)', 'QI Conference', 'Departmental QI Meeting', 'Mentorship/Coaching', 'Self-Directed Learning', 'Other'];

window.showEMQIATModal = function() {
    const d = state.projectData;
    if (!d) { showToast('Open a project first', 'info'); return; }
    if (!d.emqiat) d.emqiat = {};
    const em = d.emqiat;
    if (!em.qiJourney) em.qiJourney = {};
    if (!Array.isArray(em.educationLog)) em.educationLog = [];
    if (!em.lat) em.lat = {};
    const isHigher = d.meta?.trainingStage === 'higher';
    let modal = document.getElementById('emqiat-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'emqiat-modal';
    modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto overflow-hidden" style="max-height:90vh;display:flex;flex-direction:column">
            <div class="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-5 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="file-badge" class="w-6 h-6"></i>
                        <div>
                            <h2 class="text-lg font-bold">PDP &amp; QI Journey Log</h2>
                            <p class="text-xs text-emerald-100">SLO 11 &amp; 12 development tracker — PDP goals, QI-journey maturity ratings, education log, and CCT summary. This feeds suggestions into the EM-QIAT form under “SLO 11 Sign-off”, but is a separate journal, not the sign-off form itself.</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('emqiat-modal').remove()" class="p-2 hover:bg-white/20 rounded-lg transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
            </div>
            <div class="overflow-y-auto p-6 space-y-6">
                <div class="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2"><i data-lucide="target" class="w-4 h-4 text-emerald-600"></i> QI Personal Development Plan</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Goals for This Year</label>
                            <textarea onchange="window.saveEMQIATField('pdpGoals', this.value)" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]" placeholder="What QI skills do you aim to develop this year?">${escapeHtml(em.pdpGoals||'')}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Review of Previous Year</label>
                            <textarea onchange="window.saveEMQIATField('pdpReview', this.value)" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]" placeholder="Reflect on last year — what did you achieve and what would you do differently?">${escapeHtml(em.pdpReview||'')}</textarea>
                        </div>
                    </div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2"><i data-lucide="map" class="w-4 h-4 text-blue-600"></i> QI Journey — Personal Involvement</h3>
                    <p class="text-xs text-slate-500 mb-4">Rate your involvement in each phase: 1 = Awareness | 2 = Understanding | 3 = Ability | 4 = Proficiency</p>
                    <div class="space-y-4">
                        ${QI_JOURNEY_PHASES.map(phase => {
                            const phData = em.qiJourney[phase.id] || { rating: 1, evidence: '' };
                            const rv = phData.rating || 1;
                            return `<div class="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                                <div class="flex items-start justify-between gap-4 mb-3">
                                    <div class="flex-1">
                                        <div class="font-bold text-sm text-slate-800 mb-0.5">${phase.title}</div>
                                        <p class="text-xs text-slate-500 leading-relaxed">${phase.description}</p>
                                    </div>
                                    <div class="flex-shrink-0 text-center">
                                        <select onchange="window.saveEMQIATJourney('${phase.id}', 'rating', parseInt(this.value))" class="text-xs border rounded px-2 py-1.5 bg-white font-bold">
                                            ${[1,2,3,4].map(v => `<option value="${v}" ${rv===v?'selected':''}>${v} — ${RATING_LABELS[v]}</option>`).join('')}
                                        </select>
                                        <div class="mt-1"><span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${RATING_COLORS[rv]}">${RATING_LABELS[rv]}</span></div>
                                    </div>
                                </div>
                                <textarea onchange="window.saveEMQIATJourney('${phase.id}', 'evidence', this.value)" class="w-full p-2 border border-slate-200 rounded text-xs min-h-[60px] bg-white" placeholder="Specific evidence of your involvement — actions taken, contributions, learning points...">${escapeHtml(phData.evidence||'')}</textarea>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-slate-800 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-purple-600"></i> QI Education Log</h3>
                        <button onclick="window.addEducationEntry()" class="text-xs bg-slate-800 text-white px-2.5 py-1.5 rounded flex items-center gap-1 hover:bg-slate-700"><i data-lucide="plus" class="w-3 h-3"></i> Add Activity</button>
                    </div>
                    <div id="education-log-list">
                        ${em.educationLog.length === 0 ? '<p class="text-xs text-slate-400 italic py-2">No QI education activities logged yet. Add courses, training days, conferences, and online modules.</p>' :
                        em.educationLog.map((entry, ei) => `
                        <div class="border border-slate-200 rounded-lg p-3 mb-2 bg-slate-50" id="edu-entry-${ei}">
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                <input type="date" value="${escapeHtml(entry.date||'')}" onchange="window.updateEducationEntry(${ei},'date',this.value)" class="p-1.5 border border-slate-200 rounded text-xs bg-white">
                                <select onchange="window.updateEducationEntry(${ei},'type',this.value)" class="p-1.5 border border-slate-200 rounded text-xs bg-white">${ED_LOG_TYPES.map(t => `<option value="${t}" ${entry.type===t?'selected':''}>${t}</option>`).join('')}</select>
                                <input type="text" value="${escapeHtml(entry.provider||'')}" placeholder="Provider / organisation" onchange="window.updateEducationEntry(${ei},'provider',this.value)" class="p-1.5 border border-slate-200 rounded text-xs bg-white">
                                <div class="flex gap-1 items-center">
                                    <input type="number" min="0" max="40" step="0.5" value="${escapeHtml(String(entry.hours||''))}" placeholder="Hrs" onchange="window.updateEducationEntry(${ei},'hours',this.value)" class="flex-1 p-1.5 border border-slate-200 rounded text-xs bg-white">
                                    <button onclick="window.deleteEducationEntry(${ei})" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                                </div>
                            </div>
                            <textarea onchange="window.updateEducationEntry(${ei},'reflection',this.value)" placeholder="Brief reflection on key learning..." class="w-full p-1.5 border border-slate-200 rounded text-xs min-h-[40px] bg-white">${escapeHtml(entry.reflection||'')}</textarea>
                        </div>`).join('')}
                    </div>
                </div>
                <div class="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2"><i data-lucide="award" class="w-4 h-4 text-amber-600"></i> Leadership Assessment — SLO 12 (LAT) <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold ml-1">August 2025 v1.5</span></h3>
                    <p class="text-xs text-slate-500 mb-4">Document evidence of your leadership development across each domain. Completed by your Educational Supervisor in Part B.</p>
                    <div class="space-y-3">
                        ${LAT_DOMAINS.map(dom => `
                        <div class="border border-slate-100 rounded-lg p-4">
                            <div class="font-bold text-sm text-slate-800 mb-0.5">${dom.title}</div>
                            <p class="text-xs text-slate-500 mb-2 leading-relaxed">${dom.desc}</p>
                            <textarea onchange="window.saveEMQIATLAT('${dom.id}', this.value)" class="w-full p-2 border border-slate-200 rounded text-xs min-h-[60px] bg-slate-50/50" placeholder="Evidence of your leadership in this domain...">${escapeHtml((em.lat||{})[dom.id]||'')}</textarea>
                        </div>`).join('')}
                    </div>
                </div>
                ${isHigher ? `
                <div class="bg-white border border-emerald-200 rounded-xl p-5">
                    <h3 class="font-bold text-slate-800 mb-1 flex items-center gap-2"><i data-lucide="graduation-cap" class="w-4 h-4 text-emerald-600"></i> CCT Journey Summary <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold ml-1">ST6 / CCT</span></h3>
                    <p class="text-xs text-slate-500 mb-3">Required at final ARCP. Reflect on your development as an improvement leader throughout training and your vision for continued QI leadership as a consultant.</p>
                    <textarea onchange="window.saveEMQIATField('cctSummary', this.value)" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[150px]" placeholder="Reflect on your progression across training stages, key learning moments, how you have changed practice, and how you will embed QI as a consultant...">${escapeHtml(em.cctSummary||'')}</textarea>
                </div>` : `
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p class="text-xs text-slate-400"><i data-lucide="lock" class="w-3 h-3 inline mr-1"></i> CCT Journey Summary is available for Higher Specialty Trainees (ST4–ST6). Set your training stage in project settings.</p>
                </div>`}
            </div>
            <div class="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <span class="text-xs text-slate-400">All changes auto-save to your project</span>
                <button onclick="document.getElementById('emqiat-modal').remove()" class="px-4 py-2 text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.saveEMQIATField = function(field, value) {
    const d = state.projectData; if (!d) return;
    if (!d.emqiat) d.emqiat = {};
    d.emqiat[field] = value;
    if (window.saveData) window.saveData();
};
window.saveEMQIATJourney = function(phase, field, value) {
    const d = state.projectData; if (!d) return;
    if (!d.emqiat) d.emqiat = {};
    if (!d.emqiat.qiJourney) d.emqiat.qiJourney = {};
    if (!d.emqiat.qiJourney[phase]) d.emqiat.qiJourney[phase] = { rating: 1, evidence: '' };
    d.emqiat.qiJourney[phase][field] = value;
    if (window.saveData) window.saveData();
};
window.saveEMQIATLAT = function(domain, value) {
    const d = state.projectData; if (!d) return;
    if (!d.emqiat) d.emqiat = {};
    if (!d.emqiat.lat) d.emqiat.lat = {};
    d.emqiat.lat[domain] = value;
    if (window.saveData) window.saveData();
};
window.addEducationEntry = function() {
    const d = state.projectData; if (!d) return;
    if (!d.emqiat) d.emqiat = {};
    if (!Array.isArray(d.emqiat.educationLog)) d.emqiat.educationLog = [];
    d.emqiat.educationLog.push({ date: '', type: ED_LOG_TYPES[0], provider: '', hours: '', reflection: '' });
    if (window.saveData) window.saveData();
    window.showEMQIATModal();
};
window.deleteEducationEntry = function(idx) {
    const d = state.projectData; if (!d?.emqiat?.educationLog) return;
    d.emqiat.educationLog.splice(idx, 1);
    if (window.saveData) window.saveData();
    window.showEMQIATModal();
};
window.updateEducationEntry = function(idx, field, value) {
    const d = state.projectData; if (!d?.emqiat?.educationLog?.[idx]) return;
    d.emqiat.educationLog[idx][field] = value;
    if (window.saveData) window.saveData();
};

// ─── FRCEM Submission Readiness Checker ──────────────────────────────────────
window.showFRCEMReadinessChecker = function() {
    const d = state.projectData;
    if (!d) { showToast('Open a project first', 'info'); return; }
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const changeIdeas = d.changeIdeas || [];
    const fmea = d.fmea || [];
    const swot = c.swot || {};
    const isHigher = d.meta?.trainingStage === 'higher';
    const wc2 = (text) => text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const totalWC = [c.problem_desc, c.problem_context, c.problem_evidence, c.aim, c.outcome_measure, c.process_measure, c.balance_measure, c.lit_review, c.results_analysis, c.learning_points, c.sustainability]
        .reduce((acc, t) => acc + wc2(t||''), 0);
    const domains = [
        { num:1, title:'Narrative Structure & Problem Analysis', icon:'file-text',
          sat: !!(c.problem_desc && c.lit_review),
          exc: !!(c.problem_desc && c.problem_context && c.problem_evidence && c.lit_review && (Object.values(swot).some(v=>v) || fmea.length>0)),
          satMissing: [!c.problem_desc && 'Problem statement', !c.lit_review && 'Literature review'].filter(Boolean),
          excMissing: [!c.problem_context && 'Department context', !c.problem_evidence && 'Baseline evidence', (!Object.values(swot).some(v=>v) && fmea.length===0) && 'SWOT/PEST or FMEA analysis'].filter(Boolean),
          wc: wc2(c.problem_desc||'') + wc2(c.problem_context||'') + wc2(c.problem_evidence||'') + wc2(c.lit_review||'') },
        { num:2, title:'Team Engagement & Stakeholders', icon:'users',
          sat: !!(d.teamMembers?.length >= 1),
          exc: !!(d.teamMembers?.length >= 2 && d.stakeholders?.length >= 2),
          satMissing: [(d.teamMembers?.length||0)<1 && 'At least 1 team member defined'].filter(Boolean),
          excMissing: [(d.teamMembers?.length||0)<2 && '2+ team members', (d.stakeholders?.length||0)<2 && '2+ stakeholders mapped on matrix'].filter(Boolean),
          wc: 0 },
        { num:3, title:'SMART Aim & Family of Measures', icon:'target',
          sat: !!(c.aim && c.outcome_measure),
          exc: !!(c.aim && c.outcome_measure && c.process_measure && c.balance_measure && c.aim_target),
          satMissing: [!c.aim && 'SMART aim', !c.outcome_measure && 'Outcome measure'].filter(Boolean),
          excMissing: [!c.process_measure && 'Process measure', !c.balance_measure && 'Balancing measure', !c.aim_target && 'Numeric aim target on chart'].filter(Boolean),
          wc: wc2(c.aim||'') + wc2(c.outcome_measure||'') + wc2(c.process_measure||'') + wc2(c.balance_measure||'') },
        { num:4, title:'Change Management & PDSA Cycles', icon:'refresh-cw',
          sat: !!(pdsa.length >= 2),
          exc: !!(pdsa.length >= 3 && changeIdeas.length >= 1),
          satMissing: [pdsa.length<2 && ('At least 2 PDSA cycles (you have '+pdsa.length+')')].filter(Boolean),
          excMissing: [pdsa.length<3 && ('3+ iterative PDSA cycles (you have '+pdsa.length+')'), changeIdeas.length<1 && 'Structured change ideas defined'].filter(Boolean),
          wc: pdsa.reduce((acc,p) => acc + wc2(p.plan||p.desc||'') + wc2(p.study||'') + wc2(p.act||''), 0) },
        { num:5, title:'Data Collection & Run Chart', icon:'bar-chart-2',
          sat: !!((getPrimaryMeasure(d)?.chartData?.length||0) >= 8),
          exc: !!((getPrimaryMeasure(d)?.chartData?.length||0) >= 12 && c.results_analysis && (d.chartEvents?.length||0) >= 1),
          satMissing: [(getPrimaryMeasure(d)?.chartData?.length||0)<8 && ('8+ data points (you have '+(getPrimaryMeasure(d)?.chartData?.length||0)+')')].filter(Boolean),
          excMissing: [(getPrimaryMeasure(d)?.chartData?.length||0)<12 && ('12+ data points (you have '+(getPrimaryMeasure(d)?.chartData?.length||0)+')'), !c.results_analysis && 'Results analysis narrative', !(d.chartEvents?.length>=1) && 'Chart event markers annotating interventions'].filter(Boolean),
          wc: wc2(c.results_analysis||'') },
        { num:6, title:'Reflection & Sustainability', icon:'lightbulb',
          sat: !!(c.learning_points && c.sustainability),
          exc: !!(c.learning_points && c.sustainability && (c.spreadPlan?.whoAdopts || c.spreadPlan?.maintenancePlan)),
          satMissing: [!c.learning_points && 'Key learning points', !c.sustainability && 'Sustainability plan summary'].filter(Boolean),
          excMissing: [!(c.spreadPlan?.whoAdopts || c.spreadPlan?.maintenancePlan) && 'Structured spread & sustainability plan completed'].filter(Boolean),
          wc: wc2(c.learning_points||'') + wc2(c.sustainability||'') },
        { num:7, title:'Ethics & Governance', icon:'shield-check',
          sat: !!(c.ethics),
          exc: !!(c.ethics && Object.keys(c.hraChecklist||{}).length >= 4),
          satMissing: [!c.ethics && 'Governance / ethics documentation'].filter(Boolean),
          excMissing: [Object.keys(c.hraChecklist||{}).length<4 && 'HRA checklist fully completed (all 4 questions)'].filter(Boolean),
          wc: wc2(c.ethics||'') },
        { num:8, title:'References & Formatting', icon:'bookmark',
          sat: !!((c.referencesList?.length||0) >= 3),
          exc: !!((c.referencesList?.length||0) >= 5),
          satMissing: [(c.referencesList?.length||0)<3 && ('3+ Vancouver references (you have '+(c.referencesList?.length||0)+')')].filter(Boolean),
          excMissing: [(c.referencesList?.length||0)<5 && ('5+ Vancouver references (you have '+(c.referencesList?.length||0)+')')].filter(Boolean),
          wc: 0 }
    ];
    const metSat = domains.filter(x => x.sat).length;
    const metExc = domains.filter(x => x.exc).length;
    const wcTarget = isHigher ? { min: 3000, max: 4000 } : { min: 2000, max: 3000 };
    const wcColor = totalWC < wcTarget.min ? 'text-amber-600' : totalWC > wcTarget.max ? 'text-red-600' : 'text-emerald-600';
    let modal = document.getElementById('frcem-readiness-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'frcem-readiness-modal';
    modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden" style="max-height:90vh;display:flex;flex-direction:column">
            <div class="bg-gradient-to-r from-rcem-purple to-indigo-700 text-white px-6 py-5 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i data-lucide="clipboard-check" class="w-6 h-6"></i>
                        <div>
                            <h2 class="text-lg font-bold">FRCEM Submission Readiness</h2>
                            <p class="text-xs text-indigo-200">8-domain assessment against Satisfactory and Excellent criteria</p>
                        </div>
                    </div>
                    <button onclick="document.getElementById('frcem-readiness-modal').remove()" class="p-2 hover:bg-white/20 rounded-lg"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
            </div>
            <div class="overflow-y-auto p-6 space-y-4">
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                        <div class="text-3xl font-black text-amber-600">${metSat}/8</div>
                        <div class="text-xs text-amber-700 font-bold mt-1">Satisfactory Domains</div>
                    </div>
                    <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <div class="text-3xl font-black text-emerald-600">${metExc}/8</div>
                        <div class="text-xs text-emerald-700 font-bold mt-1">Excellent Domains</div>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <div class="text-3xl font-black ${wcColor}">${totalWC}</div>
                        <div class="text-xs text-slate-600 font-bold mt-1">Est. Words (target ${wcTarget.min}–${wcTarget.max})</div>
                    </div>
                </div>
                ${domains.map(dom => {
                    const isExc = dom.exc;
                    const isSat = dom.sat && !dom.exc;
                    const ragBg = isExc ? 'bg-emerald-50 border-emerald-200' : isSat ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                    const ragText = isExc ? 'text-emerald-700' : isSat ? 'text-amber-700' : 'text-red-700';
                    const ragLabel = isExc ? 'Excellent' : isSat ? 'Satisfactory' : 'Not Yet';
                    const ragBadge = isExc ? 'bg-emerald-100 text-emerald-700' : isSat ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                    const missing = isExc ? [] : isSat ? dom.excMissing : [...dom.satMissing, ...dom.excMissing];
                    return `<div class="border ${ragBg} rounded-xl p-4">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <span class="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-xs font-black ${ragText}">${dom.num}</span>
                                <i data-lucide="${dom.icon}" class="w-4 h-4 ${ragText}"></i>
                                <span class="font-bold text-sm text-slate-800">${dom.title}</span>
                            </div>
                            <span class="text-xs px-2 py-0.5 rounded-full font-bold ${ragBadge}">${ragLabel}</span>
                        </div>
                        ${dom.wc > 0 ? `<div class="text-xs text-slate-400 mb-2">~${dom.wc} words in this section</div>` : ''}
                        ${missing.length > 0 ? `<div class="space-y-1">${missing.map(item => `<div class="flex items-center gap-1.5 text-xs ${ragText}"><i data-lucide="alert-circle" class="w-3 h-3 flex-shrink-0"></i>${item}</div>`).join('')}</div>` : `<div class="flex items-center gap-1.5 text-xs text-emerald-600"><i data-lucide="check-circle" class="w-3 h-3"></i>All criteria met</div>`}
                    </div>`;
                }).join('')}
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 class="font-bold text-sm text-blue-800 mb-3 flex items-center gap-2"><i data-lucide="type" class="w-4 h-4"></i> Formatting Checklist</h4>
                    <div class="space-y-1 text-xs text-blue-700">
                        <div>✓ Word count: 3,000–4,000 words (Higher Training)</div>
                        <div>✓ Font: 11pt Arial or Times New Roman, double-spaced</div>
                        <div>✓ Referencing: Vancouver format throughout</div>
                        <div>✓ All PDSA cycles include a written prediction in the Plan section</div>
                        <div>✓ Run chart annotated at the point changes were introduced</div>
                    </div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
                    This checks the same underlying project data as the Dashboard's "Portfolio Readiness" card and the
                    <button onclick="document.getElementById('frcem-readiness-modal').remove(); window.openGoldenThreadValidator()" class="font-bold text-rcem-purple hover:underline">Golden Thread Validator</button>,
                    just broken down against the 8 FRCEM marking domains specifically. For the real EM-QIAT (2025 Update) form your supervisor signs off on, see
                    <button onclick="document.getElementById('frcem-readiness-modal').remove(); window.router('supervisor')" class="font-bold text-rcem-purple hover:underline">SLO 11 Sign-off</button>.
                </div>
            </div>
            <div class="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50">
                <button onclick="document.getElementById('frcem-readiness-modal').remove()" class="w-full py-2 text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ─── Chart Event Markers ──────────────────────────────────────────────────────
window.showEventMarkersPanel = function() {
    const d = state.projectData; if (!d) return;
    if (!Array.isArray(d.chartEvents)) d.chartEvents = [];
    let modal = document.getElementById('chart-events-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'chart-events-modal';
    modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto">
            <div class="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
                <div class="flex items-center gap-2"><i data-lucide="flag" class="w-5 h-5"></i><span class="font-bold">Chart Event Markers</span></div>
                <button onclick="document.getElementById('chart-events-modal').remove()" class="p-1.5 hover:bg-white/20 rounded-lg"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="p-5">
                <p class="text-xs text-slate-500 mb-4">Annotate your run chart at the exact point a change was introduced. These appear as coloured vertical lines — distinct from the PDSA phase markers already shown.</p>
                <div class="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4 readonly-hide">
                    <div class="font-bold text-sm text-teal-800 mb-3">Add New Marker</div>
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="text-xs font-medium text-slate-600 mb-1 block">Date</label>
                            <input type="date" id="em-date" class="w-full p-2 border border-slate-300 rounded text-xs bg-white">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-600 mb-1 block">Colour</label>
                            <select id="em-color" class="w-full p-2 border border-slate-300 rounded text-xs bg-white">
                                <option value="#14b8a6">Teal — change introduced</option>
                                <option value="#6366f1">Indigo — milestone</option>
                                <option value="#ef4444">Red — adverse event</option>
                                <option value="#f59e0b">Amber — pause/review</option>
                            </select>
                        </div>
                    </div>
                    <input type="text" id="em-label" placeholder="Label (e.g. New proforma launched)" class="w-full p-2 border border-slate-300 rounded text-xs bg-white mb-3">
                    <button onclick="window.addEventMarker()" class="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-xs font-bold">Add to Chart</button>
                </div>
                <div id="event-markers-list">
                    ${d.chartEvents.length === 0 ? '<p class="text-xs text-slate-400 italic text-center py-2">No custom markers yet</p>' :
                    d.chartEvents.map((ev, i) => `
                    <div class="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${escapeHtml(String(ev.color || "#14b8a6"))}"></span>
                        <span class="text-xs font-mono text-slate-500 flex-shrink-0">${escapeHtml(formatUkDate(ev.date))}</span>
                        <span class="text-xs text-slate-700 flex-1 truncate">${escapeHtml(ev.label)}</span>
                        <button onclick="window.deleteEventMarker(${i})" class="text-red-400 hover:text-red-600 flex-shrink-0 readonly-hide"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                    </div>`).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
window.addEventMarker = function() {
    const d = state.projectData; if (!d) return;
    const date = document.getElementById('em-date')?.value;
    const label = document.getElementById('em-label')?.value?.trim();
    const color = document.getElementById('em-color')?.value || '#14b8a6';
    if (!date || !label) { showToast('Date and label are both required', 'error'); return; }
    if (!Array.isArray(d.chartEvents)) d.chartEvents = [];
    d.chartEvents.push({ id: Date.now().toString(), date, label, color });
    d.chartEvents.sort((a, b) => a.date.localeCompare(b.date));
    if (window.saveData) window.saveData();
    if (window.renderChart) window.renderChart();
    window.showEventMarkersPanel();
    showToast('Marker added', 'success');
};
window.deleteEventMarker = function(idx) {
    const d = state.projectData; if (!d?.chartEvents) return;
    d.chartEvents.splice(idx, 1);
    if (window.saveData) window.saveData();
    if (window.renderChart) window.renderChart();
    window.showEventMarkersPanel();
    showToast('Marker removed', 'success');
};

// ─── Project Snapshots ────────────────────────────────────────────────────────
window.takeProjectSnapshot = function(label) {
    const d = state.projectData; if (!d) return;
    if (!Array.isArray(d.snapshots)) d.snapshots = [];
    if (d.snapshots.length >= 10) d.snapshots.shift();
    const snapLabel = label || ('Snapshot — ' + new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }));
    d.snapshots.push({ id: Date.now().toString(), label: snapLabel, timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify({ checklist: d.checklist, changeIdeas: d.changeIdeas, pdsa: d.pdsa, chartData: d.chartData,
            measures: d.measures, activeMeasureId: d.activeMeasureId })) }); // measures/activeMeasureId captured so multi-measure projects restore fully, not just the active measure
    if (window.saveData) window.saveData();
    showToast('Snapshot saved: ' + snapLabel, 'success');
};
window.showSnapshotHistory = function() {
    const d = state.projectData; if (!d) return;
    const snaps = d.snapshots || [];
    let modal = document.getElementById('snapshots-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'snapshots-modal';
    modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto">
            <div class="bg-gradient-to-r from-slate-700 to-slate-900 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
                <div class="flex items-center gap-2"><i data-lucide="history" class="w-5 h-5"></i><span class="font-bold">Version History</span></div>
                <button onclick="document.getElementById('snapshots-modal').remove()" class="p-1.5 hover:bg-white/20 rounded-lg"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="p-5">
                <div class="flex justify-between items-center mb-4">
                    <p class="text-xs text-slate-500">${snaps.length} saved snapshot${snaps.length!==1?'s':''} (max 10 stored)</p>
                    <button onclick="window.takeProjectSnapshot(); window.showSnapshotHistory();" class="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 hover:bg-slate-700"><i data-lucide="camera" class="w-3 h-3"></i> Save Now</button>
                </div>
                ${snaps.length === 0 ? '<p class="text-xs text-slate-400 italic text-center py-6">No snapshots yet. Save a snapshot before making major changes to preserve a restore point.</p>' :
                `<div class="space-y-2 max-h-[50vh] overflow-y-auto">${[...snaps].reverse().map((snap, ri) => {
                    const actualIdx = snaps.length - 1 - ri;
                    const ts = new Date(snap.timestamp).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
                    return `<div class="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-2">
                        <div class="flex-1"><div class="font-bold text-sm text-slate-800">${escapeHtml(snap.label)}</div><div class="text-xs text-slate-400">${ts}</div></div>
                        <div class="flex gap-2">
                            <button onclick="window.restoreSnapshot(${actualIdx})" class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold">Restore</button>
                            <button onclick="window.deleteSnapshot(${actualIdx})" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>`;
                }).join('')}</div>`}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
window.restoreSnapshot = function(idx) {
    const d = state.projectData; if (!d?.snapshots?.[idx]) return;
    window.showConfirmDialog('Restore snapshot "' + d.snapshots[idx].label + '"? This will overwrite your current checklist, PDSA cycles, change ideas, and chart data.', () => {
        const snap = d.snapshots[idx].data;
        if (snap.checklist) d.checklist = JSON.parse(JSON.stringify(snap.checklist));
        if (snap.changeIdeas) d.changeIdeas = JSON.parse(JSON.stringify(snap.changeIdeas));
        if (snap.pdsa) d.pdsa = JSON.parse(JSON.stringify(snap.pdsa));
        if (Array.isArray(snap.measures) && snap.measures.length > 0) {
            // Newer snapshot: restore ALL measures, not just the active one.
            d.measures = JSON.parse(JSON.stringify(snap.measures));
            d.activeMeasureId = snap.activeMeasureId && d.measures.some(m => m.id === snap.activeMeasureId)
                ? snap.activeMeasureId : d.measures[0].id;
            const active = d.measures.find(m => m.id === d.activeMeasureId) || d.measures[0];
            d.chartData = active.chartData;
            d.chartSettings = active.chartSettings;
        } else if (snap.chartData) {
            // Older snapshot taken before multi-measure existed: restore into
            // the currently active measure only, keeping references in sync.
            d.chartData = JSON.parse(JSON.stringify(snap.chartData));
            if (Array.isArray(d.measures) && d.measures.length > 0) {
                const active = d.measures.find(m => m.id === d.activeMeasureId) || d.measures[0];
                active.chartData = d.chartData;
            }
        }
        if (window.saveData) window.saveData();
        document.getElementById('snapshots-modal')?.remove();
        if (window.R?.renderAll) window.R.renderAll('dashboard');
        showToast('Snapshot restored', 'success');
    }, 'Restore', 'Restore Snapshot');
};
window.deleteSnapshot = function(idx) {
    const d = state.projectData; if (!d?.snapshots) return;
    d.snapshots.splice(idx, 1);
    if (window.saveData) window.saveData();
    window.showSnapshotHistory();
};

// ─── SWOT / PEST helpers ──────────────────────────────────────────────────────
window.saveSWOTField = function(field, value) {
    const d = state.projectData; if (!d) return;
    if (!d.checklist.swot) d.checklist.swot = {};
    d.checklist.swot[field] = value; if (window.saveData) window.saveData();
};
window.savePESTField = function(field, value) {
    const d = state.projectData; if (!d) return;
    if (!d.checklist.pest) d.checklist.pest = {};
    d.checklist.pest[field] = value; if (window.saveData) window.saveData();
};
window.setSWOTMode = function(mode) {
    const d = state.projectData; if (!d) return;
    if (!d.checklist) d.checklist = {};
    d.checklist.swotMode = mode;
    window.saveViewChoice();
    // Show the chosen grid and restyle the two buttons in place.
    document.getElementById('swot-grid')?.classList.toggle('hidden', mode !== 'swot');
    document.getElementById('pest-grid')?.classList.toggle('hidden', mode !== 'pest');
    document.querySelectorAll('button[onclick^="window.setSWOTMode"]').forEach(btn => {
        const on = btn.getAttribute('onclick').includes(`'${mode}'`);
        btn.classList.toggle('bg-indigo-600', on); btn.classList.toggle('text-white', on); btn.classList.toggle('border-indigo-600', on);
        btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-slate-600', !on); btn.classList.toggle('border-slate-300', !on);
    });
};
window.toggleSWOTPESTPanel = function() {
    const content = document.getElementById('swot-pest-body');
    const chevron = document.getElementById('swot-chevron');
    const d = state.projectData;
    if (content) {
        content.classList.toggle('hidden');
        const open = !content.classList.contains('hidden');
        if (d) { if (!d.checklist) d.checklist = {}; d.checklist.swotOpen = open; window.saveViewChoice(); }
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
    }
};
// ─── FMEA helpers ────────────────────────────────────────────────────────────
window.addFMEARow = function() {
    const d = state.projectData; if (!d) return;
    if (!Array.isArray(d.fmea)) d.fmea = [];
    d.fmea.push({ step:'', failureMode:'', effect:'', likelihood:1, severity:1, detectability:1, mitigation:'' });
    if (window.saveData) window.saveData();
    if (window.R?.renderChecklist) window.R.renderChecklist();
};
window.deleteFMEARow = function(idx) {
    const d = state.projectData; if (!d?.fmea) return;
    d.fmea.splice(idx, 1);
    if (window.saveData) window.saveData();
    if (window.R?.renderChecklist) window.R.renderChecklist();
};
window.updateFMEARow = function(idx, field, value) {
    const d = state.projectData; if (!d?.fmea?.[idx]) return;
    d.fmea[idx][field] = value;
    if (['likelihood','severity','detectability'].includes(field)) {
        const row = d.fmea[idx];
        const rpn = (row.likelihood||1) * (row.severity||1) * (row.detectability||1);
        const el = document.querySelector(`#fmea-table-body tr:nth-child(${idx+1}) .rpn-badge`);
        if (el) {
            el.textContent = rpn;
            el.className = 'rpn-badge px-2 py-0.5 rounded ' + (rpn>=50 ? 'bg-red-100 text-red-800 font-black' : rpn>=20 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-emerald-100 text-emerald-800');
        }
    }
    if (window.saveData) window.saveData();
};
// Spread planner helper
window.saveSpreadField = function(field, value) {
    const d = state.projectData; if (!d) return;
    if (!d.checklist.spreadPlan) d.checklist.spreadPlan = {};
    d.checklist.spreadPlan[field] = value; if (window.saveData) window.saveData();
};

window.showHowTo = function() {
    const m = document.getElementById('howto-modal');
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.howtoNav = function(view) {
    window.closeHowTo();
    if (state.projectData) {
        window.router(view);
    } else {
        showToast('Open a project first to navigate there.', 'info');
    }
};

window.closeHowTo = function() {
    const m = document.getElementById('howto-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    const cb = document.getElementById('howto-dont-show');
    if (cb && cb.checked) safeStorage.set('qip_howto_seen', '1');
};

window.returnToProjects = () => {
    leaveProjectContext();
    window.switchToOwnProjects();

    if (state.isMasterAdmin) {
        loadMasterAdminDashboard();
    } else {
        loadProjectList();
    }
};

window.exportProjectToFile = function() {
    if (!state.projectData) { showToast("No data to export", "error"); return; }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.projectData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const date = new Date().toISOString().slice(0,10);
    const cleanTitle = (state.projectData.meta.title || "QIP").replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAnchorNode.setAttribute("download", `qip_backup_${cleanTitle}_${date}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("Project saved to Downloads", "success");
}

window.triggerImportProject = function() {
    document.getElementById('project-upload-input').click();
}

window.importProjectFromFile = async function(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    let json;
    try {
        const text = await file.text();
        json = JSON.parse(text);
        if (!json.meta || !json.checklist) throw new Error('Invalid QIP file — missing meta or checklist');
    } catch (err) {
        console.error(err);
        showToast('Failed to read file: ' + err.message, 'error');
        return;
    }

    // If no project is currently open, create a new Firestore doc first so data persists
    if (!state.currentProjectId && state.currentUser && db) {
        try {
            const docRef = await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), json);
            state.currentProjectId = docRef.id;
            state.projectData = json;
            migrateProjectData(state.projectData);
            const topBar = document.getElementById('top-bar');
            if (topBar) topBar.classList.remove('hidden');
            window.router('dashboard');
            showToast('Project imported successfully', 'success');
        } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
        }
        return;
    }

    // Project already open — overwrite it in place
    state.projectData = json;
    migrateProjectData(state.projectData);
    window.saveData(true);
    window.router('dashboard');
    showToast('Project imported and saved', 'success');
}

window.openGlobalSettings = () => {
    const el = document.getElementById('settings-ai-key');
    if (el) el.value = state.aiKey || '';
    // Hide roles section for demo mode / admin
    const rolesSection = document.getElementById('settings-roles-section');
    if (rolesSection) {
        rolesSection.classList.toggle('hidden', state.isDemoMode || state.isMasterAdmin || !state.currentUser);
    }
    // Show project access section when a project is loaded and user is not admin
    const accessSection = document.getElementById('project-access-section');
    if (accessSection) {
        const show = !state.isMasterAdmin && !state.isDemoMode && state.currentUser && state.currentProjectId;
        accessSection.classList.toggle('hidden', !show);
        if (show) loadProjectAccessIntoSettings();
    }
    const modal = document.getElementById('global-settings-modal');
    if (modal) modal.classList.remove('hidden');
    // Load current roles for logged-in normal users
    if (state.currentUser && !state.isDemoMode && !state.isMasterAdmin) {
        loadRolesIntoSettings();
    }
};

window.saveGlobalSettings = () => {
    const key = document.getElementById('settings-ai-key').value.trim();
    state.aiKey = key;
    if(key) {
        safeStorage.set('rcem_qip_ai_key', key);
        showToast("Settings saved. AI features enabled.", "success");
    } else {
        safeStorage.remove('rcem_qip_ai_key');
        showToast("Settings saved. AI features disabled.", "info");
    }
    document.getElementById('global-settings-modal').classList.add('hidden');
    
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        window.router(viewName);
    }
};

window.toggleKeyVis = () => {
    const input = document.getElementById('settings-ai-key');
    if(input) input.type = input.type === 'password' ? 'text' : 'password';
};

window.hasAI = () => !!state.aiKey;

// Shared by the AI helpers: sets a button's busy label and always restores it.
async function withAIButton(btnId, busyLabel, idleHTML, fn) {
    const btn = btnId ? document.getElementById(btnId) : null;
    if (btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> ${busyLabel}`; }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    try { return await fn(); }
    finally {
        const b = btnId ? document.getElementById(btnId) : null; // may have been re-rendered
        if (b) { b.disabled = false; b.innerHTML = idleHTML; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Asks before AI text replaces something the user has already written.
function confirmAIReplace(hasExisting, what, apply) {
    if (!hasExisting) { apply(); return; }
    window.showConfirmDialog(`Replace your current ${what} with the AI suggestion? You can press Undo afterwards if you change your mind.`, apply, 'Replace', 'Use AI suggestion?');
}

const aiStrings = (v, max) => Array.isArray(v)
    ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, max)
    : [];

window.aiRefineAim = async () => {
    if (!state.projectData || state.isReadOnly) return;
    const d = state.projectData.checklist || (state.projectData.checklist = {});
    if (!d.problem_desc && !d.aim) { showToast("Enter a problem or draft aim first", "error"); return; }
    await withAIButton('btn-ai-aim', 'Refining...', `<i data-lucide="sparkles" class="w-3 h-3"></i> Refine Aim`, async () => {
        const prompt = `
        Context: Quality Improvement in Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Draft Aim: "${d.aim || 'Not defined'}"
        Task: Rewrite the aim to be strictly SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
        Keep any numbers, dates and targets the user has given; do not invent new baseline figures.
        Keep it under 35 words. Return ONLY the aim statement text, no quotes.
    `;
        const result = await callAI(prompt);
        const aim = typeof result === 'string' ? result.trim().replace(/^["“]|["”]$/g, '') : '';
        if (!aim) return;
        confirmAIReplace(!!(d.aim || '').trim(), 'aim', () => {
            state.projectData.checklist.aim = aim;
            window.saveData();
            R.renderChecklist();
            showToast("Aim refined by AI — check it still says what you mean", "success");
        });
    });
};

window.aiSuggestDrivers = async () => {
    if (!state.projectData || state.isReadOnly) return;
    const d = state.projectData.checklist || {};
    if (!d.aim) { showToast("Define an Aim first", "error"); return; }
    await withAIButton('btn-ai-driver', 'Generating...', `<i data-lucide="sparkles" class="w-3 h-3"></i> Auto-Generate`, async () => {
        const prompt = `
        The QIP Aim is: "${d.aim}".
        Problem Context: "${d.problem_desc || 'Not defined'}".
        Task: Generate a Driver Diagram structure in JSON format.
        Schema: { "primary": ["string"], "secondary": ["string"], "changes": ["string"] }
        Requirements: 3-4 Primary Drivers, 4-6 Secondary Drivers, 5-8 Specific Change Ideas.
    `;
        const result = await callAI(prompt, true);
        const drivers = {
            primary: aiStrings(result?.primary, 8),
            secondary: aiStrings(result?.secondary, 12),
            changes: aiStrings(result?.changes, 15)
        };
        if (!drivers.primary.length) { if (result) showToast("The AI reply wasn't a usable driver diagram — please try again.", "error"); return; }
        const cur = state.projectData.drivers || {};
        const hasExisting = ['primary', 'secondary', 'changes'].some(k => (cur[k] || []).length);
        confirmAIReplace(hasExisting, 'driver diagram', () => {
            state.projectData.drivers = drivers;
            window.saveData();
            window.renderTools();
            showToast("Driver Diagram generated — edit it to fit your department", "success");
        });
    });
};

window.aiGeneratePDSA = async () => {
    if (!state.projectData || state.isReadOnly) return;
    const titleEl = document.getElementById('ci-new-title');
    const descEl = document.getElementById('ci-new-desc');
    if (!titleEl || !descEl) return;
    const title = titleEl.value.trim();
    if (!title) { showToast("Enter a title for the change idea first", "error"); titleEl.focus(); return; }
    const d = state.projectData.checklist || {};
    await withAIButton('btn-ai-pdsa', 'Drafting...', `<i data-lucide="sparkles" class="w-4 h-4"></i> AI Draft Idea`, async () => {
        const prompt = `
        Project Aim: "${d.aim || 'Not defined'}".
        Change idea: "${title}".
        Task: Describe this change idea for a PDSA-tested QI project, and plan a small first test of it.
        Return JSON format: { "description": "What the change is and why it should help (2 sentences)", "firstTest": "Who, where, when and how big the first small test is (1-2 sentences)", "prediction": "What we predict will happen, stated so the data can prove it right or wrong (1 sentence)" }
    `;
        const result = await callAI(prompt, true);
        const parts = result && typeof result === 'object'
            ? [result.description, result.firstTest && `First test: ${result.firstTest}`, result.prediction && `Prediction: ${result.prediction}`].filter(x => typeof x === 'string' && x.trim())
            : [];
        if (!parts.length) { if (result) showToast("The AI reply wasn't usable — please try again.", "error"); return; }
        const text = parts.join('\n\n');
        const el = document.getElementById('ci-new-desc');
        if (!el) return;
        confirmAIReplace(!!el.value.trim(), 'description', () => {
            el.value = text;
            showToast("Idea drafted — review it, then press Add Change Idea", "success");
        });
    });
};

window.aiAnalyseChart = async () => {
    if (!state.projectData || state.isReadOnly) return;
    const pts = (state.projectData.chartData || [])
        .filter(p => p && p.date && p.value !== '' && p.value !== null && !isNaN(Number(p.value)))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (pts.length < 5) { showToast("Need at least 5 data points", "error"); return; }
    await withAIButton('btn-ai-chart', 'Analysing...', `<i data-lucide="sparkles" class="w-3 h-3"></i> AI Analyse`, async () => {
        // Give the AI the app's own run-chart analysis so its narrative matches the chart.
        const values = pts.map(p => Number(p.value));
        const base = chooseBaseline(pts, state.projectData.pdsa);
        const med = median(base.values);
        const sig = runChartSignals(values, med);
        const measures = state.projectData.measures || [];
        const measure = measures.find(m => m.chartData === state.projectData.chartData) || measures[0] || {};
        const dataStr = pts.map(p => `${p.date}:${p.value}${p.grade ? ` (${p.grade})` : ''}`).join(', ');
        const prompt = `
        Aim: "${state.projectData.checklist?.aim || 'Not defined'}".
        Measure: "${measure.name || state.projectData.checklist?.outcome_measure || 'Not stated'}"${measure.unit ? `, unit ${measure.unit}` : ''}. Work out from the aim whether higher or lower values are better.
        Data (Date:Value (phase)): [${dataStr}].
        The app's run chart analysis (use these facts; do not recalculate or contradict them):
        - Baseline median: ${med === null ? 'not available' : med} (from ${base.count} baseline points).
        - Shift (6+ consecutive points one side of the median): ${sig.shift ? 'present' : 'none'}.
        - Trend (5+ consecutive points rising or falling): ${sig.trend ? 'present' : 'none'}.
        - Possible astronomical point: ${sig.astronomical ? 'present' : 'none'}.
        Task: Write a short paragraph for the "Results" section describing what the run chart shows, using only the facts above.
        Say whether there is evidence of improvement (a non-random signal in the right direction), and if not, say so plainly.
    `;
        const result = await callAI(prompt);
        const text = typeof result === 'string' ? result.trim() : '';
        if (!text) return;
        const box = document.getElementById('results-text');
        confirmAIReplace(!!(state.projectData.checklist?.results_analysis || '').trim(), 'results text', () => {
            if (box) box.value = text;
            window.saveResults(text);
            showToast("Analysis added — check it against your chart", "success");
        });
    });
};

window.aiSuggestEvidence = async () => {
    if (!state.projectData || state.isReadOnly) return;
    const d = state.projectData.checklist || (state.projectData.checklist = {});
    if (!d.problem_desc && !d.aim) { showToast("Define a problem or aim first", "error"); return; }
    const prompt = `
        Context: Quality Improvement in UK Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Aim: "${d.aim || 'Not defined'}"
        Task: Suggest the kinds of evidence, guidelines and standards this QIP should draw on
        (e.g. relevant NICE guidance, RCEM standards or best practice guidance, CQC expectations, published research).
        Only name a specific guideline or paper if you are confident it exists; never invent titles, authors, years or numbers.
        Where unsure, describe what to search for instead.
        Format as a brief paragraph suitable for a literature review section. Keep under 150 words.
    `;
    const result = await callAI(prompt);
    const text = typeof result === 'string' ? result.trim() : '';
    if (!text) return;
    const existing = d.lit_review || '';
    const block = '[AI suggestions — check every source exists and says this before citing it]\n' + text;
    state.projectData.checklist.lit_review = existing ? existing + '\n\n' + block : block;
    window.saveData();
    R.renderChecklist();
    showToast("Evidence suggestions added — verify each source before citing", "success");
};

window.exportPPTX = exportPPTX;
window.printPoster = printPoster;
window.printPosterOnly = printPosterOnly;
window.openPortfolioExport = R.openPortfolioExport;
window.exportToKaizen = exportToKaizen;

window.addDataPoint = addDataPoint;
window.deleteDataPoint = deleteDataPoint;
window.downloadCSVTemplate = downloadCSVTemplate;
window.importCSV = importCSV;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.renderDataView = R.renderDataView;
window.renderChart = renderChart;

window.setChartMode = setChartMode;
window.updateChartEducation = updateChartEducation;
window.openChartSettings = openChartSettings;
window.saveChartSettings = saveChartSettings;
window.copyChartImage = copyChartImage;
window.downloadChartPNG = downloadChartPNG;
window.exportGanttPNG = exportGanttPNG;
window.exportGanttPDF = exportGanttPDF;
window.exportDiagramPNG = exportDiagramPNG;
window.exportDiagramSVG = exportDiagramSVG;
window.exportStakeholderPNG = exportStakeholderPNG;
window.renderFullViewChart = renderFullViewChart;

window.setToolMode = setToolMode;
window.toggleToolList = R.toggleToolList;
window.toggleToolHelp = toggleToolHelp;
window.resetProcess = resetProcess;
window.updateFishCat = R.updateFishCat;
window.updateFishCause = R.updateFishCause;
window.addFishCause = R.addFishCause;
window.removeFishCause = R.removeFishCause;
window.renderTools = renderTools;

// Debounced save — fires 1.5s after last keystroke to reduce Firestore writes
let _saveDebounceTimer = null;
window.saveDataDebounced = function() {
    clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => { _saveDebounceTimer = null; window.saveData(); }, 1500);
};

// Sends a waiting debounced save straight away — used when leaving a project
// or hiding the page, so an edit made in the last 1.5 s is not dropped.
function flushPendingSave() {
    if (!_saveDebounceTimer) return;
    clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = null;
    if (state.projectData && !state.isReadOnly) window.saveData();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPendingSave(); });
window.addEventListener('pagehide', flushPendingSave);

window.saveChecklist = (key, val) => { 
    if (!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist[key] = val; 
    window.saveDataDebounced();
};
window.saveChecklistField = window.saveChecklist; 
window.saveSmartAim = R.saveSmartAim; 
window.renderChecklist = R.renderChecklist; 
window.startOnboarding = startOnboarding;

window.openMemberModal = R.openMemberModal;
window.saveMember = () => {
    const name  = document.getElementById('member-name').value.trim();
    const role  = document.getElementById('member-role').value.trim();
    const grade = document.getElementById('member-grade').value.trim();
    const resp  = document.getElementById('member-resp').value.trim();
    const init  = document.getElementById('member-init').value.trim();
    const idxRaw = document.getElementById('member-index').value;
    const editIndex = idxRaw !== '' ? parseInt(idxRaw, 10) : null;

    if (!name) { showToast('Name is required', 'error'); return; }

    if (!state.projectData.teamMembers) state.projectData.teamMembers = [];

    const memberData = {
        name, role, grade, responsibilities: resp,
        initials: init || name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()
    };

    if (editIndex !== null && state.projectData.teamMembers[editIndex]) {
        // Preserve the original id when editing
        memberData.id = state.projectData.teamMembers[editIndex].id || Date.now().toString();
        state.projectData.teamMembers[editIndex] = memberData;
        showToast('Member updated', 'success');
    } else {
        memberData.id = Date.now().toString();
        state.projectData.teamMembers.push(memberData);
        showToast('Member added', 'success');
    }

    window.saveData();
    document.getElementById('member-modal').classList.add('hidden');
    document.getElementById('member-modal').classList.remove('flex');
    ['member-name','member-role','member-grade','member-resp','member-init','member-index']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    R.renderTeam();
};
window.deleteMember = (index) => {
    window.showConfirmDialog('Remove this team member?', () => {
        state.projectData.teamMembers.splice(index, 1);
        window.saveData();
        R.renderTeam();
        showToast('Member removed', 'info');
    }, 'Remove', 'Remove Team Member');
};
window.addLeadershipLog = R.addLeadershipLog;
window.deleteLeadershipLog = R.deleteLeadershipLog;

window.addStakeholder = R.addStakeholder;
window.updateStake = R.updateStake;
window.removeStake = R.removeStake;
window.editStakeholder = R.editStakeholder;
window.toggleStakeView = R.toggleStakeView;

window.addPDSA = R.addPDSA;
window.updatePDSA = R.updatePDSA;
window.deletePDSA = R.deletePDSA;
window.addChangeIdea = R.addChangeIdea;
window.updateChangeIdea = R.updateChangeIdea;
window.deleteChangeIdea = R.deleteChangeIdea;
window.addCycleToIdea = R.addCycleToIdea;
window.updateCycleInIdea = R.updateCycleInIdea;
window.deleteCycleFromIdea = R.deleteCycleFromIdea;
window.renderAllPDSACycles = R.renderAllPDSACycles;

window.openGanttModal = R.openGanttModal;
window.saveGanttTask = () => {
    if (!state.projectData || state.isReadOnly) return;
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const name = val('task-name');
    const start = val('task-start');
    const end = val('task-end');
    const type = val('task-type') || 'plan';
    const owner = val('task-owner');
    const milestone = !!document.getElementById('task-milestone')?.checked;
    const dependency = val('task-dep');
    const idxRaw = val('task-index');
    const editIndex = idxRaw !== '' ? parseInt(idxRaw, 10) : null;

    if (!name || !start || !end) { showToast("Please give the task a name, start date and end date", "error"); return; }
    if (end < start) { showToast("The end date is before the start date", "error"); return; }

    if (!Array.isArray(state.projectData.gantt)) state.projectData.gantt = [];
    const gantt = state.projectData.gantt;
    // Older tasks may have no id; give them one so dependencies can point at them.
    gantt.forEach((t, i) => { if (!t.id) t.id = Date.now().toString(36) + i; });

    if (dependency) {
        const depTask = gantt.find(t => t.id === dependency);
        if (depTask && depTask.end && depTask.end > start) {
            showToast(`Task must start after dependency '${depTask.name}' finishes.`, 'error');
            return;
        }
    }

    const existing = editIndex !== null && gantt[editIndex] ? gantt[editIndex] : null;
    const task = { ...(existing || {}), id: existing?.id || Date.now().toString(36), name, start, end, type, owner, milestone, dependency };
    if (existing) gantt[editIndex] = task; else gantt.push(task);

    window.saveData();
    const modal = document.getElementById('task-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    ['task-name', 'task-start', 'task-end', 'task-owner', 'task-dep', 'task-index'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const typeEl = document.getElementById('task-type'); if (typeEl) typeEl.value = 'plan';
    const ms = document.getElementById('task-milestone'); if (ms) ms.checked = false;

    R.renderGantt();
    showToast(existing ? "Task updated" : "Task added", "success");
};
window.deleteGantt = (id) => {
    window.showConfirmDialog('Delete this Gantt task?', () => {
        state.projectData.gantt = state.projectData.gantt.filter(t => t.id !== id);
        window.saveData();
        R.renderGantt();
        showToast('Task deleted', 'info');
    }, 'Delete', 'Delete Task');
};
window.deleteGanttTask = (index) => {
    window.showConfirmDialog('Delete this Gantt task?', () => {
        state.projectData.gantt.splice(index, 1);
        window.saveData();
        R.renderGantt();
        showToast('Task deleted', 'info');
    }, 'Delete', 'Delete Task');
};

window.switchPublishMode = R.renderPublish;
window.copyReport = R.copyReport;
window.saveResults = (val) => { 
    if(!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist.results_analysis = val; 
    window.saveData(); 
};
window.calcGreen = R.calcGreen;
window.calcMoney = R.calcMoney;
window.calcTime = R.calcTime;
window.calcEdu = R.calcEdu;
window.showHelp = R.showHelp;
window.startTour = R.startTour;

window.renderSurveys = renderSurveys;
window.addSurvey = addSurvey;
window.deleteSurvey = deleteSurvey;
window.importSurveyCSV = importSurveyCSV;
window.updateSurveySummary = updateSurveySummary;
window.updateSurveyTitle = updateSurveyTitle;
window.aiAnalyseSurvey = aiAnalyseSurvey;
window.exportToA3 = exportToA3;

window.saveData = async function(skipHistory = false) {
    // Blanket block on any write while browsing read-only (Lead view, Supervisor
    // "View Full Project", or a public share link). This intentionally also blocks
    // the supervisor's own sign-off actions when isReadOnly is set for browsing —
    // those go through the dedicated window.saveSupervisorAssessment() path instead,
    // which is only reachable from the "Review & Sign Off" entry point.
    if (state.isReadOnly) { revertReadOnlyEdit(); return; }
    
    // skipHistory: not an Undo step (Undo/Redo themselves, view choices, "seen"
    // markers) — move the baseline so a later Undo doesn't quietly revert it.
    const recordHistory = () => {
        if (!skipHistory) pushHistory();
        else if (state.projectData) state._historyBase = JSON.stringify(state.projectData);
    };

    if (state.isDemoMode) { 
        recordHistory();
        let currentView = document.querySelector('.view-section:not(.hidden)');
        if (currentView) {
            let viewName = currentView.id.replace('view-', '');
            if(viewName === 'tools' || viewName === 'data' || viewName === 'dashboard') {
                R.renderAll(viewName);
            }
        }
        return; 
    }

    if (!state.currentProjectId || !state.currentUser) return;
    
    if (!db) {
        showToast("Not connected to the database — your changes are only kept until you close this page.", "warning");
        return;
    }
    
    recordHistory();
    
    try {
        const ownerUid = (state.isSupervisorViewing && state.supervisorTargetUid)
            ? state.supervisorTargetUid
            : state.currentUser.uid;
        await setDoc(doc(db, 'users/' + ownerUid + '/projects', state.currentProjectId), state.projectData, { merge: true });
        
        const s = document.getElementById('save-status');
        if(s) { 
            // Record save time and show persistent indicator
            window._lastSavedAt = Date.now();
            s.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Saved`;
            s.classList.remove('opacity-0', 'text-slate-400');
            s.classList.add('text-emerald-600', 'flex', 'items-center', 'gap-1', 'text-xs', 'font-medium');
            if(typeof lucide !== 'undefined') lucide.createIcons();

            // Start / restart the "X min ago" updater
            if (!window._saveIntervalId) {
                window._saveIntervalId = setInterval(() => {
                    const el = document.getElementById('save-status');
                    if (!el || !window._lastSavedAt) return;
                    const mins = Math.floor((Date.now() - window._lastSavedAt) / 60000);
                    el.innerHTML = mins < 1
                        ? `<i data-lucide="check" class="w-3 h-3"></i> Saved just now`
                        : `<i data-lucide="clock" class="w-3 h-3"></i> Saved ${mins}m ago`;
                    if(typeof lucide !== 'undefined') lucide.createIcons();
                }, 60000);
            }
        }
    } catch (e) {
        showToast("Save failed: " + e.message, "error");
    }
};

// Dedicated save path for a supervisor's SLO 11 sign-off/comments (supervisor.js).
// Bypasses the isReadOnly guard in saveData() by design — it is the one legitimate
// write a reviewing supervisor makes, and it only ever persists the `assessment`
// field, never the trainee's checklist/PDSA/chart content, so browsing the rest of
// the project in "View Full Project" mode stays genuinely read-only.
window.saveSupervisorAssessment = async function() {
    if (!state.isSupervisorViewing || !state.supervisorTargetUid || !state.currentProjectId || !state.projectData) return;
    if (!db) { showToast("Database not connected. Changes not saved.", "warning"); return; }
    try {
        // Only the supervisor-owned fields: traineeSeenAt belongs to the trainee,
        // and writing our (possibly older) copy of it would resurrect their badge.
        const a = state.projectData.assessment || {};
        const supervisorFields = {};
        ['supervisorComments', 'signedOff', 'signedOffBy', 'signedOffByUid', 'signedOffByEmail', 'signedOffGmc', 'signedOffDate', 'lastSupervisorActivityAt']
            .forEach(k => { if (a[k] !== undefined) supervisorFields[k] = a[k]; });
        await setDoc(
            doc(db, 'users/' + state.supervisorTargetUid + '/projects', state.currentProjectId),
            { assessment: supervisorFields },
            { merge: true }
        );
        // The read-only snapshot must include the sign-off too, or the next
        // refused edit elsewhere would roll the screen back to before it.
        if (state._readOnlySnapshot) {
            try {
                const snap = JSON.parse(state._readOnlySnapshot);
                snap.assessment = { ...(snap.assessment || {}), ...supervisorFields };
                state._readOnlySnapshot = JSON.stringify(snap);
            } catch (e) { state._readOnlySnapshot = JSON.stringify(state.projectData); }
        }
        // Keep the Supervisor Overview card in step without waiting for a refetch.
        const cached = (state.supervisorProjects || []).find(p => p.ownerUid === state.supervisorTargetUid && p.projectId === state.currentProjectId);
        if (cached) {
            cached._data = { ...(cached._data || {}), assessment: { ...((cached._data || {}).assessment || {}), ...supervisorFields } };
            Object.assign(cached, summariseProject(cached._data));
        }
        const s = document.getElementById('save-status');
        if (s) {
            window._lastSavedAt = Date.now();
            s.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Saved`;
            s.classList.remove('opacity-0', 'text-slate-400');
            s.classList.add('text-emerald-600', 'flex', 'items-center', 'gap-1', 'text-xs', 'font-medium');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch (e) {
        showToast("Save failed: " + e.message, "error");
    }
};

// Quick-add data point from dashboard widget
window.quickAddDataPoint = async function() {
    if (!state.projectData || state.isReadOnly) return;
    const dateEl = document.getElementById('quick-add-date');
    const valEl = document.getElementById('quick-add-value');
    const phaseEl = document.getElementById('quick-add-phase');
    const date = normaliseDateInput(dateEl?.value);
    const value = parseNumericInput(valEl?.value);
    if (!date || isNaN(value)) {
        showToast('Please enter a date and a number', 'error');
        return;
    }
    const grade = phaseEl?.value || '';
    if (!Array.isArray(state.projectData.chartData)) state.projectData.chartData = [];
    state.projectData.chartData.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), date, value, grade, note: '' });
    state.projectData.chartData.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (window.saveData) await window.saveData();
    showToast(`Added ${value} on ${formatUkDate(date)}`, 'success');
    // Reset value input, keep date
    if (valEl) valEl.value = '';
    // Refresh dashboard mini-chart if visible
    if (typeof R !== 'undefined' && R.renderAll) R.renderAll('dashboard');
};

// Undo history holds the states *before* each save. saveData() runs after the
// edit has already been applied, so the pre-edit state is kept separately in
// state._historyBase and pushed only when the project has actually changed.
function resetHistory(data) {
    state.historyStack = [];
    state.redoStack = [];
    state._historyBase = data ? JSON.stringify(data) : null;
    updateUndoRedoButtons();
}

function pushHistory() {
    if (state.isReadOnly || !state.projectData) return;
    const current = JSON.stringify(state.projectData);
    if (state._historyBase && state._historyBase !== current) {
        state.historyStack.push(state._historyBase);
        if (state.historyStack.length > state.MAX_HISTORY) state.historyStack.shift();
        state.redoStack = [];
    }
    state._historyBase = current;
    updateUndoRedoButtons();
}

window.undo = () => {
    if (state.isReadOnly || !state.projectData) return;
    // An edit still waiting on the debounced save becomes its own undo step.
    clearTimeout(_saveDebounceTimer); _saveDebounceTimer = null;
    pushHistory();
    if (state.historyStack.length === 0) return;
    state.redoStack.push(JSON.stringify(state.projectData));
    const prevState = state.historyStack.pop();
    state.projectData = JSON.parse(prevState);
    migrateProjectData(state.projectData); // re-sync chartData/chartSettings <-> measures[] references, lost during JSON round-trip
    state._historyBase = JSON.stringify(state.projectData);
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        R.renderAll(viewName);
    }
    window.saveData(true); 
    updateUndoRedoButtons();
    showToast("Undo", "info");
};

window.redo = () => {
    if (state.redoStack.length === 0 || state.isReadOnly || !state.projectData) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    const nextState = state.redoStack.pop();
    state.projectData = JSON.parse(nextState);
    migrateProjectData(state.projectData); // re-sync chartData/chartSettings <-> measures[] references, lost during JSON round-trip
    state._historyBase = JSON.stringify(state.projectData);
    let currentView = document.querySelector('.view-section:not(.hidden)');
    if (currentView) {
        let viewName = currentView.id.replace('view-', '');
        R.renderAll(viewName);
    }
    window.saveData(true);
    updateUndoRedoButtons();
    showToast("Redo", "info");
};

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = state.historyStack.length === 0;
    if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

function getAuthErrorDetails(error) {
    const errorCode = error.code || '';
    const errorDetails = {
        message: 'An unexpected error occurred. Please try again.',
        type: 'error',
        field: null,
        suggestion: null
    };

    switch (errorCode) {
        case 'auth/invalid-email':
            errorDetails.message = 'Please enter a valid email address.';
            errorDetails.field = 'email';
            break;
        case 'auth/email-already-in-use':
            errorDetails.message = 'This email is already registered. Try signing in instead.';
            errorDetails.field = 'email';
            errorDetails.suggestion = 'signin';
            break;
        case 'auth/user-not-found':
            errorDetails.message = 'No account found with this email address.';
            errorDetails.field = 'email';
            errorDetails.suggestion = 'register';
            break;
        case 'auth/wrong-password':
            errorDetails.message = 'Incorrect password. Please try again.';
            errorDetails.field = 'password';
            errorDetails.suggestion = 'reset';
            break;
        case 'auth/weak-password':
            errorDetails.message = 'Password is too weak. Use at least 6 characters.';
            errorDetails.field = 'password';
            break;
        case 'auth/missing-password':
            errorDetails.message = 'Please enter your password.';
            errorDetails.field = 'password';
            break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            errorDetails.message = 'Invalid email or password. Please check your details.';
            errorDetails.field = null;
            break;
        case 'auth/user-disabled':
            errorDetails.message = 'This account has been disabled. Please contact support.';
            errorDetails.type = 'warning';
            break;
        case 'auth/too-many-requests':
            errorDetails.message = 'Too many failed attempts. Please wait before trying again.';
            errorDetails.type = 'warning';
            errorDetails.suggestion = 'wait';
            break;
        case 'auth/network-request-failed':
            errorDetails.message = 'Network error. Please check your internet connection.';
            errorDetails.type = 'warning';
            break;
        default:
            errorDetails.message = `Authentication error: ${error.message || 'Unknown error'}`;
    }

    return errorDetails;
}

function setFieldError(fieldId, hasError, message = '') {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const wrapper = field.parentElement;
    let errorSpan = wrapper.querySelector('.field-error');

    if (hasError) {
        field.classList.add('border-red-500', 'bg-red-50');
        field.classList.remove('border-slate-300');
        
        if (message && !errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'field-error text-red-500 text-xs mt-1 block';
            wrapper.appendChild(errorSpan);
        }
        if (errorSpan) {
            errorSpan.textContent = message;
        }
    } else {
        field.classList.remove('border-red-500', 'bg-red-50');
        field.classList.add('border-slate-300');
        
        if (errorSpan) {
            errorSpan.remove();
        }
    }
}

function clearFieldErrors() {
    setFieldError('email', false);
    setFieldError('password', false);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function setButtonLoading(button, isLoading, loadingText = 'Loading...', originalText = null) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2"></i> ${loadingText}`;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [button] });
    } else {
        button.disabled = false;
        button.innerHTML = originalText || button.dataset.originalText || 'Submit';
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [button] });
    }
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        const isShared = await checkShareLink(user);
        if (isShared) return;

        state.currentUser = user;
        if (user) {
            state.isMasterAdmin = (user.email && user.email.toLowerCase() === ADMIN_EMAIL);

            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('app-sidebar').classList.add('lg:flex');
            document.getElementById('auth-screen').classList.add('hidden');

            // Show role-specific sidebar buttons immediately from localStorage cache
            // (will be confirmed/hidden by Firestore check below)
            const cachedLead = safeStorage.get('rcem_is_qip_lead');
            const cachedSupervisor = safeStorage.get('rcem_is_supervisor');
            if (cachedLead) {
                const leadBtn = document.getElementById('sidebar-lead-home');
                if (leadBtn) leadBtn.classList.remove('hidden');
            }
            if (cachedSupervisor) {
                const supBtn = document.getElementById('sidebar-supervisor-home');
                if (supBtn) supBtn.classList.remove('hidden');
            }
            // Hide register screen if somehow visible
            const rs = document.getElementById('register-screen');
            if (rs) rs.classList.add('hidden');

            const ud = document.getElementById('user-display');

            if (state.isMasterAdmin) {
                if (ud) ud.textContent = '\uD83D\uDC41 Master Admin';
                const adminBar = document.getElementById('admin-bar');
                if (adminBar) adminBar.classList.remove('hidden');
                // Push content down so admin bar doesn't overlap nav
                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.style.marginTop = '32px';
                // Show Admin Dashboard button in sidebar, relabel Switch Project
                const adminHomeBtn = document.getElementById('sidebar-admin-home');
                if (adminHomeBtn) adminHomeBtn.classList.remove('hidden');
                const switchLbl = document.getElementById('switch-project-label');
                if (switchLbl) switchLbl.textContent = 'All Projects';
                loadMasterAdminDashboard();
            } else {
                if (ud) ud.textContent = user.email;
                // Auto-save email to qipUsers so admin dashboard can resolve names
                if (db) {
                    // Only send a name when the account has one: email sign-ups have
                    // none here, and a blank would overwrite the name given at registration.
                    const profile = { email: user.email || '', lastLogin: new Date().toISOString() };
                    if (user.displayName) profile.displayName = user.displayName;
                    setDoc(doc(db, 'qipUsers', user.uid), profile, { merge: true }).catch(e => console.warn('[Profile] auto-save:', e));
                }
                loadProjectList();
                checkQIPLeadStatus(user);
                checkSupervisorStatus();
            }
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
            // Reset admin state on logout
            state.isMasterAdmin = false;
            const adminBar = document.getElementById('admin-bar');
            if (adminBar) adminBar.classList.add('hidden');
            const appContainer = document.getElementById('app-container');
            if (appContainer) appContainer.style.marginTop = '';
        }
    });
}

async function checkShareLink(viewerUser) {
    const urlParams = new URLSearchParams(window.location.search);
    const sharePid = urlParams.get('share');
    const shareUid = urlParams.get('uid');

    if (sharePid && shareUid) {
        state.isReadOnly = true;
        const ind = document.getElementById('readonly-indicator');
        if(ind) ind.classList.remove('hidden');
        
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-sidebar').classList.add('lg:flex');
        document.body.classList.add('readonly-mode');
        
        try {
            if (!db) throw new Error("Database not connected");
            const docRef = doc(db, `users/${shareUid}/projects`, sharePid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Normalise like every other way of opening a project, so an older
                // or sparse project can't crash a tab for the person viewing it.
                state.projectData = normaliseProjectData(docSnap.data());
                state.currentProjectId = sharePid;
                resetHistory(null);
                const title = state.projectData.meta?.title || 'QIP';
                const header = document.getElementById('project-header-title');
                if (header) header.textContent = title + " (Shared)";
                const topBar = document.getElementById('top-bar');
                if (topBar) topBar.classList.remove('hidden');
                showReadOnlyBanner(title, 'share');
                window.router('dashboard');
                // Log this the same way qip_lead/supervisor cross-account views are
                // logged, so a plain share link can't view a trainee's project
                // invisibly to the audit trail. Best-effort: never blocks the view,
                // and still logs even if the visitor isn't signed in at all (a raw
                // link needs no account), recording what identity IS available.
                logProjectAccessEvent(db, {
                    viewerUid: viewerUser?.uid || '(unauthenticated)',
                    viewerEmail: viewerUser?.email || '(unauthenticated)',
                    viaRole: 'share_link',
                    ownerUid: shareUid,
                    projectId: sharePid,
                    projectTitle: state.projectData?.meta?.title || '',
                    action: 'viewed'
                });
            } else {
                showToast("Shared project not found.", "error");
            }
        } catch (e) {
            showToast("Could not load shared project.", "error");
        }
        return true;
    }
    return false;
}

// ─── Shared helpers for the QIP Lead / Supervisor overviews ─────────────────
// A Departmental QIP Lead sees every QIP anyone has started (unless the owner
// opted out), not just ones they were individually invited to.
async function fetchAllProjectsEnriched() {
    const snap = await getDocs(collectionGroup(db, 'projects'));
    const rows = [];
    const ownerUids = new Set();
    snap.forEach(docSnap => {
        const pathParts = docSnap.ref.path.split('/');
        if (pathParts.length < 4 || pathParts[0] !== 'users' || pathParts[2] !== 'projects') return;
        const ownerUid = pathParts[1];
        const d = docSnap.data() || {};
        // Owner opt-out from the blanket view (explicit invites still apply).
        if (d.visibility && d.visibility.hideFromDeptQIPLead === true) return;
        ownerUids.add(ownerUid);
        rows.push({ ownerUid, projectId: docSnap.id, projectTitle: d.meta?.title || 'Untitled QIP', traineeName: null, _data: d, ...summariseProject(d) });
    });
    const nameByUid = await resolveOwnerNames(ownerUids);
    rows.forEach(r => { r.traineeName = nameByUid[r.ownerUid]; });
    return rows;
}

async function resolveOwnerNames(uids) {
    const nameByUid = {};
    await Promise.all([...uids].map(async uid => {
        try {
            const uSnap = await getDoc(doc(db, 'qipUsers', uid));
            const ud = uSnap.exists() ? uSnap.data() : null;
            nameByUid[uid] = ud?.displayName || ud?.email || `User (${uid.substring(0, 8)}…)`;
        } catch (e) {
            nameByUid[uid] = `User (${uid.substring(0, 8)}…)`;
        }
    }));
    return nameByUid;
}

// Fetches each invited project and attaches the card summary. Projects that
// can't be read are kept but flagged, so the list is honest about them.
async function enrichInvitedProjects(projects) {
    // Older invites stored the trainee's email as their name; show their
    // profile name instead where we can read it, else keep the email.
    const emailNamed = new Set((projects || []).filter(p => !p.traineeName || p.traineeName.includes('@')).map(p => p.ownerUid).filter(Boolean));
    const names = {};
    await Promise.all([...emailNamed].map(async uid => {
        try {
            const uSnap = await getDoc(doc(db, 'qipUsers', uid));
            if (uSnap.exists() && uSnap.data().displayName) names[uid] = uSnap.data().displayName;
        } catch (e) { /* keep the stored email */ }
    }));
    return Promise.all((projects || []).map(async proj => {
        const traineeName = names[proj.ownerUid] || proj.traineeName;
        const d = await fetchProjectDoc(proj.ownerUid, proj.projectId);
        if (!d) return { ...proj, traineeName, _data: {}, _unavailable: true, ...summariseProject({}) };
        return { ...proj, traineeName, projectTitle: d.meta?.title || proj.projectTitle, _data: d, ...summariseProject(d) };
    }));
}

function markOwn(rows) {
    const uid = state.currentUser?.uid;
    rows.forEach(r => { r._isOwn = !!uid && r.ownerUid === uid; });
    return rows;
}

function setBusy(on) {
    const o = document.getElementById('loading-overlay');
    if (o) o.classList.toggle('hidden', !on);
}

function cloneProjectData(d) {
    try { return JSON.parse(JSON.stringify(d || {})); } catch (e) { return { ...(d || {}) }; }
}

async function readUserRoles(user, label) {
    try {
        const roleSnap = await getDoc(doc(db, 'qipUsers', user.uid));
        return roleSnap.exists() ? (roleSnap.data().roles || []) : [];
    } catch (roleErr) {
        console.warn(`[${label}] Could not read qipUsers role:`, roleErr);
        if (roleErr?.code === 'permission-denied') {
            showToast(`Could not check ${label} role — Firestore permission denied on qipUsers. This usually means the qipUsers security rule needs updating.`, 'error');
        }
        return [];
    }
}

// ─── QIP Lead ────────────────────────────────────────────────────────────────
async function loadQIPLeadProjects(user) {
    const hasLeadRole = (await readUserRoles(user, 'QIP Lead')).includes('qip_lead');
    const email = (user.email || '').toLowerCase();
    let projects = [];
    if (hasLeadRole) {
        try {
            projects = await fetchAllProjectsEnriched();
        } catch (allErr) {
            console.warn('[QIPLead] Could not fetch all projects:', allErr);
            if (allErr?.code === 'permission-denied') {
                showToast('Could not load all QIP projects — Firestore permission denied on the projects collection group.', 'error');
            }
        }
    }
    // Individually-invited projects always show, including ones the owner has
    // hidden from the blanket department view.
    const invited = await getQIPLeadProjects(db, email);
    const have = new Set(projects.map(p => p.ownerUid + '/' + p.projectId));
    const missing = invited.filter(p => !have.has(p.ownerUid + '/' + p.projectId));
    if (missing.length) projects = projects.concat(await enrichInvitedProjects(missing));
    return { hasLeadRole, projects: markOwn(projects) };
}

async function checkQIPLeadStatus(user) {
    if (!user?.uid || !user?.email || !db) return;
    try {
        const { hasLeadRole, projects } = await loadQIPLeadProjects(user);
        state.qipLeadProjects = projects;
        state.qipLeadHasRole = hasLeadRole;
        state.isQIPLead = hasLeadRole || projects.length > 0;
        state._leadRefreshedAt = new Date().toISOString();

        const leadHomeBtn = document.getElementById('sidebar-lead-home');
        const navBtn = document.getElementById('nav-lead-dashboard');
        const badge = document.getElementById('qip-lead-badge');
        if (!state.isQIPLead) {
            // Role removed since last visit: clear the cached button too.
            safeStorage.remove('rcem_is_qip_lead');
            [leadHomeBtn, navBtn, badge].forEach(el => el && el.classList.add('hidden'));
            return;
        }
        safeStorage.set('rcem_is_qip_lead', '1');

        const n = projects.length;
        const badgeText = document.getElementById('qip-lead-badge-text');
        if (badge) badge.classList.remove('hidden');
        if (badgeText) {
            badgeText.textContent = hasLeadRole
                ? (n > 0 ? `You can see ${n} QIP project${n !== 1 ? 's' : ''} across the department as Departmental QIP Lead` : 'Departmental QIP Lead — no QIP projects exist yet')
                : `You have been added as QIP Lead on ${n} project${n !== 1 ? 's' : ''}`;
        }
        if (navBtn) navBtn.classList.remove('hidden');
        if (leadHomeBtn) leadHomeBtn.classList.remove('hidden');
        const leadHomeLbl = document.getElementById('sidebar-lead-home-label');
        if (leadHomeLbl) leadHomeLbl.textContent = n > 0 ? `QIP Lead Overview (${n})` : 'QIP Lead Overview';
        rerenderOverviewIfShowing('lead');
    } catch (e) {
        console.warn('[QIPLead] checkQIPLeadStatus error:', e);
    }
}

function overviewContainer() { return document.getElementById('qip-lead-dashboard-container'); }

function isOverviewShowing(kind) {
    const c = overviewContainer();
    return !!(c && !c.classList.contains('hidden') && c.dataset.overview === kind && !state.projectData);
}

function renderRoleOverview(kind) {
    const container = overviewContainer();
    if (!container) return;
    if (kind === 'lead') {
        renderQIPLeadDashboard(container, state.qipLeadProjects || [], {
            hasRole: !!state.qipLeadHasRole,
            refreshing: !!state._leadRefreshing,
            refreshedAt: state._leadRefreshedAt
        });
    } else {
        renderSupervisorOverview(container, state.supervisorProjects || [], {
            refreshing: !!state._supRefreshing,
            refreshedAt: state._supRefreshedAt
        });
    }
}

function rerenderOverviewIfShowing(kind) {
    if (isOverviewShowing(kind)) renderRoleOverview(kind);
}

// Shows the QIP Lead or Supervisor overview from anywhere in the app: leaves
// any open project, routes to the projects area and refreshes in the background.
function openRoleOverview(kind) {
    const container = overviewContainer();
    if (!container) return;
    leaveProjectContext();
    window.router('projects');
    const inner = document.getElementById('project-list-inner');
    if (inner) inner.classList.add('hidden');
    container.classList.remove('hidden');
    container.dataset.overview = kind;
    renderRoleOverview(kind);
    window.refreshRoleOverview(kind, { silent: true });
}

window.refreshRoleOverview = async function(kind, opts = {}) {
    if (!state.currentUser || !db) return;
    const flag = kind === 'lead' ? '_leadRefreshing' : '_supRefreshing';
    if (state[flag]) return;
    state[flag] = true;
    rerenderOverviewIfShowing(kind);
    try {
        if (kind === 'lead') await checkQIPLeadStatus(state.currentUser);
        else await checkSupervisorStatus();
        if (!opts.silent) showToast('List refreshed', 'success');
    } finally {
        state[flag] = false;
        rerenderOverviewIfShowing(kind);
    }
};

window.showQIPLeadDashboard = function() { openRoleOverview('lead'); };

window.switchToOwnProjects = function() {
    const container = overviewContainer();
    const inner = document.getElementById('project-list-inner');
    if (container) { container.classList.add('hidden'); delete container.dataset.overview; }
    if (inner) inner.classList.remove('hidden');
};

// Opens a fresh copy of someone else's project read-only for a QIP Lead.
window.viewLeadProject = async function(idx) {
    const proj = (state.qipLeadProjects || [])[idx];
    if (!proj) return;
    if (proj._unavailable) { showToast('That project could not be loaded — it may have been deleted or your access removed.', 'error'); return; }
    setBusy(true);
    const fresh = await fetchProjectDoc(proj.ownerUid, proj.projectId);
    setBusy(false);
    if (fresh) Object.assign(proj, { _data: fresh, projectTitle: fresh.meta?.title || proj.projectTitle, ...summariseProject(fresh) });
    const data = normaliseProjectData(cloneProjectData(fresh || proj._data));

    leaveProjectContext();
    state.projectData = data;
    state.currentProjectId = proj.projectId;
    state.leadTargetUid = proj.ownerUid;
    state.isReadOnly = true;
    state.isLeadViewing = true;
    resetHistory(null);
    // Audit trail: a Departmental QIP Lead opening someone else's project.
    if (!proj._isOwn) {
        logProjectAccessEvent(db, {
            viewerUid: state.currentUser?.uid,
            viewerEmail: state.currentUser?.email,
            viaRole: 'qip_lead',
            ownerUid: proj.ownerUid,
            projectId: proj.projectId,
            projectTitle: data.meta?.title || proj.projectTitle || 'Untitled QIP',
            action: 'viewed'
        });
    }
    const title = data.meta?.title || proj.projectTitle || 'QIP';
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');
    const headerTitle = document.getElementById('project-header-title');
    if (headerTitle) headerTitle.textContent = title + ' — QIP Lead View';
    showReadOnlyBanner(title, 'lead');
    window.router('dashboard');
    showToast('Viewing read-only' + (fresh ? '' : ' (offline copy — may not be the latest)'), fresh ? 'info' : 'warning');
};

window.returnFromLeadView = function() { openRoleOverview('lead'); };

// ─── Add/Remove QIP Lead button handlers (called from supervisor view) ───────
// Owner-controlled opt-out from the blanket Departmental QIP Lead view (see
// fetchAllProjectsEnriched, which honours this flag).
window.toggleHideFromDeptLead = function(hidden) {
    if (!state.projectData) return;
    if (!state.projectData.visibility) state.projectData.visibility = {};
    state.projectData.visibility.hideFromDeptQIPLead = !!hidden;
    if (window.saveData) window.saveData();
    showToast(hidden ? 'Project hidden from the blanket Departmental QIP Lead view' : 'Project visible to Departmental QIP Leads again', 'info');
};

window.addQIPLeadBtn = async function() {
    const input = document.getElementById('qip-lead-email-input');
    if (!input) return;
    const email = input.value.trim().toLowerCase();
    if (!email) { showToast('Enter a lead email address.', 'error'); return; }
    const d = state.projectData;
    if (!d || !state.currentUser || !canManageAccess()) return;
    if ((d.qipLeads || []).some(l => (l.email || l) === email)) { showToast('That email is already listed as a QIP Lead', 'info'); return; }
    const success = await addQIPLeadToProject(
        db, state.currentUser.uid, state.currentProjectId,
        email,
        state.currentUser.displayName || state.currentUser.email,
        d.meta?.title || 'Untitled QIP'
    );
    if (success) {
        if (!d.qipLeads) d.qipLeads = [];
        d.qipLeads.push({ email, addedAt: new Date().toISOString() });
        if (window.saveData) window.saveData();
        input.value = '';
        // Re-render the lead panel
        const panel = document.getElementById('qip-lead-panel');
        if (panel) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
    }
};

window.removeQIPLeadBtn = async function(idx) {
    const d = state.projectData;
    if (!d?.qipLeads || !canManageAccess()) return;
    const lead = d.qipLeads[idx];
    if (!lead) return;
    await removeQIPLeadFromProject(db, state.currentUser.uid, state.currentProjectId, lead.email);
    d.qipLeads.splice(idx, 1);
    if (window.saveData) window.saveData();
    const panel = document.getElementById('qip-lead-panel');
    if (panel) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
};

async function loadProjectList() {
    if (state.isReadOnly) return;
    if (state.isMasterAdmin) { loadMasterAdminDashboard(); return; }
    window.router('projects');
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.add('hidden');

    // Auto-show How-To guide for first-time visitors
    if (!safeStorage.get('qip_howto_seen')) {
        setTimeout(() => window.showHowTo(), 800);
    }

    const listEl = document.getElementById('project-list');
    
    if (state.isDemoMode) {
        // Compute the stat chips from the actual demo dataset rather than
        // hardcoding numbers, so this card can never drift out of sync with
        // what the project itself contains (e.g. after editing pdsa cycles).
        const demo = getDemoData();
        const demoDataPoints = (demo.chartData || []).length;
        const demoPdsaCycles = Array.isArray(demo.changeIdeas)
            ? demo.changeIdeas.reduce((sum, idea) => sum + (idea.pdsaCycles || []).length, 0)
            : (demo.pdsa || []).length;
        const demoTeamMembers = (demo.teamMembers || []).length;
        listEl.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-rcem-purple relative cursor-pointer group hover:shadow-md transition-all" onclick="window.openDemoProject()">
             <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide rounded-bl">Gold Standard</div>
             <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery in the ED</h3>
             <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ST6 Emergency Medicine)</p>
             <div class="flex gap-2 text-xs font-medium text-slate-500 flex-wrap">
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> ${demoDataPoints} Data Points</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> ${demoPdsaCycles} PDSA Cycles</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> ${demoTeamMembers} Team Members</span>
            </div>
        </div>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    try {
        if (!db) throw new Error("No database connection");
        const snap = await getDocs(collection(db, `users/${state.currentUser.uid}/projects`));
        listEl.innerHTML = '';
        if (snap.empty) {
            listEl.innerHTML = `<div class="col-span-3 text-center p-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                <h3 class="font-bold text-slate-600 mb-2">No Projects Yet</h3>
                <button onclick="window.createNewProject()" class="text-rcem-purple font-bold hover:underline flex items-center justify-center gap-2 mx-auto"><i data-lucide="plus-circle" class="w-4 h-4"></i> Create your first QIP</button>
            </div>`;
        }
        // Newest first; built in one go rather than re-parsing the list per card.
        const rows = [];
        snap.forEach(doc => rows.push({ id: doc.id, d: doc.data() || {} }));
        rows.sort((a, b) => String(b.d.meta?.created || '').localeCompare(String(a.d.meta?.created || '')));
        listEl.innerHTML = listEl.innerHTML + rows.map(({ id, d }) => {
            const created = formatUkDate(d.meta?.created || '');
            const titleText = escapeHtml(d.meta?.title || 'Untitled');
            return `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer relative group hover:shadow-md transition-all" onclick="window.openProject(${jsArg(id)})">
                    <h3 class="font-bold text-lg text-slate-800 mb-1 pr-8 group-hover:text-rcem-purple transition-colors truncate" title="${titleText}">${titleText}</h3>
                    <p class="text-xs text-slate-400 mb-4">${created ? `Created: ${escapeHtml(created)}` : '&nbsp;'}</p>
                    <button aria-label="Delete project" title="Delete project" onclick="event.stopPropagation(); window.deleteProject(${jsArg(id)})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-all p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
        }).join('');
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        showToast("Failed to load projects: " + e.message, "error");
    }
}

window.createNewProject = async () => {
    const modal      = document.getElementById('new-project-modal');
    const titleInput = document.getElementById('new-project-title');
    const oldSubmit  = document.getElementById('new-project-submit');
    if (!modal || !titleInput) return;

    titleInput.value = '';
    titleInput.classList.remove('border-red-400', 'ring-1', 'ring-red-400');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => titleInput.focus(), 60);

    const submitBtn = oldSubmit.cloneNode(true);
    oldSubmit.parentNode.replaceChild(submitBtn, oldSubmit);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let creating = false; // a quick double Enter must not create two projects
    const doCreate = async () => {
        if (creating) return;
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.classList.add('border-red-400', 'ring-1', 'ring-red-400');
            titleInput.focus();
            return;
        }
        creating = true;
        titleInput.onkeydown = null;
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        let template = JSON.parse(JSON.stringify(emptyProject));
        template.meta.title = title;
        template.meta.created = new Date().toISOString();
        template.meta.updated = new Date().toISOString();

        try {
            if (!db) throw new Error('No DB connection');
            const docRef = await addDoc(collection(db, `users/${state.currentUser.uid}/projects`), template);
            showToast('Project created successfully', 'success');
            window.openProject(docRef.id);
            setTimeout(() => { if (window.startOnboarding) window.startOnboarding(); }, 600);
        } catch (e) {
            showToast('Failed to create project: ' + e.message, 'error');
        }
    };

    submitBtn.onclick = doCreate;
    titleInput.onkeydown = (e) => { if (e.key === 'Enter') doCreate(); };
};

window.deleteProject = async (id) => {
    window.showConfirmDialog(
        'Permanently delete this project? This cannot be undone.',
        async () => {
            try {
                if (!db) throw new Error('No DB connection');
                await deleteDoc(doc(db, `users/${state.currentUser.uid}/projects`, id));
                loadProjectList();
                showToast('Project deleted', 'info');
            } catch (e) {
                showToast('Failed to delete project: ' + e.message, 'error');
            }
        },
        'Delete Project',
        'Delete Project'
    );
};

// Shows/hides the amber dot on the sidebar's "SLO 11 Sign-off" link whenever
// the supervisor has left activity the trainee hasn't opened that tab to see
// yet. Called on every project snapshot (live) and cleared by supervisor.js
// once the trainee actually opens the tab.
window.updateSupervisorNavBadge = function() {
    const badge = document.getElementById('nav-supervisor-badge');
    if (!badge) return;
    const a = state.projectData?.assessment;
    const unseen = !!(a && a.lastSupervisorActivityAt && a.lastSupervisorActivityAt > (a.traineeSeenAt || ''));
    badge.classList.toggle('hidden', !unseen || state.isSupervisorViewing);
};

window.openProject = (id) => {
    leaveProjectContext();
    state.currentProjectId = id;

    if (!db) { showToast("No DB connection", "error"); return; }
    
    let firstLoad = true; // navigate to dashboard only once data is ready

    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            // After the first load, ignore the echo of this user's own save (and
            // any snapshot identical to what is on screen). Re-rendering for it
            // would throw away the cursor and anything typed but not yet saved,
            // and would swap state.projectData for a copy mid-edit.
            if (!firstLoad) {
                if (doc.metadata && doc.metadata.hasPendingWrites) return;
                const incoming = normaliseProjectData(doc.data());
                if (stableJson(incoming) === stableJson(state.projectData)) return;
                state.projectData = incoming;
                state._historyBase = JSON.stringify(incoming);
            } else {
                state.projectData = normaliseProjectData(doc.data());
                resetHistory(state.projectData);
            }
            
            const headerTitle = document.getElementById('project-header-title');
            if(headerTitle) headerTitle.textContent = state.projectData.meta.title;
            const renameBtn = document.getElementById('btn-rename-project');
            if(renameBtn) renameBtn.style.display = 'inline-flex';
            window.updateSupervisorNavBadge();

            if (firstLoad) {
                // First snapshot: data is ready — now it's safe to navigate
                firstLoad = false;
                const topBar = document.getElementById('top-bar');
                if(topBar) topBar.classList.remove('hidden');
                if (window.applyProgressiveNavDisclosure) window.applyProgressiveNavDisclosure();
                window.router('dashboard');
            } else {
                // Subsequent snapshots (live updates): re-render current view
                let currentView = document.querySelector('.view-section:not(.hidden)');
                if (currentView) {
                    let viewName = currentView.id.replace('view-', '');
                    if(viewName !== 'projects') window.router(viewName);
                }
            }
        }
    }, (error) => {
        showToast("Connection error: " + error.message, "error");
    });
};

function initAuthHandlers() {
    const authForm = document.getElementById('auth-form');
    
    if(authForm) {
        authForm.onsubmit = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            clearFieldErrors();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = authForm.querySelector('button[type="submit"]');
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !isValidEmail(email)) {
                setFieldError('email', true, 'Please enter a valid email address');
                return;
            }
            
            if (!password || password.length < 6) {
                setFieldError('password', true, 'Password must be at least 6 characters');
                return;
            }
            
            if (!auth) {
                showToast("Authentication service unavailable.", "error");
                return;
            }
            
            setButtonLoading(submitBtn, true, 'Signing in...');
            
            try { 
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Signed in successfully!", "success");
            } 
            catch (error) {
                const errorDetails = getAuthErrorDetails(error);
                if (errorDetails.field) {
                    setFieldError(errorDetails.field, true, errorDetails.message);
                }
                showToast(errorDetails.message, errorDetails.type);
                passwordInput.value = '';
                setButtonLoading(submitBtn, false, null, 'Sign In');
            }
        });
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput) {
            emailInput.addEventListener('input', () => setFieldError('email', false));
        }
        
        if (passwordInput) {
            passwordInput.addEventListener('input', () => setFieldError('password', false));
        }
    }

    const btnRegister = document.getElementById('btn-register');
    if (btnRegister) {
        btnRegister.addEventListener('click', () => window.showRegisterScreen());
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => { 
            try {
                if(auth) await signOut(auth);
                showToast("Signed out successfully", "info");
                state.currentUser = null;
                state.currentProjectId = null;
                state.projectData = null;
                setTimeout(() => window.location.reload(), 500);
            } catch (error) {
                showToast("Error signing out. Please try again.", "error");
            }
        });
    }

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('app-sidebar');
            if (sidebar.classList.contains('hidden')) {
                sidebar.classList.remove('hidden'); 
                sidebar.classList.add('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
            } else {
                sidebar.classList.add('hidden'); 
                sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full');
            }
        });
    }

    const btnForgotPassword = document.getElementById('btn-forgot-password');
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener('click', async () => {
            const emailInput = document.getElementById('email');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email || !isValidEmail(email)) {
                setFieldError('email', true, 'Enter your email address above first, then click Forgot Password.');
                return;
            }
            if (!auth) { showToast('Authentication service unavailable.', 'error'); return; }
            try {
                await sendPasswordResetEmail(auth, email);
                showToast(`Password reset email sent to ${email}. Check your inbox (and spam folder).`, 'success');
            } catch (error) {
                const details = getAuthErrorDetails(error);
                showToast(details.message, details.type);
            }
        });
    }

    const btnGoogleSignin = document.getElementById('btn-google-signin');
    if (btnGoogleSignin) {
        btnGoogleSignin.addEventListener('click', async () => {
            if (!auth) { showToast('Authentication service unavailable.', 'error'); return; }
            setButtonLoading(btnGoogleSignin, true, 'Signing in with Google...');
            try {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, provider);
                showToast('Signed in with Google!', 'success');
            } catch (error) {
                // User closed the popup — don't show an error toast
                if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                    setButtonLoading(btnGoogleSignin, false);
                    return;
                }
                const details = getAuthErrorDetails(error);
                showToast(details.message, details.type);
                setButtonLoading(btnGoogleSignin, false);
            }
        });
    }

    const demoToggle = document.getElementById('demo-toggle');
    if(demoToggle) {
        demoToggle.addEventListener('change', (e) => {
            state.isDemoMode = e.target.checked;
            state.currentProjectId = null; 
            state.projectData = null;
            const wm = document.getElementById('demo-watermark');
            if (state.isDemoMode) { 
                if(wm) wm.classList.remove('hidden'); 
                loadProjectList(); 
            } 
            else { 
                if(wm) wm.classList.add('hidden'); 
                if (state.currentUser) loadProjectList(); 
                else {
                    const authScreen = document.getElementById('auth-screen');
                    if(authScreen) authScreen.classList.remove('hidden');
                }
            }
        });
    }

    const demoAuthBtn = document.getElementById('demo-auth-btn');
    if(demoAuthBtn) {
        demoAuthBtn.onclick = () => {
            state.isDemoMode = true;
            state.currentUser = { uid: 'demo', email: 'demo@rcem.ac.uk' };
            
            const appContainer = document.getElementById('app-container');
            if(appContainer) appContainer.classList.remove('hidden');
            
            const sb = document.getElementById('app-sidebar');
            if(sb) sb.classList.add('lg:flex');
            const as = document.getElementById('auth-screen');
            if(as) as.classList.add('hidden');
            const wm = document.getElementById('demo-watermark');
            if(wm) wm.classList.remove('hidden');
            if(demoToggle) demoToggle.checked = true;
            loadProjectList();
            showToast("Demo mode activated", "success");
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthHandlers);
} else {
    initAuthHandlers();
}

window.openDemoProject = () => {
    state.projectData = getDemoData();
    migrateProjectData(state.projectData);
    state.currentProjectId = 'DEMO';
    resetHistory(state.projectData);

    const header = document.getElementById('project-header-title');
    if(header) header.textContent = state.projectData.meta.title + " (DEMO)";
    
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
};

window.shareProject = () => {
    if(state.isDemoMode) { showToast("Cannot share demo projects.", "error"); return; }
    if (!state.currentProjectId || !state.currentUser || state.isReadOnly) { showToast("Open one of your own projects to share it.", "error"); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(state.currentProjectId)}&uid=${encodeURIComponent(state.currentUser.uid)}`;
    const copied = () => showToast("Share Link copied — anyone with this link can view the project (view is logged).", "success");
    // Clipboard access can be refused (older browsers, some NHS desktops) — fall back to showing the link.
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(copied).catch(() => window.prompt('Copy this share link:', url));
    else window.prompt('Copy this share link:', url);
};

document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = (e.key || '').toLowerCase(); // Shift makes e.key 'Z' on most platforms
    if (key === 's') {
        e.preventDefault();
        if (!state.projectData || !state.currentProjectId) return;
        if (state.isReadOnly) { showToast("This project is read-only — nothing to save.", "info"); return; }
        clearTimeout(_saveDebounceTimer); _saveDebounceTimer = null;
        window.saveData().then(() => showToast("Project Saved", "success"));
        return;
    }
    // Leave Ctrl+Z / Ctrl+Y to the browser while typing, so they undo text
    // rather than the whole project (which would also discard what was typed).
    const t = e.target;
    const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing || !state.projectData) return;
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); window.undo(); }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); window.redo(); }
});

if(document.readyState === 'complete') {
    updateOnlineStatus();
} else {
    window.addEventListener('load', updateOnlineStatus);
}

if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'base',
        themeVariables: {
            primaryColor: '#2d2e83',
            primaryTextColor: '#fff',
            primaryBorderColor: '#2d2e83',
            lineColor: '#94a3b8',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#eff6ff'
        }
    });
}

if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

window.checkFirebaseStatus = () => {
    return getFirebaseStatus();
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION SCREEN — role selection + account creation
// ─────────────────────────────────────────────────────────────────────────────
let _regSelectedRoles = [];

window.showRegisterScreen = function() {
    const reg = document.getElementById('register-screen');
    const auth = document.getElementById('auth-screen');
    if (!reg) return;
    reg.classList.remove('hidden');
    if (auth) auth.classList.add('hidden');

    // Reset state
    _regSelectedRoles = [];

    // Reset step visibility
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s1) s1.classList.remove('hidden');
    if (s2) s2.classList.add('hidden');

    // Reset progress dots
    const d1 = document.getElementById('reg-dot-1');
    const d2 = document.getElementById('reg-dot-2');
    if (d1) { d1.classList.add('bg-rcem-purple'); d1.classList.remove('bg-slate-200'); }
    if (d2) { d2.classList.remove('bg-rcem-purple'); d2.classList.add('bg-slate-200'); }

    // Reset role cards
    ['trainee', 'supervisor', 'qip_lead'].forEach(role => {
        const card = document.getElementById(`role-card-${role}`);
        if (!card) return;
        card.classList.remove('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        const ind = card.querySelector('.role-check-indicator');
        if (ind) {
            ind.classList.remove('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.add('border-slate-300');
            ind.innerHTML = '';
        }
    });

    // Clear errors
    const e1 = document.getElementById('reg-step1-error');
    const e2 = document.getElementById('reg-error');
    if (e1) { e1.classList.add('hidden'); e1.textContent = ''; }
    if (e2) { e2.classList.add('hidden'); e2.textContent = ''; }

    // Clear form fields
    ['reg-name', 'reg-email', 'reg-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.hideRegisterScreen = function() {
    const reg = document.getElementById('register-screen');
    const auth = document.getElementById('auth-screen');
    if (reg) reg.classList.add('hidden');
    if (auth) auth.classList.remove('hidden');
};

window.toggleRegRole = function(role) {
    const card = document.getElementById(`role-card-${role}`);
    if (!card) return;
    const ind = card.querySelector('.role-check-indicator');
    const errEl = document.getElementById('reg-step1-error');

    if (_regSelectedRoles.includes(role)) {
        // Guard: cannot deselect the only remaining role
        if (_regSelectedRoles.length === 1) {
            if (errEl) {
                errEl.textContent = 'You must keep at least one role selected.';
                errEl.classList.remove('hidden');
                setTimeout(() => errEl.classList.add('hidden'), 3000);
            }
            return;
        }
        _regSelectedRoles = _regSelectedRoles.filter(r => r !== role);
        card.classList.remove('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        if (ind) {
            ind.classList.remove('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.add('border-slate-300');
            ind.innerHTML = '';
        }
    } else {
        _regSelectedRoles.push(role);
        card.classList.add('border-rcem-purple', 'bg-indigo-50', 'shadow-md');
        if (ind) {
            ind.classList.add('bg-rcem-purple', 'border-rcem-purple');
            ind.classList.remove('border-slate-300');
            ind.innerHTML = '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        }
        // Clear any error once a valid selection exists
        if (errEl) errEl.classList.add('hidden');
    }
};

window.regNextStep = function() {
    const errEl = document.getElementById('reg-step1-error');
    if (_regSelectedRoles.length === 0) {
        if (errEl) { errEl.textContent = 'Please select at least one role to continue.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (errEl) errEl.classList.add('hidden');

    // Build role summary
    const roleLabels = { trainee: 'Trainee', supervisor: 'Clinical Supervisor', qip_lead: 'Departmental QIP Lead' };
    const summaryEl = document.getElementById('reg-roles-summary');
    if (summaryEl) {
        summaryEl.innerHTML = 'Roles selected: ' + _regSelectedRoles.map(r =>
            `<span class="font-bold text-rcem-purple">${roleLabels[r] || r}</span>`
        ).join(', ');
    }

    // Transition to step 2
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s1) s1.classList.add('hidden');
    if (s2) s2.classList.remove('hidden');

    // Update progress dots
    const d2 = document.getElementById('reg-dot-2');
    if (d2) { d2.classList.add('bg-rcem-purple'); d2.classList.remove('bg-slate-200'); }

    // Focus email
    setTimeout(() => { const em = document.getElementById('reg-email'); if (em) em.focus(); }, 80);
};

window.regGoBack = function() {
    const s1 = document.getElementById('reg-step-1');
    const s2 = document.getElementById('reg-step-2');
    if (s2) s2.classList.add('hidden');
    if (s1) s1.classList.remove('hidden');
    const d2 = document.getElementById('reg-dot-2');
    if (d2) { d2.classList.remove('bg-rcem-purple'); d2.classList.add('bg-slate-200'); }
};

function refreshRoleNavAfterRegistration(user) {
    if (!user || state.isMasterAdmin) return;
    checkQIPLeadStatus(user);
    checkSupervisorStatus();
}

async function saveUserProfileToFirestore(uid, email, displayName) {
    if (!db) return;
    try {
        await setDoc(doc(db, 'qipUsers', uid), {
            email: email || '',
            displayName: displayName || '',
            // arrayUnion: signing up again (e.g. with Google) adds roles, never removes existing ones.
            roles: arrayUnion(..._regSelectedRoles),
            createdAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('[Register] Failed to save user profile to Firestore:', e);
    }
    // Audit trail: log every role claimed at sign-up (esp. supervisor/qip_lead —
    // these are self-service, unverified claims today, so Jake asked for a log
    // he can audit). Best-effort — never blocks account creation.
    _regSelectedRoles.forEach(role => {
        logRoleAuditEvent(db, { uid, email, displayName, role, action: 'added', source: 'registration' });
    });
}

window.submitRegister = async function() {
    const nameEl = document.getElementById('reg-name');
    const emailEl = document.getElementById('reg-email');
    const passEl = document.getElementById('reg-password');
    const errEl = document.getElementById('reg-error');
    const submitBtn = document.getElementById('reg-submit-btn');

    const name = nameEl ? nameEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    // Safety net: roles must have been selected in step 1
    if (_regSelectedRoles.length === 0) {
        if (errEl) { errEl.textContent = 'Please go back and select at least one role.'; errEl.classList.remove('hidden'); }
        return;
    }

    if (!email || !isValidEmail(email)) {
        if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (!password || password.length < 6) {
        if (errEl) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.remove('hidden'); }
        return;
    }
    if (errEl) errEl.classList.add('hidden');

    setButtonLoading(submitBtn, true, 'Creating account...');
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserProfileToFirestore(cred.user.uid, email, name);
        // Sign-in has already checked roles, possibly before they were saved — check again.
        refreshRoleNavAfterRegistration(cred.user);
        // onAuthStateChanged will fire and load the app
        const reg = document.getElementById('register-screen');
        if (reg) reg.classList.add('hidden');
        showToast('Account created successfully! Welcome.', 'success');
    } catch (error) {
        const details = getAuthErrorDetails(error);
        if (errEl) { errEl.textContent = details.message; errEl.classList.remove('hidden'); }
        setButtonLoading(submitBtn, false, null, 'Create Account');
    }
};

window.registerWithGoogle = async function() {
    const errEl = document.getElementById('reg-error');
    const googleBtn = document.getElementById('reg-btn-google');

    // Safety net: roles must have been selected in step 1
    if (_regSelectedRoles.length === 0) {
        if (errEl) { errEl.textContent = 'Please go back and select at least one role.'; errEl.classList.remove('hidden'); }
        return;
    }

    if (errEl) errEl.classList.add('hidden');
    setButtonLoading(googleBtn, true, 'Signing up with Google...');

    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await signInWithPopup(auth, provider);
        await saveUserProfileToFirestore(cred.user.uid, cred.user.email, cred.user.displayName || '');
        refreshRoleNavAfterRegistration(cred.user);
        const reg = document.getElementById('register-screen');
        if (reg) reg.classList.add('hidden');
        showToast('Account created with Google! Welcome.', 'success');
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            setButtonLoading(googleBtn, false, null, 'Sign up with Google');
            return;
        }
        const details = getAuthErrorDetails(error);
        if (errEl) { errEl.textContent = details.message; errEl.classList.remove('hidden'); }
        setButtonLoading(googleBtn, false, null, 'Sign up with Google');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ADMIN DASHBOARD — read-only view of ALL users' projects
// ─────────────────────────────────────────────────────────────────────────────
async function loadMasterAdminDashboard() {
    if (!state.isMasterAdmin || !db) return;

    window.router('projects');
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.add('hidden');

    // Patch the view-projects header for admin context
    const h1 = document.querySelector('#view-projects header h1');
    if (h1) h1.textContent = 'Master Admin — All Projects';
    const sub = document.querySelector('#view-projects header p');
    if (sub) sub.textContent = 'Read-only overview of every user\'s QIP projects';
    // Hide the "New Project" button for admin
    const newBtn = document.querySelector('#view-projects header button');
    if (newBtn) newBtn.classList.add('hidden');
    // Hide QIP lead badge
    const badge = document.getElementById('qip-lead-badge');
    if (badge) badge.classList.add('hidden');
    // Hide QIP lead dashboard container
    const leadCont = document.getElementById('qip-lead-dashboard-container');
    if (leadCont) leadCont.classList.add('hidden');

    const listEl = document.getElementById('project-list');
    if (!listEl) return;

    listEl.className = 'w-full'; // override grid
    listEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-rcem-purple border-t-transparent mb-4"></div>
            <p class="text-slate-500 font-medium">Loading all projects across all users&hellip;</p>
        </div>`;

    try {
        const snap = await getDocs(collectionGroup(db, 'projects'));
        state.adminAllProjects = [];
        const userMap = {};

        snap.forEach(docSnap => {
            const pathParts = docSnap.ref.path.split('/');
            // Path: users/{uid}/projects/{pid}
            if (pathParts.length < 4 || pathParts[0] !== 'users' || pathParts[2] !== 'projects') return;
            const ownerUid = pathParts[1];
            const projectId = docSnap.id;
            const data = docSnap.data();
            state.adminAllProjects.push({ ownerUid, projectId, data });
            if (!userMap[ownerUid]) userMap[ownerUid] = [];
            userMap[ownerUid].push({ projectId, data });
        });

        // Names come from each user's qipUsers profile, which is written at
        // every sign-in. (No personal emails are kept in this public file.)
        const userEmails = {};
        const fallbackName = (uid) => `User (${uid.substring(0, 8)}\u2026)`;
        await Promise.all(Object.keys(userMap).map(async (uid) => {
            try {
                const uSnap = await getDoc(doc(db, 'qipUsers', uid));
                const ud = uSnap.exists() ? uSnap.data() : {};
                userEmails[uid] = ud.email
                    ? (ud.displayName ? `${ud.displayName} (${ud.email})` : ud.email)
                    : (ud.displayName || fallbackName(uid));
            } catch (e) { userEmails[uid] = fallbackName(uid); }
        }));

        const totalProjects = state.adminAllProjects.length;
        const totalUsers = Object.keys(userMap).length;

        // Update admin bar count
        const countEl = document.getElementById('admin-project-count');
        if (countEl) countEl.textContent = `${totalProjects} project${totalProjects !== 1 ? 's' : ''} · ${totalUsers} user${totalUsers !== 1 ? 's' : ''}`;

        if (totalProjects === 0) {
            listEl.innerHTML = `
                <div class="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                    <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300 mb-3"></i>
                    <h3 class="font-bold text-slate-600 mb-1">No Projects Found</h3>
                    <p class="text-slate-400 text-sm">No users have created QIP projects yet.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Render — grouped by user
        let html = `
            <div class="mb-6 grid grid-cols-3 gap-4">
                <div class="bg-rcem-purple text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${totalProjects}</div>
                    <div class="text-xs opacity-80 mt-1">Total Projects</div>
                </div>
                <div class="bg-indigo-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${totalUsers}</div>
                    <div class="text-xs opacity-80 mt-1">Users</div>
                </div>
                <div class="bg-emerald-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${state.adminAllProjects.reduce((s, p) => s + (p.data.pdsa || []).length, 0)}</div>
                    <div class="text-xs opacity-80 mt-1">Total PDSA Cycles</div>
                </div>
            </div>`;

        for (const [uid, projects] of Object.entries(userMap)) {
            const email = escapeHtml(userEmails[uid] || uid);
            html += `
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <div class="w-7 h-7 bg-rcem-purple rounded-full flex items-center justify-center flex-shrink-0">
                            <i data-lucide="user" class="w-3.5 h-3.5 text-white"></i>
                        </div>
                        <span class="font-bold text-slate-700">${email}</span>
                        <span class="text-xs text-slate-400 ml-1">${projects.length} project${projects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;

            projects.forEach(({ projectId, data }, idx) => {
                const title = escapeHtml(data.meta?.title || 'Untitled');
                // Same figures as the QIP Lead and Supervisor overviews.
                const summary = summariseProject(data);
                const created = formatUkDate(data.meta?.created || '') || '?';
                const updated = summary._lastActivity ? formatUkDate(summary._lastActivity.slice(0, 10)) : '?';
                const pdsaCount = summary._pdsaCount;
                const dataPoints = summary._dataPoints;
                const progress = summary._progress;

                html += `
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                         onclick="window.adminViewProject(${jsArg(uid)}, ${jsArg(projectId)})">
                        <div class="flex items-start justify-between mb-2 gap-2">
                            <h3 class="font-bold text-slate-800 truncate group-hover:text-rcem-purple transition-colors" title="${title}">${title}</h3>
                            <span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">Read-only</span>
                        </div>
                        <p class="text-xs text-slate-400 mb-3">Created: ${created}&ensp;·&ensp;Last activity: ${updated}</p>
                        <div class="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                            <div class="bg-rcem-purple h-1.5 rounded-full transition-all" style="width:${progress}%"></div>
                        </div>
                        <div class="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="refresh-cw" class="w-3 h-3 inline mr-0.5"></i>${pdsaCount} PDSA
                            </span>
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="activity" class="w-3 h-3 inline mr-0.5"></i>${dataPoints} data pts
                            </span>
                            <span class="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                <i data-lucide="check-square" class="w-3 h-3 inline mr-0.5"></i>${progress}% complete
                            </span>
                        </div>
                    </div>`;
            });

            html += `</div></div>`;
        }

        listEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error('[Admin] loadMasterAdminDashboard error:', e);
        listEl.innerHTML = `
            <div class="p-8 bg-red-50 rounded-xl border border-red-200 text-center">
                <i data-lucide="alert-circle" class="w-8 h-8 mx-auto text-red-500 mb-3"></i>
                <h3 class="font-bold text-red-700 mb-1">Failed to Load Projects</h3>
                <p class="text-red-600 text-sm mb-2">${escapeHtml(e.message)}</p>
                <p class="text-slate-500 text-xs">Make sure the Firestore collection group rules are set up correctly (see the rules provided).</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE & ACCESS AUDIT LOG — Master Admin only. Shows every self-service role
// claim (esp. Supervisor/QIP Lead, which are unverified today) and every time
// a QIP Lead or Supervisor opened someone else's project.
// ─────────────────────────────────────────────────────────────────────────────
window.showRoleAuditLog = async function() {
    if (!state.isMasterAdmin || !db) return;

    const listEl = document.getElementById('project-list');
    if (!listEl) return;
    document.getElementById('admin-bar-audit-btn')?.classList.add('hidden');
    document.getElementById('admin-bar-projects-btn')?.classList.remove('hidden');

    const h1 = document.querySelector('#view-projects header h1');
    if (h1) h1.textContent = 'Master Admin — Role & Access Audit Log';
    const sub = document.querySelector('#view-projects header p');
    if (sub) sub.textContent = 'Every self-service role claim and every cross-account project view, most recent first.';

    listEl.className = 'w-full';
    listEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-4 border-rcem-purple border-t-transparent mb-4"></div>
            <p class="text-slate-500 font-medium">Loading audit log&hellip;</p>
        </div>`;

    // Best-effort ordered fetch; fall back to unordered + client-side sort if the
    // orderBy query fails (e.g. rules not yet updated, or index still building).
    async function fetchAuditCollection(name) {
        try {
            const { query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
            const snap = await getDocs(query(collection(db, name), orderBy('createdAtIso', 'desc'), limit(300)));
            return snap.docs.map(d => d.data());
        } catch (e) {
            console.warn(`[Audit] Ordered fetch of ${name} failed, falling back:`, e);
            try {
                const snap = await getDocs(collection(db, name));
                return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAtIso || '').localeCompare(a.createdAtIso || ''));
            } catch (e2) {
                console.warn(`[Audit] Fallback fetch of ${name} also failed:`, e2);
                return null; // null = permission/connection error, distinct from an empty log
            }
        }
    }

    try {
        const [roleEvents, accessEvents] = await Promise.all([
            fetchAuditCollection('roleAuditLog'),
            fetchAuditCollection('projectAccessLog')
        ]);

        if (roleEvents === null && accessEvents === null) {
            listEl.innerHTML = `
                <div class="p-8 bg-red-50 rounded-xl border border-red-200 text-center">
                    <i data-lucide="alert-circle" class="w-8 h-8 mx-auto text-red-500 mb-3"></i>
                    <h3 class="font-bold text-red-700 mb-1">Could not load the audit log</h3>
                    <p class="text-slate-500 text-sm">This usually means the Firestore security rules for roleAuditLog / projectAccessLog haven't been added yet — see the comment at the top of audit-log.js for the exact rules to add.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const roleRows = roleEvents || [];
        const accessRows = accessEvents || [];
        const supervisorClaims = roleRows.filter(r => r.role === 'supervisor' && r.action === 'added').length;
        const leadClaims = roleRows.filter(r => r.role === 'qip_lead' && r.action === 'added').length;

        let html = `
            <div class="mb-6 grid grid-cols-3 gap-4">
                <div class="bg-rcem-purple text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${roleRows.length}</div>
                    <div class="text-xs opacity-80 mt-1">Total Role Events</div>
                </div>
                <div class="bg-teal-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${supervisorClaims}</div>
                    <div class="text-xs opacity-80 mt-1">Supervisor Claims</div>
                </div>
                <div class="bg-indigo-600 text-white rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold">${leadClaims}</div>
                    <div class="text-xs opacity-80 mt-1">QIP Lead Claims</div>
                </div>
            </div>

            <h3 class="font-bold text-slate-800 mb-2">Role claims (registration + Settings)</h3>
            <div class="overflow-x-auto mb-8">
                <table class="w-full text-xs bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <thead class="bg-slate-50 text-slate-500 uppercase text-[10px]">
                        <tr><th class="p-2 text-left">When</th><th class="p-2 text-left">Email</th><th class="p-2 text-left">Role</th><th class="p-2 text-left">Action</th><th class="p-2 text-left">Source</th></tr>
                    </thead>
                    <tbody>
                        ${roleRows.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No role events logged yet.</td></tr>' : roleRows.map(r => `
                        <tr class="border-t border-slate-100 ${(r.role === 'supervisor' || r.role === 'qip_lead') && r.action === 'added' ? 'bg-amber-50' : ''}">
                            <td class="p-2 whitespace-nowrap">${r.createdAtIso ? new Date(r.createdAtIso).toLocaleString('en-GB') : '?'}</td>
                            <td class="p-2">${escapeHtml(r.email || r.uid || '?')}</td>
                            <td class="p-2 font-semibold">${escapeHtml(r.role || '?')}</td>
                            <td class="p-2">${r.action === 'added' ? '<span class="text-emerald-600 font-semibold">Added</span>' : '<span class="text-red-500 font-semibold">Removed</span>'}</td>
                            <td class="p-2 text-slate-400">${escapeHtml(r.source || '?')}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <h3 class="font-bold text-slate-800 mb-2">Cross-account project access (QIP Lead / Supervisor)</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-xs bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <thead class="bg-slate-50 text-slate-500 uppercase text-[10px]">
                        <tr><th class="p-2 text-left">When</th><th class="p-2 text-left">Viewer</th><th class="p-2 text-left">Via role</th><th class="p-2 text-left">Action</th><th class="p-2 text-left">Project</th></tr>
                    </thead>
                    <tbody>
                        ${accessRows.length === 0 ? '<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No cross-account project views logged yet.</td></tr>' : accessRows.map(r => `
                        <tr class="border-t border-slate-100">
                            <td class="p-2 whitespace-nowrap">${r.createdAtIso ? new Date(r.createdAtIso).toLocaleString('en-GB') : '?'}</td>
                            <td class="p-2">${escapeHtml(r.viewerEmail || r.viewerUid || '?')}</td>
                            <td class="p-2 font-semibold">${escapeHtml(r.viaRole || '?')}</td>
                            <td class="p-2">${escapeHtml(r.action || 'viewed')}</td>
                            <td class="p-2">${escapeHtml(r.projectTitle || r.projectId || '?')}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;

        listEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error('[Audit] showRoleAuditLog error:', e);
        listEl.innerHTML = `<div class="p-8 bg-red-50 rounded-xl border border-red-200 text-center text-red-600 text-sm">${escapeHtml(e.message)}</div>`;
    }
};

window.showMasterAdminProjects = function() {
    document.getElementById('admin-bar-audit-btn')?.classList.remove('hidden');
    document.getElementById('admin-bar-projects-btn')?.classList.add('hidden');
    loadMasterAdminDashboard();
};

window.adminViewProject = async function(uid, projectId) {
    if (!state.isMasterAdmin) return;
    try {
        const snap = await getDoc(doc(db, `users/${uid}/projects`, projectId));
        if (!snap.exists()) { showToast('Project not found', 'error'); return; }

        const data = normaliseProjectData(snap.data());
        leaveProjectContext();
        state.projectData = data;
        state.currentProjectId = projectId;
        state.isReadOnly = true;
        state.isLeadViewing = false;
        resetHistory(null);
        showReadOnlyBanner(data.meta?.title || 'Untitled', 'admin');
        // Logged like QIP Lead / Supervisor / share-link views, so admin access is visible too.
        logProjectAccessEvent(db, {
            viewerUid: state.currentUser?.uid,
            viewerEmail: state.currentUser?.email,
            viaRole: 'master_admin',
            ownerUid: uid,
            projectId,
            projectTitle: data.meta?.title || 'Untitled QIP',
            action: 'viewed'
        });

        const headerTitle = document.getElementById('project-header-title');
        if (headerTitle) headerTitle.textContent = (data.meta?.title || 'Untitled') + ' \u2014 Admin View';

        const topBar = document.getElementById('top-bar');
        if (topBar) topBar.classList.remove('hidden');

        window.router('dashboard');
        showToast('Admin: read-only project view', 'info');
    } catch (e) {
        showToast('Failed to open project: ' + e.message, 'error');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE MANAGEMENT — load and toggle roles in Settings modal
// ─────────────────────────────────────────────────────────────────────────────
async function loadRolesIntoSettings() {
    const container = document.getElementById('settings-roles-container');
    if (!container || !state.currentUser || !db) return;

    container.innerHTML = '<p class="text-xs text-slate-400 italic">Loading...</p>';

    try {
        const snap = await getDoc(doc(db, 'qipUsers', state.currentUser.uid));
        const currentRoles = snap.exists() ? (snap.data().roles || []) : [];

        const roleOptions = [
            { key: 'trainee',   label: 'Trainee',                icon: 'user',             desc: 'Manage your own QIP projects' },
            { key: 'supervisor', label: 'Clinical Supervisor',   icon: 'user-check',        desc: 'Review & sign off trainees\' projects' },
            { key: 'qip_lead',   label: 'Departmental QIP Lead', icon: 'layout-dashboard',  desc: 'Dashboard of all department QIPs' }
        ];

        const activeCount = currentRoles.length;
        container.innerHTML = roleOptions.map(ro => {
            const active = currentRoles.includes(ro.key);
            const isLastRole = active && activeCount === 1;
            const removeStyle = isLastRole
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-rcem-purple text-white border-rcem-purple hover:bg-indigo-700';
            return `
                <div class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <i data-lucide="${ro.icon}" class="w-4 h-4 text-rcem-purple flex-shrink-0"></i>
                        <div class="min-w-0">
                            <p class="text-xs font-medium text-slate-700 truncate">${ro.label}</p>
                            <p class="text-[11px] text-slate-400 truncate">${ro.desc}</p>
                        </div>
                    </div>
                    <button onclick="window.toggleSettingsRole('${ro.key}', this)"
                            data-active="${active}"
                            ${isLastRole ? 'title="You must keep at least one role"' : ''}
                            class="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${active
                                ? removeStyle
                                : 'bg-white text-slate-600 border-slate-300 hover:border-rcem-purple hover:text-rcem-purple'}">
                        ${active ? 'Remove' : 'Add'}
                    </button>
                </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [container] });
    } catch (e) {
        container.innerHTML = '<p class="text-xs text-red-500">Could not load roles</p>';
        console.warn('[Settings] loadRolesIntoSettings error:', e);
    }
}

window.toggleSettingsRole = async function(role, btnEl) {
    if (!state.currentUser || !db) return;
    const wasActive = btnEl.dataset.active === 'true';

    try {
        const snap = await getDoc(doc(db, 'qipUsers', state.currentUser.uid));
        let roles = snap.exists() ? (snap.data().roles || []) : [];

        if (wasActive) {
            // Prevent removing the last role
            if (roles.filter(r => r !== role).length === 0) {
                showToast('You must keep at least one role on your account.', 'error');
                return;
            }
            roles = roles.filter(r => r !== role);
        } else {
            if (!roles.includes(role)) roles.push(role);
        }

        await setDoc(doc(db, 'qipUsers', state.currentUser.uid), {
            email: state.currentUser.email || '',
            roles
        }, { merge: true });

        // Audit trail: log every role add/remove made from Settings, same reason
        // as the registration-time logging above. Best-effort, non-blocking.
        logRoleAuditEvent(db, {
            uid: state.currentUser.uid,
            email: state.currentUser.email || '',
            displayName: state.currentUser.displayName || '',
            role,
            action: wasActive ? 'removed' : 'added',
            source: 'settings'
        });

        // Refresh the role list UI
        await loadRolesIntoSettings();
        showToast(`Role ${wasActive ? 'removed' : 'added'}`, 'success');
    } catch (e) {
        showToast('Failed to update roles: ' + e.message, 'error');
    }
};

// ==========================================
// PROJECT ACCESS — Supervisor & QIP Lead
// ==========================================

// Only the project's owner, in their own project, can change who has access.
function canManageAccess() {
    if (state.isReadOnly || state.isSupervisorViewing || state.isLeadViewing || state.isDemoMode) {
        showToast("Only the project's owner can change who has access.", 'error');
        return false;
    }
    return true;
}

function loadProjectAccessIntoSettings() {
    const supervisors = state.projectData?.supervisors || [];
    const leads = state.projectData?.qipLeads || [];

    const supList = document.getElementById('settings-supervisor-list');
    if (supList) {
        supList.innerHTML = supervisors.length === 0
            ? '<p class="text-xs text-slate-400 italic">No supervisor added yet</p>'
            : supervisors.map((s, i) => `
                <div class="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5">
                    <span class="text-xs text-slate-700 font-medium">${escapeHtml(String(s.email || s))}</span>
                    <button onclick="window.removeSettingsSupervisor(${i})" class="text-slate-300 hover:text-red-500 ml-2" title="Remove">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </div>`).join('');
    }

    const leadList = document.getElementById('settings-lead-list');
    if (leadList) {
        leadList.innerHTML = leads.length === 0
            ? '<p class="text-xs text-slate-400 italic">No QIP Lead added yet</p>'
            : leads.map((l, i) => `
                <div class="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                    <span class="text-xs text-slate-700 font-medium">${escapeHtml(String(l.email || l))}</span>
                    <button onclick="window.removeSettingsLead(${i})" class="text-slate-300 hover:text-red-500 ml-2" title="Remove">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </div>`).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.addSupervisorFromSettings = async function() {
    const input = document.getElementById('settings-supervisor-email');
    const email = (input?.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address', 'error'); return;
    }
    if (!state.projectData || !state.currentProjectId || !state.currentUser) {
        showToast('No project loaded', 'error'); return;
    }
    if (!canManageAccess()) return;
    if (!state.projectData.supervisors) state.projectData.supervisors = [];
    if (state.projectData.supervisors.some(s => (s.email || s) === email)) {
        showToast('That email is already listed as a supervisor', 'info'); return;
    }

    // Write supervisorInvites/{email} so supervisor sees this project on login.
    // Only list them on the project once that has worked.
    try {
        const { doc, setDoc, arrayUnion } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const inviteEntry = {
            ownerUid: state.currentUser.uid,
            projectId: state.currentProjectId,
            projectTitle: state.projectData.meta?.title || 'Untitled QIP',
            traineeName: state.currentUser.displayName || state.currentUser.email,
            traineeEmail: state.currentUser.email,
            addedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'supervisorInvites', email),
            { email, projects: arrayUnion(inviteEntry) }, { merge: true });
    } catch (e) {
        console.warn('[Access] supervisorInvites write failed:', e);
        showToast("Couldn't add that supervisor — please check your connection and try again.", 'error');
        return;
    }

    state.projectData.supervisors.push({ email, addedAt: new Date().toISOString() });
    window.saveData();
    if (input) input.value = '';
    loadProjectAccessIntoSettings();
    // No email is sent — the supervisor sees the project when they sign in.
    showToast(`Supervisor added. ${email} will see this project when they sign in with that email.`, 'success');
};

window.removeSettingsSupervisor = async function(index) {
    if (!canManageAccess()) return;
    const supervisors = state.projectData?.supervisors || [];
    const removed = supervisors[index];
    if (!removed) return;
    supervisors.splice(index, 1);
    // Remove from supervisorInvites
    try {
        const { doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const email = removed.email || removed;
        const ref = doc(db, 'supervisorInvites', email);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const projects = (snap.data().projects || []).filter(
                p => !(p.ownerUid === state.currentUser?.uid && p.projectId === state.currentProjectId)
            );
            await setDoc(ref, { email, projects }, { merge: false });
        }
    } catch (e) { console.warn('[Access] remove supervisorInvite failed:', e); }
    window.saveData();
    loadProjectAccessIntoSettings();
    showToast('Supervisor removed', 'info');
};

window.addLeadFromSettings = async function() {
    const input = document.getElementById('settings-lead-email');
    const email = (input?.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address', 'error'); return;
    }
    if (!state.projectData || !state.currentProjectId || !state.currentUser) {
        showToast('No project loaded', 'error'); return;
    }
    if (!canManageAccess()) return;
    if (!state.projectData.qipLeads) state.projectData.qipLeads = [];
    if (state.projectData.qipLeads.some(l => l.email === email)) {
        showToast('That email is already listed as a QIP Lead', 'info'); return;
    }
    const ok = await addQIPLeadToProject(
        db, state.currentUser.uid, state.currentProjectId, email,
        state.currentUser.displayName || state.currentUser.email,
        state.projectData.meta?.title || 'Untitled QIP'
    );
    if (ok) {
        state.projectData.qipLeads.push({ email, addedAt: new Date().toISOString() });
        window.saveData();
        if (input) input.value = '';
        loadProjectAccessIntoSettings();
    }
};

window.removeSettingsLead = async function(index) {
    if (!canManageAccess()) return;
    const leads = state.projectData?.qipLeads || [];
    const removed = leads[index];
    if (!removed) return;
    leads.splice(index, 1);
    await removeQIPLeadFromProject(db, state.currentUser?.uid, state.currentProjectId, removed.email || removed);
    window.saveData();
    loadProjectAccessIntoSettings();
    showToast('QIP Lead removed', 'info');
};

// Check if logged-in user is a supervisor for any projects
async function checkSupervisorStatus() {
    if (!state.currentUser || state.isMasterAdmin || !db) return;
    try {
        const email = state.currentUser.email?.toLowerCase();
        if (!email) return;
        const hasSupervisorRole = (await readUserRoles(state.currentUser, 'Supervisor')).includes('supervisor');
        const snap = await getDoc(doc(db, 'supervisorInvites', email));
        const invites = snap.exists() ? (snap.data().projects || []) : [];

        const supHomeBtn = document.getElementById('sidebar-supervisor-home');
        const navBtn = document.getElementById('nav-supervisor-overview');
        const badge = document.getElementById('supervisor-badge');
        if (!hasSupervisorRole && invites.length === 0) {
            // Role removed since last visit: clear the cached button too.
            safeStorage.remove('rcem_is_supervisor');
            [supHomeBtn, navBtn, badge].forEach(el => el && el.classList.add('hidden'));
            state.supervisorProjects = [];
            return;
        }
        safeStorage.set('rcem_is_supervisor', '1');

        // The same project can be invited twice (re-added supervisor) — show it once.
        const seen = new Set();
        const unique = invites.filter(p => {
            const k = p.ownerUid + '/' + p.projectId;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        const enriched = await enrichInvitedProjects(unique);
        state.supervisorProjects = enriched;
        state._supRefreshedAt = new Date().toISOString();

        const pending = enriched.filter(p => !p._unavailable && !p._signedOff).length;
        const badgeText = document.getElementById('supervisor-badge-text');
        if (badge) badge.classList.remove('hidden');
        if (badgeText) {
            badgeText.textContent = enriched.length > 0
                ? `You are supervising ${enriched.length} QIP project${enriched.length !== 1 ? 's' : ''}` + (pending ? ` — ${pending} awaiting sign-off` : ' — all signed off')
                : 'Clinical Supervisor — no projects have been shared with you yet';
        }
        if (navBtn) navBtn.classList.remove('hidden');
        if (supHomeBtn) supHomeBtn.classList.remove('hidden');
        const supHomeLbl = document.getElementById('sidebar-supervisor-home-label');
        if (supHomeLbl) supHomeLbl.textContent = enriched.length > 0 ? `Supervisor Overview (${enriched.length})` : 'Supervisor Overview';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        rerenderOverviewIfShowing('supervisor');
    } catch (e) {
        console.warn('[Supervisor] checkSupervisorStatus error:', e);
    }
}

// Called from sidebar, nav, or the projects-page banner to show the Supervisor Overview dashboard
window.showSupervisorOverview = function() { openRoleOverview('supervisor'); };

// Shared setup when a supervisor opens one of their supervised projects.
// Always loads a fresh copy so the supervisor reviews the trainee's latest work.
async function enterSupervisedProject(idx, action) {
    const p = (state.supervisorProjects || [])[idx];
    if (!p) return null;
    setBusy(true);
    const fresh = await fetchProjectDoc(p.ownerUid, p.projectId);
    setBusy(false);
    if (fresh) Object.assign(p, { _data: fresh, _unavailable: false, projectTitle: fresh.meta?.title || p.projectTitle, ...summariseProject(fresh) });
    if (!fresh && (p._unavailable || !p._data || Object.keys(p._data).length === 0)) {
        showToast('That project could not be loaded — it may have been deleted or the invite withdrawn.', 'error');
        return null;
    }
    const data = normaliseProjectData(cloneProjectData(fresh || p._data));

    leaveProjectContext();
    state.currentProjectId = p.projectId;
    state.supervisorTargetUid = p.ownerUid;
    state.projectData = data;
    state.isLeadViewing = true;
    state.isSupervisorViewing = true;
    state.isReadOnly = true;
    resetHistory(null);
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');
    // Audit trail: a Clinical/Educational Supervisor opening a trainee's project.
    logProjectAccessEvent(db, {
        viewerUid: state.currentUser?.uid,
        viewerEmail: state.currentUser?.email,
        viaRole: 'supervisor',
        ownerUid: p.ownerUid,
        projectId: p.projectId,
        projectTitle: data.meta?.title || p.projectTitle || 'Untitled QIP',
        action: action || 'viewed'
    });
    if (!fresh) showToast('Showing the last loaded copy — could not fetch the latest version.', 'warning');
    return p;
}

// "View Full Project" — browse the trainee's entire QIP read-only, across every tab
window.viewSupervisedProjectReadOnly = async function(idx) {
    const p = await enterSupervisedProject(idx, 'viewed');
    if (!p) return;
    const title = state.projectData.meta?.title || p.projectTitle || 'QIP';
    const headerTitle = document.getElementById('project-header-title');
    if (headerTitle) headerTitle.textContent = title + ' — Supervisor View';
    showReadOnlyBanner(title, 'supervisor');
    window.router('dashboard');
};

// "Review & Sign Off" — go straight to the SLO 11 assessment/sign-off form
window.reviewSupervisedProject = async function(idx) {
    const p = await enterSupervisedProject(idx, 'reviewed');
    if (!p) return;
    const title = state.projectData.meta?.title || p.projectTitle || 'QIP';
    const headerTitle = document.getElementById('project-header-title');
    if (headerTitle) headerTitle.textContent = title + ' — Supervisor Review';
    showReadOnlyBanner(title, 'supervisor');
    window.router('supervisor');
};

window.returnFromSupervisorView = function() { openRoleOverview('supervisor'); };
