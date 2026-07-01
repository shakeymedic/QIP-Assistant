import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea, formatDate } from "./utils.js";
import { 
    renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, 
    setToolMode, renderFullViewChart, makeDraggable, chartMode, toolMode
} from "./charts.js";

// Import external modules to populate missing DOM elements
import { renderPatientTracker } from "./patient-tracker.js";
import { renderGreenCalculator, calculateCarbonSavings } from "./green-calculator.js";
import { renderSurveys } from "./surveys.js";

// ==========================================
// 1. MAIN ROUTER & NAVIGATION
// ==========================================

export function renderAll(view) {
    updateNavigationUI(view);
    
    switch(view) {
        case 'projects': break; 
        case 'dashboard': renderDashboard(); break;
        case 'checklist': 
            renderChecklist(); 
            if (typeof renderPatientTracker === 'function') renderPatientTracker();
            break; 
        case 'team': renderTeam(); break;
        case 'tools': renderTools(); break;
        case 'data': renderDataView(); break;       
        case 'pdsa': renderPDSA(); break;
        case 'surveys': renderSurveys(); break;
        case 'stakeholders': renderStakeholders(); break;
        case 'gantt': renderGantt(); break;
        case 'green': 
            if (typeof renderGreenCalculator === 'function') renderGreenCalculator(); 
            break;         
        case 'full': renderFullProject(); break;    
        case 'publish': renderPublish(); break;     
        default: renderDashboard();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateNavigationUI(currentView) {
    // Grey out project nav items when no project is loaded
    const allProjectNavIds = ['dashboard', 'checklist', 'team', 'tools', 'pdsa', 'data', 'publish', 'surveys', 'stakeholders', 'gantt', 'supervisor', 'green', 'full', 'learn'];
    const hasProject = !!state.projectData;
    allProjectNavIds.forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if (!btn) return;
        if (hasProject) {
            btn.classList.remove('nav-btn-disabled');
            btn.removeAttribute('title');
        } else {
            btn.classList.add('nav-btn-disabled');
            btn.title = 'Select a project first';
        }
    });

    const navItems = ['checklist', 'team', 'tools', 'pdsa', 'data', 'publish', 'surveys'];
    navItems.forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if(!btn) return;
        
        let status = '';
        const d = state.projectData;
        if (!d) return;
        
        if(id === 'checklist' && d.checklist && d.checklist.aim && d.checklist.problem_desc) status = '✓';
        else if(id === 'data' && d.chartData && d.chartData.length >= 6) status = '✓';
        else if(id === 'pdsa' && d.pdsa && d.pdsa.length > 0) status = '✓';
        else if(id === 'team' && d.teamMembers && d.teamMembers.length > 0) status = '✓';
        else if(id === 'publish' && d.checklist && d.checklist.ethics) status = '✓';
        else if(id === 'tools' && d.drivers && (d.drivers.primary.length > 0 || d.drivers.changes.length > 0)) status = '✓';
        else if(id === 'surveys' && d.surveys && d.surveys.length > 0) status = '✓';
        
        const existingBadge = btn.querySelector('.status-badge');
        if(existingBadge) existingBadge.remove();

        if(status) {
            const badge = document.createElement('span');
            badge.className = 'status-badge ml-auto text-emerald-400 font-bold text-xs';
            badge.textContent = status;
            btn.appendChild(badge);
        }
    });

    // FRCEM domain progress chip
    const chip = document.getElementById('frcem-progress-chip');
    if (chip && state.projectData) {
        const d2 = state.projectData;
        const c2 = d2.checklist || {};
        const domains = [
            !!(c2.problem_desc && c2.problem_evidence),
            !!(c2.aim),
            !!(d2.drivers && (d2.drivers.primary?.length > 0 || d2.drivers.changes?.length > 0)),
            !!(d2.pdsa && d2.pdsa.length > 0),
            !!(d2.chartData && d2.chartData.length >= 6),
            !!(c2.learning_points),
            !!(c2.sustainability || c2.spreadPlan?.whoAdopts),
            !!(c2.ethics)
        ];
        const score = domains.filter(Boolean).length;
        const pct = Math.round((score / 8) * 100);
        const chipColor = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
        chip.innerHTML = `<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20">
            <div class="flex-1 bg-white/20 rounded-full h-1.5"><div class="${chipColor} h-1.5 rounded-full transition-all" style="width:${pct}%"></div></div>
            <span class="text-xs font-bold text-white whitespace-nowrap">${score}/8 FRCEM</span>
        </div>`;
    } else if (chip) {
        chip.innerHTML = '';
    }
}

// ==========================================
// 2. DASHBOARD VIEW
// ==========================================

