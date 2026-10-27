// learn.js
// ─── QI Learning Hub — Full View Renderer ─────────────────────────────────────
// Tabs: RCEM Requirements | QI Methods | QI Tools | Reading a chart |
//       People & change | Sustain & spread | Audit, QI or research? |
//       Share your work | Worked example | FAQ | National QIPs | Key reading |
//       Resources | Glossary
//
// Every factual claim that is not plain QI practice carries a source line.
// PubMed links are by PMID; where a document is not on PubMed the publisher's
// page is linked instead.

import { QI } from "./qi-constants.js";
import { state } from "./state.js";

let learnActiveTab = 'rcem';
let learnQuery = '';

const TABS = [
    ['rcem',      'award',        'RCEM Requirements', 'RCEM'],
    ['methods',   'flask-conical','QI Methods',        'Methods'],
    ['tools',     'wrench',       'QI Tools',          'Tools'],
    ['charts',    'line-chart',   'Reading a chart',   'Charts'],
    ['people',    'users',        'People & change',   'People'],
    ['sustain',   'repeat',       'Sustain & spread',  'Sustain'],
    ['ethics',    'scale',        'Audit, QI or research?', 'Ethics'],
    ['share',     'megaphone',    'Share your work',   'Share'],
    ['example',   'route',        'Worked example',    'Example'],
    ['faq',       'help-circle',  'FAQ',               'FAQ'],
    ['national',  'building-2',   'National QIPs',     'National'],
    ['reading',   'library',      'Key reading',       'Reading'],
    ['resources', 'book-open',    'Resources',         'Links'],
    ['glossary',  'book-marked',  'Glossary',          'Glossary']
];

const TAB_RENDERERS = {
    rcem: tabRCEM, methods: tabMethods, tools: tabTools, charts: tabCharts,
    people: tabPeople, sustain: tabSustain, ethics: tabEthics, share: tabShare,
    example: tabExample, faq: tabFAQ, national: tabNational, reading: tabReading,
    resources: tabResources, glossary: tabGlossary
};

function tabBtnClass(active) {
    return 'learn-tab inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ' +
        (active ? 'bg-white text-rcem-purple shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60');
}

