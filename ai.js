import { state } from "./state.js";
import { showToast } from "./utils.js";

// ==========================================
// 1. CONFIGURATION & SYSTEM PROMPT
// ==========================================

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// FIX 1.1: All references updated from "FRCEM" to "RCEM QIP Portfolio"
// FIX 1.3: Training stage awareness added
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
- Be direct. No fluff.
- Use bullet points for readability.
- If returning JSON, ensure it is valid JSON with no markdown formatting around it.
`;

// ==========================================
// 2. HELPER: GET TRAINING STAGE CONTEXT
// ==========================================

function getTrainingStageContext() {
    const stage = state.projectData?.meta?.trainingStage;
    if (stage === 'accs') {
        return "\nTraining Stage: ACCS — this trainee needs to demonstrate PARTICIPATION in the QIP. Focus on learning, contribution, and personal development.";
    } else if (stage === 'higher') {
        return "\nTraining Stage: Higher EM Training — this trainee needs to demonstrate LEADERSHIP of the QIP. Focus on decision-making, stakeholder engagement, team management, and driving the improvement cycle.";
    }
    return "";
}

// ==========================================
// 3. CORE API HANDLER
// ==========================================

export async function callAI(userPrompt, jsonMode = false) {
    const key = state.aiKey || localStorage.getItem('rcem_qip_ai_key');
    if (!key) {
        showToast("AI API Key missing. Go to Settings.", "error");
        return null;
    }

    const stageContext = getTrainingStageContext();
    const finalPrompt = `${SYSTEM_PROMPT}${stageContext}\n\nUSER REQUEST:\n${userPrompt}\n\n${jsonMode ? "OUTPUT IN PURE JSON ONLY. NO MARKDOWN." : ""}`;
    
    const payload = {
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            responseMimeType: jsonMode ? "application/json" : "text/plain"
        }
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
        let text = data.candidates[0].content.parts[0].text;

        if (jsonMode) {
            // Robust JSON extraction: find the first '{' or '[' and the last '}' or ']'
            const firstBrace = text.indexOf('{');
            const firstBracket = text.indexOf('[');
            const lastBrace = text.lastIndexOf('}');
            const lastBracket = text.lastIndexOf(']');
            
            // Determine if the response is an object or array
            let startIdx, endIdx;
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                startIdx = firstBrace;
                endIdx = lastBrace;
            } else if (firstBracket !== -1) {
                startIdx = firstBracket;
                endIdx = lastBracket;
            } else {
                throw new Error("AI did not return a valid JSON object.");
            }
            
            if (startIdx !== -1 && endIdx !== -1) {
                const jsonString = text.substring(startIdx, endIdx + 1);
                try {
                    return JSON.parse(jsonString);
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                    // Fallback to strict cleaning if simple extraction fails
                    text = text.replace(/```(json)?/gi, '').replace(/```/g, '').trim();
                    return JSON.parse(text);
                }
            } else {
                throw new Error("AI did not return a valid JSON object.");
            }
        }

        return text;

    } catch (error) {
        console.error("AI Call Failed:", error);
        showToast(`AI Error: ${error.message}`, "error");
        return null;
    }
}

// ==========================================
// 4. SPECIALISED AI FUNCTIONS
// ==========================================

// --- GAP ANALYSIS (Golden Thread Check) ---
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
        Review this QIP for logical consistency (The "Golden Thread").
        1. Does the Aim directly address the Problem?
        2. Do the Drivers actually influence the Aim?
        3. Are the Measures capable of tracking the Aim?
        4. Identify ONE major "Gap" or risk to validity.
        5. Suggest ONE specific improvement.
        Data: ${context}
        Keep response under 150 words.
    `;

    return await callAI(prompt);
}