export function renderDashboard() {
    const d = state.projectData;
    if (!d) return;

    const headerTitle = document.getElementById('project-header-title');
    if(headerTitle) headerTitle.textContent = d.meta?.title || 'Untitled Project';

    const checks = d.checklist || {};
    const fields = ['problem_desc', 'problem_context', 'problem_evidence', 'aim', 'outcome_measure', 'process_measure', 'balance_measure', 'ethics', 'lit_review', 'learning_points', 'sustainability', 'results_analysis'];
    const filled = fields.filter(f => checks[f] && checks[f].trim()).length;
    const progress = Math.round((filled / fields.length) * 100);
    
    const progressEl = document.getElementById('stat-progress');
    if(progressEl) {
        progressEl.innerHTML = `
            <div class="text-2xl font-bold text-slate-800">${progress}%</div>
            <div class="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                <div class="bg-emerald-500 h-1.5 rounded-full transition-all" style="width: ${progress}%"></div>
            </div>
        `;
    }

    const statPdsa = document.getElementById('stat-pdsa');
    if(statPdsa) statPdsa.textContent = (d.pdsa || []).length;
    
    const statData = document.getElementById('stat-data');
    if(statData) statData.textContent = (d.chartData || []).length;
    
    const statDrivers = document.getElementById('stat-drivers');
    if(statDrivers) {
        const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
        statDrivers.textContent = drivers.primary.length + drivers.secondary.length + drivers.changes.length;
    }

    const aimDisplay = document.getElementById('dash-aim-display');
    if(aimDisplay) {
        aimDisplay.innerHTML = checks.aim ? escapeHtml(checks.aim) : '<span class="text-slate-400">No aim defined yet. Go to Define & Measure to set your SMART aim.</span>';
    }

    const aimBadge = document.getElementById('aim-quality-badge');
    if(aimBadge && checks.aim) {
        const aim = checks.aim.toLowerCase();
        const hasSpecific = aim.includes('%') || aim.includes('reduce') || aim.includes('increase') || aim.includes('improve');
        const hasMeasurable = aim.includes('%') || /\d/.test(aim);
        const hasTimebound = aim.includes('month') || aim.includes('week') || aim.includes('by ') || aim.includes('within');
        
        let quality = 0;
        if(hasSpecific) quality++;
        if(hasMeasurable) quality++;
        if(hasTimebound) quality++;
        
        const badges = {
            0: { text: 'Needs work', color: 'bg-red-100 text-red-700' },
            1: { text: 'Basic', color: 'bg-amber-100 text-amber-700' },
            2: { text: 'Good', color: 'bg-blue-100 text-blue-700' },
            3: { text: 'SMART ✓', color: 'bg-emerald-100 text-emerald-700' }
        };
        
        const b = badges[quality];
        aimBadge.innerHTML = `<span class="px-2 py-0.5 rounded-full text-xs font-bold ${b.color}">${b.text}</span>`;
    } else if (aimBadge) {
        aimBadge.innerHTML = '';
    }

    renderQICoachBanner();
    renderMiniChart();
    renderRecentActivity();
    updatePortfolioReadiness();
    renderARCPCountdown();

    // Pre-fill Quick-add date with today
    const qaDate = document.getElementById('quick-add-date');
    if (qaDate && !qaDate.value) {
        qaDate.value = new Date().toISOString().split('T')[0];
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updatePortfolioReadiness() {
    const d = state.projectData;
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const isHigher = d.meta?.trainingStage === 'higher';
    
    const criteria = [
        { label: 'Clear Problem Statement', met: !!c.problem_desc },
        { label: 'SMART Aim', met: !!c.aim },
        { label: 'Measures Defined', met: !!(c.outcome_measure || c.process_measure) },
        { label: 'Driver Diagram', met: (d.drivers?.primary?.length > 0) },
        { label: isHigher ? '3+ PDSA Cycles' : '1+ PDSA Cycle', met: isHigher ? pdsa.length >= 3 : pdsa.length >= 1 },
        { label: 'Data Chart with Analysis', met: (d.chartData?.length >= 5 && !!c.results_analysis) },
        { label: 'Learning Reflections', met: !!c.learning_points },
        { label: 'Sustainability Plan', met: !!c.sustainability },
        { label: 'QI Team Defined', met: (d.teamMembers?.length >= 1) },
        { label: 'Stakeholder Map Completed', met: (d.stakeholders?.length >= 1) },
        { label: 'Project Timeline Populated', met: (d.gantt?.length >= 1 || d.timeline?.length >= 1) },
        { label: 'Supervisor Signed Off', met: !!(d.assessment?.signedOffBy) }
    ];
    
    const metCount = criteria.filter(cr => cr.met).length;
    const percent = Math.round((metCount / criteria.length) * 100);
    
    const container = document.getElementById('readiness-content');
    if (container) {
        container.innerHTML = `
            <div class="flex items-center gap-4 mb-4">
                <div class="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl ${percent === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">
                    ${percent}%
                </div>
                <div>
                    <div class="text-sm font-bold text-slate-800">${percent === 100 ? 'Ready for Submission!' : 'Work in Progress'}</div>
                    <div class="text-xs text-slate-500">Met ${metCount} of ${criteria.length} key requirements for ${isHigher ? 'Higher' : 'ACCS'} level.</div>
                </div>
            </div>
            <div class="space-y-2">
                ${criteria.map(cr => `
                    <div class="flex items-center justify-between text-xs p-1 rounded hover:bg-slate-50">
                        <span class="${cr.met ? 'text-slate-600' : 'text-slate-400'}">${cr.label}</span>
                        <i data-lucide="${cr.met ? 'check-circle' : 'circle'}" class="w-4 h-4 ${cr.met ? 'text-emerald-500' : 'text-slate-300'}"></i>
                    </div>
                `).join('')}
            </div>
            ${percent < 100 ? `
                <button onclick="window.openGoldenThreadValidator()" class="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="shield-check" class="w-4 h-4"></i> Validate Golden Thread
                </button>
            ` : ''}
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function renderARCPCountdown() {
    const display = document.getElementById('arcp-countdown-display');
    const input = document.getElementById('arcp-date-input');
    if (!display) return;

    const arcpDate = state.projectData?.meta?.arcpDate;
    if (input && arcpDate) input.value = arcpDate;

    if (!arcpDate) {
        display.innerHTML = `<p class="text-xs text-slate-400">Set your ARCP date below to see your countdown.</p>`;
        return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(arcpDate); target.setHours(0,0,0,0);
    const days = Math.round((target - today) / 86400000);

    let color, label, icon;
    if (days < 0) {
        color = 'text-slate-500'; label = `${Math.abs(days)} days ago`; icon = 'calendar-x';
    } else if (days <= 30) {
        color = 'text-red-600'; label = `${days} days`; icon = 'alarm-clock';
    } else if (days <= 90) {
        color = 'text-amber-600'; label = `${days} days`; icon = 'clock';
    } else {
        color = 'text-emerald-600'; label = `${days} days`; icon = 'calendar-check';
    }

    display.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="text-3xl font-black ${color}">${days < 0 ? 'Past' : label}</div>
            <div class="text-xs text-slate-500">${days < 0 ? `ARCP was ${label}` : `until ARCP<br><span class="text-slate-400">${target.toLocaleDateString('en-GB')}</span>`}</div>
        </div>
        ${days >= 0 && days <= 30 ? '<p class="text-xs text-red-600 font-bold mt-1">Imminent — ensure portfolio is submission-ready!</p>' : ''}
        ${days > 30 && days <= 90 ? '<p class="text-xs text-amber-600 mt-1">Getting close — review your portfolio readiness score.</p>' : ''}
    `;
}

function renderQICoachBanner() {
    const banner = document.getElementById('qi-coach-banner');
    if (!banner) return;
    
    const d = state.projectData;
    const checks = d.checklist || {};
    const pdsa = d.pdsa || [];
    const data = d.chartData || [];
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    
    let tip = '';
    let icon = 'lightbulb';
    let color = 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200';
    
    if (!checks.problem_desc) {
        tip = "Start by defining your problem statement in Define & Measure. Use the Topic Ideas Bank if you need inspiration!";
    } else if (!checks.aim) {
        tip = "Now set a SMART aim: Specific, Measurable, Achievable, Relevant, Time-bound. Use the Interactive Builder.";
    } else if (drivers.primary.length === 0) {
        tip = "Build your Driver Diagram in the Tools section. What are the main factors affecting your aim?";
        icon = 'git-branch';
    } else if (data.length < 6) {
        tip = `You have ${data.length} data points. Collect at least 12 baseline points before making changes for a reliable run chart.`;
        icon = 'bar-chart-2';
    } else if (pdsa.length === 0) {
        tip = "Ready to test a change? Document your first PDSA cycle. Ensure you write down a prediction in the Plan section.";
        icon = 'refresh-cw';
        color = 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200';
    } else if (!checks.ethics) {
        tip = "Don't forget governance! Document your ethical considerations and any approvals needed.";
        icon = 'shield-check';
    } else {
        tip = "Excellent progress! Keep iterating through PDSA cycles. Remember to use the Golden Thread Validator to ensure coherence.";
        icon = 'trophy';
        color = 'bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200';
    }
    
    banner.innerHTML = `
        <div class="${color} border rounded-xl p-4 flex items-start gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                <i data-lucide="${icon}" class="w-5 h-5 text-rcem-purple"></i>
            </div>
            <div class="flex-1">
                <div class="text-xs font-bold text-slate-500 uppercase mb-1">QI Coach Tip</div>
                <p class="text-sm text-slate-700">${tip}</p>
            </div>
        </div>
    `;
}

function renderMiniChart() {
    const container = document.getElementById('dash-mini-chart');
    if (!container) return;
    
    const d = state.projectData;
    const data = d.chartData || [];
    
    if (data.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-12 text-sm">No data yet. Add data points in the Data view.</div>';
        return;
    }
    
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const values = sorted.map(x => x.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    
    // Chart dimensions with margins for axis labels
    const W = 320, H = 200, MT = 10, MB = 40, ML = 50, MR = 16;
    const chartW = W - ML - MR;
    const chartH = H - MT - MB;
    
    // Calculate median from first 12 baseline points
    const baseVals = [...values.slice(0, 12)].sort((a, b) => a - b);
    const median = baseVals[Math.floor(baseVals.length / 2)] || 0;
    const medianY = MT + chartH - ((median - min) / range) * chartH;
    
    const points = values.map((v, i) => {
        const x = ML + (i / (values.length - 1 || 1)) * chartW;
        const y = MT + chartH - ((v - min) / range) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    // Y-axis ticks (4 ticks)
    const yTicks = [min, min + range * 0.33, min + range * 0.67, max];
    const yTickSvg = yTicks.map(v => {
        const y = (MT + chartH - ((v - min) / range) * chartH).toFixed(1);
        return `<line x1="${ML - 4}" y1="${y}" x2="${ML}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>
                <text x="${ML - 6}" y="${y}" dominant-baseline="middle" text-anchor="end" font-size="10" fill="#94a3b8">${Math.round(v)}</text>
                <line x1="${ML}" y1="${y}" x2="${W - MR}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
    }).join('');
    
    // X-axis: show first, middle, last date labels
    const xLabels = [];
    if (sorted.length >= 1) xLabels.push({ i: 0, label: formatDate(sorted[0].date) });
    if (sorted.length >= 3) xLabels.push({ i: Math.floor((sorted.length - 1) / 2), label: formatDate(sorted[Math.floor((sorted.length - 1) / 2)].date) });
    if (sorted.length >= 2) xLabels.push({ i: sorted.length - 1, label: formatDate(sorted[sorted.length - 1].date) });
    
    const xLabelSvg = xLabels.map(({ i, label }) => {
        const x = (ML + (i / (values.length - 1 || 1)) * chartW).toFixed(1);
        return `<text x="${x}" y="${H - MB + 14}" text-anchor="middle" font-size="10" fill="#94a3b8">${label}</text>`;
    }).join('');
    
    const settings = d.chartSettings || {};
    const yLabel = settings.yAxisLabel || 'Measure';
    
    container.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500 font-medium">${sorted.length} data point${sorted.length !== 1 ? 's' : ''}</span>
            <span class="text-xs text-slate-400">Median: <strong class="text-slate-600">${median.toFixed(1)}</strong></span>
        </div>
        <svg width="100%" viewBox="0 0 ${W} ${H}" class="overflow-visible">
            <!-- Y-axis -->
            <line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + chartH}" stroke="#cbd5e1" stroke-width="1"/>
            <!-- X-axis -->
            <line x1="${ML}" y1="${MT + chartH}" x2="${W - MR}" y2="${MT + chartH}" stroke="#cbd5e1" stroke-width="1"/>
            <!-- Y ticks & gridlines -->
            ${yTickSvg}
            <!-- Median line -->
            <line x1="${ML}" y1="${medianY.toFixed(1)}" x2="${W - MR}" y2="${medianY.toFixed(1)}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.7"/>
            <!-- Data line -->
            <polyline fill="none" stroke="#2d2e83" stroke-width="2.5" points="${points}" stroke-linejoin="round"/>
            <!-- Data points -->
            ${values.map((v, i) => {
                const x = (ML + (i / (values.length - 1 || 1)) * chartW).toFixed(1);
                const y = (MT + chartH - ((v - min) / range) * chartH).toFixed(1);
                return `<circle cx="${x}" cy="${y}" r="4" fill="#2d2e83" stroke="white" stroke-width="1.5"/>`;
            }).join('')}
            <!-- X-axis date labels -->
            ${xLabelSvg}
            <!-- Y-axis label -->
            <text x="12" y="${MT + chartH / 2}" transform="rotate(-90, 12, ${MT + chartH / 2})" text-anchor="middle" font-size="10" fill="#94a3b8" font-weight="500">${escapeHtml(yLabel)}</text>
        </svg>
    `;
}

function renderRecentActivity() {
    const container = document.getElementById('dash-activity');
    if (!container) return;
    
    const d = state.projectData;
    const activities = [];
    
    (d.pdsa || []).forEach(p => {
        activities.push({
            type: 'pdsa',
            icon: 'refresh-cw',
            color: 'text-blue-500',
            text: `PDSA Cycle: ${p.title || 'Untitled'}`,
            date: p.startDate || p.start || ''
        });
    });
    
    const recentData = [...(d.chartData || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    recentData.forEach(dp => {
        activities.push({
            type: 'data',
            icon: 'plus-circle',
            color: 'text-emerald-500',
            text: `Data: ${dp.value} (${dp.grade || 'No phase'})`,
            date: dp.date
        });
    });
    
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (activities.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-4 text-sm">No recent activity</div>';
        return;
    }
    
    container.innerHTML = activities.slice(0, 5).map(a => `
        <div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
            <i data-lucide="${a.icon}" class="w-4 h-4 ${a.color}"></i>
            <div class="flex-1 text-sm text-slate-700 truncate">${escapeHtml(a.text)}</div>
            <div class="text-xs text-slate-400">${a.date}</div>
        </div>
    `).join('');
}

// ==========================================
// 3. CHECKLIST (DEFINE & MEASURE) VIEW
// ==========================================

export function renderChecklist() {
    const d = state.projectData;
    if (!d) return;
    
    const container = document.getElementById('checklist-container');
    if (!container) return;
    
    const c = d.checklist || {};
    const swot = c.swot || {};
    const pest = c.pest || {};
    const swotMode = c.swotMode || 'swot';
    const swotOpen = !!c.swotOpen;
    const fmea = d.fmea || [];
    const spreadPlan = c.spreadPlan || {};
    
    // Completion dot helper
    const csDot = (ok) => ok
        ? '<span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0" title="Complete">✓</span>'
        : '<span class="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs flex-shrink-0" title="Not yet complete">○</span>';
    
    container.innerHTML = `
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <i data-lucide="clipboard-check" class="text-rcem-purple"></i>
                Define & Measure
            </h1>
            <p class="text-slate-500 mt-2">Complete these sections to build a solid QIP foundation</p>
        </header>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-1" onclick="window.toggleChecklistSection(1)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">1</span>
                Problem Definition
                ${csDot(!!c.problem_desc)}
                <button onclick="window.showExample('problem');event.stopPropagation();" class="ml-auto text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1">
                    <i data-lucide="eye" class="w-3 h-3"></i> See Example
                </button>
                <i data-lucide="chevron-down" id="cs-chevron-1" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
            </h2>
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-sm font-medium text-slate-700">Problem Statement *</label>
                        <button onclick="window.openTopicBank()" class="text-xs text-rcem-purple hover:underline flex items-center gap-1"><i data-lucide="library" class="w-3 h-3"></i> Topic Ideas Bank</button>
                    </div>
                    <textarea id="check-problem" onchange="window.saveChecklistField('problem_desc', this.value)" oninput="window.updateFieldWC(this,'wc-problem')"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="What is the current problem? Be specific about the gap between current and desired state.">${escapeHtml(c.problem_desc || '')}</textarea>
                    <div class="flex justify-end mt-1">
                        <span id="wc-problem" class="text-xs ${(() => { const w = wc(c.problem_desc||''); return w===0?'text-slate-300':w<20?'text-amber-500':w<250?'text-emerald-600 font-medium':'text-amber-600 font-medium'; })()}">${wc(c.problem_desc||'')}w</span>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Department Context &amp; Setting</label>
                    <textarea id="check-context" onchange="window.saveChecklistField('problem_context', this.value)" 
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="Department setting, patient volume, governance framework (NatSSIPs/LOCSSIPs), PPI considerations.">${escapeHtml(c.problem_context || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Baseline Evidence &amp; Data</label>
                    <textarea id="check-evidence" onchange="window.saveChecklistField('problem_evidence', this.value)" 
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="Baseline audit results, national standards gap, pilot data — what demonstrates the problem quantitatively?">${escapeHtml(c.problem_evidence || '')}</textarea>
                </div>

                <!-- SWOT / PEST collapsible panel -->
                <div class="border border-slate-200 rounded-lg overflow-hidden mt-2">
                    <button onclick="window.toggleSWOTPESTPanel()" class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-all">
                        <span class="flex items-center gap-2"><i data-lucide="layout-grid" class="w-4 h-4 text-indigo-500"></i> SWOT / PEST Analysis</span>
                        <i data-lucide="${swotOpen ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-slate-400"></i>
                    </button>
                    <div id="swot-pest-body" class="${swotOpen ? '' : 'hidden'} p-4">
                        <!-- Mode toggle -->
                        <div class="flex gap-2 mb-4">
                            <button onclick="window.setSWOTMode('swot')" class="px-3 py-1 rounded text-xs font-bold border transition-all ${swotMode==='swot' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}">SWOT</button>
                            <button onclick="window.setSWOTMode('pest')" class="px-3 py-1 rounded text-xs font-bold border transition-all ${swotMode==='pest' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}">PEST</button>
                        </div>
                        <!-- SWOT grid -->
                        <div id="swot-grid" class="${swotMode==='swot' ? '' : 'hidden'} grid grid-cols-2 gap-3">
                            ${[['strengths','Strengths','bg-emerald-50 border-emerald-200','text-emerald-700'],['weaknesses','Weaknesses','bg-red-50 border-red-200','text-red-700'],['opportunities','Opportunities','bg-blue-50 border-blue-200','text-blue-700'],['threats','Threats','bg-amber-50 border-amber-200','text-amber-700']].map(([k,label,bg,txt]) => `
                            <div class="${bg} border rounded-lg p-3">
                                <label class="block text-xs font-bold ${txt} mb-1">${label}</label>
                                <textarea onchange="window.saveSWOTField('${k}',this.value)" class="w-full text-sm p-2 rounded border border-slate-200 min-h-[80px] resize-none" placeholder="${label}...">${escapeHtml(swot[k]||'')}</textarea>
                            </div>`).join('')}
                        </div>
                        <!-- PEST grid -->
                        <div id="pest-grid" class="${swotMode==='pest' ? '' : 'hidden'} grid grid-cols-2 gap-3">
                            ${[['political','Political','bg-purple-50 border-purple-200','text-purple-700'],['economic','Economic','bg-teal-50 border-teal-200','text-teal-700'],['social','Social','bg-pink-50 border-pink-200','text-pink-700'],['technological','Technological','bg-cyan-50 border-cyan-200','text-cyan-700']].map(([k,label,bg,txt]) => `
                            <div class="${bg} border rounded-lg p-3">
                                <label class="block text-xs font-bold ${txt} mb-1">${label}</label>
                                <textarea onchange="window.savePESTField('${k}',this.value)" class="w-full text-sm p-2 rounded border border-slate-200 min-h-[80px] resize-none" placeholder="${label}...">${escapeHtml(pest[k]||'')}</textarea>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-2" onclick="window.toggleChecklistSection(2)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">2</span>
                SMART Aim
                ${csDot(!!c.aim)}
                <button onclick="window.showExample('aim');event.stopPropagation();" class="ml-auto text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1">
                    <i data-lucide="eye" class="w-3 h-3"></i> See Example
                </button>
                <i data-lucide="chevron-down" id="cs-chevron-2" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
            </h2>
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-sm font-medium text-slate-700">Aim Statement *</label>
                        <a href="https://www.ihi.org/education/IHIOpenSchool/Pages/default.aspx" target="_blank" rel="noopener" class="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline">
                            <i data-lucide="external-link" class="w-3 h-3"></i> SMART aims guide
                        </a>
                    </div>
                    <textarea id="check-aim" onchange="window.saveChecklistField('aim', this.value)" oninput="window.updateFieldWC(this,'wc-aim')"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="To [increase/decrease] [measure] from [baseline] to [target] by [date]">${escapeHtml(c.aim || '')}</textarea>
                    <div class="flex justify-end mt-1 mb-2">
                        <span id="wc-aim" class="text-xs ${(() => { const w = wc(c.aim||''); return w===0?'text-slate-300':w<10?'text-amber-500':w<80?'text-emerald-600 font-medium':'text-amber-600 font-medium'; })()}">${wc(c.aim||'')}w</span>
                    </div>
                    <div class="mt-1 flex gap-2">
                        <button onclick="window.openSmartAimBuilder()" class="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-slate-50 transition-all">
                            <i data-lucide="edit-3" class="w-3 h-3"></i> Interactive Builder
                        </button>
                        <button id="btn-ai-aim" onclick="window.aiRefineAim()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
                            <i data-lucide="sparkles" class="w-3 h-3"></i> AI Critique & Refine
                        </button>
                    </div>
                </div>
                <div class="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <i data-lucide="target" class="w-4 h-4 text-indigo-500 flex-shrink-0 mt-1"></i>
                    <div class="flex-1">
                        <label class="block text-xs font-semibold text-indigo-800 mb-1">Numeric Target — draws a dashed line on your run chart</label>
                        <div class="flex items-center gap-2">
                            <input type="number" id="check-aim-target" step="any" min="0" max="100"
                                onchange="window.saveChecklistField('aim_target', this.value); if(window.renderChart) setTimeout(window.renderChart, 50);"
                                value="${escapeHtml(String(c.aim_target || ''))}"
                                class="w-28 p-1.5 border border-indigo-300 rounded text-sm bg-white focus:ring-2 focus:ring-indigo-400"
                                placeholder="e.g. 90">
                            <span class="text-xs text-indigo-500">Enter the target value (number only — e.g. 90 for 90%)</span>
                        </div>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Secondary SMART Aim <span class="text-xs text-slate-400 font-normal">(optional — for dual-aim projects)</span></label>
                    <textarea id="check-aim2" onchange="window.saveChecklistField('aim2', this.value)" 
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[60px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="Optional secondary aim — e.g. a patient experience or staff wellbeing outcome measure">${escapeHtml(c.aim2 || '')}</textarea>
                </div>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-3" onclick="window.toggleChecklistSection(3)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">3</span>
                Family of Measures
                ${csDot(!!(c.outcome_measure && c.process_measure))}
                <a onclick="event.stopPropagation();" href="https://www.hqip.org.uk/resource/guide-to-quality-improvement-tools" target="_blank" rel="noopener" class="ml-auto text-xs text-slate-500 border border-slate-200 bg-slate-50 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1">
                    <i data-lucide="external-link" class="w-3 h-3"></i> Measures guide
                </a>
                <button onclick="window.showExample('measures');event.stopPropagation();" class="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1">
                    <i data-lucide="eye" class="w-3 h-3"></i> See Example
                </button>
                <i data-lucide="chevron-down" id="cs-chevron-3" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        <span class="text-emerald-600">●</span> Outcome Measure *
                    </label>
                    <textarea id="check-outcome" onchange="window.saveChecklistField('outcome_measure', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]"
                        placeholder="The voice of the patient - what result matters?">${escapeHtml(c.outcome_measure || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        <span class="text-blue-600">●</span> Process Measure *
                    </label>
                    <textarea id="check-process" onchange="window.saveChecklistField('process_measure', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]"
                        placeholder="Are the steps being followed correctly?">${escapeHtml(c.process_measure || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        <span class="text-amber-600">●</span> Balancing Measure
                    </label>
                    <textarea id="check-balance" onchange="window.saveChecklistField('balance_measure', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]"
                        placeholder="Are we causing problems elsewhere?">${escapeHtml(c.balance_measure || '')}</textarea>
                </div>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-4" onclick="window.toggleChecklistSection(4)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">4</span>
                Ethics & Governance
                ${csDot(!!(c.ethics || Object.values(c.hraChecklist||{}).some(v=>v)))}
                <button onclick="window.open('https://www.hra-decisiontools.org.uk/research/',\'_blank\');event.stopPropagation();" class="ml-auto text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1">
                    <i data-lucide="external-link" class="w-3 h-3"></i> HRA Decision Tool
                </button>
                <i data-lucide="chevron-down" id="cs-chevron-4" class="w-4 h-4 text-slate-400 flex-shrink-0"></i>
            </h2>
            <div class="space-y-3 mb-4">
                <p class="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">Complete the HRA Decision Tool online, then answer these questions. Your answers determine whether this is service evaluation (no ethics needed) or research (ethics required).</p>
                ${[{
                    key: 'q1', label: 'Is the primary purpose to generate new generalizable knowledge (research), or to evaluate/improve a local service?',
                    hint: 'If evaluating/improving local service → likely Service Evaluation'
                }, {
                    key: 'q2', label: 'Are participants randomised or given an intervention outside normal care?',
                    hint: 'If yes → more likely to require ethics approval'
                }, {
                    key: 'q3', label: 'Is this registered with your Trust\'s Audit/QI department or Clinical Governance?',
                    hint: 'All QI projects should be registered locally regardless of HRA outcome'
                }, {
                    key: 'q4', label: 'Has Caldicott/IG approval been obtained for any identifiable data extraction?',
                    hint: 'Required whenever you access patient-identifiable records'
                }].map(q => {
                    const val = (c.hraChecklist || {})[q.key] || '';
                    return `<div class="border border-slate-200 rounded-lg p-3">
                        <p class="text-sm font-medium text-slate-700 mb-2">${q.label}</p>
                        <p class="text-xs text-slate-400 italic mb-2">${q.hint}</p>
                        <div class="flex gap-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hra-${q.key}" value="yes" ${val === 'yes' ? 'checked' : ''} onchange="window.saveHRAField('${q.key}', 'yes')" class="text-emerald-500">
                                <span class="text-sm text-emerald-700 font-medium">Yes</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hra-${q.key}" value="no" ${val === 'no' ? 'checked' : ''} onchange="window.saveHRAField('${q.key}', 'no')" class="text-red-500">
                                <span class="text-sm text-red-700 font-medium">No</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hra-${q.key}" value="pending" ${val === 'pending' ? 'checked' : ''} onchange="window.saveHRAField('${q.key}', 'pending')" class="text-amber-500">
                                <span class="text-sm text-amber-700 font-medium">Pending</span>
                            </label>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            ${(() => {
                const hra = c.hraChecklist || {};
                const answered = [hra.q1, hra.q2, hra.q3, hra.q4].filter(v => v && v !== '');
                if (answered.length === 4) {
                    const needsEthics = hra.q2 === 'yes';
                    return `<div class="mb-4 p-3 rounded-lg border ${needsEthics ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}">
                        <p class="text-sm font-bold ${needsEthics ? 'text-red-800' : 'text-emerald-800'}">
                            ${needsEthics ? '⚠️ Likely requires formal ethics approval — consult your Trust R&D department.' : '✓ Likely qualifies as Service Evaluation / QI — no formal ethics approval required.'}
                        </p>
                    </div>`;
                }
                return '';
            })()}
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Notes / Registration Reference</label>
                <textarea id="check-ethics" onchange="window.saveChecklistField('ethics', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]"
                    placeholder="e.g. Registered as Service Evaluation: Ref AUD-2024-0142. No consent required. Caldicott approval obtained.">${escapeHtml(c.ethics || '')}</textarea>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-5" onclick="window.toggleChecklistSection(5)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold">5</span>
                Literature Review
                ${csDot(!!(c.lit_review || (d.referencesList && d.referencesList.length > 0)))}
                <i data-lucide="chevron-down" id="cs-chevron-5" class="w-4 h-4 text-slate-400 flex-shrink-0 ml-auto"></i>
            </h2>
            <!-- Structured reference list -->
            <div class="mb-5">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-sm font-medium text-slate-700">Reference List</label>
                    <button onclick="window.addReference()" class="text-xs bg-slate-800 text-white px-2.5 py-1 rounded flex items-center gap-1 hover:bg-slate-700">
                        <i data-lucide="plus" class="w-3 h-3"></i> Add Reference
                    </button>
                </div>
                <div id="reference-list" class="space-y-2">
                    ${(c.referencesList || []).length === 0
                        ? `<p class="text-xs text-slate-400 italic py-2">No references added yet. Click 'Add Reference' to build your bibliography.</p>`
                        : (c.referencesList || []).map((ref, ri) => `
                        <div class="border border-slate-200 rounded-lg p-3 bg-slate-50" id="ref-${ri}">
                            <div class="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" value="${escapeHtml(ref.authors || '')}" placeholder="Authors" onchange="window.updateReference(${ri}, 'authors', this.value)" class="p-1.5 border border-slate-300 rounded text-xs">
                                <input type="text" value="${escapeHtml(ref.year || '')}" placeholder="Year" onchange="window.updateReference(${ri}, 'year', this.value)" class="p-1.5 border border-slate-300 rounded text-xs">
                            </div>
                            <input type="text" value="${escapeHtml(ref.title || '')}" placeholder="Title / Guideline name" onchange="window.updateReference(${ri}, 'title', this.value)" class="w-full p-1.5 border border-slate-300 rounded text-xs mb-2">
                            <div class="flex gap-2 items-start">
                                <textarea placeholder="Key finding / relevance to your project" onchange="window.updateReference(${ri}, 'keyFinding', this.value)" class="flex-1 p-1.5 border border-slate-300 rounded text-xs min-h-[40px]">${escapeHtml(ref.keyFinding || '')}</textarea>
                                <button onclick="window.deleteReference(${ri})" class="text-red-400 hover:text-red-600 p-1 flex-shrink-0" title="Remove reference">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>`).join('')
                    }
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Additional Notes / Narrative</label>
                <textarea id="check-litreview" onchange="window.saveChecklistField('lit_review', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                    placeholder="Additional commentary on the evidence base, gaps in literature, or how evidence supports your project...">${escapeHtml(c.lit_review || '')}</textarea>
                <div class="mt-2">
                    <button onclick="window.aiSuggestEvidence()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
                        <i data-lucide="sparkles" class="w-3 h-3"></i> AI Suggest Evidence
                    </button>
                </div>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-6" onclick="window.toggleChecklistSection(6)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm font-bold">6</span>
                Results & Analysis
                ${csDot(!!c.results_analysis)}
                <i data-lucide="chevron-down" id="cs-chevron-6" class="w-4 h-4 text-slate-400 flex-shrink-0 ml-auto"></i>
            </h2>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Analysis of Results</label>
                <textarea id="check-results" onchange="window.saveChecklistField('results_analysis', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px]"
                    placeholder="What do your charts show? Any special cause variation? What patterns emerged?">${escapeHtml(c.results_analysis || '')}</textarea>
            </div>
        </section>
        
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 id="cs-header-7" onclick="window.toggleChecklistSection(7)" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold">7</span>
                Learning & Sustainability
                ${csDot(!!(c.learning_points && c.sustainability))}
                <i data-lucide="chevron-down" id="cs-chevron-7" class="w-4 h-4 text-slate-400 flex-shrink-0 ml-auto"></i>
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Key Learning Points</label>
                    <textarea id="check-learning" onchange="window.saveChecklistField('learning_points', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                        placeholder="What worked? What didn't? What would you do differently?">${escapeHtml(c.learning_points || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Sustainability Summary</label>
                    <textarea id="check-sustainability" onchange="window.saveChecklistField('sustainability', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                        placeholder="High-level sustainability narrative for the FRCEM submission.">${escapeHtml(c.sustainability || '')}</textarea>
                </div>
            </div>
            <!-- Sustainability & Spread Planner -->
            <div class="mt-4 border border-teal-200 rounded-lg overflow-hidden">
                <div class="bg-teal-50 px-4 py-3 flex items-center gap-2">
                    <i data-lucide="rocket" class="w-4 h-4 text-teal-600"></i>
                    <span class="text-sm font-bold text-teal-800">Sustainability &amp; Spread Planner</span>
                </div>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Who Will Adopt This? (Target adopters)</label>
                        <textarea onchange="window.saveSpreadField('whoAdopts',this.value)" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="Other EDs, ward teams, national rollout...">${escapeHtml(spreadPlan.whoAdopts||'')}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Infrastructure Required</label>
                        <textarea onchange="window.saveSpreadField('infrastructure',this.value)" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="IT systems, training, resources needed...">${escapeHtml(spreadPlan.infrastructure||'')}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Maintenance Plan (Who owns it?)</label>
                        <textarea onchange="window.saveSpreadField('maintenancePlan',this.value)" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="Named owner, governance, audit cycle...">${escapeHtml(spreadPlan.maintenancePlan||'')}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Spread Timeline</label>
                        <textarea onchange="window.saveSpreadField('spreadTimeline',this.value)" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="Phase 1: 3 months — local; Phase 2: 6 months — regional...">${escapeHtml(spreadPlan.spreadTimeline||'')}</textarea>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-slate-600 mb-1">Embedding Strategy (how will change become routine?)</label>
                        <textarea onchange="window.saveSpreadField('embeddingStrategy',this.value)" class="w-full p-2 border border-slate-300 rounded text-sm min-h-[70px]" placeholder="SOP update, induction inclusion, mandatory training, guideline integration...">${escapeHtml(spreadPlan.embeddingStrategy||'')}</textarea>
                    </div>
                </div>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Next Year's PDP</label>
                <textarea id="check-next-pdp" onchange="window.saveChecklistField('next_pdp', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px]"
                    placeholder="What specific QI skills do you want to develop next year?">${escapeHtml(c.next_pdp || '')}</textarea>
            </div>
        </section>

        <!-- Section 8: FMEA Risk Table -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 onclick="this.nextElementSibling.classList.toggle('hidden')" class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1 cursor-pointer select-none">
                <span class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">8</span>
                Failure Mode &amp; Effect Analysis (FMEA)
                ${csDot(fmea.length > 0)}
                <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 flex-shrink-0 ml-auto"></i>
            </h2>
            <div>
                <p class="text-xs text-slate-500 mb-3">Proactively identify where your QI process could fail, assess risk (Likelihood × Severity × Detectability = RPN), and plan mitigations. RPN ≥ 50 = High risk (red), ≥ 20 = Medium (amber), &lt; 20 = Low (green).</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse" id="fmea-table">
                        <thead>
                            <tr class="bg-slate-100">
                                <th class="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Process Step</th>
                                <th class="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Failure Mode</th>
                                <th class="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Effect on Patient/Process</th>
                                <th class="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 w-10" title="Likelihood 1-5">L</th>
                                <th class="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 w-10" title="Severity 1-5">S</th>
                                <th class="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 w-10" title="Detectability 1-5">D</th>
                                <th class="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 w-14">RPN</th>
                                <th class="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">Mitigation</th>
                                <th class="border border-slate-200 px-2 py-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody id="fmea-body">
                            ${fmea.length === 0 ? '<tr><td colspan="9" class="border border-slate-200 px-3 py-4 text-center text-slate-400">No rows yet — click &quot;Add Row&quot; to begin</td></tr>' :
                            fmea.map((row, i) => {
                                const rpn = (parseInt(row.likelihood)||1) * (parseInt(row.severity)||1) * (parseInt(row.detectability)||1);
                                const rpnClass = rpn >= 50 ? 'bg-red-100 text-red-700 font-bold' : rpn >= 20 ? 'bg-amber-100 text-amber-700 font-bold' : 'bg-green-100 text-green-700 font-bold';
                                return `<tr>
                                    <td class="border border-slate-200 px-1 py-1"><input type="text" value="${escapeHtml(row.step||'')}" onchange="window.updateFMEARow(${i},'step',this.value)" class="w-full p-1 text-xs border-0 focus:ring-1 focus:ring-rcem-purple rounded" placeholder="Step..."/></td>
                                    <td class="border border-slate-200 px-1 py-1"><input type="text" value="${escapeHtml(row.failureMode||'')}" onchange="window.updateFMEARow(${i},'failureMode',this.value)" class="w-full p-1 text-xs border-0 focus:ring-1 focus:ring-rcem-purple rounded" placeholder="What could go wrong?"/></td>
                                    <td class="border border-slate-200 px-1 py-1"><input type="text" value="${escapeHtml(row.effect||'')}" onchange="window.updateFMEARow(${i},'effect',this.value)" class="w-full p-1 text-xs border-0 focus:ring-1 focus:ring-rcem-purple rounded" placeholder="Impact..."/></td>
                                    <td class="border border-slate-200 px-1 py-1 text-center"><input type="number" min="1" max="5" value="${row.likelihood||1}" onchange="window.updateFMEARow(${i},'likelihood',this.value)" class="w-10 p-1 text-xs text-center border border-slate-200 rounded"/></td>
                                    <td class="border border-slate-200 px-1 py-1 text-center"><input type="number" min="1" max="5" value="${row.severity||1}" onchange="window.updateFMEARow(${i},'severity',this.value)" class="w-10 p-1 text-xs text-center border border-slate-200 rounded"/></td>
                                    <td class="border border-slate-200 px-1 py-1 text-center"><input type="number" min="1" max="5" value="${row.detectability||1}" onchange="window.updateFMEARow(${i},'detectability',this.value)" class="w-10 p-1 text-xs text-center border border-slate-200 rounded"/></td>
                                    <td class="border border-slate-200 px-1 py-1 text-center"><span class="px-2 py-1 rounded ${rpnClass}">${rpn}</span></td>
                                    <td class="border border-slate-200 px-1 py-1"><input type="text" value="${escapeHtml(row.mitigation||'')}" onchange="window.updateFMEARow(${i},'mitigation',this.value)" class="w-full p-1 text-xs border-0 focus:ring-1 focus:ring-rcem-purple rounded" placeholder="Action to reduce risk..."/></td>
                                    <td class="border border-slate-200 px-1 py-1 text-center"><button onclick="window.deleteFMEARow(${i})" class="text-red-400 hover:text-red-600 p-1" title="Delete row"><i data-lucide="trash-2" class="w-3 h-3"></i></button></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <button onclick="window.addFMEARow()" class="mt-3 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-semibold hover:bg-orange-100 transition-all">
                    <i data-lucide="plus" class="w-3 h-3"></i> Add Row
                </button>
            </div>
        </section>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function saveSmartAim() {
    const aim = document.getElementById('check-aim')?.value || '';
    if (!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist.aim = aim;
    if (window.saveData) window.saveData();
    showToast('Aim saved', 'success');
}

// ==========================================
// 4. DATA VIEW
// ==========================================

function renderSignalPanel() {
    const panel = document.getElementById('signal-panel');
    if (!panel) return;

    const mode = state.projectData?.chartSettings?.mode || 'run';
    if (mode !== 'run') { panel.innerHTML = ''; return; }

    const sig = window.lastRunChartSignals;
    if (!sig || sig.data.length < 8) { panel.innerHTML = ''; return; }

    const { rule1, rule2, rule3, data, median } = sig;

    if (!rule1 && !rule2 && !rule3) {
        panel.innerHTML = `
            <div class="mt-3 flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i>
                <span class="text-emerald-800"><strong>No signals detected</strong> — the process appears stable with only common cause variation (n=${data.length} points, median=${median.toFixed(1)}).</span>
            </div>`;
    } else {
        const items = [];
        if (rule1) items.push(`
            <div class="flex gap-3">
                <span class="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">R1</span>
                <div><p class="text-sm font-bold text-red-800">Rule 1: Astronomical point</p>
                <p class="text-xs text-red-700 mt-0.5">One or more data points lie far outside the expected range (>3×IQR from quartiles) — warrants <strong>immediate investigation</strong>. Red points on chart.</p></div>
            </div>`);
        if (rule2) items.push(`
            <div class="flex gap-3">
                <span class="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">R2</span>
                <div><p class="text-sm font-bold text-amber-800">Rule 2: Shift detected</p>
                <p class="text-xs text-amber-700 mt-0.5">8+ consecutive points on same side of the median — suggests a <strong>sustained process change</strong>. Amber points on chart.</p></div>
            </div>`);
        if (rule3) items.push(`
            <div class="flex gap-3">
                <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">R3</span>
                <div><p class="text-sm font-bold text-orange-800">Rule 3: Trend detected</p>
                <p class="text-xs text-orange-700 mt-0.5">6+ consecutive points all going in the same direction — suggests a <strong>directional process shift</strong>. Orange points on chart.</p></div>
            </div>`);
        panel.innerHTML = `
            <div class="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-bold text-amber-900 flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i> Run Chart Signals (NHS Improvement Rules)
                    </h4>
                    ${window.hasAI && window.hasAI() ? `
                    <button onclick="window.aiAnalyseChart()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
                        <i data-lucide="sparkles" class="w-3 h-3"></i> AI Interpret
                    </button>` : ''}
                </div>
                <div class="space-y-3">${items.join('')}</div>
                <p class="text-xs text-amber-600 mt-3 pt-3 border-t border-amber-200">These signals suggest the process is <strong>not in statistical control</strong> — document your explanation in Results Interpretation above.</p>
            </div>`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function renderDataView() {
    const d = state.projectData;
    if (!d) return;
    
    if (window.renderChart) window.renderChart();
    renderSignalPanel();
    if (window.initBatchEntry) window.initBatchEntry();
    
    const resultsText = document.getElementById('results-text');
    if (resultsText && d.checklist) {
        resultsText.value = d.checklist.results_analysis || '';
    }

    // Operational definition (8A-5)
    const opDefEl = document.getElementById('operational-definition');
    if (opDefEl && d.checklist) {
        opDefEl.value = d.checklist.operational_definition || '';
    }
    
    const historyContainer = document.getElementById('data-history');
    if (historyContainer) {
        if (!d.chartData || d.chartData.length === 0) {
            historyContainer.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">No data points yet. Add your first data point above.</div>`;
        } else {
            const sorted = [...d.chartData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
            historyContainer.innerHTML = `
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-xs uppercase text-slate-500 border-b border-slate-200">
                            <th class="pb-2">Date</th>
                            <th class="pb-2">Value</th>
                            <th class="pb-2">Phase</th>
                            <th class="pb-2 text-right"></th>
                        </tr>
                    </thead>
                    <tbody class="text-xs text-slate-700">
                        ${sorted.map(item => `
                            <tr class="border-b border-slate-50 hover:bg-slate-50" title="${escapeHtml(item.note || '')}">
                                <td class="py-2 font-mono">${formatDate(item.date)}</td>
                                <td class="py-2 font-bold text-rcem-purple">${item.value}</td>
                                <td class="py-2 text-slate-400">${escapeHtml(item.grade || '-')}</td>
                                <td class="py-2 text-right">
                                    <button onclick="window.deleteDataPoint('${item.id}')" class="text-slate-300 hover:text-red-500 transition-colors">
                                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 5. TEAM VIEW
// ==========================================

export function renderTeam() {
    const d = state.projectData;
    if (!d) return;
    
    const teamContainer = document.getElementById('team-list');
    const logContainer = document.getElementById('leadership-log-list');
    
    if (teamContainer) {
        const members = d.teamMembers || [];
        teamContainer.innerHTML = `
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <i data-lucide="users-2" class="text-pink-500"></i> QI Team
                    </h2>
                    <p class="text-slate-500 text-sm">Define roles and responsibilities</p>
                </div>
                <button onclick="window.openMemberModal()" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                    <i data-lucide="plus" class="w-4 h-4"></i> Add Member
                </button>
            </header>
            
            ${members.length === 0 ? `
                <div class="bg-slate-50 rounded-xl p-8 text-center">
                    <i data-lucide="users" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
                    <p class="text-slate-500">No team members yet. Add your QI team above.</p>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${members.map((m, i) => `
                        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
                            <div class="flex items-start justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                                        ${escapeHtml((m.name || '?')[0].toUpperCase())}
                                    </div>
                                    <div>
                                        <div class="font-bold text-slate-800" title="${escapeHtml(m.name || 'Unknown')}">${escapeHtml(m.name || 'Unknown')}</div>
                                        <div class="text-xs text-slate-500">${escapeHtml(m.role || 'No role')}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    <button onclick="window.openMemberModal(${i})" class="text-slate-300 hover:text-indigo-500 transition-colors" title="Edit member">
                                        <i data-lucide="pencil" class="w-4 h-4"></i>
                                    </button>
                                    <button onclick="window.deleteMember(${i})" class="text-slate-300 hover:text-red-500 transition-colors" title="Remove member">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                            ${m.grade ? `<div class="mt-2 text-xs text-slate-600"><span class="font-medium">Grade:</span> ${escapeHtml(m.grade)}</div>` : ''}
                            ${m.responsibilities ? `<div class="mt-1 text-xs text-slate-600"><span class="font-medium">Responsibility:</span> ${escapeHtml(m.responsibilities)}</div>` : ''}
                            ${m.initials ? `<div class="mt-1 text-xs text-slate-400">Initials: ${escapeHtml(m.initials)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        `;
    }
    
    if (logContainer) {
        const logs = d.leadershipLogs || [];
        logContainer.innerHTML = `
            <div class="mt-10">
                <header class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <i data-lucide="message-square" class="text-amber-500"></i> Leadership Engagement Log
                        </h2>
                        <p class="text-slate-500 text-sm">Record key communications with senior leadership</p>
                    </div>
                    <button onclick="window.addLeadershipLog()" class="bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-600 transition-colors">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add Entry
                    </button>
                </header>
                
                ${logs.length === 0 ? `
                    <div class="bg-slate-50 rounded-xl p-6 text-center">
                        <p class="text-slate-500 text-sm">No leadership engagements logged yet.</p>
                    </div>
                ` : `
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-slate-50">
                                <tr class="text-xs text-slate-500 uppercase">
                                    <th class="px-4 py-3 text-left">Date</th>
                                    <th class="px-4 py-3 text-left">Note / Activity</th>
                                    <th class="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${logs.map((l, i) => `
                                    <tr class="hover:bg-slate-50">
                                        <td class="px-4 py-3 text-sm font-mono text-slate-600">${formatDate(l.date)}</td>
                                        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(l.note || '')}</td>
                                        <td class="px-4 py-3 text-right">
                                            <button onclick="window.deleteLeadershipLog(${i})" class="text-slate-300 hover:text-red-500">
                                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function openMemberModal(index = null) {
    const modal = document.getElementById('member-modal');
    if (!modal) return;

    const d = state.projectData;
    const member = index !== null ? (d.teamMembers || [])[index] : null;

    // Update title to reflect add vs edit mode
    const titleEl = modal.querySelector('h3');
    if (titleEl) titleEl.textContent = member ? 'Edit Team Member' : 'Add Team Member';

    document.getElementById('member-index').value = index !== null ? index : '';
    document.getElementById('member-name').value = member?.name || '';
    document.getElementById('member-role').value = member?.role || '';
    document.getElementById('member-grade').value = member?.grade || '';
    document.getElementById('member-resp').value = member?.responsibilities || '';
    document.getElementById('member-init').value = member?.initials || '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Focus name field
    setTimeout(() => {
        const nameEl = document.getElementById('member-name');
        if (nameEl) nameEl.focus();
    }, 50);
}

export function addLeadershipLog() {
    window.showInputModal(
        'Add Leadership Log Entry',
        [
            { id: 'date',  label: 'Date', type: 'date', required: true },
            { id: 'note',  label: 'Activity / Engagement Note', type: 'textarea', placeholder: 'e.g. Dr Smith approved trolley design at governance meeting', required: true }
        ],
        (data) => {
            if (!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
            state.projectData.leadershipLogs.push({ date: data.date, note: data.note });
            if (window.saveData) window.saveData();
            renderTeam();
            showToast('Leadership log added', 'success');
        },
        'Add Entry'
    );
}

export function deleteLeadershipLog(index) {
    window.showConfirmDialog('Delete this leadership log entry?', () => {
        state.projectData.leadershipLogs.splice(index, 1);
        if (window.saveData) window.saveData();
        renderTeam();
        showToast('Log entry deleted', 'info');
    }, 'Delete', 'Delete Log Entry');
}


// ==========================================
// 6. CHANGE IDEAS + PDSA CYCLES
// ==========================================

/** Keep d.pdsa (flat array) in sync — all existing charts/export still work */
function syncPDSAFlat() {
    const d = state.projectData;
    if (!d) return;
    d.pdsa = (d.changeIdeas || []).flatMap(idea => (idea.pdsaCycles || []));
}

export function addChangeIdea() {
    const titleEl = document.getElementById('ci-new-title');
    const descEl  = document.getElementById('ci-new-desc');
    const driverEl = document.getElementById('ci-new-driver');
    const title = titleEl?.value?.trim();
    if (!title) { showToast('Please enter a change idea title', 'error'); return; }

    if (!state.projectData.changeIdeas) state.projectData.changeIdeas = [];
    state.projectData.changeIdeas.push({
        id: 'ci-' + Date.now(),
        title,
        description: descEl?.value?.trim() || '',
        driverLink: driverEl?.value?.trim() || '',
        status: 'active',
        pdsaCycles: []
    });

    if (titleEl) titleEl.value = '';
    if (descEl)  descEl.value = '';
    if (driverEl) driverEl.value = '';

    syncPDSAFlat();
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('Change idea added', 'success');
}

export function updateChangeIdea(ideaIdx, field, value) {
    const idea = state.projectData.changeIdeas?.[ideaIdx];
    if (!idea) return;
    idea[field] = value;
    syncPDSAFlat();
    if (window.saveData) window.saveData();
}

export function deleteChangeIdea(ideaIdx) {
    const idea = state.projectData.changeIdeas?.[ideaIdx];
    if (!idea) return;
    const label = idea.title || 'this change idea';
    window.showConfirmDialog(
        `Delete "${label}" and all its PDSA cycles?`,
        () => {
            state.projectData.changeIdeas.splice(ideaIdx, 1);
            syncPDSAFlat();
            if (window.saveData) window.saveData();
            renderPDSA();
            showToast('Change idea deleted', 'info');
        },
        'Delete', 'Delete Change Idea'
    );
}

export function addCycleToIdea(ideaIdx) {
    const titleEl = document.getElementById(`ci-cycle-title-${ideaIdx}`);
    const startEl = document.getElementById(`ci-cycle-start-${ideaIdx}`);
    const ownerEl = document.getElementById(`ci-cycle-owner-${ideaIdx}`);
    const tmplEl  = document.getElementById(`ci-cycle-tmpl-${ideaIdx}`);
    const title   = titleEl?.value?.trim();
    if (!title) { showToast('Please enter a cycle title', 'error'); return; }

    const idea = state.projectData.changeIdeas?.[ideaIdx];
    if (!idea) return;
    if (!idea.pdsaCycles) idea.pdsaCycles = [];

    // Apply template plan text if selected
    const CYCLE_TEMPLATES = {
        education: { plan: 'Deliver a focused education session to the target staff group explaining the change and expected benefits. Gather attendance records.', prediction: 'Following education, compliance with the target behaviour will increase by at least 20% in the subsequent audit cycle.' },
        audit:     { plan: 'Conduct a prospective audit of [N] consecutive cases against the standard. Use the agreed data collection tool.', prediction: 'Baseline compliance rate will be documented, providing a reference point for subsequent intervention cycles.' },
        checklist: { plan: 'Introduce a one-page process checklist at the point of care and trial with the next 10 eligible patients or episodes.', prediction: 'Completion rates will improve as the checklist acts as a cognitive prompt for the required steps.' },
        reminder:  { plan: 'Design and place a visual reminder (poster, badge card, or screen saver) in the clinical area. Record whether staff notice or reference it.', prediction: 'Visibility of the reminder will prompt behaviour change for at least 30% of staff during the trial period.' },
        protocol:  { plan: 'Draft an updated SOP/protocol and share for peer review. Pilot the revised protocol with the next 5 eligible cases.', prediction: 'A clear, accessible protocol will reduce variation in practice and improve compliance with the intended standard.' }
    };
    const tmpl = CYCLE_TEMPLATES[tmplEl?.value] || {};

    idea.pdsaCycles.push({
        title,
        startDate: startEl?.value || '',
        start:     startEl?.value || '',
        owner:     ownerEl?.value || '',
        status:    'planning',
        plan:      tmpl.plan || '',
        desc:      tmpl.plan || '',
        prediction: tmpl.prediction || '',
        do: '', study: '', act: '', actDecision: ''
    });

    if (titleEl)  titleEl.value = '';
    if (startEl)  startEl.value = '';
    if (tmplEl)   tmplEl.value = '';

    syncPDSAFlat();
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('PDSA cycle added', 'success');
    // Re-open the idea's cycle list after render
    setTimeout(() => {
        const body = document.getElementById(`ci-body-${ideaIdx}`);
        if (body && body.classList.contains('hidden')) body.classList.remove('hidden');
    }, 50);
}

export function updateCycleInIdea(ideaIdx, cycleIdx, field, value) {
    const cycle = state.projectData.changeIdeas?.[ideaIdx]?.pdsaCycles?.[cycleIdx];
    if (!cycle) return;
    cycle[field] = value;
    if (field === 'plan') cycle.desc = value;
    if (field === 'startDate') cycle.start = value;
    syncPDSAFlat();
    if (window.saveData) window.saveData();
}

export function deleteCycleFromIdea(ideaIdx, cycleIdx) {
    window.showConfirmDialog('Delete this PDSA cycle? All notes will be lost.', () => {
        state.projectData.changeIdeas[ideaIdx].pdsaCycles.splice(cycleIdx, 1);
        syncPDSAFlat();
        if (window.saveData) window.saveData();
        renderPDSA();
        showToast('PDSA cycle deleted', 'info');
    }, 'Delete Cycle', 'Delete PDSA Cycle');
}

window.toggleIdeaBody = function(ideaIdx) {
    const body = document.getElementById(`ci-body-${ideaIdx}`);
    const icon = document.getElementById(`ci-toggle-icon-${ideaIdx}`);
    if (!body) return;
    body.classList.toggle('hidden');
    if (icon) icon.style.transform = body.classList.contains('hidden') ? 'rotate(-90deg)' : '';
};

window.toggleAddCycleForm = function(ideaIdx) {
    const form = document.getElementById(`ci-add-cycle-form-${ideaIdx}`);
    if (!form) return;
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
        document.getElementById(`ci-cycle-title-${ideaIdx}`)?.focus();
    }
};

export function renderPDSA() {
    const d = state.projectData;
    if (!d) return;
    const container = document.getElementById('pdsa-container');
    if (!container) return;

    // Ensure changeIdeas initialised
    if (!Array.isArray(d.changeIdeas)) d.changeIdeas = [];

    const ideas   = d.changeIdeas;
    const members = d.teamMembers || [];
    const driverChanges = d.drivers?.changes || [];

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- ── LEFT PANEL: add change idea ── -->
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 class="font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
                    <i data-lucide="lightbulb" class="w-5 h-5 text-amber-500"></i>
                    New Change Idea
                </h3>
                <p class="text-xs text-slate-500 mb-4 leading-relaxed">Each change idea groups the PDSA cycles used to test it. Add one idea per distinct intervention.</p>
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Idea Title <span class="text-red-400">*</span></label>
                        <input id="ci-new-title" class="w-full p-2 border rounded text-sm" placeholder="e.g. Staff education session on sepsis bundle">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Description <span class="font-normal text-slate-400">(optional)</span></label>
                        <textarea id="ci-new-desc" class="w-full p-2 border rounded text-sm" rows="2" placeholder="What change are you making and why?"></textarea>
                    </div>
                    ${driverChanges.length > 0 ? `
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Linked Driver Change <span class="font-normal text-slate-400">(optional)</span></label>
                        <select id="ci-new-driver" class="w-full p-2 border rounded text-sm">
                            <option value="">— Select from driver diagram —</option>
                            ${driverChanges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                        </select>
                    </div>` : `<input id="ci-new-driver" type="hidden" value="">`}
                    <button onclick="window.addChangeIdea()" class="w-full bg-rcem-purple text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add Change Idea
                    </button>
                    ${window.hasAI && window.hasAI() ? `
                    <button onclick="window.aiGeneratePDSA()" id="btn-ai-pdsa" class="w-full border border-purple-200 text-purple-700 py-2 rounded-lg font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> AI Draft Idea
                    </button>` : ''}
                </div>

                <!-- Quick resource link -->
                <div class="mt-5 pt-4 border-t border-slate-100">
                    <p class="text-xs font-bold text-slate-500 uppercase mb-2">QI Resources</p>
                    <div class="space-y-1.5">
                        <a href="https://www.ihi.org/education/IHIOpenSchool/Pages/default.aspx" target="_blank" rel="noopener" class="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                            <i data-lucide="external-link" class="w-3 h-3 flex-shrink-0"></i> IHI Open School — PDSA Basics
                        </a>
                        <a href="https://awsem.co.uk/outside-the-ed/quality-improvement/" target="_blank" rel="noopener" class="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                            <i data-lucide="external-link" class="w-3 h-3 flex-shrink-0"></i> AWSEM — EM QI Hub
                        </a>
                        <a href="https://rcem.ac.uk/rcem-curriculum/" target="_blank" rel="noopener" class="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                            <i data-lucide="external-link" class="w-3 h-3 flex-shrink-0"></i> RCEM SLO 11 Guidance
                        </a>
                    </div>
                </div>
            </div>

            <!-- ── RIGHT PANEL: change idea cards ── -->
            <div class="lg:col-span-2 space-y-4">
                <!-- header row -->
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-bold text-slate-700">${ideas.length} change idea${ideas.length !== 1 ? 's' : ''}</span>
                        <span class="text-slate-400 mx-1">·</span>
                        <span class="text-sm text-slate-500">${(d.pdsa||[]).length} PDSA cycle${(d.pdsa||[]).length !== 1 ? 's' : ''} total</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="window.showTemplatesModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                            <i data-lucide="layout-template" class="w-3.5 h-3.5"></i> Templates
                        </button>
                        <button onclick="window.showLearnPanel()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                            <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i> Learn
                        </button>
                    </div>
                </div>

                ${ideas.length === 0 ? `
                <div class="bg-slate-50 rounded-xl p-10 text-center border-2 border-dashed border-slate-200">
                    <i data-lucide="lightbulb" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
                    <p class="font-semibold text-slate-500 mb-1">No change ideas yet</p>
                    <p class="text-sm text-slate-400">Add your first change idea on the left, then add PDSA cycles within it to test the change iteratively.</p>
                    <button onclick="window.showTemplatesModal()" class="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                        <i data-lucide="layout-template" class="w-4 h-4"></i> Start from a Clinical Template
                    </button>
                </div>` : ideas.map((idea, ideaIdx) => {
                    const cycles     = idea.pdsaCycles || [];
                    const cycleCount = cycles.length;
                    const progress   = Math.min(cycleCount, 3);
                    const progressPct = Math.round((progress / 3) * 100);
                    const progressLabel = cycleCount >= 3 ? '✓ FRCEM Excellent threshold met' : `${cycleCount}/3 cycles — ${3 - cycleCount} more for FRCEM Excellent`;

                    const statusColors = { active: 'bg-emerald-100 text-emerald-700', planning: 'bg-blue-100 text-blue-700', completed: 'bg-slate-100 text-slate-600', abandoned: 'bg-red-100 text-red-700' };
                    const statusCls = statusColors[idea.status] || statusColors.active;

                    return `
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="ci-card-${ideaIdx}">

                        <!-- Idea header -->
                        <div class="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-full bg-rcem-purple text-white flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5">${ideaIdx + 1}</div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <input value="${escapeHtml(idea.title || '')}"
                                            onchange="window.updateChangeIdea(${ideaIdx}, 'title', this.value)"
                                            class="font-bold text-slate-800 bg-transparent border-0 border-b-2 border-transparent hover:border-slate-300 focus:border-rcem-purple outline-none transition-colors flex-1 min-w-0 text-sm"
                                            placeholder="Change idea title">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statusCls}">
                                            <select onchange="window.updateChangeIdea(${ideaIdx}, 'status', this.value)"
                                                class="bg-transparent border-0 outline-none text-xs font-bold cursor-pointer">
                                                <option value="active" ${idea.status==='active'?'selected':''}>Active</option>
                                                <option value="planning" ${idea.status==='planning'?'selected':''}>Planning</option>
                                                <option value="completed" ${idea.status==='completed'?'selected':''}>Completed</option>
                                                <option value="abandoned" ${idea.status==='abandoned'?'selected':''}>Abandoned</option>
                                            </select>
                                        </span>
                                        ${idea.driverLink ? `<span class="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 truncate max-w-[160px]" title="${escapeHtml(idea.driverLink)}">
                                            <i data-lucide="git-branch" class="w-3 h-3 inline-block mr-0.5"></i>${escapeHtml(idea.driverLink)}</span>` : ''}
                                    </div>
                                    ${idea.description ? `<p class="text-xs text-slate-500 mt-1 leading-relaxed">${escapeHtml(idea.description)}</p>` : ''}

                                    <!-- Progress bar toward 3-cycle excellence threshold -->
                                    <div class="mt-2 flex items-center gap-2">
                                        <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div class="h-1.5 rounded-full transition-all duration-500 ${cycleCount >= 3 ? 'bg-emerald-500' : 'bg-rcem-purple'}" style="width:${progressPct}%"></div>
                                        </div>
                                        <span class="text-[10px] ${cycleCount >= 3 ? 'text-emerald-600 font-bold' : 'text-slate-400'} whitespace-nowrap">${progressLabel}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                    <button onclick="window.toggleIdeaBody(${ideaIdx})" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="${cycleCount} cycle${cycleCount !== 1 ? 's' : ''}">
                                        <i data-lucide="chevron-down" id="ci-toggle-icon-${ideaIdx}" class="w-4 h-4 transition-transform"></i>
                                    </button>
                                    <button onclick="window.deleteChangeIdea(${ideaIdx})" class="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete change idea">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Cycles body (collapsible) -->
                        <div id="ci-body-${ideaIdx}">

                            ${cycles.length === 0 ? `
                            <div class="px-5 py-6 text-center bg-slate-50/50">
                                <p class="text-sm text-slate-400">No PDSA cycles yet.</p>
                                <p class="text-xs text-slate-400 mt-0.5">Add your first cycle below to start testing this change.</p>
                            </div>` : cycles.map((p, cycleIdx) => {
                                const cStatusCls = { planning:'bg-slate-200 text-slate-600', doing:'bg-blue-100 text-blue-700', studying:'bg-amber-100 text-amber-700', acting:'bg-orange-100 text-orange-700', complete:'bg-emerald-100 text-emerald-700' };
                                const sCls = cStatusCls[p.status] || 'bg-slate-100 text-slate-500';
                                const actLower = (p.act || '').toLowerCase();
                                const autoDec  = actLower.includes('adopt') ? 'adopted' : actLower.includes('adapt') ? 'adapted' : actLower.includes('abandon') ? 'abandoned' : p.actDecision || '';
                                const decColors = { adopted:'bg-emerald-100 text-emerald-700', adapted:'bg-blue-100 text-blue-700', abandoned:'bg-red-100 text-red-700', ongoing:'bg-amber-100 text-amber-700', '':'bg-slate-100 text-slate-500' };
                                const dCls = decColors[autoDec] || decColors[''];
                                const pfx = `ci-${ideaIdx}-${cycleIdx}`;
                                return `
                                <div class="border-t border-slate-100">
                                    <!-- Cycle mini-header (always visible) -->
                                    <div class="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onclick="document.getElementById('cycle-body-${pfx}').classList.toggle('hidden'); this.querySelector('.cycle-chevron').classList.toggle('rotate-180')">
                                        <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">${cycleIdx + 1}</span>
                                        <span class="flex-1 font-medium text-sm text-slate-700 truncate">${escapeHtml(p.title || 'Cycle ' + (cycleIdx + 1))}</span>
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${sCls}">${p.status || 'planning'}</span>
                                        ${p.startDate || p.start ? `<span class="text-xs text-slate-400">${formatDate(p.startDate || p.start)}</span>` : ''}
                                        ${autoDec ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${dCls}">${autoDec}</span>` : ''}
                                        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-300 cycle-chevron transition-transform flex-shrink-0"></i>
                                        <button onclick="event.stopPropagation(); window.deleteCycleFromIdea(${ideaIdx}, ${cycleIdx})" class="p-1 text-slate-300 hover:text-red-400 transition-colors rounded flex-shrink-0" title="Delete cycle">
                                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                        </button>
                                    </div>

                                    <!-- Cycle body (collapsible P/D/S/A) -->
                                    <div id="cycle-body-${pfx}" class="hidden px-5 pb-5">
                                        <!-- Status + Owner + Date row -->
                                        <div class="grid grid-cols-3 gap-2 mb-3 mt-1">
                                            <div>
                                                <label class="text-[10px] font-bold uppercase text-slate-400 mb-0.5 block">Status</label>
                                                <select onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'status', this.value)"
                                                    class="w-full p-1.5 border rounded text-xs">
                                                    <option value="planning" ${p.status==='planning'?'selected':''}>Planning</option>
                                                    <option value="doing" ${p.status==='doing'?'selected':''}>Doing</option>
                                                    <option value="studying" ${p.status==='studying'?'selected':''}>Studying</option>
                                                    <option value="acting" ${p.status==='acting'?'selected':''}>Acting</option>
                                                    <option value="complete" ${p.status==='complete'?'selected':''}>Complete</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label class="text-[10px] font-bold uppercase text-slate-400 mb-0.5 block">Owner</label>
                                                <select onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'owner', this.value)"
                                                    class="w-full p-1.5 border rounded text-xs">
                                                    <option value="">No owner</option>
                                                    ${members.map(m => `<option value="${escapeHtml(m.name)}" ${p.owner===m.name?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div>
                                                <label class="text-[10px] font-bold uppercase text-slate-400 mb-0.5 block">Start Date</label>
                                                <input type="date" value="${escapeHtml(p.startDate||p.start||'')}"
                                                    onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'startDate', this.value)"
                                                    class="w-full p-1.5 border rounded text-xs">
                                            </div>
                                        </div>
                                        <!-- P/D/S/A fields -->
                                        <div class="space-y-2">
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div>
                                                    <label class="text-xs font-bold text-blue-600 flex items-center gap-1 mb-0.5">
                                                        <span class="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">P</span> Plan
                                                    </label>
                                                    <textarea onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'plan', this.value)"
                                                        class="w-full p-2 bg-blue-50/50 border border-blue-100 rounded text-sm min-h-[70px]"
                                                        placeholder="What specific change are you testing? Who, what, when, where?">${escapeHtml(p.plan||p.desc||'')}</textarea>
                                                </div>
                                                <div>
                                                    <label class="text-xs font-bold text-sky-600 flex items-center gap-1 mb-0.5">
                                                        <span class="w-4 h-4 rounded-full bg-sky-100 flex items-center justify-center text-[10px]">P</span> Prediction
                                                        <span class="text-[9px] font-normal text-sky-400 normal-case">(ARCP required)</span>
                                                    </label>
                                                    <textarea onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'prediction', this.value)"
                                                        class="w-full p-2 bg-sky-50/50 border border-sky-200 rounded text-sm min-h-[70px]"
                                                        placeholder="What do you predict will happen and why? Be specific and measurable.">${escapeHtml(p.prediction||'')}</textarea>
                                                </div>
                                            </div>
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div>
                                                    <label class="text-xs font-bold text-amber-600 flex items-center gap-1 mb-0.5">
                                                        <span class="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center text-[10px]">D</span> Do
                                                    </label>
                                                    <textarea onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'do', this.value)"
                                                        class="w-full p-2 bg-amber-50/50 border border-amber-100 rounded text-sm min-h-[70px]"
                                                        placeholder="What actually happened? Any deviations from the plan?">${escapeHtml(p.do||'')}</textarea>
                                                </div>
                                                <div>
                                                    <label class="text-xs font-bold text-purple-600 flex items-center gap-1 mb-0.5">
                                                        <span class="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center text-[10px]">S</span> Study
                                                    </label>
                                                    <textarea onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'study', this.value)"
                                                        class="w-full p-2 bg-purple-50/50 border border-purple-100 rounded text-sm min-h-[70px]"
                                                        placeholder="Did the results match your prediction? What did you learn?">${escapeHtml(p.study||'')}</textarea>
                                                </div>
                                            </div>
                                            <div>
                                                <div class="flex items-center justify-between mb-0.5">
                                                    <label class="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                                        <span class="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">A</span> Act
                                                        <span class="text-[9px] font-normal text-emerald-400 normal-case">— Adopt / Adapt / Abandon</span>
                                                    </label>
                                                    <select onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'actDecision', this.value)"
                                                        class="text-xs border rounded px-1.5 py-0.5 ${dCls}">
                                                        <option value="" ${!autoDec?'selected':''}>— Decision —</option>
                                                        <option value="adopted"  ${autoDec==='adopted'?'selected':''}>Adopted</option>
                                                        <option value="adapted"  ${autoDec==='adapted'?'selected':''}>Adapted</option>
                                                        <option value="abandoned" ${autoDec==='abandoned'?'selected':''}>Abandoned</option>
                                                        <option value="ongoing"  ${autoDec==='ongoing'?'selected':''}>Ongoing</option>
                                                    </select>
                                                </div>
                                                <textarea onchange="window.updateCycleInIdea(${ideaIdx}, ${cycleIdx}, 'act', this.value)"
                                                    class="w-full p-2 bg-emerald-50/50 border border-emerald-100 rounded text-sm min-h-[60px]"
                                                    placeholder="Will you ADOPT, ADAPT, or ABANDON this change? Why? What is your next cycle?">${escapeHtml(p.act||'')}</textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}

                            <!-- Add cycle button + inline form -->
                            <div class="border-t border-slate-100 px-5 py-3">
                                <button onclick="window.toggleAddCycleForm(${ideaIdx})"
                                    class="flex items-center gap-1.5 text-sm font-bold text-rcem-purple hover:text-indigo-700 transition-colors">
                                    <i data-lucide="plus-circle" class="w-4 h-4"></i> Add PDSA Cycle
                                </button>

                                <!-- Inline add-cycle form -->
                                <div id="ci-add-cycle-form-${ideaIdx}" class="hidden mt-3 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 space-y-2">
                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div class="sm:col-span-3">
                                            <label class="text-[10px] font-bold uppercase text-slate-500 mb-0.5 block">Cycle Template <span class="font-normal text-slate-400">(optional)</span></label>
                                            <select id="ci-cycle-tmpl-${ideaIdx}" class="w-full p-1.5 border rounded text-xs bg-white">
                                                <option value="">— Start blank —</option>
                                                <option value="education">Staff education session</option>
                                                <option value="audit">Audit &amp; feedback cycle</option>
                                                <option value="checklist">Process checklist</option>
                                                <option value="reminder">Visual reminder / prompt</option>
                                                <option value="protocol">Protocol / SOP update</option>
                                            </select>
                                        </div>
                                        <div class="sm:col-span-3">
                                            <label class="text-[10px] font-bold uppercase text-slate-500 mb-0.5 block">Cycle Title <span class="text-red-400">*</span></label>
                                            <input id="ci-cycle-title-${ideaIdx}" class="w-full p-1.5 border rounded text-xs bg-white" placeholder="e.g. Test with 5 patients">
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold uppercase text-slate-500 mb-0.5 block">Start Date</label>
                                            <input id="ci-cycle-start-${ideaIdx}" type="date" class="w-full p-1.5 border rounded text-xs bg-white">
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold uppercase text-slate-500 mb-0.5 block">Owner</label>
                                            <select id="ci-cycle-owner-${ideaIdx}" class="w-full p-1.5 border rounded text-xs bg-white">
                                                <option value="">No owner</option>
                                                ${members.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div class="flex items-end">
                                            <button onclick="window.addCycleToIdea(${ideaIdx})"
                                                class="w-full py-1.5 bg-rcem-purple text-white text-xs font-bold rounded hover:bg-indigo-700 transition-colors">
                                                Add Cycle
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Kept for backward compatibility (onboarding.js + other callers write to d.pdsa directly)
export function addPDSA() {
    const title = document.getElementById('pdsa-title')?.value;
    if (!title) { showToast('Please enter a cycle title', 'error'); return; }
    const d = state.projectData;
    if (!d.changeIdeas) d.changeIdeas = [];
    // Add to first active idea or create a default one
    let targetIdea = d.changeIdeas.find(ci => ci.status === 'active' || ci.status === 'planning');
    if (!targetIdea) {
        targetIdea = { id: 'ci-' + Date.now(), title: 'Change Idea 1', description: '', driverLink: '', status: 'active', pdsaCycles: [] };
        d.changeIdeas.push(targetIdea);
    }
    targetIdea.pdsaCycles.push({ title, startDate: '', start: '', owner: '', status: 'planning', plan: '', desc: '', prediction: '', do: '', study: '', act: '', actDecision: '' });
    syncPDSAFlat();
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('PDSA cycle added', 'success');
}

export function updatePDSA(index, field, value) {
    // Flat-index update — find the cycle in changeIdeas
    const d = state.projectData;
    let flat = 0;
    for (const idea of (d.changeIdeas || [])) {
        for (let j = 0; j < (idea.pdsaCycles || []).length; j++) {
            if (flat === index) {
                idea.pdsaCycles[j][field] = value;
                if (field === 'plan') idea.pdsaCycles[j].desc = value;
                if (field === 'startDate') idea.pdsaCycles[j].start = value;
                syncPDSAFlat();
                if (window.saveData) window.saveData();
                return;
            }
            flat++;
        }
    }
    // Fallback to direct pdsa array (legacy)
    if (d.pdsa?.[index]) { d.pdsa[index][field] = value; if (window.saveData) window.saveData(); }
}

export function deletePDSA(index) {
    window.showConfirmDialog('Delete this PDSA cycle?', () => {
        const d = state.projectData;
        let flat = 0;
        for (let i = 0; i < (d.changeIdeas || []).length; i++) {
            const cycles = d.changeIdeas[i].pdsaCycles || [];
            for (let j = 0; j < cycles.length; j++) {
                if (flat === index) {
                    cycles.splice(j, 1);
                    syncPDSAFlat();
                    if (window.saveData) window.saveData();
                    renderPDSA();
                    return;
                }
                flat++;
            }
        }
    }, 'Delete Cycle', 'Delete PDSA Cycle');
}


// ==========================================
// 7. STAKEHOLDER VIEW
// ==========================================

function resolveStakeholderOverlap(stakes) {
    // Apply light jitter to separate bubbles that are too close (<35px on a 100×100 grid)
    const minDist = 12; // percent units
    const MAX_ITER = 60;
    const positions = stakes.map(s => ({ x: s.x || 50, y: s.y || 50 }));
    
    for (let iter = 0; iter < MAX_ITER; iter++) {
        let moved = false;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[i].x - positions[j].x;
                const dy = positions[i].y - positions[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist && dist > 0) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist, ny = dy / dist;
                    positions[i].x = Math.max(5, Math.min(95, positions[i].x + nx * overlap));
                    positions[i].y = Math.max(5, Math.min(95, positions[i].y + ny * overlap));
                    positions[j].x = Math.max(5, Math.min(95, positions[j].x - nx * overlap));
                    positions[j].y = Math.max(5, Math.min(95, positions[j].y - ny * overlap));
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
    return positions;
}

export function renderStakeholders() {
    const d = state.projectData;
    if (!d) return;
    
    const canvas = document.getElementById('stakeholder-canvas');
    if (!canvas) return;
    
    const stakes = d.stakeholders || [];
    const resolvedPositions = resolveStakeholderOverlap(stakes);
    
    canvas.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <i data-lucide="target" class="text-indigo-500"></i> Stakeholder Matrix
                    </h2>
                    <p class="text-slate-500 text-sm">Map stakeholder power vs interest - drag to reposition</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.toggleStakeView()" class="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-sm flex items-center gap-1">
                        <i data-lucide="list" class="w-4 h-4"></i> List View
                    </button>
                    <button onclick="window.addStakeholder()" class="bg-rcem-purple text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add
                    </button>
                </div>
            </header>
            
            <div id="stakeholder-matrix" class="relative w-full aspect-square max-w-2xl mx-auto border-2 border-slate-200 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100">
                <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                    <div class="border-r border-b border-slate-200 p-3">
                        <span class="text-xs text-slate-400 font-medium bg-white/80 px-1 rounded">Keep Satisfied</span>
                        <span class="block text-[10px] text-slate-300 mt-1">High Power / Low Interest</span>
                    </div>
                    <div class="border-b border-slate-200 p-3 text-right">
                        <span class="text-xs text-slate-400 font-medium bg-white/80 px-1 rounded">Manage Closely</span>
                        <span class="block text-[10px] text-slate-300 mt-1">High Power / High Interest</span>
                    </div>
                    <div class="border-r border-slate-200 p-3">
                        <span class="text-xs text-slate-400 font-medium bg-white/80 px-1 rounded">Monitor</span>
                        <span class="block text-[10px] text-slate-300 mt-1">Low Power / Low Interest</span>
                    </div>
                    <div class="p-3 text-right">
                        <span class="text-xs text-slate-400 font-medium bg-white/80 px-1 rounded">Keep Informed</span>
                        <span class="block text-[10px] text-slate-300 mt-1">Low Power / High Interest</span>
                    </div>
                </div>
                
                <div class="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Power ↑</div>
                <div class="absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-xs font-bold text-slate-500 uppercase tracking-wider">Interest →</div>
                
                ${stakes.map((s, i) => {
                    const rp = resolvedPositions[i];
                    const isHighPower = rp.y >= 50;
                    const isHighInterest = rp.x >= 50;
                    let bgColor = 'bg-slate-600';
                    if (isHighPower && isHighInterest) bgColor = 'bg-red-600';
                    else if (isHighPower && !isHighInterest) bgColor = 'bg-amber-600';
                    else if (!isHighPower && isHighInterest) bgColor = 'bg-blue-600';
                    else bgColor = 'bg-slate-500';
                    
                    return `
                    <div class="stakeholder-label absolute cursor-move group z-10" 
                         style="left: ${rp.x.toFixed(1)}%; top: ${(100 - rp.y).toFixed(1)}%; transform: translate(-50%, -50%);"
                         data-index="${i}"
                         id="stake-${i}">
                        <div class="${bgColor} text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-xs font-medium max-w-[140px] text-center leading-tight">
                            <div class="font-bold">${escapeHtml(s.name || 'Unknown')}</div>
                            ${s.role ? `<div class="text-[10px] opacity-80 mt-0.5">${escapeHtml(s.role)}</div>` : ''}
                            ${s.organisation ? `<div class="text-[10px] opacity-70 mt-0.5">${escapeHtml(s.organisation)}</div>` : ''}
                        </div>
                        <button onclick="event.stopPropagation(); window.editStakeholder(${i})"
                                class="absolute -top-2 -left-2 w-5 h-5 bg-indigo-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-indigo-600" title="Edit">
                            <i data-lucide="pencil" class="w-2.5 h-2.5 pointer-events-none"></i>
                        </button>
                        <button onclick="event.stopPropagation(); window.removeStake(${i})" 
                                class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs hover:bg-red-600" title="Remove">
                            ×
                        </button>
                    </div>
                `;
                }).join('')}
            </div>
            
            <div class="mt-6 flex flex-wrap justify-center gap-4 text-xs">
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-600"></span> Manage Closely</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-600"></span> Keep Satisfied</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-600"></span> Keep Informed</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-500"></span> Monitor</div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        initStakeholderDrag();
    }, 100);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initStakeholderDrag() {
    const matrix = document.getElementById('stakeholder-matrix');
    if (!matrix) return;
    
    const labels = matrix.querySelectorAll('.stakeholder-label');
    
    labels.forEach(label => {
        const index = parseInt(label.dataset.index);
        
        label.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            
            const rect = matrix.getBoundingClientRect();
            
            const onMove = (ev) => {
                const x = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
                const y = Math.max(5, Math.min(95, 100 - ((ev.clientY - rect.top) / rect.height) * 100));
                
                label.style.left = `${x}%`;
                label.style.top = `${100 - y}%`;
            };
            
            const onUp = (ev) => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                
                const x = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
                const y = Math.max(5, Math.min(95, 100 - ((ev.clientY - rect.top) / rect.height) * 100));
                
                if (state.projectData.stakeholders && state.projectData.stakeholders[index]) {
                    state.projectData.stakeholders[index].x = x;
                    state.projectData.stakeholders[index].y = y;
                    if (window.saveData) window.saveData();
                    renderStakeholders();
                }
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}

export function addStakeholder() {
    window.showInputModal(
        'Add Stakeholder',
        [
            { id: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Dr Sarah Hart', required: true },
            { id: 'role', label: 'Role / Title', type: 'text', placeholder: 'e.g. Senior Nurse Manager' },
            { id: 'organisation', label: 'Organisation / Department', type: 'text', placeholder: 'e.g. Emergency Department' }
        ],
        (data) => {
            if (!state.projectData.stakeholders) state.projectData.stakeholders = [];
            state.projectData.stakeholders.push({
                name: data.name,
                role: data.role || '',
                organisation: data.organisation || '',
                x: 50,
                y: 50
            });
            if (window.saveData) window.saveData();
            renderStakeholders();
            showToast('Stakeholder added — drag to position', 'success');
        },
        'Add Stakeholder'
    );
}

export function updateStake(index, type, event) {
    // Handled by drag functionality
}

export function removeStake(index) {
    window.showConfirmDialog('Remove this stakeholder from the matrix?', () => {
        state.projectData.stakeholders.splice(index, 1);
        if (window.saveData) window.saveData();
        renderStakeholders();
        showToast('Stakeholder removed', 'info');
    }, 'Remove', 'Remove Stakeholder');
}

export function editStakeholder(index) {
    if (!state.projectData.stakeholders) return;
    const s = state.projectData.stakeholders[index];
    if (!s) return;
    window.showInputModal(
        'Edit Stakeholder',
        [
            { id: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Dr Sarah Hart', required: true, value: s.name || '' },
            { id: 'role', label: 'Role / Title', type: 'text', placeholder: 'e.g. Senior Nurse Manager', value: s.role || '' },
            { id: 'organisation', label: 'Organisation / Department', type: 'text', placeholder: 'e.g. Emergency Department', value: s.organisation || '' }
        ],
        (data) => {
            state.projectData.stakeholders[index].name = data.name;
            state.projectData.stakeholders[index].role = data.role || '';
            state.projectData.stakeholders[index].organisation = data.organisation || '';
            if (window.saveData) window.saveData();
            renderStakeholders();
            showToast('Stakeholder updated', 'success');
        },
        'Save Changes'
    );
}

export function toggleStakeView() {
    const d = state.projectData;
    const stakes = d.stakeholders || [];
    
    const canvas = document.getElementById('stakeholder-canvas');
    if (!canvas) return;
    
    canvas.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <i data-lucide="list" class="text-indigo-500"></i> Stakeholder List
                    </h2>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.renderStakeholders()" class="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-sm flex items-center gap-1">
                        <i data-lucide="grid-3x3" class="w-4 h-4"></i> Matrix View
                    </button>
                    <button onclick="window.addStakeholder()" class="bg-rcem-purple text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add
                    </button>
                </div>
            </header>
            
            ${stakes.length === 0 ? `
                <p class="text-slate-500 text-center py-8">No stakeholders added yet.</p>
            ` : `
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-slate-50">
                            <tr class="text-xs text-slate-500 uppercase">
                                <th class="px-4 py-3 text-left">Name</th>
                                <th class="px-4 py-3 text-left">Role</th>
                                <th class="px-4 py-3 text-left">Power</th>
                                <th class="px-4 py-3 text-left">Interest</th>
                                <th class="px-4 py-3 text-left">Strategy</th>
                                <th class="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${stakes.map((s, i) => {
                                const power = Math.round(s.y || 50);
                                const interest = Math.round(s.x || 50);
                                let strategy = 'Monitor';
                                let strategyColor = 'text-slate-600';
                                if (power >= 50 && interest >= 50) { strategy = 'Manage Closely'; strategyColor = 'text-red-600'; }
                                else if (power >= 50) { strategy = 'Keep Satisfied'; strategyColor = 'text-amber-600'; }
                                else if (interest >= 50) { strategy = 'Keep Informed'; strategyColor = 'text-blue-600'; }
                                
                                return `
                                    <tr class="hover:bg-slate-50">
                                        <td class="px-4 py-3 font-medium">${escapeHtml(s.name)}</td>
                                        <td class="px-4 py-3 text-sm text-slate-600">
                                            <div>${escapeHtml(s.role || '-')}</div>
                                            ${s.organisation ? `<div class="text-xs text-slate-400">${escapeHtml(s.organisation)}</div>` : ''}
                                        </td>
                                        <td class="px-4 py-3 text-sm">${power}%</td>
                                        <td class="px-4 py-3 text-sm">${interest}%</td>
                                        <td class="px-4 py-3 text-sm font-medium ${strategyColor}">${strategy}</td>
                                        <td class="px-4 py-3 text-right flex items-center justify-end gap-2">
                                            <button onclick="window.editStakeholder(${i})" class="text-slate-300 hover:text-indigo-500" title="Edit">
                                                <i data-lucide="pencil" class="w-4 h-4"></i>
                                            </button>
                                            <button onclick="window.removeStake(${i})" class="text-slate-300 hover:text-red-500" title="Remove">
                                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.renderStakeholders = renderStakeholders;

// ==========================================
// 8. GANTT VIEW
// ==========================================

let ganttZoomLevel = 'weeks';

export function renderGantt() {
    const d = state.projectData;
    if (!d) return;
    
    const container = document.getElementById('gantt-container');
    if (!container) return;
    
    const tasks = d.gantt || [];
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="calendar-clock" class="w-16 h-16 text-slate-300 mx-auto mb-4"></i>
                <p class="text-slate-500 mb-4">No tasks yet. Add your project timeline.</p>
                <button onclick="window.openGanttModal()" class="bg-rcem-purple text-white px-4 py-2 rounded-lg">
                    Add First Task
                </button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    let minDate = new Date();
    let maxDate = new Date();
    tasks.forEach(t => {
        if (t.start) {
            const s = new Date(t.start);
            if (s < minDate) minDate = new Date(s);
        }
        if (t.end) {
            const e = new Date(t.end);
            if (e > maxDate) maxDate = new Date(e);
        }
    });
    
    const padding = ganttZoomLevel === 'days' ? 7 : ganttZoomLevel === 'weeks' ? 14 : 30;
    minDate.setDate(minDate.getDate() - padding);
    maxDate.setDate(maxDate.getDate() + padding);
    
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const dayWidth = ganttZoomLevel === 'days' ? 40 : ganttZoomLevel === 'weeks' ? 20 : 8;
    
    let timeHeaders = '';
    if (ganttZoomLevel === 'days') {
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            const dayNum = currentDate.getDate();
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            timeHeaders += `<div class="text-xs text-slate-500 text-center ${isWeekend ? 'bg-slate-100' : ''}" style="width: ${dayWidth}px">${dayNum}</div>`;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (ganttZoomLevel === 'weeks') {
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            const weekStart = currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            timeHeaders += `<div class="text-xs text-slate-500 px-1 border-l border-slate-200" style="width: ${7 * dayWidth}px">${weekStart}</div>`;
            currentDate.setDate(currentDate.getDate() + 7);
        }
    } else {
        let currentDate = new Date(minDate);
        currentDate.setDate(1);
        while (currentDate <= maxDate) {
            const monthName = currentDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            timeHeaders += `<div class="text-xs text-slate-500 px-2 border-l border-slate-200 font-medium" style="width: ${daysInMonth * dayWidth}px">${monthName}</div>`;
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
    
    const typeColors = {
        'plan': 'bg-blue-500',
        'data': 'bg-emerald-500',
        'pdsa': 'bg-amber-500',
        'do': 'bg-amber-500',
        'review': 'bg-purple-500',
        'study': 'bg-purple-500',
        'sustain': 'bg-emerald-600',
        'act': 'bg-emerald-600'
    };
    
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 px-2">
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">Zoom:</span>
                <div class="flex bg-slate-100 rounded-lg p-1">
                    <button onclick="window.setGanttZoom('days')" class="px-3 py-1 text-xs font-medium rounded ${ganttZoomLevel === 'days' ? 'bg-white shadow text-rcem-purple' : 'text-slate-600 hover:bg-slate-200'}">Days</button>
                    <button onclick="window.setGanttZoom('weeks')" class="px-3 py-1 text-xs font-medium rounded ${ganttZoomLevel === 'weeks' ? 'bg-white shadow text-rcem-purple' : 'text-slate-600 hover:bg-slate-200'}">Weeks</button>
                    <button onclick="window.setGanttZoom('months')" class="px-3 py-1 text-xs font-medium rounded ${ganttZoomLevel === 'months' ? 'bg-white shadow text-rcem-purple' : 'text-slate-600 hover:bg-slate-200'}">Months</button>
                </div>
            </div>
            <div class="text-xs text-slate-400">
                ${tasks.length} tasks • ${Math.round(totalDays / 7)} weeks
            </div>
        </div>
        
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <div style="min-width: ${totalDays * dayWidth + 200}px">
                <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                    <div class="w-48 flex-shrink-0 px-3 py-2 font-bold text-xs text-slate-500 uppercase border-r border-slate-200">Task</div>
                    <div class="flex-1 flex overflow-hidden">
                        ${timeHeaders}
                    </div>
                </div>
                
                ${tasks.map((t, i) => {
                    const start = t.start ? new Date(t.start) : minDate;
                    const end = t.end ? new Date(t.end) : start;
                    const startOffset = Math.max(0, Math.ceil((start - minDate) / (1000 * 60 * 60 * 24)));
                    const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
                    
                    const barColor = typeColors[t.type] || 'bg-slate-400';
                    
                    return `
                        <div class="flex border-b border-slate-100 hover:bg-slate-50 group">
                            <div class="w-48 flex-shrink-0 px-3 py-3 border-r border-slate-100 flex items-center justify-between">
                                <div class="truncate text-sm text-slate-700 flex items-center gap-2" title="${escapeHtml(t.name || 'Untitled')}">
                                    ${t.milestone ? '<i data-lucide="flag" class="w-3 h-3 text-amber-500 flex-shrink-0"></i>' : ''}
                                    ${escapeHtml(t.name || 'Untitled')}
                                </div>
                                <button onclick="window.deleteGanttTask(${i})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0 ml-2">
                                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                                </button>
                            </div>
                            <div class="flex-1 relative py-2" style="min-height: 32px;">
                                <div class="absolute h-6 rounded ${barColor} shadow-sm flex items-center px-2 text-white text-[10px] font-medium overflow-hidden hover:shadow-md transition-shadow"
                                     style="left: ${startOffset * dayWidth}px; width: ${duration * dayWidth}px;"
                                     title="${escapeHtml(t.name)}: ${t.start} to ${t.end}${t.owner ? ' (' + t.owner + ')' : ''}">
                                    ${t.milestone ? '<i data-lucide="flag" class="w-3 h-3 mr-1"></i>' : ''}
                                    <span class="truncate">${duration > 3 ? escapeHtml(t.name) : ''}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-500"></span> Planning</div>
            <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-500"></span> Data Collection</div>
            <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-500"></span> PDSA / Do</div>
            <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-purple-500"></span> Review / Study</div>
            <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-emerald-600"></span> Sustain / Act</div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.setGanttZoom = function(level) {
    ganttZoomLevel = level;
    renderGantt();
};

export function openGanttModal(index = null) {
    const modal = document.getElementById('task-modal');
    if (!modal) return;
    
    const d = state.projectData;
    const task = index !== null ? (d.gantt || [])[index] : null;
    
    document.getElementById('task-index').value = index ?? '';
    document.getElementById('task-name').value = task?.name || '';
    document.getElementById('task-start').value = task?.start || '';
    document.getElementById('task-end').value = task?.end || '';
    document.getElementById('task-type').value = task?.type || 'plan';
    document.getElementById('task-owner').value = task?.owner || '';
    document.getElementById('task-milestone').checked = task?.milestone || false;
    
    const depSelect = document.getElementById('task-dep');
    if (depSelect) {
        const tasks = d.gantt || [];
        depSelect.innerHTML = `<option value="">None</option>` + 
            tasks.filter((_, i) => i !== index).map((t, i) => 
                `<option value="${t.id || i}" ${task?.dependency === (t.id || String(i)) ? 'selected' : ''}>${escapeHtml(t.name || `Task ${i + 1}`)}</option>`
            ).join('');
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==========================================
// 10. FULL PROJECT VIEW
// ==========================================

export function renderFullProject() {
    const d = state.projectData;
    if (!d) return;
    
    const container = document.getElementById('full-project-container');
    if (!container) return;
    
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const team = d.teamMembers || [];
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    const stakes = d.stakeholders || [];
    const logs = d.leadershipLogs || [];
    
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-0">
            <header class="bg-gradient-to-r from-rcem-purple to-indigo-700 text-white p-8 rounded-t-xl print:rounded-none">
                <h1 class="text-3xl font-bold">${escapeHtml(d.meta?.title || 'Untitled QIP')}</h1>
                <p class="text-indigo-200 mt-2">Quality Improvement Project Report</p>
                <div class="mt-4 flex flex-wrap gap-4 text-sm">
                    ${team.length > 0 ? `<span><i data-lucide="user" class="w-4 h-4 inline mr-1"></i> ${escapeHtml(team[0].name)}</span>` : ''}
                    <span><i data-lucide="calendar" class="w-4 h-4 inline mr-1"></i> ${new Date().toLocaleDateString('en-GB')}</span>
                    <span><i data-lucide="activity" class="w-4 h-4 inline mr-1"></i> ${d.chartData?.length || 0} data points</span>
                    <span><i data-lucide="refresh-cw" class="w-4 h-4 inline mr-1"></i> ${pdsa.length} PDSA cycles</span>
                </div>
            </header>
            
            <div class="p-8 space-y-8">
                <section class="bg-slate-50 rounded-lg p-6 border-l-4 border-rcem-purple">
                    <h2 class="text-lg font-bold text-slate-800 mb-3">Executive Summary</h2>
                    <p class="text-slate-600 leading-relaxed">
                        ${c.aim ? `This project aimed to ${escapeHtml(c.aim.toLowerCase().replace(/^to /i, ''))}` : 'Aim not yet defined.'}
                        ${c.results_analysis ? ` Key findings: ${escapeHtml(c.results_analysis.substring(0, 200))}...` : ''}
                    </p>
                </section>
                
                ${c.problem_desc ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm">1</span>
                            Problem Statement
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.problem_desc)}</p>
                        ${c.problem_context ? `<div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4"><h4 class="font-bold text-blue-800 text-sm uppercase mb-2">Department Context &amp; Setting</h4><p class="text-slate-600 text-sm whitespace-pre-line">${escapeHtml(c.problem_context)}</p></div>` : ''}
                        ${c.problem_evidence ? `<div class="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4"><h4 class="font-bold text-amber-800 text-sm uppercase mb-2">Baseline Evidence &amp; Data</h4><p class="text-slate-600 text-sm whitespace-pre-line">${escapeHtml(c.problem_evidence)}</p></div>` : ''}
                    </section>
                ` : ''}
                
                ${c.aim ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">2</span>
                            SMART Aim
                        </h2>
                        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <p class="text-indigo-900 font-medium italic text-lg">"${escapeHtml(c.aim)}"</p>
                        </div>
                        ${c.aim2 ? `
                        <div class="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-4">
                            <p class="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Secondary Aim</p>
                            <p class="text-violet-900 font-medium italic">"${escapeHtml(c.aim2)}"</p>
                        </div>
                        ` : ''}
                    </section>
                ` : ''}
                
                ${(c.outcome_measure || c.process_measure || c.balance_measure) ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">3</span>
                            Family of Measures
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            ${c.outcome_measure ? `
                                <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <h4 class="font-bold text-emerald-800 text-sm uppercase mb-2">Outcome Measure</h4>
                                    <p class="text-emerald-700 text-sm">${escapeHtml(c.outcome_measure)}</p>
                                </div>
                            ` : ''}
                            ${c.process_measure ? `
                                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 class="font-bold text-blue-800 text-sm uppercase mb-2">Process Measure</h4>
                                    <p class="text-blue-700 text-sm">${escapeHtml(c.process_measure)}</p>
                                </div>
                            ` : ''}
                            ${c.balance_measure ? `
                                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <h4 class="font-bold text-amber-800 text-sm uppercase mb-2">Balancing Measure</h4>
                                    <p class="text-amber-700 text-sm">${escapeHtml(c.balance_measure)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </section>
                ` : ''}
                
                ${team.length > 0 ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm">4</span>
                            QI Team
                        </h2>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            ${team.map(m => `
                                <div class="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold text-sm">
                                        ${escapeHtml((m.name || '?')[0])}
                                    </div>
                                    <div>
                                        <div class="font-medium text-slate-800 text-sm">${escapeHtml(m.name)}</div>
                                        <div class="text-xs text-slate-500">${escapeHtml(m.role || m.grade || '')}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}
                
                ${(drivers.primary.length > 0 || drivers.changes.length > 0) ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-sm">5</span>
                            Driver Diagram
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h4 class="font-bold text-slate-700 text-sm uppercase mb-2">Primary Drivers</h4>
                                <ul class="space-y-1">
                                    ${drivers.primary.map(p => `<li class="text-sm text-slate-600 flex items-start gap-2"><span class="text-blue-500 mt-1">•</span> ${escapeHtml(p)}</li>`).join('')}
                                </ul>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-700 text-sm uppercase mb-2">Secondary Drivers</h4>
                                <ul class="space-y-1">
                                    ${drivers.secondary.slice(0, 6).map(s => `<li class="text-sm text-slate-600 flex items-start gap-2"><span class="text-sky-500 mt-1">•</span> ${escapeHtml(s)}</li>`).join('')}
                                    ${drivers.secondary.length > 6 ? `<li class="text-xs text-slate-400">...and ${drivers.secondary.length - 6} more</li>` : ''}
                                </ul>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-700 text-sm uppercase mb-2">Change Ideas</h4>
                                <ul class="space-y-1">
                                    ${drivers.changes.slice(0, 6).map(ch => `<li class="text-sm text-slate-600 flex items-start gap-2"><span class="text-emerald-500 mt-1">•</span> ${escapeHtml(ch)}</li>`).join('')}
                                    ${drivers.changes.length > 6 ? `<li class="text-xs text-slate-400">...and ${drivers.changes.length - 6} more</li>` : ''}
                                </ul>
                            </div>
                        </div>
                    </section>
                ` : ''}
                
                ${pdsa.length > 0 ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">6</span>
                            PDSA Cycles (${pdsa.length})
                        </h2>
                        <div class="space-y-4">
                            ${pdsa.map((p, i) => `
                                <div class="border border-slate-200 rounded-lg overflow-hidden">
                                    <div class="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <h4 class="font-bold text-slate-800">Cycle ${i + 1}: ${escapeHtml(p.title || 'Untitled')}</h4>
                                        <span class="text-xs text-slate-500">${p.startDate || p.start || ''}</span>
                                    </div>
                                    <div class="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200">
                                        <div class="p-3 bg-blue-50/30">
                                            <div class="text-[10px] font-bold text-blue-600 uppercase mb-1">Plan</div>
                                            <p class="text-xs text-slate-600 line-clamp-3">${escapeHtml((p.plan || p.desc || 'Not documented').substring(0, 150))}${(p.plan || p.desc || '').length > 150 ? '...' : ''}</p>
                                        </div>
                                        <div class="p-3 bg-amber-50/30">
                                            <div class="text-[10px] font-bold text-amber-600 uppercase mb-1">Do</div>
                                            <p class="text-xs text-slate-600 line-clamp-3">${escapeHtml((p.do || 'Not documented').substring(0, 150))}${(p.do || '').length > 150 ? '...' : ''}</p>
                                        </div>
                                        <div class="p-3 bg-purple-50/30">
                                            <div class="text-[10px] font-bold text-purple-600 uppercase mb-1">Study</div>
                                            <p class="text-xs text-slate-600 line-clamp-3">${escapeHtml((p.study || 'Not documented').substring(0, 150))}${(p.study || '').length > 150 ? '...' : ''}</p>
                                        </div>
                                        <div class="p-3 bg-emerald-50/30">
                                            <div class="text-[10px] font-bold text-emerald-600 uppercase mb-1">Act</div>
                                            <p class="text-xs text-slate-600 line-clamp-3">${escapeHtml((p.act || 'Not documented').substring(0, 150))}${(p.act || '').length > 150 ? '...' : ''}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}
                
                <section>
                    <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">7</span>
                        Results
                    </h2>
                    <div id="full-view-chart-container" class="bg-slate-50 rounded-lg p-4 min-h-[300px] mb-4"></div>
                    ${c.results_analysis ? `
                        <div class="bg-slate-50 rounded-lg p-4">
                            <h4 class="font-bold text-slate-700 text-sm mb-2">Analysis</h4>
                            <p class="text-slate-600 text-sm leading-relaxed whitespace-pre-line">${escapeHtml(c.results_analysis)}</p>
                        </div>
                    ` : ''}
                </section>
                
                ${c.lit_review ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">8</span>
                            Literature Review
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.lit_review)}</p>
                    </section>
                ` : ''}
                
                ${c.ethics ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">9</span>
                            Ethics & Governance
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.ethics)}</p>
                    </section>
                ` : ''}
                
                ${logs.length > 0 ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">10</span>
                            Leadership Engagement
                        </h2>
                        <div class="border border-slate-200 rounded-lg overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-slate-50">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Activity</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${logs.slice(0, 10).map(l => `
                                        <tr>
                                            <td class="px-3 py-2 text-slate-600 font-mono text-xs">${escapeHtml(l.date || '')}</td>
                                            <td class="px-3 py-2 text-slate-600">${escapeHtml(l.note || '')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ${logs.length > 10 ? `<div class="px-3 py-2 text-xs text-slate-400 bg-slate-50">...and ${logs.length - 10} more entries</div>` : ''}
                        </div>
                    </section>
                ` : ''}
                
                ${c.learning_points ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm">11</span>
                            Key Learning Points
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.learning_points)}</p>
                    </section>
                ` : ''}
                
                ${c.sustainability ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">12</span>
                            Sustainability Plan
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.sustainability)}</p>
                    </section>
                ` : ''}
            </div>
            

                <!-- ===== FISHBONE DIAGRAM ===== -->
                ${(d.fishbone?.categories?.filter(c=>c.text).length > 0) ? (() => {
                    const cats = d.fishbone.categories.filter(c => c.text);
                    // SVG skeleton — no cause text in SVG to prevent overlap
                    const W = 1060, H = 340, spineY = H/2, headX = W-80, tailX = 60;
                    const spacing = (headX - tailX) / (cats.length + 1);
                    const armH = 120;
                    let paths = '', lbls = '';
                    cats.forEach((cat, i) => {
                        const bx = tailX + (i+1)*spacing;
                        const above = i%2===0;
                        const ex = bx - spacing*0.38;
                        const ey = above ? spineY-armH : spineY+armH;
                        // Bone arm
                        paths += `<line x1="${bx}" y1="${spineY}" x2="${ex}" y2="${ey}" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round"/>`;
                        // Tick marks for causes (no text — detail goes in cards below)
                        (cat.causes||[]).slice(0,6).forEach((_, j) => {
                            const t = (j+1) / (Math.min((cat.causes||[]).length, 6) + 1);
                            const cx = bx + t*(ex-bx), cy = spineY + t*(ey-spineY);
                            const tx2 = cx + (above ? -22 : -22), ty2 = cy + (above ? -18 : 18);
                            paths += `<line x1="${cx}" y1="${cy}" x2="${tx2}" y2="${ty2}" stroke="#818cf8" stroke-width="1.5" opacity="0.65"/>`;
                        });
                        // Category label pill
                        const safe = escapeHtml(cat.text||'');
                        const pw = Math.min(safe.length * 7 + 22, 170);
                        const py = above ? ey-28 : ey+8;
                        lbls += `<rect x="${ex - pw/2}" y="${py}" width="${pw}" height="22" rx="5" fill="#312e81"/>`;
                        lbls += `<text x="${ex}" y="${py+15}" text-anchor="middle" font-size="11" font-weight="700" fill="white">${safe}</text>`;
                    });
                    // Problem label (short excerpt)
                    const probText = escapeHtml((d.checklist?.problem_desc||d.fivewhys?.problem||'').substring(0,20)) + ((d.checklist?.problem_desc||d.fivewhys?.problem||'').length > 20 ? '\u2026' : '');
                    // Cause detail cards
                    const cardHtml = cats.map(cat => `
                        <div class="bg-white rounded-lg border border-indigo-100 p-3">
                            <div class="font-bold text-indigo-800 text-sm mb-2 pb-1 border-b border-indigo-100">${escapeHtml(cat.text||'')}</div>
                            <ul class="space-y-1">
                                ${(cat.causes||[]).length > 0
                                    ? (cat.causes||[]).map(c => `<li class="text-xs text-slate-600 flex gap-1.5 items-start"><span class="text-indigo-400 mt-0.5 flex-shrink-0">&bull;</span><span>${escapeHtml(c.text||'')}</span></li>`).join('')
                                    : '<li class="text-xs text-slate-400 italic">No causes added</li>'}
                            </ul>
                        </div>`).join('');
                    return `<section>
                        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">F</span>
                            Fishbone (Cause &amp; Effect) Diagram
                        </h2>
                        <div class="bg-slate-50 rounded-xl border border-slate-200 p-3 overflow-x-auto mb-4">
                            <svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="min-height:160px;max-height:280px">
                                <rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc" rx="8"/>
                                <line x1="${tailX}" y1="${spineY}" x2="${headX}" y2="${spineY}" stroke="#1e1b4b" stroke-width="3.5"/>
                                <polygon points="${headX+4},${spineY} ${headX-14},${spineY-8} ${headX-14},${spineY+8}" fill="#1e1b4b"/>
                                ${paths}${lbls}
                                <rect x="${headX+6}" y="${spineY-24}" width="78" height="48" rx="6" fill="#ef4444"/>
                                <text x="${headX+45}" y="${spineY-6}" text-anchor="middle" font-size="10" font-weight="bold" fill="white">Problem</text>
                                <text x="${headX+45}" y="${spineY+9}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.8)">${probText}</text>
                            </svg>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">${cardHtml}</div>
                    </section>`;
                })() : ''}

                <!-- ===== STAKEHOLDER POWER/INTEREST MAP ===== -->
                ${(d.stakeholders?.length > 0) ? (() => {
                    // Stakeholders use s.x (interest, left→right) and s.y (power, 0=bottom, 100=top)
                    // CSS top = 100 - s.y  (matching the interactive view)
                    // De-overlap: bucket to nearest 5% grid and spiral-spread clashes
                    const offsets = [[0,0],[5,-5],[5,5],[-5,5],[-5,-5],[0,-8],[8,0],[0,8],[-8,0],[3,-8],[-3,-8],[3,8],[-3,8]];
                    const buckets = {};
                    d.stakeholders.forEach((s, idx) => {
                        const bx = Math.round((s.x||50) / 5) * 5;
                        const by = Math.round((100-(s.y||50)) / 5) * 5; // CSS top bucket
                        const key = `${bx}_${by}`;
                        if (!buckets[key]) buckets[key] = [];
                        buckets[key].push(idx);
                    });
                    const finalPos = d.stakeholders.map((s, idx) => {
                        // cssLeft = s.x, cssTop = 100 - s.y
                        const baseLeft = Math.max(5, Math.min(95, s.x||50));
                        const baseTop  = Math.max(5, Math.min(95, 100-(s.y||50)));
                        const bx = Math.round(baseLeft/5)*5, by = Math.round(baseTop/5)*5;
                        const key = `${bx}_${by}`;
                        const slot = buckets[key].indexOf(idx);
                        const [ox, oy] = offsets[slot % offsets.length];
                        return { left: Math.max(4, Math.min(96, baseLeft + ox)), top: Math.max(4, Math.min(96, baseTop + oy)) };
                    });
                    const dots = d.stakeholders.map((s, idx) => {
                        const { left, top } = finalPos[idx];
                        const hp = (s.y||50) >= 50, hi = (s.x||50) >= 50; // high power = high y
                        const bg = hp&&hi?'#dc2626':hp?'#d97706':hi?'#2563eb':'#64748b';
                        const initials = (s.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
                        return `<div style="position:absolute;left:${left}%;top:${top}%;transform:translate(-50%,-50%);z-index:${idx+1}" title="${escapeHtml(s.name||'')}">
                            <div style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.8)">${escapeHtml(initials)}</div>
                        </div>`;
                    }).join('');
                    return `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm font-bold">S</span>
                            Stakeholder Power / Interest Matrix
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="relative bg-white rounded-xl border-2 border-slate-200" style="aspect-ratio:1;">
                                <!-- Axis labels -->
                                <div class="absolute -left-6 inset-y-0 flex items-center pointer-events-none">
                                    <span style="writing-mode:vertical-rl;transform:rotate(180deg)" class="text-[10px] font-bold text-slate-500 tracking-widest">POWER &uarr;</span>
                                </div>
                                <div class="absolute inset-x-0 -bottom-5 flex justify-center pointer-events-none">
                                    <span class="text-[10px] font-bold text-slate-500 tracking-widest">INTEREST &rarr;</span>
                                </div>
                                <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                                    <div class="border-r border-b border-slate-200 bg-amber-50/60 p-2 flex flex-col justify-start"><span class="text-[9px] font-bold text-amber-700">KEEP SATISFIED</span><span class="text-[8px] text-amber-500">High Power / Low Interest</span></div>
                                    <div class="border-b border-slate-200 bg-red-50/60 p-2 flex flex-col items-end"><span class="text-[9px] font-bold text-red-700">MANAGE CLOSELY</span><span class="text-[8px] text-red-500">High Power / High Interest</span></div>
                                    <div class="border-r border-slate-200 bg-slate-50 p-2 flex flex-col justify-end"><span class="text-[9px] font-bold text-slate-500">MONITOR</span><span class="text-[8px] text-slate-400">Low Power / Low Interest</span></div>
                                    <div class="bg-blue-50/60 p-2 flex flex-col items-end justify-end"><span class="text-[9px] font-bold text-blue-700">KEEP INFORMED</span><span class="text-[8px] text-blue-500">Low Power / High Interest</span></div>
                                </div>
                                <div class="absolute inset-y-0 left-1/2 border-l border-slate-300 pointer-events-none"></div>
                                <div class="absolute inset-x-0 top-1/2 border-t border-slate-300 pointer-events-none"></div>
                                ${dots}
                            </div>
                            <div class="space-y-2">
                                ${d.stakeholders.map(s => {
                                    const hp=(s.y||50)>=50, hi=(s.x||50)>=50;
                                    const q=hp&&hi?'Manage Closely':hp?'Keep Satisfied':hi?'Keep Informed':'Monitor';
                                    const qc=hp&&hi?'bg-red-100 text-red-700':hp?'bg-amber-100 text-amber-700':hi?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600';
                                    return `<div class="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-3 py-2">
                                        <div class="flex-1 min-w-0">
                                            <div class="font-medium text-sm text-slate-800 truncate">${escapeHtml(s.name||'')}</div>
                                            <div class="text-xs text-slate-400">${escapeHtml([s.role, s.organisation].filter(Boolean).join(' \u2014 '))}</div>
                                        </div>
                                        <span class="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${qc}">${q}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    </section>
                `;
                })() : ''}

                <!-- ===== 5-WHYS ===== -->
                ${(d.fivewhys?.problem) ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold">5</span>
                            5-Whys Root Cause Analysis
                        </h2>
                        <div class="space-y-2">
                            <div class="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4">
                                <div class="text-xs font-bold text-red-600 uppercase mb-1">Problem Statement</div>
                                <p class="text-slate-700 font-medium">${escapeHtml(d.fivewhys.problem)}</p>
                            </div>
                            ${['why1','why2','why3','why4','why5'].filter(k=>d.fivewhys[k]).map((k,i)=>`
                            <div class="flex items-start gap-3 pl-4">
                                <div class="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mt-0.5">W${i+1}</div>
                                <div class="bg-white border border-slate-200 rounded-lg p-3 flex-1">
                                    <div class="text-xs font-bold text-slate-500 uppercase mb-0.5">Why ${i+1}</div>
                                    <p class="text-slate-700 text-sm">${escapeHtml(d.fivewhys[k])}</p>
                                </div>
                            </div>`).join('')}
                            ${d.fivewhys.rootCause ? `
                            <div class="bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg p-4 mt-2">
                                <div class="text-xs font-bold text-emerald-700 uppercase mb-1">Root Cause Identified</div>
                                <p class="text-emerald-800 font-semibold">${escapeHtml(d.fivewhys.rootCause)}</p>
                            </div>` : ''}
                        </div>
                    </section>
                ` : ''}

                <!-- ===== GANTT TIMELINE ===== -->
                ${(d.gantt?.length > 0) ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">G</span>
                            Project Timeline (Gantt)
                        </h2>
                        <div class="border border-slate-200 rounded-xl overflow-hidden">
                            <table class="w-full text-sm">
                                <thead class="bg-slate-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Task</th>
                                        <th class="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Start</th>
                                        <th class="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">End</th>
                                        <th class="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Progress</th>
                                        <th class="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Owner</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${d.gantt.map(g=>`
                                    <tr class="hover:bg-slate-50">
                                        <td class="px-4 py-2 font-medium text-slate-800">${escapeHtml(g.task||g.title||'')}</td>
                                        <td class="px-4 py-2 text-slate-500 text-xs font-mono">${escapeHtml(g.start||g.startDate||'')}</td>
                                        <td class="px-4 py-2 text-slate-500 text-xs font-mono">${escapeHtml(g.end||g.endDate||'')}</td>
                                        <td class="px-4 py-2">
                                            <div class="flex items-center gap-2">
                                                <div class="flex-1 bg-slate-200 rounded-full h-2 min-w-[60px]">
                                                    <div class="bg-indigo-500 rounded-full h-2" style="width:${Math.min(100,Math.max(0,parseInt(g.progress||g.percent||0)))}%"></div>
                                                </div>
                                                <span class="text-xs text-slate-500 flex-shrink-0">${parseInt(g.progress||g.percent||0)}%</span>
                                            </div>
                                        </td>
                                        <td class="px-4 py-2 text-slate-500 text-xs">${escapeHtml(g.owner||g.responsible||'')}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ` : ''}

                <!-- ===== SURVEYS ===== -->
                ${(d.surveys?.length > 0) ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm font-bold">Q</span>
                            Surveys &amp; Patient Feedback (${d.surveys.length})
                        </h2>
                        <div class="space-y-3">
                            ${d.surveys.map((sv,i)=>`
                            <div class="bg-white border border-slate-200 rounded-xl p-4">
                                <div class="flex items-center justify-between mb-2">
                                    <h4 class="font-bold text-slate-800">${escapeHtml(sv.title||sv.name||'Survey '+(i+1))}</h4>
                                    <span class="text-xs text-slate-400">${escapeHtml(sv.date||sv.createdAt||'')}</span>
                                </div>
                                ${sv.responses ? `<p class="text-sm text-slate-600">Responses: ${sv.responses}</p>` : ''}
                                ${sv.summary ? `<p class="text-sm text-slate-600 mt-1">${escapeHtml(sv.summary)}</p>` : ''}
                            </div>`).join('')}
                        </div>
                    </section>
                ` : ''}

            <footer class="bg-slate-50 px-8 py-4 rounded-b-xl border-t border-slate-200 print:bg-white">
                <div class="flex justify-between items-center text-xs text-slate-500">
                    <span>Generated by RCEM QIP Assistant</span>
                    <span>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
            </footer>
        </div>
    `;
    
    setTimeout(() => {
        if (window.renderFullViewChart) window.renderFullViewChart();
    }, 100);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 11. PUBLISH VIEW
// ==========================================

export function renderPublish(mode = 'qiat') {
    const d = state.projectData;
    if (!d) return;
    
    const content = document.getElementById('publish-content');
    if (!content) return;
    
    ['qiat', 'abstract', 'report'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
            btn.className = mode === m
                ? "px-3 py-1 text-sm font-bold rounded bg-white shadow text-rcem-purple"
                : "px-3 py-1 text-sm font-bold rounded text-slate-500 hover:bg-slate-200";
        }
    });
    
    if (mode === 'qiat') {
        content.innerHTML = renderQIATForm(d);
        // Make QIAT narrative divs editable (inline editing before copying to portfolio)
        setTimeout(() => {
            const qiatIds = ['qiat-pdp', 'qiat-education', 'qiat-learning', 'qiat-reflections', 'qiat-next-pdp'];
            qiatIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && !state.isReadOnly) {
                    el.contentEditable = 'plaintext-only';
                    el.title = 'Click to edit before copying to your portfolio';
                    el.classList.add('focus:outline-none', 'focus:ring-2', 'focus:ring-indigo-300', 'cursor-text', 'hover:bg-indigo-50/50', 'transition-colors');
                    // Add subtle edit hint on first editable div
                    if (id === 'qiat-pdp' && !el.dataset.hintAdded) {
                        el.dataset.hintAdded = '1';
                        const hint = document.createElement('div');
                        hint.className = 'text-[10px] text-indigo-400 mt-1 flex items-center gap-1';
                        hint.innerHTML = '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> All text boxes are editable — personalise before copying to risr/Advance';
                        el.parentNode?.insertBefore(hint, el.nextSibling);
                    }
                }
            });
        }, 100);
    } else if (mode === 'abstract') {
        content.innerHTML = renderAbstractForm(d);
    } else {
        content.innerHTML = renderReportForm(d);
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Helper: empty state placeholder for QIAT text fields 
function qiatEmptyState(promptText) {
    return `<p class="text-slate-400 italic text-sm select-none">${escapeHtml(promptText)}</p>`;
}

// Save training stage 
window.saveTrainingStage = function(value) {
    if (!state.projectData.meta) state.projectData.meta = {};
    state.projectData.meta.trainingStage = value;
    if (window.saveData) window.saveData();
    // Re-render to update stage-specific guidance
    renderPublish('qiat');
};

function renderQIATForm(d) {
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const team = d.teamMembers || [];
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    const logs = d.leadershipLogs || [];
    const trainingStage = d.meta?.trainingStage || '';
    const isHigher = trainingStage === 'higher';
    const isACCS = trainingStage === 'accs';
    
    // QI Journey checklist (derived from actual project data)
    const hasCreatingConditions = logs.length > 0 || team.length > 1;
    const hasUnderstandingSystems = d.fishbone?.categories?.some(cat => cat.causes?.length > 0) || drivers.primary.length > 0;
    const hasDevelopingAims = !!c.aim;
    const hasTestingChanges = pdsa.length > 0;
    const hasImplement = pdsa.some(p => p.status === 'complete' || p.act?.toLowerCase().includes('adopt'));
    const hasSpread = c.sustainability?.toLowerCase().includes('spread') || c.sustainability?.toLowerCase().includes('other');
    const hasLeadership = logs.length >= 3 || team.some(m => m.role?.toLowerCase().includes('lead'));
    const hasProjectManagement = d.gantt?.length > 0 || pdsa.length >= 2;
    const hasMeasurement = d.chartData?.length >= 10;

    // Stage-specific guidance banners
    const stageBanner = isHigher
        ? `<div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 text-sm text-indigo-800">
               <strong>Higher Trainee:</strong> You must demonstrate <em>leadership</em> of your QI project, not just participation.
               Ensure your reflections describe how you led the team, engaged stakeholders, and drove the improvement cycle.
           </div>`
        : isACCS
        ? `<div class="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4 text-sm text-sky-800">
               <strong>ACCS Trainee:</strong> You need to demonstrate active <em>participation</em> in a QI project.
               Document your personal contribution and what you learned from the experience.
           </div>`
        : `<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
               <i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i>
               <strong>Select your training stage below</strong> to see stage-specific guidance for this form.
           </div>`;

    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="bg-gradient-to-r from-rcem-purple to-indigo-700 text-white p-6">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    <i data-lucide="clipboard-check" class="w-5 h-5"></i>
                    RCEM QIAT (2025) - EM Quality Improvement Assessment Tool
                </h2>
                <p class="text-indigo-200 text-sm mt-1">Auto-generated from your project data for risr/advance portfolio</p>
            </div>
            
            <div class="p-6 space-y-6">
                <div class="flex justify-end gap-2">
                    <button onclick="window.copyReport('qiat')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                        <i data-lucide="copy" class="w-4 h-4"></i> Copy All Text
                    </button>
                </div>
                
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <label class="block text-sm font-bold text-slate-700 mb-2">Training Stage</label>
                    <div class="flex gap-3">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="training-stage" value="accs" 
                                ${trainingStage === 'accs' ? 'checked' : ''}
                                onchange="window.saveTrainingStage('accs')"
                                class="text-rcem-purple">
                            <span class="text-sm font-medium text-slate-700">ACCS Trainee</span>
                            <span class="text-xs text-slate-400">(participation required)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="training-stage" value="higher"
                                ${trainingStage === 'higher' ? 'checked' : ''}
                                onchange="window.saveTrainingStage('higher')"
                                class="text-rcem-purple">
                            <span class="text-sm font-medium text-slate-700">Higher Trainee</span>
                            <span class="text-xs text-slate-400">(leadership required)</span>
                        </label>
                    </div>
                </div>

                ${stageBanner}
                
                <div class="border-b border-slate-200 pb-4">
                    <h3 class="text-lg font-bold text-slate-800">Part A - Trainee Section</h3>
                    <p class="text-sm text-slate-500">Complete this form prior to ARCP</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Stage of Training</label>
                        <div class="text-sm text-slate-800 font-medium">
                            ${trainingStage === 'accs' ? 'ACCS' : trainingStage === 'higher' ? 'Higher EM Training' : team.length > 0 ? escapeHtml(team[0].grade || '-') : '-'}
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Placement</label>
                        <div class="text-sm text-slate-800 font-medium">Emergency Department</div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Date of Completion</label>
                        <div class="text-sm text-slate-800 font-medium">${new Date().toLocaleDateString('en-GB')}</div>
                    </div>
                </div>
                
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-blue-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">1. QI Personal Development Plan - Current Year</h4>
                    </div>
                    <div class="p-4">
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-2">
                            1.1 PDP Summary
                            <span class="normal-case font-normal text-slate-400 ml-2">- Enter your own goals in Define &amp; Measure → Aim</span>
                        </label>
                        <div id="qiat-pdp" class="bg-slate-50 p-3 rounded min-h-[80px]">
                            ${c.aim
                                ? `<p class="text-sm text-slate-700">Primary objective: ${escapeHtml(c.aim)}</p>`
                                : qiatEmptyState('No aim defined yet. Set your SMART aim in Define & Measure - it will appear here.')
                            }
                        </div>
                        ${!c.aim ? `
                            <p class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                Complete the aim field in Define &amp; Measure to populate this section.
                            </p>` : ''}
                    </div>
                </div>
                
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-emerald-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">2. QI Education</h4>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">
                                2.1 Involvement - Engagement with QI education over the past year
                            </label>
                            <div id="qiat-education" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[80px]">
                                ${(d.meta?.title || pdsa.length > 0 || d.chartData?.length > 0) ? `
                                    <ul class="space-y-1 text-sm text-slate-700">
                                        ${d.meta?.title ? `<li>QIP: "${escapeHtml(d.meta.title)}"</li>` : ''}
                                        ${pdsa.length > 0 ? `<li>${pdsa.length} PDSA cycle${pdsa.length > 1 ? 's' : ''} completed</li>` : ''}
                                        ${(d.chartData?.length || 0) > 0 ? `<li>${d.chartData.length} data points collected and analysed</li>` : ''}
                                        ${team.length > 0 ? `<li>${team.length} team member${team.length > 1 ? 's' : ''} engaged</li>` : ''}
                                        ${(d.stakeholders?.length || 0) > 0 ? `<li>${d.stakeholders.length} stakeholder${d.stakeholders.length > 1 ? 's' : ''} mapped</li>` : ''}
                                        ${logs.length > 0 ? `<li>${logs.length} leadership engagement${logs.length > 1 ? 's' : ''} documented</li>` : ''}
                                    </ul>
                                ` : qiatEmptyState('Add project data - involvement details will be drawn from your project automatically.')}
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">
                                2.2 Learning - How has this developed your understanding of QI?
                                <span class="normal-case font-normal text-slate-400 ml-2">- from your Learning Points</span>
                            </label>
                            <div id="qiat-learning" class="bg-slate-50 p-3 rounded min-h-[80px]">
                                ${c.learning_points
                                    ? `<p class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(c.learning_points)}</p>`
                                    : qiatEmptyState('Enter your learning points in Define & Measure → Learning & Sustainability - they will appear here automatically. Write in your own words: what worked, what did not, what you would do differently.')
                                }
                            </div>
                            ${!c.learning_points ? `
                                <p class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                    <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                    This is a key reflective field - it must be in your own words.
                                </p>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-amber-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">3. Project Involvement</h4>
                    </div>
                    <div class="p-4">
                        <div class="flex items-center gap-2 mb-4">
                            <span class="text-sm font-medium text-slate-700">Were you involved in a QI project?</span>
                            <span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">Yes</span>
                        </div>
                        <div class="bg-slate-50 p-3 rounded text-sm text-slate-700">
                            <strong>Project Title:</strong> ${escapeHtml(d.meta?.title || '-')}
                            <br><strong>Role:</strong> ${isHigher ? 'Project Lead / QI Lead' : isACCS ? 'Project Participant' : (team.length > 0 ? escapeHtml(team[0].role || '-') : '-')}
                            <br><strong>Duration:</strong> ${d.gantt?.length > 0 ? `${d.gantt[0].start} to ${d.gantt[d.gantt.length - 1].end}` : 'Ongoing'}
                        </div>
                        ${isHigher ? `
                            <p class="text-xs text-indigo-600 mt-2 flex items-center gap-1">
                                <i data-lucide="info" class="w-3 h-3"></i>
                                As a Higher trainee, ensure your reflections demonstrate how you <em>led</em> this project.
                            </p>` : ''}
                    </div>
                </div>
                
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-purple-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">4. Learning & Development</h4>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">4.1 QI Journey - Aspects gained experience in this year</label>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                ${[
                                    [hasCreatingConditions, 'Creating Conditions'],
                                    [hasUnderstandingSystems, 'Understanding Systems'],
                                    [hasDevelopingAims, 'Developing Aims'],
                                    [hasTestingChanges, 'Testing Changes'],
                                    [hasImplement, 'Implement'],
                                    [hasSpread, 'Spread'],
                                    [hasLeadership, 'Leadership & Teams'],
                                    [hasProjectManagement, 'Project Management'],
                                    [hasMeasurement, 'Measurement'],
                                ].map(([checked, label]) => `
                                    <div class="flex items-center gap-2 p-2 rounded ${checked ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                        <input type="checkbox" ${checked ? 'checked' : ''} disabled class="rounded">
                                        <span class="text-xs ${checked ? 'text-emerald-800 font-medium' : 'text-slate-500'}">${label}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">
                                4.2 Reflections and Learning
                                <span class="normal-case font-normal text-slate-400 ml-2">- must be written in your own words</span>
                            </label>
                            <div id="qiat-reflections" class="bg-slate-50 p-3 rounded min-h-[100px]">
                                ${c.learning_points
                                    ? `<p class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(c.learning_points)}</p>`
                                    : qiatEmptyState('This section requires your personal reflection. Enter your learning points in Define & Measure → Learning & Sustainability. Describe what went well, what did not, barriers you encountered, and what you would do differently. This cannot be auto-generated - it must be in your own words.')
                                }
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">
                                4.3 Next Year's PDP
                                <span class="normal-case font-normal text-slate-400 ml-2">- must be written in your own words</span>
                            </label>
                            <div id="qiat-next-pdp" class="bg-slate-50 p-3 rounded min-h-[80px]">
                                ${c.next_pdp
                                    ? `<p class="text-sm text-slate-700 whitespace-pre-line">${escapeHtml(c.next_pdp)}</p>`
                                    : qiatEmptyState('Enter your plans for next year\'s QI development here. What specific QI skills do you want to develop? What projects do you plan to lead or participate in? This section must be completed in your own words and cannot be auto-generated.')
                                }
                            </div>
                            ${!c.next_pdp ? `
                                <p class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                    <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                    Add your next year PDP to Define &amp; Measure → Learning &amp; Sustainability, or type it directly in your risr/advance portfolio.
                                </p>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h4 class="font-bold text-indigo-800 text-sm mb-2 flex items-center gap-2">
                        <i data-lucide="info" class="w-4 h-4"></i>
                        Curriculum Mapping
                    </h4>
                    <p class="text-sm text-indigo-700">
                        This project should be linked to <strong>SLO 11</strong> (Quality Improvement) in your risr/advance portfolio.
                        ${isHigher
                            ? 'As a Higher trainee, select Key Capabilities reflecting <strong>leadership</strong> of a QI project.'
                            : isACCS
                            ? 'As an ACCS trainee, select Key Capabilities reflecting <strong>participation</strong> in a QI project.'
                            : 'Select the appropriate Key Capabilities based on your stage of training.'
                        }
                    </p>
                </div>
                
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 class="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        Part B - Trainer Section
                    </h4>
                    <p class="text-sm text-amber-700">
                        Part B must be completed by your Educational Supervisor or an appropriate assessor.
                        They will review your QI activity and provide feedback on your performance against SLO 11 criteria.
                    </p>
                </div>
            </div>
        </div>
    `;
}

function wc(t) { return t ? t.split(/\s+/).filter(w => w.length > 0).length : 0; }
function renderAbstractForm(d) {
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const wordLimit = 250;

    // Default values for each section from existing project data if not yet saved separately
    const bgDefault = c.abstract_background || `${c.problem_desc || '[Problem statement — describe the gap between current and desired state]'}`;
    const methodsDefault = c.abstract_methods || `We used the Model for Improvement with ${pdsa.length} PDSA cycle${pdsa.length !== 1 ? 's' : ''}. ${d.chartData?.length || 0} data points were collected. Outcome measure: ${c.outcome_measure || '[outcome measure]'}. Process measure: ${c.process_measure || '[process measure]'}.`;
    const resultsDefault = c.abstract_results || c.results_analysis || '[Analysis showing pre/post intervention data, any special cause variation detected, percentage improvement achieved]';
    const conclusionsDefault = c.abstract_conclusions || c.learning_points || '[Key learning points and implications for practice]';

    const totalWC = wc(bgDefault) + wc(methodsDefault) + wc(resultsDefault) + wc(conclusionsDefault);

    const sections = [
        { id: 'abs-bg',      field: 'abstract_background',   label: 'Background',   color: 'blue',   val: bgDefault,          hint: 'Why is this important? What is the problem and gap from standard?' },
        { id: 'abs-methods', field: 'abstract_methods',      label: 'Methods',      color: 'purple', val: methodsDefault,     hint: 'QI methodology, measures used, number of PDSA cycles, data collected.' },
        { id: 'abs-results', field: 'abstract_results',      label: 'Results',      color: 'amber',  val: resultsDefault,     hint: 'Pre/post data, run chart signals, percentage improvement achieved.' },
        { id: 'abs-conc',    field: 'abstract_conclusions',  label: 'Conclusions',  color: 'emerald',val: conclusionsDefault,  hint: 'Key learning, sustainability plan, spread potential.' }
    ];

    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">RCEM Abstract (QIAT / ASC Format)</h2>
                    <p class="text-slate-500 text-sm">Structured for RCEM Annual Scientific Conference submission — 250 words total</p>
                </div>
                <button onclick="window.copyReport('abstract')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="copy" class="w-4 h-4"></i> Copy All
                </button>
            </div>

            <div class="mb-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <div class="bg-slate-50 p-3 rounded border border-slate-200 font-bold">${escapeHtml(d.meta?.title || 'Untitled QIP')}</div>
            </div>

            <div class="mb-4 flex justify-between items-center">
                <span class="text-sm text-slate-500">Total word count: <span id="abstract-word-count" class="${totalWC > wordLimit ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}">${totalWC}</span> / ${wordLimit}</span>
                <span id="abstract-limit-badge">${totalWC > wordLimit ? '<span class="text-xs text-red-500">⚠️ Over limit</span>' : '<span class="text-xs text-emerald-500">✓ Within limit</span>'}</span>
            </div>

            <div class="space-y-4">
                ${sections.map(s => {
                    const wCount = wc(s.val);
                    return `
                    <div class="border border-${s.color}-200 rounded-xl overflow-hidden">
                        <div class="bg-${s.color}-50 px-4 py-2 flex justify-between items-center">
                            <label class="text-xs font-bold text-${s.color}-700 uppercase tracking-wider">${s.label}</label>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-slate-400">${s.hint}</span>
                                <span class="text-xs font-mono ${wCount > 80 ? 'text-amber-600' : 'text-slate-400'}" id="wc-${s.id}">${wCount}w</span>
                            </div>
                        </div>
                        <textarea id="${s.id}"
                            class="w-full p-4 text-sm leading-relaxed bg-white border-none focus:outline-none focus:ring-2 focus:ring-${s.color}-300 resize-none"
                            rows="4"
                            spellcheck="true"
                            oninput="window.onAbstractSectionInput('${s.field}', '${s.id}', this.value)">${escapeHtml(s.val)}</textarea>
                    </div>`;
                }).join('')}
            </div>

            <div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-bold text-blue-800 text-sm mb-2">Submission Tips</h4>
                <ul class="text-sm text-blue-700 space-y-1">
                    <li>• <strong>250 words total</strong> across all four sections for RCEM ASC format</li>
                    <li>• <strong>Background</strong> should reference the RCEM clinical standard being addressed</li>
                    <li>• <strong>Results</strong> should include your run chart signals and % improvement</li>
                    <li>• Edit each section directly — changes are saved automatically</li>
                </ul>
            </div>
        </div>
    `;
}

function renderReportForm(d) {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">RCEM Report Format</h2>
                    <p class="text-slate-500 text-sm">Structured format for RCEM QIP submission</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.exportPPTX()" class="bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <i data-lucide="presentation" class="w-4 h-4"></i> PowerPoint
                    </button>
                    <button onclick="window.printPosterOnly()" class="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4"></i> Print
                    </button>
                </div>
            </div>
            
            <div class="space-y-4">
                <div class="bg-slate-50 rounded-lg p-4">
                    <h4 class="font-bold text-slate-700 mb-2">Suggested Report Structure</h4>
                    <ol class="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                        <li><strong>Title & Author(s)</strong> - Project name and team</li>
                        <li><strong>Background</strong> - Context and rationale</li>
                        <li><strong>Problem Statement</strong> - Gap analysis</li>
                        <li><strong>Aim</strong> - SMART aim</li>
                        <li><strong>Measures</strong> - Outcome, process, balancing</li>
                        <li><strong>Diagnosis</strong> - Root cause analysis (Fishbone/Driver diagram)</li>
                        <li><strong>Interventions</strong> - Change ideas tested</li>
                        <li><strong>PDSA Cycles</strong> - Tests of change</li>
                        <li><strong>Results</strong> - Run/SPC charts with analysis</li>
                        <li><strong>Learning</strong> - What worked, what didn't</li>
                        <li><strong>Sustainability</strong> - How gains will be maintained</li>
                        <li><strong>References</strong> - Evidence base</li>
                    </ol>
                </div>
                
                <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <h4 class="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2">
                        <i data-lucide="lightbulb" class="w-4 h-4"></i>
                        Tip
                    </h4>
                    <p class="text-sm text-emerald-700">
                        Use the <strong>Whole Project View</strong> tab to see your complete project in report format,
                        or export to PowerPoint for a presentation-ready format.
                    </p>
                </div>
            </div>
        </div>
    `;
}

export function copyReport(type) {
    let content = '';
    
    if (type === 'qiat') {
        const sections = ['qiat-pdp', 'qiat-education', 'qiat-learning', 'qiat-reflections', 'qiat-next-pdp'];
        content = sections.map(id => {
            const el = document.getElementById(id);
            return el ? el.innerText : '';
        }).filter(t => t.trim()).join('\n\n---\n\n');
    } else if (type === 'abstract') {
        // Try new structured abstract (4 sections) first, fall back to old single textarea
        const secIds = ['abs-bg', 'abs-methods', 'abs-results', 'abs-conc'];
        const secLabels = ['Background', 'Methods', 'Results', 'Conclusions'];
        const hasStructured = document.getElementById('abs-bg');
        if (hasStructured) {
            content = secIds.map((id, i) => {
                const el = document.getElementById(id);
                const text = el?.tagName === 'TEXTAREA' ? el.value : (el?.innerText || '');
                return text.trim() ? `${secLabels[i]}:\n${text.trim()}` : '';
            }).filter(Boolean).join('\n\n');
        } else {
            const absEl = document.getElementById('abstract-content');
            content = (absEl?.tagName === 'TEXTAREA' ? absEl.value : absEl?.innerText) || '';
        }
    } else {
        content = document.getElementById('report-content')?.innerText || '';
    }
    
    navigator.clipboard.writeText(content).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

export function openPortfolioExport() {
    showToast('Opening export options...', 'info');
    window.router('publish');
}

// Export specific functions required by global context in app.js
export const calcGreen = calculateCarbonSavings;
export const calcMoney = calculateCarbonSavings;
export const calcTime = calculateCarbonSavings;
export const calcEdu = calculateCarbonSavings;

// ==========================================
// 12. FISHBONE HELPERS
// ==========================================

export function toggleToolList() {
    if (window.toggleToolHelp) window.toggleToolHelp();
}

export function updateFishCat(index, value) {
    if (!state.projectData.fishbone) return;
    state.projectData.fishbone.categories[index].text = value;
    if (window.saveData) window.saveData();
}

export function updateFishCause(catIndex, causeIndex, value) {
    if (!state.projectData.fishbone) return;
    const cat = state.projectData.fishbone.categories[catIndex];
    if (cat && cat.causes && cat.causes[causeIndex]) {
        if (typeof cat.causes[causeIndex] === 'string') {
            cat.causes[causeIndex] = { text: value };
        } else {
            cat.causes[causeIndex].text = value;
        }
        if (window.saveData) window.saveData();
    }
}

export function addFishCause(catIndex) {
    if (!state.projectData.fishbone) return;
    const cat = state.projectData.fishbone.categories[catIndex];
    if (!cat.causes) cat.causes = [];
    cat.causes.push({ text: 'New cause', x: 50, y: 50 });
    if (window.saveData) window.saveData();
    renderTools();
}

export function removeFishCause(catIndex, causeIndex) {
    if (!state.projectData.fishbone) return;
    state.projectData.fishbone.categories[catIndex].causes.splice(causeIndex, 1);
    if (window.saveData) window.saveData();
    renderTools();
}

// ==========================================
// 13. MODALS AND EXTENDED TOOLS
// ==========================================

const TOPIC_BANK = [
    { title: "Sepsis 6 Pathway Compliance", desc: "Improving time to antibiotics for red flag sepsis in the Emergency Department." },
    { title: "Fracture Clinic Referrals", desc: "Reducing inappropriate and incomplete referrals to the orthopaedic fracture clinic." },
    { title: "Paracetamol Overdose", desc: "Improving compliance with the TOXBASE paracetamol overdose treatment pathway." },
    { title: "NEWS2 Escalation", desc: "Improving time to medical review for patients triggering a NEWS2 score >= 7." },
    { title: "Discharge Summaries", desc: "Improving the quality and timeliness of ED discharge summaries sent to primary care." },
    { title: "Analgesia in Triage", desc: "Reducing time to initial analgesia for patients presenting with severe pain." },
    { title: "VTE Risk Assessment", desc: "Increasing compliance with VTE risk assessments for patients in ED observation wards." },
    { title: "Frailty Assessment", desc: "Improving early identification and Comprehensive Geriatric Assessment for frail patients." }
];

export function openTopicBank() {
    const modal = document.getElementById('topic-bank-modal');
    const list = document.getElementById('topic-list');
    const search = document.getElementById('topic-search');
    if (!modal || !list || !search) return;

    const renderList = (filter = "") => {
        const filtered = TOPIC_BANK.filter(t => t.title.toLowerCase().includes(filter.toLowerCase()) || t.desc.toLowerCase().includes(filter.toLowerCase()));
        list.innerHTML = filtered.map(t => `
            <div class="border border-slate-200 p-3 rounded-lg hover:bg-slate-50 cursor-pointer" onclick="window.selectTopic('${escapeHtml(t.title)}', '${escapeHtml(t.desc)}')">
                <h4 class="font-bold text-slate-800 text-sm">${t.title}</h4>
                <p class="text-xs text-slate-500 mt-1">${t.desc}</p>
            </div>
        `).join('');
    };

    search.oninput = (e) => renderList(e.target.value);
    renderList();
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function selectTopic(title, desc) {
    const problemInput = document.getElementById('check-problem');
    if(problemInput) problemInput.value = desc;
    window.saveChecklistField('problem_desc', desc);
    document.getElementById('topic-bank-modal').classList.add('hidden');
    showToast("Topic selected", "success");
}

export function openSmartAimBuilder() {
    const modal = document.getElementById('smart-aim-modal');
    if (!modal) return;
    
    // Clear the values each time it's opened to ensure clean building process
    document.getElementById('smart-direction').value = 'increase';
    document.getElementById('smart-measure').value = '';
    document.getElementById('smart-baseline').value = '';
    document.getElementById('smart-target').value = '';
    document.getElementById('smart-timeframe').value = '';
    document.getElementById('smart-setting').value = 'the Emergency Department';
    
    const updatePreview = () => {
        const dir = document.getElementById('smart-direction').value;
        const measure = document.getElementById('smart-measure').value || '[measure]';
        const baseline = document.getElementById('smart-baseline').value || '[baseline]';
        const target = document.getElementById('smart-target').value || '[target]';
        const timeframe = document.getElementById('smart-timeframe').value || '[timeframe]';
        const setting = document.getElementById('smart-setting').value || '[setting]';
        
        document.getElementById('smart-preview').textContent = `To ${dir} ${measure} from ${baseline} to ${target} by ${timeframe} in ${setting}.`;
    };
    
    ['smart-direction', 'smart-measure', 'smart-baseline', 'smart-target', 'smart-timeframe', 'smart-setting'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    
    updatePreview();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function saveConstructedSmartAim() {
    const aim = document.getElementById('smart-preview').textContent;
    const aimInput = document.getElementById('check-aim');
    if(aimInput) aimInput.value = aim;
    window.saveChecklistField('aim', aim);
    document.getElementById('smart-aim-modal').classList.add('hidden');
    showToast("SMART Aim saved", "success");
    renderChecklist();
}

export async function openGoldenThreadValidator() {
    const modal = document.getElementById('golden-thread-modal');
    const content = document.getElementById('golden-thread-content');
    if (!modal || !content) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12">
            <i data-lucide="loader-2" class="w-8 h-8 text-rcem-purple animate-spin mb-4"></i>
            <p class="text-slate-600 font-medium">Validating Golden Thread...</p>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (window.runGoldenThreadValidator && window.hasAI && window.hasAI()) {
        try {
            const result = await window.runGoldenThreadValidator(state.projectData);
            if (result) {
                const scoreColor = result.overallScore >= 80 ? 'text-emerald-500' : (result.overallScore >= 50 ? 'text-amber-500' : 'text-red-500');
                
                const renderRow = (label, data) => {
                    if (!data) return '';
                    const icon = data.status === 'pass' ? 'check-circle' : (data.status === 'warning' ? 'alert-triangle' : 'x-circle');
                    const color = data.status === 'pass' ? 'text-emerald-500' : (data.status === 'warning' ? 'text-amber-500' : 'text-red-500');
                    return `
                        <div class="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <i data-lucide="${icon}" class="w-5 h-5 ${color} flex-shrink-0 mt-0.5"></i>
                            <div>
                                <h4 class="text-sm font-bold text-slate-800">${label}</h4>
                                <p class="text-xs text-slate-600 mt-1">${data.comment}</p>
                            </div>
                        </div>
                    `;
                };

                content.innerHTML = `
                    <div class="text-center mb-6">
                        <div class="text-4xl font-black ${scoreColor}">${result.overallScore}/100</div>
                        <div class="text-sm text-slate-500 font-medium uppercase tracking-wide mt-1">Coherence Score</div>
                    </div>
                    <div class="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-6">
                        <h4 class="text-xs font-bold text-indigo-800 uppercase mb-1">Top Recommendation</h4>
                        <p class="text-sm text-indigo-900">${result.topRecommendation}</p>
                    </div>
                    <div class="space-y-3">
                        ${renderRow('Aim addresses problem', result.aimAddressesProblem)}
                        ${renderRow('Drivers relate to aim', result.driversRelateToAim)}
                        ${renderRow('Change ideas map to drivers', result.changeIdeasMapToDrivers)}
                        ${renderRow('Measures capture aim', result.measuresCaptureAim)}
                        ${renderRow('PDSA tests change ideas', result.pdsaTestsChangeIdeas)}
                        ${renderRow('Data adequate for rules', result.dataAdequate)}
                        ${renderRow('Sustainability planned', result.sustainabilityPlan)}
                    </div>
                `;
            } else {
                content.innerHTML = `<div class="p-6 text-center text-red-500">Validation failed. Please try again.</div>`;
            }
        } catch (error) {
            content.innerHTML = `<div class="p-6 text-center text-red-500">Validation error: ${error.message}</div>`;
        }
    } else {
        content.innerHTML = `
            <div class="p-6 text-center text-slate-600 flex flex-col items-center">
                <i data-lucide="key" class="w-8 h-8 text-slate-400 mb-3"></i>
                <p>The Golden Thread Validator requires AI features to be enabled.</p>
                <button onclick="document.getElementById('golden-thread-modal').classList.add('hidden'); window.openGlobalSettings()" class="mt-4 bg-rcem-purple text-white px-4 py-2 rounded font-bold">Configure AI Settings</button>
            </div>
        `;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Attach these to window so they are accessible from index.html buttons
window.openTopicBank = openTopicBank;
window.selectTopic = selectTopic;
window.openSmartAimBuilder = openSmartAimBuilder;
window.saveConstructedSmartAim = saveConstructedSmartAim;
window.openGoldenThreadValidator = openGoldenThreadValidator;

// ==========================================
// 14. HELP & TOUR
// ==========================================

export function showHelp() {
    showToast("QI Coach: Start with Define & Measure, then build your Driver Diagram, add data, and document PDSA cycles.", "info");
}

export function startTour() {
    if (typeof driver === 'undefined') {
        showToast("Guided tour unavailable — check your internet connection and try again.", "info");
        return;
    }
    try {
        const driverObj = driver.driver({
            showProgress: true,
            animate: true,
            overlayColor: '#1e1b4b',
            popoverClass: 'qip-tour-popover',
            steps: [
                { element: '#nav-dashboard',     popover: { title: '📊 Dashboard',           description: 'Your project at a glance — progress score, chart preview, team summary and portfolio readiness.' }},
                { element: '#nav-checklist',     popover: { title: '📋 Define & Measure',     description: 'Start here. Write your problem statement, set a SMART aim, define measures, and complete your evidence & ethics review.' }},
                { element: '#nav-tools',         popover: { title: '🔧 Diagnosis Tools',      description: 'Fishbone diagram, Driver diagram, and 5-Whys analysis to identify and understand root causes.' }},
                { element: '#nav-data',          popover: { title: '📈 Run Chart & SPC',      description: 'Add data points and track your measure over time. SPC rules are applied automatically to detect improvement signals.' }},
                { element: '#nav-pdsa',          popover: { title: '🔄 PDSA Cycles',          description: 'Log each Plan-Do-Study-Act cycle with predictions, outcomes and learning. Cycles annotate directly on your run chart.' }},
                { element: '#nav-team',          popover: { title: '👥 Team',                 description: 'Record team members, their roles and your specific contributions. Required for ARCP portfolio evidence.' }},
                { element: '#nav-stakeholders',  popover: { title: '🗣️ Stakeholders',         description: 'Map stakeholders by power and interest. Track engagement strategies.' }},
                { element: '#nav-gantt',         popover: { title: '📅 Gantt Chart',          description: 'Set milestones and deadlines. Drag to adjust, export for reports.' }},
                { element: '#nav-surveys',       popover: { title: '📝 Surveys',              description: 'Log and analyse patient or staff feedback to support your change package.' }},
                { element: '#nav-supervisor',    popover: { title: '🏆 Portfolio Readiness',  description: 'Check SLO11 sign-off criteria. See exactly what evidence is complete and what still needs work.' }},
                { element: '#nav-publish',       popover: { title: '🚀 Publish & Export',     description: 'Export a full portfolio-ready PowerPoint, RCEM abstract, QIP poster, or Kaizen report in one click.' }}
            ]
        });
        driverObj.drive();
    } catch (e) {
        console.error("Tour error:", e);
        showToast("Could not start guided tour.", "error");
    }
}

// ==========================================
// BATCH 5-7 HELPER FUNCTIONS
// ==========================================

// PDSA view toggle
window.setPDSAView = function(mode) {
    window.pdsaViewMode = mode;
    if (window.renderPDSA) window.renderPDSA();
    // Re-init lucide after re-render
    if (typeof lucide !== 'undefined') setTimeout(() => lucide.createIcons(), 50);
};

// Live word count for plain text fields
window.updateFieldWC = function(el, spanId) {
    const span = document.getElementById(spanId);
    if (!span) return;
    const words = el.value.trim().split(/\s+/).filter(Boolean).length;
    span.textContent = words + 'w';
    // Colour thresholds vary by field
    const isAim = spanId === 'wc-aim';
    const tooShort = isAim ? words < 10 : words < 20;
    const tooLong  = isAim ? words > 80 : words > 250;
    span.className = words === 0 ? 'text-xs text-slate-300'
        : tooShort ? 'text-xs text-amber-500'
        : tooLong  ? 'text-xs text-amber-600 font-medium'
        : 'text-xs text-emerald-600 font-medium';
};

// Define & Measure section accordion toggle
window.toggleChecklistSection = function(n) {
    const header = document.getElementById('cs-header-' + n);
    const icon = document.getElementById('cs-chevron-' + n);
    if (!header) return;
    const section = header.closest('section');
    if (!section) return;
    // Toggle all direct children except the header itself
    let anyHidden = false;
    Array.from(section.children).forEach(child => {
        if (child !== header) {
            const hidden = child.style.display === 'none';
            child.style.display = hidden ? '' : 'none';
            if (hidden) anyHidden = true;
        }
    });
    // Update chevron direction
    if (icon) {
        const collapsed = Array.from(section.children).some(c => c !== header && c.style.display === 'none');
        icon.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-down');
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [icon] });
    }
};

// PDSA card collapse toggle
window.togglePDSACard = function(i) {
    const body = document.getElementById('pdsa-body-' + i);
    const chevronEl = document.querySelector('#pdsa-card-' + i + ' [data-lucide="chevron-up"], #pdsa-card-' + i + ' [data-lucide="chevron-down"]');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (chevronEl) {
        chevronEl.setAttribute('data-lucide', isHidden ? 'chevron-up' : 'chevron-down');
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [chevronEl] });
    }
};

// PDSA word count live update
window.updatePDSAWC = function(textarea, spanId) {
    const span = document.getElementById(spanId);
    if (!span) return;
    const n = (textarea.value || '').split(/\s+/).filter(w => w.length > 0).length;
    span.textContent = n + 'w';
    span.className = 'text-xs ' + (n === 0 ? 'text-slate-300' : n < 50 ? 'text-slate-400' : n > 300 ? 'text-amber-600 font-medium' : 'text-emerald-500');
};

// Apply PDSA template
window.applyPDSATemplate = function(id) {
    const templates = {
        education: {
            title: 'Staff education session',
            plan: 'We will deliver a 15-minute education session to all shift staff during handover. We predict that knowledge scores will improve by ≥20% in a post-session quiz.'
        },
        audit: {
            title: 'Audit and feedback cycle',
            plan: 'We will conduct a retrospective audit of the last 20 cases against the target standard and present results at the next team meeting. We predict that making performance visible will motivate behaviour change.'
        },
        checklist: {
            title: 'Introduce process checklist',
            plan: 'We will introduce a point-of-care checklist at [step in process] for a 2-week trial. We predict this will reduce omission errors and improve compliance with the target process step.'
        },
        reminder: {
            title: 'Visual reminder at point of care',
            plan: 'We will place a visual prompt (poster/sticker/laminated card) at [location]. We predict this will serve as a point-of-care cue and improve adherence without requiring additional training.'
        },
        protocol: {
            title: 'Update local protocol or SOP',
            plan: 'We will draft a revised local SOP and circulate for approval. We predict that formalising the process will sustain improvement beyond individual behaviour change.'
        }
    };
    const t = templates[id];
    if (!t) return;
    const titleEl = document.getElementById('pdsa-title');
    const planEl = document.getElementById('pdsa-plan');
    if (titleEl && !titleEl.value) titleEl.value = t.title;
    if (planEl && !planEl.value) planEl.value = t.plan;
};

// ARCP date save
window.saveARCPDate = function(val) {
    if (!window.state?.projectData?.meta) return;
    window.state.projectData.meta.arcpDate = val;
    if (window.saveData) window.saveData();
    // Re-render countdown
    const { renderARCPCountdown } = window.__rendererHelpers || {};
    // Inline re-render
    const display = document.getElementById('arcp-countdown-display');
    if (!display) return;
    if (!val) { display.innerHTML = '<p class="text-xs text-slate-400">Set your ARCP date below to see your countdown.</p>'; return; }
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(val); target.setHours(0,0,0,0);
    const days = Math.round((target - today) / 86400000);
    const color = days < 0 ? 'text-slate-500' : days <= 30 ? 'text-red-600' : days <= 90 ? 'text-amber-600' : 'text-emerald-600';
    display.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="text-3xl font-black ${color}">${days < 0 ? 'Past' : days + ' days'}</div>
            <div class="text-xs text-slate-500">${days < 0 ? `ARCP was ${Math.abs(days)} days ago` : `until ARCP<br><span class="text-slate-400">${target.toLocaleDateString('en-GB')}</span>`}</div>
        </div>
        ${days >= 0 && days <= 30 ? '<p class="text-xs text-red-600 font-bold mt-1">Imminent — ensure portfolio is submission-ready!</p>' : ''}
        ${days > 30 && days <= 90 ? '<p class="text-xs text-amber-600 mt-1">Getting close — review your portfolio readiness score.</p>' : ''}
    `;
};

// Abstract word count live update
window.onAbstractInput = function(textarea) {
    const n = (textarea.value || '').split(/\s+/).filter(w => w.length > 0).length;
    const limit = 250;
    const wcEl = document.getElementById('abstract-word-count');
    const badgeEl = document.getElementById('abstract-limit-badge');
    if (wcEl) {
        wcEl.textContent = n;
        wcEl.className = n > limit ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold';
    }
    if (badgeEl) {
        badgeEl.innerHTML = n > limit
            ? '<span class="text-xs text-red-500">⚠️ Over limit — please edit</span>'
            : '<span class="text-xs text-emerald-500">✓ Within limit</span>';
    }
};

// ==========================================
// NEW: Abstract section input handler (structured 4-part abstract)
// ==========================================
window.onAbstractSectionInput = function(field, sectionId, value) {
    if (!state.projectData || state.isReadOnly) return;
    if (!state.projectData.checklist) state.projectData.checklist = {};
    state.projectData.checklist[field] = value;
    // Update per-section word count
    const wcSpan = document.getElementById('wc-' + sectionId);
    if (wcSpan) {
        const n = value.split(/\s+/).filter(w => w.length > 0).length;
        wcSpan.textContent = n + 'w';
        wcSpan.className = 'text-xs font-mono ' + (n > 80 ? 'text-amber-600' : 'text-slate-400');
    }
    // Recalculate total
    const c = state.projectData.checklist;
    const sections = ['abstract_background', 'abstract_methods', 'abstract_results', 'abstract_conclusions'];
    const total = sections.reduce((sum, f) => sum + ((c[f] || '').split(/\s+/).filter(w => w.length > 0).length), 0);
    const limit = 250;
    const wcEl = document.getElementById('abstract-word-count');
    const badgeEl = document.getElementById('abstract-limit-badge');
    if (wcEl) { wcEl.textContent = total; wcEl.className = total > limit ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'; }
    if (badgeEl) badgeEl.innerHTML = total > limit ? '<span class="text-xs text-red-500">⚠️ Over limit</span>' : '<span class="text-xs text-emerald-500">✓ Within limit</span>';
    if (window.saveData) window.saveData();
};

// ==========================================
// NEW: HRA field save
// ==========================================
window.saveHRAField = function(questionKey, value) {
    if (!state.projectData || state.isReadOnly) return;
    if (!state.projectData.checklist) state.projectData.checklist = {};
    if (!state.projectData.checklist.hraChecklist) state.projectData.checklist.hraChecklist = {};
    state.projectData.checklist.hraChecklist[questionKey] = value;
    if (window.saveData) window.saveData();
    // Re-render checklist to show verdict
    renderChecklist();
};

// ==========================================
// NEW: Reference list management
// ==========================================
window.addReference = function() {
    if (!state.projectData || state.isReadOnly) return;
    if (!state.projectData.checklist) state.projectData.checklist = {};
    if (!Array.isArray(state.projectData.checklist.referencesList)) state.projectData.checklist.referencesList = [];
    state.projectData.checklist.referencesList.push({ authors: '', year: '', title: '', keyFinding: '' });
    if (window.saveData) window.saveData();
    renderChecklist();
    showToast('Reference added', 'success');
};

window.updateReference = function(idx, field, value) {
    if (!state.projectData || state.isReadOnly) return;
    const list = state.projectData.checklist?.referencesList;
    if (!list || !list[idx]) return;
    list[idx][field] = value;
    if (window.saveData) window.saveData();
};

window.deleteReference = function(idx) {
    if (!state.projectData || state.isReadOnly) return;
    const list = state.projectData.checklist?.referencesList;
    if (!list) return;
    list.splice(idx, 1);
    if (window.saveData) window.saveData();
    renderChecklist();
    showToast('Reference removed', 'info');
};

// ==========================================
// NEW: See Example modal
// ==========================================
window.showExample = function(section) {
    const { getDemoData } = window._demoDataGetter || {};
    // We'll use inline demo content
    const examples = {
        problem: {
            title: 'Problem Definition — Example (Sepsis Project)',
            content: `<div class="space-y-4">
                <div><strong class="block text-xs text-slate-500 uppercase mb-1">Problem Statement</strong>
                <p class="text-sm text-slate-700 bg-blue-50 p-3 rounded">Retrospective audit of 150 consecutive patients with Red Flag Sepsis over 3 months revealed only 42% received IV antibiotics within 60 minutes of the sepsis trigger. This is significantly below the RCEM Clinical Standard of 90%.</p></div>
                <div><strong class="block text-xs text-slate-500 uppercase mb-1">Department Context</strong>
                <p class="text-sm text-slate-700 bg-blue-50 p-3 rounded">District General Hospital ED, approximately 85,000 attendances per year. 24-hour consultant presence. Regular corridor care with occupancy often exceeding 150%.</p></div>
                <div><strong class="block text-xs text-slate-500 uppercase mb-1">Baseline Evidence</strong>
                <p class="text-sm text-slate-700 bg-blue-50 p-3 rounded">Baseline audit: 42% compliance (n=150). RCEM Sepsis Audit 2022: national median 67%. NCEPOD 2015 highlighted antibiotic delays as key driver of preventable mortality.</p></div>
            </div>`
        },
        aim: {
            title: 'SMART Aim — Example (Sepsis Project)',
            content: `<div class="space-y-3">
                <div class="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <strong class="block text-xs text-amber-600 uppercase mb-1">SMART Aim Statement</strong>
                    <p class="text-sm font-medium text-slate-800">"To increase the percentage of patients with Red Flag Sepsis who receive IV antibiotics within 60 minutes of the sepsis trigger from 42% to 90% by June 2024 in the Emergency Department."</p>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="bg-slate-50 p-2 rounded"><strong>Specific:</strong> IV antibiotics within 60 min, Red Flag Sepsis</div>
                    <div class="bg-slate-50 p-2 rounded"><strong>Measurable:</strong> % compliance (42% → 90%)</div>
                    <div class="bg-slate-50 p-2 rounded"><strong>Achievable:</strong> National median 67% — ambitious but evidenced</div>
                    <div class="bg-slate-50 p-2 rounded"><strong>Relevant:</strong> RCEM Clinical Standard</div>
                    <div class="bg-slate-50 p-2 rounded col-span-2"><strong>Time-bound:</strong> June 2024 (12 months)</div>
                </div>
            </div>`
        },
        measures: {
            title: 'Family of Measures — Example (Sepsis Project)',
            content: `<div class="space-y-3">
                <div class="flex gap-2 items-start"><span class="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 mt-0.5"></span><div><strong class="text-xs">Outcome Measure:</strong><p class="text-sm text-slate-600">% of Red Flag Sepsis patients receiving IV antibiotics within 60 minutes of trigger</p></div></div>
                <div class="flex gap-2 items-start"><span class="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500 mt-0.5"></span><div><strong class="text-xs">Process Measure:</strong><p class="text-sm text-slate-600">Door-to-needle time in minutes; % of patients screened at triage; % of Sepsis 6 bundles completed</p></div></div>
                <div class="flex gap-2 items-start"><span class="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500 mt-0.5"></span><div><strong class="text-xs">Balancing Measure:</strong><p class="text-sm text-slate-600">Inappropriate antibiotic prescribing rate; patient complaints about cannulation; staff overtime hours</p></div></div>
            </div>`
        }
    };

    const ex = examples[section];
    if (!ex) return;

    // Create modal
    const existing = document.getElementById('example-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'example-modal';
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div class="bg-indigo-50 border-b border-indigo-200 p-5 flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-slate-800">${escapeHtml(ex.title)}</h3>
                    <p class="text-xs text-slate-500 mt-0.5">From the demo Sepsis 6 project — for illustration only</p>
                </div>
                <button onclick="document.getElementById('example-modal').remove()" class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="overflow-y-auto p-6 flex-1">${ex.content}</div>
            <div class="border-t border-slate-200 p-4 flex justify-end">
                <button onclick="document.getElementById('example-modal').remove()" class="bg-rcem-purple text-white px-4 py-2 rounded-lg text-sm font-medium">Close</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};
