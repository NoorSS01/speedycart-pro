/**
 * Health Check Dashboard Component
 * 
 * Displays real-time service health status for admin users.
 * Shows database, auth, and storage service status with latency metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { runHealthCheck, type HealthCheckResult, type ServiceStatus } from '@/lib/healthCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Shield, HardDrive, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

interface HealthCheckProps {
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const StatusBadge = ({ status }: { status: ServiceStatus }) => {
    const variants: Record<ServiceStatus, { className: string; icon: React.ReactNode; label: string }> = {
        healthy: {
            className: 'bg-green-500/10 text-green-600 border-green-500/20',
            icon: <CheckCircle className="h-3 w-3" />,
            label: 'Healthy',
        },
        degraded: {
            className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
            icon: <AlertTriangle className="h-3 w-3" />,
            label: 'Degraded',
        },
        unhealthy: {
            className: 'bg-red-500/10 text-red-600 border-red-500/20',
            icon: <XCircle className="h-3 w-3" />,
            label: 'Unhealthy',
        },
        unknown: {
            className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
            icon: <AlertTriangle className="h-3 w-3" />,
            label: 'Unknown',
        },
    };

    const variant = variants[status];

    return (
        <Badge variant="outline" className={`gap-1 ${variant.className}`}>
            {variant.icon}
            {variant.label}
        </Badge>
    );
};

const ServiceCard = ({
    name,
    icon,
    status,
    latencyMs,
    message,
}: {
    name: string;
    icon: React.ReactNode;
    status: ServiceStatus;
    latencyMs?: number;
    message?: string;
}) => {
    return (
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {icon}
                </div>
                <div>
                    <p className="font-medium">{name}</p>
                    {latencyMs !== undefined && (
                        <p className="text-xs text-muted-foreground">{latencyMs}ms latency</p>
                    )}
                    {message && (
                        <p className="text-xs text-red-500 mt-1">{message}</p>
                    )}
                </div>
            </div>
            <StatusBadge status={status} />
        </div>
    );
};

export function HealthCheck({ autoRefresh = false, refreshInterval = 30000 }: HealthCheckProps) {
    const [health, setHealth] = useState<HealthCheckResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkHealth = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await runHealthCheck();
            setHealth(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Health check failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkHealth();
    }, [checkHealth]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(checkHealth, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, checkHealth]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    System Health
                </CardTitle>
                <div className="flex items-center gap-2">
                    {health && <StatusBadge status={health.overall} />}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={checkHealth}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {!health && !error && loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {health && (
                    <>
                        <ServiceCard
                            name="Database"
                            icon={<Database className="h-5 w-5 text-blue-500" />}
                            status={health.services.database.status}
                            latencyMs={health.services.database.latencyMs}
                            message={health.services.database.message}
                        />
                        <ServiceCard
                            name="Authentication"
                            icon={<Shield className="h-5 w-5 text-green-500" />}
                            status={health.services.auth.status}
                            latencyMs={health.services.auth.latencyMs}
                            message={health.services.auth.message}
                        />
                        <ServiceCard
                            name="Storage"
                            icon={<HardDrive className="h-5 w-5 text-purple-500" />}
                            status={health.services.storage.status}
                            latencyMs={health.services.storage.latencyMs}
                            message={health.services.storage.message}
                        />

                        <div className="pt-2 text-xs text-muted-foreground text-right">
                            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                            {health.version && ` • v${health.version}`}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default HealthCheck;
