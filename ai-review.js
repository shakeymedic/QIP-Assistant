// ai-review.js — AI Review Centre
// Full project assessment using Google Gemini, covering all 10 QIP domains

import { state } from "./state.js";
import { callAI } from "./ai.js";
import { showToast } from "./utils.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setProgress(pct, text) {
    const bar  = document.getElementById('aireview-progress-bar');
    const txt  = document.getElementById('aireview-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text;
}

function scoreColour(score) {
    if (score >= 80) return { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-500', text: 'text-emerald-700' };
    if (score >= 60) return { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-500',   text: 'text-amber-700' };
    return                   { bg: 'bg-red-50',    border: 'border-red-200',     badge: 'bg-red-500',     text: 'text-red-700' };
}

function domainCard(domain) {
    const c = scoreColour(domain.score);
    const icon = {
        problem:        'alert-circle',
        aim:            'target',
        methodology:    'git-branch',
        evidence:       'book-open',
        pdsa:           'refresh-cw',
        data:           'bar-chart-2',
        team:           'users',
        sustainability: 'trending-up',
        dissemination:  'megaphone',
        qiat:           'clipboard-check',
    }[domain.key] || 'check-circle';

    const strengths = (domain.strengths || []).map(s =>
        `<li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5 flex-shrink-0">✓</span><span>${s}</span></li>`
    ).join('');
    const gaps = (domain.gaps || []).map(g =>
        `<li class="flex items-start gap-1.5"><span class="text-amber-500 mt-0.5 flex-shrink-0">→</span><span>${g}</span></li>`
    ).join('');

    return `
    <div class="${c.bg} border ${c.border} rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <i data-lucide="${icon}" class="w-4 h-4 ${c.text}"></i>
                <span class="font-bold text-slate-800 text-sm">${domain.label}</span>
            </div>
            <span class="${c.badge} text-white text-xs font-bold px-2.5 py-1 rounded-full">${domain.score}/100</span>
        </div>
        <p class="text-slate-600 text-xs mb-3 leading-relaxed">${domain.summary}</p>
        ${strengths ? `<ul class="text-xs space-y-1 mb-2">${strengths}</ul>` : ''}
        ${gaps      ? `<ul class="text-xs space-y-1">${gaps}</ul>` : ''}
    </div>`;
}

// ─── Build full project context string ────────────────────────────────────────

function buildProjectContext() {
    const d  = state.projectData || {};
    const cl = d.checklist || {};
    const pdsa   = d.pdsa || [];
    const team   = d.teamMembers || [];
    const logs   = d.leadershipLogs || [];
    const data   = d.chartData || [];
    const fmea   = d.fmea || [];
    const surveys = d.surveys || [];
    const changeIdeas = d.changeIdeas || [];

    return `
PROJECT TITLE: ${d.meta?.title || 'Untitled'}
TRAINING STAGE: ${d.meta?.trainingStage || 'Not set'}

PROBLEM STATEMENT:
${cl.problem_desc || 'Not completed'}

DEPARTMENT CONTEXT:
${cl.problem_context || cl.dept_context || 'Not completed'}

BASELINE EVIDENCE:
${cl.problem_evidence || 'Not completed'}

SMART AIM:
${cl.aim || 'Not completed'}

FAMILY OF MEASURES:
- Outcome: ${cl.outcome_measure || 'Not defined'}
- Process: ${cl.process_measure || 'Not defined'}
- Balancing: ${cl.balance_measure || 'Not defined'}

ETHICS & GOVERNANCE:
${cl.ethics || 'Not completed'}

LITERATURE REVIEW:
${cl.lit_review || 'Not completed'}

DRIVER DIAGRAM AIM:
${d.driverDiagram?.aim || 'Not set'}

PRIMARY DRIVERS: ${d.driverDiagram?.primaryDrivers?.map(p => p.text).join('; ') || 'None'}
SECONDARY DRIVERS: ${d.driverDiagram?.primaryDrivers?.flatMap(p => p.secondaryDrivers || []).map(s => s.text).join('; ') || 'None'}

5 WHYS ROOT CAUSE:
${d.fivewhys?.rootCause || 'Not completed'}

FISHBONE CATEGORIES: ${Object.keys(d.fishbone || {}).join(', ') || 'Not completed'}

PDSA CYCLES (${pdsa.length} total):
${pdsa.map((p, i) => `
  Cycle ${i+1}: ${p.title}
  Status: ${p.status}
  Plan: ${(p.plan || '').substring(0, 200)}
  Study: ${(p.study || '').substring(0, 150)}
  Act: ${(p.act || '').substring(0, 150)}
`).join('') || 'None documented'}

CHANGE IDEAS (${changeIdeas.length} total):
${changeIdeas.map(ci => `  ${ci.title} — ${ci.pdsaCycles?.length || 0} cycles`).join('\n') || 'None'}

DATA POINTS: ${data.length} collected
${data.length > 0 ? `Date range: ${data[0]?.date} to ${data[data.length-1]?.date}` : 'No data'}
${data.length > 0 ? `Values: ${data.map(p => p.value).join(', ')}` : ''}

KNOWLEDGE ASSESSMENT DATA:
${cl.results_text ? cl.results_text.substring(0, 600) : 'Not completed'}

RESULTS & ANALYSIS:
${cl.results_analysis || 'Not completed'}

TEAM MEMBERS (${team.length}):
${team.map(t => `  ${t.name} — ${t.role} (${t.grade})`).join('\n') || 'None'}

LEADERSHIP ENGAGEMENT LOG (${logs.length} entries):
${logs.slice(-5).map(l => `  ${l.date}: ${l.note.substring(0, 100)}`).join('\n') || 'None'}

FMEA (${fmea.length} rows):
${fmea.map(f => `  ${f.step}: L=${f.likelihood} S=${f.severity} D=${f.detectability} RPN=${f.likelihood*f.severity*f.detectability}`).join('\n') || 'None'}

SURVEYS (${surveys.length}):
${surveys.map(s => `  ${s.name}: ${s.responses?.length || 0} responses`).join('\n') || 'None'}

KEY LEARNING POINTS:
${cl.learning_points || 'Not completed'}

SUSTAINABILITY PLAN:
${cl.sustainability || 'Not completed'}

STAKEHOLDERS: ${(d.stakeholders || []).length} mapped
GANTT TASKS: ${(d.gantt || []).length} tasks
`;
}

// ─── Full assessment ──────────────────────────────────────────────────────────

export async function runFullAIAssessment() {
    if (!state.projectData) { showToast('Open a project first', 'error'); return; }
    const key = state.aiKey || localStorage.getItem('rcem_qip_ai_key');
    if (!key) {
        document.getElementById('aireview-nokey')?.classList.remove('hidden');
        return;
    }
    document.getElementById('aireview-nokey')?.classList.add('hidden');

    // Show progress, hide results
    document.getElementById('aireview-progress')?.classList.remove('hidden');
    document.getElementById('aireview-results')?.classList.add('hidden');
    document.getElementById('btn-run-ai-review').disabled = true;

    const ctx = buildProjectContext();

    const schema = {
        type: "OBJECT",
        properties: {
            overallScore: { type: "NUMBER" },
            qiatLevel: { type: "STRING" },
            executiveSummary: { type: "STRING" },
            topThreeActions: { type: "ARRAY", items: { type: "STRING" } },
            domains: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        key: { type: "STRING" },
                        label: { type: "STRING" },
                        score: { type: "NUMBER" },
                        summary: { type: "STRING" },
                        strengths: { type: "ARRAY", items: { type: "STRING" } },
                        gaps: { type: "ARRAY", items: { type: "STRING" } },
                        recommendation: { type: "STRING" }
                    }
                }
            },
            pdsaDeepDive: { type: "STRING" },
            dataDeepDive: { type: "STRING" },
            qiatMapping: { type: "STRING" }
        }
    };

    const prompt = `
You are an RCEM examiner panel reviewing an ST6 Emergency Medicine QIP for ARCP submission. 
Provide a rigorous, honest, examiner-level assessment.

PROJECT DATA:
${ctx}

TASK: Assess this QIP across ALL 10 domains. For each domain, provide:
- A score out of 100
- 1-2 specific strengths (concrete, referencing actual project content)
- 1-2 specific gaps or risks (concrete, actionable)
- One priority recommendation

THE 10 DOMAINS TO ASSESS:
1. problem (Problem Identification & Baseline Measurement)
2. aim (SMART Aim Quality)
3. methodology (QI Methodology — driver diagram, fishbone, 5 whys, FMEA, process map)
4. evidence (Evidence Base & Literature Review)
5. pdsa (PDSA Cycle Quality & Iterative Learning)
6. data (Data Collection & Analysis)
7. team (Team, Stakeholder Engagement & Leadership)
8. sustainability (Sustainability & Spread Plan)
9. dissemination (Dissemination & Sharing)
10. qiat (RCEM QIAT 2025 Readiness — specifically for Higher Trainee ST6 level)

Also provide:
- overallScore: weighted average out of 100
- qiatLevel: one of "Core", "Intermediate", "Higher — Partial", "Higher — Full"
- executiveSummary: 3-4 sentence honest summary of the project's current state
- topThreeActions: the 3 highest-priority actions to improve ARCP readiness (specific, not generic)
- pdsaDeepDive: 150-word detailed analysis of the PDSA cycles — quality of iterative learning, spread logic, completeness
- dataDeepDive: 150-word analysis of the data — adequacy, statistical approach, signal detection, what's missing
- qiatMapping: 200-word specific mapping of this project against the RCEM QIAT 2025 Higher Trainee criteria

Be direct. Reference actual content from the project data. Do not be generic.
British English throughout.
`;

    setProgress(10, 'Sending project to Gemini...');

    try {
        setProgress(30, 'Analysing all 10 domains...');
        const result = await callAI(prompt, true, schema);
        setProgress(80, 'Rendering report...');

        if (!result) throw new Error('No response from AI');

        renderFullAssessmentResults(result);
        setProgress(100, 'Complete');

        setTimeout(() => {
            document.getElementById('aireview-progress')?.classList.add('hidden');
        }, 500);

    } catch(e) {
        document.getElementById('aireview-progress')?.classList.add('hidden');
        showToast('AI assessment failed: ' + e.message, 'error');
    } finally {
        document.getElementById('btn-run-ai-review').disabled = false;
    }
}

