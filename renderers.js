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
    if(headerTitle) headerTitle.textContent = d.meta?.title || 'Untitled Project';

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
            date: p.startDate || p.start || ''
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
                        <button id="btn-ai-aim" onclick="window.aiRefineAim()" class="text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all">
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
    
    // Update results text field
    const resultsText = document.getElementById('results-text');
    if (resultsText && d.checklist) {
        resultsText.value = d.checklist.results_text || '';
    }
    
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
                            ${m.responsibilities ? `<div class="mt-1 text-xs text-slate-600"><span class="font-medium">Responsibility:</span> ${escapeHtml(m.responsibilities)}</div>` : ''}
                            ${m.initials ? `<div class="mt-1 text-xs text-slate-400">Initials: ${escapeHtml(m.initials)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        `;
    }
    
    // Leadership engagement log
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
                                        <td class="px-4 py-3 text-sm font-mono text-slate-600">${escapeHtml(l.date || '')}</td>
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
    
    document.getElementById('member-index').value = index ?? '';
    document.getElementById('member-name').value = member?.name || '';
    document.getElementById('member-role').value = member?.role || '';
    document.getElementById('member-grade').value = member?.grade || '';
    document.getElementById('member-resp').value = member?.responsibilities || '';
    document.getElementById('member-init').value = member?.initials || '';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function addLeadershipLog() {
    const date = prompt('Date (YYYY-MM-DD):');
    if (!date) return;
    
    const note = prompt('Brief note about the engagement/activity:');
    
    if (!state.projectData.leadershipLogs) state.projectData.leadershipLogs = [];
    state.projectData.leadershipLogs.push({ date, note });
    
    if (window.saveData) window.saveData();
    renderTeam();
    showToast('Leadership log added', 'success');
}

