import { Timestamp } from 'firebase/firestore';

export interface Sentence {
  id: string;
  text: string;
  createdAt: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface UserWord {
  word: string;
  meaning: string;
  phonetic?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "pending" | "reviewed";
  source: "daily" | "search" | "history" | "suggestion";
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  aiGenerated: boolean;
  lastSentenceText?: string;
  sentencesCount?: number;
}

export interface WordDefinition {
  term: string;
  phonetic: string;
  definition: string;
  partOfSpeech: string;
  examples: string[];
  etymology: string;
  synonyms: string[];
  antonyms: string[];
  difficulty: "simple" | "intermediate" | "advanced" | "expert";
  usageDepth: string;
}

export interface SentenceAnalysis {
  evaluation: string;
  whatWorks: string;
  whatSoundsUnnatural: string;
  suggestedRefinement: string;
  advancedInsight: string;
  exemplarySentence: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}