export function renderLearn() {
    const container = document.getElementById('view-learn');
    if (!container) return;

    const tabBtns = TABS.map(function(t) {
        var id = t[0]; var icon = t[1]; var label = t[2]; var short = t[3];
        return '<button type="button" onclick="window.setLearnTab(\'' + id + '\')" id="learn-tab-' + id + '" ' +
            'class="' + tabBtnClass(id === learnActiveTab) + '" title="' + label + '">' +
            '<i data-lucide="' + icon + '" class="w-3.5 h-3.5"></i>' +
            '<span class="hidden sm:inline">' + label + '</span><span class="sm:hidden">' + short + '</span>' +
            '</button>';
    }).join('');

    container.innerHTML =
        '<div class="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">' +

        // Header
        '<div class="bg-gradient-to-r from-rcem-purple to-indigo-600 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-white">' +
        '<div class="flex items-start gap-3 sm:gap-4">' +
        '<div class="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">' +
        '<i data-lucide="graduation-cap" class="w-5 h-5 sm:w-7 sm:h-7"></i></div>' +
        '<div class="min-w-0">' +
        '<h1 class="text-xl sm:text-2xl font-bold">QI Learning Hub</h1>' +
        '<p class="text-indigo-200 text-xs sm:text-sm mt-1">What RCEM expects, how improvement science works, how to read your chart, how to bring people with you, and how to share what you did. Each section says where its facts come from.</p>' +
        '</div></div>' +
        // Search
        '<div class="mt-4 relative">' +
        '<i data-lucide="search" class="w-4 h-4 text-indigo-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>' +
        '<input id="learn-search" type="search" value="' + escapeAttr(learnQuery) + '" oninput="window.searchLearn(this.value)" placeholder="Search the hub, e.g. balancing measure, shift, Caldicott, SQUIRE" ' +
        'class="w-full bg-white/15 border border-white/20 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/60" style="font-size:16px">' +
        '</div>' +
        '<div id="learn-search-results" class="mt-2"></div>' +
        '</div>' +

        // Tab bar: wraps on every screen, so no tab is hidden off the edge
        '<div class="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl mb-4 sm:mb-6">' +
        tabBtns + '</div>' +

        // Tab content
        '<div id="learn-tab-content">' + renderLearnTabContent(learnActiveTab) + '</div>' +

        '</div>';

    if (learnQuery) window.searchLearn(learnQuery);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.setLearnTab = function(tabId) {
    learnActiveTab = tabId;
    document.querySelectorAll('.learn-tab').forEach(function(btn) {
        btn.className = tabBtnClass(btn.id === ('learn-tab-' + tabId));
    });
    var content = document.getElementById('learn-tab-content');
    if (content) {
        content.innerHTML = renderLearnTabContent(tabId);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        var area = document.getElementById('content-area');
        var bar = document.querySelector('.learn-tab');
        if (area && bar && window.innerWidth < 768) {
            var top = content.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 12;
            area.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
    }
};

// Search every tab's text; list the tabs that mention the term with a snippet.
window.searchLearn = function(q) {
    learnQuery = (q || '').trim();
    var box = document.getElementById('learn-search-results');
    if (!box) return;
    if (learnQuery.length < 3) { box.innerHTML = ''; return; }
    var needle = learnQuery.toLowerCase();
    var tmp = document.createElement('div');
    var hits = [];
    TABS.forEach(function(t) {
        tmp.innerHTML = renderLearnTabContent(t[0]);
        var text = (tmp.textContent || '').replace(/\s+/g, ' ');
        var lower = text.toLowerCase();
        var count = 0, idx = lower.indexOf(needle);
        var first = idx;
        while (idx !== -1) { count++; idx = lower.indexOf(needle, idx + needle.length); }
        if (count) {
            var start = Math.max(0, first - 60);
            var snippet = (start > 0 ? '…' : '') + text.slice(start, first + needle.length + 80).trim() + '…';
            hits.push({ id: t[0], label: t[2], count: count, snippet: snippet });
        }
    });
    if (!hits.length) {
        box.innerHTML = '<p class="text-xs text-indigo-100">Nothing in the hub mentions “' + escapeAttr(learnQuery) + '”. Try another word, or ask the AI Review Centre.</p>';
        return;
    }
    box.innerHTML = '<div class="space-y-1.5">' + hits.map(function(h) {
        return '<button type="button" onclick="window.setLearnTab(\'' + h.id + '\')" class="w-full text-left bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2">' +
            '<div class="flex items-center justify-between gap-2"><span class="text-xs font-bold text-white">' + h.label + '</span><span class="text-[10px] text-indigo-100">' + h.count + ' mention' + (h.count > 1 ? 's' : '') + '</span></div>' +
            '<div class="text-[11px] text-indigo-100 mt-0.5 leading-snug">' + escapeAttr(h.snippet) + '</div></button>';
    }).join('') + '</div>';
};

function renderLearnTabContent(tab) {
    var fn = TAB_RENDERERS[tab] || tabRCEM;
    return fn();
}

function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHead(icon, label, color) {
    color = color || 'rcem-purple';
    return '<h3 class="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">' +
        '<i data-lucide="' + icon + '" class="w-4 h-4 text-' + color + ' flex-shrink-0"></i>' + label + '</h3>';
}

function card(content, extra) {
    return '<div class="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm ' + (extra || '') + '">' + content + '</div>';
}

function infoBox(color, content) {
    return '<div class="bg-' + color + '-50 border border-' + color + '-200 rounded-xl p-4">' + content + '</div>';
}

// A source line under a card. `href` optional.
function source(text, href) {
    return '<p class="text-[11px] text-slate-400 mt-3 leading-snug"><span class="font-semibold text-slate-500">Source:</span> ' +
        (href ? '<a href="' + href + '" target="_blank" rel="noopener" class="underline hover:text-rcem-purple">' + text + '</a>' : text) + '</p>';
}

function pubmed(pmid) { return 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/'; }

function resLink(url, iconColor, title, desc, badge) {
    var badgeHtml = badge ? ('<span class="text-xs font-semibold text-' + iconColor + '-700 bg-' + iconColor + '-100 px-2 py-0.5 rounded-full flex-shrink-0">' + badge + '</span>') : '';
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
        '<div class="flex-1 pb-4 border-b border-slate-100 last:border-0 min-w-0">' +
        '<div class="font-bold text-sm text-slate-800">' + title + '</div>' +
        '<p class="text-xs text-slate-500 mt-0.5 leading-relaxed">' + body + '</p>' +
        '</div></div>';
}

function bullets(color, items) {
    return '<ul class="text-xs text-slate-600 space-y-1.5">' + items.map(function(i) {
        return '<li class="flex gap-1.5"><span class="text-' + color + '-500 font-bold">•</span><span>' + i + '</span></li>';
    }).join('') + '</ul>';
}

// Small "open this page in the app" link.
function appLink(view, label) {
    return '<button type="button" onclick="window.router(\'' + view + '\')" class="inline-flex items-center gap-1 text-xs font-semibold text-rcem-purple hover:underline"><i data-lucide="arrow-right" class="w-3 h-3"></i>' + label + '</button>';
}

function faqItem(q, a) {
    return '<details class="bg-white rounded-xl border border-slate-200 shadow-sm group">' +
        '<summary class="cursor-pointer select-none px-4 py-3 text-sm font-bold text-slate-800 flex items-start gap-2 list-none">' +
        '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0 transition-transform group-open:rotate-90"></i><span>' + q + '</span></summary>' +
        '<div class="px-4 pb-4 pl-10 text-xs text-slate-600 leading-relaxed space-y-2">' + a + '</div></details>';
}

// ─── Tab 1: RCEM Requirements ─────────────────────────────────────────────────

function tabRCEM() {
    var stages =
        '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">' +

        // ACCS
        '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">ACCS</span></div>' +
        '<ul class="text-xs text-blue-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Contribute to a departmental QI project or clinical audit</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Understand QI principles and common methods</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Recognise and report patient safety incidents</li>' +
        '<li class="flex gap-1.5"><span class="text-blue-500 font-bold mt-0.5">•</span>Reflect on learning from errors and near-misses</li>' +
        '</ul></div>' +

        // Intermediate
        '<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">Intermediate</span></div>' +
        '<ul class="text-xs text-indigo-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Apply QI methodology to a clinical problem</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Collect, analyse, and interpret project data</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Test changes in PDSA cycles and evaluate their impact</li>' +
        '<li class="flex gap-1.5"><span class="text-indigo-500 font-bold mt-0.5">•</span>Engage stakeholders in change</li>' +
        '</ul></div>' +

        // HST
        '<div class="bg-purple-50 border border-purple-200 rounded-xl p-4">' +
        '<div class="flex items-center gap-2 mb-2">' +
        '<span class="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">Higher</span></div>' +
        '<ul class="text-xs text-purple-800 space-y-1.5 leading-relaxed">' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span>Lead a QIP from initiation to completion</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span>Demonstrate safety culture leadership</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span><strong>Satisfactory:</strong> lead a project, with multidisciplinary working and mature reflection on the QI methods and leadership used</li>' +
        '<li class="flex gap-1.5"><span class="text-purple-500 font-bold mt-0.5">•</span><strong>Excellent:</strong> diverse QI methods tailored to the problem, regional or national presentation, innovation or perseverance, strategic contribution to the department\'s improvement programme</li>' +
        '</ul></div>' +

        '</div>';

    var slo11 =
        card(
            sectionHead('award', 'SLO 11 — Quality Improvement & Patient Safety', 'rcem-purple') +
            '<p class="text-sm text-slate-600 mb-4 leading-relaxed">SLO 11 is one of 12 Specialty Learning Outcomes in the <strong>RCEM 2021 Curriculum (2025 update)</strong>: "participate in and promote activity to improve the quality and safety of patient care and clinical outcomes". ' +
            'The <strong>EM QIAT (Quality Improvement Assessment Tool)</strong> was updated in 2025 (v7) and is live on risr/advance. It is the only assessed output of your QI work: there is no separate written report.</p>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
            infoBox('emerald',
                '<div class="font-bold text-sm text-emerald-800 mb-2 flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i>Key Capabilities (Higher)</div>' +
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
                '<div class="font-bold text-sm text-amber-800 mb-2 flex items-center gap-2"><i data-lucide="clipboard-list" class="w-4 h-4"></i>EM QIAT on ePortfolio</div>' +
                '<ul class="text-xs text-amber-700 space-y-1">' +
                '<li>• One form a year, completed before your ARCP and sent to a supervisor or assessor (Part B)</li>' +
                '<li>• Replaces the old QIP assessment form (2025 update, v7)</li>' +
                '<li>• Covers: your QI PDP for the year, QI education, project involvement, the QI Journey stages you gained experience in, reflections, and next year\'s PDP</li>' +
                '<li>• The form itself says it is not mandatory to lead a QI project in every year of training</li>' +
                '<li>• Draft it on SLO 11 Sign-off in this app, then paste into risr/advance</li>' +
                '</ul>'
            ) +
            '</div>' +
            source('RCEM Emergency Medicine Training Curriculum, 2025 update v1.5 (August 2025), and the EM QIAT 2025 v7 form. Stage wording summarised; check the curriculum for the exact descriptors.', 'https://rcem.ac.uk/em-curriculum/'),
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
            '<tr><td class="p-2.5 border border-slate-200 font-medium">ACCS</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Contribution to departmental project; reflection; QIAT submitted</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Active role with documented impact; patient safety reflection</td></tr>' +
            '<tr class="bg-slate-50"><td class="p-2.5 border border-slate-200 font-medium">Intermediate</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Participation in a QI project linked to the QI Journey stages you chose; multidisciplinary working; reflection on the methods; QIAT completed</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Run chart; stakeholder engagement; results presented to the department</td></tr>' +
            '<tr><td class="p-2.5 border border-slate-200 font-medium">Higher</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Lead a QI project with mature reflection; multidisciplinary working; account of the QI methods and leadership skills used</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">Interdisciplinary team; SPC charts; governance involvement; spread plan</td></tr>' +
            '<tr class="bg-slate-50"><td class="p-2.5 border border-slate-200 font-medium">Final year (pre-CCT)</td>' +
            '<td class="p-2.5 border border-slate-200 text-slate-600">As for Higher, plus a summary of your QI and leadership development across the whole of EM training, with specific examples; QIAT completed</td>' +
            '<td class="p-2.5 border border-slate-200 text-emerald-700"><strong>Diverse QI methods tailored to the problem; regional or national presentation; innovation, team leadership or perseverance; contribution to the department\'s improvement strategy; higher-level QI learning such as coaching</strong></td></tr>' +
            '</tbody></table></div>' +
            '<p class="text-[11px] text-slate-400 mt-2 sm:hidden">Swipe the table sideways to see all three columns.</p>',
            'mb-6'
        );

    return '<div class="space-y-6">' +
        card(sectionHead('layers', 'What is Expected at Each Stage?', 'blue') + stages) +
        slo11 + arcp +
        infoBox('indigo',
            '<div class="flex items-start gap-3">' +
            '<i data-lucide="info" class="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5"></i>' +
            '<div><p class="text-sm text-indigo-800 font-semibold">2025 Curriculum Update</p>' +
            '<p class="text-xs text-indigo-700 mt-1 leading-relaxed">The RCEM 2021 curriculum had a 2025 update, and the EM QIAT form was updated with it (v7). ' +
            'For SLO 11 the QIAT form replaces the older QIP assessment tool, and the acceptable evidence is broad: audit and re-audit, service evaluation, process improvement, guideline development and patient safety or experience work all count. ' +
            'Always verify current requirements at <strong>rcem.ac.uk/em-curriculum</strong>.</p>' +
            '</div></div>'
        ) +
        '</div>';
}

// ─── Tab: National QIPs ───────────────────────────────────────────────────────

function tabNational() {
    var topics2026 =
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">' +

        '<div class="bg-rose-50 border border-rose-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-rose-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="heart" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-rose-800">Adolescent Mental Health <span class="text-xs font-semibold text-rose-500">(year 1)</span></div>' +
        '<p class="text-xs text-rose-700 mt-1.5 leading-relaxed">Pathways, safety assessment and outcomes for adolescents presenting with mental health crises.</p>' +
        '</div>' +

        '<div class="bg-teal-50 border border-teal-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="users" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-teal-800">Care of Older People <span class="text-xs font-semibold text-teal-500">(year 4)</span></div>' +
        '<p class="text-xs text-teal-700 mt-1.5 leading-relaxed">Assessment, management and experience of older patients in the emergency department.</p>' +
        '</div>' +

        '<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">' +
        '<div class="w-9 h-9 bg-amber-600 rounded-lg flex items-center justify-center mb-2">' +
        '<i data-lucide="pill" class="w-4 h-4 text-white"></i></div>' +
        '<div class="font-bold text-sm text-amber-800">Time Critical Medication <span class="text-xs font-semibold text-amber-500">(year 3)</span></div>' +
        '<p class="text-xs text-amber-700 mt-1.5 leading-relaxed">Timely administration of medicines where a delay harms patients, such as Parkinson\'s medication and insulin.</p>' +
        '</div>' +

        '</div>';

    var dates =
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">' +
        infoBox('blue',
            '<div class="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i>How a cycle runs</div>' +
            '<ul class="text-xs text-blue-800 space-y-1">' +
            '<li>• Each topic runs for a calendar year with a standardised data collection tool</li>' +
            '<li>• Registration, the data tool and this year\'s opening and closing dates are on the RCEM QIP Portal</li>' +
            '<li>• Topics are chosen through the annual RCEM QI Topic Competition, open to members</li>' +
            '</ul>'
        ) +
        infoBox('slate',
            '<div class="font-bold text-sm text-slate-800 mb-2 flex items-center gap-2"><i data-lucide="mail" class="w-4 h-4"></i>Registration</div>' +
            '<p class="text-xs text-slate-600 mb-2">UK Type 1 Emergency Departments register through the portal; each department chooses which of the three topics to take part in.</p>' +
            '<a href="https://rcemqip.rcem.ac.uk/" target="_blank" rel="noopener" ' +
            'class="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-rcem-purple hover:underline">' +
            '<i data-lucide="external-link" class="w-3 h-3"></i>RCEM QIP Portal (rcemqip.rcem.ac.uk)</a>'
        ) +
        '</div>';

    var diff = card(
        sectionHead('shuffle', 'How National QIPs Differ from Trainee QIPs', 'indigo') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div>' +
        '<div class="font-semibold text-sm text-indigo-700 mb-2">RCEM National QIP</div>' +
        bullets('indigo', [
            'Set topic determined by RCEM each year',
            'Standardised data collection tool used nationally',
            'Results benchmarked against other EDs',
            'Primarily a departmental activity',
            'Good portfolio evidence of participation',
            'Does NOT replace your individual trainee QIP'
        ]) +
        '</div>' +
        '<div>' +
        '<div class="font-semibold text-sm text-purple-700 mb-2">Individual Trainee QIP</div>' +
        bullets('purple', [
            'Your own identified clinical problem',
            'You design the data collection and analysis',
            'Demonstrates personal leadership and QI skills',
            'Evidence for SLO 11 and the EM QIAT',
            'Shows iterative PDSA cycles',
            'Presented at governance, a regional day or a conference; no separate written report is assessed'
        ]) +
        '</div></div>' +
        infoBox('green',
            '<p class="text-xs text-green-800"><strong>Tip:</strong> Participating in a national QIP can form the <em>foundation</em> of your individual trainee project. ' +
            'Use the national data collection as your baseline, then apply your own PDSA cycles to make local improvements around that topic. ' +
            'This gives you national benchmarking AND individual project ownership.</p>'
        ),
        'mt-4'
    );

    return '<div class="space-y-6">' +
        card(
            '<div class="flex items-start justify-between gap-4 mb-4 flex-wrap">' +
            '<div>' + sectionHead('building-2', 'RCEM National Quality Improvement Programmes 2026', 'teal') + '</div>' +
            '<a href="https://rcemqip.rcem.ac.uk/" target="_blank" rel="noopener" ' +
            'class="flex-shrink-0 text-xs font-semibold text-teal-600 hover:underline flex items-center gap-1">' +
            '<i data-lucide="external-link" class="w-3 h-3"></i>RCEM QIP Portal</a></div>' +
            '<p class="text-sm text-slate-600 mb-4 leading-relaxed">RCEM runs three national QIP topics each year. ' +
            'All Type 1 EDs in the UK are eligible and encouraged to participate. Each cycle runs for one calendar year with standardised data collection.</p>' +
            topics2026 + dates +
            source('RCEM QIP Portal, topics as listed in October 2026 (Adolescent Mental Health year 1, Care of Older People year 4, Time Critical Medication year 3). Dates change each cycle, so they are not repeated here.', 'https://rcemqip.rcem.ac.uk/')
        ) + diff + '</div>';
}

// ─── Tab: QI Methods ──────────────────────────────────────────────────────────

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
            'Answer all three questions before you test a change. Collecting baseline data is part of answering the second question, so it comes early.</p>'
        ) +
        source('Langley GJ, Moen RD, Nolan KM, Nolan TW, Norman CL, Provost LP. The Improvement Guide, 2nd ed. Jossey-Bass, 2009; IHI, "How to Improve: Model for Improvement".', 'https://www.ihi.org/library/model-for-improvement'),
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
            '<p class="text-xs text-amber-800"><strong>Tip:</strong> Each PDSA cycle must be distinct and documented with predictions, results, and a clear rationale for the Act decision. ' +
            'RCEM sets no number of cycles: run as many as it takes to see a sustained shift, with each one building on the last. Most first projects need three or more. ' +
            'Use the Change Ideas board in this app to document each cycle properly.</p>'
        ) +
        infoBox('rose',
            '<p class="text-xs text-rose-800"><strong>What the evidence says about PDSA in practice:</strong> a systematic review of 73 published healthcare PDSA projects found that fewer than one in five fully followed the method; many ran a single cycle, did not test on a small scale first, or did not use data over time. ' +
            'Reed and Card argue the method looks simple but is hard to do well, and that documenting a prediction and what you learned from each cycle is what separates a real PDSA from "we tried something".</p>' +
            source('Taylor MJ et al. BMJ Qual Saf 2014;23:290–8 (PMID 24025320); Reed JE, Card AJ. BMJ Qual Saf 2016;25:147–52 (PMID 26700542).', pubmed('24025320'))
        ),
        'mb-6'
    );

    var driver = card(
        sectionHead('git-branch', 'Driver Diagrams', 'violet') +
        '<p class="text-sm text-slate-600 mb-4 leading-relaxed">A driver diagram is a visual map connecting your project Aim to the factors (drivers) that influence it, ' +
        'and the specific changes you will test. It is the most important planning tool in QI and gives you a clear account of your project for the EM QIAT form.</p>' +

        '<div class="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4 overflow-x-auto">' +
        '<div class="flex items-center gap-3 text-xs font-semibold text-center min-w-[520px]">' +
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

        bullets('violet', [
            '<strong>Aim:</strong> Your overall project goal (SMART format)',
            '<strong>Primary Drivers:</strong> Major categories of factors that contribute to the problem (usually 3–5)',
            '<strong>Secondary Drivers:</strong> Specific factors within each primary driver category',
            '<strong>Change Ideas:</strong> Concrete interventions linked to secondary drivers — each one tested via a PDSA cycle'
        ]) +
        '<div class="mt-3">' + appLink('tools', 'Build yours on Diagnosis Tools') + '</div>',
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
        '</div>' +
        infoBox('slate',
            '<p class="text-xs text-slate-700"><strong>Measurement for improvement is not measurement for research or for accountability.</strong> Solberg, Mosser and McDonald set out the difference: improvement measurement uses small samples, collected often, with just enough data to learn, and accepts that confounders are "consistent" rather than controlled. You do not need a power calculation or a p-value; you need a stable baseline, a consistent definition and a chart over time.</p>' +
            source('Solberg LI, Mosser G, McDonald S. The three faces of performance measurement: improvement, accountability, and research. Jt Comm J Qual Improv 1997;23:135–47 (PMID 9103968).', pubmed('9103968'))
        ) +
        '<div class="mt-3">' + appLink('charts', 'How to read the chart once you have the data') + '</div>'
    );

    var otherApproaches = card(
        sectionHead('layers', 'Other improvement approaches you will hear about', 'teal') +
        '<p class="text-sm text-slate-600 mb-3 leading-relaxed">The Model for Improvement is what RCEM expects for a trainee QIP, but EDs also use these. Knowing the words helps when the Trust improvement team talks to you, and the EM QIAT "excellent" descriptor rewards choosing methods that fit the problem.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        [
            ['Lean', 'Removes waste and waiting from a process by mapping the flow and fixing the steps that add no value. Process mapping, 5S (sort, set in order, shine, standardise, sustain) and visual management come from Lean. Good for flow problems: time to triage, time to CT, discharge delays.'],
            ['Six Sigma (DMAIC)', 'Define, Measure, Analyse, Improve, Control. A data-heavy approach that reduces variation. The DMAIC steps map closely onto the eight steps in this app; the statistics are usually more than a trainee project needs.'],
            ['Experience-based co-design', 'Patients and staff design the change together, often starting from filmed patient stories. Strong for experience problems (waiting-room communication, discharge information). Needs more time than one rotation usually allows, but a light version is worth doing for any patient-facing change.'],
            ['Human factors (SEIPS)', 'Looks at the work system (people, tasks, tools, environment, organisation) rather than blaming individuals. Useful when the "cause" of an error is really a badly designed process or equipment. SEIPS 2.0 is the standard framework.'],
            ['Clinical audit', 'Measures practice against an explicit standard and feeds the result back. A baseline audit is a good start for a QIP, but audit alone has no tests of change; see Audit, QI or research?.'],
            ['Safety-II and learning from excellence', 'Studies why things usually go right rather than only why they go wrong. Appreciative inquiry and "learning from excellence" reports are a practical form of this; good for culture-focused projects.']
        ].map(function(a) {
            return '<div class="bg-teal-50 rounded-lg p-3 border border-teal-100"><div class="font-bold text-xs text-teal-800 mb-1">' + a[0] + '</div><p class="text-xs text-teal-700 leading-relaxed">' + a[1] + '</p></div>';
        }).join('') +
        '</div>' +
        source('Health Foundation. Quality improvement made simple (2021 edition), section 4 "Approaches and methods"; Holden RJ et al. SEIPS 2.0. Ergonomics 2013;56:1669–86 (PMID 24088063).', 'https://www.health.org.uk/publications/quality-improvement-made-simple')
    );

    var pitfalls = card(
        sectionHead('alert-circle', 'Common Pitfalls to Avoid', 'rose') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        [
            ['Only one audit cycle', 'A single audit and re-audit is not a QIP. You need repeated PDSA cycles with evidence of iterative improvement and learning between them.'],
            ['No PDSA predictions', 'Every PDSA cycle must start with a specific prediction. "We expected improvement" is not a prediction. State exactly what you expected to happen and why.'],
            ['No annotated charts', 'A table of before-and-after numbers does not show whether a change worked. Plot your data over time with PDSA cycle dates marked. Use the Data view in this app to generate run/SPC charts.'],
            ['Vague team description', 'List every team member with their role and specific contribution. The EM QIAT asks how you worked with the team, including how you handled resistance or disagreement.'],
            ['No balancing measure', 'Failing to monitor unintended consequences is a common oversight. Always include at least one balancing measure (e.g. did your intervention affect another process negatively?).'],
            ['Unsupported aim', 'Your SMART aim must be directly supported by your baseline data. State the gap between your baseline and your target and say why that target is realistic.'],
            ['Education as the only change', 'Teaching sessions wear off within weeks. They are a fine first cycle, but a project whose only change is "we taught people" rarely shows a sustained shift. Pair it with a system change: a prompt, a kit, a protocol, a role.'],
            ['Too big for the rotation', 'A project that needs the whole hospital to change will not show a result in six months. Narrow it to one area, one shift pattern or one patient group, show the shift there, then write the spread plan.']
        ].map(function(p) {
            return '<div class="bg-rose-50 rounded-lg p-3 border border-rose-100">' +
                '<div class="font-bold text-xs text-rose-800 mb-1 flex items-center gap-1.5">' +
                '<i data-lucide="x-circle" class="w-3.5 h-3.5 flex-shrink-0"></i>' + p[0] + '</div>' +
                '<p class="text-xs text-rose-700 leading-relaxed">' + p[1] + '</p></div>';
        }).join('') +
        '</div>'
    );

    return '<div class="space-y-6">' + mfi + pdsa + driver + measures + otherApproaches + pitfalls + '</div>';
}

