/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useMemo } from 'react';
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
      const metadata = user.user_metadata || {};
      const resolvedAvatarUrl =
        metadata.avatar_url ||
        metadata.picture ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;
      const username = metadata.username || user.email?.split('@')[0] || `user_${user.id.substring(0, 5)}`;
      const full_name = metadata.full_name || metadata.name || username;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, avatar_url, username, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          username,
          full_name,
          avatar_url: resolvedAvatarUrl,
        });
      } else if (!profile.avatar_url || !profile.full_name || !profile.username) {
        await supabase.from('profiles').update({
          avatar_url: profile.avatar_url || resolvedAvatarUrl,
          full_name: profile.full_name || full_name,
          username: profile.username || username
        }).eq('id', user.id);
      }

      // Ensure data in dedicated 'user' table as well
      const { data: existingUser } = await supabase
        .from('user')
        .select('id, avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('user').insert({
          id: user.id,
          email: user.email,
          full_name,
          avatar_url: resolvedAvatarUrl,
          provider: user.app_metadata.provider || 'google',
          raw_user_meta_data: metadata // This stores the complete Google JSON
        });
      } else if (!existingUser.avatar_url || !existingUser.full_name) {
        await supabase.from('user').update({
          avatar_url: existingUser.avatar_url || resolvedAvatarUrl,
          full_name: existingUser.full_name || full_name,
          raw_user_meta_data: metadata
        }).eq('id', user.id);
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

  const value = useMemo(() => ({
    user,
    session,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    loading
  }), [user, session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
