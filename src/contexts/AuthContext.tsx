import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  signUp: (email: string, password: string, phone: string, fullName?: string, username?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Profile check for OAuth users - runs after initial auth load
  const checkProfileSetup = useCallback(async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, username')
        .eq('id', userId)
        .single();

      const profileData = profile as { phone?: string; username?: string } | null;
      const hasValidPhone = profileData?.phone && profileData.phone.replace(/\D/g, '').length >= 10;
      const hasUsername = profileData?.username && profileData.username.length >= 3;

      if ((!hasValidPhone || !hasUsername) && window.location.pathname !== '/phone-setup' && window.location.pathname !== '/auth') {
        navigate('/phone-setup');
      }
    } catch (e) {
      // Profile check failed - log but don't block app loading
      logger.debug('Profile setup check failed', { error: e });
    }
  }, [navigate]);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        const roles = data.map((r: { role: string }) => r.role);
        const rolePriority = ['super_admin', 'admin', 'delivery', 'user'];
        const primaryRole = rolePriority.find((role) => roles.includes(role)) ?? roles[0];
        setUserRole(primaryRole);
      }
    } catch (error) {
      logger.error('Error fetching user role', { error });
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);

          // Check phone setup only on fresh sign-in (OAuth)
          if (event === 'SIGNED_IN') {
            setTimeout(() => {
              checkProfileSetup(session.user.id);
            }, 100);
          }
        } else {
          setUserRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
        // Check profile setup on every session restore (catches OAuth users who closed browser mid-setup)
        checkProfileSetup(session.user.id);
      }
      setLoading(false);
    });

    // Re-check session when app becomes visible (fixes PWA auto-logout)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.debug('App visibility restored, checking session...');
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            fetchUserRole(session.user.id);
          }
        });
      }
    };

    // Also refresh on focus (for browser tabs)
    const handleFocus = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setSession(session);
          setUser(session.user);
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkProfileSetup, fetchUserRole]);

  const signUp = async (email: string, password: string, phone: string, fullName?: string, username?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          phone,
          full_name: fullName,
          username: username?.toLowerCase()
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
