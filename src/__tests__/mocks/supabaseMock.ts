/**
 * Supabase client mock for unit testing
 * Provides mock implementations of Supabase auth and database operations
 */
import { vi } from 'vitest';

// Create mock user
export const mockUser = {
    id: 'test-user-id-123',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
};

// Create mock session
export const mockSession = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
};

// Create mock auth error
export const createMockAuthError = (message: string, status = 400) => ({
    message,
    status,
    name: 'AuthError',
});

// Mock subscription object
const mockSubscription = {
    unsubscribe: vi.fn(),
};

// Create the mock Supabase client
export const createMockSupabase = (overrides?: {
    signUpError?: Error | null;
    signInError?: Error | null;
    signOutError?: Error | null;
    rolesData?: { role: string }[];
    profileData?: { phone?: string; username?: string } | null;
}) => {
    const {
        signUpError = null,
        signInError = null,
        signOutError = null,
        rolesData = [{ role: 'user' }],
        profileData = { phone: '1234567890', username: 'testuser' },
    } = overrides || {};

    return {
        auth: {
            signUp: vi.fn().mockResolvedValue({
                data: signUpError ? null : { user: mockUser, session: mockSession },
                error: signUpError,
            }),
            signInWithPassword: vi.fn().mockResolvedValue({
                data: signInError ? null : { user: mockUser, session: mockSession },
                error: signInError,
            }),
            signOut: vi.fn().mockResolvedValue({
                error: signOutError,
            }),
            getSession: vi.fn().mockResolvedValue({
                data: { session: mockSession },
                error: null,
            }),
            onAuthStateChange: vi.fn().mockReturnValue({
                data: { subscription: mockSubscription },
            }),
        },
        from: vi.fn().mockImplementation((table: string) => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: table === 'profiles' ? profileData : null,
                error: null,
            }),
            // For user_roles, return array
            then: vi.fn().mockImplementation((callback) => {
                if (table === 'user_roles') {
                    return Promise.resolve(callback({ data: rolesData, error: null }));
                }
                return Promise.resolve(callback({ data: profileData, error: null }));
            }),
        })),
    };
};

// Default mock to be used with vi.mock
export const supabaseMock = createMockSupabase();
