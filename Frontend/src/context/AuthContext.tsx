/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, metadata?: { full_name?: string; username?: string }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ensureProfile = async (user: User) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        const metadata = user.user_metadata || {};
        const username = metadata.username || user.email?.split('@')[0] || `user_${user.id.substring(0, 5)}`;
        const full_name = metadata.full_name || username;

        await supabase.from('profiles').insert({
          id: user.id,
          username,
          full_name,
          avatar_url: metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        });
      }

      // Ensure data in dedicated 'user' table as well
      const { data: existingUser } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingUser) {
        const metadata = user.user_metadata || {};
        await supabase.from('user').insert({
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
          avatar_url: metadata.avatar_url,
          provider: user.app_metadata.provider || 'google',
          raw_user_meta_data: metadata // This stores the complete Google JSON
        });
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) ensureProfile(currentUser);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) ensureProfile(currentUser);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: { full_name?: string; username?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};