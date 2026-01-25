/**
 * AuthContext - Supabase Email/Password Authentication
 * Handles user authentication state, session management, and role fetching
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, phone: string) => Promise<{ error: AuthError | null; user: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role from database
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
      } else {
        setUserRole('user');
      }
    } catch (error) {
      logger.error('Error fetching user role', { error });
      setUserRole('user');
    }
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  // Sign up with email and password
  const signUp = async (
    email: string,
    password: string,
    phone: string
  ): Promise<{ error: AuthError | null; user: User | null }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone,
          },
        },
      });

      if (error) {
        logger.error('SignUp error', { error: error.message });
        return { error, user: null };
      }

      // Check if this is a "fake" signup (email already exists but Supabase doesn't return error)
      // Supabase returns a user with empty identities array if email exists
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        logger.warn('Fake signup detected - email already exists', { email });
        return {
          error: {
            message: 'This email is already registered. Please sign in instead.',
            name: 'AuthApiError',
            status: 400
          } as AuthError,
          user: null
        };
      }

      // If signup successful, create profile
      if (data.user) {
        logger.info('User created successfully', { userId: data.user.id });

        try {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            phone: phone,
          });

          if (profileError) {
            logger.error('Error creating profile', { error: profileError.message });
          } else {
            logger.info('Profile created successfully', { userId: data.user.id });
          }
        } catch (profileError) {
          logger.error('Exception creating profile', { error: profileError });
        }
      }

      return { error: null, user: data.user };
    } catch (e) {
      logger.error('SignUp exception', { error: e });
      return {
        error: { message: 'Failed to create account', name: 'AuthError', status: 500 } as AuthError,
        user: null
      };
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  // Initialize auth state
  // Use refs to access current values in callbacks without triggering re-renders
  const userRef = useRef(user);
  const userRoleRef = useRef(userRole);

  // Keep refs in sync with state
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          logger.error('Error getting session', { error });
          // If there's an error getting session, try to refresh
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session && isMounted) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            await fetchUserRole(refreshData.session.user.id);
            return;
          }
        }

        if (session?.user && isMounted) {
          setSession(session);
          setUser(session.user);
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        logger.error('Error initializing session', { error });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Handle visibility change - refresh session when app comes back to foreground
    // This is CRITICAL for PWA session persistence
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted) {
        logger.debug('App became visible, refreshing session');
        try {
          // getSession() automatically refreshes expired tokens
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            logger.error('Session refresh failed on visibility change', { error });
            // Try explicit refresh as fallback
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              logger.error('Explicit refresh also failed', { error: refreshError });
              // Session is truly invalid, clear state
              setUser(null);
              setSession(null);
              setUserRole(null);
              return;
            }
            if (refreshData.session) {
              setSession(refreshData.session);
              setUser(refreshData.session.user);
            }
            return;
          }

          if (session?.user) {
            setSession(session);
            setUser(session.user);
            // Only fetch role if we don't have it - use ref to avoid infinite loop
            if (!userRoleRef.current) {
              await fetchUserRole(session.user.id);
            }
          } else if (userRef.current) {
            // Had a user but now session is null - user was logged out
            logger.info('Session expired, user logged out');
            setUser(null);
            setSession(null);
            setUserRole(null);
          }
        } catch (error) {
          logger.error('Error refreshing session on visibility change', { error });
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        logger.debug('Auth state changed', { event, hasSession: !!session });

        // Handle token refresh event explicitly
        if (event === 'TOKEN_REFRESHED') {
          logger.info('Token refreshed successfully');
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer role fetch to avoid race conditions
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
        }

        if (event === 'SIGNED_OUT') {
          setUserRole(null);
        }
      }
    );

    // Add visibility change listener for PWA session persistence
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refresh periodically when app is open (every 5 minutes)
    // This prevents session from expiring while user is actively using the app
    const refreshInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && userRef.current) {
        logger.debug('Periodic session refresh');
        await supabase.auth.getSession();
      }
    }, 5 * 60 * 1000); // 5 minutes

    initializeSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  }, [fetchUserRole]); // Only depend on fetchUserRole - use refs for user/userRole

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      loading,
      signIn,
      signUp,
      signOut
    }}>
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
