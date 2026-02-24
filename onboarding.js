import { state } from "./state.js";
import { escapeHtml, showToast } from "./utils.js";

// ==========================================
// ONBOARDING WIZARD LOGIC
// ==========================================

let currentStep = 1;
const totalSteps = 4;

export function startOnboarding() {
    currentStep = 1;
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        renderOnboardingStep();
    }
}

function renderOnboardingStep() {
    const content = document.getElementById('onboarding-content');
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnNext = document.getElementById('btn-onboarding-next');
    const d = state.projectData?.checklist || {};

    if (!content) return;

    btnPrev.classList.toggle('hidden', currentStep === 1);
    btnNext.textContent = currentStep === totalSteps ? 'Finish Setup' : 'Next Step';

    let html = '';

    if (currentStep === 1) {
        html = `
            <div class="space-y-4 animate-fade-in">
                <div class="flex items-center gap-3 text-rcem-purple mb-4">
                    <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center font-bold shadow">1</div>
                    <h4 class="text-xl font-bold">Define the Problem</h4>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">Every great QIP starts with a clear problem. What is the specific issue in the Emergency Department you want to solve?</p>
                <textarea id="onboarding-problem" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px] focus:ring-2 focus:ring-rcem-purple outline-none" placeholder="e.g. Only 40% of patients receive antibiotics within 60 minutes for Red Flag Sepsis, leading to...">${escapeHtml(d.problem_desc || '')}</textarea>
                
                <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-4 flex items-start gap-3">
                    <i data-lucide="lightbulb" class="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5"></i>
                    <div>
                        <p class="text-sm text-indigo-900 font-medium mb-1">Stuck for ideas?</p>
                        <p class="text-xs text-indigo-700 mb-2">Browse common ED problems that make excellent portfolio projects.</p>
                        <button onclick="window.openTopicBank()" class="text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 border border-indigo-200 transition-colors font-medium">Browse Topic Ideas Bank</button>
                    </div>
                </div>
            </div>
        `;
    } else if (currentStep === 2) {
        html = `
            <div class="space-y-4 animate-fade-in">
                <div class="flex items-center gap-3 text-amber-500 mb-4">
                    <div class="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow">2</div>
                    <h4 class="text-xl font-bold text-slate-800">Set a SMART Aim</h4>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">Turn your problem into a goal. It must be <strong class="text-slate-800">S</strong>pecific, <strong class="text-slate-800">M</strong>easurable, <strong class="text-slate-800">A</strong>chievable, <strong class="text-slate-800">R</strong>elevant, and <strong class="text-slate-800">T</strong>ime-bound.</p>
                <textarea id="onboarding-aim" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-amber-500 outline-none" placeholder="To [increase/decrease] [measure] from [baseline] to [target] by [date] in [setting]">${escapeHtml(d.aim || '')}</textarea>
                
                <div class="flex gap-2 mt-2">
                    <button onclick="window.openSmartAimBuilder()" class="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-slate-50 transition-all font-medium">
                        <i data-lucide="edit-3" class="w-3 h-3"></i> Use Aim Builder
                    </button>
                </div>
            </div>
        `;
    } else if (currentStep === 3) {
        html = `
            <div class="space-y-4 animate-fade-in">
                <div class="flex items-center gap-3 text-blue-500 mb-4">
                    <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow">3</div>
                    <h4 class="text-xl font-bold text-slate-800">Determine Measures</h4>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">How will you know that a change is an improvement?</p>
                
                <div class="space-y-4">
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label class="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Outcome Measure
                        </label>
                        <p class="text-xs text-slate-500 mb-2">The ultimate goal (e.g. percentage compliance with standard)</p>
                        <input type="text" id="onboarding-outcome" class="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="e.g. percentage of patients receiving antibiotics under 60 mins" value="${escapeHtml(d.outcome_measure || '')}">
                    </div>
                    
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label class="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Process Measure
                        </label>
                        <p class="text-xs text-slate-500 mb-2">Steps to get there (e.g. triage screening rate)</p>
                        <input type="text" id="onboarding-process" class="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="e.g. percentage of patients with NEWS2 calculated at triage" value="${escapeHtml(d.process_measure || '')}">
                    </div>
                </div>
            </div>
        `;
    } else if (currentStep === 4) {
        html = `
            <div class="space-y-4 animate-fade-in">
                <div class="flex items-center gap-3 text-emerald-500 mb-4">
                    <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow">4</div>
                    <h4 class="text-xl font-bold text-slate-800">Plan First PDSA Cycle</h4>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">Do not try to fix everything at once. What is the very first, small change you want to test?</p>
                
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cycle Title</label>
                        <input type="text" id="onboarding-pdsa-title" class="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm" placeholder="e.g. Test new screening tool on 1 shift">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Plan & Prediction</label>
                        <textarea id="onboarding-pdsa-plan" class="w-full p-3 border border-slate-300 rounded text-sm min-h-[100px] focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="What exactly will you do? What do you PREDICT will happen?"></textarea>
                    </div>
                </div>
            </div>
        `;
    }

    // Progress indicators
    html += `
        <div class="flex justify-center gap-3 mt-8 pt-4 border-t border-slate-100">
            ${[1, 2, 3, 4].map(i => `
                <div class="w-12 h-1.5 rounded-full transition-colors ${i === currentStep ? 'bg-rcem-purple' : i < currentStep ? 'bg-indigo-200' : 'bg-slate-200'}"></div>
            `).join('')}
        </div>
    `;

    content.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function nextOnboardingStep() {
    saveCurrentStepData();
    if (currentStep < totalSteps) {
        currentStep++;
        renderOnboardingStep();
    } else {
        finishOnboarding();
    }
}

export function prevOnboardingStep() {
    saveCurrentStepData();
    if (currentStep > 1) {
        currentStep--;
        renderOnboardingStep();
    }
}

function saveCurrentStepData() {
    if (!state.projectData) return;
    if (!state.projectData.checklist) state.projectData.checklist = {};

    if (currentStep === 1) {
        const el = document.getElementById('onboarding-problem');
        if (el) state.projectData.checklist.problem_desc = el.value;
    } else if (currentStep === 2) {
        const el = document.getElementById('onboarding-aim');
        if (el) state.projectData.checklist.aim = el.value;
    } else if (currentStep === 3) {
        const outEl = document.getElementById('onboarding-outcome');
        const procEl = document.getElementById('onboarding-process');
        if (outEl) state.projectData.checklist.outcome_measure = outEl.value;
        if (procEl) state.projectData.checklist.process_measure = procEl.value;
    } else if (currentStep === 4) {
        const titleEl = document.getElementById('onboarding-pdsa-title');
        const planEl = document.getElementById('onboarding-pdsa-plan');
        
        if (titleEl && titleEl.value.trim()) {
            if (!state.projectData.pdsa) state.projectData.pdsa = [];
            
            // Only add if we do not already have one to avoid duplicates if they go back and forth
            if (state.projectData.pdsa.length === 0) {
                state.projectData.pdsa.push({
                    title: titleEl.value,
                    plan: planEl ? planEl.value : '',
                    desc: planEl ? planEl.value : '',
                    startDate: new Date().toISOString().split('T')[0],
                    status: 'planning',
                    do: '', study: '', act: ''
                });
            } else {
                // Update existing first cycle if they go back and edit
                state.projectData.pdsa[0].title = titleEl.value;
                if (planEl) {
                    state.projectData.pdsa[0].plan = planEl.value;
                    state.projectData.pdsa[0].desc = planEl.value;
                }
            }
        }
    }
    
    if (window.saveData) window.saveData(true);
}

function finishOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    showToast("Project setup complete!", "success");
    if (window.router) window.router('checklist');
    if (window.renderChecklist) window.renderChecklist();
}

// Bind event listeners natively so they work automatically
document.addEventListener('DOMContentLoaded', () => {
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnPrev = document.getElementById('btn-onboarding-prev');
    
    if (btnNext) btnNext.addEventListener('click', nextOnboardingStep);
    if (btnPrev) btnPrev.addEventListener('click', prevOnboardingStep);
    
    // Expose globally for inline HTML calls
    window.startOnboarding = startOnboarding;
    window.nextOnboardingStep = nextOnboardingStep;
    window.prevOnboardingStep = prevOnboardingStep;
});
