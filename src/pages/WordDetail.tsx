import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Bookmark, 
  CheckCircle, 
  Volume2, 
  Layers, 
  History, 
  Lightbulb, 
  Sparkles,
  Send,
  Loader2,
  BrainCircuit,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  updateDoc, 
  increment, 
  arrayUnion, 
  onSnapshot,
  collection,
  deleteDoc,
  orderBy,
  query
} from 'firebase/firestore';
import { 
  generateWordDetails, 
  generatePracticeSentence,
  getWritingGuidance,
  analyzeSentence,
  WordDefinition,
  SentenceAnalysis
} from '../services/geminiService';
import { useAuth } from '../hooks/useAuth';
import { UserWord, Sentence } from '../types';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const WordDetail: React.FC = () => {
    const { term } = useParams<{ term: string }>();
    const { user, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    
    const [wordDetails, setWordDetails] = useState<WordDefinition | null>(null);
    const [userWord, setUserWord] = useState<UserWord | null>(null);
    const [loading, setLoading] = useState(true);
    const [newSentence, setNewSentence] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [aiGuidance, setAiGuidance] = useState<string | null>(null);
    const [aiFeedback, setAiFeedback] = useState<SentenceAnalysis | null>(null);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [realtimeSentences, setRealtimeSentences] = useState<Sentence[]>([]);

    // 1. Sync User Word Data
    useEffect(() => {
        if (!term || !user) return;

        const userWordPath = `users/${user.uid}/words/${term.toLowerCase()}`;
        const unsub = onSnapshot(doc(db, userWordPath), (docSnap) => {
            if (docSnap.exists()) {
                setUserWord(docSnap.data() as UserWord);
            } else {
                setUserWord(null);
            }
        }, (err) => handleFirestoreError(err, OperationType.GET, userWordPath));

        // Subcollection listener for sentences
        const sentencesPath = `${userWordPath}/sentences`;
        const q = query(collection(db, sentencesPath), orderBy('createdAt', 'desc'));
        const unsubSentences = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Sentence));
            setRealtimeSentences(data);
        }, (err) => handleFirestoreError(err, OperationType.LIST, sentencesPath));

        return () => {
            unsub();
            unsubSentences();
        };
    }, [term, user]);

    // 2. Fetch Global Word Details
    useEffect(() => {
        const fetchDetails = async () => {
            if (!term) return;
            setLoading(true);
            try {
                const globalWordPath = `global_words/${term.toLowerCase()}`;
                const globalWordRef = doc(db, globalWordPath);
                const globalSnap = await getDoc(globalWordRef);
                
                if (globalSnap.exists()) {
                    setWordDetails(globalSnap.data() as WordDefinition);
                } else {
                    const details = await generateWordDetails(term);
                    await setDoc(globalWordRef, details);
                    setWordDetails(details);
                }
            } catch (err) {
                console.error("Error fetching word details:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [term]);

    const handleAiGuidance = async () => {
        if (!term || !wordDetails) return;
        setAiLoading(true);
        try {
            const previousSentences = realtimeSentences.map(s => s.text);
            const guidance = await getWritingGuidance(term, wordDetails.definition, previousSentences);
            setAiGuidance(guidance);
            setAiFeedback(null);
        } catch (err) {
            console.error("AI Guidance failed:", err);
            toast.error("The mentor is currently reflecting. Please try again.");
        } finally {
            setAiLoading(false);
        }
    };

    const addSentence = async (text: string) => {
        if (!user || !term || !text.trim()) return;
        setSaving(true);
        setFeedbackLoading(true);
        const userWordPath = `users/${user.uid}/words/${term.toLowerCase()}`;
        const sentencesPath = `${userWordPath}/sentences`;
        try {
            // Get analysis first
            const previousSentences = realtimeSentences.map(s => s.text);
            const analysis = await analyzeSentence(term, wordDetails?.definition || '', text.trim(), previousSentences);
            setAiFeedback(analysis);
            setAiGuidance(null);

            const userWordRef = doc(db, 'users', user.uid, 'words', term.toLowerCase());
            const newSentenceId = crypto.randomUUID();
            const sentenceRef = doc(db, sentencesPath, newSentenceId);
            
            const sentenceData = {
                id: newSentenceId,
                text: text.trim(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Check if word document exists to avoid overwriting metadata
            const wordSnap = await getDoc(userWordRef);
            if (!wordSnap.exists()) {
                await setDoc(userWordRef, {
                    word: term,
                    meaning: wordDetails?.definition || '',
                    phonetic: wordDetails?.phonetic || '',
                    difficulty: wordDetails?.difficulty || 'intermediate',
                    source: 'search',
                    status: 'pending',
                    aiGenerated: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastSentenceText: text.trim(),
                    sentencesCount: 1
                });
            } else {
                await updateDoc(userWordRef, {
                    updatedAt: serverTimestamp(),
                    lastSentenceText: text.trim(),
                    sentencesCount: increment(1)
                });
            }

            // Always add to subcollection
            await setDoc(sentenceRef, sentenceData);
            
            setNewSentence('');
            toast.success("Sentence recorded. Mentor analysis complete.");
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, sentencesPath);
        } finally {
            setSaving(false);
            setFeedbackLoading(false);
        }
    };

    const editSentence = async (sentenceId: string, text: string) => {
        if (!user || !term || !text.trim()) return;
        const sentencePath = `users/${user.uid}/words/${term.toLowerCase()}/sentences/${sentenceId}`;
        const userWordRef = doc(db, 'users', user.uid, 'words', term.toLowerCase());
        try {
            await updateDoc(doc(db, sentencePath), {
                text: text.trim(),
                updatedAt: serverTimestamp()
            });
            
            // If this was the last sentence, we should theoretically update the denormalized text 
            // if it happened to be the one shown. For simplicity, we can update it if it matches 
            // or just always update if it's the most recent in the list.
            if (realtimeSentences[0]?.id === sentenceId) {
                await updateDoc(userWordRef, {
                    lastSentenceText: text.trim()
                });
            }

            toast.success("Sentence refined.");
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, sentencePath);
        }
    };

    const deleteSentence = async (sentenceId: string) => {
        if (!user || !term) return;
        const sentencePath = `users/${user.uid}/words/${term.toLowerCase()}/sentences/${sentenceId}`;
        const userWordRef = doc(db, 'users', user.uid, 'words', term.toLowerCase());
        try {
            await deleteDoc(doc(db, sentencePath));
            
            // Update denormalized state
            const newLastSentence = realtimeSentences.find(s => s.id !== sentenceId);
            await updateDoc(userWordRef, {
                sentencesCount: increment(-1),
                lastSentenceText: newLastSentence ? newLastSentence.text : ""
            });

            toast.success("Sentence removed from history.");
        } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, sentencePath);
        }
    };

    const markReviewed = async () => {
        if (!user || !term) return;
        const userWordPath = `users/${user.uid}/words/${term.toLowerCase()}`;
        try {
            await updateDoc(doc(db, userWordPath), {
                status: 'reviewed',
                updatedAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'users', user.uid), {
                xp: increment(25)
            });
            refreshProfile();
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, userWordPath);
        }
    };

    const playAudio = () => {
        if (!term) return;
        const utterance = new SpeechSynthesisUtterance(term);
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
    };

    const SentenceItem = ({ sentence }: { sentence: Sentence }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editedText, setEditedText] = useState(sentence.text);
        const [isDeleting, setIsDeleting] = useState(false);

        const handleSave = async () => {
            if (editedText.trim() === sentence.text) {
                setIsEditing(false);
                return;
            }
            await editSentence(sentence.id, editedText);
            setIsEditing(false);
        };

        const handleCancel = () => {
            setEditedText(sentence.text);
            setIsEditing(false);
        };

        return (
            <motion.div 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-white p-6 rounded-2xl border border-brand-border/50 space-y-3 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-accent/20" />
                
                {isEditing ? (
                    <div className="space-y-4">
                        <textarea 
                            autoFocus
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full bg-brand-bg/50 p-4 rounded-xl font-serif italic text-lg leading-relaxed focus:outline-none focus:ring-1 ring-brand-accent transition-all resize-none h-24"
                        />
                        <div className="flex items-center justify-end gap-3">
                            <button 
                                onClick={handleCancel}
                                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-colors flex items-center gap-1.5"
                            >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={!editedText.trim() || editedText.trim() === sentence.text}
                                className="px-6 py-2 bg-brand-primary text-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-start gap-4">
                            <p className="text-lg font-serif italic text-brand-primary leading-relaxed flex-grow">
                                "{sentence.text}"
                            </p>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="p-2 text-brand-muted hover:text-brand-accent transition-colors"
                                    title="Edit sentence"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setIsDeleting(true)}
                                    className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                                    title="Delete sentence"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-[8px] font-bold text-brand-muted uppercase tracking-tighter">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-2.5 h-2.5" />
                                {sentence.createdAt?.toDate ? sentence.createdAt.toDate().toLocaleDateString() : 'Just now'}
                            </div>
                            {sentence.updatedAt && sentence.updatedAt !== sentence.createdAt && (
                                <span className="italic opacity-50">(Refined)</span>
                            )}
                        </div>

                        <AnimatePresence>
                            {isDeleting && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 p-6 text-center z-10"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Remove this context from history?</p>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setIsDeleting(false)}
                                            className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary"
                                        >
                                            Keep
                                        </button>
                                        <button 
                                            onClick={() => deleteSentence(sentence.id)}
                                            className="px-6 py-2 bg-red-500 text-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-500/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </motion.div>
        );
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
            <p className="text-xs font-bold text-brand-muted uppercase tracking-[0.2em]">Analyzing lexicon...</p>
        </div>
    );

    if (!wordDetails) return <div className="text-center py-20 font-serif italic">The lexicon remains empty.</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <header className="flex items-center justify-between sticky top-24 glass py-4 px-8 z-30 rounded-full border border-brand-border">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex items-center gap-4">
                   {userWord?.status === 'pending' && realtimeSentences.length > 0 && (
                       <button 
                        onClick={markReviewed}
                        className="flex items-center gap-2 px-8 py-3 bg-brand-primary text-white rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-brand-accent hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-accent/30"
                       >
                           <CheckCircle className="w-4 h-4" />
                           Mark as Mastered
                       </button>
                   )}
                   {userWord?.status === 'pending' && realtimeSentences.length === 0 && (
                       <div className="px-6 py-2 bg-brand-bg text-brand-muted rounded-full text-[9px] font-bold uppercase tracking-widest border border-brand-border italic">
                           Practice to Master
                       </div>
                   )}
                   {userWord?.status === 'reviewed' && (
                       <div className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest border border-green-600 shadow-lg shadow-green-500/20">
                           <CheckCircle className="w-3.5 h-3.5" />
                           Mastered
                       </div>
                   )}
                </div>
            </header>

            <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-16"
            >
                {/* Word Hero */}
                <div className="space-y-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                        <h4 className="technical-label">Daily Discovery</h4>
                    </div>
                    <h1 className="text-7xl md:text-9xl font-serif font-black italic tracking-tighter leading-none lowercase">
                        {wordDetails.term}
                    </h1>
                    <div className="flex items-center justify-center gap-6 mt-4">
                        <button 
                            onClick={playAudio}
                            className="flex items-center gap-2 text-brand-muted hover:text-brand-accent transition-colors italic font-serif"
                        >
                            <Volume2 className="w-5 h-5" />
                            <span className="text-lg">/{wordDetails.phonetic}/</span>
                        </button>
                        <span className="w-1.5 h-1.5 bg-brand-border rounded-full"></span>
                        <span className="text-brand-accent font-bold uppercase tracking-[0.2em] text-[10px]">{wordDetails.partOfSpeech}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                    {/* Main Content */}
                    <div className="space-y-8">
                        <div className="card p-12 md:p-16 bg-white space-y-12">
                            <div className="space-y-8">
                                <h3 className="text-3xl md:text-4xl font-serif font-medium leading-relaxed italic text-brand-primary">
                                    "{wordDetails.definition}"
                                </h3>
                                
                                <div className="pt-12 border-t border-brand-border space-y-10">
                                    <h4 className="technical-label flex items-center gap-2 text-brand-muted">
                                        <Layers className="w-4 h-4 text-brand-accent" />
                                        Contextual Samples
                                    </h4>
                                    <div className="space-y-10">
                                        {wordDetails.examples.map((ex, i) => (
                                            <div key={i} className="pl-8 border-l-2 border-brand-accent/30 italic text-xl text-brand-muted font-serif leading-relaxed">
                                                "{ex}"
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Practice Interaction */}
                        <div className="card p-10 space-y-8 bg-brand-bg/20 border-brand-accent/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-brand-accent" />
                                    <h4 className="technical-label">Active Synthesis</h4>
                                </div>
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
                                        className="bg-white p-8 rounded-3xl border border-brand-border space-y-8 shadow-sm"
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
                                                    <div className="p-4 bg-brand-bg rounded-xl border border-brand-border italic font-serif text-brand-primary">
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
                                                    <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-primary">Advanced tip</h6>
                                                    <div className="p-6 bg-brand-primary text-white rounded-2xl shadow-lg leading-relaxed font-serif italic text-sm">
                                                        {aiFeedback.advancedInsight}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <h6 className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-accent">Exemplary Sentence</h6>
                                                    <div className="p-6 bg-white border-2 border-brand-accent/30 rounded-2xl shadow-sm leading-relaxed font-serif italic text-lg text-brand-primary">
                                                        “{aiFeedback.exemplarySentence}”
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group">
                                <textarea 
                                    value={newSentence}
                                    onChange={(e) => setNewSentence(e.target.value)}
                                    placeholder="Weave this word into a new context..."
                                    className="w-full h-40 p-8 bg-white border border-brand-border rounded-[2.5rem] focus:outline-none focus:border-brand-accent transition-all font-serif italic text-2xl resize-none shadow-sm"
                                />
                                <button 
                                    onClick={() => addSentence(newSentence)}
                                    disabled={saving || !newSentence.trim()}
                                    className="absolute bottom-6 right-6 px-8 py-4 bg-brand-accent text-white rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 flex items-center gap-3 font-bold uppercase tracking-widest text-[10px]"
                                >
                                    {saving || feedbackLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    {saving || feedbackLoading ? 'Consulting Mentor...' : 'Submit Synthesis'}
                                </button>
                            </div>

                            {/* Saved Sentences Timeline */}
                            <div className="space-y-6 pt-8 border-t border-brand-border/10">
                                <h4 className="technical-label text-[9px]">Your Saved Contexts</h4>
                                <AnimatePresence initial={false}>
                                    {realtimeSentences.length > 0 ? (
                                        <div className="space-y-4">
                                            {realtimeSentences.map((s) => (
                                                <SentenceItem key={s.id} sentence={s} />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-brand-muted py-4 text-center opacity-50">No practice sentences yet. Be the architect of your own language.</p>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Details */}
                    <div className="space-y-8">
                        <div className="card p-8 bg-brand-bg space-y-6 border-brand-border/40">
                           <div className="flex items-center gap-3">
                                <History className="w-5 h-5 text-brand-accent" />
                                <h4 className="technical-label">Etymological Roots</h4>
                           </div>
                           <div className="text-sm font-serif italic leading-relaxed text-brand-muted prose prose-sm max-w-none">
                               <ReactMarkdown>{wordDetails.etymology || ''}</ReactMarkdown>
                           </div>
                        </div>

                        <div className="card p-8 bg-white space-y-6">
                            <div className="flex items-center gap-3">
                                <Lightbulb className="w-5 h-5 text-brand-accent" />
                                <h4 className="technical-label">Contextual Nuance</h4>
                            </div>
                            <div className="text-sm font-serif italic leading-relaxed text-brand-primary">
                                <ReactMarkdown>{wordDetails.usageDepth || ''}</ReactMarkdown>
                            </div>
                        </div>

                        {wordDetails.synonyms?.length > 0 && (
                            <div className="card p-8 bg-white space-y-4">
                                <h4 className="technical-label text-[9px]">Linguistic Relatives</h4>
                                <div className="flex flex-wrap gap-2">
                                    {wordDetails.synonyms.map(s => (
                                        <button 
                                            key={s}
                                            onClick={() => navigate(`/word/${s}`)}
                                            className="px-3 py-1 bg-brand-bg text-[10px] font-bold text-brand-muted hover:text-brand-accent rounded-lg transition-colors border border-brand-border/50 flex items-center gap-1"
                                        >
                                            {s}
                                            <ExternalLink className="w-2.5 h-2.5 opacity-30" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.section>
        </div>
    );
};

export default WordDetail;
