import React from 'react';
import { motion } from 'motion/react';
import { LogIn, Sparkles, BookOpen, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const Landing: React.FC = () => {
    const { user, signIn, loading } = useAuth();

    if (user) return <Navigate to="/" />;

    return (
        <div className="min-h-screen bg-brand-bg text-brand-primary flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
            <main className="max-w-4xl w-full space-y-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-8"
                >
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-brand-accent/10 rounded-full border border-brand-accent/20">
                        <Sparkles className="w-3 h-3 text-brand-accent" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">A more articulate tomorrow awaits</span>
                    </div>
                    
                    <h1 className="text-8xl md:text-[180px] font-serif font-black tracking-tighter leading-[0.8] italic block">
                        Wordly<span className="text-brand-accent">.</span>
                    </h1>
                    
                    <p className="text-xl md:text-2xl text-brand-muted max-w-2xl mx-auto font-serif italic leading-relaxed">
                        A refined digital companion for expanding your linguistic repertoire and mastering the nuance of language.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: BookOpen, title: "Curated Growth", desc: "Hand-selected vocabulary that shifts with your proficiency level." },
                        { icon: Sparkles, title: "Linguistic Nuance", desc: "Distinguish between the subtle shades of meaning in every word." },
                        { icon: Zap, title: "Daily Ritual", desc: "A soft, daily practice designed for effortless long-term mastery." }
                    ].map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            className="card p-10 text-left group"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-brand-bg flex items-center justify-center text-brand-accent mb-6 group-hover:bg-brand-accent group-hover:text-white transition-all duration-500">
                                <feature.icon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-serif font-bold italic mb-3">{feature.title}</h3>
                            <p className="text-brand-muted text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="pt-12"
                >
                    <button
                        onClick={signIn}
                        disabled={loading}
                        className="group relative inline-flex items-center gap-6 btn-primary"
                    >
                        <span>Start your journey</span>
                        <LogIn className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                        {loading && (
                            <div className="absolute -right-12 w-6 h-6 border-2 border-brand-accent/20 border-t-brand-accent rounded-full animate-spin" />
                        )}
                    </button>
                    <div className="mt-8 text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] opacity-40">
                      Sign in with Google to begin
                    </div>
                </motion.div>
            </main>

            <footer className="absolute bottom-8 text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em] opacity-30">
                Wordly Editorial Companion // 2026
            </footer>
        </div>
    );
};

export default Landing;
