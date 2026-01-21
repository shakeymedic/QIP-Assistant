import { state } from "./state.js";
import { showToast } from "./utils.js";

const SYSTEM_PROMPT = `You are an expert Consultant in Emergency Medicine and Quality Improvement (QIP) working in the NHS.
You strictly follow the Model for Improvement.
You write in British English.
You are concise, professional, and practical.`;

export async function callAI(userPrompt, jsonMode = false) {
    if (!state.aiKey) {
        showToast("No API Key found. Check Settings.", "error");
        return null;
    }

    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    
    try {
        const response = await fetch(`${endpoint}?key=${state.aiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${SYSTEM_PROMPT}\n\n${userPrompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    // If jsonMode is true, you might prompt the model to output JSON specifically
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
