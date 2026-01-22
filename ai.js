import { state } from "./state.js";
import { showToast } from "./utils.js";

// ==========================================
// 1. CONFIGURATION & SYSTEM PROMPT
// ==========================================

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const SYSTEM_PROMPT = `
You are an expert Quality Improvement (QI) Coach specializing in Emergency Medicine for the UK National Health Service (NHS). 
Your target audience is ED Clinicians (Consultants, Registrars, Nurses) submitting for the RCEM FRCEM Portfolio.

GUIDING PRINCIPLES:
1. **Context:** Always assume an NHS Emergency Department setting (crowding, 4-hour target, corridor care, rotas).
2. **Standards:** Reference RCEM Clinical Standards, NICE Guidelines, and CQC Key Lines of Enquiry (Safe, Effective, Caring, Responsive, Well-led) where relevant.
3. **Methodology:** Strictly follow the "Model for Improvement" (PDSA, Driver Diagrams, Process Mapping).
4. **Tone:** Professional, encouraging, concise, and safety-focused. British English spelling (e.g., "Programme", "Organise").
5. **Safety:** If a user suggests something dangerous (e.g., skipping safety checks to save time), firmly warn them.

OUTPUT FORMAT:
- Be direct. No fluff.
- Use bullet points for readability.
- If returning JSON, ensure it is valid JSON with no markdown formatting around it.
`;

// ==========================================
// 2. CORE API HANDLER
// ==========================================

/**
 * Main function to call the AI API
 * @param {string} userPrompt - The specific task
 * @param {boolean} jsonMode - Whether to force JSON output
 * @returns {Promise<string|object|null>}
 */
export async function callAI(userPrompt, jsonMode = false) {
    // 1. Get Key
    const key = state.aiKey || localStorage.getItem('rcem_qip_ai_key');
    if (!key) {
        showToast("AI API Key missing. Go to Settings.", "error");
        return null;
    }

    // 2. Construct Payload
    const finalPrompt = `${SYSTEM_PROMPT}\n\nUSER REQUEST:\n${userPrompt}\n\n${jsonMode ? "OUTPUT IN PURE JSON ONLY. NO MARKDOWN." : ""}`;
    
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

        // Clean up markdown code blocks if they exist despite instructions
        if (jsonMode) {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        }

        return text;

    } catch (error) {
        console.error("AI Call Failed:", error);
        showToast(`AI Error: ${error.message}`, "error");
        return null;
    }
}

// ==========================================
// 3. SPECIALIZED AI FUNCTIONS
// ==========================================

/**
 * "The Critical Friend" - Reviews the project for logical gaps
 */
export async function runGapAnalysis(projectData) {
    const d = projectData;
    const cl = d.checklist || {};
    
    // Construct a context summary
    const context = `
        Aim: "${cl.aim || 'Undefined'}"
        Problem: "${cl.problem_desc || 'Undefined'}"
        Drivers: ${d.drivers?.primary?.join(', ') || 'None'}
        Measures: 
          - Outcome: ${cl.measure_outcome || 'None'}
          - Process: ${cl.measure_process || 'None'}
          - Balance: ${cl.measure_balance || 'None'}
    `;

    const prompt = `
        Review this QIP for logical consistency (The "Golden Thread").
        1. Does the Aim directly address the Problem?
        2. Do the Drivers actually influence the Aim?
        3. Are the Measures capable of tracking the Aim?
        4. Identify ONE major "Gap" or risk to validity.
        5. Suggest ONE specific improvement.
        
        Data:
        ${context}
        
        Keep response under 150 words.
    `;

    return await callAI(prompt);
}

/**
 * Suggests Evidence/Guidelines based on the problem
 */
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

/**
 * Generates practical Change Ideas for a specific driver
 */
export async function generateChangeIdeas(driverName) {
    const prompt = `
        Context: NHS Emergency Department.
        Driver: "${driverName}"
        Task: List 5 practical, low-cost change ideas (interventions) to influence this driver.
        Focus on: Process simplification, visual cues, nudges, or standardization. Avoid generic "education" if possible.
        Return as a simple JSON list of strings: ["Idea 1", "Idea 2"...]
    `;

    return await callAI(prompt, true);
}

/**
 * Refines a draft aim into a SMART aim
 */
export async function refineSmartAim(draftAim, problem) {
    const prompt = `
        Draft Aim: "${draftAim}"
        Problem: "${problem}"
        Task: Rewrite this into a perfect SMART Aim (Specific, Measurable, Achievable, Relevant, Time-bound).
        Format: "To [increase/decrease] [measure] from [baseline] to [target] by [date]."
        Keep it under 40 words.
    `;
    return await callAI(prompt);
}
