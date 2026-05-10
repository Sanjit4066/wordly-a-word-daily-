import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Sparkles, TrendingUp, ArrowRight, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Practice: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { profile } = useAuth();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/word/${searchTerm.trim().toLowerCase()}`);
        }
    };

    const suggestions = [
        { word: 'ephemeral', mood: 'poetic' },
        { word: 'resilient', mood: 'strong' },
        { word: 'eloquent', mood: 'elegant' },
        { word: 'altruistic', mood: 'noble' },
        { word: 'tenacious', mood: 'persistent' },
        { word: 'luminous', mood: 'bright' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-20 pt-12">
            <header className="space-y-6 text-center">
                <div className="flex items-center justify-center gap-3">
                    <Sparkles className="w-5 h-5 text-brand-accent" />
                    <h4 className="technical-label">Universal Practice Section</h4>
                </div>
                <h1 className="text-6xl md:text-8xl font-serif font-black italic tracking-tighter leading-tight">
                    Search. Practice. <br/>
                    <span className="text-brand-accent">Master any word.</span>
                </h1>
                <p className="text-xl font-serif italic text-brand-muted max-w-2xl mx-auto leading-relaxed">
                    Type a word to begin an AI-guided practice session. Build your permanent lexicon one context at a time.
                </p>
            </header>

            <section className="relative max-w-2xl mx-auto">
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
                        <Search className="w-6 h-6 text-brand-muted group-focus-within:text-brand-accent transition-colors" />
                    </div>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Enter a word to explore..."
                        className="w-full h-24 pl-20 pr-32 bg-white border-2 border-brand-border rounded-[2.5rem] text-3xl font-serif italic focus:outline-none focus:border-brand-accent focus:ring-4 ring-brand-accent/5 transition-all shadow-xl shadow-brand-primary/5"
                    />
                    <button 
                        type="submit"
                        disabled={!searchTerm.trim()}
                        className="absolute right-4 top-4 bottom-4 px-8 bg-brand-primary text-white rounded-[1.8rem] flex items-center gap-2 hover:bg-brand-accent transition-all disabled:opacity-30 active:scale-95"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <h5 className="technical-label flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-brand-accent" />
                        Trending Concepts
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                        {suggestions.map((s, i) => (
                            <button 
                                key={s.word}
                                onClick={() => navigate(`/word/${s.word}`)}
                                className="group p-6 bg-white border border-brand-border rounded-3xl hover:border-brand-accent transition-all text-left"
                            >
                                <p className="text-[9px] font-black uppercase tracking-widest text-brand-muted group-hover:text-brand-accent transition-colors">{s.mood}</p>
                                <p className="text-2xl font-serif font-bold italic text-brand-primary lowercase mt-2">{s.word}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    <h5 className="technical-label flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-brand-accent" />
                        Your Recent Focus
                    </h5>
                    {/* This would ideally list recent searches/viewed words */}
                    <div className="p-8 bg-brand-bg rounded-[2.5rem] border border-brand-border flex flex-col items-center justify-center text-center space-y-4">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                             <TrendingUp className="w-5 h-5 text-brand-accent" />
                         </div>
                         <p className="text-sm font-serif italic text-brand-muted max-w-[200px]">
                            "The more you practice, the more fluent your thoughts become."
                         </p>
                         <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">— Mentor Tip</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Practice;
