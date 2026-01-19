/**
 * AuthContext Unit Tests
 * Tests authentication flows including sign-up, sign-in, sign-out, and role management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { createMockAuthError } from '../mocks/supabaseMock';

// Mock the supabase client
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        auth: {
            signUp: (...args: unknown[]) => mockSignUp(...args),
            signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
            signOut: () => mockSignOut(),
            getSession: () => mockGetSession(),
            onAuthStateChange: (callback: unknown) => mockOnAuthStateChange(callback),
        },
        from: (table: string) => mockFrom(table),
    },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Test wrapper with BrowserRouter
const wrapper = ({ children }: { children: ReactNode }) => (
    <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
);

describe('AuthContext', () => {
    const mockUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
    };

    const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockUser,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockGetSession.mockResolvedValue({
            data: { session: null },
            error: null,
        });

        mockOnAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe: vi.fn() } },
        });

        // Mock database queries
        mockFrom.mockImplementation((table: string) => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: table === 'profiles'
                    ? { phone: '1234567890', username: 'testuser' }
                    : null,
                error: null,
            }),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('useAuth hook', () => {
        it('should throw error when used outside AuthProvider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                const TestComponent = () => {
                    useAuth();
                    return null;
                };
                renderHook(() => useAuth());
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });

        it('should provide initial loading state', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            // Initially loading
            expect(result.current.loading).toBe(true);

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });

        it('should have null user when not authenticated', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.user).toBeNull();
            expect(result.current.session).toBeNull();
            expect(result.current.userRole).toBeNull();
        });
    });

    describe('signUp', () => {
        it('should call supabase signUp with correct parameters', async () => {
            mockSignUp.mockResolvedValue({
                data: { user: mockUser, session: mockSession },
                error: null,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.signUp(
                    'test@example.com',
                    'password123',
                    '1234567890'
                );
            });

            expect(mockSignUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                options: expect.objectContaining({
                    data: {
                        phone: '1234567890',
                    },
                }),
            });
        });

        it('should return error on failed sign-up', async () => {
            const authError = createMockAuthError('Email already registered', 400);
            mockSignUp.mockResolvedValue({
                data: null,
                error: authError,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let signUpResult: { error: unknown };
            await act(async () => {
                signUpResult = await result.current.signUp(
                    'existing@example.com',
                    'password123',
                    '1234567890'
                );
            });

            expect(signUpResult!.error).toEqual(authError);
        });
    });

    describe('signIn', () => {
        it('should call supabase signInWithPassword', async () => {
            mockSignInWithPassword.mockResolvedValue({
                data: { user: mockUser, session: mockSession },
                error: null,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.signIn('test@example.com', 'password123');
            });

            expect(mockSignInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
        });

        it('should return error for invalid credentials', async () => {
            const authError = createMockAuthError('Invalid login credentials', 401);
            mockSignInWithPassword.mockResolvedValue({
                data: null,
                error: authError,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let signInResult: { error: unknown };
            await act(async () => {
                signInResult = await result.current.signIn('wrong@example.com', 'wrongpassword');
            });

            expect(signInResult!.error).toEqual(authError);
        });

        it('should return null error on successful sign-in', async () => {
            mockSignInWithPassword.mockResolvedValue({
                data: { user: mockUser, session: mockSession },
                error: null,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let signInResult: { error: unknown };
            await act(async () => {
                signInResult = await result.current.signIn('test@example.com', 'password123');
            });

            expect(signInResult!.error).toBeNull();
        });
    });

    describe('signOut', () => {
        it('should call supabase signOut and clear user state', async () => {
            mockSignOut.mockResolvedValue({ error: null });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.signOut();
            });

            expect(mockSignOut).toHaveBeenCalled();
            // Note: signOut no longer navigates - navigation is handled by calling component
        });

        it('should clear userRole on sign out', async () => {
            mockSignOut.mockResolvedValue({ error: null });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.signOut();
            });

            expect(result.current.userRole).toBeNull();
        });
    });

    describe('session restoration', () => {
        it('should restore user from existing session', async () => {
            mockGetSession.mockResolvedValue({
                data: { session: mockSession },
                error: null,
            });

            // Mock user_roles query
            mockFrom.mockImplementation((table: string) => ({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: table === 'user_roles' ? [{ role: 'admin' }] : null,
                        error: null,
                    }),
                }),
            }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.session).toEqual(mockSession);
        });
    });
});