export function deleteLeadershipLog(index) {
    if (!confirm('Delete this log entry?')) return;
    state.projectData.leadershipLogs.splice(index, 1);
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
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Plan</label>
                        <textarea id="pdsa-plan" class="w-full p-2 border rounded text-sm" rows="3" placeholder="What will you test? What do you predict will happen?"></textarea>
                    </div>
                    <button onclick="window.addPDSA()" class="w-full bg-rcem-purple text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                        Add PDSA Cycle
                    </button>
                    ${window.hasAI && window.hasAI() ? `
                    <button onclick="window.aiGeneratePDSA()" id="btn-ai-pdsa" class="w-full mt-2 border border-purple-200 text-purple-700 py-2 rounded-lg font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> AI Draft Plan
                    </button>` : ''}
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
                                    ${(p.startDate || p.start) ? `<span><i data-lucide="calendar" class="w-3 h-3 inline mr-1"></i>${p.startDate || p.start}</span>` : ''}
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
                                    placeholder="What change are you testing? What's your prediction?">${escapeHtml(p.plan || p.desc || '')}</textarea>
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
    const plan = document.getElementById('pdsa-plan')?.value || '';
    
    if (!state.projectData.pdsa) state.projectData.pdsa = [];
    state.projectData.pdsa.push({
        title,
        startDate,
        start: startDate, // Keep both for compatibility
        owner,
        status,
        plan,
        desc: plan, // Keep both for compatibility
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
    document.getElementById('pdsa-plan').value = '';
    
    if (window.saveData) window.saveData();
    renderPDSA();
    showToast('PDSA cycle added', 'success');
}

export function updatePDSA(index, field, value) {
    if (!state.projectData.pdsa || !state.projectData.pdsa[index]) return;
    state.projectData.pdsa[index][field] = value;
    // Keep compatibility fields in sync
    if (field === 'plan') state.projectData.pdsa[index].desc = value;
    if (field === 'startDate') state.projectData.pdsa[index].start = value;
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
// 7. STAKEHOLDER VIEW - IMPROVED WITH FULL NAMES
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
                <!-- Grid Lines -->
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
                
                <!-- Axis Labels -->
                <div class="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Power ↑</div>
                <div class="absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-xs font-bold text-slate-500 uppercase tracking-wider">Interest →</div>
                
                <!-- Stakeholder Labels with Full Names -->
                ${stakes.map((s, i) => {
                    // Determine quadrant color based on position
                    const isHighPower = (s.y || 50) >= 50;
                    const isHighInterest = (s.x || 50) >= 50;
                    let bgColor = 'bg-slate-600';
                    if (isHighPower && isHighInterest) bgColor = 'bg-red-600'; // Manage closely
                    else if (isHighPower && !isHighInterest) bgColor = 'bg-amber-600'; // Keep satisfied
                    else if (!isHighPower && isHighInterest) bgColor = 'bg-blue-600'; // Keep informed
                    else bgColor = 'bg-slate-500'; // Monitor
                    
                    return `
                    <div class="stakeholder-label absolute cursor-move group z-10" 
                         style="left: ${s.x || 50}%; top: ${100 - (s.y || 50)}%; transform: translate(-50%, -50%);"
                         data-index="${i}"
                         id="stake-${i}">
                        <div class="${bgColor} text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all text-xs font-medium max-w-[140px] text-center leading-tight">
                            <div class="font-bold">${escapeHtml(s.name || 'Unknown')}</div>
                            ${s.role ? `<div class="text-[10px] opacity-80 mt-0.5">${escapeHtml(s.role)}</div>` : ''}
                        </div>
                        <button onclick="event.stopPropagation(); window.removeStake(${i})" 
                                class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs hover:bg-red-600">
                            ×
                        </button>
                    </div>
                `;
                }).join('')}
            </div>
            
            <!-- Legend -->
            <div class="mt-6 flex flex-wrap justify-center gap-4 text-xs">
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-600"></span> Manage Closely</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-600"></span> Keep Satisfied</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-600"></span> Keep Informed</div>
                <div class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-500"></span> Monitor</div>
            </div>
        </div>
    `;
    
    // Initialize draggable behavior
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
            if (e.target.tagName === 'BUTTON') return;
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
                    renderStakeholders(); // Re-render to update colors
                }
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}

export function addStakeholder() {
    const name = prompt('Stakeholder name:');
    if (!name) return;
    
    const role = prompt('Role/Position (optional):');
    
    if (!state.projectData.stakeholders) state.projectData.stakeholders = [];
    state.projectData.stakeholders.push({
        name,
        role: role || '',
        x: 50,
        y: 50
    });
    
    if (window.saveData) window.saveData();
    renderStakeholders();
    showToast('Stakeholder added - drag to position', 'success');
}

export function updateStake(index, type, event) {
    // This is now handled by the drag functionality
}

export function removeStake(index) {
    if (!confirm('Remove this stakeholder?')) return;
    state.projectData.stakeholders.splice(index, 1);
    if (window.saveData) window.saveData();
    renderStakeholders();
    showToast('Stakeholder removed', 'success');
}

export function toggleStakeView() {
    // Show stakeholder list view
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
                                        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(s.role || '-')}</td>
                                        <td class="px-4 py-3 text-sm">${power}%</td>
                                        <td class="px-4 py-3 text-sm">${interest}%</td>
                                        <td class="px-4 py-3 text-sm font-medium ${strategyColor}">${strategy}</td>
                                        <td class="px-4 py-3 text-right">
                                            <button onclick="window.removeStake(${i})" class="text-slate-300 hover:text-red-500">
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

// Make renderStakeholders available globally for the toggle
window.renderStakeholders = renderStakeholders;

// ==========================================
// 8. GANTT VIEW - WITH ZOOM FUNCTIONALITY
// ==========================================

// Gantt zoom state
let ganttZoomLevel = 'weeks'; // 'days', 'weeks', 'months'

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
            if (s < minDate) minDate = new Date(s);
        }
        if (t.end) {
            const e = new Date(t.end);
            if (e > maxDate) maxDate = new Date(e);
        }
    });
    
    // Add padding based on zoom level
    const padding = ganttZoomLevel === 'days' ? 7 : ganttZoomLevel === 'weeks' ? 14 : 30;
    minDate.setDate(minDate.getDate() - padding);
    maxDate.setDate(maxDate.getDate() + padding);
    
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    
    // Day width based on zoom
    const dayWidth = ganttZoomLevel === 'days' ? 40 : ganttZoomLevel === 'weeks' ? 20 : 8;
    
    // Generate time headers based on zoom
    let timeHeaders = '';
    if (ganttZoomLevel === 'days') {
        // Show individual days
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            const dayNum = currentDate.getDate();
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            timeHeaders += `<div class="text-xs text-slate-500 text-center ${isWeekend ? 'bg-slate-100' : ''}" style="width: ${dayWidth}px">${dayNum}</div>`;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (ganttZoomLevel === 'weeks') {
        // Show weeks
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            const weekStart = currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            timeHeaders += `<div class="text-xs text-slate-500 px-1 border-l border-slate-200" style="width: ${7 * dayWidth}px">${weekStart}</div>`;
            currentDate.setDate(currentDate.getDate() + 7);
        }
    } else {
        // Show months
        let currentDate = new Date(minDate);
        currentDate.setDate(1);
        while (currentDate <= maxDate) {
            const monthName = currentDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            timeHeaders += `<div class="text-xs text-slate-500 px-2 border-l border-slate-200 font-medium" style="width: ${daysInMonth * dayWidth}px">${monthName}</div>`;
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    }
    
    // Task type colors
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
        <!-- Zoom Controls -->
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
                <!-- Timeline Header -->
                <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                    <div class="w-48 flex-shrink-0 px-3 py-2 font-bold text-xs text-slate-500 uppercase border-r border-slate-200">Task</div>
                    <div class="flex-1 flex overflow-hidden">
                        ${timeHeaders}
                    </div>
                </div>
                
                <!-- Tasks -->
                ${tasks.map((t, i) => {
                    const start = t.start ? new Date(t.start) : minDate;
                    const end = t.end ? new Date(t.end) : start;
                    const startOffset = Math.max(0, Math.ceil((start - minDate) / (1000 * 60 * 60 * 24)));
                    const duration = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
                    
                    const barColor = typeColors[t.type] || 'bg-slate-400';
                    
                    return `
                        <div class="flex border-b border-slate-100 hover:bg-slate-50 group">
                            <div class="w-48 flex-shrink-0 px-3 py-3 border-r border-slate-100 flex items-center justify-between">
                                <div class="truncate text-sm text-slate-700 flex items-center gap-2">
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
        
        <!-- Legend -->
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

// Gantt zoom function
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
    
    // Populate dependency dropdown
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
// 10. FULL PROJECT VIEW - EXPANDED
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
            <!-- Header -->
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
                <!-- Executive Summary -->
                <section class="bg-slate-50 rounded-lg p-6 border-l-4 border-rcem-purple">
                    <h2 class="text-lg font-bold text-slate-800 mb-3">Executive Summary</h2>
                    <p class="text-slate-600 leading-relaxed">
                        ${c.aim ? `This project aimed to ${escapeHtml(c.aim.toLowerCase().replace(/^to /i, ''))}` : 'Aim not yet defined.'}
                        ${c.results_analysis ? ` Key findings: ${escapeHtml(c.results_analysis.substring(0, 200))}...` : ''}
                    </p>
                </section>
                
                <!-- Problem Statement -->
                ${c.problem_desc ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm">1</span>
                            Problem Statement
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.problem_desc)}</p>
                    </section>
                ` : ''}
                
                <!-- SMART Aim -->
                ${c.aim ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">2</span>
                            SMART Aim
                        </h2>
                        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <p class="text-indigo-900 font-medium italic text-lg">"${escapeHtml(c.aim)}"</p>
                        </div>
                    </section>
                ` : ''}
                
                <!-- Family of Measures -->
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
                
                <!-- Team -->
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
                
                <!-- Driver Diagram Summary -->
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
                
                <!-- PDSA Cycles -->
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
                
                <!-- Results Chart -->
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
                
                <!-- Literature Review -->
                ${c.lit_review ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">8</span>
                            Literature Review
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.lit_review)}</p>
                    </section>
                ` : ''}
                
                <!-- Ethics & Governance -->
                ${c.ethics ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">9</span>
                            Ethics & Governance
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.ethics)}</p>
                    </section>
                ` : ''}
                
                <!-- Leadership Engagement -->
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
                
                <!-- Learning Points -->
                ${c.learning_points ? `
                    <section>
                        <h2 class="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm">11</span>
                            Key Learning Points
                        </h2>
                        <p class="text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(c.learning_points)}</p>
                    </section>
                ` : ''}
                
                <!-- Sustainability -->
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
            
            <!-- Footer -->
            <footer class="bg-slate-50 px-8 py-4 rounded-b-xl border-t border-slate-200 print:bg-white">
                <div class="flex justify-between items-center text-xs text-slate-500">
                    <span>Generated by RCEM QIP Assistant</span>
                    <span>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
            </footer>
        </div>
    `;
    
    // Render the full view chart
    setTimeout(() => {
        if (window.renderFullViewChart) window.renderFullViewChart();
    }, 100);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 11. PUBLISH VIEW - MATCHING RCEM QIAT FORM
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
    const pdsa = d.pdsa || [];
    const team = d.teamMembers || [];
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    const logs = d.leadershipLogs || [];
    
    // Determine which QI Journey aspects apply
    const hasCreatingConditions = logs.length > 0 || team.length > 1;
    const hasUnderstandingSystems = d.fishbone?.categories?.some(cat => cat.causes?.length > 0) || drivers.primary.length > 0;
    const hasDevelopingAims = !!c.aim;
    const hasTestingChanges = pdsa.length > 0;
    const hasImplement = pdsa.some(p => p.status === 'complete' || p.act?.toLowerCase().includes('adopt'));
    const hasSpread = c.sustainability?.toLowerCase().includes('spread') || c.sustainability?.toLowerCase().includes('other');
    const hasLeadership = logs.length >= 3 || team.some(m => m.role?.toLowerCase().includes('lead'));
    const hasProjectManagement = d.gantt?.length > 0 || pdsa.length >= 2;
    const hasMeasurement = d.chartData?.length >= 10;
    
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <!-- Header matching RCEM QIAT form -->
            <div class="bg-gradient-to-r from-rcem-purple to-indigo-700 text-white p-6">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    <i data-lucide="clipboard-check" class="w-5 h-5"></i>
                    RCEM QIAT (2025) - EM Quality Improvement Assessment Tool
                </h2>
                <p class="text-indigo-200 text-sm mt-1">Auto-generated from your project data for risr/advance portfolio</p>
            </div>
            
            <div class="p-6 space-y-6">
                <!-- Action buttons -->
                <div class="flex justify-end gap-2">
                    <button onclick="window.copyReport('qiat')" class="bg-rcem-purple text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                        <i data-lucide="copy" class="w-4 h-4"></i> Copy All Text
                    </button>
                </div>
                
                <!-- Part A Header -->
                <div class="border-b border-slate-200 pb-4">
                    <h3 class="text-lg font-bold text-slate-800">Part A - Trainee Section</h3>
                    <p class="text-sm text-slate-500">Complete this form prior to ARCP</p>
                </div>
                
                <!-- Basic Info -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Stage of Training</label>
                        <div class="text-sm text-slate-800 font-medium">${team.length > 0 ? escapeHtml(team[0].grade || 'Not specified') : 'Not specified'}</div>
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
                
                <!-- Section 1: QI Personal Development Plan -->
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-blue-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">1. QI Personal Development Plan - Current Year</h4>
                    </div>
                    <div class="p-4">
                        <label class="block text-xs font-bold text-slate-500 uppercase mb-2">1.1 PDP Summary</label>
                        <div id="qiat-pdp" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[80px] whitespace-pre-line">
${c.aim ? `Primary objective: ${escapeHtml(c.aim)}

