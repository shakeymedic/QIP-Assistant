import { state } from "./state.js";
import { showToast } from "./utils.js";

const SYSTEM_PROMPT = `You are an expert Consultant in Emergency Medicine and Quality Improvement (QIP) working in the NHS.
You strictly follow the Model for Improvement.
You write in British English.
You are concise, professional, and practical.`;

/**
 * Generates a project summary to make the AI "Context Aware"
 */
function getProjectContext() {
    if (!state.projectData) return "No project loaded.";
    
    const d = state.projectData;
    const cl = d.checklist || {};
    const driverCount = (d.drivers?.primary?.length || 0) + (d.drivers?.secondary?.length || 0);
    const dataPoints = d.chartData?.length || 0;
    
    return `
    PROJECT CONTEXT:
    Title: "${d.meta?.title || 'Untitled'}"
    Problem: "${cl.problem_desc || 'Undefined'}"
    Aim: "${cl.aim || 'Undefined'}"
    Drivers: ${driverCount} defined.
    Data: ${dataPoints} data points collected.
    PDSA Cycles: ${d.pdsa?.length || 0} completed.
    `;
}

export async function callAI(userPrompt, jsonMode = false, useContext = true) {
    // SECURITY NOTE: In a production app, do not store keys in localStorage or make calls from the client.
    // Move this logic to a Firebase Cloud Function to protect your API key.
    if (!state.aiKey) {
        showToast("No API Key found. Check Settings.", "error");
        return null;
    }

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    
    // Inject Context if requested
    let finalPrompt = userPrompt;
    if (useContext) {
        finalPrompt = `${getProjectContext()}\n\nTASK:\n${userPrompt}`;
    }

    try {
        const response = await fetch(`${endpoint}?key=${state.aiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${SYSTEM_PROMPT}\n\n${finalPrompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                }
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const text = data.candidates[0].content.parts[0].text;
        
        if (jsonMode) {
            // Clean markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanText);
        }
        
        return text;

    } catch (error) {
        console.error("AI Error:", error);
        showToast("AI Error: " + error.message, "error");
        return null;
    }
}

// ==========================================
// NEW: Evidence Agent
// ==========================================
export async function suggestEvidence() {
    const problem = state.projectData?.checklist?.problem_desc;
    if (!problem) { showToast("Define the problem first.", "error"); return null; }

    return await callAI(`
        Based on the problem: "${problem}", summarize 3 key points from likely NICE guidelines (UK), RCEM standards, or major clinical studies that would support a case for change.
        Format as a short paragraph suitable for a "Literature Review" section.
        Cite specific guideline numbers or author names if possible.
    `, false, false); // No full context needed, just the problem
}
