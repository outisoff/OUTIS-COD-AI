import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isApproved: boolean;
  isApprovalLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APPROVAL_QUERY_KEY = (userId: string) => ['profile-approval', userId] as const;
const APPROVAL_LS_KEY = (userId: string) => `approval:${userId}`;

function readCachedApproval(userId: string): boolean | undefined {
  try {
    const v = localStorage.getItem(APPROVAL_LS_KEY(userId));
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  } catch {
    return undefined;
  }
}

function readOptimisticApproved(userId: string): true | undefined {
  return readCachedApproval(userId) === true ? true : undefined;
}

function writeCachedApproval(userId: string, value: boolean) {
  try {
    localStorage.setItem(APPROVAL_LS_KEY(userId), String(value));
  } catch {
    /* ignore */
  }
}

// Fetches approval status; creates the profile row on first sight if missing.
async function fetchApprovalStatus(u: User): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('id', u.id)
    .maybeSingle();

  if (error) {
    console.error('Error checking approval status:', error);
    return false;
  }

  if (!data) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: u.id,
      email: u.email,
      full_name:
        (u.user_metadata as { full_name?: string } | null)?.full_name ?? u.email,
      is_approved: false,
    });
    if (insertError) {
      console.error('Error creating profile row:', insertError);
    }
    return false;
  }

  const approved = data.is_approved ?? false;
  writeCachedApproval(u.id, approved);
  return approved;
}

function isSessionLike(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;

  const session = value as Partial<Session> & { user?: Partial<User> | null };

  return typeof session.access_token === 'string' && typeof session.refresh_token === 'string';
}

// Restore a persisted Supabase session synchronously from localStorage so the
// initial render isn't blocked by the async getSession() round-trip.
function readPersistedSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const v = localStorage.getItem(k);
        if (!v || v.length <= 10) continue;

        const parsed = JSON.parse(v);
        const candidates = [parsed, parsed?.currentSession, parsed?.session];

        for (const candidate of candidates) {
          if (isSessionLike(candidate)) {
            return candidate;
          }
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSessionRef = useRef<Session | null>(readPersistedSession());
  const [user, setUser] = useState<User | null>(initialSessionRef.current?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSessionRef.current);
  // Start non-loading when we already have a persisted session — avoids the
  // full-screen spinner flash on every page refresh.
  const [isLoading, setIsLoading] = useState(() => !initialSessionRef.current);
  const queryClient = useQueryClient();

  // Cached approval check — avoids hitting /profiles on every navigation.
  // Realtime subscription (see effect below) flips approval to true instantly
  // when an admin approves the user; no polling required.
  const { data: isApproved = false, isLoading: isApprovalLoading } = useQuery({
    queryKey: user ? APPROVAL_QUERY_KEY(user.id) : ['profile-approval', 'anon'],
    queryFn: () => fetchApprovalStatus(user!),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    // Trust cached approved=true for instant refreshes, but never trust cached false.
    initialData: user ? readOptimisticApproved(user.id) : undefined,
    initialDataUpdatedAt: user && readOptimisticApproved(user.id) ? Date.now() : 0,
  });

  // Listen for profile approval changes in realtime instead of polling every 5s.
  useEffect(() => {
    if (!user || isApproved) return;
    const channel = supabase
      .channel(`profile-approval-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as { is_approved?: boolean } | null)?.is_approved ?? false;
          writeCachedApproval(user.id, next);
          queryClient.setQueryData(APPROVAL_QUERY_KEY(user.id), next);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isApproved, queryClient]);

  useEffect(() => {
    // Track whether onAuthStateChange has already settled; if so, ignore the
    // late-arriving getSession() result to prevent it from overwriting a fresher
    // SIGNED_OUT / TOKEN_REFRESHED event.
    let settled = false;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      settled = true;
      setSession(session);
      setUser(session?.user ?? null);

      // Clear cached approval on logout
      if (event === 'SIGNED_OUT') {
        queryClient.removeQueries({ queryKey: ['profile-approval'] });
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('approval:'))
            .forEach((k) => localStorage.removeItem(k));
        } catch { /* ignore */ }
      }

      setIsLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return; // an auth event already updated state
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Prime the cache immediately after login so the gate doesn't flicker.
    if (data.user) {
      const approved = await fetchApprovalStatus(data.user);
      queryClient.setQueryData(APPROVAL_QUERY_KEY(data.user.id), approved);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: name,
        },
      },
    });

    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    queryClient.removeQueries({ queryKey: ['profile-approval'] });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isApproved,
      isApprovalLoading: !!user && isApprovalLoading,
      login,
      signup,
      logout,
      isAuthenticated: !!session
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export { useAuth } from './useAuth';