Specific goals:
• Complete a full QI project using the Model for Improvement methodology
• Develop skills in data collection and SPC chart interpretation
• Engage stakeholders and demonstrate leadership in driving change
• Document learning and reflect on the QI journey` : 'To be completed - define your SMART aim first.'}</div>
                    </div>
                </div>
                
                <!-- Section 2: QI Education -->
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-emerald-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">2. QI Education</h4>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">2.1 Involvement - Engagement with QI education over the past year</label>
                            <div id="qiat-education" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[80px] whitespace-pre-line">
• Completed this QIP project: "${escapeHtml(d.meta?.title || 'Untitled')}"
• Applied Model for Improvement methodology with ${pdsa.length} PDSA cycles
• Collected and analysed ${d.chartData?.length || 0} data points using SPC methods
• Engaged ${team.length} team members and ${d.stakeholders?.length || 0} stakeholders
${logs.length > 0 ? `• ${logs.length} documented leadership engagements` : ''}
${c.lit_review ? '• Conducted literature review of relevant evidence and guidelines' : ''}</div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">2.2 Learning - How has this developed your understanding of QI?</label>
                            <div id="qiat-learning" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[80px] whitespace-pre-line">
${c.learning_points ? escapeHtml(c.learning_points) : `Through this project I have developed understanding of:
• The Model for Improvement and PDSA methodology
• How to develop a SMART aim and family of measures
• Driver diagrams for identifying change ideas
• SPC charts for distinguishing common from special cause variation
• The importance of small tests of change before wider implementation
• Stakeholder engagement and managing resistance to change`}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Section 3: Project Involvement -->
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
                            <strong>Project Title:</strong> ${escapeHtml(d.meta?.title || 'Untitled')}
                            <br><strong>Role:</strong> ${team.length > 0 ? escapeHtml(team[0].role || 'Project Lead') : 'Project Lead'}
                            <br><strong>Duration:</strong> ${d.gantt?.length > 0 ? `${d.gantt[0].start} to ${d.gantt[d.gantt.length - 1].end}` : 'Ongoing'}
                        </div>
                    </div>
                </div>
                
                <!-- Section 4: Learning & Development -->
                <div class="border border-slate-200 rounded-lg overflow-hidden">
                    <div class="bg-purple-50 px-4 py-3 border-b border-slate-200">
                        <h4 class="font-bold text-slate-800">4. Learning & Development</h4>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">4.1 QI Journey - Aspects gained experience in this year</label>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                <div class="flex items-center gap-2 p-2 rounded ${hasCreatingConditions ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasCreatingConditions ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasCreatingConditions ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Creating Conditions</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasUnderstandingSystems ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasUnderstandingSystems ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasUnderstandingSystems ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Understanding Systems</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasDevelopingAims ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasDevelopingAims ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasDevelopingAims ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Developing Aims</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasTestingChanges ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasTestingChanges ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasTestingChanges ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Testing Changes</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasImplement ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasImplement ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasImplement ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Implement</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasSpread ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasSpread ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasSpread ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Spread</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasLeadership ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasLeadership ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasLeadership ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Leadership & Teams</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasProjectManagement ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasProjectManagement ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasProjectManagement ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Project Management</span>
                                </div>
                                <div class="flex items-center gap-2 p-2 rounded ${hasMeasurement ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                                    <input type="checkbox" ${hasMeasurement ? 'checked' : ''} disabled class="rounded">
                                    <span class="text-xs ${hasMeasurement ? 'text-emerald-800 font-medium' : 'text-slate-500'}">Measurement</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">4.2 Reflections and Learning</label>
                            <div id="qiat-reflections" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[100px] whitespace-pre-line">
${c.learning_points ? escapeHtml(c.learning_points) : 'Add your reflections on what went well, what didn\'t go well, and what you would do differently in future projects.'}</div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">4.3 Next Year's PDP</label>
                            <div id="qiat-next-pdp" class="bg-slate-50 p-3 rounded text-sm text-slate-700 min-h-[80px] whitespace-pre-line">
Plans for next year:
• Build on learning from this project to lead another QI initiative
• Develop coaching skills to support junior colleagues with their QI projects
• Attend QI methodology training (e.g., QSIR Practitioner)
• Present this project at regional/national meeting
• Contribute to departmental QI strategy and governance</div>
                        </div>
                    </div>
                </div>
                
                <!-- Curriculum Mapping Note -->
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h4 class="font-bold text-indigo-800 text-sm mb-2 flex items-center gap-2">
                        <i data-lucide="info" class="w-4 h-4"></i>
                        Curriculum Mapping
                    </h4>
                    <p class="text-sm text-indigo-700">
                        This project should be linked to <strong>SLO 11</strong> (Quality Improvement) in your risr/advance portfolio.
                        Ensure you select the appropriate Key Capabilities based on your stage of training.
                    </p>
                </div>
                
                <!-- Part B Note -->
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

function renderAbstractForm(d) {
    const c = d.checklist || {};
    const pdsa = d.pdsa || [];
    const wordLimit = 250;
    
    // Generate abstract text
    let abstract = `Background: ${c.problem_desc || '[Problem statement - describe the gap between current and desired state]'}\n\n`;
    abstract += `Aim: ${c.aim || '[SMART aim - To increase/decrease X from Y to Z by date]'}\n\n`;
    abstract += `Methods: We used the Model for Improvement with ${pdsa.length} PDSA cycles. `;
    abstract += `${d.chartData?.length || 0} data points were collected. `;
    abstract += `Outcome measure: ${c.outcome_measure || '[outcome measure]'}. `;
    abstract += `Process measure: ${c.process_measure || '[process measure]'}.\n\n`;
    abstract += `Results: ${c.results_analysis || '[Analysis showing pre/post intervention data, any special cause variation detected, percentage improvement achieved]'}\n\n`;
    abstract += `Conclusion: ${c.learning_points || '[Key learning points and implications for practice]'}`;
    
    const wordCount = abstract.split(/\s+/).filter(w => w.length > 0).length;
    
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
                <span class="text-sm text-slate-500">Word count: <span class="${wordCount > wordLimit ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}">${wordCount}</span>/${wordLimit}</span>
                ${wordCount > wordLimit ? '<span class="text-xs text-red-500">⚠️ Over limit - please edit</span>' : '<span class="text-xs text-emerald-500">✓ Within limit</span>'}
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <div class="bg-slate-50 p-3 rounded border border-slate-200 font-bold">${escapeHtml(d.meta?.title || 'Untitled QIP')}</div>
            </div>
            
            <div id="abstract-content" class="bg-slate-50 p-6 rounded-lg border border-slate-200 font-serif text-sm leading-relaxed whitespace-pre-wrap">
${escapeHtml(abstract)}</div>
            
            <div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-bold text-blue-800 text-sm mb-2">Abstract Structure Guidelines</h4>
                <ul class="text-sm text-blue-700 space-y-1">
                    <li>• <strong>Background:</strong> Why is this important? What's the problem?</li>
                    <li>• <strong>Aim:</strong> SMART aim statement</li>
                    <li>• <strong>Methods:</strong> QI methodology used, measures, PDSA cycles</li>
                    <li>• <strong>Results:</strong> Data showing change, statistical findings</li>
                    <li>• <strong>Conclusion:</strong> Key learning, sustainability, spread potential</li>
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
                    <h2 class="text-xl font-bold text-slate-800">FRCEM Report Format</h2>
                    <p class="text-slate-500 text-sm">Structured format for FRCEM QIP submission</p>
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
        // Collect all the QIAT form text
        const sections = ['qiat-pdp', 'qiat-education', 'qiat-learning', 'qiat-reflections', 'qiat-next-pdp'];
        content = sections.map(id => {
            const el = document.getElementById(id);
            return el ? el.innerText : '';
        }).join('\n\n---\n\n');
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
                { element: '#nav-publish', popover: { title: 'Publish', description: 'Generate QIAT forms, abstracts and reports for your portfolio.' }}
            ]
        });
        driverObj.drive();
    } catch (e) {
        console.error("Tour error:", e);
        showToast("Could not start tour", "error");
    }
}
