import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  streak: number;
  xp: number;
  level: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastActiveAt: any;
  aiUsageToday?: number;
  aiUsageDate?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDifficulty: (level: 'beginner' | 'intermediate' | 'advanced') => Promise<void>;
  incrementAiUsage: () => Promise<void>;
  syncAiUsageToMax: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Create new profile
        const newProfile: UserProfile = {
          uid,
          displayName: auth.currentUser?.displayName || 'Adventurer',
          photoURL: auth.currentUser?.photoURL || '',
          streak: 0,
          xp: 0,
          level: 1,
          difficulty: 'intermediate',
          lastActiveAt: serverTimestamp(),
          aiUsageToday: 0,
          aiUsageDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return; // Silent return for user cancellation
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const updateDifficulty = async (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, { difficulty }, { merge: true });
      if (profile) setProfile({ ...profile, difficulty });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const incrementAiUsage = async () => {
    if (!user || !profile) return;
    const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    
    let newUsage = 1;
    if (profile.aiUsageDate === localDate) {
        newUsage = (profile.aiUsageToday || 0) + 1;
    }
    
    try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { aiUsageToday: newUsage, aiUsageDate: localDate }, { merge: true });
        setProfile({ ...profile, aiUsageToday: newUsage, aiUsageDate: localDate });
    } catch (error) {
        console.error("Failed to update AI usage", error);
    }
  };

  const syncAiUsageToMax = async () => {
    if (!user || !profile) return;
    const localDate = new Date().toLocaleDateString('en-CA');
    
    try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { aiUsageToday: 20, aiUsageDate: localDate }, { merge: true });
        setProfile({ ...profile, aiUsageToday: 20, aiUsageDate: localDate });
    } catch (error) {
        console.error("Failed to sync AI usage to max", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, refreshProfile, updateDifficulty, incrementAiUsage, syncAiUsageToMax }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
