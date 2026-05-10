// Client-side AI service using @google/genai SDK
import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, SentenceAnalysis, QuizQuestion } from '../types';

export { type WordDefinition, type SentenceAnalysis, type QuizQuestion };

// Initialize AI with environment variable
// In AI Studio, GEMINI_API_KEY is automatically injected into the browser environment.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getWritingGuidance(word: string, meaning: string, previousSentences: string[]): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Word: ${word}\nMeaning: ${meaning}\nHistory: ${previousSentences.join("; ")}\nProvide guidance in the requested format.` }] }],
            config: {
                systemInstruction: `You are a sharp, concise writing mentor. STOP generating long essays or poetic lectures. 
                
                MANDATORY STRUCTURE:
                Quick Insight: [1 short observation]
                Try: • [idea 1] • [idea 2]
                Refinement Tip: [1 concise hint]
                
                STRICT LIMIT: Under 80 words. Be fast and useful.`,
                responseMimeType: "text/plain"
            }
        });
        return response.text?.trim() || "";
    } catch (error) {
        console.error("AI Guidance Error:", error);
        throw error;
    }
}

export async function analyzeSentence(word: string, meaning: string, sentence: string, previousSentences: string[]): Promise<SentenceAnalysis> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Word: ${word}\nMeaning: ${meaning}\nSentence: "${sentence}"\nPrevious: ${previousSentences.join("; ")}` }] }],
            config: {
                systemInstruction: `You are a sharp, fast writing editor. Override all previous stylistic behavior. No philosophical explorations.
                
                STRICT RULES:
                1. IDEA PRESERVATION: Polish the user's idea, don't replace it.
                2. CONCISE: Absolute max 120 words. Focus on being useful.
                
                STRUCTURE:
                - "whatWorks": 1 short sentence starting with "✓ Your idea..."
                - "whatSoundsUnnatural": 1 short correction starting with "△ Improve..."
                - "suggestedRefinement": The improved version preserving same idea ("Better flow")
                - "advancedInsight": 1 concise insight ("Advanced tip")
                - "exemplarySentence": Same context as user, but elite level.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        evaluation: { type: Type.STRING },
                        whatWorks: { type: Type.STRING },
                        whatSoundsUnnatural: { type: Type.STRING },
                        suggestedRefinement: { type: Type.STRING },
                        advancedInsight: { type: Type.STRING },
                        exemplarySentence: { type: Type.STRING }
                    },
                    required: ["evaluation", "whatWorks", "whatSoundsUnnatural", "suggestedRefinement", "advancedInsight", "exemplarySentence"]
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("AI Analyze Error:", error);
        throw error;
    }
}

export async function generatePracticeSentence(word: string, meaning: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Create a useful, clear practice sentence for the word "${word}" (meaning: ${meaning}). The sentence should be high-quality and demonstrate the word's correct usage in an elegant way.` }] }],
            config: {
                systemInstruction: "You are a master of linguistic context. Provide only the sentence itself. No intro, no quotes, no extra notes.",
                responseMimeType: "text/plain"
            }
        });
        return response.text?.trim() || "";
    } catch (error) {
        console.error("AI Practice Sentence Error:", error);
        throw error;
    }
}

export async function generateWordDetails(word: string): Promise<WordDefinition> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: `Provide deep insights for the word: "${word}".` }] }],
      config: {
        systemInstruction: "You are an expert etymologist and linguist. Provide a comprehensive, academic but accessible breakdown of the given word. Focus on deep contextual usage and interesting etymological origins.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            definition: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            etymology: { type: Type.STRING },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            difficulty: { type: Type.STRING, enum: ["simple", "intermediate", "advanced", "expert"] },
            usageDepth: { type: Type.STRING, description: "A deep dive into how the word is used in different contexts (e.g., formal vs informal)." }
          },
          required: ["term", "definition", "phonetic", "partOfSpeech"]
        }
      }
    });
    const details = JSON.parse(response.text || "{}");
    // Ensure examples is always an array to avoid map errors
    if (!details.examples) details.examples = [];
    if (!details.synonyms) details.synonyms = [];
    if (!details.antonyms) details.antonyms = [];
    return details;
  } catch (error) {
    console.error("AI Word Details Error:", error);
    throw error;
  }
}

export async function suggestDailyWord(level: number, difficulty: string = 'intermediate', exclusionList: string[] = []): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Suggest a daily vocabulary word for a user at level ${level} with a preference for ${difficulty} difficulty.\nIMPORTANT: Do NOT suggest any of these words: ${exclusionList.join(", ")}.` }] }],
            config: {
                systemInstruction: "Suggest only the single word. No periods, no extra text. Pick something evocative and useful.",
                responseMimeType: "text/plain"
            }
        });
        return (response.text || "").trim().toLowerCase().replace(/[^a-z]/g, '');
    } catch (error) {
        console.error("AI Suggest Word Error:", error);
        throw error;
    }
}

export async function verifyReview(
    word: string, 
    userMeaning: string, 
    sentences: string[]
): Promise<{ passed: boolean; feedback: string }> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Verify if the user understands the word "${word}". \nUser's provided meaning: "${userMeaning}"\nUser's provided sentences:\n1. "${sentences[0]}"\n2. "${sentences[1]}"` }] }],
            config: {
                systemInstruction: `You are a linguistic evaluator. Check if the meaning is accurate and the sentences are grammatically correct and use the word correctly in context. \nRespond in JSON format.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        passed: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING, description: "Constructive feedback if they failed or praise if they passed." }
                    },
                    required: ["passed", "feedback"]
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("AI Verify Review Error:", error);
        throw error;
    }
}

export async function generateQuiz(words: string[]): Promise<QuizQuestion[]> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `Generate a 5-question multiple choice quiz to test mastery of these words: ${words.join(", ")}.` }] }],
            config: {
                systemInstruction: "Create challenging questions that test contextual understanding, not just definitions.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctIndex: { type: Type.NUMBER },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctIndex", "explanation"]
                    }
                }
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error("AI Quiz Error:", error);
        throw error;
    }
}
