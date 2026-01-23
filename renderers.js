import { state } from "./state.js";
import { escapeHtml, showToast, autoResizeTextarea } from "./utils.js";
import { 
    renderChart, deleteDataPoint, downloadCSVTemplate, renderTools, 
    setToolMode, renderFullViewChart, makeDraggable, chartMode, toolMode
} from "./charts.js";

// ==========================================
// 1. MAIN ROUTER & NAVIGATION
// ==========================================

export function renderAll(view) {
    updateNavigationUI(view);
    
    switch(view) {
        case 'projects': break; 
        case 'dashboard': renderDashboard(); break;
        case 'checklist': renderChecklist(); break; 
        case 'team': renderTeam(); break;
        case 'tools': renderTools(); break;
        case 'data': renderDataView(); break;       
        case 'pdsa': renderPDSA(); break;
        case 'stakeholders': renderStakeholders(); break;
        case 'gantt': renderGantt(); break;
        case 'green': renderGreen(); break;         
        case 'full': renderFullProject(); break;    
        case 'publish': renderPublish(); break;     
        default: renderDashboard();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateNavigationUI(currentView) {
    const navItems = ['checklist', 'team', 'tools', 'pdsa', 'data', 'publish'];
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
        
        const existingBadge = btn.querySelector('.status-badge');
        if(existingBadge) existingBadge.remove();

        if(status) {
            const badge = document.createElement('span');
            badge.className = 'status-badge ml-auto text-emerald-400 font-bold text-[10px]';
            badge.textContent = status;
            btn.appendChild(badge);
        }
    });
}

// ==========================================
// 2. DASHBOARD VIEW
// ==========================================

export function renderDashboard() {
    const d = state.projectData;
    if (!d) return;

    // Update header
    const headerTitle = document.getElementById('project-header-title');
    if(headerTitle) headerTitle.textContent = d.title || 'Untitled Project';

    // Calculate progress
    const checks = d.checklist || {};
    const fields = ['problem_desc', 'aim', 'outcome_measure', 'process_measure', 'balance_measure', 'ethics', 'lit_review', 'learning_points', 'sustainability', 'results_analysis'];
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

    // Update stats
    const statPdsa = document.getElementById('stat-pdsa');
    if(statPdsa) statPdsa.textContent = (d.pdsa || []).length;
    
    const statData = document.getElementById('stat-data');
    if(statData) statData.textContent = (d.chartData || []).length;
    
    const statDrivers = document.getElementById('stat-drivers');
    if(statDrivers) {
        const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
        statDrivers.textContent = drivers.primary.length + drivers.secondary.length + drivers.changes.length;
    }

    // Update aim display
    const aimDisplay = document.getElementById('dash-aim-display');
    if(aimDisplay) {
        aimDisplay.innerHTML = checks.aim ? escapeHtml(checks.aim) : '<span class="text-slate-400">No aim defined yet. Go to Define & Measure to set your SMART aim.</span>';
    }

    // Aim quality badge
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

    // QI Coach Banner
    renderQICoachBanner();
    
    // Mini Chart
    renderMiniChart();
    
    // Recent Activity
    renderRecentActivity();
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
        tip = "Start by defining your problem statement in Define & Measure. A clear problem is half the solution!";
    } else if (!checks.aim) {
        tip = "Now set a SMART aim: Specific, Measurable, Achievable, Relevant, Time-bound. What exactly do you want to achieve?";
    } else if (drivers.primary.length === 0) {
        tip = "Build your Driver Diagram in the Tools section. What are the main factors affecting your aim?";
        icon = 'git-branch';
    } else if (data.length < 6) {
        tip = `You have ${data.length} data points. Collect at least 12 baseline points before making changes for a reliable run chart.`;
        icon = 'bar-chart-2';
    } else if (pdsa.length === 0) {
        tip = "Ready to test a change? Document your first PDSA cycle. Start small - test with one patient, one shift, one clinician.";
        icon = 'refresh-cw';
        color = 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200';
    } else if (!checks.ethics) {
        tip = "Don't forget governance! Document your ethical considerations and any approvals needed.";
        icon = 'shield-check';
    } else {
        tip = "Excellent progress! Keep iterating through PDSA cycles. Remember: 'Adopt, Adapt, or Abandon' after each test.";
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
        container.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">No data yet. Add data points in the Data view.</div>';
        return;
    }
    
    // Create sparkline-style mini chart
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const values = sorted.map(x => x.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    
    const points = values.map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * 280 + 10;
        const y = 60 - ((v - min) / range) * 50;
        return `${x},${y}`;
    }).join(' ');
    
    container.innerHTML = `
        <svg width="300" height="70" class="w-full">
            <polyline fill="none" stroke="#2d2e83" stroke-width="2" points="${points}"/>
            ${values.map((v, i) => {
                const x = (i / (values.length - 1 || 1)) * 280 + 10;
                const y = 60 - ((v - min) / range) * 50;
                return `<circle cx="${x}" cy="${y}" r="3" fill="#2d2e83"/>`;
            }).join('')}
        </svg>
        <div class="flex justify-between text-xs text-slate-400 mt-1">
            <span>${sorted[0]?.date || ''}</span>
            <span>${sorted[sorted.length - 1]?.date || ''}</span>
        </div>
    `;
}