// --- GOLDEN THREAD VALIDATOR (Priority 2.4) ---
// Produces a structured pass/fail/warning report
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
        Perform a comprehensive "Golden Thread" coherence check on this QIP.
        
        Evaluate each of these links and return a JSON object with the following structure:
        {
            "aimAddressesProblem": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "driversRelateToAim": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "changeIdeasMapToDrivers": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "measuresCaptureAim": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "pdsaTestsChangeIdeas": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "dataAdequate": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "sustainabilityPlan": { "status": "pass|fail|warning", "comment": "Brief explanation" },
            "overallScore": "A number from 0-100",
            "topRecommendation": "Single most important thing to improve"
        }
        
        Rules:
        - "pass" = clearly present and coherent
        - "warning" = partially present but needs improvement
        - "fail" = missing or incoherent
        - Keep each comment under 25 words
        
        Data: ${context}
    `;

    return await callAI(prompt, true);
}

// --- EVIDENCE SUGGESTIONS ---
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

// --- CHANGE IDEAS FROM DRIVER ---
export async function generateChangeIdeas(driverName) {
    const prompt = `
        Context: NHS Emergency Department.
        Driver: "${driverName}"
        Task: List 5 practical, low-cost change ideas (interventions) to influence this driver.
        Focus on: Process simplification, visual cues, nudges, or standardisation. Avoid generic "education" if possible.
        Return as a simple JSON list of strings: ["Idea 1", "Idea 2"...]
    `;

    return await callAI(prompt, true);
}

// --- SMART AIM CRITIQUE (Priority 4.6) ---
// FIX: Now returns critique + suggestion instead of auto-replacing
export async function critiqueSmartAim(draftAim, problem) {
    const prompt = `
        Draft Aim: "${draftAim}"
        Problem: "${problem}"
        
        Task: Critique this aim against SMART criteria and suggest an improved version.
        
        Return JSON:
        {
            "scores": {
                "specific": { "score": 0-2, "feedback": "Brief feedback" },
                "measurable": { "score": 0-2, "feedback": "Brief feedback" },
                "achievable": { "score": 0-2, "feedback": "Brief feedback" },
                "relevant": { "score": 0-2, "feedback": "Brief feedback" },
                "timebound": { "score": 0-2, "feedback": "Brief feedback" }
            },
            "overallScore": 0-10,
            "mainIssue": "The single biggest problem with this aim (under 20 words)",
            "suggestedAim": "Rewritten SMART aim under 40 words, format: To [increase/decrease] [measure] from [baseline] to [target] by [date]."
        }
        
        Scoring: 0 = not addressed, 1 = partially addressed, 2 = fully addressed.
    `;
    return await callAI(prompt, true);
}

// Legacy function kept for backward compatibility — now wraps critiqueSmartAim
export async function refineSmartAim(draftAim, problem) {
    const result = await critiqueSmartAim(draftAim, problem);
    if (result && result.suggestedAim) {
        return result.suggestedAim;
    }
    // Fallback to simple prompt if structured response fails
    const prompt = `
        Draft Aim: "${draftAim}"
        Problem: "${problem}"
        Task: Rewrite this into a perfect SMART Aim (Specific, Measurable, Achievable, Relevant, Time-bound).
        Format: "To [increase/decrease] [measure] from [baseline] to [target] by [date]."
        Keep it under 40 words.
    `;
    return await callAI(prompt);
}

// --- ABSTRACT GENERATOR (Priority 4.7) ---
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
        Aim: (1 sentence — use the SMART aim directly)
        Methods: (3-4 sentences covering methodology, measures, and PDSA cycles)
        Results: (3-4 sentences with specific data)
        Conclusion: (2-3 sentences on learning and implications)
        
        Rules:
        - Keep to exactly 250 words (±10)
        - Use British English
        - Be specific — cite actual numbers from the data where available
        - Do NOT invent data that is not provided
        - If data is missing, use placeholder brackets like [baseline] or [result]
    `;

    return await callAI(prompt);
}

// --- PDSA SUGGESTION ---
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
        
        Task: Suggest the next PDSA cycle to test. Return JSON:
        {
            "title": "Concise cycle title",
            "rationale": "Why this should be tested next (under 30 words)",
            "plan": "Detailed plan section (2-3 sentences). Include a clear PREDICTION of what you expect to happen.",
            "suggestedMeasure": "What to measure during this test",
            "scale": "How small to start (e.g., '5 patients over 1 shift')"
        }
    `;

    return await callAI(prompt, true);
}

// Make functions available globally for HTML event handlers
window.generateChangeIdeas = generateChangeIdeas;
window.critiqueSmartAim = critiqueSmartAim;
window.runGoldenThreadValidator = runGoldenThreadValidator;
window.generateAbstract = generateAbstract;
window.suggestNextPDSA = suggestNextPDSA;
