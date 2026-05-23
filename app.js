import { auth, db, getFirebaseStatus } from "./config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, getDocs, collection, collectionGroup, onSnapshot, addDoc, deleteDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { state, emptyProject, getDemoData } from "./state.js";
import { escapeHtml, updateOnlineStatus, showToast } from "./utils.js";
window.showToast = showToast; // expose for non-module files (e.g. patient-tracker.js)
import { callAI } from "./ai.js";

import { 
    renderChart, deleteDataPoint, addDataPoint, importCSV, downloadCSVTemplate, 
    zoomIn, zoomOut, resetZoom, resetProcess, 
    setToolMode, setChartMode, updateChartEducation, renderTools, toolMode,
    openChartSettings, saveChartSettings, copyChartImage, renderFullViewChart,
    toggleToolHelp
} from "./charts.js";

import * as R from "./renderers.js";
import { exportPPTX, printPoster, printPosterOnly } from "./export.js";
import { startOnboarding } from "./onboarding.js";
import { exportToKaizen } from "./kaizen-export.js";
import { renderSupervisorDashboard } from "./supervisor.js";

import { renderSurveys, addSurvey, deleteSurvey, importSurveyCSV, updateSurveySummary, updateSurveyTitle, aiAnalyseSurvey } from "./surveys.js";

// ─── Master Admin ───────────────────────────────────────────────────────
const ADMIN_EMAIL = 'emevidence999@gmail.com';

// ─── Project data migration ───────────────────────────────────────────────────
function migrateProjectData(d) {
    if (!d) return;
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
}

// ─── Clinical Templates ───────────────────────────────────────────────────────
const CLINICAL_TEMPLATES = [
    {
        id: 'mental-health-self-harm',
        title: 'Mental Health: Self-Harm',
        year: '2025–2026',
        stage: 'All stages',
        color: 'rose',
        description: 'Risk assessment, safety planning, and early referral pathways for patients presenting with self-harm or suicidal ideation.',
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
        year: '2025–2026 (from Jan 2026)',
        stage: 'All stages',
        color: 'emerald',
        description: 'Standardise blood testing timelines and treatment regimens for paracetamol overdose presentations.',
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

window.router = (view) => {
    if (view !== 'projects' && !state.projectData) { 
        showToast("Please select a project first.", "error"); 
        return; 
    }
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('bg-rcem-purple', 'text-white'));
    const btn = document.getElementById(`nav-${view}`);
    if(btn) btn.classList.add('bg-rcem-purple', 'text-white');

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('z-50')) { 
        sidebar.classList.add('hidden'); 
        sidebar.classList.remove('flex', 'fixed', 'inset-0', 'z-50', 'w-full'); 
    }

    if (view === 'supervisor') {
        renderSupervisorDashboard();
    } else {
        R.renderAll(view);
    }
};

