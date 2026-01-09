/**
 * Enterprise Theme System - Error Boundary
 * 
 * Catches errors in theme components and provides graceful fallback.
 * If the theme system fails, the app continues with default styling.
 * 
 * Features:
 * - Catches errors in theme rendering
 * - Falls back to default theme
 * - Logs errors for debugging
 * - Optional error display for development
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface ThemeErrorBoundaryProps {
    children: ReactNode;
    /** Fallback UI when theme error occurs */
    fallback?: ReactNode;
    /** Show error details in development */
    showErrorDetails?: boolean;
}

interface ThemeErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ThemeErrorBoundary extends Component<ThemeErrorBoundaryProps, ThemeErrorBoundaryState> {
    constructor(props: ThemeErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ThemeErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        // Log the error
        logger.error('Theme System Error', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // If a custom fallback is provided, use it
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Development mode: show error details
            if (this.props.showErrorDetails && process.env.NODE_ENV === 'development') {
                return (
                    <div className="p-4 m-4 rounded-lg border border-destructive bg-destructive/10">
                        <h3 className="text-lg font-bold text-destructive mb-2">
                            Theme Error
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            The theme system encountered an error. The app will continue with default styling.
                        </p>
                        <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                                Error Details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {this.state.error?.message}
                            </pre>
                        </details>
                        <button
                            onClick={this.handleReset}
                            className="mt-3 px-3 py-1 text-sm bg-primary text-primary-foreground rounded"
                        >
                            Try Again
                        </button>
                    </div>
                );
            }

            // Production mode: silently fall back to children without theme
            // The theme context will provide defaults
            return this.props.children;
        }

        return this.props.children;
    }
}

/**
 * HOC to wrap components with theme error boundary
 */
export function withThemeErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function ThemeProtectedComponent(props: P) {
        return (
            <ThemeErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ThemeErrorBoundary>
        );
    };
}

export default ThemeErrorBoundary;
