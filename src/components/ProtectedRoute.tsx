import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRoles: string[];
}

/**
 * Route guard component that prevents unauthorized access to protected pages.
 * 
 * Security guarantees:
 * - Shows loading spinner while auth state is being determined
 * - Redirects to /auth if user is not authenticated
 * - Redirects to / if user doesn't have required role
 * - Never renders children until auth is confirmed
 */
export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
    const { user, userRole, loading } = useAuth();

    // Show loading state while auth is being determined
    // This prevents any flash of protected content
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Not authenticated - redirect to login
    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    // Check if user has required role
    // If no role is set yet, deny access (safety first)
    if (!userRole || !requiredRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    // User is authenticated and has required role - render children
    return <>{children}</>;
}