// ─── Tab: QI Tools ────────────────────────────────────────────────────────────

function tabTools() {
    var tools = [
        {
            icon: 'fish', color: 'blue', name: 'Fishbone (Ishikawa) Diagram',
            what: 'A cause-and-effect diagram that organises potential root causes into categories (e.g. People, Process, Environment, Equipment). Excellent for identifying why a problem exists before designing solutions.',
            when: 'Problem analysis phase — after identifying your problem and before choosing interventions.',
            nav: 'Diagnosis Tools → Fishbone',
            tips: 'Use 5–6 main branches. Each branch should have 2–4 specific causes. Connect the strongest causes to your secondary drivers.'
        },
        {
            icon: 'map', color: 'cyan', name: 'Process Map',
            what: 'A flow diagram of every step a patient or sample actually goes through, drawn with the people who do the work. Shows waits, loops, duplicated steps and the points where things go wrong.',
            when: 'Early, once you know the problem; it usually reveals causes the team had not noticed and tells you where a change would bite.',
            nav: 'Diagnosis Tools → Process Map',
            tips: 'Walk the process yourself on one shift and map what happens, not what the guideline says should happen. Mark the time each step takes.'
        },
        {
            icon: 'help-circle', color: 'lime', name: '5 Whys',
            what: 'Ask "why?" of a problem, then of each answer, about five times until you reach a cause you can act on. Quick, needs no tools, and good at getting past "staff did not follow the guideline".',
            when: 'When one specific failure keeps recurring and you need its root cause fast.',
            nav: 'Diagnosis Tools → 5 Whys',
            tips: 'Stop when the answer is a system or design issue, not a person. Several branches are fine; a real problem often has more than one chain.'
        },
        {
            icon: 'grid-2x2', color: 'emerald', name: 'SWOT Analysis',
            what: 'Analyses Strengths, Weaknesses, Opportunities, and Threats around your project or proposed change. Useful for feasibility assessment and stakeholder communication.',
            when: 'Early planning phase to justify your approach and identify barriers.',
            nav: 'Define & Measure → SWOT/PEST panel',
            tips: 'Strengths and Weaknesses are internal; Opportunities and Threats are external. Be specific — "strong MDT relationships" is better than "good team".'
        },
        {
            icon: 'globe', color: 'violet', name: 'PEST Analysis',
            what: 'Analyses Political, Economic, Social, and Technological factors that may affect your project. Broadens thinking beyond the immediate clinical environment.',
            when: 'Particularly useful for projects with policy, funding, or system-wide implications.',
            nav: 'Define & Measure → toggle to PEST mode',
            tips: 'Consider NHS policy direction, ICS priorities, and national targets. Political factors in the NHS include NHSE guidance and RCEM standards.'
        },
        {
            icon: 'alert-triangle', color: 'amber', name: 'FMEA (Failure Modes & Effects Analysis)',
            what: 'A proactive risk assessment tool. Identifies what could go wrong with a proposed change, how likely it is, how severe the impact would be, and how detectable it is. Produces a Risk Priority Number (RPN) for each failure mode.',
            when: 'Before implementing a change, particularly for patient safety-critical interventions.',
            nav: 'Define & Measure → FMEA section',
            tips: 'Score Likelihood × Severity × Detectability (1–5 each, so the maximum RPN is 125). Address failure modes with the highest RPN first. Document mitigations for each.'
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
            tips: 'Annotate your PDSA cycle start dates as vertical lines. A run of ' + QI.RUN_SHIFT + ' or more points above or below the median (a shift), or ' + QI.RUN_TREND + ' or more all rising or falling (a trend), is a signal of real change. Collect ' + QI.BASELINE_MIN + ' to ' + QI.BASELINE_TARGET + ' baseline points before your first change.'
        },
        {
            icon: 'activity', color: 'indigo', name: 'SPC Chart (Statistical Process Control)',
            what: 'A run chart with statistically calculated control limits (UCL/LCL, ±3σ). The app checks four standard SPC signals: a point outside limits, ' + QI.SPC_RUN + ' points on one side of the mean, 2 of 3 points beyond 2σ on the same side, and a moving range greater than 3.27 × the average moving range.',
            when: 'When you have ' + QI.SPC_MIN + ' to 20 or more data points and want to show statistical evidence of a change. Limits calculated across all your points will blur a real improvement; the run chart is enough for most first projects.',
            nav: 'Data → Chart type → SPC',
            tips: 'Annotated run or SPC charts are the strongest evidence of improvement. SPC charts are particularly persuasive. Aim for data collected at regular intervals throughout your project and investigate every special-cause signal in context.'
        },
        {
            icon: 'users', color: 'teal', name: 'Stakeholder Analysis',
            what: 'Maps all individuals and groups with an interest in your project by their level of influence and interest. Used to plan engagement, communication, and anticipate resistance.',
            when: 'Early in the project to plan your engagement strategy. Revisit when implementing changes.',
            nav: 'Stakeholders view',
            tips: 'Map on a 2×2 grid: High influence/High interest = manage closely; High influence/Low interest = keep satisfied. Document your engagement plan for each stakeholder group.'
        },
        {
            icon: 'calendar-range', color: 'orange', name: 'Gantt Chart',
            what: 'A timeline of tasks with start and end dates, owners and milestones. Shows the project was planned around the rotation, and makes the handover date visible from day one.',
            when: 'At the start, then update it when a PDSA cycle slips.',
            nav: 'Timeline view (use "Draft a timeline" to start from your rotation end date)',
            tips: 'Work backwards from the rotation end: handover two weeks before, results review before that, then the PDSA cycles, then the baseline weeks.'
        },
        {
            icon: 'users-round', color: 'cyan', name: 'Inter-Rater Reliability (Kappa)',
            what: 'A statistic (Cohen\'s Kappa) that measures how much two or more assessors agree when independently rating or classifying the same thing, correcting for the agreement expected by chance alone. Relevant when your data depends on subjective judgement — e.g. two clinicians independently scoring the same screening tool, or grading the same audio-recorded assessment.',
            when: 'Projects with a subjective assessment or classification step (e.g. deciding whether a screening tool was used "correctly", or grading a simulation). Not needed for straightforward counts, times, or percentages.',
            nav: 'Not built into this app\'s chart tools — calculate separately (e.g. in Excel/SPSS/R) and report the Kappa value in your interpretation.',
            tips: 'Kappa runs from -1 to 1: below 0.4 is generally considered poor agreement, 0.4-0.75 fair-to-good, above 0.75 excellent. Use it to justify why a single rater\'s subjective judgement is (or is not) trustworthy as a measure.'
        }
    ];

    var html = '<div class="grid grid-cols-1 gap-4">';
    tools.forEach(function(t) {
        html +=
            '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
            '<div class="flex items-center gap-3 px-4 sm:px-5 py-3 bg-' + t.color + '-50 border-b border-' + t.color + '-100 flex-wrap">' +
            '<div class="w-8 h-8 bg-' + t.color + '-600 rounded-lg flex items-center justify-center flex-shrink-0">' +
            '<i data-lucide="' + t.icon + '" class="w-4 h-4 text-white"></i></div>' +
            '<div class="font-bold text-sm text-' + t.color + '-800">' + t.name + '</div>' +
            '<span class="sm:ml-auto text-xs text-' + t.color + '-600 font-medium w-full sm:w-auto">In the app: ' + t.nav + '</span>' +
            '</div>' +
            '<div class="px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">' +
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

// ─── Tab: Reading a chart ─────────────────────────────────────────────────────

function tabCharts() {
    var why = card(
        sectionHead('line-chart', 'Why a chart over time, not a before-and-after table', 'blue') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">Two numbers ("45% before, 70% after") cannot tell you whether the process changed or whether you happened to sample a good week. Plotting every point in time order shows the ordinary wobble of the process, the moment a change took hold, and whether it held. ' +
        'Perla, Provost and Murray describe the run chart as the simplest tool that does this "with minimal mathematical complexity", and it is what assessors expect to see.</p>' +
        bullets('blue', [
            'One point per week (or per shift for a high-volume process), each from the same kind of sample',
            QI.BASELINE_MIN + ' to ' + QI.BASELINE_TARGET + ' baseline points before the first change, so the median means something',
            'A vertical line and label on the chart for each PDSA cycle start; the app draws these from your cycle dates',
            'Keep the operational definition identical from the first point to the last'
        ]) +
        source('Perla RJ, Provost LP, Murray SK. The run chart: a simple analytical tool for learning from variation in healthcare processes. BMJ Qual Saf 2011;20:46–51 (PMID 21228075).', pubmed('21228075'))
    );

    var runRules = card(
        sectionHead('trending-up', 'Run chart rules the app applies', 'emerald') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The median of the baseline points is the reference line. A signal is a pattern that would be unlikely if nothing had changed. The app looks for three:</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">' +
        '<div class="bg-amber-50 border border-amber-200 rounded-xl p-3"><div class="font-bold text-sm text-amber-800 mb-1">Shift</div><p class="text-xs text-amber-700 leading-relaxed">' + QI.RUN_SHIFT + ' or more consecutive points on the same side of the median. Points exactly on the median are skipped. The usual sign that a change has moved the process.</p></div>' +
        '<div class="bg-orange-50 border border-orange-200 rounded-xl p-3"><div class="font-bold text-sm text-orange-800 mb-1">Trend</div><p class="text-xs text-orange-700 leading-relaxed">' + QI.RUN_TREND + ' or more consecutive points all going up or all going down. Repeated values count once. Suggests a gradual drift rather than a step.</p></div>' +
        '<div class="bg-red-50 border border-red-200 rounded-xl p-3"><div class="font-bold text-sm text-red-800 mb-1">Unusual point</div><p class="text-xs text-red-700 leading-relaxed">An "astronomical" point, obviously far from the rest. Not a statistical test: it is a prompt to find out what happened that week before you draw any conclusion.</p></div>' +
        '</div>' +
        infoBox('slate',
            '<p class="text-xs text-slate-700"><strong>What the app does not check:</strong> Perla\'s fourth rule, "too few or too many runs" (crossings of the median), which needs a lookup table. Anhøj and Olesen\'s simulation study found that the shift and trend rules carry most of the information, and that the exact thresholds matter less than applying them consistently and in advance. The thresholds above are the Perla ones; do not move them after you have seen the data.</p>' +
            source('Perla 2011 (above); Anhøj J, Olesen AV. Run charts revisited: a simulation study of run chart rules for detection of non-random variation in health care processes. PLoS One 2014;9:e113825 (PMID 25423037).', pubmed('25423037'))
        )
    );

    var spc = card(
        sectionHead('activity', 'SPC (XmR) charts: when the run chart is not enough', 'indigo') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">An SPC chart adds control limits at ±3 sigma, calculated from the average moving range between consecutive points rather than from the standard deviation of the whole series. ' +
        'Benneyan, Lloyd and Plsek set out why this is the right tool for improvement work: the limits describe what the process can produce when nothing special is happening, so a point outside them, or a run inside them, is a signal.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">' +
        '<div>' +
        '<div class="font-semibold text-xs text-slate-700 mb-1">Signals the app checks</div>' +
        bullets('indigo', [
            'One point outside the upper or lower control limit',
            QI.SPC_RUN + ' consecutive points on one side of the mean',
            '2 of 3 consecutive points beyond 2 sigma on the same side',
            'A moving range larger than 3.27 × the average moving range'
        ]) + '</div>' +
        '<div>' +
        '<div class="font-semibold text-xs text-slate-700 mb-1">Good practice</div>' +
        bullets('indigo', [
            'Wait for about ' + QI.SPC_MIN + ' points before trusting the limits; they are provisional below that',
            'Freeze the limits on the baseline so a real improvement shows as points beyond them; the app does this once you have ' + QI.BASELINE_MIN + ' baseline points',
            'For a percentage from a varying denominator, a p-chart is more exact; the XmR chart is a reasonable general-purpose approximation and is what the app draws',
            'Investigate every signal in context; a signal in the wrong direction is as important as one in the right direction'
        ]) + '</div>' +
        '</div>' +
        source('Benneyan JC, Lloyd RC, Plsek PE. Statistical process control as a tool for research and healthcare improvement. Qual Saf Health Care 2003;12:458–64 (PMID 14645763); Provost LP, Murray SK. The Health Care Data Guide. Jossey-Bass, 2011 (book; chart-selection guidance).', pubmed('14645763'))
    );

    var reading = card(
        sectionHead('eye', 'Reading your own chart: a four-question routine', 'violet') +
        '<div class="space-y-3">' +
        stepBox(1, 'violet', 'Is the baseline stable?', 'Ten or more points scattered either side of the median with no shift or trend. If the baseline is already improving (or getting worse), say so; a change tested on a moving baseline is hard to interpret.') +
        stepBox(2, 'violet', 'Does a signal start at, or shortly after, a PDSA line?', 'A shift that begins the week you introduced the trolley is evidence for the trolley. A shift that began three weeks before is something else: a staffing change, a new consultant, winter.') +
        stepBox(3, 'violet', 'Is the balancing measure quiet?', 'Common-cause variation on the balancing chart is what you want. A shift there is a cost of your change and goes in the interpretation, not in a footnote.') +
        stepBox(4, 'violet', 'Has it held?', 'A shift that lasts six points then returns to the old median is a fade, typical of education-only changes. Sustained means the new level is still there when you hand over.') +
        '</div>' +
        '<div class="mt-3 flex flex-wrap gap-3">' + appLink('data', 'Open Data & SPC') + appLink('example', 'See the worked example chart') + '</div>'
    );

    var words = card(
        sectionHead('pen-line', 'Saying it in words', 'rose') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The interpretation box on Data & SPC should name the signal, the rule, the point count and the most likely cause. Templates are built in ("Shift", "Trend", "No change yet", "Unusual point"). A good sentence looks like:</p>' +
        '<div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 italic leading-relaxed">"From week 14 the outcome measure shows a shift: ' + QI.RUN_SHIFT + ' consecutive points above the baseline median of 42%, beginning the week the sepsis trolley was introduced (PDSA 2a). The balancing measure shows only common-cause variation over the same period."</div>' +
        '<p class="text-xs text-slate-500 mt-3 leading-relaxed">Avoid "significant" unless you mean a run-chart or SPC signal; avoid percentages of percentages ("a 117% improvement") in favour of the two medians; and never drop points that spoil the picture. If a week was unusual, keep the point and annotate it.</p>'
    );

    return '<div class="space-y-6">' + why + runRules + spc + reading + words + '</div>';
}

// ─── Tab: People & change ─────────────────────────────────────────────────────

function tabPeople() {
    var ten = card(
        sectionHead('alert-octagon', 'Why improvement projects stall: ten challenges', 'rose') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The Health Foundation evaluated a decade of funded improvement programmes. Dixon-Woods, McNicol and Martin summarised the recurring problems. Most of them are about people and organisations, not about the QI method, which is why the EM QIAT asks about leadership, the team and resistance as much as about charts.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        [
            ['Convincing people there is a problem', 'Use your own baseline data and a patient story; a national standard alone rarely persuades the people doing the work.'],
            ['Convincing people the solution is right', 'A small test with a visible result is more convincing than a slide deck. "Try it for one week" is the classic ask.'],
            ['Data collection and monitoring systems', 'Decide early who collects what, how often and from where; the project that dies most often is the one whose data stop.'],
            ['Excess ambition and "projectness"', 'Over-scoped projects, and projects seen as "the registrar\'s thing" that end when they rotate.'],
            ['Organisational context, culture and capacity', 'A department under pressure has little capacity for change; choose timing and scope to match.'],
            ['Tribalism and lack of staff engagement', 'Nurses, doctors, pharmacists and porters each have a stake; a doctor-only team misses most of the process.'],
            ['Leadership', 'A consultant sponsor who will unblock things is the single most protective factor in a trainee project.'],
            ['Incentives, penalties and sanctions', '"Carrots and sticks" both have side effects; make the right thing the easy thing instead.'],
            ['Securing sustainability', 'See Sustain & spread: build the change into the system, not into one person.'],
            ['Side effects of change', 'Your balancing measure exists for this; look for who is worse off.']
        ].map(function(x, i) {
            return '<div class="bg-rose-50 rounded-lg p-3 border border-rose-100 flex gap-2"><span class="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">' + (i + 1) + '</span><div><div class="font-bold text-xs text-rose-800">' + x[0] + '</div><p class="text-xs text-rose-700 leading-relaxed mt-0.5">' + x[1] + '</p></div></div>';
        }).join('') +
        '</div>' +
        source('Dixon-Woods M, McNicol S, Martin G. Ten challenges in improving quality in healthcare: lessons from the Health Foundation\'s programme evaluations and relevant literature. BMJ Qual Saf 2012;21:876–84 (PMC3461644). The one-line advice under each challenge is this app\'s, not the paper\'s.', 'https://qualitysafety.bmj.com/content/21/10/876')
    );

    var kotter = card(
        sectionHead('footprints', 'Kotter\'s eight steps, translated for an ED project', 'blue') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">Kotter\'s 1995 model of organisational change is the one most often quoted in QI teaching and in the EM QIAT "leadership" descriptors. The steps, with what each looks like for a trainee QIP:</p>' +
        '<div class="space-y-2">' +
        [
            ['Establish a sense of urgency', 'Share the baseline chart and one real case at the governance meeting.'],
            ['Form a powerful guiding coalition', 'Sponsor, nurse lead, pharmacist or the person who owns the process; add them on Team & Leadership.'],
            ['Create a vision', 'The SMART aim, in one sentence everyone can repeat.'],
            ['Communicate the vision', 'Huddles, a poster by the trolley, the ED newsletter; log each one in the Leadership Engagement Log.'],
            ['Empower others to act', 'Let the nurses redesign the trolley; remove the step that needed a doctor\'s signature.'],
            ['Plan for and create short-term wins', 'Your first PDSA result, shown on the chart within weeks, is the win.'],
            ['Consolidate improvements and produce more change', 'Each adopted change leads to the next cycle; the driver diagram shows what is left.'],
            ['Institutionalise new approaches', 'Induction, the EPR, the standard operating procedure, a named owner after you leave.']
        ].map(function(s, i) {
            return '<div class="flex gap-3 items-start"><span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">' + (i + 1) + '</span><div class="min-w-0"><span class="font-bold text-xs text-slate-800">' + s[0] + '.</span> <span class="text-xs text-slate-600">' + s[1] + '</span></div></div>';
        }).join('') +
        '</div>' +
        source('Kotter JP. Leading change: why transformation efforts fail. Harvard Business Review 1995;73(2):59–67. The ED translations are this app\'s.', 'https://psnet.ahrq.gov/issue/leading-change-why-transformation-efforts-fail')
    );

    var psych = card(
        sectionHead('heart-handshake', 'IHI Psychology of Change: five things that make people want to change', 'emerald') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">' +
        [
            ['Unleash intrinsic motivation', 'Connect the change to why people came into the job, not to a target.'],
            ['Co-design people-driven change', 'The people who do the work design the change with you.'],
            ['Co-produce in authentic relationship', 'Patients and staff as partners, not subjects.'],
            ['Distribute power', 'Give the team real decisions: what to test, when to stop.'],
            ['Adapt in action', 'Small tests, learn, adjust; the PDSA cycle is a psychological tool as well as a scientific one.']
        ].map(function(x) {
            return '<div class="bg-emerald-50 rounded-lg p-3 border border-emerald-100"><div class="font-bold text-xs text-emerald-800 mb-1">' + x[0] + '</div><p class="text-xs text-emerald-700 leading-relaxed">' + x[1] + '</p></div>';
        }).join('') +
        '</div>' +
        source('Hilton K, Anderson A. IHI Psychology of Change Framework to Advance and Sustain Improvement. IHI white paper, 2018.', 'https://www.ihi.org/library/white-papers/ihi-psychology-change-framework')
    );

    var adoption = card(
        sectionHead('sparkles', 'What makes a change idea easy to adopt', 'violet') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">Greenhalgh and colleagues\' review of how innovations spread in health services confirmed Rogers\' five attributes. Test your change idea against them before the first PDSA:</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        [
            ['Relative advantage', 'Is it clearly better for the person using it, not only for the patient or the audit?'],
            ['Compatibility', 'Does it fit how the shift already runs, or does it add a step?'],
            ['Complexity', 'Can someone use it correctly the first time without training?'],
            ['Trialability', 'Can it be tried on one shift and dropped if it fails?'],
            ['Observability', 'Can staff see it working: a chart on the wall, a case at handover?']
        ].map(function(x) {
            return '<div class="bg-violet-50 rounded-lg p-3 border border-violet-100"><div class="font-bold text-xs text-violet-800 mb-1">' + x[0] + '</div><p class="text-xs text-violet-700 leading-relaxed">' + x[1] + '</p></div>';
        }).join('') +
        '</div>' +
        source('Greenhalgh T, Robert G, Macfarlane F, Bate P, Kyriakidou O. Diffusion of innovations in service organizations: systematic review and recommendations. Milbank Q 2004;82:581–629.', 'https://doi.org/10.1111/j.0887-378X.2004.00325.x')
    );

    var resistance = card(
        sectionHead('shield', 'Handling resistance (and writing about it for the EM QIAT)', 'amber') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The EM QIAT asks how you worked with the team and what you did about disagreement. Resistance is usually information: the person objecting knows something about the process that you do not.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div>' +
        '<div class="font-semibold text-xs text-slate-700 mb-1">What usually works</div>' +
        bullets('amber', [
            'Ask what would have to be true for them to support it, then test that',
            'Bring the data, not the standard: "we are at 42%" lands better than "RCEM says 100%"',
            'Make the objector part of the design of the next cycle',
            'Shrink the ask: one shift, one bay, two weeks, then review together',
            'Use the sponsor for the things only a consultant can unblock, not for persuasion'
        ]) + '</div>' +
        '<div>' +
        '<div class="font-semibold text-xs text-slate-700 mb-1">How to record it</div>' +
        bullets('amber', [
            'Log the conversation in the Leadership Engagement Log on the day',
            'Note what you changed because of it; that is the reflection assessors want',
            'Stakeholder map: move the person as their position changes',
            'Keep names out of anything that leaves the department'
        ]) + '</div>' +
        '</div>' +
        '<div class="mt-3 flex flex-wrap gap-3">' + appLink('team', 'Team & Leadership') + appLink('stakeholders', 'Stakeholders') + '</div>'
    );

    var raci = card(
        sectionHead('grid-3x3', 'RACI chart: who does what', 'indigo') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">A RACI chart lists the project\'s tasks, decisions and milestones down the side and the people or groups across the top. Each square says how that person is involved in that task. It is a project-management tool: it makes roles clear, shows gaps and duplication, and helps the people around the project understand how they will be involved.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">' +
        [
            ['R', 'Responsible', 'Does the work. More than one person can be Responsible.', 'bg-indigo-50 border-indigo-100', 'bg-indigo-600'],
            ['A', 'Accountable', 'Owns the task and gives final approval. Normally one person per task.', 'bg-rose-50 border-rose-100', 'bg-rose-600'],
            ['C', 'Consulted', 'Asked for advice before decisions or actions. Two-way. Use sparingly: long consultation lists slow decisions.', 'bg-amber-50 border-amber-100', 'bg-amber-600'],
            ['I', 'Informed', 'Kept up to date on progress or outcomes. One-way. Affected, but not doing the work or deciding.', 'bg-slate-50 border-slate-200', 'bg-slate-600']
        ].map(function(x) {
            return '<div class="' + x[3] + ' rounded-lg p-3 border flex gap-2"><span class="w-6 h-6 rounded-full ' + x[4] + ' text-white text-xs font-bold flex items-center justify-center flex-shrink-0">' + x[0] + '</span><div><div class="font-bold text-xs text-slate-800">' + x[1] + '</div><p class="text-xs text-slate-600 leading-relaxed mt-0.5">' + x[2] + '</p></div></div>';
        }).join('') +
        '</div>' +
        '<div class="font-semibold text-xs text-slate-700 mb-1">How to build one</div>' +
        bullets('indigo', [
            'List the people, groups or roles: sponsor, project lead, team members, stakeholders, experts, governance groups',
            'List the tasks, decisions and milestones, grouped by stage',
            'Assign R, A, C or I. Check every task has at least one R and exactly one A, and that C and I are proportionate',
            'Go through the draft with the team and key stakeholders: is ownership clear, are there gaps, are too many people involved in decisions?',
            'Treat it as a living document: review it when roles, stakeholders, scope or governance change'
        ]) +
        '<div class="font-semibold text-xs text-slate-700 mt-3 mb-1">In a trainee ED project</div>' +
        bullets('indigo', [
            'The consultant sponsor is often Accountable for decisions that change department practice; you are usually Responsible for running the project',
            'A change to medicines (a PGD, an order set) is normally signed off by a Trust committee, not by the project team; check your local governance',
            'If your name is in the R column for almost every task, the project will stop when you rotate. Share the doing early',
            'A RACI agreed with the team is useful evidence when you write about leadership, teamwork and project management in your EM QIAT reflections'
        ]) +
        '<div class="mt-3 flex flex-wrap gap-3">' + appLink('team', 'Open the RACI chart on Team & Leadership') + '</div>' +
        source('NHS Education for Scotland, Quality Improvement Zone: RACI matrix (definitions, the one-Accountable and at-least-one-Responsible checks, and the five steps). Safer Care Victoria QI Toolkit, Tool 21: RASCI matrix (adds "Supporting"; also advises limiting Consulted). The ED-specific advice is this app\'s.', 'https://learn.nes.nhs.scot/39904')
    );

    return '<div class="space-y-6">' + ten + kotter + raci + psych + adoption + resistance + '</div>';
}

// ─── Tab: Sustain & spread ────────────────────────────────────────────────────

function tabSustain() {
    var model = card(
        sectionHead('repeat', 'The NHS Sustainability Model: ten factors', 'emerald') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">Maher, Gustafson and Evans built the model from improvement projects that did and did not last. Score each factor for your project; a low score shows where the handover plan needs work. The app\'s Sustainability Plan field on Define & Measure is the place to write the answers.</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
        '<div class="bg-emerald-50 rounded-xl p-3 border border-emerald-100"><div class="font-bold text-xs text-emerald-800 mb-2 uppercase tracking-wide">Process</div>' +
        bullets('emerald', ['Credibility of the benefits', 'Benefits beyond helping patients', 'Effectiveness of the system to monitor progress', 'Adaptability of the improved process']) + '</div>' +
        '<div class="bg-teal-50 rounded-xl p-3 border border-teal-100"><div class="font-bold text-xs text-teal-800 mb-2 uppercase tracking-wide">Staff</div>' +
        bullets('teal', ['Staff involvement and training to sustain the process', 'Staff behaviours towards sustaining the change', 'Senior leadership engagement and support', 'Clinical leadership engagement and support']) + '</div>' +
        '<div class="bg-cyan-50 rounded-xl p-3 border border-cyan-100"><div class="font-bold text-xs text-cyan-800 mb-2 uppercase tracking-wide">Organisation</div>' +
        bullets('cyan', ['Fit with the organisation\'s strategic aims and culture', 'Infrastructure for sustainability']) + '</div>' +
        '</div>' +
        source('Maher L, Gustafson D, Evans A. NHS Sustainability Model and Guide. NHS Institute for Innovation and Improvement, 2010 (PDF on the NHS England Improvement Hub).', 'https://www.england.nhs.uk/improvement-hub/wp-content/uploads/sites/44/2017/11/NHS-Sustainability-Model-2010.pdf')
    );

    var practical = card(
        sectionHead('anchor', 'Making a change stick before you rotate', 'blue') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Build it into the system</div>' +
        bullets('blue', [
            'The EPR prompt, the pre-filled order set, the kit that is restocked by the stores system',
            'A standard operating procedure or guideline with a review date and an owner',
            'Induction slides for new doctors and nurses, so the change survives the next rotation',
            'The measure added to the departmental dashboard or monthly governance report'
        ]) + '</div>' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Give it a home</div>' +
        bullets('blue', [
            'A named owner (usually a nurse or a consultant, not the next registrar) for the measure and the kit',
            'A monitoring cadence: monthly for six months, then quarterly',
            'A trigger: "if the measure falls below X for two months, the owner re-runs the trolley check"',
            'The one-page handover note the app writes from the project, given to the owner and the sponsor'
        ]) + '</div>' +
        '</div>' +
        '<div class="mt-3">' + appLink('dashboard', 'Write the handover note from the dashboard') + '</div>'
    );

    var spread = card(
        sectionHead('share-2', 'Spread: the IHI framework', 'violet') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">Spread is taking a change that worked in one place to other places. The IHI Framework for Spread names seven components. For a trainee project, "spread" usually means the second ED in the Trust, or the acute medical unit; the EM QIAT "excellent" level rewards a credible plan more than a completed roll-out.</p>' +
        '<div class="flex flex-wrap gap-2 mb-3">' +
        ['Leadership', 'Set-up', 'Better ideas', 'Communication', 'Social system', 'Measurement and feedback', 'Knowledge management'].map(function(x) {
            return '<span class="bg-violet-50 border border-violet-200 text-violet-800 text-xs font-semibold px-2.5 py-1 rounded-full">' + x + '</span>';
        }).join('') + '</div>' +
        bullets('violet', [
            '<strong>Better ideas:</strong> package what worked (the trolley list, the PGD, the prompt), with the evidence chart',
            '<strong>Set-up:</strong> name the target sites and the person at each who will own it',
            '<strong>Social system:</strong> find the opinion leader at the next site; a peer carries a change further than a memo',
            '<strong>Measurement:</strong> the new site collects the same measure with the same definition from day one',
            '<strong>Knowledge management:</strong> the Trust QI team or shared drive holds the package after you go'
        ]) +
        source('Massoud MR, Nielsen GA, Nolan K, Schall MW, Sevin C. A Framework for Spread: From Local Improvements to System-Wide Change. IHI Innovation Series white paper, 2006.', 'https://www.ihi.org/library/white-papers/framework-spread-local-improvements-system-wide-change')
    );

    var evidence = card(
        sectionHead('book-open', 'What the research says', 'slate') +
        bullets('slate', [
            'Lennox, Maher and Reed reviewed 62 sustainability approaches and found most share the same constructs: monitoring, leadership, staff involvement, fit with the organisation and adapting the change over time. There is no single validated tool; using one consistently matters more than which one.',
            'Knudsen and colleagues\' review of published QI reports found many report improvement but few report whether it lasted or spread, which is why a follow-up measurement after handover is worth more than another PDSA cycle.',
            'Shah (BMJ 2020) argues for moving from one-off projects to improvement as "the way we work", which is what the EM QIAT\'s question about your department\'s improvement programme is getting at.'
        ]) +
        '<div class="text-[11px] text-slate-400 mt-3 leading-snug space-y-0.5">' +
        '<div><span class="font-semibold text-slate-500">Sources:</span> <a class="underline" target="_blank" rel="noopener" href="' + pubmed('29426341') + '">Lennox L, Maher L, Reed J. Implement Sci 2018;13:27 (PMID 29426341)</a>; ' +
        '<a class="underline" target="_blank" rel="noopener" href="' + pubmed('31585540') + '">Knudsen SV et al. BMC Health Serv Res 2019;19:683 (PMID 31585540)</a>; ' +
        '<a class="underline" target="_blank" rel="noopener" href="' + pubmed('32718988') + '">Shah A. How to move beyond quality improvement projects. BMJ 2020;370:m2319 (PMID 32718988)</a>.</div></div>'
    );

    return '<div class="space-y-6">' + model + practical + spread + evidence + '</div>';
}

// ─── Tab: Audit, QI or research? ──────────────────────────────────────────────

function tabEthics() {
    var defs = card(
        sectionHead('scale', 'Which is your project?', 'rcem-purple') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The category decides whether you need research ethics approval. The Health Research Authority (HRA) definitions, as used by NHS research offices:</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        [
            ['Research', 'Attempts to derive generalisable or transferable new knowledge, including hypothesis-testing studies. Needs HRA approval and usually a Research Ethics Committee opinion.', 'rose'],
            ['Clinical audit', 'Finds out whether care is being provided in line with an explicit standard, to enable improvement. No REC; register with the Trust audit department.', 'blue'],
            ['Service evaluation', 'Designed and conducted solely to define or judge current care, using routine data. No REC; register locally.', 'teal'],
            ['Quality improvement', 'Tests changes to routine care, measured over time, to improve a local service. Treated like audit and service evaluation: no REC, but local registration and Caldicott rules apply.', 'emerald']
        ].map(function(x) {
            return '<div class="bg-' + x[2] + '-50 border border-' + x[2] + '-200 rounded-xl p-3"><div class="font-bold text-sm text-' + x[2] + '-800 mb-1">' + x[0] + '</div><p class="text-xs text-' + x[2] + '-700 leading-relaxed">' + x[1] + '</p></div>';
        }).join('') +
        '</div>' +
        infoBox('amber',
            '<p class="text-xs text-amber-800"><strong>Use the HRA decision tool</strong> ("Is my study research?") and keep the printout; it is the usual evidence that your project did not need ethics approval. Save the result on Define & Measure, section 4.</p>' +
            '<a href="https://www.hra-decisiontools.org.uk/research/" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-900 underline"><i data-lucide="external-link" class="w-3 h-3"></i>hra-decisiontools.org.uk/research</a>'
        ) +
        source('HRA "Is my study research?" decision tool; definitions as summarised on NHS Trust R&D pages (for example Oxford Health NHS FT, "Is my project research?"). Wording is paraphrased; the tool\'s questions are what count.', 'https://www.hra-decisiontools.org.uk/research/')
    );

    var flags = card(
        sectionHead('flag', 'When to stop and ask the R&D office', 'rose') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">A QIP can drift into research without anyone noticing. Any of these means a conversation with your Trust research office before you collect data:</p>' +
        bullets('rose', [
            'You allocate patients to the change or to usual care at random, or by anything other than when they attend',
            'You collect data that routine care does not already generate (extra bloods, questionnaires about things not needed for care, follow-up phone calls that are not part of the service)',
            'You want to generalise beyond your department ("does this work in EDs?") rather than improve your service',
            'Identifiable patient data will leave the care team or the Trust, including to a cloud tool, a personal laptop or an AI service',
            'The change itself is an untested intervention, device or drug rather than a way of delivering agreed care',
            'You plan to publish and the journal asks for ethics approval; a documented decision-tool result and local registration usually satisfy them'
        ])
    );

    var caldicott = card(
        sectionHead('lock', 'Confidentiality and data: what to do in practice', 'blue') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Keep identifiers out</div>' +
        bullets('blue', [
            'Record a study number, the week and the measure; keep any key linking it to patients on a Trust system only',
            'This app is for the project, not for patient records: no names, hospital numbers, dates of birth or free text that could identify someone (the app warns on fields where this is a risk)',
            'Survey free text: remove names of staff and patients before pasting it anywhere',
            'Photos of charts or whiteboards must not show patient boards behind them'
        ]) + '</div>' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Caldicott principles, briefly</div>' +
        bullets('blue', [
            'Justify the purpose; use confidential information only when necessary',
            'Use the minimum necessary and give access on a need-to-know basis',
            'Everyone with access understands their responsibilities and the law',
            'The duty to share information for care can be as important as the duty to protect it',
            'Inform patients and service users about how their confidential information is used (added 2020)'
        ]) + '</div>' +
        '</div>' +
        source('National Data Guardian, The Caldicott Principles (eight principles, December 2020). Summarised; see the NDG publication for the full wording.', 'https://www.gov.uk/government/publications/the-caldicott-principles')
    );

    var register = card(
        sectionHead('clipboard-check', 'Registering the project: what to do and what to write down', 'emerald') +
        '<div class="space-y-3">' +
        stepBox(1, 'emerald', 'Find the route', 'Most Trusts have a clinical audit or quality improvement office with a one-page registration form. Your sponsor or the ED audit lead knows it; the Trust intranet usually has it under Clinical Governance.') +
        stepBox(2, 'emerald', 'Fill it in from the app', 'The form asks for the aim, the standard or driver, the measures, the sample, the dates and the supervisor. All of these are on Define & Measure and the Charter; export the charter PDF if the office wants an attachment.') +
        stepBox(3, 'emerald', 'Record the reference number', 'Put it in the Ethics & Governance section. The EM QIAT and any abstract will ask for it.') +
        stepBox(4, 'emerald', 'Tell the people whose process you are measuring', 'A line at the nurses\' huddle and at the consultants\' meeting. It is courtesy, and it is the first stakeholder engagement entry in the Leadership log.') +
        '</div>' +
        '<div class="mt-3">' + appLink('checklist', 'Define & Measure → Ethics & Governance') + '</div>'
    );

    return '<div class="space-y-6">' + defs + flags + caldicott + register + '</div>';
}

// ─── Tab: Share your work ─────────────────────────────────────────────────────

function tabShare() {
    var where = card(
        sectionHead('megaphone', 'Where to present, from easiest to hardest', 'rcem-purple') +
        '<div class="space-y-3">' +
        stepBox(1, 'indigo', 'Departmental governance or audit meeting', 'Expected for every project and the easiest audience to reach. Ten minutes, one annotated chart, one slide of what you changed and what you learned. The app\'s PowerPoint export is built for this.') +
        stepBox(2, 'indigo', 'Trust QI showcase or regional trainee QI day', 'Most deaneries and Trusts run one a year. A poster or a short talk here counts as "regional presentation" for the EM QIAT excellent descriptor.') +
        stepBox(3, 'indigo', 'RCEM Annual Scientific Conference and other conferences', 'Abstract submission is usually in the spring for an autumn conference; check the RCEM events page for this year\'s dates. Accepted RCEM ASC abstracts have been published in an Emergency Medicine Journal supplement in past years. The app\'s Publication page drafts an abstract in the four-section format with a word count.') +
        stepBox(4, 'indigo', 'A journal', 'BMJ Open Quality and Future Healthcare Journal publish improvement reports from trainees; BMJ Quality & Safety is far more selective. Most journals ask for the SQUIRE 2.0 checklist. Agree authorship early and use your Trust library\'s writing support if it has one.') +
        '</div>' +
        source('ELFT QI, Guidance on publishing your improvement work (April 2025), which lists candidate journals and their focus.', 'https://qi.elft.nhs.uk/wp-content/uploads/2026/02/2025.04.03-Guidance-on-Publishing-your-improvement-work.pdf')
    );

    var squire = card(
        sectionHead('list-checks', 'SQUIRE 2.0: the 18 things a complete report contains', 'blue') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">SQUIRE (Standards for Quality Improvement Reporting Excellence) is the reporting guideline for improvement work. Even if you never write a paper, it is a good checklist for a poster or a talk, and almost every item maps onto a page in this app.</p>' +
        '<div class="overflow-x-auto"><table class="w-full text-xs border-collapse min-w-[520px]">' +
        '<thead><tr class="bg-slate-50"><th class="text-left p-2 border border-slate-200">#</th><th class="text-left p-2 border border-slate-200">Item</th><th class="text-left p-2 border border-slate-200">Where it lives in the app</th></tr></thead><tbody>' +
        [
            ['1', 'Title', 'Project name'],
            ['2', 'Abstract', 'Publication → RCEM Abstract'],
            ['3', 'Problem description', 'Define & Measure → Problem Definition'],
            ['4', 'Available knowledge', 'Define & Measure → Literature Review'],
            ['5', 'Rationale (your theory of change)', 'Diagnosis Tools → Driver diagram'],
            ['6', 'Specific aims', 'Define & Measure → SMART Aim'],
            ['7', 'Context', 'Define & Measure → Department context; Charter'],
            ['8', 'Intervention(s)', 'PDSA Cycles → change ideas'],
            ['9', 'Study of the intervention(s)', 'PDSA Cycles → predictions and Study notes'],
            ['10', 'Measures', 'Define & Measure → Family of Measures; Data → operational definition'],
            ['11', 'Analysis', 'Data & SPC → chart type and rules applied'],
            ['12', 'Ethical considerations', 'Define & Measure → Ethics & Governance'],
            ['13', 'Results (evolution of the intervention, process measures, context, unexpected consequences, missing data)', 'Data & SPC charts and interpretation; Results & Measurements'],
            ['14', 'Summary', 'Publication → Conclusions'],
            ['15', 'Interpretation', 'Data & SPC → Results Interpretation'],
            ['16', 'Limitations', 'Learning & Sustainability'],
            ['17', 'Conclusions', 'Learning & Sustainability; Sustainability plan'],
            ['18', 'Funding', 'Charter → Costs']
        ].map(function(r, i) {
            return '<tr class="' + (i % 2 ? 'bg-slate-50' : '') + '"><td class="p-2 border border-slate-200 font-bold text-slate-500">' + r[0] + '</td><td class="p-2 border border-slate-200 text-slate-700">' + r[1] + '</td><td class="p-2 border border-slate-200 text-slate-500">' + r[2] + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        source('Ogrinc G, Davies L, Goodman D, Batalden P, Davidoff F, Stevens D. SQUIRE 2.0 (Standards for QUality Improvement Reporting Excellence): revised publication guidelines from a detailed consensus process. BMJ Qual Saf 2016;25:986–92; item list per the EQUATOR Network SQUIRE page. The app mapping is ours.', 'https://resources.equator-network.org/reporting-guidelines/squire/faqs.html')
    );

    var abstractTips = card(
        sectionHead('file-text', 'Abstract and poster: what reviewers look for', 'emerald') +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Abstract (usually 250 words)</div>' +
        bullets('emerald', [
            '<strong>Background:</strong> the gap, with your baseline number and the standard',
            '<strong>Methods:</strong> Model for Improvement, the measures, the number and nature of the PDSA cycles, the sample',
            '<strong>Results:</strong> the two medians, the run-chart or SPC signal and when it began, the balancing measure',
            '<strong>Conclusions:</strong> what worked, what did not, what is sustained and the spread plan',
            'Numbers over adjectives: "42% to 91%" beats "marked improvement"'
        ]) + '</div>' +
        '<div><div class="font-semibold text-xs text-slate-700 mb-1">Poster</div>' +
        bullets('emerald', [
            'The annotated chart is the poster; make it half the width and readable from two metres',
            'Driver diagram small, PDSA table small, team and sponsor named',
            'One sentence per section; the reader has thirty seconds',
            'Registration number and "no ethics approval required (HRA decision tool)" in the footer',
            'The app exports an A3 poster and an A3 report from the Export Centre'
        ]) + '</div>' +
        '</div>' +
        infoBox('slate',
            '<p class="text-xs text-slate-700"><strong>Authorship:</strong> the ICMJE criteria are substantial contribution to design, data or analysis; drafting or revising; final approval; and accountability. Agree the author list, including your sponsor and the nurse who ran the change, before the abstract goes in.</p>'
        ) +
        '<div class="mt-3">' + appLink('publish', 'Draft the abstract on Publication') + '</div>'
    );

    return '<div class="space-y-6">' + where + squire + abstractTips + '</div>';
}

// ─── Tab: Worked example ──────────────────────────────────────────────────────

function tabExample() {
    var intro = card(
        sectionHead('route', 'The demo project, step by step', 'rcem-purple') +
        '<p class="text-sm text-slate-600 leading-relaxed mb-3">The demo project in this app is a fictional sepsis project: "Improving time to IV antibiotics for red-flag sepsis in the ED". It is built to show every feature with realistic numbers. Here is how it maps onto the eight steps, with the figures you will see on its pages. Nothing in it is real patient data.</p>' +
        '<div class="flex flex-wrap gap-2">' +
        '<button type="button" onclick="window.openWorkedExample()" class="inline-flex items-center gap-1.5 bg-rcem-purple text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-indigo-800"><i data-lucide="play" class="w-3.5 h-3.5"></i>Open the demo project</button>' +
        appLink('intro', 'Read the eight steps') +
        '</div>'
    );

    var steps = card(
        '<div class="space-y-3">' +
        stepBox(1, 'blue', 'Choose a problem that fits one rotation', 'A junior noticed red-flag sepsis patients waiting for a doctor to prescribe before any antibiotic was given. The EPR already recorded triage time and first antibiotic time, so the data were free. The ED clinical lead agreed to sponsor it.') +
        stepBox(2, 'blue', 'Register and find a sponsor', 'Registered with the audit and QI team; Dr Priya Shah (ED consultant) as sponsor; HRA decision tool: not research. Reference number recorded in Ethics & Governance.') +
        stepBox(3, 'blue', 'Draft the aim, then collect a baseline', 'Aim: increase the percentage of adult red-flag sepsis patients receiving IV antibiotics within 60 minutes of triage from a median of 42% to 90% by 31 May 2026. Thirteen weekly baseline points, median 42%, no shift or trend: a stable, poor process.') +
        stepBox(4, 'blue', 'Choose three measures', 'Outcome: % within 60 minutes. Process: median triage-to-antibiotic time, and later staff confidence in finding the sepsis kit. Balancing: inappropriate antibiotic starts per month, in case speed cost accuracy.') +
        stepBox(5, 'blue', 'Diagnose with the team', 'A process map with nurses and pharmacy showed three waits: finding equipment, waiting for a prescriber, and the prescriber not being prompted. These became the secondary drivers; the change ideas hung off them.') +
        stepBox(6, 'blue', 'Test small, with predictions', 'PDSA 1 (teaching at handover): predicted a rise to 60%; got a brief rise then a return to the median. Abandoned as a stand-alone change. PDSA 2a and 2b (sepsis trolley, then extended to Majors): predicted 65%, got a shift. PDSA 3 (nurse-initiated antibiotics under a PGD, day shifts): predicted 80%; adopted. PDSA 4 (EPR prompt at triage): adopted. Five cycles across four change ideas.') +
        stepBox(7, 'blue', 'Read the chart honestly', 'The outcome run chart shows a shift of more than ' + QI.RUN_SHIFT + ' points above the 42% median starting the week of the trolley, and a second step after the PGD. Median after the changes 91%; triage-to-antibiotic time 94 to 44 minutes. The balancing measure stayed at common-cause variation. The teaching-only period is visible as the one change that faded.') +
        stepBox(8, 'blue', 'Hand over and sign off', 'Trolley checks handed to the nursing team; the PGD owned by pharmacy; the EPR prompt is permanent. Results presented at governance and a regional trainee QI day. The EM QIAT on SLO 11 Sign-off scores 15 of 15 sections strong, and the Publication page holds the abstract.') +
        '</div>'
    );

    var lessons = card(
        sectionHead('lightbulb', 'What to copy from it', 'amber') +
        bullets('amber', [
            'The first change failing is part of the story, not a problem: it is what let the team argue for a system change',
            'Every cycle has a number in its prediction, so Study could say "we expected 60% and saw 48%"',
            'The balancing measure was chosen before the first change and reported even though it showed nothing',
            'The timeline was built backwards from the rotation end, so the handover happened two weeks before the registrar left',
            'The leadership log has an entry for every meeting, including the one where microbiology pushed back on the PGD'
        ])
    );

    return '<div class="space-y-6">' + intro + steps + lessons + '</div>';
}

window.openWorkedExample = function() {
    var isDemo = !!state.isDemoMode;
    if (isDemo && typeof window.openDemoProject === 'function') { window.openDemoProject(); return; }
    if (typeof window.showToast === 'function') window.showToast('Turn on Demo mode in Settings (or use "Try the demo" on the sign-in screen) to open the worked example', 'info');
    else alert('Turn on Demo mode in Settings to open the worked example.');
};

// ─── Tab: FAQ ─────────────────────────────────────────────────────────────────

function tabFAQ() {
    var items = [
        ['My rotation is six months. Is that long enough for a QIP?',
         '<p>Yes, if you start in the first fortnight and keep the scope small. A workable plan is: two weeks to register and agree the aim, ' + QI.BASELINE_MIN + ' to ' + QI.BASELINE_TARGET + ' weeks of baseline, two or three PDSA cycles of three to four weeks each, then two weeks for results and handover. Use "Draft a timeline" on the Timeline page to lay this out from your rotation end date. If the baseline can be taken from existing EPR data, you can start the first cycle sooner.</p>'],
        ['I only have a before and an after figure. Can I still use the app?',
         '<p>Enter what you have, but the chart will not show a signal with two points, and assessors will ask the same question. If the EPR holds the historical data, pull it week by week to rebuild the baseline. If not, start weekly collection now and treat the "before" figure as context rather than as the baseline.</p>'],
        ['My change did not work. Is the project a failure?',
         '<p>No. A documented prediction, a test, a result that did not match and a reasoned "abandon" or "adapt" decision is exactly what the EM QIAT is looking for in the Test and Study stages. The demo project\'s first cycle fails. What assessors mark down is a project with no cycles, or cycles with no learning written down.</p>'],
        ['Can I use the RCEM national QIP as my project?',
         '<p>As the foundation, yes: the national data collection is a ready-made baseline and a departmental sponsor. For the EM QIAT you then need your own change ideas and PDSA cycles around that topic, with your own measures over time. Taking part in data collection alone counts as participation, not as leading a project.</p>'],
        ['Do I need a consultant sponsor?',
         '<p>Not formally, but every project that finishes has one. The sponsor agrees the aim, unblocks the things a trainee cannot (a PGD, a change to the EPR, time at governance) and keeps the change alive after you rotate. Add them on Team & Leadership so they appear on the charter and the handover note.</p>'],
        ['How many data points do I need?',
         '<p>' + QI.BASELINE_MIN + ' to ' + QI.BASELINE_TARGET + ' baseline points before the first change, then keep going at the same cadence. The run-chart rules start to mean something at about ten points; SPC limits are provisional below ' + QI.SPC_MIN + '. Each point can be a small sample (' + QI.SAMPLE_PER_POINT + ' consecutive eligible patients is typical) as long as the sample is taken the same way every time.</p>'],
        ['Does a clinical audit count?',
         '<p>An audit and re-audit is a legitimate piece of QI evidence and fits the Define and Measure stages of the QI Journey. It becomes a QIP when the re-audit is replaced by a series of small tests of change measured over time. If you are starting from an audit, keep its data as the baseline and add PDSA cycles.</p>'],
        ['What is the difference between a process measure and an outcome measure?',
         '<p>The outcome measure is the thing you want to be better for the patient (antibiotics within an hour). The process measure checks whether the change you made is actually happening (the trolley is stocked; the PGD was used). If the process measure moves and the outcome does not, the change is being done but is not the right change. If the outcome moves and the process does not, something else caused it.</p>'],
        ['What should I write in a PDSA prediction?',
         '<p>A number and a reason: "We predict that at least 70% of eligible patients will receive antibiotics within 60 minutes on day shifts, because the nurses will no longer wait for a prescriber." The app will not let you leave the prediction blank, and it shows a hint if the prediction has no number in it.</p>'],
        ['The balancing measure got worse. What now?',
         '<p>Report it. Decide whether the harm outweighs the gain, adapt the change to reduce it, and test again. A project that found a cost and dealt with it reads as more mature than one whose balancing measure was never looked at.</p>'],
        ['Can I put patient details in the app?',
         '<p>No. The app is for the project: aim, measures, weekly figures, cycles, team, reflections. Keep anything identifiable on Trust systems and use study numbers if you need to link records. See Audit, QI or research? for the Caldicott summary.</p>'],
        ['Can my co-trainee and I share one project?',
         '<p>Yes. Share the project from Settings; both of you can edit, and the supervisor can be given a read-only link. For the EM QIAT each of you describes your own role and reflections; the form asks about your involvement, not the project\'s result.</p>'],
        ['What does the EM QIAT actually assess?',
         '<p>Your QI PDP for the year, QI education you did, the project or projects you were involved in and your role, which QI Journey stages you gained experience in, reflections on methods, team and leadership, and next year\'s PDP. It is one form a year, completed before ARCP. Leading a project every year is not required. There is no separate written report; the form is the assessed output.</p>'],
        ['Does using the AI review mean the work is not mine?',
         '<p>The AI tools in this app comment on what you wrote and suggest wording; the design, the data and the decisions are yours. Treat its output like a supervisor\'s margin notes: read it, keep what is right, and never paste a suggestion you cannot defend. Say in the EM QIAT reflection what tools you used if your supervisor asks.</p>'],
        ['I have rotated and the project is unfinished. What do I write?',
         '<p>Write what was done, what the chart shows so far, what the next cycle would be and who now owns it. Produce the handover note from the dashboard and give it to the owner and the sponsor. The EM QIAT asks which stages you gained experience in, so an honest "Define, Measure, Diagnose and one Test cycle" is a valid year.</p>']
    ];
    return '<div class="space-y-3">' +
        '<div class="mb-2">' + sectionHead('help-circle', 'Questions trainees ask', 'slate') + '<p class="text-sm text-slate-500">Tap a question. Numbers in the answers are the ones the app uses throughout.</p></div>' +
        items.map(function(i) { return faqItem(i[0], i[1]); }).join('') +
        '</div>';
}

// ─── Tab: Key reading ─────────────────────────────────────────────────────────

function tabReading() {
    var papers = [
        ['Start here', 'blue', [
            ['Jones B, Vaux E, Olsson-Brown A. How to get started in quality improvement. BMJ 2019;364:k5408', 'Short, practical, written for trainees. Read it in twenty minutes before your first project.', pubmed('30655245')],
            ['Backhouse A, Ogunlayi F. Quality improvement into practice. BMJ 2020;368:m865', 'What to do once you know the method: scoping, measurement, engagement, sustainability.', pubmed('32234777')],
            ['Health Foundation. Quality improvement made simple. 2021 edition', 'The clearest free primer on QI approaches and principles in the NHS.', 'https://www.health.org.uk/publications/quality-improvement-made-simple'],
            ['Batalden PB, Davidoff F. What is "quality improvement" and how can it transform healthcare? Qual Saf Health Care 2007;16:2–3', 'Two pages that define QI as the combined effort of everyone to make changes that lead to better outcomes, system performance and professional development.', pubmed('17301192')]
        ]],
        ['Method and measurement', 'emerald', [
            ['Perla RJ, Provost LP, Murray SK. The run chart. BMJ Qual Saf 2011;20:46–51', 'The rules this app uses for shifts and trends, with worked examples.', pubmed('21228075')],
            ['Benneyan JC, Lloyd RC, Plsek PE. Statistical process control as a tool for research and healthcare improvement. Qual Saf Health Care 2003;12:458–64', 'Why control limits, which chart for which data, and the common special-cause rules.', pubmed('14645763')],
            ['Anhøj J, Olesen AV. Run charts revisited. PLoS One 2014;9:e113825', 'A simulation of how sensitive and specific the run-chart rules are; useful if someone challenges your thresholds.', pubmed('25423037')],
            ['Solberg LI, Mosser G, McDonald S. The three faces of performance measurement. Jt Comm J Qual Improv 1997;23:135–47', 'Improvement, accountability and research measurement are different jobs; this explains why you do not need a p-value.', pubmed('9103968')],
            ['Taylor MJ et al. Systematic review of the application of the plan-do-study-act method. BMJ Qual Saf 2014;23:290–8', 'How rarely PDSA is done as described, and what "done properly" means.', pubmed('24025320')],
            ['Reed JE, Card AJ. The problem with Plan-Do-Study-Act cycles. BMJ Qual Saf 2016;25:147–52', 'A sympathetic critique: PDSA is simple to describe and hard to do; the fix is rigour in prediction and learning.', pubmed('26700542')]
        ]],
        ['People, context and sustainability', 'violet', [
            ['Dixon-Woods M, McNicol S, Martin G. Ten challenges in improving quality in healthcare. BMJ Qual Saf 2012;21:876–84', 'The list every reflection should be checked against.', 'https://qualitysafety.bmj.com/content/21/10/876'],
            ['Dixon-Woods M, Martin GP. Does quality improvement improve quality? Future Hosp J 2016;3:191–4', 'Why many projects do not deliver, and what the well-run ones do differently.', pubmed('31098223')],
            ['Berwick DM. A primer on leading the improvement of systems. BMJ 1996;312:619–22', 'Still the best short account of why changing the system beats exhorting the people.', pubmed('8595340')],
            ['Greenhalgh T et al. Diffusion of innovations in service organizations. Milbank Q 2004;82:581–629', 'Long, but the summary of what makes a change spread (relative advantage, compatibility, complexity, trialability, observability) is in the abstract.', 'https://doi.org/10.1111/j.0887-378X.2004.00325.x'],
            ['Lennox L, Maher L, Reed J. Navigating the sustainability landscape. Implement Sci 2018;13:27', 'A review of sustainability frameworks; confirms the NHS model\'s factors are the common ones.', pubmed('29426341')],
            ['Holden RJ et al. SEIPS 2.0. Ergonomics 2013;56:1669–86', 'The human-factors framework behind most patient-safety investigations; useful for a safety-themed project.', pubmed('24088063')]
        ]],
        ['Reporting', 'amber', [
            ['Ogrinc G et al. SQUIRE 2.0: revised publication guidelines. BMJ Qual Saf 2016;25:986–92', 'The reporting guideline; the explanation-and-elaboration paper (Goodman D et al, BMJ Qual Saf 2016) walks through each item with examples.', 'https://doi.org/10.1136/bmjqs-2015-004411'],
            ['Wong BM, Levinson W, Shojania KG. Quality improvement in medical education: current state and future directions. Med Educ 2012;46:107–19', 'Context for why QI is in the curriculum and what good QI teaching looks like.', pubmed('22150202')]
        ]]
    ];

    var html = '<div class="space-y-6">' +
        '<div class="mb-2">' + sectionHead('library', 'Key reading, with links', 'slate') +
        '<p class="text-sm text-slate-500">Each entry was checked against PubMed or the publisher\'s page in October 2026. Books are listed in the Resources tab. If a link breaks, searching the title on PubMed will find it.</p></div>';
    papers.forEach(function(group) {
        html += '<div><h4 class="font-bold text-sm text-' + group[1] + '-700 mb-2 flex items-center gap-2"><i data-lucide="bookmark" class="w-4 h-4"></i>' + group[0] + '</h4><div class="space-y-2">';
        group[2].forEach(function(p) {
            html += '<a href="' + p[2] + '" target="_blank" rel="noopener" class="block bg-white rounded-xl border border-slate-200 p-3 hover:border-' + group[1] + '-300 hover:shadow-sm transition-all">' +
                '<div class="text-xs font-bold text-slate-800 leading-snug">' + p[0] + '</div>' +
                '<div class="text-xs text-slate-500 mt-1 leading-relaxed">' + p[1] + '</div></a>';
        });
        html += '</div></div>';
    });
    return html + '</div>';
}

// ─── Tab: Resources ───────────────────────────────────────────────────────────

function tabResources() {
    var sections = [
        {
            head: 'RCEM', icon: 'award', color: 'purple',
            links: [
                ['https://rcem.ac.uk/quality-improvement/', 'purple', 'RCEM Quality Improvement Hub', 'National QIP information, resources and the RCEM QI Programme overview.', 'RCEM'],
                ['https://rcemqip.rcem.ac.uk/', 'purple', 'RCEM QIP Portal', 'Registration and data entry for the national QIPs; this year\'s topics and dates.', 'Portal'],
                ['https://rcem.ac.uk/wp-content/uploads/2022/09/RCEM_Quality_Improvement_Guide_2022_v4.pdf', 'purple', 'RCEM Quality Improvement Guide (2022)', 'The official RCEM guide to running a QIP — methodology, assessment, and portfolio requirements. Essential reading.', 'PDF'],
                ['https://rcem.ac.uk/em-curriculum/', 'purple', 'RCEM Curriculum & SLO 11 Guidance', 'EM Curriculum 2021 (v1.5, updated Aug 2025). Includes SLO 11 guidance, QIAT documentation, and ARCP requirements at each stage.', 'Curriculum'],
                ['https://rcem.ac.uk/wp-content/uploads/2025/11/SLO11-Participate-in-and-promote-activity-to-improve-the-quality-and-safety-of-patient-care.pdf', 'indigo', 'RCEM SLO 11 Guidance (November 2025)', 'RCEM guidance on SLO 11 — participating in and promoting quality and safety improvement — and what the QIAT needs to show.', 'PDF'],
            ]
        },
        {
            head: 'IHI (Institute for Healthcare Improvement)', icon: 'flask-conical', color: 'blue',
            links: [
                ['https://www.ihi.org/learn/courses/open-school', 'blue', 'IHI Open School', 'Online courses in improvement science and patient safety, including the Model for Improvement, PDSA cycles and measurement. Needs an individual or group subscription; check whether your Trust or deanery provides one.', 'Subscription'],
                ['https://www.ihi.org/library/model-for-improvement', 'blue', 'IHI Model for Improvement', 'The three foundational questions and PDSA cycle methodology explained in detail with examples.', 'Reference'],
                ['https://www.ihi.org/library/tools/plan-do-study-act-pdsa-worksheet', 'blue', 'IHI PDSA Worksheet', 'Downloadable PDSA cycle documentation worksheet. Use to structure each cycle in your QIP.', 'Tool'],
                ['https://www.ihi.org/library/model-for-improvement/testing-changes', 'blue', 'Testing Changes with PDSA', 'IHI guidance on running effective PDSA tests of change, including scaling, timing, and iteration strategy.', 'Guide'],
                ['https://www.ihi.org/library/white-papers/ihi-psychology-change-framework', 'blue', 'IHI Psychology of Change Framework (2018)', 'The five domains for bringing people with you; see People & change.', 'White paper'],
                ['https://www.ihi.org/library/white-papers/framework-spread-local-improvements-system-wide-change', 'blue', 'IHI Framework for Spread (2006)', 'Seven components for taking a change beyond the first site; see Sustain & spread.', 'White paper'],
            ]
        },
        {
            head: 'NHS England, Health Foundation and HRA', icon: 'building-2', color: 'teal',
            links: [
                ['https://www.england.nhs.uk/nhsimpact/improvement-resources/', 'teal', 'NHS England Improvement Resources', 'Hub for QI tools, frameworks, and guidance from NHS England. Includes the Model for Improvement, spread and adoption frameworks.', 'NHS'],
                ['https://learninghub.nhs.uk/Resource/60096', 'teal', 'Handbook of Quality and Service Improvement Tools', 'NHS England\'s comprehensive handbook covering process mapping, cause-and-effect, measurement, and statistical tools. Available on the NHS Learning Hub (free account needed).', 'Handbook'],
                ['https://www.england.nhs.uk/improvement-hub/wp-content/uploads/sites/44/2017/11/NHS-Sustainability-Model-2010.pdf', 'teal', 'NHS Sustainability Model and Guide (2010)', 'The ten-factor scoring model for whether a change will last; see Sustain & spread.', 'PDF'],
                ['https://www.england.nhs.uk/improvement-hub/wp-content/uploads/sites/44/2011/06/service_improvement_guide_2014.pdf', 'teal', 'First Steps Towards QI (NHS England)', 'Introductory guide to service improvement — useful for early-stage trainees explaining QI concepts clearly.', 'PDF'],
                ['https://www.health.org.uk/publications/quality-improvement-made-simple', 'teal', 'Health Foundation: Quality improvement made simple (2021)', 'Free primer: what quality is, the principles, the main approaches and the questions to ask when planning a project.', 'Guide'],
                ['https://www.hra-decisiontools.org.uk/research/', 'teal', 'HRA decision tool: Is my study research?', 'The questions that decide whether your project needs research ethics approval. Keep the result.', 'Tool'],
            ]
        },
        {
            head: 'HQIP & Audit', icon: 'bar-chart-2', color: 'orange',
            links: [
                ['https://www.hqip.org.uk/guidance/guide-to-quality-improvement-methods/', 'orange', 'HQIP Guide to QI Tools', 'Healthcare Quality Improvement Partnership guide covering Root Cause Analysis, clinical audit, Lean, SPC, Pareto, and more.', 'Guide'],
                ['https://www.ahrq.gov/evidencenow/tools/pdsa-form.html', 'orange', 'AHRQ PDSA Form', 'Fillable PDSA documentation form from the Agency for Healthcare Research and Quality. Useful for structuring your cycle write-up.', 'Tool'],
            ]
        },
        {
            head: 'Charts, reporting and publishing', icon: 'activity', color: 'rose',
            links: [
                ['https://www.ihi.org/sites/default/files/2023-11/100MLives_UsingPDSACyclesinCommunitySettings.pdf', 'rose', 'IHI — Using PDSA Cycles in Community Settings', 'Real-world case studies of PDSA cycles, including how to scope tests, what constitutes a cycle, and common pitfalls.', 'Case Study'],
                ['https://qilothian.scot.nhs.uk/qi-tools-and-resources-2', 'rose', 'NHS Lothian QI Tools and Resources', 'QI tools and templates from Lothian Quality, including measurement, run charts, driver diagrams and PDSA.', 'Templates'],
                ['https://resources.equator-network.org/reporting-guidelines/squire/faqs.html', 'rose', 'SQUIRE 2.0 (EQUATOR Network)', 'The reporting guideline for improvement work, with the checklist and FAQs.', 'Guideline'],
                ['https://qi.elft.nhs.uk/wp-content/uploads/2026/02/2025.04.03-Guidance-on-Publishing-your-improvement-work.pdf', 'rose', 'ELFT: Guidance on publishing your improvement work (2025)', 'Which journals take QI reports, what they expect, and practical writing tips from a Trust QI team.', 'PDF'],
            ]
        },
        {
            head: 'Books (library or Trust QI team)', icon: 'book', color: 'slate',
            links: [
                ['https://www.ihi.org/library/model-for-improvement', 'slate', 'Langley GJ et al. The Improvement Guide (2nd ed, 2009)', 'The source text for the Model for Improvement; chapters on testing, measurement and spread.', 'Book'],
                ['https://www.ihi.org/library/model-for-improvement', 'slate', 'Provost LP, Murray SK. The Health Care Data Guide (2011; 2nd ed 2022)', 'Which chart for which data, how to read signals, and how to present improvement data.', 'Book'],
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
        '<p class="text-sm text-slate-500">Vetted external links for RCEM trainees at all stages. All free to access unless otherwise noted. The two books link to the IHI page that describes them; ask your library for a copy.</p>' +
        '</div>' + html + '</div>';
}

// ─── Tab: Glossary ────────────────────────────────────────────────────────────

function tabGlossary() {
    var terms = [
        ['Aim Statement', 'The project goal expressed in SMART format: Specific, Measurable, Achievable, Relevant, and Time-bound. Every QIP starts here. Example: "To increase the proportion of sepsis patients receiving antibiotics within 60 minutes from 45% to 80% within six months in our ED."'],
        ['Astronomical point', 'A single point on a run chart that is obviously far from all the others. Not a statistical rule: a prompt to find out what happened that week before interpreting it.'],
        ['Audit Cycle', 'A baseline measurement against a standard, followed by an intervention, followed by a re-measurement. Distinguished from a QIP in that it does not test changes iteratively. A baseline audit is a good starting point for a QIP, but it is not a PDSA cycle and not sufficient on its own.'],
        ['Balancing Measure', 'A metric that monitors unintended consequences of your change. Answers: "What might get worse as a result of our improvement?" e.g. If you improve sepsis treatment time, does overall triage throughput decrease?'],
        ['Caldicott Principles', 'The eight principles governing use of confidential patient information in the NHS (National Data Guardian, 2020 revision). For a QIP: no identifiers in project tools, minimum necessary data, and tell patients how information is used.'],
        ['Change Idea', 'A specific intervention to be tested through a PDSA cycle. Linked to a secondary driver in the driver diagram. Multiple change ideas can be tested within one project, each with their own iterative cycles.'],
        ['Control Chart (SPC Chart)', 'A run chart with statistically calculated upper and lower control limits (UCL/LCL at ±3σ). The app checks four special-cause rules: a point outside limits, ' + QI.SPC_RUN + ' points on one side of the mean, 2 of 3 consecutive points beyond 2σ on the same side, and a moving range greater than 3.27 × the average moving range.'],
        ['Driver Diagram', 'A visual map connecting the project Aim to Primary Drivers (main categories), Secondary Drivers (specific contributing factors), and Change Ideas (interventions). The backbone of any well-structured QIP.'],
        ['FMEA', 'Failure Mode and Effects Analysis. A proactive risk assessment tool identifying what could go wrong with a proposed change, scored by Likelihood × Severity × Detectability to produce a Risk Priority Number (RPN).'],
        ['Fishbone Diagram', 'Also called an Ishikawa or cause-and-effect diagram. Organises potential root causes into categories (in this app: Patient, Staff, Equipment, Process, Environment, Management) to identify why a problem exists.'],
        ['Gantt Chart', 'A project management timeline showing tasks, durations, dependencies, and responsible individuals. Shows the project was planned and managed, which the EM QIAT asks about in the leadership and project sections.'],
        ['IHI Open School', 'The Institute for Healthcare Improvement\'s online education platform. Courses QI 101–103 cover the Model for Improvement, PDSA cycles and run chart interpretation. Most courses need a subscription; check whether your Trust or deanery provides one.'],
        ['Inter-Rater Reliability (Kappa)', 'Cohen\'s Kappa measures how much two or more assessors agree when independently rating the same thing, correcting for chance agreement. Relevant when a measure depends on subjective judgement, e.g. two clinicians independently scoring the same screening tool. Not built into this app\'s charts — calculate separately and report the value in your interpretation.'],
        ['Lean', 'An improvement approach that removes waste and waiting from a process by mapping the flow and fixing non-value steps. Process mapping, 5S and visual management come from Lean.'],
        ['Model for Improvement', 'The QI framework developed by Associates in Process Improvement. Built around three questions (Aim, Measurement, Change Ideas) and tested iteratively using PDSA cycles. The standard methodology for healthcare QI.'],
        ['Moving range', 'The absolute difference between each pair of consecutive points. The average moving range sets the control limits on an XmR chart, which is why the limits describe the week-to-week wobble rather than the overall spread.'],
        ['Outcome Measure', 'The metric that tracks whether things improved for the patient. The primary measure of whether your project achieved its aim. e.g. % of patients receiving the correct treatment within target time.'],
        ['Pareto Chart', 'A bar chart ranking causes by frequency with a cumulative percentage line. Based on the Pareto principle (80% of problems from 20% of causes). Used to prioritise interventions.'],
        ['PDSA Cycle', 'Plan-Do-Study-Act. A structured test of a change idea. Plan: state objective and prediction; Do: implement the test; Study: compare results to prediction; Act: adopt, adapt, or abandon based on learning.'],
        ['Process Map', 'A flow diagram of the steps a patient actually goes through, drawn with the people who do the work. Shows waits, loops and failure points; usually the quickest way to find the drivers.'],
        ['Process Measure', 'Tracks whether the change you implemented is actually being carried out. Bridges the gap between your intervention and the outcome. e.g. % of patients screened with sepsis tool (process) → % treated within 1hr (outcome).'],
        ['QIAT', 'EM Quality Improvement Assessment Tool. The annual form on risr/advance (2025 update, v7) summarising all your QI activity for the year: PDP, QI education, project involvement, QI Journey stages and reflections, completed before ARCP and reviewed by a supervisor or assessor.'],
        ['RACI chart', 'A grid of project tasks against people, marking who is Responsible (does the work), Accountable (owns it and signs it off; one per task), Consulted (asked first) and Informed (told afterwards). A project-management tool for making roles clear; this app has one on Team & Leadership. NHS Education for Scotland\'s QI Zone describes how to build one.'],
        ['RCEM National QIP', 'An annual national quality improvement programme run by RCEM for participating Type 1 EDs. Three topics per year. Provides standardised data collection and national benchmarking.'],
        ['Run Chart', 'A graph of data plotted over time with the median line marked. Non-random patterns (a shift of ' + QI.RUN_SHIFT + ' or more points on one side of the median, a trend of ' + QI.RUN_TREND + ' or more, an astronomical point) indicate genuine change. The standard plotting tool for QI data.'],
        ['SMART Aim', 'Specific, Measurable, Achievable, Relevant, Time-bound. The required format for your QIP aim statement. "To improve sepsis care" is not SMART; "To increase antibiotic administration within 60 minutes from 45% to 80% by the end of the rotation" is.'],
        ['SLO 11', 'Specialty Learning Outcome 11 in the RCEM 2021 Curriculum (updated Aug 2025). Covers Quality Improvement and Patient Safety. Evidenced each year through the EM QIAT form; leading a project every year is not mandatory.'],
        ['Special Cause Variation', 'A signal in your data (points outside control limits on an SPC chart, or non-random patterns on a run chart) indicating that something has genuinely changed the process — not just random noise.'],
        ['Spread', 'Taking a change that worked in one place to other wards, departments or sites. Different from sustainability (keeping it going where it started). The IHI Framework for Spread lists seven components.'],
        ['Spread Plan', 'A structured plan for how a successful change will be rolled out beyond the initial test environment to the wider system. The EM QIAT asks what will happen to the project after you leave, so write one before you rotate.'],
        ['SQUIRE 2.0', 'Standards for Quality Improvement Reporting Excellence: the 18-item reporting guideline for improvement work, expected by most journals and a useful checklist for posters and talks.'],
        ['Stakeholder Forcefield Analysis', 'Identifies forces supporting and opposing your change, scored by strength. Helps plan your engagement strategy and gives you something concrete to describe in the EM QIAT team and stakeholder section.'],
        ['Standard work', 'The agreed, written, current best way of doing a task (a checklist, an order set, a trolley layout). Building a change into standard work is how it survives staff turnover.'],
        ['Sustainability Model', 'The NHS Institute\'s ten-factor model (Maher, Gustafson and Evans, 2010) for predicting whether an improvement will last, grouped under process, staff and organisation.'],
        ['Baseline', 'The measurements taken before any change is tested: ideally ' + QI.BASELINE_MIN + ' to ' + QI.BASELINE_TARGET + ' weekly points. The baseline median is the line on the run chart that later points are compared with. A single audit figure is not a baseline.'],
        ['Common Cause Variation', 'The ordinary week-to-week wobble of a stable process. Points scatter randomly around the median with no shift or trend. Reacting to it as if it were change is the commonest mistake in reading a chart.'],
        ['Data Collection Plan', 'Written before the first point: where the data come from, who collects them, how often, from how many patients, and when the baseline starts. It keeps every point comparable with every other.'],
        ['Handover', 'What you give your successor and sponsor when you rotate: the aim, measures, data plan, what was tested and decided, and who owns each change now. The app writes a one-page handover note from the project.'],
        ['Median', 'The middle value when the baseline points are put in order. Run charts use the median rather than the mean because a single unusual week does not drag it about.'],
        ['Operational Definition', 'Exactly what counts: numerator, denominator, who is excluded, where the figure comes from and when it is extracted, written so that anyone would collect the same number.'],
        ['Registration', 'Telling your Trust audit, quality improvement or clinical governance department about the project before you look at patient records. It is the usual local permission for improvement work and gives you a reference number for the EM QIAT.'],
        ['Sampling', 'Measuring a small, consistent slice each week (for example the first 20 eligible patients) instead of every case. Ten to twenty consecutive patients per point is enough for a run chart, provided the rule is the same every week.'],
        ['Service Evaluation', 'Work that asks "what standard does this service achieve?" using routine care and routine data. With clinical audit and QI it does not need research ethics approval, which is what the HRA decision tool confirms; local registration is still needed.'],
        ['Shift', QI.RUN_SHIFT + ' or more consecutive points on one side of the median on a run chart. The commonest sign that a change has moved the process. Points exactly on the median are skipped when counting.'],
        ['Sponsor', 'The consultant who agrees the aim, unblocks changes and keeps the project alive after you rotate. Every first project needs one; add them to the team so they appear on the charter.'],
        ['Trend', QI.RUN_TREND + ' or more consecutive points all rising or all falling on a run chart, suggesting a gradual change rather than a step. Repeated values count once.'],
        ['Vancouver Referencing', 'The citation style most medical journals and conferences use. References are numbered sequentially in text and listed in order of appearance. Format: Author(s). Title. Journal. Year;Volume(Issue):Pages.'],
        ['XmR chart', 'The individuals-and-moving-range control chart the app draws for SPC: one chart of the values with limits set from the moving range. A good general-purpose chart when each point is a single weekly figure.'],
    ];

    terms.sort(function(a, b) { return a[0].localeCompare(b[0]); });

    var html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">';
    terms.forEach(function(t) { html += termCard(t[0], t[1]); });
    html += '</div>';

    return '<div>' +
        '<div class="mb-5">' +
        sectionHead('book-marked', 'QI Glossary', 'slate') +
        '<p class="text-sm text-slate-500">Key terms used in quality improvement, RCEM training, and this app. Alphabetically ordered. Use the search box above to find one quickly.</p>' +
        '</div>' + html + '</div>';
}
