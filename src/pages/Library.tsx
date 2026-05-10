import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  BookOpen,
  ChevronRight,
  Bookmark,
  Sparkles,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Trello
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { UserWord } from '../types';

const Library: React.FC = () => {
    const { user } = useAuth();
    const [words, setWords] = useState<UserWord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

    const filterLabels: Record<string, string> = {
        all: 'All',
        pending: 'Pending',
        reviewed: 'Mastered'
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const wordsRef = collection(db, 'users', user.uid, 'words');
        const q = query(wordsRef, orderBy('updatedAt', 'desc'));
        
        const unsub = onSnapshot(q, (snap) => {
            const fetchedWords = snap.docs.map(d => ({ 
                id: d.id, 
                ...d.data() 
            })) as (UserWord & { id: string })[];
            setWords(fetchedWords as any);
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const filteredWords = words.filter((word: any) => {
        const wordText = (word.word || word.term || '').toLowerCase();
        const meaningText = (word.meaning || word.definition || '').toLowerCase();
        const matchesSearch = wordText.includes(searchTerm.toLowerCase()) || 
                             meaningText.includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || word.status === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-16 pb-32">
            <header className="space-y-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-brand-accent rounded-full"></div>
                        <span className="technical-label">Practice History</span>
                    </div>
                    <h2 className="text-5xl font-serif font-black italic tracking-tight">Your Lexicon</h2>
                    <p className="text-sm text-brand-muted italic">A detailed chronicle of {words.length} vocabulary milestones.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-8 items-center bg-white p-2 rounded-[2rem] border border-brand-border shadow-sm">
                    <div className="relative flex-1 group w-full">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input 
                            type="text" 
                            placeholder="Find a milestone in your history..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-4 py-4 bg-transparent text-sm focus:outline-none placeholder:text-brand-muted/50"
                        />
                    </div>
                    <div className="flex items-center gap-2 p-1 bg-brand-bg rounded-[1.5rem] w-full md:w-auto">
                        {['all', 'pending', 'reviewed'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                                    filter === f 
                                    ? 'bg-white text-brand-primary shadow-sm' 
                                    : 'text-brand-muted hover:text-brand-primary'
                                }`}
                            >
                                {filterLabels[f]}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 card animate-pulse bg-brand-bg/50" />
                    ))}
                </div>
            ) : (
                <AnimatePresence mode="popLayout">
                    {filteredWords.length > 0 ? (
                        <motion.div 
                            layout
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                        >
                            {filteredWords.map((word: any) => (
                                <Link key={word.id} to={`/word/${word.word || word.term}`}>
                                    <motion.div 
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        whileHover={{ y: -8 }}
                                        className="card p-10 group h-full flex flex-col space-y-8 bg-white"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl bg-brand-bg flex items-center justify-center font-serif italic text-2xl font-black group-hover:bg-brand-accent group-hover:text-white transition-all duration-500">
                                                    {(word.word || word.term || '?')[0]}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h3 className="text-3xl font-serif font-black italic tracking-tight lowercase group-hover:text-brand-accent transition-colors">{word.word || word.term}</h3>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted opacity-60">Milestone Detected</p>
                                                </div>
                                            </div>
                                            <div className={`p-2 rounded-lg ${word.status === 'reviewed' ? 'bg-green-50 text-green-600' : 'bg-brand-accent/5 text-brand-accent'}`} title={word.status === 'reviewed' ? "Mastered" : "Pending Practice"}>
                                               {word.status === 'reviewed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 space-y-6">
                                            <p className="text-sm font-serif italic text-brand-muted line-clamp-2 leading-relaxed">
                                                "{word.meaning || word.definition}"
                                            </p>
                                            
                                            {(word.lastSentenceText || (word.sentences && word.sentences.length > 0)) && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.2em] text-brand-muted/60">
                                                        <span>Most Recent Practice</span>
                                                        <span className="flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> {(word.sentencesCount !== undefined ? word.sentencesCount : word.sentences?.length) || 0} Total</span>
                                                    </div>
                                                    <p className="text-[11px] font-serif italic text-brand-primary line-clamp-2 bg-brand-bg/40 p-4 rounded-xl border border-brand-border/50">
                                                        "{word.lastSentenceText || word.sentences?.[word.sentences?.length - 1]?.text}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="pt-6 border-t border-brand-border flex items-center justify-between text-brand-muted group-hover:text-brand-primary transition-colors">
                                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                                                <Clock className="w-3 h-3" />
                                                {word.updatedAt?.toDate ? word.updatedAt.toDate().toLocaleDateString() : 'Active'}
                                            </div>
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-32 text-center card border-dashed opacity-50 flex flex-col items-center"
                        >
                            <BookOpen className="w-12 h-12 mb-4 text-brand-muted" />
                            <p className="text-lg font-serif italic text-brand-muted">The chronicles find no match for "{searchTerm}".</p>
                            <button onClick={() => {setSearchTerm(''); setFilter('all');}} className="text-brand-accent font-bold mt-4 hover:underline">Reset the records</button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};

export default Library;
