// learn.js
// ─── QI Learning Hub — Full View Renderer ─────────────────────────────────────
// Tabs: RCEM Requirements | National QIPs | QI Methods | QI Tools |
//       FRCEM Guide | Resources | Glossary

let learnActiveTab = 'rcem';

export function renderLearn() {
    const container = document.getElementById('view-learn');
    if (!container) return;

    const tabs = [
        ['rcem',      'award',       'RCEM Requirements'],
        ['national',  'building-2',  'National QIPs'],
        ['methods',   'flask-conical','QI Methods'],
        ['tools',     'wrench',      'QI Tools'],
        ['frcem',     'file-text',   'FRCEM Guide'],
        ['resources', 'book-open',   'Resources'],
        ['glossary',  'book-marked', 'Glossary']
    ];

    const tabBtns = tabs.map(function(t) {
        var id = t[0]; var icon = t[1]; var label = t[2];
        var active = (id === learnActiveTab);
        return '<button onclick="window.setLearnTab(\'' + id + '\')" id="learn-tab-' + id + '" ' +
            'class="learn-tab flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ' +
            (active ? 'bg-white text-rcem-purple shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60') + '">' +
            '<i data-lucide="' + icon + '" class="w-3.5 h-3.5"></i>' + label +
            '</button>';
    }).join('');

    container.innerHTML =
        '<div class="max-w-5xl mx-auto px-4 py-6">' +

        // Header
        '<div class="bg-gradient-to-r from-rcem-purple to-indigo-600 rounded-2xl p-6 mb-6 text-white">' +
        '<div class="flex items-start gap-4">' +
        '<div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">' +
        '<i data-lucide="graduation-cap" class="w-7 h-7"></i></div>' +
        '<div>' +
        '<h1 class="text-2xl font-bold">QI Learning Hub</h1>' +
        '<p class="text-indigo-200 text-sm mt-1">Everything you need to plan, execute, and present a QIP that meets RCEM standards — ' +
        'framework, methodology, tools, FRCEM marking criteria, and curated resources in one place.</p>' +
        '</div></div></div>' +

        // Tab bar
        '<div class="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto scrollbar-thin">' +
        tabBtns + '</div>' +

        // Tab content
        '<div id="learn-tab-content">' + renderLearnTabContent(learnActiveTab) + '</div>' +

        '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.setLearnTab = function(tabId) {
    learnActiveTab = tabId;
    document.querySelectorAll('.learn-tab').forEach(function(btn) {
        var active = btn.id === ('learn-tab-' + tabId);
        btn.className = 'learn-tab flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ' +
            (active ? 'bg-white text-rcem-purple shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60');
    });
    var content = document.getElementById('learn-tab-content');
    if (content) {
        content.innerHTML = renderLearnTabContent(tabId);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

function renderLearnTabContent(tab) {
    switch (tab) {
        case 'rcem':      return tabRCEM();
        case 'national':  return tabNational();
        case 'methods':   return tabMethods();
        case 'tools':     return tabTools();
        case 'frcem':     return tabFRCEM();
        case 'resources': return tabResources();
        case 'glossary':  return tabGlossary();
        default:          return tabRCEM();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHead(icon, label, color) {
    color = color || 'rcem-purple';
    return '<h3 class="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">' +
        '<i data-lucide="' + icon + '" class="w-4 h-4 text-' + color + '"></i>' + label + '</h3>';
}

function card(content, extra) {
    return '<div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm ' + (extra || '') + '">' + content + '</div>';
}

function infoBox(color, content) {
    return '<div class="bg-' + color + '-50 border border-' + color + '-200 rounded-xl p-4">' + content + '</div>';
}

function resLink(url, iconColor, title, desc, badge) {
    var badgeHtml = badge ? ('<span class="text-xs font-semibold text-' + iconColor + '-700 bg-' + iconColor + '-100 px-2 py-0.5 rounded-full">' + badge + '</span>') : '';
    return '<a href="' + url + '" target="_blank" rel="noopener" ' +
        'class="flex items-start gap-3 p-4 bg-' + iconColor + '-50 rounded-xl border border-' + iconColor + '-100 ' +
        'hover:border-' + iconColor + '-300 hover:shadow-sm transition-all group">' +
        '<div class="w-9 h-9 bg-' + iconColor + '-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">' +
        '<i data-lucide="external-link" class="w-4 h-4 text-white"></i></div>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-start justify-between gap-2">' +
        '<div class="font-bold text-sm text-slate-800 group-hover:text-' + iconColor + '-700 leading-tight">' + title + '</div>' +
        badgeHtml + '</div>' +
        '<div class="text-xs text-slate-500 mt-1 leading-relaxed">' + desc + '</div>' +
        '</div></a>';
}

function termCard(name, def) {
    return '<div class="bg-slate-50 rounded-lg p-3.5 border border-slate-100">' +
        '<div class="font-bold text-xs text-slate-700 mb-1">' + name + '</div>' +
        '<p class="text-xs text-slate-500 leading-relaxed">' + def + '</p></div>';
}

function stepBox(num, color, title, body) {
    return '<div class="flex gap-3">' +
        '<div class="w-8 h-8 bg-' + color + '-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">' + num + '</div>' +
        '<div class="flex-1 pb-4 border-b border-slate-100 last:border-0">' +
        '<div class="font-bold text-sm text-slate-800">' + title + '</div>' +
        '<p class="text-xs text-slate-500 mt-0.5 leading-relaxed">' + body + '</p>' +
        '</div></div>';
}

// ─── Tab 1: RCEM Requirements ─────────────────────────────────────────────────

function tabRCEM() {
    var stages =
        '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">' +

        // ACCS
        '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">ACCS ST1–2</span></div>' +
        '<ul class="text-xs text-blue-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Contribute to a departmental QI project or clinical audit</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Understand QI principles and common methods</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Recognise and report patient safety incidents</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Reflect on learning from errors and near-misses</li>' +
        '</ul></div>' +

        // Intermediate
        '<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">Intermediate ST3</span></div>' +
        '<ul class="text-xs text-indigo-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Apply QI methodology to a clinical problem</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Collect, analyse, and interpret project data</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Execute at least <strong>2 PDSA cycles</strong> and evaluate impact</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Engage stakeholders in change</li>' +
        '</ul></div>' +

        // HST
        '<div class="bg-purple-50 border border-purple-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">HST ST4–6</span></div>' +
        '<ul class="text-xs text-purple-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span>Lead a QIP from initiation to write-up</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span>Demonstrate safety culture leadership</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span><strong>Satisfactory:</strong> lead; ≥2 PDSA cycles; data analysis</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span><strong>Excellent (ST6):</strong> ≥3 iterative PDSA cycles; run/SPC charts; interdisciplinary team; sustained improvement</li>' +
        '</ul></div>' +

        '</div>';

    var slo11 =
        card(
            sectionHead('award', 'SLO 11 — Quality Improvement & Patient Safety', 'rcem-purple') +
            '<p class="text-sm text-slate-600 mb-4 leading-relaxed">SLO 11 is one of 12 Specialty Learning Outcomes in the <strong>RCEM 2021 Curriculum (updated August 2025, v1.5)</strong>. ' +
            'It requires trainees to demonstrate participation in and promotion of activity to improve the quality and safety of patient care. ' +
            'The <strong>QIAT (Quality Improvement Assessment Tool)</strong> was updated November 2025 to align with current AOMRC guidance and is now live on eportfolio.</p>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
            infoBox('emerald',
                '<div class="font-bold text-sm text-emerald-800 mb-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i>Key Capabilities (HST)</div>' +
                '<ul class="text-xs text-emerald-700 space-y-1">' +
                '<li>• Drive a culture of safety, openness, and learning from error</li>' +
                '<li>• Critically appraise and apply QI methodology</li>' +
                '<li>• Lead multidisciplinary QI projects with measurable impact</li>' +
                '<li>• Apply clinical governance, audit, and patient safety frameworks</li>' +
                '<li>• Sustain improvements beyond the initial project cycle</li>' +
                '<li>• Present findings at departmental or regional level</li>' +
                '</ul>'
            ) +
            infoBox('amber',
                '<div class="font-bold text-sm text-amber-800 mb-2 flex items-center gap-2"><i data-lucide="clipboard-list" class="w-4 h-4"></i>EM-QIAT on ePortfolio</div>' +
                '<ul class="text-xs text-amber-700 space-y-1">' +
                '<li>• Completed for each QI phase in the QIAT framework</li>' +
                '<li>• Replaces the old QIP assessment form</li>' +
                '<li>• Supervisor sign-off required at each stage</li>' +
                '<li>• Covers: Problem Identification, Evidence Base, Team & Stakeholders, Planning, Implementation, Evaluation</li>' +
                '<li>• Use the EM-QIAT Journal in this app to draft entries</li>' +
                '</ul>'
            ) +
            '</div>',
            'mb-6'
        );

    var arcp =
        card(
            sectionHead('layers', 'ARCP Requirements by Stage', 'blue') +
            '<div class="overflow-x-auto">' +
            '<table class="w-full text-xs border-collapse">' +
            '<thead><tr class="bg-slate-50">' +
            '<th class="text-left p-2.5 border border-slate-200 font-bold text-slate-700">Stage</th>' +
            '<th class="text-left p-2.5 border border-slate-200 font-bold text-slate-700">Minimum Evidence</th>' +
            '<th class="text-left p-2.5 border border-slate-200 font-bold text-emerald-700">For Excellent</th>' +
            '</tr></thead><tbody>' +
            '<tr><td class="p-2.5 border border-slate-200 font-medium">ACCS (ST1–2)</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Contribution to departmental project; reflection; QIAT submitted</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Active role with documented impact; patient safety reflection</td></tr>' +
            '<tr class="bg-slate-50"><td class="p-2.5 border border-slate-200 font-medium">Intermediate (ST3)</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Independent QIP; 2 PDSA cycles; data collected and analysed; QIAT signed off</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Run chart; stakeholder engagement; written report or presentation</td></tr>' +
            '<tr><td class="p-2.5 border border-slate-200 font-medium">HST (ST4–5)</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Lead a QIP; ≥2 PDSA cycles; demonstrate change in practice</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Interdisciplinary team; SPC charts; governance involvement; spread plan</td></tr>' +
            '<tr class="bg-slate-50"><td class="p-2.5 border border-slate-200 font-medium">ST6 (pre-CCT)</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Complete QIP write-up submitted for FRCEM assessment; ≥2 PDSA; QIAT completed</td>' +
            '<td class="p-2.5 border border-slate-200 text-emerald-700"><strong>≥3 iterative PDSA cycles; annotated run/SPC charts; sustainability plan; dissemination</strong></td></tr>' +
            '</tbody></table></div>',
            'mb-6'
        );

    return '<div class="space-y-6">' +
        card(sectionHead('layers', 'What is Expected at Each Stage?', 'blue') + stages) +
        slo11 + arcp +
        infoBox('indigo',
            '<div class="flex items-start gap-3">' +
            '<i data-lucide="info" class="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5"></i>' +
            '<div><p class="text-sm text-indigo-800 font-semibold">2025 Curriculum Update</p>' +
            '<p class="text-xs text-indigo-700 mt-1 leading-relaxed">The RCEM curriculum was updated in August 2025 (v1.5, effective 6 August 2025). ' +
            'Key changes for SLO11: the QIAT form now replaces the older QIP assessment tool, two new Key Capabilities were added addressing leadership culture and emotional intelligence, ' +
            'and evidence options have been broadened to be less prescriptive. ' +
            'The underlying clinical syllabus and training structure remain unchanged. ' +
            'Always verify current requirements at <strong>rcem.ac.uk/em-curriculum</strong>.</p>' +
            '</div></div>'
        ) +
        '</div>';
}

// ─── Tab 2: National QIPs ─────────────────────────────────────────────────────

function tabNational() {
    var topics2026 =
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">' +

        '<div class="bg-teal-50 border border-teal-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="users" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-teal-800">Care of Older People in the ED</div>' +
        '<p class="text-xs text-teal-700 mt-1.5 leading-relaxed">Improving assessment, management, and experience for older patients presenting to the emergency department.</p>' +
        '</div>' +

        '<div class="bg-rose-50 border border-rose-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-rose-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="heart" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-rose-800">Adolescent Mental Health</div>' +
        '<p class="text-xs text-rose-700 mt-1.5 leading-relaxed">Enhancing pathways, safety assessments, and outcomes for adolescents presenting with mental health crises.</p>' +
        '</div>' +

        '<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-amber-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="pill" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-amber-800">Time Critical Medications</div>' +
        '<p class="text-xs text-amber-700 mt-1.5 leading-relaxed">Ensuring timely administration of medications where delay has significant patient safety implications.</p>' +
        '</div>' +

        '</div>';

    var dates =
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">' +
        infoBox('blue',
            '<div class="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i>Key Dates — 2026 Cycle</div>' +
            '<table class="w-full text-xs"><tbody>' +
            '<tr><td class="py-1 pr-3 font-semibold text-blue-700 whitespace-nowrap">Inclusion period</td><td class="py-1 text-blue-800">1 January 2026 – 31 December 2026</td></tr>' +
            '<tr><td class="py-1 pr-3 font-semibold text-blue-700 whitespace-nowrap">Data entry opens</td><td class="py-1 text-blue-800">31 January 2026</td></tr>' +
            '<tr><td class="py-1 pr-3 font-semibold text-blue-700 whitespace-nowrap">Data entry closes</td><td class="py-1 text-blue-800">31 January 2027</td></tr>' +
            '<tr><td class="py-1 pr-3 font-semibold text-blue-700 whitespace-nowrap">Registration</td><td class="py-1 text-blue-800">Open — register at rcem.ac.uk/quality-improvement</td></tr>' +
            '</tbody></table>'
        ) +
        infoBox('slate',
            '<div class="font-bold text-sm text-slate-800 mb-2 flex items-center gap-2"><i data-lucide="mail" class="w-4 h-4"></i>Contact & Registration</div>' +
            '<p class="text-xs text-slate-600 mb-2">All UK Type 1 Emergency Departments can register. Each ED submits one form and selects its chosen QIPs.</p>' +
            '<div class="text-xs text-slate-700"><strong>Email:</strong> rcemqip@rcem.ac.uk</div>' +
            '<a href="https://rcem.ac.uk/quality-improvement/" target="_blank" rel="noopener" ' +
            'class="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-rcem-purple hover:underline">' +
            '<i data-lucide="external-link" class="w-3 h-3"></i>Register at rcem.ac.uk/quality-improvement</a>'
        ) +
        '</div>';

    var diff = card(
        sectionHead('shuffle', 'How National QIPs Differ from Trainee QIPs', 'indigo') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div>' +
        '<div class="font-semibold text-sm text-indigo-700 mb-2">RCEM National QIP</div>' +
        '<ul class="text-xs text-slate-600 space-y-1.5">' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Set topic determined by RCEM each year</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Standardised data collection tool used nationally</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Results benchmarked against other EDs</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Primarily a departmental activity</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Good for portfolio evidence of participation</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500">•</span>Does NOT replace your individual trainee QIP</li>' +
        '</ul>' +
        '</div>' +
        '<div>' +
        '<div class="font-semibold text-sm text-purple-700 mb-2">Individual Trainee QIP</div>' +
        '<ul class="text-xs text-slate-600 space-y-1.5">' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>Your own identified clinical problem</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>You design the data collection and analysis</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>Demonstrates personal leadership and QI skills</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>Required for FRCEM assessment (ST6)</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>Must show iterative PDSA cycles</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500">•</span>Written up as 3,000–4,000 word report</li>' +
        '</ul>' +
        '</div></div>' +
        infoBox('green',
            '<p class="text-xs text-green-800"><strong>Tip:</strong> Participating in a national QIP can form the <em>foundation</em> of your individual trainee project. ' +
            'Use the national data collection as your baseline audit, then apply your own PDSA cycles to make local improvements around that topic. ' +
            'This gives you national benchmarking AND individual project ownership.</p>'
        ),
        'mt-4'
    );

    return '<div class="space-y-6">' +
        card(
            '<div class="flex items-start justify-between gap-4 mb-4">' +
            '<div>' + sectionHead('building-2', 'RCEM National Quality Improvement Programmes 2026', 'teal') + '</div>' +
            '<a href="https://rcem.ac.uk/quality-improvement/" target="_blank" rel="noopener" ' +
            'class="flex-shrink-0 text-xs font-semibold text-teal-600 hover:underline flex items-center gap-1">' +
            '<i data-lucide="external-link" class="w-3 h-3"></i>RCEM QIP site</a></div>' +
            '<p class="text-sm text-slate-600 mb-4 leading-relaxed">RCEM runs three national QIP topics each year. ' +
            'All Type 1 EDs in the UK are eligible and encouraged to participate. Each cycle runs for one calendar year with standardised data collection.</p>' +
            topics2026 + dates
        ) + diff + '</div>';
}

// ─── Tab 3: QI Methods ────────────────────────────────────────────────────────

function tabMethods() {
    var mfi = card(
        sectionHead('target', 'The Model for Improvement', 'blue') +
        '<p class="text-sm text-slate-600 mb-4 leading-relaxed">Developed by Associates in Process Improvement and adopted widely in healthcare, ' +
        'the Model for Improvement structures QI work around <strong>three fundamental questions</strong> and iterative testing using PDSA cycles.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">' +

        '<div class="bg-blue-50 rounded-xl p-4 border border-blue-100">' +
        '<div class="text-2xl font-black text-blue-300 mb-1">Q1</div>' +
        '<div class="font-bold text-sm text-blue-800 mb-1">What are we trying to accomplish?</div>' +
        '<p class="text-xs text-blue-700">Your SMART Aim — specific, measurable, achievable, relevant, time-bound. ' +
        'Sets the direction and scope of your project.</p>' +
        '</div>' +

        '<div class="bg-indigo-50 rounded-xl p-4 border border-indigo-100">' +
        '<div class="text-2xl font-black text-indigo-300 mb-1">Q2</div>' +
        '<div class="font-bold text-sm text-indigo-800 mb-1">How will we know that a change is an improvement?</div>' +
        '<p class="text-xs text-indigo-700">Your measurement framework — outcome, process, and balancing measures. ' +
        'Tracked over time on a run chart.</p>' +
        '</div>' +

        '<div class="bg-purple-50 rounded-xl p-4 border border-purple-100">' +
        '<div class="text-2xl font-black text-purple-300 mb-1">Q3</div>' +
        '<div class="font-bold text-sm text-purple-800 mb-1">What changes can we make that will result in improvement?</div>' +
        '<p class="text-xs text-purple-700">Your Change Ideas — tested through PDSA cycles. ' +
        'Identified via driver diagrams and root cause analysis.</p>' +
        '</div>' +

        '</div>' +
        infoBox('blue',
            '<p class="text-xs text-blue-800"><strong>Key principle:</strong> The three questions come first — then test changes with PDSA cycles. ' +
            'Too many QIPs jump straight to "fixing" the problem without first establishing a clear aim and measurement framework. ' +
            'Answer all three questions before you collect a single data point.</p>'
        ),
        'mb-6'
    );

    var pdsa = card(
        sectionHead('rotate-ccw', 'PDSA Cycles', 'emerald') +
        '<p class="text-sm text-slate-600 mb-4 leading-relaxed">PDSA (Plan-Do-Study-Act) is the engine of the Model for Improvement. ' +
        'Each cycle is a structured test of a change idea. Multiple iterative cycles build evidence that your change leads to improvement.</p>' +

        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">' +
        '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">P</span>' +
        '<span class="font-bold text-blue-800">Plan</span></div>' +
        '<ul class="text-xs text-blue-700 space-y-1">' +
        '<li>• State the objective of the test</li><li>• Make a specific prediction</li>' +
        '<li>• Define Who, What, When, Where</li><li>• Plan your data collection</li>' +
        '</ul></div>' +

        '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">D</span>' +
        '<span class="font-bold text-green-800">Do</span></div>' +
        '<ul class="text-xs text-green-700 space-y-1">' +
        '<li>• Carry out the test as planned</li><li>• Start small — a few patients or one shift</li>' +
        '<li>• Document problems and surprises</li><li>• Begin collecting data immediately</li>' +
        '</ul></div>' +

        '<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 bg-amber-600 text-white text-xs font-bold rounded-full flex items-center justify-center">S</span>' +
        '<span class="font-bold text-amber-800">Study</span></div>' +
        '<ul class="text-xs text-amber-700 space-y-1">' +
        '<li>• Compare results to your prediction</li><li>• Analyse both quantitative and qualitative data</li>' +
        '<li>• Look for unintended consequences</li><li>• Summarise what was learned</li>' +
        '</ul></div>' +

        '<div class="bg-purple-50 border border-purple-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2"><span class="w-7 h-7 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">A</span>' +
        '<span class="font-bold text-purple-800">Act</span></div>' +
        '<ul class="text-xs text-purple-700 space-y-1">' +
        '<li>• Adopt (implement widely), Adapt (modify and retest), or Abandon</li><li>• Plan your next PDSA cycle based on learning</li>' +
        '<li>• Document your decision and rationale</li><li>• Aim progressively larger with each cycle</li>' +
        '</ul></div>' +
        '</div>' +

        infoBox('amber',
            '<p class="text-xs text-amber-800"><strong>FRCEM tip:</strong> Each PDSA cycle must be distinct and documented with predictions, results, and a clear rationale for the Act decision. ' +
            'A satisfactory project shows ≥2 cycles; excellent requires ≥3 iterative cycles where each one clearly builds on the last. ' +
            'Use the Change Ideas board in this app to document each cycle properly.</p>'
        ),
        'mb-6'
    );

    var driver = card(
        sectionHead('git-branch', 'Driver Diagrams', 'violet') +
        '<p class="text-sm text-slate-600 mb-4 leading-relaxed">A driver diagram is a visual map connecting your project Aim to the factors (drivers) that influence it, ' +
        'and the specific changes you will test. It is the most important planning tool in QI and forms a strong backbone for your write-up.</p>' +

        '<div class="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">' +
        '<div class="flex flex-wrap items-center gap-3 text-xs font-semibold text-center">' +
        '<div class="bg-rcem-purple text-white rounded-lg px-3 py-2">SMART Aim</div>' +
        '<div class="text-slate-400 text-lg">→</div>' +
        '<div class="flex flex-col gap-1">' +
        '<div class="bg-blue-100 text-blue-800 rounded px-2 py-1">Primary Driver 1</div>' +
        '<div class="bg-blue-100 text-blue-800 rounded px-2 py-1">Primary Driver 2</div>' +
        '<div class="bg-blue-100 text-blue-800 rounded px-2 py-1">Primary Driver 3</div>' +
        '</div>' +
        '<div class="text-slate-400 text-lg">→</div>' +
        '<div class="flex flex-col gap-1">' +
        '<div class="bg-indigo-50 text-indigo-700 rounded px-2 py-1 text-xs">Secondary Driver A</div>' +
        '<div class="bg-indigo-50 text-indigo-700 rounded px-2 py-1 text-xs">Secondary Driver B</div>' +
        '</div>' +
        '<div class="text-slate-400 text-lg">→</div>' +
        '<div class="flex flex-col gap-1">' +
        '<div class="bg-green-50 text-green-700 rounded px-2 py-1 text-xs">Change Idea 1</div>' +
        '<div class="bg-green-50 text-green-700 rounded px-2 py-1 text-xs">Change Idea 2</div>' +
        '</div>' +
        '</div></div>' +

        '<ul class="text-xs text-slate-600 space-y-1.5">' +
        '<li class="flex gap-1.5"><span class="text-violet-500 font-bold">•</span><strong>Aim:</strong> Your overall project goal (SMART format)</li>' +
        '<li class="flex gap-1.5"><span class="text-violet-500 font-bold">•</span><strong>Primary Drivers:</strong> Major categories of factors that contribute to the problem (usually 3–5)</li>' +
        '<li class="flex gap-1.5"><span class="text-violet-500 font-bold">•</span><strong>Secondary Drivers:</strong> Specific factors within each primary driver category</li>' +
        '<li class="flex gap-1.5"><span class="text-violet-500 font-bold">•</span><strong>Change Ideas:</strong> Concrete interventions linked to secondary drivers — each one tested via a PDSA cycle</li>' +
        '</ul>',
        'mb-6'
    );

    var measures = card(
        sectionHead('bar-chart-2', 'Measurement Framework', 'orange') +
        '<p class="text-sm text-slate-600 mb-3 leading-relaxed">Every QIP needs all three types of measure tracked over time. Plotted on a run chart or SPC chart, ' +
        'they tell you whether your change is working, whether the process is being followed, and whether you are causing unintended harm.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
        '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
        '<div class="font-bold text-sm text-blue-800 mb-1">Outcome Measure</div>' +
        '<p class="text-xs text-blue-700 leading-relaxed mb-2">Did things improve for the patient?</p>' +
        '<div class="text-xs text-blue-600 italic">e.g. % of sepsis patients receiving antibiotics within 1 hour</div>' +
        '</div>' +
        '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
        '<div class="font-bold text-sm text-green-800 mb-1">Process Measure</div>' +
        '<p class="text-xs text-green-700 leading-relaxed mb-2">Is the change you implemented actually happening?</p>' +
        '<div class="text-xs text-green-600 italic">e.g. % of sepsis patients who had a sepsis screening form completed</div>' +
        '</div>' +
        '<div class="bg-rose-50 border border-rose-200 rounded-xl p-4">' +
        '<div class="font-bold text-sm text-rose-800 mb-1">Balancing Measure</div>' +
        '<p class="text-xs text-rose-700 leading-relaxed mb-2">What else might be getting worse as a result?</p>' +
        '<div class="text-xs text-rose-600 italic">e.g. Average time to first assessment (did we slow other patients down?)</div>' +
        '</div>' +
        '</div>'
    );

    return '<div class="space-y-6">' + mfi + pdsa + driver + measures + '</div>';
}

// ─── Tab 4: QI Tools ──────────────────────────────────────────────────────────

function tabTools() {
    var tools = [
        {
            icon: 'fish', color: 'blue', name: 'Fishbone (Ishikawa) Diagram',
            what: 'A cause-and-effect diagram that organises potential root causes into categories (e.g. People, Process, Environment, Equipment). Excellent for identifying why a problem exists before designing solutions.',
            when: 'Problem analysis phase — after identifying your problem and before choosing interventions.',
            nav: 'tools (Fishbone view)',
            tips: 'Use 5–6 main branches. Each branch should have 2–4 specific causes. Connect the strongest causes to your secondary drivers.'
        },
        {
            icon: 'grid-2x2', color: 'emerald', name: 'SWOT Analysis',
            what: 'Analyses Strengths, Weaknesses, Opportunities, and Threats around your project or proposed change. Useful for feasibility assessment and stakeholder communication.',
            when: 'Early planning phase to justify your approach and identify barriers.',
            nav: 'Checklist → SWOT/PEST panel',
            tips: 'Strengths and Weaknesses are internal; Opportunities and Threats are external. Be specific — "strong MDT relationships" is better than "good team".'
        },
        {
            icon: 'globe', color: 'violet', name: 'PEST Analysis',
            what: 'Analyses Political, Economic, Social, and Technological factors that may affect your project. Broadens thinking beyond the immediate clinical environment.',
            when: 'Particularly useful for projects with policy, funding, or system-wide implications.',
            nav: 'Checklist → toggle to PEST mode',
            tips: 'Consider NHS policy direction, ICS priorities, and national targets. Political factors in the NHS include NHSE guidance and RCEM standards.'
        },
        {
            icon: 'alert-triangle', color: 'amber', name: 'FMEA (Failure Modes & Effects Analysis)',
            what: 'A proactive risk assessment tool. Identifies what could go wrong with a proposed change, how likely it is, how severe the impact would be, and how detectable it is. Produces a Risk Priority Number (RPN) for each failure mode.',
            when: 'Before implementing a change, particularly for patient safety-critical interventions.',
            nav: 'Checklist → FMEA section',
            tips: 'Score Likelihood × Severity × Detectability (1–5 each). Address failure modes with the highest RPN first. Document mitigations for each.'
        },
        {
            icon: 'bar-chart', color: 'orange', name: 'Pareto Chart',
            what: 'A bar chart ranking causes by frequency, with a cumulative percentage line. Based on the Pareto principle (80% of problems come from 20% of causes). Helps focus interventions on the highest-impact causes.',
            when: 'After initial data collection — to prioritise which causes or categories to address first.',
            nav: 'Data → Chart type → Pareto',
            tips: 'Collect at least 20–30 data points per category. The 80% line shows which categories to focus on. Link these directly to your Change Ideas.'
        },
        {
            icon: 'trending-up', color: 'blue', name: 'Run Chart',
            what: 'A graph of data plotted over time with the median marked. Used to detect non-random patterns (signals) — shifts, trends, or runs — that suggest your change is having a real effect.',
            when: 'Throughout the project — as your primary ongoing measurement tool.',
            nav: 'Data → Chart type → Run',
            tips: 'Annotate your PDSA cycle start dates as vertical lines. A run of 8+ points above or below the median is a signal of real change. Collect at least 10 data points before annotating.'
        },
        {
            icon: 'activity', color: 'indigo', name: 'SPC Chart (Statistical Process Control)',
            what: 'A run chart with statistically calculated control limits (UCL/LCL, ±3σ). Points outside control limits represent "special cause variation" — strong statistical evidence of real change in your process.',
            when: 'When you have ≥15–20 data points and want to demonstrate statistical evidence of improvement for your FRCEM write-up.',
            nav: 'Data → Chart type → SPC',
            tips: 'For FRCEM Excellent, you need annotated run or SPC charts. SPC charts are particularly persuasive. Aim for data collected at regular intervals throughout your project.'
        },
        {
            icon: 'users', color: 'teal', name: 'Stakeholder Analysis',
            what: 'Maps all individuals and groups with an interest in your project by their level of influence and interest. Used to plan engagement, communication, and anticipate resistance.',
            when: 'Early in the project to plan your engagement strategy. Revisit when implementing changes.',
            nav: 'Stakeholders view',
            tips: 'Map on a 2×2 grid: High influence/High interest = manage closely; High influence/Low interest = keep satisfied. Document your engagement plan for each stakeholder group.'
        }
    ];

    var html = '<div class="grid grid-cols-1 gap-4">';
    tools.forEach(function(t) {
        html +=
            '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
            '<div class="flex items-center gap-3 px-5 py-3 bg-' + t.color + '-50 border-b border-' + t.color + '-100">' +
            '<div class="w-8 h-8 bg-' + t.color + '-600 rounded-lg flex items-center justify-center">' +
            '<i data-lucide="' + t.icon + '" class="w-4 h-4 text-white"></i></div>' +
            '<div class="font-bold text-sm text-' + t.color + '-800">' + t.name + '</div>' +
            '<span class="ml-auto text-xs text-' + t.color + '-600 font-medium hidden sm:block">App: ' + t.nav + '</span>' +
            '</div>' +
            '<div class="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">' +
            '<div><div class="font-semibold text-slate-700 mb-1">What it is</div><p class="text-slate-500 leading-relaxed">' + t.what + '</p></div>' +
            '<div><div class="font-semibold text-slate-700 mb-1">When to use</div><p class="text-slate-500 leading-relaxed">' + t.when + '</p></div>' +
            '<div><div class="font-semibold text-slate-700 mb-1">Tips</div><p class="text-slate-500 leading-relaxed">' + t.tips + '</p></div>' +
            '</div></div>';
    });
    html += '</div>';

    return '<div>' +
        '<div class="mb-4">' + sectionHead('wrench', 'QI Tools — What They Are and When to Use Them', 'slate') + '</div>' +
        html + '</div>';
}

// ─── Tab 5: FRCEM Guide ───────────────────────────────────────────────────────

function tabFRCEM() {
    var format = card(
        sectionHead('file-text', 'Submission Format Requirements', 'slate') +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
        '<div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">' +
        '<div class="text-2xl font-black text-rcem-purple">3–4k</div>' +
        '<div class="text-xs font-semibold text-slate-600">Word count</div>' +
        '<div class="text-xs text-slate-400 mt-0.5">Excluding references and figures</div>' +
        '</div>' +
        '<div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">' +
        '<div class="text-2xl font-black text-rcem-purple">11pt</div>' +
        '<div class="text-xs font-semibold text-slate-600">Font size</div>' +
        '<div class="text-xs text-slate-400 mt-0.5">Arial or Times New Roman</div>' +
        '</div>' +
        '<div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">' +
        '<div class="text-2xl font-black text-rcem-purple">2×</div>' +
        '<div class="text-xs font-semibold text-slate-600">Line spacing</div>' +
        '<div class="text-xs text-slate-400 mt-0.5">Double-spaced throughout</div>' +
        '</div>' +
        '<div class="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">' +
        '<div class="text-2xl font-black text-rcem-purple">Van</div>' +
        '<div class="text-xs font-semibold text-slate-600">Referencing</div>' +
        '<div class="text-xs text-slate-400 mt-0.5">Vancouver style</div>' +
        '</div>' +
        '</div>',
        'mb-6'
    );

    var rubric = card(
        sectionHead('clipboard-check', 'Marking Rubric — Domain by Domain', 'emerald') +
        '<p class="text-xs text-slate-500 mb-4">Each domain is marked Unsatisfactory / Satisfactory / Excellent. ' +
        'All domains must reach Satisfactory for an overall pass. Excellence in most domains is needed for an Excellent overall.</p>' +
        '<div class="overflow-x-auto">' +
        '<table class="w-full text-xs border-collapse">' +
        '<thead><tr class="bg-slate-50">' +
        '<th class="text-left p-2.5 border border-slate-200 font-bold text-slate-700 w-1/4">Domain</th>' +
        '<th class="text-left p-2.5 border border-slate-200 font-bold text-amber-700">Satisfactory</th>' +
        '<th class="text-left p-2.5 border border-slate-200 font-bold text-emerald-700">Excellent</th>' +
        '</tr></thead><tbody>' +
        [
            ['Narrative Structure', 'Clear problem identification; relevant local context; cohesive logical structure throughout', 'Compelling narrative flow with fluid transitions; the "so what?" is evident at every stage; engaging for the reader'],
            ['Engagement & Team', 'Named team members with defined roles; documented contributions from ≥2 stakeholder groups', 'Interdisciplinary team; documented management of resistance; patient or carer co-design; explicit leadership role'],
            ['Problem Analysis', 'Baseline audit data; critical appraisal of ≥3 relevant clinical literature sources', 'Multiple analysis tools (SWOT/PEST, Ishikawa, FMEA); option appraisal; gap analysis linking evidence to local context'],
            ['Change Management', 'Basic Model for Improvement applied; ≥2 distinct PDSA cycles documented with predictions and learning', 'Gantt charts used; stakeholder forcefield analysis; ≥3 iterative PDSA cycles each building on previous learning; change package described'],
            ['Measuring Outcomes', 'Outcome, process, and balancing measures defined; basic data table or graph; data collected over time', 'Annotated run charts or SPC charts; justified choice of metrics; statistical signals of improvement described'],
            ['Reflection & Learning', 'Basic personal reflection; lessons learned identified; next steps suggested', 'Deep self-aware reflection; personal strengths and weaknesses addressed; sustainability analysis; spread plan for the wider system'],
        ].map(function(row, i) {
            var bg = (i % 2 === 0) ? '' : 'class="bg-slate-50"';
            return '<tr ' + bg + '><td class="p-2.5 border border-slate-200 font-semibold text-slate-800">' + row[0] + '</td>' +
                '<td class="p-2.5 border border-slate-200 text-slate-600">' + row[1] + '</td>' +
                '<td class="p-2.5 border border-slate-200 text-slate-600">' + row[2] + '</td></tr>';
        }).join('') +
        '</tbody></table></div>',
        'mb-6'
    );

    var structure = card(
        sectionHead('layout', 'Suggested Write-Up Structure', 'violet') +
        '<div class="space-y-3">' +
        [
            ['Introduction (200–300 words)', 'State the clinical problem, why it matters in your ED, the relevant national standard or guideline, and your SMART aim. Introduce the team.'],
            ['Background & Evidence Review (400–500 words)', 'Critical appraisal of ≥3 key papers. Demonstrate understanding of the evidence base. Include any relevant RCEM, NICE, or national guidance. Identify the gap between best practice and your current practice.'],
            ['Problem Analysis (300–400 words)', 'Describe your baseline data collection (audit). Present a fishbone or driver diagram. Include SWOT/PEST or FMEA if available. Describe your measurement framework (outcome/process/balancing measures).'],
            ['Change Ideas & PDSA Cycles (600–800 words)', 'For each PDSA cycle: state the change idea, your prediction, what you did (Do), what you found (Study), and your decision (Act). Each cycle should build iteratively on the previous. Include your driver diagram linking change ideas to primary drivers.'],
            ['Results & Data (300–400 words)', 'Present your outcome, process, and balancing measures over time. Include an annotated run chart or SPC chart. Describe any signals of improvement. Note any unintended consequences.'],
            ['Reflection & Sustainability (300–400 words)', 'Reflect on the project process — what worked, what did not, what you would do differently. Include a sustainability plan and spread strategy. Address your personal learning.'],
            ['References', 'Vancouver format. Numbered in order of citation. Include DOI where available.'],
        ].map(function(s) {
            return '<div class="flex gap-3"><div class="w-2 bg-violet-200 rounded-full flex-shrink-0 self-stretch"></div>' +
                '<div><div class="font-semibold text-sm text-slate-800">' + s[0] + '</div>' +
                '<p class="text-xs text-slate-500 mt-0.5 leading-relaxed">' + s[1] + '</p></div></div>';
        }).join('') +
        '</div>',
        'mb-6'
    );

    var pitfalls = card(
        sectionHead('alert-circle', 'Common Pitfalls to Avoid', 'rose') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        [
            ['Only one audit cycle', 'A single audit-re-audit is NOT a QIP. You need at least 2 PDSA cycles with evidence of iterative improvement and learning between them.'],
            ['No PDSA predictions', 'Every PDSA cycle must start with a specific prediction. "We expected improvement" is not a prediction. State exactly what you expected to happen and why.'],
            ['No annotated charts', 'Data in a table is insufficient for Excellent. Plot your data over time with PDSA cycle dates marked. Use the Data view in this app to generate run/SPC charts.'],
            ['Vague team description', 'List every team member with their role and specific contribution. For Excellent, you need evidence of managing a team — including how you addressed resistance or conflict.'],
            ['No balancing measure', 'Failing to monitor unintended consequences is a common oversight. Always include at least one balancing measure (e.g. did your intervention affect another process negatively?).'],
            ['Unsupported aim', 'Your SMART aim must be directly supported by your baseline data. The gap between your baseline and your target must be explicitly stated and justified.'],
        ].map(function(p) {
            return '<div class="bg-rose-50 rounded-lg p-3 border border-rose-100">' +
                '<div class="font-bold text-xs text-rose-800 mb-1 flex items-center gap-1.5">' +
                '<i data-lucide="x-circle" class="w-3.5 h-3.5 flex-shrink-0"></i>' + p[0] + '</div>' +
                '<p class="text-xs text-rose-700 leading-relaxed">' + p[1] + '</p></div>';
        }).join('') +
        '</div>'
    );

    return '<div class="space-y-6">' + format + rubric + structure + pitfalls + '</div>';
}

// ─── Tab 6: Resources ─────────────────────────────────────────────────────────

function tabResources() {
    var sections = [
        {
            head: 'RCEM', icon: 'award', color: 'purple',
            links: [
                ['https://rcem.ac.uk/quality-improvement/', 'purple', 'RCEM Quality Improvement Hub', 'National QIP registration, resources, and the RCEM QI Programme overview. Register for the 2026 cycle here.', '2026'],
                ['https://res.cloudinary.com/studio-republic/images/v1664466808/RCEM_Quality_Improvement_Guide_2022_v4/RCEM_Quality_Improvement_Guide_2022_v4.pdf', 'purple', 'RCEM Quality Improvement Guide (2022)', 'The official RCEM guide to running a QIP — methodology, assessment, and portfolio requirements. Essential reading.', 'PDF'],
                ['https://rcem.ac.uk/em-curriculum/', 'purple', 'RCEM Curriculum & SLO 11 Guidance', 'EM Curriculum 2021 (v1.5, updated Aug 2025). Includes SLO 11 guidance, QIAT documentation, and ARCP requirements at each stage.', 'Curriculum'],
                ['https://heeoe.hee.nhs.uk/sites/default/files/the_quality_improvement_project_-_guidance_for_examination_candidates.pdf', 'indigo', 'FRCEM QIP Guidance for Examination Candidates', 'Detailed guidance on what the QIP assessment requires, marking domains, and how to structure your write-up.', 'FRCEM'],
            ]
        },
        {
            head: 'IHI (Institute for Healthcare Improvement)', icon: 'flask-conical', color: 'blue',
            links: [
                ['https://www.ihi.org/education/IHIOpenSchool/Pages/default.aspx', 'blue', 'IHI Open School — Free QI Courses', 'Free online certificate in Quality Improvement and Patient Safety. Includes QI 101–103 (Model for Improvement, PDSA cycles, run charts). Highly recommended for all trainees.', 'Free'],
                ['https://www.ihi.org/library/model-for-improvement', 'blue', 'IHI Model for Improvement', 'The three foundational questions and PDSA cycle methodology explained in detail with examples.', 'Reference'],
                ['https://www.ihi.org/library/tools/plan-do-study-act-pdsa-worksheet', 'blue', 'IHI PDSA Worksheet', 'Downloadable PDSA cycle documentation worksheet. Use to structure each cycle in your QIP.', 'Tool'],
                ['https://www.ihi.org/library/model-for-improvement/testing-changes', 'blue', 'Testing Changes with PDSA', 'IHI guidance on running effective PDSA tests of change, including scaling, timing, and iteration strategy.', 'Guide'],
            ]
        },
        {
            head: 'NHS England & Improvement', icon: 'building-2', color: 'teal',
            links: [
                ['https://www.england.nhs.uk/nhsimpact/improvement-resources/', 'teal', 'NHS England Improvement Resources', 'Hub for QI tools, frameworks, and guidance from NHS England. Includes the Model for Improvement, spread and adoption frameworks.', 'NHS'],
                ['https://learninghub.nhs.uk/Resource/60096', 'teal', 'Handbook of Quality and Service Improvement Tools', 'NHS England\'s comprehensive handbook covering process mapping, cause-and-effect, measurement, and statistical tools. Available on the NHS Learning Hub.', 'Handbook'],
                ['https://www.england.nhs.uk/improvement-hub/wp-content/uploads/sites/44/2011/06/service_improvement_guide_2014.pdf', 'teal', 'First Steps Towards QI (NHS England)', 'Introductory guide to service improvement — useful for early-stage trainees explaining QI concepts clearly.', 'PDF'],
            ]
        },
        {
            head: 'HQIP & Audit', icon: 'bar-chart-2', color: 'orange',
            links: [
                ['https://www.hqip.org.uk/resource/guide-to-quality-improvement-tools', 'orange', 'HQIP Guide to QI Tools', 'Healthcare Quality Improvement Partnership guide covering Root Cause Analysis, clinical audit, Lean, SPC, Pareto, and more.', 'Guide'],
                ['https://www.ahrq.gov/evidencenow/tools/pdsa-form.html', 'orange', 'AHRQ PDSA Form', 'Fillable PDSA documentation form from the Agency for Healthcare Research and Quality. Useful for structuring your cycle write-up.', 'Tool'],
            ]
        },
        {
            head: 'Statistical & Charts', icon: 'activity', color: 'rose',
            links: [
                ['https://www.ihi.org/sites/default/files/2023-11/100MLives_UsingPDSACyclesinCommunitySettings.pdf', 'rose', 'IHI — Using PDSA Cycles in Practice (Case Studies)', 'Real-world case studies of PDSA cycles, including how to scope tests, what constitutes a cycle, and common pitfalls.', 'Case Study'],
                ['https://qilothian.scot.nhs.uk/resourcesandtemplates', 'rose', 'NHS Lothian QI Templates', 'Downloadable SPC calculators, run chart templates, driver diagram frameworks, and PDSA worksheets.', 'Templates'],
            ]
        },
    ];

    var html = '<div class="space-y-6">';
    sections.forEach(function(sec) {
        html += '<div>' +
            '<h3 class="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">' +
            '<i data-lucide="' + sec.icon + '" class="w-4 h-4 text-' + sec.color + '-600"></i>' + sec.head + '</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
        sec.links.forEach(function(l) {
            html += resLink(l[0], l[1], l[2], l[3], l[4]);
        });
        html += '</div></div>';
    });
    html += '</div>';

    return '<div>' +
        '<div class="mb-5">' +
        sectionHead('book-open', 'Curated Learning Resources', 'blue') +
        '<p class="text-sm text-slate-500">Vetted external links for RCEM trainees at all stages. All free to access unless otherwise noted.</p>' +
        '</div>' + html + '</div>';
}

// ─── Tab 7: Glossary ──────────────────────────────────────────────────────────

function tabGlossary() {
    var terms = [
        ['Aim Statement', 'The project goal expressed in SMART format: Specific, Measurable, Achievable, Relevant, and Time-bound. Every QIP starts here. Example: "To increase the proportion of sepsis patients receiving antibiotics within 60 minutes from 45% to 80% by December 2025 in Heartlands ED."'],
        ['Audit Cycle', 'A baseline measurement against a standard, followed by an intervention, followed by a re-measurement. Distinguished from QIP in that it does not require iterative PDSA testing. Required as the baseline data for a QIP but not sufficient on its own.'],
        ['Balancing Measure', 'A metric that monitors unintended consequences of your change. Answers: "What might get worse as a result of our improvement?" e.g. If you improve sepsis treatment time, does overall triage throughput decrease?'],
        ['Change Idea', 'A specific intervention to be tested through a PDSA cycle. Linked to a secondary driver in the driver diagram. Multiple change ideas can be tested within one project, each with their own iterative cycles.'],
        ['Control Chart (SPC Chart)', 'A run chart with statistically calculated upper and lower control limits (UCL/LCL at ±3σ). Points outside these limits represent "special cause variation" — statistical evidence of a genuine change in the process.'],
        ['Driver Diagram', 'A visual map connecting the project Aim to Primary Drivers (main categories), Secondary Drivers (specific contributing factors), and Change Ideas (interventions). The backbone of any well-structured QIP.'],
        ['FMEA', 'Failure Mode and Effects Analysis. A proactive risk assessment tool identifying what could go wrong with a proposed change, scored by Likelihood × Severity × Detectability to produce a Risk Priority Number (RPN).'],
        ['Fishbone Diagram', 'Also called an Ishikawa or cause-and-effect diagram. Organises potential root causes into categories (People, Process, Environment, Equipment, Policy) to identify why a problem exists.'],
        ['Gantt Chart', 'A project management timeline showing tasks, durations, dependencies, and responsible individuals. Demonstrates project management skills for the Excellent marking criterion in Change Management.'],
        ['IHI Open School', 'The Institute for Healthcare Improvement\'s free online education platform. Courses QI 101–103 cover the Model for Improvement, PDSA cycles, and run chart interpretation. Recommended for all trainees.'],
        ['Model for Improvement', 'The QI framework developed by Associates in Process Improvement. Built around three questions (Aim, Measurement, Change Ideas) and tested iteratively using PDSA cycles. The standard methodology for healthcare QI.'],
        ['Outcome Measure', 'The metric that tracks whether things improved for the patient. The primary measure of whether your project achieved its aim. e.g. % of patients receiving the correct treatment within target time.'],
        ['Pareto Chart', 'A bar chart ranking causes by frequency with a cumulative percentage line. Based on the Pareto principle (80% of problems from 20% of causes). Used to prioritise interventions.'],
        ['PDSA Cycle', 'Plan-Do-Study-Act. A structured test of a change idea. Plan: state objective and prediction; Do: implement the test; Study: compare results to prediction; Act: adopt, adapt, or abandon based on learning.'],
        ['Process Measure', 'Tracks whether the change you implemented is actually being carried out. Bridges the gap between your intervention and the outcome. e.g. % of patients screened with sepsis tool (process) → % treated within 1hr (outcome).'],
        ['QIAT', 'Quality Improvement Assessment Tool. Updated November 2025, now live on RCEM eportfolio. Replaces the old QIP assessment form. Completed for each QI phase with supervisor sign-off.'],
        ['RCEM National QIP', 'An annual national quality improvement programme run by RCEM for participating Type 1 EDs. Three topics per year. Provides standardised data collection and national benchmarking.'],
        ['Run Chart', 'A graph of data plotted over time with the median line marked. Non-random patterns (shifts of ≥8 points, trends, unusual runs) indicate genuine change. The standard plotting tool for QI data.'],
        ['SMART Aim', 'Specific, Measurable, Achievable, Relevant, Time-bound. The required format for your QIP aim statement. "To improve sepsis care" is not SMART; "To increase antibiotic administration within 60 minutes from 45% to 80% by December 2025" is.'],
        ['SLO 11', 'Specialty Learning Outcome 11 in the RCEM 2021 Curriculum (updated Aug 2025). Covers Quality Improvement and Patient Safety. Requires a QIP with QIAT sign-off at each stage of training.'],
        ['Special Cause Variation', 'A signal in your data (points outside control limits on an SPC chart, or non-random patterns on a run chart) indicating that something has genuinely changed the process — not just random noise.'],
        ['Spread Plan', 'A structured plan for how a successful change will be rolled out beyond the initial test environment to the wider system. Required for the Excellent marking descriptor in Reflection & Sustainability.'],
        ['Stakeholder Forcefield Analysis', 'Identifies forces supporting and opposing your change, scored by strength. Helps plan engagement strategy and is evidence of the Excellent criterion for Change Management.'],
        ['Vancouver Referencing', 'The citation style required for FRCEM QIP write-ups. References are numbered sequentially in text and listed in order of appearance. Format: Author(s). Title. Journal. Year;Volume(Issue):Pages.'],
    ];

    terms.sort(function(a, b) { return a[0].localeCompare(b[0]); });

    var html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
    terms.forEach(function(t) { html += termCard(t[0], t[1]); });
    html += '</div>';

    return '<div>' +
        '<div class="mb-5">' +
        sectionHead('book-marked', 'QI Glossary', 'slate') +
        '<p class="text-sm text-slate-500">Key terms used in quality improvement, RCEM training, and this app. Alphabetically ordered.</p>' +
        '</div>' + html + '</div>';
}
