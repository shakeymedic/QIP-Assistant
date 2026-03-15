import { state } from "./state.js";
import { showToast } from "./utils.js";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const SYSTEM_PROMPT = `
You are an expert Quality Improvement (QI) Coach specialising in Emergency Medicine for the UK National Health Service (NHS). 
Your target audience is ED Clinicians (Consultants, Registrars, Nurses) submitting for the RCEM QIP Portfolio.

GUIDING PRINCIPLES:
1. **Context:** Always assume an NHS Emergency Department setting (crowding, 4-hour target, corridor care, rotas).
2. **Standards:** Reference RCEM Clinical Standards, NICE Guidelines, and CQC Key Lines of Enquiry (Safe, Effective, Caring, Responsive, Well-led) where relevant.
3. **Methodology:** Strictly follow the "Model for Improvement" (PDSA, Driver Diagrams, Process Mapping).
4. **Tone:** Professional, encouraging, concise, and safety-focused. British English spelling (e.g., "Programme", "Organise").
5. **Safety:** If a user suggests something dangerous (e.g., skipping safety checks to save time), firmly warn them.
6. **Training Stage Awareness:** ACCS trainees must demonstrate PARTICIPATION in a QIP. Higher trainees must demonstrate LEADERSHIP of a QIP. Tailor advice accordingly when training stage is provided.

OUTPUT FORMAT:
Be direct. Use bullet points for readability.
`;

function getTrainingStageContext() {
    const stage = state.projectData?.meta?.trainingStage;
    if (stage === 'accs') {
        return "\nTraining Stage: ACCS. Focus on learning, contribution, and personal development.";
    } else if (stage === 'higher') {
        return "\nTraining Stage: Higher EM Training. Focus on decision-making, stakeholder engagement, team management, and driving the improvement cycle.";
    }
    return "";
}

