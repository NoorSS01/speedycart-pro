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

    // Get initial session - ALWAYS try to refresh to ensure valid tokens
    // This is critical when app opens after being closed for hours
    const initializeSession = async () => {
      try {
        // First, check if we have stored tokens
        const { data: { session: storedSession } } = await supabase.auth.getSession();

        if (storedSession?.user) {
          // We have a stored session, but tokens might be expired
          // Proactively refresh to get new tokens
          logger.debug('Found stored session, refreshing tokens');

          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

          if (!refreshError && refreshData.session && isMounted) {
            // Refresh successful - we have valid fresh tokens
            setSession(refreshData.session);
            setUser(refreshData.session.user);
            await fetchUserRole(refreshData.session.user.id);
            logger.info('Session restored with fresh tokens');
            return;
          }

          // Refresh failed - check if it's an auth error vs network error
          if (refreshError) {
            const isAuthError = refreshError.message?.includes('invalid_grant') ||
              refreshError.message?.includes('Invalid Refresh Token') ||
              refreshError.message?.includes('refresh_token_not_found') ||
              refreshError.status === 401 ||
              refreshError.status === 400;

            if (!isAuthError) {
              // Network error - use stored session (tokens might still work)
              logger.debug('Network error during refresh, using stored session');
              if (isMounted) {
                setSession(storedSession);
                setUser(storedSession.user);
                await fetchUserRole(storedSession.user.id);
              }
              return;
            }

            // Auth error - refresh token is definitely invalid
            logger.warn('Refresh token invalid, user needs to re-login');
          }
        }

        // No stored session or refresh failed with auth error
        logger.debug('No valid session found');

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
        logger.debug('App became visible, checking session');

        // Implement retry logic with exponential backoff
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // First try to get the session - this returns cached tokens
            const { data: { session }, error } = await supabase.auth.getSession();

            if (!error && session?.user) {
              // Session is valid - update state if needed
              if (!userRef.current || userRef.current.id !== session.user.id) {
                setSession(session);
                setUser(session.user);
              }
              // Refresh role if we don't have it
              if (!userRoleRef.current) {
                await fetchUserRole(session.user.id);
              }
              logger.debug('Session valid on visibility change');
              return; // Success - exit retry loop
            }

            // If getSession failed or returned no session, try explicit refresh
            if (error || !session) {
              logger.debug('Session not found, attempting refresh', { attempt });
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

              if (!refreshError && refreshData.session) {
                // Refresh succeeded
                setSession(refreshData.session);
                setUser(refreshData.session.user);
                if (!userRoleRef.current) {
                  await fetchUserRole(refreshData.session.user.id);
                }
                logger.info('Session refreshed successfully', { attempt });
                return; // Success - exit retry loop
              }

              // Check if this is an authentication error (token truly expired)
              // vs a network/transient error that we should retry
              if (refreshError) {
                const isAuthError = refreshError.message?.includes('invalid_grant') ||
                  refreshError.message?.includes('Invalid Refresh Token') ||
                  refreshError.message?.includes('refresh_token_not_found') ||
                  refreshError.status === 401 ||
                  refreshError.status === 400;

                if (isAuthError) {
                  // Token is truly expired - user needs to re-login
                  logger.warn('Refresh token expired, user must re-login', { error: refreshError.message });
                  setUser(null);
                  setSession(null);
                  setUserRole(null);
                  return; // Don't retry - token is definitively invalid
                }

                // Network or transient error - will retry
                lastError = new Error(refreshError.message);
                logger.debug('Transient error, will retry', { attempt, error: refreshError.message });
              }
            }
          } catch (error) {
            lastError = error as Error;
            logger.debug('Exception during session check, will retry', { attempt, error });
          }

          // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
          }
        }

        // All retries failed - but DON'T clear session if we still have a user ref
        // This preserves the logged-in state through temporary network issues
        if (lastError) {
          logger.error('Session refresh failed after retries, keeping existing state', { error: lastError.message });
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

    // Refresh tokens periodically when app is open to keep session alive
    // This prevents token expiry during active use
    const refreshInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && userRef.current) {
        try {
          logger.debug('Periodic token refresh');
          // Use explicit refreshSession for guaranteed fresh tokens
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            logger.debug('Periodic refresh encountered error (will retry)', { error: error.message });
          } else if (data.session) {
            // Update session with fresh tokens
            setSession(data.session);
          }
        } catch (e) {
          // Silently handle errors - retry will happen on next interval
          logger.debug('Periodic refresh exception', { error: e });
        }
      }
    }, 4 * 60 * 1000); // 4 minutes (before 5-min access token expiry)

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
