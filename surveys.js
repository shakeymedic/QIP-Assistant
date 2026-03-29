import { state } from "./state.js";
import { showToast, escapeHtml } from "./utils.js";
import { callAI } from "./ai.js";

export function renderSurveys() {
    const d = state.projectData;
    if (!d) return;
    const container = document.getElementById('view-surveys');
    if (!container) return;

    if (!d.surveys) d.surveys = [];

    let html = `
        <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
                <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <i data-lucide="clipboard-list" class="text-violet-500"></i> Surveys and Feedback
                </h2>
                <p class="text-slate-500 text-sm mt-1">Manage questionnaires, staff surveys, and qualitative data.</p>
            </div>
            <button onclick="window.addSurvey()" class="bg-rcem-purple text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                <i data-lucide="plus" class="w-4 h-4"></i> New Survey
            </button>
        </header>
        <div class="space-y-6">
    `;

    if (d.surveys.length === 0) {
        html += `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <i data-lucide="file-spreadsheet" class="w-16 h-16 text-slate-300 mx-auto mb-4"></i>
                <h3 class="text-lg font-bold text-slate-700 mb-2">No surveys added yet</h3>
                <p class="text-slate-500 mb-4">You can easily import survey results directly from a Google Sheets CSV.</p>
                <button onclick="window.addSurvey()" class="bg-rcem-purple text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 inline-flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i> Create First Survey
                </button>
            </div>
        `;
    } else {
        d.surveys.forEach((survey, index) => {
            html += `
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div class="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div class="flex-1 mr-4">
                            <input type="text" value="${escapeHtml(survey.title)}" onchange="window.updateSurveyTitle('${survey.id}', this.value)" class="w-full text-xl font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 hover:bg-slate-50 rounded" placeholder="Survey Title">
                            <p class="text-xs text-slate-400 mt-1">${survey.responses ? survey.responses.length : 0} responses recorded</p>
                        </div>
                        <button onclick="window.deleteSurvey('${survey.id}')" class="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <h4 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                                <i data-lucide="table" class="w-4 h-4 text-emerald-500"></i> Import Data
                            </h4>
                            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                                <p class="text-xs text-slate-600 mb-3">Export your Google Form or Sheet as a CSV, then upload it here. The first row must contain your questions.</p>
                                <label class="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-600 transition-colors w-full">
                                    <i data-lucide="upload" class="w-4 h-4"></i> Upload CSV File
                                    <input type="file" accept=".csv" onchange="window.importSurveyCSV(this, '${survey.id}')" class="hidden">
                                </label>
                            </div>
                            
                            ${survey.questions && survey.questions.length > 0 ? `
                                <h4 class="font-bold text-slate-700 text-sm mb-2">Questions (${survey.questions.length})</h4>
                                <ul class="text-xs text-slate-600 list-disc pl-4 space-y-1 max-h-40 overflow-y-auto">
                                    ${survey.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                        
                        <div>
                            <h4 class="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                                <i data-lucide="file-text" class="w-4 h-4 text-blue-500"></i> Results and Summary
                            </h4>
                            <textarea onchange="window.updateSurveySummary('${survey.id}', this.value)" class="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px] focus:ring-2 focus:ring-rcem-purple" placeholder="Summarise the key findings from this survey...">${escapeHtml(survey.summary || '')}</textarea>
                            
                            ${window.hasAI && window.hasAI() && survey.responses && survey.responses.length > 0 ? `
                                <button onclick="window.aiAnalyseSurvey('${survey.id}')" id="btn-ai-survey-${survey.id}" class="w-full mt-2 border border-purple-200 text-purple-700 bg-purple-50 py-2 rounded-lg font-bold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm">
                                    <i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Summarise Results
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function addSurvey() {
    if (!state.projectData.surveys) state.projectData.surveys = [];
    state.projectData.surveys.unshift({
        id: 'surv_' + Date.now().toString(36),
        title: 'New Survey',
        questions: [],
        responses: [],
        summary: ''
    });
    window.saveData();
    renderSurveys();
    showToast('New survey added', 'success');
}

export function updateSurveyTitle(id, title) {
    const s = state.projectData.surveys.find(x => x.id === id);
    if (s) {
        s.title = title;
        window.saveData();
    }
}

export function updateSurveySummary(id, summary) {
    const s = state.projectData.surveys.find(x => x.id === id);
    if (s) {
        s.summary = summary;
        window.saveData();
    }
}

export function deleteSurvey(id) {
    if(confirm('Delete this survey and all its data?')) {
        state.projectData.surveys = state.projectData.surveys.filter(x => x.id !== id);
        window.saveData();
        renderSurveys();
        showToast('Survey deleted', 'info');
    }
}

export function importSurveyCSV(input, id) {
    const file = input.files ? input.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) {
            showToast('CSV must contain a header row and at least one data row', 'error');
            return;
        }
        
        const questions = rows[0];
        const responses = [];
        
        for(let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if(row.length === 0 || (row.length === 1 && !row[0])) continue;
            
            const responseObj = {};
            questions.forEach((q, idx) => {
                responseObj[q] = row[idx] || '';
            });
            responses.push(responseObj);
        }

        const s = state.projectData.surveys.find(x => x.id === id);
        if (s) {
            s.questions = questions;
            s.responses = responses;
            window.saveData();
            renderSurveys();
            showToast(`Imported ${responses.length} responses`, 'success');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function parseCSV(str) {
    const arr = [];
    let quote = false;
    let col = '';
    let c;
    let row = [];
    for (let i = 0; i < str.length; i++) {
        c = str[i];
        if (c === '"' && str[i+1] === '"') { col += '"'; i++; } 
        else if (c === '"') { quote = !quote; } 
        else if (c === ',' && !quote) { row.push(col.trim()); col = ''; } 
        else if (c === '\n' && !quote) { row.push(col.trim()); arr.push(row); row = []; col = ''; } 
        else if (c === '\r' && !quote) { } 
        else { col += c; }
    }
    if(col !== '' || row.length > 0) {
        row.push(col.trim());
        arr.push(row);
    }
    return arr;
}

export async function aiAnalyseSurvey(id) {
    const s = state.projectData.surveys.find(x => x.id === id);
    if (!s || !s.responses || s.responses.length === 0) return;
    
    const btn = document.getElementById(`btn-ai-survey-${id}`);
    if(btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Analysing...`;

    const sample = s.responses.slice(0, 30);
    const dataStr = JSON.stringify(sample);

    const prompt = `
        I have conducted a survey for my Quality Improvement Project in the Emergency Department.
        Survey Title: "${s.title}"
        Data (JSON format): ${dataStr}
        
        Task: Please analyse the survey responses and provide a concise, professional summary of the key findings, trends, and actionable insights. Use bullet points for readability. Keep it under 250 words. Do not use any introductory or concluding filler.
    `;

    const result = await callAI(prompt);
    
    if(result) {
        s.summary = result.trim();
        window.saveData();
        renderSurveys();
        showToast("Survey analysed", "success");
    } else {
        if(btn) btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i> Auto-Summarise Results`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}