function renderRecentActivity() {
    const container = document.getElementById('dash-activity');
    if (!container) return;
    
    const d = state.projectData;
    const activities = [];
    
    // Add PDSA activities
    (d.pdsa || []).forEach(p => {
        activities.push({
            type: 'pdsa',
            icon: 'refresh-cw',
            color: 'text-blue-500',
            text: `PDSA Cycle: ${p.title || 'Untitled'}`,
            date: p.startDate || ''
        });
    });
    
    // Add recent data points
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
    
    // Sort by date
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
    
    container.innerHTML = `
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <i data-lucide="clipboard-check" class="text-rcem-purple"></i>
                Define & Measure
            </h1>
            <p class="text-slate-500 mt-2">Complete these sections to build a solid QIP foundation</p>
        </header>
        
        <!-- Problem Definition -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">1</span>
                Problem Definition
            </h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Problem Statement *</label>
                    <textarea id="check-problem" onchange="window.saveChecklistField('problem_desc', this.value)" 
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="What is the current problem? Be specific about the gap between current and desired state.">${escapeHtml(c.problem_desc || '')}</textarea>
                </div>
            </div>
        </section>
        
        <!-- SMART Aim -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">2</span>
                SMART Aim
            </h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Aim Statement *</label>
                    <textarea id="check-aim" onchange="window.saveChecklistField('aim', this.value)" 
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-rcem-purple focus:border-transparent"
                        placeholder="To [increase/decrease] [measure] from [baseline] to [target] by [date]">${escapeHtml(c.aim || '')}</textarea>
                    <div class="mt-2 flex gap-2">
                        <button onclick="window.aiRefineAim()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
                            <i data-lucide="sparkles" class="w-3 h-3"></i> AI Refine
                        </button>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Measures -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">3</span>
                Family of Measures
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
        
        <!-- Ethics & Governance -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">4</span>
                Ethics & Governance
            </h2>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Ethical Considerations & Approvals</label>
                <textarea id="check-ethics" onchange="window.saveChecklistField('ethics', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                    placeholder="QI vs Research distinction, confidentiality, consent, any approvals needed...">${escapeHtml(c.ethics || '')}</textarea>
            </div>
        </section>
        
        <!-- Literature Review -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold">5</span>
                Literature Review
            </h2>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Evidence Base & Guidelines</label>
                <textarea id="check-litreview" onchange="window.saveChecklistField('lit_review', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px]"
                    placeholder="What does the evidence say? NICE guidelines, RCEM standards, relevant studies...">${escapeHtml(c.lit_review || '')}</textarea>
                <div class="mt-2">
                    <button onclick="window.aiSuggestEvidence()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
                        <i data-lucide="sparkles" class="w-3 h-3"></i> AI Suggest Evidence
                    </button>
                </div>
            </div>
        </section>
        
        <!-- Results Analysis -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm font-bold">6</span>
                Results & Analysis
            </h2>
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Analysis of Results</label>
                <textarea id="check-results" onchange="window.saveChecklistField('results_analysis', this.value)"
                    class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px]"
                    placeholder="What do your charts show? Any special cause variation? What patterns emerged?">${escapeHtml(c.results_analysis || '')}</textarea>
            </div>
        </section>
        
        <!-- Learning & Sustainability -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold">7</span>
                Learning & Sustainability
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Key Learning Points</label>
                    <textarea id="check-learning" onchange="window.saveChecklistField('learning_points', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                        placeholder="What worked? What didn't? What would you do differently?">${escapeHtml(c.learning_points || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Sustainability Plan</label>
                    <textarea id="check-sustainability" onchange="window.saveChecklistField('sustainability', this.value)"
                        class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                        placeholder="How will improvements be maintained? Who owns this? What systems are in place?">${escapeHtml(c.sustainability || '')}</textarea>
                </div>
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

export function renderDataView() {
    const d = state.projectData;
    if (!d) return;
    
    // Render the main chart
    if (window.renderChart) window.renderChart();
    
    // Update data history
    const historyContainer = document.getElementById('data-history');
    if (historyContainer) {
        if (!d.chartData || d.chartData.length === 0) {
            historyContainer.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">No data points yet. Add your first data point above.</div>`;
        } else {
            const sorted = [...d.chartData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
            historyContainer.innerHTML = `
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-[10px] uppercase text-slate-500 border-b border-slate-200">
                            <th class="pb-2">Date</th>
                            <th class="pb-2">Value</th>
                            <th class="pb-2">Phase</th>
                            <th class="pb-2 text-right"></th>
                        </tr>
                    </thead>
                    <tbody class="text-xs text-slate-700">
                        ${sorted.map(item => `
                            <tr class="border-b border-slate-50 hover:bg-slate-50" title="${escapeHtml(item.note || '')}">
                                <td class="py-2 font-mono">${escapeHtml(item.date)}</td>
                                <td class="py-2 font-bold text-rcem-purple">${item.value}</td>
                                <td class="py-2 text-slate-400">${escapeHtml(item.grade || '-')}</td>
                                <td class="py-2 text-right">
                                    <button onclick="window.deleteDataPoint('${item.date}')" class="text-slate-300 hover:text-red-500 transition-colors">
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
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold">
                                        ${escapeHtml((m.name || '?')[0].toUpperCase())}
                                    </div>
                                    <div>
                                        <div class="font-bold text-slate-800">${escapeHtml(m.name || 'Unknown')}</div>
                                        <div class="text-xs text-slate-500">${escapeHtml(m.role || 'No role')}</div>
                                    </div>
                                </div>
                                <button onclick="window.deleteMember(${i})" class="text-slate-300 hover:text-red-500 transition-colors">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                            ${m.grade ? `<div class="mt-2 text-xs text-slate-600"><span class="font-medium">Grade:</span> ${escapeHtml(m.grade)}</div>` : ''}
                            ${m.responsibility ? `<div class="mt-1 text-xs text-slate-600"><span class="font-medium">Responsibility:</span> ${escapeHtml(m.responsibility)}</div>` : ''}
                            ${m.initials ? `<div class="mt-1 text-xs text-slate-400">Initials: ${escapeHtml(m.initials)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        `;
    }
    
    // Leadership engagement log
    if (logContainer) {
        const logs = d.leadershipLog || [];
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
                                    <th class="px-4 py-3 text-left">Leader</th>
                                    <th class="px-4 py-3 text-left">Summary</th>
                                    <th class="px-4 py-3 text-left">Action</th>
                                    <th class="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${logs.map((l, i) => `
                                    <tr class="hover:bg-slate-50">
                                        <td class="px-4 py-3 text-sm font-mono text-slate-600">${escapeHtml(l.date || '')}</td>
                                        <td class="px-4 py-3 text-sm font-medium text-slate-800">${escapeHtml(l.leader || '')}</td>
                                        <td class="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">${escapeHtml(l.summary || '')}</td>
                                        <td class="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">${escapeHtml(l.action || '')}</td>
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
    
    document.getElementById('member-index').value = index ?? '';
    document.getElementById('member-name').value = member?.name || '';
    document.getElementById('member-role').value = member?.role || '';
    document.getElementById('member-grade').value = member?.grade || '';
    document.getElementById('member-resp').value = member?.responsibility || '';
    document.getElementById('member-init').value = member?.initials || '';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function addLeadershipLog() {
    const date = prompt('Date (YYYY-MM-DD):');
    if (!date) return;
    
    const leader = prompt('Leader name/title:');
    const summary = prompt('Brief summary of discussion:');
    const action = prompt('Actions agreed:');
    
    if (!state.projectData.leadershipLog) state.projectData.leadershipLog = [];
    state.projectData.leadershipLog.push({ date, leader, summary, action });
    
    if (window.saveData) window.saveData();
    renderTeam();
    showToast('Leadership log added', 'success');
}

export function deleteLeadershipLog(index) {
    if (!confirm('Delete this log entry?')) return;
    state.projectData.leadershipLog.splice(index, 1);
    if (window.saveData) window.saveData();
    renderTeam();
    showToast('Log entry deleted', 'success');
}

// ==========================================
// 6. PDSA VIEW
// ==========================================

export function renderPDSA() {
    const d = state.projectData;
    if (!d) return;
    
    const container = document.getElementById('pdsa-container');
    if (!container) return;
    
    const pdsa = d.pdsa || [];
    const members = d.teamMembers || [];
    
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Add New PDSA Form -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                <h3 class="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                    <i data-lucide="plus-circle" class="w-5 h-5 text-rcem-purple"></i>
                    New PDSA Cycle
                </h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Cycle Title *</label>
                        <input id="pdsa-title" class="w-full p-2 border rounded text-sm" placeholder="e.g. Test sepsis checklist with 5 patients">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <input id="pdsa-start" type="date" class="w-full p-2 border rounded text-sm">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Owner</label>
                        <select id="pdsa-owner" class="w-full p-2 border rounded text-sm">
                            <option value="">Select team member...</option>
                            ${members.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select id="pdsa-status" class="w-full p-2 border rounded text-sm">
                            <option value="planning">Planning</option>
                            <option value="doing">Doing</option>
                            <option value="studying">Studying</option>
                            <option value="acting">Acting</option>
                            <option value="complete">Complete</option>
                        </select>
                    </div>
                    <button onclick="window.addPDSA()" class="w-full bg-rcem-purple text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                        Add PDSA Cycle
                    </button>
                </div>
            </div>
            
            <!-- PDSA List -->
            <div class="lg:col-span-2 space-y-4">
                ${pdsa.length === 0 ? `
                    <div class="bg-slate-50 rounded-xl p-8 text-center">
                        <i data-lucide="refresh-cw" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
                        <p class="text-slate-500">No PDSA cycles yet. Start your first test of change!</p>
                    </div>
                ` : pdsa.map((p, i) => `
                    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="font-bold text-slate-800 text-lg">${escapeHtml(p.title || `Cycle ${i + 1}`)}</h4>
                                <div class="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    ${p.startDate ? `<span><i data-lucide="calendar" class="w-3 h-3 inline mr-1"></i>${p.startDate}</span>` : ''}
                                    ${p.owner ? `<span><i data-lucide="user" class="w-3 h-3 inline mr-1"></i>${escapeHtml(p.owner)}</span>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <select onchange="window.updatePDSA(${i}, 'status', this.value)" class="text-xs border rounded px-2 py-1 ${getStatusColor(p.status)}">
                                    <option value="planning" ${p.status === 'planning' ? 'selected' : ''}>Planning</option>
                                    <option value="doing" ${p.status === 'doing' ? 'selected' : ''}>Doing</option>
                                    <option value="studying" ${p.status === 'studying' ? 'selected' : ''}>Studying</option>
                                    <option value="acting" ${p.status === 'acting' ? 'selected' : ''}>Acting</option>
                                    <option value="complete" ${p.status === 'complete' ? 'selected' : ''}>Complete</option>
                                </select>
                                <button onclick="window.deletePDSA(${i})" class="text-slate-300 hover:text-red-500">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-1">
                                    <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[8px] font-bold">P</span> Plan
                                </label>
                                <textarea onchange="window.updatePDSA(${i}, 'plan', this.value)" 
                                    class="w-full p-2 bg-blue-50/50 border border-blue-100 rounded text-sm min-h-[80px]"
                                    placeholder="What change are you testing? What's your prediction?">${escapeHtml(p.plan || '')}</textarea>
                                ${p.prediction ? `<p class="text-xs text-blue-600 italic">Prediction: ${escapeHtml(p.prediction)}</p>` : ''}
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase text-amber-600 flex items-center gap-1">
                                    <span class="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[8px] font-bold">D</span> Do
                                </label>
                                <textarea onchange="window.updatePDSA(${i}, 'do', this.value)" 
                                    class="w-full p-2 bg-amber-50/50 border border-amber-100 rounded text-sm min-h-[80px]"
                                    placeholder="What did you actually do? Any deviations from plan?">${escapeHtml(p.do || '')}</textarea>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase text-purple-600 flex items-center gap-1">
                                    <span class="w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[8px] font-bold">S</span> Study
                                </label>
                                <textarea onchange="window.updatePDSA(${i}, 'study', this.value)" 
                                    class="w-full p-2 bg-purple-50/50 border border-purple-100 rounded text-sm min-h-[80px]"
                                    placeholder="What did you learn? What does the data show?">${escapeHtml(p.study || '')}</textarea>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-1">
                                    <span class="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[8px] font-bold">A</span> Act
                                </label>
                                <textarea onchange="window.updatePDSA(${i}, 'act', this.value)" 
                                    class="w-full p-2 bg-emerald-50/50 border border-emerald-100 rounded text-sm min-h-[80px]"
                                    placeholder="Adopt, Adapt, or Abandon? What's next?">${escapeHtml(p.act || '')}</textarea>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getStatusColor(status) {
    const colors = {
        planning: 'bg-blue-50 text-blue-700',
        doing: 'bg-amber-50 text-amber-700',
        studying: 'bg-purple-50 text-purple-700',
        acting: 'bg-emerald-50 text-emerald-700',
        complete: 'bg-slate-100 text-slate-600'
    };
    return colors[status] || 'bg-slate-50 text-slate-600';
}

export function addPDSA() {
    const title = document.getElementById('pdsa-title')?.value;
    if (!title) {
        showToast('Please enter a cycle title', 'error');
        return;
    }
    
    const startDate = document.getElementById('pdsa-start')?.value || '';
    const owner = document.getElementById('pdsa-owner')?.value || '';
    const status = document.getElementById('pdsa-status')?.value || 'planning';
    
    if (!state.projectData.pdsa) state.projectData.pdsa = [];
    state.projectData.pdsa.push({
        title,
        startDate,
        owner,
        status,
        plan: '',
        prediction: '',
        do: '',
        study: '',
        act: ''
    });
    
    // Clear form
    document.getElementById('pdsa-title').value = '';
    document.getElementById('pdsa-start').value = '';
    document.getElementById('pdsa-owner').value = '';
    document.getElementById('pdsa-status').value = 'planning';
    
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('PDSA cycle added', 'success');
}

export function updatePDSA(index, field, value) {
    if (!state.projectData.pdsa || !state.projectData.pdsa[index]) return;
    state.projectData.pdsa[index][field] = value;
    if (window.saveData) window.saveData();
}

export function deletePDSA(index) {
    if (!confirm('Delete this PDSA cycle?')) return;
    state.projectData.pdsa.splice(index, 1);
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('PDSA cycle deleted', 'success');
}

// ==========================================
// 7. STAKEHOLDER VIEW
// ==========================================

export function renderStakeholders() {
    const d = state.projectData;
    if (!d) return;
    
    const canvas = document.getElementById('stakeholder-canvas');
    if (!canvas) return;
    
    const stakes = d.stakeholders || [];
    
    canvas.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full">
            <header class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <i data-lucide="target" class="text-indigo-500"></i> Stakeholder Matrix
                    </h2>
                    <p class="text-slate-500 text-sm">Map stakeholder power vs interest</p>
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
            
            <div class="relative w-full aspect-square max-w-2xl mx-auto border-2 border-slate-200 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100">
                <!-- Grid Lines -->
                <div class="absolute inset-0 grid grid-cols-2 grid-rows-2">
                    <div class="border-r border-b border-slate-200 p-2">
                        <span class="text-xs text-slate-400 font-medium">Keep Satisfied</span>
                    </div>
                    <div class="border-b border-slate-200 p-2 text-right">
                        <span class="text-xs text-slate-400 font-medium">Manage Closely</span>
                    </div>
                    <div class="border-r border-slate-200 p-2">
                        <span class="text-xs text-slate-400 font-medium">Monitor</span>
                    </div>
                    <div class="p-2 text-right">
                        <span class="text-xs text-slate-400 font-medium">Keep Informed</span>
                    </div>
                </div>
                
                <!-- Axis Labels -->
                <div class="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-slate-500 uppercase tracking-wider">Power</div>
                <div class="absolute bottom-[-24px] left-1/2 -translate-x-1/2 text-xs font-bold text-slate-500 uppercase tracking-wider">Interest</div>
                
                <!-- Stakeholder Points -->
                ${stakes.map((s, i) => `
                    <div class="absolute w-8 h-8 -ml-4 -mt-4 cursor-move group" 
                         style="left: ${s.x || 50}%; top: ${100 - (s.y || 50)}%"
                         draggable="true"
                         ondragend="window.updateStake(${i}, 'pos', event)">
                        <div class="w-full h-full rounded-full bg-rcem-purple text-white flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform">
                            ${(s.name || '?')[0].toUpperCase()}
                        </div>
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            ${escapeHtml(s.name || 'Unknown')}
                            <button onclick="event.stopPropagation(); window.removeStake(${i})" class="ml-2 text-red-400 hover:text-red-300">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function addStakeholder() {
    const name = prompt('Stakeholder name:');
    if (!name) return;
    
    const role = prompt('Role/Position:');
    
    if (!state.projectData.stakeholders) state.projectData.stakeholders = [];
    state.projectData.stakeholders.push({
        name,
        role,
        x: 50,
        y: 50
    });
    
    if (window.saveData) window.saveData();
    renderStakeholders();
    showToast('Stakeholder added - drag to position', 'success');
}

export function updateStake(index, type, event) {
    if (type === 'pos' && event) {
        const canvas = document.getElementById('stakeholder-canvas')?.querySelector('.aspect-square');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, 100 - ((event.clientY - rect.top) / rect.height) * 100));
        
        state.projectData.stakeholders[index].x = x;
        state.projectData.stakeholders[index].y = y;
        
        if (window.saveData) window.saveData();
        renderStakeholders();
    }
}

export function removeStake(index) {
    if (!confirm('Remove this stakeholder?')) return;
    state.projectData.stakeholders.splice(index, 1);
    if (window.saveData) window.saveData();
    renderStakeholders();
    showToast('Stakeholder removed', 'success');
}

export function toggleStakeView() {
    // Toggle between matrix and list view
    showToast('List view coming soon', 'info');
}

// ==========================================
// 8. GANTT VIEW
// ==========================================

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
    
    // Find date range
    let minDate = new Date();
    let maxDate = new Date();
    tasks.forEach(t => {
        if (t.start) {
            const s = new Date(t.start);
            if (s < minDate) minDate = s;
        }
        if (t.end) {
            const e = new Date(t.end);
            if (e > maxDate) maxDate = e;
        }
    });
    
    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);
    
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    const dayWidth = 30;
    
    // Generate week headers
    const weeks = [];
    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
        weeks.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <div style="min-width: ${totalDays * dayWidth}px">
                <!-- Timeline Header -->
                <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0">
                    <div class="w-48 flex-shrink-0 px-3 py-2 font-bold text-xs text-slate-500 uppercase border-r border-slate-200">Task</div>
                    <div class="flex-1 flex">
                        ${weeks.map(w => `
                            <div class="text-xs text-slate-500 px-2 py-2" style="width: ${7 * dayWidth}px">
                                ${w.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Tasks -->
                ${tasks.map((t, i) => {
                    const start = t.start ? new Date(t.start) : minDate;
                    const end = t.end ? new Date(t.end) : start;
                    const startOffset = Math.max(0, Math.ceil((start - minDate) / (1000 * 60 * 60 * 24)));
                    const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                    
                    const statusColors = {
                        'not-started': 'bg-slate-300',
                        'in-progress': 'bg-blue-500',
                        'complete': 'bg-emerald-500',
                        'blocked': 'bg-red-500'
                    };
                    
                    return `
                        <div class="flex border-b border-slate-100 hover:bg-slate-50 group">
                            <div class="w-48 flex-shrink-0 px-3 py-3 border-r border-slate-100 flex items-center justify-between">
                                <div class="truncate text-sm text-slate-700">${escapeHtml(t.name || 'Untitled')}</div>
                                <button onclick="window.deleteGanttTask(${i})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                                </button>
                            </div>
                            <div class="flex-1 relative py-2">
                                <div class="absolute h-6 rounded ${statusColors[t.status] || 'bg-slate-300'} shadow-sm flex items-center px-2"
                                     style="left: ${startOffset * dayWidth}px; width: ${duration * dayWidth}px;">
                                    ${t.milestone ? '<i data-lucide="flag" class="w-3 h-3 text-white"></i>' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function openGanttModal(index = null) {
    const modal = document.getElementById('gantt-modal');
    if (!modal) return;
    
    const d = state.projectData;
    const task = index !== null ? (d.gantt || [])[index] : null;
    
    document.getElementById('task-index').value = index ?? '';
    document.getElementById('task-name').value = task?.name || '';
    document.getElementById('task-start').value = task?.start || '';
    document.getElementById('task-end').value = task?.end || '';
    document.getElementById('task-status').value = task?.status || 'not-started';
    document.getElementById('task-milestone').checked = task?.milestone || false;
    
    // Populate dependency dropdown
    const depSelect = document.getElementById('task-dep');
    if (depSelect) {
        const tasks = d.gantt || [];
        depSelect.innerHTML = `<option value="">None</option>` + 
            tasks.filter((_, i) => i !== index).map((t, i) => 
                `<option value="${i}" ${task?.dependency === i ? 'selected' : ''}>${escapeHtml(t.name || `Task ${i + 1}`)}</option>`
            ).join('');
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==========================================
// 9. GREEN ED VIEW
// ==========================================

export function renderGreen() {
    const container = document.querySelector('#view-green > div');
    if (!container) return;
    
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto">
            <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                <i data-lucide="leaf" class="text-emerald-500"></i> Green ED Calculator
            </h2>
            <p class="text-slate-600 mb-6">Estimate the environmental impact of your QIP</p>
            
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Paper Saved (sheets/week)</label>
                        <input type="number" id="green-paper" class="w-full p-2 border rounded" value="0" onchange="window.calcGreen()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Single-use Items Reduced (per week)</label>
                        <input type="number" id="green-items" class="w-full p-2 border rounded" value="0" onchange="window.calcGreen()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Staff Time Saved (hours/week)</label>
                        <input type="number" id="green-time" class="w-full p-2 border rounded" value="0" onchange="window.calcGreen()">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Patient Journeys Avoided (per week)</label>
                        <input type="number" id="green-journeys" class="w-full p-2 border rounded" value="0" onchange="window.calcGreen()">
                    </div>
                </div>
                
                <div id="green-results" class="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
                    <h3 class="font-bold text-emerald-800 mb-4">Estimated Annual Impact</h3>
                    <div class="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <div class="text-3xl font-bold text-emerald-600" id="green-co2">0</div>
                            <div class="text-xs text-emerald-700">kg CO₂ saved</div>
                        </div>
                        <div>
                            <div class="text-3xl font-bold text-emerald-600" id="green-money">£0</div>
                            <div class="text-xs text-emerald-700">Cost savings</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function calcGreen() {
    const paper = parseFloat(document.getElementById('green-paper')?.value) || 0;
    const items = parseFloat(document.getElementById('green-items')?.value) || 0;
    const time = parseFloat(document.getElementById('green-time')?.value) || 0;
    const journeys = parseFloat(document.getElementById('green-journeys')?.value) || 0;
    
    // Rough estimates (kg CO2 per unit per year)
    const paperCO2 = paper * 52 * 0.005; // ~5g per sheet
    const itemsCO2 = items * 52 * 0.1;   // ~100g per plastic item
    const journeyCO2 = journeys * 52 * 2.5; // ~2.5kg per car journey
    
    const totalCO2 = Math.round(paperCO2 + itemsCO2 + journeyCO2);
    
    // Cost savings
    const paperCost = paper * 52 * 0.02;
    const itemsCost = items * 52 * 0.5;
    const timeCost = time * 52 * 30; // £30/hour
    
    const totalCost = Math.round(paperCost + itemsCost + timeCost);
    
    document.getElementById('green-co2').textContent = totalCO2.toLocaleString();
    document.getElementById('green-money').textContent = '£' + totalCost.toLocaleString();
}

export function calcMoney() { calcGreen(); }
export function calcTime() { calcGreen(); }
export function calcEdu() { calcGreen(); }

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
    
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 print:shadow-none print:border-0">
            <header class="border-b border-slate-200 pb-6 mb-8">
                <h1 class="text-3xl font-bold text-slate-900">${escapeHtml(d.title || 'Untitled QIP')}</h1>
                <p class="text-slate-500 mt-2">Quality Improvement Project Report</p>
            </header>
            
            ${c.problem_desc ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Problem Statement</h2>
                    <p class="text-slate-600 leading-relaxed">${escapeHtml(c.problem_desc)}</p>
                </section>
            ` : ''}
            
            ${c.aim ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Aim</h2>
                    <p class="text-slate-600 leading-relaxed italic">${escapeHtml(c.aim)}</p>
                </section>
            ` : ''}
            
            ${(c.outcome_measure || c.process_measure || c.balance_measure) ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Measures</h2>
                    <div class="space-y-2">
                        ${c.outcome_measure ? `<p class="text-slate-600"><strong class="text-emerald-600">Outcome:</strong> ${escapeHtml(c.outcome_measure)}</p>` : ''}
                        ${c.process_measure ? `<p class="text-slate-600"><strong class="text-blue-600">Process:</strong> ${escapeHtml(c.process_measure)}</p>` : ''}
                        ${c.balance_measure ? `<p class="text-slate-600"><strong class="text-amber-600">Balancing:</strong> ${escapeHtml(c.balance_measure)}</p>` : ''}
                    </div>
                </section>
            ` : ''}
            
            ${team.length > 0 ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Team</h2>
                    <ul class="list-disc list-inside text-slate-600">
                        ${team.map(m => `<li><strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.role || 'Team Member')}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}
            
            ${pdsa.length > 0 ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">PDSA Cycles</h2>
                    ${pdsa.map((p, i) => `
                        <div class="mb-4 p-4 bg-slate-50 rounded-lg">
                            <h3 class="font-bold text-slate-700">Cycle ${i + 1}: ${escapeHtml(p.title || 'Untitled')}</h3>
                            ${p.plan ? `<p class="text-sm text-slate-600 mt-2"><strong>Plan:</strong> ${escapeHtml(p.plan)}</p>` : ''}
                            ${p.do ? `<p class="text-sm text-slate-600 mt-1"><strong>Do:</strong> ${escapeHtml(p.do)}</p>` : ''}
                            ${p.study ? `<p class="text-sm text-slate-600 mt-1"><strong>Study:</strong> ${escapeHtml(p.study)}</p>` : ''}
                            ${p.act ? `<p class="text-sm text-slate-600 mt-1"><strong>Act:</strong> ${escapeHtml(p.act)}</p>` : ''}
                        </div>
                    `).join('')}
                </section>
            ` : ''}
            
            <section class="mb-8">
                <h2 class="text-xl font-bold text-slate-800 mb-3">Results</h2>
                <div id="full-view-chart-container" class="bg-slate-50 rounded-lg p-4 min-h-[300px]"></div>
            </section>
            
            ${c.learning_points ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Learning Points</h2>
                    <p class="text-slate-600 leading-relaxed">${escapeHtml(c.learning_points)}</p>
                </section>
            ` : ''}
            
            ${c.sustainability ? `
                <section class="mb-8">
                    <h2 class="text-xl font-bold text-slate-800 mb-3">Sustainability</h2>
                    <p class="text-slate-600 leading-relaxed">${escapeHtml(c.sustainability)}</p>
                </section>
            ` : ''}
        </div>
    `;
    
    // Render the full view chart
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
    
    // Update mode buttons
    ['qiat', 'abstract', 'report'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
            btn.className = mode === m
                ? "px-3 py-1 text-sm font-bold rounded bg-white shadow text-rcem-purple"
                : "px-3 py-1 text-sm font-bold rounded text-slate-500 hover:bg-slate-200";
        }
    });
    
    const c = d.checklist || {};
    
    if (mode === 'qiat') {
        content.innerHTML = renderQIATForm(d);
    } else if (mode === 'abstract') {
        content.innerHTML = renderAbstractForm(d);
    } else {
        content.innerHTML = renderReportForm(d);
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderQIATForm(d) {
    const c = d.checklist || {};
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">QIAT / Risr Form Generator</h2>
                    <p class="text-slate-500 text-sm">Auto-generated content for your Kaizen portfolio</p>
                </div>
                <button onclick="window.copyReport('qiat')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="copy" class="w-4 h-4"></i> Copy All
                </button>
            </div>
            
            <div id="qiat-content" class="prose prose-sm max-w-none">
                <h3>Project Title</h3>
                <p>${escapeHtml(d.title || 'Untitled QIP')}</p>
                
                <h3>Problem Statement</h3>
                <p>${escapeHtml(c.problem_desc || 'Not defined')}</p>
                
                <h3>Aim Statement</h3>
                <p>${escapeHtml(c.aim || 'Not defined')}</p>
                
                <h3>Measures</h3>
                <p><strong>Outcome:</strong> ${escapeHtml(c.outcome_measure || 'Not defined')}</p>
                <p><strong>Process:</strong> ${escapeHtml(c.process_measure || 'Not defined')}</p>
                <p><strong>Balancing:</strong> ${escapeHtml(c.balance_measure || 'Not defined')}</p>
                
                <h3>PDSA Cycles</h3>
                ${(d.pdsa || []).map((p, i) => `
                    <p><strong>Cycle ${i + 1}:</strong> ${escapeHtml(p.title || 'Untitled')}</p>
                `).join('') || '<p>No PDSA cycles documented</p>'}
                
                <h3>Results</h3>
                <p>${escapeHtml(c.results_analysis || 'Not yet analysed')}</p>
                
                <h3>Learning Points</h3>
                <p>${escapeHtml(c.learning_points || 'Not documented')}</p>
            </div>
        </div>
    `;
}

function renderAbstractForm(d) {
    const c = d.checklist || {};
    const wordLimit = 250;
    
    // Generate abstract text
    let abstract = `Background: ${c.problem_desc || '[Problem statement]'}\n\n`;
    abstract += `Aim: ${c.aim || '[SMART aim]'}\n\n`;
    abstract += `Methods: We used the Model for Improvement with PDSA cycles. `;
    abstract += `${(d.pdsa || []).length} PDSA cycles were completed. `;
    abstract += `Data was collected using ${c.outcome_measure || '[outcome measure]'}.\n\n`;
    abstract += `Results: ${c.results_analysis || '[Analysis of results]'}\n\n`;
    abstract += `Conclusion: ${c.learning_points || '[Key learning points]'}`;
    
    const wordCount = abstract.split(/\s+/).length;
    
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">RCEM Abstract Format</h2>
                    <p class="text-slate-500 text-sm">For ASC/conference submissions</p>
                </div>
                <button onclick="window.copyReport('abstract')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="copy" class="w-4 h-4"></i> Copy
                </button>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
                <span class="text-sm text-slate-500">Word count: <span class="${wordCount > wordLimit ? 'text-red-500 font-bold' : 'text-emerald-500'}">${wordCount}</span>/${wordLimit}</span>
            </div>
            
            <div id="abstract-content" class="bg-slate-50 p-6 rounded-lg font-serif text-sm leading-relaxed whitespace-pre-wrap">
${escapeHtml(abstract)}
            </div>
        </div>
    `;
}

function renderReportForm(d) {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-xl font-bold text-slate-800">FRCEM Report Format</h2>
                    <p class="text-slate-500 text-sm">Structured format for FRCEM QIP submission</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.exportPPTX()" class="bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <i data-lucide="presentation" class="w-4 h-4"></i> PowerPoint
                    </button>
                    <button onclick="window.copyReport('report')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <i data-lucide="copy" class="w-4 h-4"></i> Copy
                    </button>
                </div>
            </div>
            
            <div id="report-content" class="prose prose-sm max-w-none">
                <p class="text-slate-500 italic">Full FRCEM report template - use PowerPoint export for presentation format.</p>
            </div>
        </div>
    `;
}

export function copyReport(type) {
    let content = '';
    
    if (type === 'qiat') {
        content = document.getElementById('qiat-content')?.innerText || '';
    } else if (type === 'abstract') {
        content = document.getElementById('abstract-content')?.innerText || '';
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

// ==========================================
// 12. FISHBONE HELPERS (called from charts.js)
// ==========================================

export function toggleToolList() {
    // Toggle the tool help panel
    if (window.toggleToolHelp) window.toggleToolHelp();
}

export function updateFishCat(index, value) {
    if (!state.projectData.fishbone) return;
    state.projectData.fishbone.categories[index].name = value;
    if (window.saveData) window.saveData();
}

export function updateFishCause(catIndex, causeIndex, value) {
    if (!state.projectData.fishbone) return;
    const cat = state.projectData.fishbone.categories[catIndex];
    if (cat && cat.causes && cat.causes[causeIndex]) {
        cat.causes[causeIndex].text = value;
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
// 13. HELP & TOUR
// ==========================================

export function showHelp() {
    showToast("QI Coach: Start with Define & Measure, then build your Driver Diagram, add data, and document PDSA cycles.", "info");
}

export function startTour() {
    if (typeof driver === 'undefined' || !driver.js) {
        showToast("Tour feature loading...", "info");
        return;
    }
    
    try {
        const driverObj = driver.js.driver({
            showProgress: true,
            animate: true,
            steps: [
                { element: '#nav-dashboard', popover: { title: 'Dashboard', description: 'Overview of your project progress and key metrics.' }},
                { element: '#nav-checklist', popover: { title: 'Define & Measure', description: 'Start here! Define your problem and SMART aim.' }},
                { element: '#nav-tools', popover: { title: 'Diagnosis Tools', description: 'Build Fishbone and Driver diagrams to understand root causes.' }},
                { element: '#nav-data', popover: { title: 'Data & SPC', description: 'Track your measurements over time with run and SPC charts.' }},
                { element: '#nav-pdsa', popover: { title: 'PDSA Cycles', description: 'Plan, Do, Study, Act - document your improvement cycles here.' }},
                { element: '#nav-publish', popover: { title: 'Publish', description: 'Generate reports and abstracts for your portfolio.' }}
            ]
        });
        driverObj.drive();
    } catch (e) {
        console.error("Tour error:", e);
        showToast("Could not start tour", "error");
    }
}
