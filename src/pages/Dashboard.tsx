import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Flame, 
  BookOpen, 
  ChevronRight,
  TrendingUp,
  Clock,
  ExternalLink,
  Zap,
  Volume2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mic,
  Camera,
  Keyboard
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, limit, getDocs, orderBy, doc, getDoc, setDoc, updateDoc, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { suggestDailyWord, generateWordDetails, WordDefinition, verifyReview, getWritingGuidance, analyzeSentence, SentenceAnalysis } from '../services/geminiService';
import { Link } from 'react-router-dom';
import { UserWord, Sentence } from '../types';
import { BrainCircuit, Lightbulb, Send } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
    const { profile, user, updateDifficulty } = useAuth();
    const [todayWord, setTodayWord] = useState<WordDefinition | null>(null);
    const [recentWords, setRecentWords] = useState<any[]>([]);
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState<'CHECKING' | 'REVIEW' | 'DISCOVERY' | 'COMPLETE'>('CHECKING');
    
    // Review State
    const [prevWord, setPrevWord] = useState<{ term: string; id: string } | null>(null);
    const [reviewMeaning, setReviewMeaning] = useState('');
    const [reviewSentences, setReviewSentences] = useState(['', '']);
    const [reviewMode, setReviewMode] = useState<'KEYBOARD' | 'VOICE' | 'IMAGE'>('KEYBOARD');
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
    const [discoverySentence, setDiscoverySentence] = useState('');
    const [savingSentence, setSavingSentence] = useState(false);
    
    const [aiGuidance, setAiGuidance] = useState<string | null>(null);
    const [aiFeedback, setAiFeedback] = useState<SentenceAnalysis | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user || !profile) return;
            setLoading(true);

            try {
                // 1. Check Today's Status
                const todayStr = new Date().toISOString().split('T')[0];
                const logPath = `users/${user.uid}/logs/${todayStr}`;
                const logRef = doc(db, logPath);
                const logSnap = await getDoc(logRef);

                // Check for pending reviews from ANY previous day
                const logsRef = collection(db, `users/${user.uid}/logs`);
                const qLogs = query(logsRef, orderBy('createdAt', 'desc'), limit(10));
                const logsSnap = await getDocs(qLogs);
                const fetchedLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setDailyLogs(fetchedLogs);

                const qPrev = query(logsRef, where('reviewed', '==', false), orderBy('createdAt', 'desc'), limit(10));
                const pendingSnap = await getDocs(qPrev);

                // Find the most recent unreviewed log that ISN'T today
                const pendingReview = pendingSnap.docs.find(d => d.data().date !== todayStr);

                if (pendingReview) {
                    setPrevWord({ term: pendingReview.data().dailyWord, id: pendingReview.id });
                    setPhase('REVIEW');
                } else if (logSnap.exists()) {
                    const logData = logSnap.data();
                    // If user changed difficulty but hasn't "mastered" or "word" isn't in their list yet, 
                    // or if we just want to allow a refresh for new difficulty
                    if (logData.difficultyPreference !== profile.difficulty) {
                        await unlockToday(todayStr); // Re-generate for new difficulty
                    } else {
                        await loadTodayWord(logData.dailyWord);
                        setPhase('DISCOVERY');
                    }
                } else {
                    await unlockToday(todayStr);
                }

                // 2. Fetch Recent Words
                const userWordsPath = `users/${user.uid}/words`;
                const wordsRef = collection(db, userWordsPath);
                const q = query(wordsRef, orderBy('lastReviewedAt', 'desc'), limit(10));
                const wordsSnap = await getDocs(q);
                setRecentWords(wordsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            } catch (err) {
                console.error("Error fetching dashboard:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, profile?.level, profile?.difficulty]);

    const loadTodayWord = async (term: string) => {
        const globalWordPath = `global_words/${term.toLowerCase()}`;
        const globalWordRef = doc(db, globalWordPath);
        const globalSnap = await getDoc(globalWordRef);
        
        if (globalSnap.exists()) {
            const data = globalSnap.data() as WordDefinition;
            setTodayWord(data);
            // Sync details to user word for offline convenience and consistency
            if (user) {
                const userWordRef = doc(db, 'users', user.uid, 'words', term.toLowerCase());
                await setDoc(userWordRef, {
                    meaning: data.definition,
                    phonetic: data.phonetic,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        } else {
            const details = await generateWordDetails(term);
            await setDoc(globalWordRef, details);
            setTodayWord(details);
            if (user) {
                const userWordRef = doc(db, 'users', user.uid, 'words', term.toLowerCase());
                await setDoc(userWordRef, {
                    meaning: details.definition,
                    phonetic: details.phonetic,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        }

        // Also check if user already has a sentence for this word
        if (user) {
            const sentencesPath = `users/${user.uid}/words/${term.toLowerCase()}/sentences`;
            const q = query(collection(db, sentencesPath), orderBy('createdAt', 'desc'), limit(1));
            const sentencesSnap = await getDocs(q);
            if (!sentencesSnap.empty) {
                setDiscoverySentence(sentencesSnap.docs[0].data().text);
            }
        }
    };

    const unlockToday = async (dateStr: string) => {
        if (!user || !profile) return;
        
        // Get exclusion list (last 40 days)
        const logsRef = collection(db, `users/${user.uid}/logs`);
        const qHistory = query(logsRef, orderBy('createdAt', 'desc'), limit(40));
        const historySnap = await getDocs(qHistory);
        const exclusionList = historySnap.docs.map(d => d.data().dailyWord);

        const suggested = await suggestDailyWord(profile?.level || 1, profile?.difficulty || 'intermediate', exclusionList);
        const logRef = doc(db, `users/${user.uid}/logs/${dateStr}`);
        
        await setDoc(logRef, {
            userId: user.uid,
            date: dateStr,
            dailyWord: suggested,
            reviewed: false,
            difficultyPreference: profile.difficulty,
            createdAt: serverTimestamp()
        }, { merge: true });

        // Add to user's permanent lexicon automatically on discovery - ONLY if not exists to preserve history
        const wordRef = doc(db, 'users', user.uid, 'words', suggested.toLowerCase());
        const wordSnap = await getDoc(wordRef);
        
        if (!wordSnap.exists()) {
            await setDoc(wordRef, {
                word: suggested,
                meaning: '', // Initial state, will be updated by loadTodayWord
                phonetic: '',
                difficulty: profile.difficulty || 'intermediate',
                status: 'pending',
                source: 'daily',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                aiGenerated: true
            });
        } else {
            // Just update source if it was something else, but keep status/sentences
            await updateDoc(wordRef, {
                updatedAt: serverTimestamp()
            });
        }

        await loadTodayWord(suggested);
        setPhase('DISCOVERY');
    };

    const handleReviewSubmit = async () => {
        if (!prevWord || !user) return;
        setReviewLoading(true);
        setReviewFeedback(null);

        try {
            const result = await verifyReview(prevWord.term, reviewMeaning, reviewSentences);
            setReviewFeedback(result.feedback);

            if (result.passed) {
                // Update prev log as reviewed
                const logRef = doc(db, 'users', user.uid, 'logs', prevWord.id);
                await setDoc(logRef, { reviewed: true }, { merge: true });
                
                const newSentenceId = crypto.randomUUID();
                const sentencesPath = `users/${user.uid}/words/${prevWord.term.toLowerCase()}/sentences`;
                const sentenceRef = doc(db, sentencesPath, newSentenceId);

                const sentenceData = {
                    id: newSentenceId,
                    text: reviewSentences[0],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                // Update Word status (subcollection write next) - preserving metadata
                const wordRef = doc(db, 'users', user.uid, 'words', prevWord.term.toLowerCase());
                const wordSnap = await getDoc(wordRef);
                
                if (!wordSnap.exists()) {
                    await setDoc(wordRef, { 
                        word: prevWord.term,
                        status: 'reviewed',
                        updatedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                        lastSentenceText: reviewSentences[0],
                        sentencesCount: 1,
                        source: 'daily',
                        aiGenerated: false
                    });
                } else {
                    await updateDoc(wordRef, {
                        status: 'reviewed',
                        updatedAt: serverTimestamp(),
                        lastSentenceText: reviewSentences[0],
                        sentencesCount: increment(1)
                    });
                }

                // Add to subcollection
                await setDoc(sentenceRef, sentenceData);

                // Update User XP
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, { xp: increment(25) }, { merge: true });

                setTimeout(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    unlockToday(todayStr);
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            setReviewFeedback("Validation service error. Please try again.");
        } finally {
            setReviewLoading(false);
        }
    };

    const playAudio = (term: string) => {
        const utterance = new SpeechSynthesisUtterance(term);
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
    };

    const handleAiGuidance = async () => {
        if (!todayWord) return;
        setAiLoading(true);
        try {
            // Check if we have previous sentences for this word
            const q = query(collection(db, `users/${user?.uid}/words/${todayWord.term.toLowerCase()}/sentences`), orderBy('createdAt', 'desc'), limit(5));
            const prevSentencesSnap = await getDocs(q);
            const prevSentences = prevSentencesSnap.docs.map(d => d.data().text as string);
            
            const guidance = await getWritingGuidance(todayWord.term, todayWord.definition, prevSentences);
            setAiGuidance(guidance);
            setAiFeedback(null);
        } catch (err) {
            console.error(err);
            toast.error("The mentor is currently reflecting.");
        } finally {
            setAiLoading(false);
        }
    };

    const saveDiscoverySentence = async () => {
        if (!user || !todayWord || !discoverySentence.trim()) return;
        setSavingSentence(true);
        setFeedbackLoading(true);
        const userWordPath = `users/${user.uid}/words/${todayWord.term.toLowerCase()}`;
        const sentencesPath = `${userWordPath}/sentences`;
        try {
            // Get feedback
            const userWordRef = doc(db, 'users', user.uid, 'words', todayWord.term.toLowerCase());
            const userWordSnap = await getDoc(userWordRef);
            
            // For analysis, we might need previous sentences
            // For simplicity in Dashboard (often first time seeing word), we can fetch some
            const q = query(collection(db, sentencesPath), orderBy('createdAt', 'desc'), limit(5));
            const prevSentencesSnap = await getDocs(q);
            const prevSentences = prevSentencesSnap.docs.map(d => d.data().text as string);
            
            const analysis = await analyzeSentence(todayWord.term, todayWord.definition, discoverySentence.trim(), prevSentences);
            setAiFeedback(analysis);
            setAiGuidance(null);

            const newSentenceId = crypto.randomUUID();
            const sentenceRef = doc(db, sentencesPath, newSentenceId);
            
            const sentenceData = {
                id: newSentenceId,
                text: discoverySentence.trim(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const wordSnap = await getDoc(userWordRef);
            if (!wordSnap.exists()) {
                await setDoc(userWordRef, {
                    word: todayWord.term,
                    meaning: todayWord.definition,
                    phonetic: todayWord.phonetic || '',
                    difficulty: todayWord.difficulty || 'intermediate',
                    status: 'pending',
                    source: 'daily',
                    aiGenerated: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastSentenceText: discoverySentence.trim(),
                    sentencesCount: 1
                });
            } else {
                await updateDoc(userWordRef, {
                    updatedAt: serverTimestamp(),
                    lastSentenceText: discoverySentence.trim(),
                    sentencesCount: increment(1)
                });
            }

            await setDoc(sentenceRef, sentenceData);

            toast.success("Sentence recorded. Mentor analysis complete.");
            setDiscoverySentence('');
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, sentencesPath);
        } finally {
            setSavingSentence(false);
            setFeedbackLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-10 w-48 bg-black/5 rounded" />
                <div className="h-64 bg-white rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="space-y-20 pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                        <span className="technical-label">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif font-black italic tracking-tight leading-tight">
                        Hello {profile?.displayName?.split(' ')[0]}, <br/>
                        <span className="text-brand-accent italic">Ready for your daily word?</span>
                    </h2>
                </div>

                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <Link to="/practice" className="btn-primary py-4 px-8 flex items-center justify-center gap-3">
                        <Zap className="w-5 h-5" />
                        <span>Start Practice</span>
                    </Link>
                    <div className="flex flex-col gap-3 p-1 bg-white border border-brand-border rounded-3xl">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted px-4 pt-2 text-center">Difficulty</p>
                        <div className="flex gap-1 p-1">
                            {['beginner', 'intermediate', 'advanced'].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => updateDifficulty?.(d as any)}
                                    className={`px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                                        (profile?.difficulty || 'intermediate') === d
                                        ? 'bg-brand-accent text-white shadow-lg'
                                        : 'text-brand-muted hover:text-brand-primary'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {phase === 'REVIEW' && (
                <section className="max-w-3xl space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></div>
                        <h4 className="technical-label">Phase 2: Memory Validation</h4>
                    </div>
                    <div className="card p-12 space-y-10 bg-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-brand-muted uppercase tracking-widest">Yesterday's Keyword</p>
                                <h3 className="text-6xl font-serif font-black italic text-brand-accent">{prevWord?.term}</h3>
                            </div>
                            <div className="flex bg-brand-bg p-1 rounded-2xl gap-1">
                                <button onClick={() => setReviewMode('KEYBOARD')} className={`p-3 rounded-xl transition-all ${reviewMode === 'KEYBOARD' ? 'bg-white text-brand-accent shadow-sm' : 'text-brand-muted'}`}><Keyboard className="w-4 h-4"/></button>
                                <button onClick={() => setReviewMode('VOICE')} className={`p-3 rounded-xl transition-all ${reviewMode === 'VOICE' ? 'bg-white text-brand-accent shadow-sm' : 'text-brand-muted'}`}><Mic className="w-4 h-4"/></button>
                                <button onClick={() => setReviewMode('IMAGE')} className={`p-3 rounded-xl transition-all ${reviewMode === 'IMAGE' ? 'bg-white text-brand-accent shadow-sm' : 'text-brand-muted'}`}><Camera className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {reviewMode === 'KEYBOARD' ? (
                                <>
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold uppercase tracking-widest text-brand-muted">Meaning Reconstruction</label>
                                        <textarea 
                                            value={reviewMeaning}
                                            onChange={(e) => setReviewMeaning(e.target.value)}
                                            placeholder="Explain the definition in your own words..."
                                            className="w-full p-6 border border-brand-border rounded-2xl font-serif italic text-lg bg-brand-bg/10 focus:outline-none focus:border-brand-accent transition-all"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold uppercase tracking-widest text-brand-muted">Semantic Integration (2 sentences)</label>
                                        <div className="space-y-4">
                                            <input 
                                                type="text"
                                                value={reviewSentences[0]}
                                                onChange={(e) => setReviewSentences([e.target.value, reviewSentences[1]])}
                                                placeholder="Example context 01..."
                                                className="w-full p-4 border border-brand-border rounded-xl font-serif italic bg-brand-bg/5 focus:outline-none focus:border-brand-accent"
                                            />
                                            <input 
                                                type="text"
                                                value={reviewSentences[1]}
                                                onChange={(e) => setReviewSentences([reviewSentences[0], e.target.value])}
                                                placeholder="Example context 02..."
                                                className="w-full p-4 border border-brand-border rounded-xl font-serif italic bg-brand-bg/5 focus:outline-none focus:border-brand-accent"
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-12 text-center bg-brand-bg/20 border-2 border-dashed border-brand-border rounded-3xl space-y-4">
                                    {reviewMode === 'VOICE' ? <Mic className="w-12 h-12 mx-auto text-brand-muted animate-pulse" /> : <Camera className="w-12 h-12 mx-auto text-brand-muted" />}
                                    <p className="text-sm font-bold uppercase tracking-widest text-brand-muted">
                                        {reviewMode === 'VOICE' ? 'Listening for transcription...' : 'Upload OCR scan or capture image'}
                                    </p>
                                    <button className="text-[10px] font-black uppercase text-brand-accent hover:underline">Connect to sensor</button>
                                </div>
                            )}
                        </div>

                        {reviewFeedback && (
                            <div className={`p-6 rounded-2xl flex items-start gap-4 ${reviewFeedback.includes('passed') || !reviewFeedback.includes('error') ? 'bg-brand-accent/10 border border-brand-accent/20' : 'bg-red-50 border border-red-100'}`}>
                                <AlertCircle className="w-5 h-5 shrink-0 mt-1" />
                                <p className="text-sm font-medium leading-relaxed">{reviewFeedback}</p>
                            </div>
                        )}

                        <button 
                            onClick={handleReviewSubmit}
                            disabled={reviewLoading || !reviewMeaning || !reviewSentences[0] || !reviewSentences[1]}
                            className="btn-primary w-full py-6 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {reviewLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Verify Recall</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </section>
            )}

            {phase === 'DISCOVERY' && todayWord && (
                <section className="space-y-12 animate-in fade-in duration-1000 slide-in-from-bottom-8">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle2 className="w-4 h-4 text-brand-accent" />
                        <h4 className="technical-label">Phase 3: Today's Discovery</h4>
                    </div>
                    
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="card p-12 md:p-20 relative overflow-hidden bg-white border-brand-accent/5"
                    >
                        <div className="relative z-10 space-y-10">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <h3 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter text-brand-accent lowercase">
                                        {todayWord.term}
                                    </h3>
                                    <div className="flex items-center gap-6 text-sm font-medium text-brand-muted mt-4 uppercase tracking-widest">
                                        <button 
                                            onClick={() => playAudio(todayWord.term)}
                                            className="flex items-center gap-2 hover:text-brand-accent transition-colors"
                                        >
                                            <Volume2 className="w-4 h-4" />
                                            <span>/{todayWord.phonetic}/</span>
                                        </button>
                                        <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
                                        <span>{todayWord.partOfSpeech}</span>
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-brand-bg rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted border border-brand-border">
                                    {todayWord.difficulty} level
                                </div>
                            </div>
                            
                            <div className="max-w-3xl space-y-10">
                                <p className="text-2xl md:text-4xl font-serif italic text-brand-primary leading-tight">
                                    "{todayWord.definition}"
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-brand-border">
                                    {todayWord.examples.slice(0, 2).map((ex, i) => (
                                        <div key={i} className="space-y-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Usage Example 0{i + 1}</p>
                                            <p className="text-lg font-serif italic text-brand-muted leading-relaxed">"{ex}"</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-10 border-t border-brand-border space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="technical-label">Craft Your Own Context</h4>
                                        <button 
                                            onClick={handleAiGuidance}
                                            disabled={aiLoading}
                                            className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-accent hover:text-brand-primary transition-colors disabled:opacity-50"
                                        >
                                            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                                            Mentor Assistant
                                        </button>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {aiGuidance && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-brand-accent/5 p-6 rounded-2xl border border-brand-accent/20 space-y-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Lightbulb className="w-4 h-4 text-brand-accent" />
                                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-brand-accent">Mentor's Guidance</h5>
                                                </div>
                                                <p className="text-sm font-serif italic text-brand-primary leading-relaxed">
                                                    {aiGuidance}
                                                </p>
                                            </motion.div>
                                        )}

                                        {aiFeedback && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-brand-bg p-8 rounded-3xl border border-brand-border space-y-8 shadow-sm"
                                            >
                                                <div className="flex items-center gap-3 pb-4 border-b border-brand-border">
                                                    <BrainCircuit className="w-5 h-5 text-brand-accent" />
                                                    <h5 className="text-xs font-black uppercase tracking-widest text-brand-primary">Mentor's Analysis</h5>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-6">
                                                        <div className="space-y-2">
                                                            <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-muted">Evaluation</h6>
                                                            <p className="text-sm font-serif italic text-brand-primary">{aiFeedback.evaluation}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-green-600">✓ What works</h6>
                                                            <p className="text-sm font-serif italic text-brand-muted">{aiFeedback.whatWorks}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-accent">Better flow</h6>
                                                            <div className="p-4 bg-white rounded-xl border border-brand-border italic font-serif text-brand-primary">
                                                                {aiFeedback.suggestedRefinement}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-6">
                                                        <div className="space-y-2">
                                                            <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">△ Improve</h6>
                                                            <p className="text-sm font-serif italic text-brand-muted">{aiFeedback.whatSoundsUnnatural}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h6 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">Advanced tip</h6>
                                                            <div className="p-6 bg-brand-primary text-white rounded-2xl shadow-lg leading-relaxed font-serif italic text-sm">
                                                                {aiFeedback.advancedInsight}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h6 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent">Exemplary Sentence</h6>
                                                            <div className="p-6 bg-white border-2 border-brand-accent/30 rounded-2xl shadow-sm leading-relaxed font-serif italic text-lg text-brand-primary">
                                                                “{aiFeedback.exemplarySentence}”
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="relative">
                                        <textarea 
                                            value={discoverySentence}
                                            onChange={(e) => setDiscoverySentence(e.target.value)}
                                            placeholder="Weave this word into your own reality..."
                                            className="w-full h-40 p-8 bg-brand-bg/30 border border-brand-border rounded-3xl font-serif italic text-xl focus:outline-none focus:border-brand-accent transition-all resize-none shadow-inner"
                                        />
                                        <button 
                                            onClick={saveDiscoverySentence}
                                            disabled={savingSentence || feedbackLoading || !discoverySentence.trim()}
                                            className="absolute bottom-6 right-6 p-4 bg-brand-accent text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                                        >
                                            {savingSentence || feedbackLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-brand-muted italic">Saving a sentence anchors the word in your long-term memory.</p>
                                </div>
                            </div>

                            <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                <Link to={`/word/${todayWord.term}`} className="btn-primary px-12 py-5 flex items-center gap-3">
                                    <span>Deep Synthesis</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                                <p className="text-sm font-serif italic text-brand-muted">
                                    Great job! See you tomorrow for your review.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Sidebar Stats and History */}
            {phase !== 'CHECKING' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pt-12 border-t border-brand-border">
                    <div className="space-y-6">
                        <h4 className="technical-label flex items-center gap-2">
                             Status
                        </h4>
                        <div className="card p-8 bg-brand-bg space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Trophy className="w-5 h-5 text-brand-accent" />
                                    <span className="mono-data">Lvl {profile?.level}</span>
                                </div>
                                <p className="text-4xl font-serif font-black italic">{profile?.xp || 0}</p>
                                <p className="text-[10px] font-bold text-brand-muted uppercase mt-1">Total Experience</p>
                            </div>
                            
                            <div className="pt-6 border-t border-brand-border/10">
                                <div className="flex items-center justify-between mb-2">
                                    <Flame className="w-5 h-5 text-orange-500" />
                                    <span className="mono-data">{profile?.streak || 1} Days</span>
                                </div>
                                <p className="text-2xl font-serif font-black italic">Active Streak</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 space-y-8">
                        <div className="flex items-center justify-between">
                            <h4 className="technical-label">Linguistic Journey (Last 7 Days)</h4>
                            <Link to="/library" className="text-xs font-bold text-brand-accent hover:underline">View All History</Link>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {dailyLogs.length > 0 ? dailyLogs.map((log) => (
                                <Link 
                                    key={log.id} 
                                    to={`/word/${log.dailyWord}`}
                                    className="card p-6 group hover:border-brand-accent transition-all bg-white relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${log.reviewed ? 'bg-green-50 text-green-600' : 'bg-brand-bg text-brand-muted'}`}>
                                            {log.reviewed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        </div>
                                        <span className="text-[8px] font-mono text-brand-muted uppercase tracking-tighter">
                                            {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="text-xl font-serif font-bold italic group-hover:text-brand-accent transition-colors truncate lowercase">{log.dailyWord}</p>
                                    <p className="text-[9px] font-bold text-brand-muted uppercase tracking-widest mt-1">
                                        {log.reviewed ? 'Mastered' : 'Pending'}
                                    </p>
                                </Link>
                            )) : (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-brand-border rounded-3xl opacity-50">
                                    <p className="text-sm font-serif italic text-brand-muted">Your journey begins today.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6 pt-8 border-t border-brand-border">
                            <h4 className="technical-label">Refined Knowledge</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                                {recentWords.slice(0, 12).map((word) => (
                                    <Link 
                                        key={word.id} 
                                        to={`/word/${word.term}`}
                                        className="card p-4 group hover:bg-brand-accent hover:text-white transition-all text-center"
                                    >
                                        <p className="text-[11px] font-serif font-bold italic truncate group-hover:scale-110 transition-transform lowercase">{word.term}</p>
                                    </Link>
                                ))}
                                {recentWords.length === 0 && (
                                    <div className="col-span-full py-8 text-center opacity-30 italic text-xs">No words in permanent collection yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SparkleIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L14.5 9L22 12L14.5 15L12 22L9.5 15L2 12L9.5 9L12 2Z" />
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
        <path d="M5 3l1 1M19 3l-1 1M5 19l1-1M19 19l-1-1" />
    </svg>
);

export default Dashboard;
