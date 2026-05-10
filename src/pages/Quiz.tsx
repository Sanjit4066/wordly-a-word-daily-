import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  BookOpen,
  Lightbulb
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, updateDoc, doc, increment } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { generateQuiz, QuizQuestion } from '../services/geminiService';
import { Link } from 'react-router-dom';

const Quiz: React.FC = () => {
    const { user, profile, refreshProfile } = useAuth();
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);
    const [learningWords, setLearningWords] = useState<string[]>([]);

    useEffect(() => {
        const fetchLearningWords = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const wordsRef = collection(db, 'users', user.uid, 'words');
                const q = query(wordsRef, where('status', '==', 'learning'), limit(5));
                const snap = await getDocs(q);
                const words = snap.docs.map(d => d.data().term);
                setLearningWords(words);

                if (words.length >= 1) {
                    const quizData = await generateQuiz(words);
                    setQuestions(quizData);
                }
            } catch (err) {
                console.error("Error generating quiz:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLearningWords();
    }, [user]);

    const handleOptionSelect = (index: number) => {
        if (selectedOption !== null) return;
        
        setSelectedOption(index);
        const correct = index === questions[currentIndex].correctIndex;
        setIsCorrect(correct);
        if (correct) setScore(s => s + 1);
    };

    const handleNext = async () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(c => c + 1);
            setSelectedOption(null);
            setIsCorrect(null);
        } else {
            setFinished(true);
            // Award XP
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    xp: increment(score * 20)
                });
                await refreshProfile();
            }
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="relative">
                <Sparkles className="w-12 h-12 text-brand-accent animate-pulse" />
            </div>
            <div className="text-center space-y-2">
                <p className="text-2xl font-serif italic text-brand-primary">Preparing your session...</p>
                <p className="technical-label">Selecting curated questions for you</p>
            </div>
        </div>
    );

    if (learningWords.length < 1) {
        return (
            <div className="max-w-xl mx-auto py-24 text-center space-y-10 card p-16">
                <div className="w-20 h-20 bg-brand-bg rounded-3xl flex items-center justify-center mx-auto">
                    <BookOpen className="w-8 h-8 text-brand-accent" />
                </div>
                <div className="space-y-4">
                    <h2 className="text-4xl font-serif font-black italic tracking-tight">Expand Your Horizon</h2>
                    <p className="text-brand-muted leading-relaxed font-serif italic text-lg">
                        Practice sessions are personalized based on the words you're learning. Please add a few words to your "learning" list to begin.
                    </p>
                </div>
                <div className="flex justify-center">
                    <Link to="/" className="btn-primary">
                        Find words to learn
                    </Link>
                </div>
            </div>
        );
    }

    if (finished) {
        return (
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl mx-auto py-16 text-center space-y-12 card p-16"
            >
                <div className="space-y-4">
                    <div className="w-20 h-20 bg-brand-accent rounded-full flex items-center justify-center mx-auto shadow-xl shadow-brand-accent/20 mb-6">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-5xl font-serif font-black italic tracking-tight">Session Complete</h2>
                    <p className="technical-label">Your linguistic mastery has grown</p>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <div className="p-8 bg-brand-bg rounded-[2rem] space-y-1">
                        <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Success Rate</p>
                        <p className="text-4xl font-serif font-black italic">{Math.round((score / questions.length) * 100)}%</p>
                    </div>
                    <div className="p-8 bg-brand-bg rounded-[2rem] space-y-1">
                        <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Growth Earned</p>
                        <p className="text-4xl font-serif font-black italic text-brand-accent">+{score * 20} XP</p>
                    </div>
                </div>

                <div className="flex justify-center pt-8">
                   <Link to="/" className="text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-all border-b-2 border-transparent hover:border-brand-accent pb-1">
                      Return to home
                   </Link>
                </div>
            </motion.div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                    <span className="technical-label">Daily Practice Ritual</span>
                </div>
                <div className="flex items-center gap-6 bg-white p-2 px-4 rounded-full border border-brand-border">
                    <div className="w-32 h-1 bg-brand-bg rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-brand-accent"
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                        />
                    </div>
                    <span className="mono-data text-[10px]">{currentIndex + 1} / {questions.length}</span>
                </div>
            </header>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="space-y-12"
                >
                    <div className="card p-12 md:p-20 min-h-[340px] flex flex-col justify-center relative overflow-hidden bg-white text-center">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] select-none pointer-events-none">
                            <Sparkles className="w-64 h-64" />
                        </div>
                        <h3 className="text-3xl md:text-5xl font-serif font-medium leading-relaxed italic text-brand-primary relative z-10">
                            "{currentQuestion.question}"
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {currentQuestion.options.map((option, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrectOption = idx === currentQuestion.correctIndex;
                            const showResult = selectedOption !== null;

                            let styles = "bg-white border-brand-border hover:border-brand-accent hover:bg-brand-bg";
                            if (showResult) {
                                if (isCorrectOption) styles = "bg-brand-accent border-brand-accent text-white shadow-lg shadow-brand-accent/20";
                                else if (isSelected) styles = "bg-red-50 border-red-200 text-red-600";
                                else styles = "bg-brand-bg border-brand-border opacity-40 cursor-not-allowed";
                            }

                            return (
                                <button
                                    key={idx}
                                    disabled={showResult}
                                    onClick={() => handleOptionSelect(idx)}
                                    className={`w-full p-8 rounded-[2rem] border-2 text-left transition-all duration-300 flex items-center justify-between group h-full ${styles}`}
                                >
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1 block">Option 0{idx + 1}</span>
                                        <span className="text-lg font-serif italic group-hover:not-italic transition-all">{option}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {showResult && isCorrectOption && <CheckCircle2 className="w-6 h-6" />}
                                        {showResult && isSelected && !isCorrectOption && <XCircle className="w-6 h-6" />}
                                        {!showResult && <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            </AnimatePresence>

            {selectedOption !== null && (
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="card p-12 bg-white space-y-10"
                >
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <Lightbulb className="w-4 h-4 text-brand-accent" />
                            <h4 className="technical-label">Contextual Insight</h4>
                        </div>
                        <p className="text-xl text-brand-muted leading-relaxed font-serif italic border-l-4 border-brand-bg pl-8">
                            {currentQuestion.explanation}
                        </p>
                    </div>
                    <button
                        onClick={handleNext}
                        className="w-full btn-primary"
                    >
                        {currentIndex === questions.length - 1 ? "Finish Session" : "Next Question"}
                    </button>
                </motion.div>
            )}
        </div>
    );
};

export default Quiz;