// ==========================================
// HOW-TO GUIDE MODAL
// ==========================================
// ─── Education Hub (Learn Panel) ─────────────────────────────────────────────
window.showLearnPanel = function() {
    let modal = document.getElementById('learn-panel-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'learn-panel-modal';
        modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
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
        document.body.appendChild(modal);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
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
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800'
        };
        const btnMap = {
            rose: 'bg-rose-600 hover:bg-rose-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
            amber: 'bg-amber-600 hover:bg-amber-700',
            purple: 'bg-purple-600 hover:bg-purple-700',
            emerald: 'bg-emerald-600 hover:bg-emerald-700'
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
    if (cb && cb.checked) localStorage.setItem('qip_howto_seen', '1');
};

window.returnToProjects = () => {
    state.currentProjectId = null;
    state.projectData = null;
    state.isReadOnly = false;
    state.isLeadViewing = false;
    const ind = document.getElementById('readonly-indicator');
    if (ind) ind.classList.add('hidden');
    document.body.classList.remove('readonly-mode');

    if (window.unsubscribeProject) window.unsubscribeProject();

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

window.importProjectFromFile = function(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!json.meta || !json.checklist) throw new Error("Invalid QIP file");
            
            state.projectData = json;
            window.saveData(true); 
            R.renderAll('dashboard');
            showToast("Project loaded from file", "success");
        } catch (err) {
            console.error(err);
            showToast("Failed to load project: " + err.message, "error");
        }
    };
    reader.readAsText(file);
    input.value = '';
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
        localStorage.setItem('rcem_qip_ai_key', key);
        showToast("Settings saved. AI features enabled.", "success");
    } else {
        localStorage.removeItem('rcem_qip_ai_key');
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

window.aiRefineAim = async () => {
    const d = state.projectData.checklist;
    if (!d.problem_desc && !d.aim) { showToast("Enter a problem or draft aim first", "error"); return; }
    
    const btn = document.getElementById('btn-ai-aim');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Refining...`;
    
    const prompt = `
        Context: Quality Improvement in Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Draft Aim: "${d.aim || 'Not defined'}"
        Task: Rewrite the aim to be strictly SMART (Specific, Measurable, Achievable, Relevant, Time-bound). 
        Keep it under 35 words. Return ONLY the aim statement text, no quotes.
    `;
    
    const result = await callAI(prompt);
    if (result) {
        state.projectData.checklist.aim = result.trim();
        window.saveData();
        R.renderChecklist();
        showToast("Aim refined by AI", "success");
    }
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> Refine Aim`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiSuggestDrivers = async () => {
    const d = state.projectData.checklist;
    if (!d.aim) { showToast("Define an Aim first", "error"); return; }

    const btn = document.getElementById('btn-ai-driver');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Generating...`;
    }

    const prompt = `
        The QIP Aim is: "${d.aim}".
        Problem Context: "${d.problem_desc}".
        Task: Generate a Driver Diagram structure in JSON format.
        Schema: { "primary": ["string"], "secondary": ["string"], "changes": ["string"] }
        Requirements: 3-4 Primary Drivers, 4-6 Secondary Drivers, 5-8 Specific Change Ideas.
    `;

    const result = await callAI(prompt, true);

    if (result && result.primary) {
        state.projectData.drivers = result;
        window.saveData();
        window.renderTools();
        showToast("Driver Diagram generated", "success");
    }

    if(btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> Auto-Generate`;
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiGeneratePDSA = async () => {
    const title = document.getElementById('pdsa-title').value;
    if(!title) { showToast("Enter a title for the cycle first", "error"); return; }
    
    const d = state.projectData.checklist;
    const btn = document.getElementById('btn-ai-pdsa');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Drafting...`;

    const prompt = `
        Project Aim: "${d.aim}".
        PDSA Title: "${title}".
        Task: Draft a realistic PDSA cycle for this project.
        Return JSON format: { "desc": "Plan details...", "do": "Do details...", "study": "Study details...", "act": "Act details..." }
        Keep sections concise (2-3 sentences each).
    `;

    const result = await callAI(prompt, true);
    
    if(result) {
        document.getElementById('pdsa-plan').value = `${result.desc}\n\n[AI Drafted - Prediction]\n${result.study}`;
        showToast("Plan drafted", "success");
    }
    
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Draft`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiAnalyseChart = async () => {
    const d = state.projectData.chartData;
    if(!d || d.length < 5) { showToast("Need at least 5 data points", "error"); return; }
    
    const btn = document.getElementById('btn-ai-chart');
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Analysing...`;
    
    const sorted = [...d].sort((a,b) => new Date(a.date) - new Date(b.date));
    const dataStr = sorted.map(x => `${x.date}:${x.value}`).join(', ');
    
    const prompt = `
        Aim: "${state.projectData.checklist.aim}".
        Data (Date:Value): [${dataStr}].
        Task: Analyze this SPC/Run chart data. Identify shifts, trends, or outliers. 
        Conclude if there is improvement. Write a short paragraph for the "Results" section.
    `;
    
    const result = await callAI(prompt);
    
    if(result) {
        const box = document.getElementById('results-text');
        box.value = result.trim();
        window.saveResults(result.trim());
        showToast("Analysis complete", "success");
    }
    
    if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3"></i> AI Analyse`;
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.aiSuggestEvidence = async () => {
    const d = state.projectData.checklist;
    if (!d.problem_desc && !d.aim) { showToast("Define a problem or aim first", "error"); return; }
    
    const prompt = `
        Context: Quality Improvement in UK Emergency Medicine.
        Problem: "${d.problem_desc || 'Not defined'}"
        Aim: "${d.aim || 'Not defined'}"
        Task: Suggest relevant evidence, guidelines, and standards for this QIP.
        Include: NICE guidelines, RCEM standards, key research papers, CQC requirements.
        Format as a brief paragraph suitable for a literature review section.
        Keep under 150 words.
    `;
    
    const result = await callAI(prompt);
    
    if(result) {
        const existing = d.lit_review || '';
        state.projectData.checklist.lit_review = existing ? existing + '\n\n[AI Suggestions]\n' + result.trim() : result.trim();
        window.saveData();
        R.renderChecklist();
        showToast("Evidence suggestions added", "success");
    }
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
    _saveDebounceTimer = setTimeout(() => window.saveData(), 1500);
};

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

window.openGanttModal = R.openGanttModal;
window.saveGanttTask = () => {
    const name = document.getElementById('task-name').value;
    const start = document.getElementById('task-start').value;
    const end = document.getElementById('task-end').value;
    const type = document.getElementById('task-type').value;
    const owner = document.getElementById('task-owner').value;
    const milestone = document.getElementById('task-milestone').checked;
    const dependency = document.getElementById('task-dep')?.value;

    if(!name || !start || !end) { showToast("Missing task details", "error"); return; }
    
    if(dependency) {
        const depTask = state.projectData.gantt.find(t => t.id === dependency);
        if(depTask && new Date(depTask.end) > new Date(start)) {
            showToast(`Task must start after dependency '${depTask.name}' finishes.`, 'error');
            return;
        }
    }

    if(!state.projectData.gantt) state.projectData.gantt = [];
    state.projectData.gantt.push({ 
        id: Date.now().toString(), 
        name, start, end, type, owner, milestone, dependency 
    });
    
    window.saveData();
    document.getElementById('task-modal').classList.add('hidden');
    
    document.getElementById('task-name').value = '';
    document.getElementById('task-start').value = '';
    document.getElementById('task-end').value = '';
    document.getElementById('task-type').value = 'plan';
    document.getElementById('task-owner').value = '';
    document.getElementById('task-milestone').checked = false;
    document.getElementById('task-dep').value = '';
    
    R.renderGantt();
    showToast("Task added", "success");
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

window.saveData = async function(skipHistory = false) {
    if (state.isReadOnly) return;
    
    if (state.isDemoMode) { 
        if(!skipHistory) pushHistory();
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
        showToast("Database not connected. Changes saved locally.", "warning");
        return;
    }
    
    if(!skipHistory) pushHistory();
    
    try {
        await setDoc(doc(db, `users/${state.currentUser.uid}/projects`, state.currentProjectId), state.projectData, { merge: true });
        
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

// Quick-add data point from dashboard widget
window.quickAddDataPoint = async function() {
    if (!state.projectData || state.isReadOnly) return;
    const dateEl = document.getElementById('quick-add-date');
    const valEl = document.getElementById('quick-add-value');
    const phaseEl = document.getElementById('quick-add-phase');
    const date = dateEl?.value;
    const value = parseFloat(valEl?.value);
    if (!date || isNaN(value)) {
        showToast('Please enter a date and value', 'error');
        return;
    }
    const grade = phaseEl?.value || 'Intervention';
    if (!state.projectData.chartData) state.projectData.chartData = [];
    state.projectData.chartData.push({ date, value, grade });
    if (window.saveData) await window.saveData();
    showToast('Data point added', 'success');
    // Reset value input, keep date
    if (valEl) valEl.value = '';
    // Refresh dashboard mini-chart if visible
    if (typeof R !== 'undefined' && R.renderAll) R.renderAll('dashboard');
};

function pushHistory() {
    if(state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    if(state.historyStack.length > state.MAX_HISTORY) state.historyStack.shift();
    state.redoStack = []; 
    updateUndoRedoButtons();
}

window.undo = () => {
    if (state.historyStack.length === 0 || state.isReadOnly) return;
    state.redoStack.push(JSON.stringify(state.projectData));
    const prevState = state.historyStack.pop();
    state.projectData = JSON.parse(prevState);
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
    if (state.redoStack.length === 0 || state.isReadOnly) return;
    state.historyStack.push(JSON.stringify(state.projectData));
    const nextState = state.redoStack.pop();
    state.projectData = JSON.parse(nextState);
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
        const isShared = await checkShareLink();
        if (isShared) return;

        state.currentUser = user;
        if (user) {
            state.isMasterAdmin = (user.email && user.email.toLowerCase() === ADMIN_EMAIL);

            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('app-sidebar').classList.add('lg:flex');
            document.getElementById('auth-screen').classList.add('hidden');
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
                    setDoc(doc(db, 'qipUsers', user.uid), {
                        email: user.email || '',
                        displayName: user.displayName || '',
                        lastLogin: new Date().toISOString()
                    }, { merge: true }).catch(e => console.warn('[Profile] auto-save:', e));
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

async function checkShareLink() {
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
                state.projectData = docSnap.data();
                state.currentProjectId = sharePid;
                document.getElementById('project-header-title').textContent = state.projectData.meta.title + " (Shared)";
                window.router('dashboard');
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

// ─── QIP Lead status check ───────────────────────────────────────────────────
async function checkQIPLeadStatus(user) {
    if (!user?.email || !db) return;
    try {
        const projects = await getQIPLeadProjects(db, user.email);
        if (!projects.length) return;

        // Load data for each supervised project
        const enriched = [];
        for (const proj of projects) {
            try {
                const snap = await getDoc(doc(db, `users/${proj.ownerUid}/projects`, proj.projectId));
                if (snap.exists()) {
                    const d = snap.data();
                    // Compute a rough progress score
                    const c = d.checklist || {};
                    const filled = ['problem_desc','aim','outcome_measure','process_measure','lit_review','ethics'].filter(k=>c[k]).length;
                    const hasPdsa = (d.pdsa||[]).length > 0;
                    const hasData = (d.chartData||[]).length > 0;
                    const progress = Math.round(((filled/6)*50) + (hasPdsa?25:0) + (hasData?25:0));
                    enriched.push({ ...proj, _data: d, _progress: progress });
                }
            } catch(e) { enriched.push({ ...proj, _data: {}, _progress: 0 }); }
        }
        state.qipLeadProjects = enriched;
        state.isQIPLead = enriched.length > 0;

        if (enriched.length > 0) {
            // Show badge on projects page
            const badge = document.getElementById('qip-lead-badge');
            const badgeText = document.getElementById('qip-lead-badge-text');
            if (badge) badge.classList.remove('hidden');
            if (badgeText) badgeText.textContent = `Supervising ${enriched.length} QIP project${enriched.length > 1 ? 's' : ''} as Departmental QIP Lead`;
            // Show Lead Dashboard nav button + sidebar home button
            const navBtn = document.getElementById('nav-lead-dashboard');
            if (navBtn) navBtn.classList.remove('hidden');
            const leadHomeBtn = document.getElementById('sidebar-lead-home');
            if (leadHomeBtn) leadHomeBtn.classList.remove('hidden');
            // Render QIP Lead panel in supervisor section
            const panel = document.getElementById('qip-lead-panel');
            if (panel && state.currentUser) renderQIPLeadPanel(panel, db, state.currentUser.uid, state.currentProjectId);
        }
    } catch(e) {
        console.warn('[QIPLead] checkQIPLeadStatus error:', e);
    }
}

// Called from sidebar or projects page to show QIP Lead dashboard
window.showQIPLeadDashboard = function() {
    const container = document.getElementById('qip-lead-dashboard-container');
    const projectsView = document.getElementById('view-projects');
    if (!container) return;

    // Hide projects view, show lead dashboard within same view-projects area
    const inner = document.getElementById('project-list-inner');
    if (inner) inner.classList.add('hidden');
    container.classList.remove('hidden');

    renderQIPLeadDashboard(container, state.qipLeadProjects, (i) => {
        window.viewLeadProject(i);
    });
};

window.switchToOwnProjects = function() {
    const container = document.getElementById('qip-lead-dashboard-container');
    const inner = document.getElementById('project-list-inner');
    if (container) container.classList.add('hidden');
    if (inner) inner.classList.remove('hidden');
};

window.viewLeadProject = async function(idx) {
    const proj = state.qipLeadProjects[idx];
    if (!proj || !proj._data) return;
    // Set up read-only project view
    state.projectData = proj._data;
    state.currentProjectId = proj.projectId;
    state.isReadOnly = true;
    state.isLeadViewing = true;
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
    showToast('Viewing in read-only mode', 'info');
};

window.returnFromLeadView = function() {
    state.isReadOnly = false;
    state.isLeadViewing = false;
    state.projectData = null;
    window.showQIPLeadDashboard();
};

// ─── Add/Remove QIP Lead button handlers (called from supervisor view) ───────
window.addQIPLeadBtn = async function() {
    const input = document.getElementById('qip-lead-email-input');
    if (!input) return;
    const email = input.value.trim().toLowerCase();
    if (!email) { showToast('Enter a lead email address.', 'error'); return; }
    const d = state.projectData;
    if (!d || !state.currentUser) return;
    const success = await addQIPLeadToProject(
        db, state.currentUser.uid, state.currentProjectId,
        email,
        d.teamMembers?.[0]?.name || state.currentUser.email,
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
    if (!d?.qipLeads) return;
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
    if (!localStorage.getItem('qip_howto_seen')) {
        setTimeout(() => window.showHowTo(), 800);
    }

    const listEl = document.getElementById('project-list');
    
    if (state.isDemoMode) {
        listEl.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-rcem-purple relative cursor-pointer group hover:shadow-md transition-all" onclick="window.openDemoProject()">
             <div class="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 uppercase tracking-wide rounded-bl">Gold Standard</div>
             <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors">Improving Sepsis 6 Delivery in the ED</h3>
             <p class="text-xs text-slate-500 mb-4">Dr. J. Bloggs (ST6 Emergency Medicine)</p>
             <div class="flex gap-2 text-xs font-medium text-slate-500 flex-wrap">
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> 52 Data Points</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 5 PDSA Cycles</span>
                <span class="bg-slate-100 px-2 py-1 rounded border border-slate-200 flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> 6 Team Members</span>
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
        snap.forEach(doc => {
            const d = doc.data();
            const date = new Date(d.meta?.created).toLocaleDateString('en-GB');
            const titleText = escapeHtml(d.meta?.title) || 'Untitled';
            listEl.innerHTML += `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer relative group hover:shadow-md transition-all" onclick="window.openProject('${doc.id}')">
                    <h3 class="font-bold text-lg text-slate-800 mb-1 group-hover:text-rcem-purple transition-colors truncate" title="${titleText}">${titleText}</h3>
                    <p class="text-xs text-slate-400 mb-4">Created: ${date}</p>
                    <button onclick="event.stopPropagation(); window.deleteProject('${doc.id}')" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`;
        });
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

    const doCreate = async () => {
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.classList.add('border-red-400', 'ring-1', 'ring-red-400');
            titleInput.focus();
            return;
        }
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

window.openProject = (id) => {
    state.currentProjectId = id;
    if (window.unsubscribeProject) window.unsubscribeProject();
    
    if (!db) { showToast("No DB connection", "error"); return; }
    
    let firstLoad = true; // navigate to dashboard only once data is ready

    window.unsubscribeProject = onSnapshot(doc(db, `users/${state.currentUser.uid}/projects`, id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (!state.projectData) { 
                state.historyStack = [JSON.stringify(data)]; 
                state.redoStack = []; 
                updateUndoRedoButtons(); 
            }
            state.projectData = data;
            
            if(!state.projectData.checklist) state.projectData.checklist = {};
            if(!state.projectData.drivers) state.projectData.drivers = {primary:[], secondary:[], changes:[]};
            if(!state.projectData.fishbone) state.projectData.fishbone = emptyProject.fishbone;
            if(!state.projectData.pdsa) state.projectData.pdsa = [];
            if(!state.projectData.chartData) state.projectData.chartData = [];
            if(!state.projectData.stakeholders) state.projectData.stakeholders = [];
            if(!state.projectData.gantt) state.projectData.gantt = [];
            if(!state.projectData.teamMembers) state.projectData.teamMembers = [];
            if(!state.projectData.chartSettings) state.projectData.chartSettings = {};
            if(!state.projectData.process) state.projectData.process = ["Start", "End"];
            if(!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
            if(!state.projectData.patientFeedback) state.projectData.patientFeedback = [];
            if(!state.projectData.assessment) state.projectData.assessment = {
                traineeLevel: 'core', capabilitiesMet: [], supervisorComments: '',
                signedOff: false, signedOffBy: '', signedOffDate: ''
            };
            if(!state.projectData.surveys) state.projectData.surveys = [];
            migrateProjectData(state.projectData);
            
            const headerTitle = document.getElementById('project-header-title');
            if(headerTitle) headerTitle.textContent = state.projectData.meta.title;

            if (firstLoad) {
                // First snapshot: data is ready — now it's safe to navigate
                firstLoad = false;
                const topBar = document.getElementById('top-bar');
                if(topBar) topBar.classList.remove('hidden');
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
    state.currentProjectId = 'DEMO';
    state.historyStack = [JSON.stringify(state.projectData)];
    state.redoStack = [];
    updateUndoRedoButtons();

    const header = document.getElementById('project-header-title');
    if(header) header.textContent = state.projectData.meta.title + " (DEMO)";
    
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.classList.remove('hidden');
    window.router('dashboard');
};

window.shareProject = () => {
    if(state.isDemoMode) { showToast("Cannot share demo projects.", "error"); return; }
    const url = `${window.location.origin}${window.location.pathname}?share=${state.currentProjectId}&uid=${state.currentUser.uid}`;
    navigator.clipboard.writeText(url).then(() => showToast("Share Link copied!", "success"));
};

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.saveData(true);
        showToast("Project Saved", "success");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!e.shiftKey) {
            e.preventDefault();
            window.undo();
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        window.redo();
    }
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

// ==========================================
// RAPID BATCH DATA ENTRY
// ==========================================

window.addBatchEntryRow = function() {
    const tbody = document.getElementById('batch-entry-tbody');
    if (!tbody) return;
    const today = new Date().toISOString().split('T')[0];
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-50';
    tr.innerHTML = `
        <td class="py-0.5 pr-1"><input type="date" class="batch-date w-full p-0.5 border border-slate-200 rounded text-xs" value="${today}"></td>
        <td class="py-0.5 pr-1"><input type="number" class="batch-value w-24 p-0.5 border border-slate-200 rounded text-xs" placeholder="0" step="any"></td>
        <td class="py-0.5 pr-1"><select class="batch-phase w-full p-0.5 border border-slate-200 rounded text-xs">
            <option value="">—</option>
            <option value="Baseline">Baseline</option>
            <option value="PDSA 1">PDSA 1</option>
            <option value="PDSA 2">PDSA 2</option>
            <option value="PDSA 3">PDSA 3</option>
            <option value="PDSA 4">PDSA 4</option>
            <option value="Sustain">Sustain</option>
        </select></td>
        <td class="py-0.5 pl-1"><button onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-400 text-base leading-none px-1" title="Remove row">&times;</button></td>
    `;
    tbody.appendChild(tr);
};

window.initBatchEntry = function() {
    const tbody = document.getElementById('batch-entry-tbody');
    if (tbody && tbody.children.length === 0) {
        for (let i = 0; i < 3; i++) window.addBatchEntryRow();
    }
};

window.submitBatchEntry = function() {
    if (!state.projectData) { showToast('No project open', 'error'); return; }
    const rows = document.querySelectorAll('#batch-entry-tbody tr');
    let added = 0;
    const errors = [];
    rows.forEach((row, idx) => {
        const d = row.querySelector('.batch-date')?.value;
        const v = row.querySelector('.batch-value')?.value;
        const g = row.querySelector('.batch-phase')?.value || '';
        if (!d && !v) return; // skip blank rows silently
        if (!d) { errors.push(`Row ${idx + 1}: missing date`); return; }
        if (v === '' || v === null || v === undefined) { errors.push(`Row ${idx + 1}: missing value`); return; }
        const parsedValue = parseFloat(v);
        if (isNaN(parsedValue)) { errors.push(`Row ${idx + 1}: invalid value`); return; }
        if (!state.projectData.chartData) state.projectData.chartData = [];
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        state.projectData.chartData.push({ id, date: d, value: parsedValue, grade: g });
        added++;
    });
    if (errors.length > 0) {
        showToast(errors[0], 'error');
    }
    if (added > 0) {
        state.projectData.chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (window.saveData) window.saveData();
        if (window.renderDataView) window.renderDataView();
        const tbody = document.getElementById('batch-entry-tbody');
        if (tbody) { tbody.innerHTML = ''; for (let i = 0; i < 3; i++) window.addBatchEntryRow(); }
        showToast(`${added} point${added !== 1 ? 's' : ''} added`, 'success');
    } else if (errors.length === 0) {
        showToast('No data in rows — please enter dates and values', 'error');
    }
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

async function saveUserProfileToFirestore(uid, email, displayName) {
    if (!db) return;
    try {
        await setDoc(doc(db, 'qipUsers', uid), {
            email: email || '',
            displayName: displayName || '',
            roles: _regSelectedRoles,
            createdAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('[Register] Failed to save user profile to Firestore:', e);
    }
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

        // Known UID→email map seeded from Firebase Auth (covers all users pre-dating auto-save)
        const KNOWN_USER_EMAILS = {
            'n6JSBUsE0Kg4x5hvFQp252A0ny32': 'emevidence999@gmail.com',
            '57bYrw6cyKg42U4EYzRfFsmeEob2': 'helen-michelle.spindler@uhb.nhs.uk',
            'MYxJA61V3GNOxgqNwJ2kYkxIrmj2': 'sophie.mellor5@nhs.net',
            'G2HVZqpc5CYENZRHQNQl834JhPa2': 'breijes.05@gmail.com',
            'QNdzNb18T0YAxmh2BDubaiWYGLj1': 'chloe_thomson@hotmail.co.uk',
            'Mm1VlbNzvYS25JmASN8zjIBEh2v1': 'chloe.thomson635@gmail.com',
            'IcjFLqDIZufOZx72hmljb335Kvq2': 'testuser12345@example.com',
            '6rNMSd2TTqUZOY7XTS4nV0IMbsn1': 'jaketurner2503@gmail.com'
        };

        // Fetch user emails — qipUsers doc first, then KNOWN_USER_EMAILS fallback
        const userEmails = {};
        for (const uid of Object.keys(userMap)) {
            try {
                const uSnap = await getDoc(doc(db, 'qipUsers', uid));
                if (uSnap.exists()) {
                    const ud = uSnap.data();
                    userEmails[uid] = ud.displayName ? `${ud.displayName} (${ud.email})` : (ud.email || KNOWN_USER_EMAILS[uid] || `User (${uid.substring(0,8)}\u2026)`);
                } else {
                    const knownEmail = KNOWN_USER_EMAILS[uid];
                    if (knownEmail) {
                        userEmails[uid] = knownEmail;
                        // Silently seed qipUsers so future lookups hit the fast path
                        setDoc(doc(db, 'qipUsers', uid), { email: knownEmail }, { merge: true })
                            .catch(e => console.warn('[Admin] seed qipUsers:', e));
                    } else {
                        userEmails[uid] = `User (${uid.substring(0,8)}\u2026)`;
                    }
                }
            } catch (e) { userEmails[uid] = KNOWN_USER_EMAILS[uid] || `User (${uid.substring(0,8)}\u2026)`; }
        }

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
                const created = data.meta?.created ? new Date(data.meta.created).toLocaleDateString('en-GB') : '?';
                const updated = data.meta?.updated ? new Date(data.meta.updated).toLocaleDateString('en-GB') : '?';
                const pdsaCount = (data.pdsa || []).length;
                const dataPoints = (data.chartData || []).length;
                const c = data.checklist || {};
                const filled = ['problem_desc', 'aim', 'outcome_measure', 'process_measure', 'lit_review'].filter(k => c[k]).length;
                const progress = Math.round((filled / 5) * 100);

                html += `
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                         onclick="window.adminViewProject('${uid}', '${projectId}')">
                        <div class="flex items-start justify-between mb-2 gap-2">
                            <h3 class="font-bold text-slate-800 truncate group-hover:text-rcem-purple transition-colors" title="${title}">${title}</h3>
                            <span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">Read-only</span>
                        </div>
                        <p class="text-xs text-slate-400 mb-3">Created: ${created}&ensp;·&ensp;Updated: ${updated}</p>
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

window.adminViewProject = async function(uid, projectId) {
    if (!state.isMasterAdmin) return;
    try {
        const snap = await getDoc(doc(db, `users/${uid}/projects`, projectId));
        if (!snap.exists()) { showToast('Project not found', 'error'); return; }

        const data = snap.data();
        // Ensure all expected fields exist
        if (!data.checklist) data.checklist = {};
        if (!data.drivers) data.drivers = { primary: [], secondary: [], changes: [] };
        if (!data.fishbone) data.fishbone = {};
        if (!data.pdsa) data.pdsa = [];
        if (!data.chartData) data.chartData = [];
        if (!data.stakeholders) data.stakeholders = [];
        if (!data.gantt) data.gantt = [];
        if (!data.teamMembers) data.teamMembers = [];
        if (!data.chartSettings) data.chartSettings = {};
        if (!data.process) data.process = ['Start', 'End'];
        if (!data.surveys) data.surveys = [];

        state.projectData = data;
        state.currentProjectId = projectId;
        state.isReadOnly = true;
        state.isLeadViewing = false;

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

function loadProjectAccessIntoSettings() {
    const supervisors = state.projectData?.supervisors || [];
    const leads = state.projectData?.qipLeads || [];

    const supList = document.getElementById('settings-supervisor-list');
    if (supList) {
        supList.innerHTML = supervisors.length === 0
            ? '<p class="text-xs text-slate-400 italic">No supervisor added yet</p>'
            : supervisors.map((s, i) => `
                <div class="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5">
                    <span class="text-xs text-slate-700 font-medium">${s.email || s}</span>
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
                    <span class="text-xs text-slate-700 font-medium">${l.email || l}</span>
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
    if (!state.projectData.supervisors) state.projectData.supervisors = [];
    if (state.projectData.supervisors.some(s => (s.email || s) === email)) {
        showToast('That email is already listed as a supervisor', 'info'); return;
    }

    const entry = { email, addedAt: new Date().toISOString() };
    state.projectData.supervisors.push(entry);

    // Write supervisorInvites/{email} so supervisor sees this project on login
    try {
        const { doc, setDoc, arrayUnion } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const inviteEntry = {
            ownerUid: state.currentUser.uid,
            projectId: state.currentProjectId,
            projectTitle: state.projectData.checklist?.project_title || state.projectData.title || 'Untitled QIP',
            traineeName: state.currentUser.email,
            addedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'supervisorInvites', email),
            { email, projects: arrayUnion(inviteEntry) }, { merge: true });
    } catch (e) {
        console.warn('[Access] supervisorInvites write failed:', e);
    }

    window.saveData();
    if (input) input.value = '';
    loadProjectAccessIntoSettings();
    showToast(`Supervisor invite sent to ${email}`, 'success');
};

window.removeSettingsSupervisor = async function(index) {
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
    if (!state.projectData.qipLeads) state.projectData.qipLeads = [];
    if (state.projectData.qipLeads.some(l => l.email === email)) {
        showToast('That email is already listed as a QIP Lead', 'info'); return;
    }
    const { addQIPLeadToProject } = await import('./qip-lead.js');
    const ok = await addQIPLeadToProject(
        db, state.currentUser.uid, state.currentProjectId, email,
        state.currentUser.email,
        state.projectData.checklist?.project_title || state.projectData.title || 'Untitled QIP'
    );
    if (ok) {
        state.projectData.qipLeads.push({ email, addedAt: new Date().toISOString() });
        window.saveData();
        if (input) input.value = '';
        loadProjectAccessIntoSettings();
    }
};

window.removeSettingsLead = async function(index) {
    const leads = state.projectData?.qipLeads || [];
    const removed = leads[index];
    if (!removed) return;
    leads.splice(index, 1);
    const { removeQIPLeadFromProject } = await import('./qip-lead.js');
    await removeQIPLeadFromProject(db, state.currentUser?.uid, state.currentProjectId, removed.email || removed);
    window.saveData();
    loadProjectAccessIntoSettings();
    showToast('QIP Lead removed', 'info');
};

// Check if logged-in user is a supervisor for any projects
async function checkSupervisorStatus() {
    if (!state.currentUser || state.isMasterAdmin) return;
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const email = state.currentUser.email?.toLowerCase();
        if (!email) return;
        const snap = await getDoc(doc(db, 'supervisorInvites', email));
        if (!snap.exists()) return;
        const projects = snap.data().projects || [];
        if (projects.length === 0) return;
        state.supervisorProjects = projects;
        // Show supervisor home button in sidebar
        const btn = document.getElementById('sidebar-supervisor-home');
        if (btn) {
            btn.classList.remove('hidden');
            btn.onclick = () => window.showSupervisorProjectList();
        }
    } catch (e) {
        console.warn('[Supervisor] checkSupervisorStatus error:', e);
    }
}

// Show a picker so the supervisor can choose which project to review
window.showSupervisorProjectList = function() {
    const projects = state.supervisorProjects || [];
    if (projects.length === 0) { showToast('No supervised projects found', 'info'); return; }
    if (projects.length === 1) {
        loadSupervisedProject(projects[0]);
        return;
    }
    // Multiple projects — show a simple modal-style picker
    window.showInputModal(
        'Select Supervised Project',
        projects.map((p, i) => ({ id: `proj_${i}`, label: `${p.projectTitle || 'Untitled'} (${p.traineeName || p.ownerUid})`, type: 'hidden', value: String(i) })),
        () => {}
    );
    // Override: show a list instead of inputs
    const fieldsEl = document.getElementById('input-modal-fields');
    if (fieldsEl) {
        fieldsEl.innerHTML = projects.map((p, i) => `
            <button onclick="window.loadSupervisedProjectByIndex(${i})" class="w-full text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg px-4 py-3 transition-colors">
                <div class="font-semibold text-slate-800">${p.projectTitle || 'Untitled QIP'}</div>
                <div class="text-xs text-slate-500">Trainee: ${p.traineeName || p.ownerUid}</div>
            </button>`).join('');
    }
    const btn = document.getElementById('input-modal-submit');
    if (btn) btn.style.display = 'none';
};

window.loadSupervisedProjectByIndex = function(i) {
    const p = (state.supervisorProjects || [])[i];
    if (p) loadSupervisedProject(p);
    window.hideInputModal();
};

async function loadSupervisedProject(p) {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const snap = await getDoc(doc(db, 'users', p.ownerUid, 'projects', p.projectId));
        if (!snap.exists()) { showToast('Project not found', 'error'); return; }
        state.currentProjectId = p.projectId;
        state.projectData = snap.data();
        state.isLeadViewing = true;
        showToast(`Viewing: ${p.projectTitle || 'QIP'}`, 'success');
        window.router('supervisor');
    } catch (e) {
        showToast('Could not load project: ' + e.message, 'error');
        console.error('[Supervisor] loadSupervisedProject error:', e);
    }
}