function renderFullAssessmentResults(result) {
    const resultsEl = document.getElementById('aireview-results');
    if (!resultsEl) return;

    // Overall score
    const scoreEl = document.getElementById('aireview-overall-score');
    if (scoreEl) {
        const c = scoreColour(result.overallScore || 0);
        scoreEl.textContent = (result.overallScore || 0) + '/100';
        scoreEl.className = `text-3xl font-black ${c.text}`;
    }

    // Summary
    const sumEl = document.getElementById('aireview-summary');
    if (sumEl) {
        sumEl.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <span class="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full">QIAT Level: ${result.qiatLevel || '—'}</span>
            </div>
            <p class="text-slate-600 text-sm leading-relaxed">${result.executiveSummary || ''}</p>
        `;
    }

    // Top actions
    const actionsEl = document.getElementById('aireview-top-actions');
    if (actionsEl && result.topThreeActions?.length) {
        actionsEl.innerHTML = `
            <p class="font-semibold text-slate-700 text-sm mb-2">Priority Actions for ARCP Readiness:</p>
            <ol class="space-y-2">
                ${result.topThreeActions.map((a, i) => `
                    <li class="flex items-start gap-2">
                        <span class="bg-purple-600 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">${i+1}</span>
                        <span class="text-slate-700 text-sm">${a}</span>
                    </li>
                `).join('')}
            </ol>
        `;
    }

    // Domain cards
    const domainsEl = document.getElementById('aireview-domains');
    if (domainsEl && result.domains?.length) {
        domainsEl.innerHTML = result.domains.map(d => domainCard(d)).join('');
    }

    // Deep dives
    const deepdivesEl = document.getElementById('aireview-deepdives');
    if (deepdivesEl) {
        deepdivesEl.innerHTML = [
            { title: 'PDSA Cycle Deep Dive', icon: 'refresh-cw', content: result.pdsaDeepDive },
            { title: 'Data & Analysis Deep Dive', icon: 'bar-chart-2', content: result.dataDeepDive },
            { title: 'RCEM QIAT 2025 Mapping', icon: 'clipboard-check', content: result.qiatMapping },
        ].filter(d => d.content).map(d => `
            <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h4 class="font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <i data-lucide="${d.icon}" class="w-4 h-4 text-purple-500"></i>
                    ${d.title}
                </h4>
                <p class="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">${d.content}</p>
            </div>
        `).join('');
    }

    resultsEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Individual section AI (quick actions) ────────────────────────────────────

export async function runSectionAI(section) {
    const key = state.aiKey || localStorage.getItem('rcem_qip_ai_key');
    if (!key) {
        document.getElementById('aireview-nokey')?.classList.remove('hidden');
        return;
    }

    const d = state.projectData || {};
    const cl = d.checklist || {};

    const configs = {
        aim: {
            title: 'SMART Aim Assessment',
            prompt: `You are an RCEM QIP examiner. Critically assess this SMART Aim for an ST6 Emergency Medicine QIP.

Aim: "${cl.aim || 'Not set'}"
Problem: "${cl.problem_desc || 'Not set'}"

Score each SMART criterion (0-10). Identify the single biggest weakness. Provide a rewritten aim that scores 10/10.
Format your response with clear sections: Scoring, Main Issue, Rewritten Aim, Rationale.`
        },
        pdsa: {
            title: 'PDSA Cycle Review',
            prompt: `You are an RCEM QIP examiner. Review the PDSA cycles for this ST6 QIP.

Cycles:
${(d.pdsa || []).map((p,i) => `Cycle ${i+1}: ${p.title}\nPlan: ${(p.plan||'').substring(0,300)}\nStudy: ${(p.study||'').substring(0,200)}\nAct: ${(p.act||'').substring(0,200)}`).join('\n---\n')}

Change Ideas: ${(d.changeIdeas||[]).map(ci => ci.title).join('; ')}

Assess: (1) Quality of iterative learning — does each cycle inform the next? (2) Are Act decisions (Adopt/Adapt/Abandon) clear and justified? (3) Dual-arm design coherence. (4) What is the ideal next PDSA cycle? Be specific about this project's content.`
        },
        evidence: {
            title: 'Evidence & Literature Review',
            prompt: `You are an RCEM QIP examiner. Review the literature review and evidence base for this ST6 QIP.

Topic: "${cl.problem_desc || ''}"
Literature Review: "${cl.lit_review || 'Not completed'}"

Assess: (1) Is the evidence base adequate for an ST6 submission? (2) Are there obvious missing primary sources? (3) Does the literature directly support the intervention chosen? (4) Name 2-3 specific papers or guidelines that should be cited if not already present. Be specific to emergency medicine and the HALO procedures topic.`
        },
        sustainability: {
            title: 'Sustainability Plan Review',
            prompt: `You are an RCEM QIP examiner. Review the sustainability and spread plan for this ST6 QIP.

Sustainability Plan: "${cl.sustainability || 'Not completed'}"
Spread (GHH): ${(d.pdsa||[]).find(p => p.title?.includes('GHH') || p.title?.includes('Cross-Site'))?.act || 'None documented'}

Assess: (1) Is the sustainability plan credible and specific? (2) Is cross-site spread (GHH) adequately structured with its own process measure? (3) What are the 2 biggest sustainability risks? (4) What would an examiner specifically probe on this section?`
        },
        team: {
            title: 'Team & Leadership Review',
            prompt: `You are an RCEM QIP examiner. Review the team composition, stakeholder engagement and leadership evidence for this ST6 QIP.

Team Members: ${(d.teamMembers||[]).map(t => `${t.name} (${t.role}, ${t.grade})`).join('; ')}
Leadership Log entries: ${(d.leadershipLogs||[]).length}
Recent log entries:
${(d.leadershipLogs||[]).slice(-4).map(l => `${l.date}: ${l.note.substring(0,120)}`).join('\n')}

Assess: (1) Is the MDT composition appropriate for ST6? (2) Is there evidence of genuine leadership vs just participation? (3) Is stakeholder engagement systematic? (4) What would an examiner challenge on this section?`
        },
        qiat: {
            title: 'RCEM QIAT 2025 Readiness Check',
            prompt: `You are an RCEM QIAT 2025 examiner. Map this ST6 QIP against the Higher Trainee QIAT criteria.

Project data:
Problem: "${cl.problem_desc?.substring(0,300)}"
Aim: "${cl.aim?.substring(0,300)}"
PDSA count: ${(d.pdsa||[]).length}
Data points: ${(d.chartData||[]).length}
Team size: ${(d.teamMembers||[]).length}
Learning points: "${cl.learning_points?.substring(0,300)}"
Sustainability: "${cl.sustainability?.substring(0,200)}"
Spread: GHH deployment confirmed

For EACH of the RCEM QIAT Higher Trainee criteria, state: MET / PARTIALLY MET / NOT MET, with a one-line justification. End with an overall verdict: what is the single most important action to reach the Higher Trainee standard?`
        }
    };

    const config = configs[section];
    if (!config) return;

    const outputEl = document.getElementById('aireview-section-output');
    const titleEl  = document.getElementById('aireview-section-title');
    const contentEl = document.getElementById('aireview-section-content');
    if (!outputEl || !titleEl || !contentEl) return;

    titleEl.textContent = config.title;
    contentEl.textContent = 'Asking Gemini...';
    outputEl.classList.remove('hidden');
    outputEl.scrollIntoView({ behavior: 'smooth' });

    const result = await callAI(config.prompt);
    if (result) {
        contentEl.textContent = result;
    } else {
        contentEl.textContent = 'No response received. Check your API key in Settings.';
    }
}

// ─── Expose to window ─────────────────────────────────────────────────────────
window.runFullAIAssessment = runFullAIAssessment;
window.runSectionAI = runSectionAI;