export async function callAI(userPrompt, jsonMode = false, schema = null) {
    const key = state.aiKey || localStorage.getItem('rcem_qip_ai_key');
    if (!key) {
        showToast("AI API Key missing. Go to Settings.", "error");
        return null;
    }

    const stageContext = getTrainingStageContext();
    const finalPrompt = `${SYSTEM_PROMPT}${stageContext}\n\nUSER REQUEST:\n${userPrompt}`;
    
    const generationConfig = {
        temperature: 0.7,
        maxOutputTokens: 2000,
    };

    if (jsonMode) {
        generationConfig.responseMimeType = "application/json";
        if (schema) {
            generationConfig.responseSchema = schema;
        }
    }

    const payload = {
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: generationConfig
    };

    try {
        const response = await fetch(`${API_URL}?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "API Error");
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        if (jsonMode) {
            return JSON.parse(text);
        }

        return text;

    } catch (error) {
        console.error("AI Call Failed:", error);
        showToast(`AI Error: ${error.message}`, "error");
        return null;
    }
}

export async function runGapAnalysis(projectData) {
    const d = projectData;
    const cl = d.checklist || {};
    
    const context = `
        Aim: "${cl.aim || 'Undefined'}"
        Problem: "${cl.problem_desc || 'Undefined'}"
        Drivers: ${d.drivers?.primary?.join(', ') || 'None'}
        Measures: 
          - Outcome: ${cl.outcome_measure || 'None'}
          - Process: ${cl.process_measure || 'None'}
          - Balance: ${cl.balance_measure || 'None'}
    `;

    const prompt = `
        Review this QIP for logical consistency.
        1. Does the Aim directly address the Problem?
        2. Do the Drivers actually influence the Aim?
        3. Are the Measures capable of tracking the Aim?
        4. Identify ONE major risk to validity.
        5. Suggest ONE specific improvement.
        Data: ${context}
        Keep response under 150 words.
    `;

    return await callAI(prompt);
}

export async function runGoldenThreadValidator(projectData) {
    const d = projectData;
    const cl = d.checklist || {};
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };
    const pdsa = d.pdsa || [];

    const context = `
        Problem: "${cl.problem_desc || 'Not defined'}"
        Aim: "${cl.aim || 'Not defined'}"
        Outcome Measure: "${cl.outcome_measure || 'Not defined'}"
        Process Measure: "${cl.process_measure || 'Not defined'}"
        Balancing Measure: "${cl.balance_measure || 'Not defined'}"
        Primary Drivers: ${drivers.primary.length > 0 ? drivers.primary.join('; ') : 'None'}
        Secondary Drivers: ${drivers.secondary.length > 0 ? drivers.secondary.join('; ') : 'None'}
        Change Ideas: ${drivers.changes.length > 0 ? drivers.changes.join('; ') : 'None'}
        PDSA Cycles: ${pdsa.length > 0 ? pdsa.map(p => p.title || 'Untitled').join('; ') : 'None'}
        Number of Data Points: ${d.chartData?.length || 0}
        Sustainability Plan: "${cl.sustainability || 'Not defined'}"
    `;

    const prompt = `
        Perform a comprehensive coherence check on this QIP.
        Rules:
        Keep each comment under 25 words.
        Data: ${context}
    `;

    const schema = {
        type: "OBJECT",
        properties: {
            aimAddressesProblem: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            driversRelateToAim: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            changeIdeasMapToDrivers: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            measuresCaptureAim: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            pdsaTestsChangeIdeas: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            dataAdequate: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            sustainabilityPlan: { type: "OBJECT", properties: { status: { type: "STRING" }, comment: { type: "STRING" } } },
            overallScore: { type: "NUMBER" },
            topRecommendation: { type: "STRING" }
        }
    };

    return await callAI(prompt, true, schema);
}

export async function suggestEvidence() {
    const d = state.projectData.checklist;
    if (!d.problem_desc && !d.aim) return null;

    const prompt = `
        Topic: "${d.problem_desc} / ${d.aim}"
        Task: List 3 key UK/NHS guidelines or RCEM standards relevant to this topic.
        Format:
        1. [Authority] Standard Name (Key target/benchmark)
        2. [Authority] Standard Name (Key target/benchmark)
        3. [Authority] Standard Name (Key target/benchmark)
    `;

    return await callAI(prompt);
}

export async function generateChangeIdeas(driverName) {
    const prompt = `
        Context: NHS Emergency Department.
        Driver: "${driverName}"
        Task: List 5 practical, low-cost change ideas to influence this driver.
        Focus on: Process simplification, visual cues, nudges, or standardisation. Avoid generic education if possible.
    `;

    const schema = {
        type: "ARRAY",
        items: { type: "STRING" }
    };

    return await callAI(prompt, true, schema);
}

export async function critiqueSmartAim(draftAim, problem) {
    const prompt = `
        Draft Aim: "${draftAim}"
        Problem: "${problem}"
        
        Task: Critique this aim against SMART criteria and suggest an improved version.
        Scoring: 0 = not addressed, 1 = partially addressed, 2 = fully addressed.
    `;

    const schema = {
        type: "OBJECT",
        properties: {
            scores: {
                type: "OBJECT",
                properties: {
                    specific: { type: "OBJECT", properties: { score: { type: "NUMBER" }, feedback: { type: "STRING" } } },
                    measurable: { type: "OBJECT", properties: { score: { type: "NUMBER" }, feedback: { type: "STRING" } } },
                    achievable: { type: "OBJECT", properties: { score: { type: "NUMBER" }, feedback: { type: "STRING" } } },
                    relevant: { type: "OBJECT", properties: { score: { type: "NUMBER" }, feedback: { type: "STRING" } } },
                    timebound: { type: "OBJECT", properties: { score: { type: "NUMBER" }, feedback: { type: "STRING" } } }
                }
            },
            overallScore: { type: "NUMBER" },
            mainIssue: { type: "STRING" },
            suggestedAim: { type: "STRING" }
        }
    };

    return await callAI(prompt, true, schema);
}

export async function refineSmartAim(draftAim, problem) {
    const result = await critiqueSmartAim(draftAim, problem);
    if (result && result.suggestedAim) {
        return result.suggestedAim;
    }
    const prompt = `
        Draft Aim: "${draftAim}"
        Problem: "${problem}"
        Task: Rewrite this into a perfect SMART Aim.
        Format: "To [increase/decrease] [measure] from [baseline] to [target] by [date]."
        Keep it under 40 words.
    `;
    return await callAI(prompt);
}

export async function generateAbstract(projectData) {
    const d = projectData;
    const cl = d.checklist || {};
    const pdsa = d.pdsa || [];
    const chartData = d.chartData || [];

    const pdsaSummary = pdsa.map((p, i) => 
        `Cycle ${i + 1}: "${p.title || 'Untitled'}" - ${p.act || p.study || 'No outcome documented'}`
    ).join('; ');

    const dataRange = chartData.length > 0
        ? `${chartData.length} data points from ${chartData[0]?.date || '?'} to ${chartData[chartData.length - 1]?.date || '?'}`
        : 'No data collected yet';

    const prompt = `
        Generate a 250-word abstract for an RCEM conference submission based on this QIP data.
        
        Project Title: "${d.meta?.title || 'Untitled'}"
        Problem: "${cl.problem_desc || 'Not defined'}"
        Aim: "${cl.aim || 'Not defined'}"
        Outcome Measure: "${cl.outcome_measure || 'Not defined'}"
        Process Measure: "${cl.process_measure || 'Not defined'}"
        Balancing Measure: "${cl.balance_measure || 'Not defined'}"
        PDSA Cycles: ${pdsaSummary || 'None'}
        Data: ${dataRange}
        Results: "${cl.results_analysis || cl.results_text || 'Not yet analysed'}"
        Learning: "${cl.learning_points || 'Not yet documented'}"
        Sustainability: "${cl.sustainability || 'Not yet planned'}"
        
        Structure the abstract as:
        Background: (2-3 sentences)
        Aim: (1 sentence)
        Methods: (3-4 sentences)
        Results: (3-4 sentences)
        Conclusion: (2-3 sentences)
        
        Rules:
        Keep to exactly 250 words.
        Use British English.
        Be specific.
        Do NOT invent data that is not provided.
    `;

    return await callAI(prompt);
}

export async function suggestNextPDSA(projectData) {
    const d = projectData;
    const cl = d.checklist || {};
    const pdsa = d.pdsa || [];
    const drivers = d.drivers || { primary: [], secondary: [], changes: [] };

    const completedChanges = pdsa.map(p => p.title || '').filter(t => t);
    const unusedChanges = drivers.changes.filter(c => 
        !completedChanges.some(done => done.toLowerCase().includes(c.toLowerCase().substring(0, 15)))
    );

    const prompt = `
        Context: NHS ED Quality Improvement Project
        Aim: "${cl.aim || 'Not defined'}"
        Completed PDSA Cycles: ${completedChanges.length > 0 ? completedChanges.join('; ') : 'None yet'}
        Untested Change Ideas: ${unusedChanges.length > 0 ? unusedChanges.join('; ') : 'None identified'}
        
        Task: Suggest the next PDSA cycle to test.
    `;

    const schema = {
        type: "OBJECT",
        properties: {
            title: { type: "STRING" },
            rationale: { type: "STRING" },
            plan: { type: "STRING" },
            suggestedMeasure: { type: "STRING" },
            scale: { type: "STRING" }
        }
    };

    return await callAI(prompt, true, schema);
}

window.generateChangeIdeas = generateChangeIdeas;
window.critiqueSmartAim = critiqueSmartAim;
window.runGoldenThreadValidator = runGoldenThreadValidator;
window.generateAbstract = generateAbstract;
window.suggestNextPDSA = suggestNextPDSA;
