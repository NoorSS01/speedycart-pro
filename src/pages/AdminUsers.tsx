import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Users, UserPlus, Trash2, Shield, Truck, User } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface UserRole {
    id: string;
    user_id: string;
    role: 'user' | 'admin' | 'delivery' | 'super_admin';
    created_at: string;
}

export default function AdminUsers() {
    const { user, userRole, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [userRoles, setUserRoles] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUserId, setNewUserId] = useState('');
    const [newRole, setNewRole] = useState<'user' | 'admin' | 'delivery'>('user');
    const [adding, setAdding] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 50;

    const fetchUserRoles = useCallback(async () => {
        setLoading(true);
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error, count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            toast.error('Failed to load user roles');
        } else {
            const typedData: UserRole[] = (data || []).map(item => ({
                id: item.id,
                user_id: item.user_id,
                role: item.role as UserRole['role'],
                created_at: item.created_at || new Date().toISOString()
            }));
            setUserRoles(typedData);
            if (count !== null) {
                setHasMore(to < count - 1);
            }
        }
        setLoading(false);
    }, [page]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            navigate('/shop');
            return;
        }
        fetchUserRoles();
    }, [user, userRole, authLoading, navigate, fetchUserRoles]);

    const handleAddRole = async () => {
        if (userRole !== 'super_admin') {
            toast.error('Only Super Admins can add roles');
            return;
        }

        if (!newUserId.trim()) {
            toast.error('Please enter a user ID');
            return;
        }

        setAdding(true);
        const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: newUserId.trim(), role: newRole });

        if (error) {
            if (error.code === '23505') {
                toast.error('User already has this role');
            } else {
                toast.error('Failed to add role: ' + error.message);
            }
        } else {
            toast.success('Role added successfully');
            setNewUserId('');
            fetchUserRoles();
        }
        setAdding(false);
    };

    const handleDeleteRole = async (roleId: string) => {
        if (userRole !== 'super_admin') {
            toast.error('Only Super Admins can remove roles');
            return;
        }

        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('id', roleId);

        if (error) {
            toast.error('Failed to delete role');
        } else {
            toast.success('Role removed');
            fetchUserRoles();
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin':
            case 'super_admin':
                return <Shield className="w-4 h-4" />;
            case 'delivery':
                return <Truck className="w-4 h-4" />;
            default:
                return <User className="w-4 h-4" />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-purple-500';
            case 'admin':
                return 'bg-blue-500';
            case 'delivery':
                return 'bg-emerald-500';
            default:
                return 'bg-gray-500';
        }
    };

    const stats = {
        total: userRoles.length, // Note: active page only, ideally fetch total count separately if needed roughly
        admins: userRoles.filter(r => r.role === 'admin' || r.role === 'super_admin').length,
        delivery: userRoles.filter(r => r.role === 'delivery').length,
        users: userRoles.filter(r => r.role === 'user').length,
    };

    if (authLoading || userRole === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-8 w-48" />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </main>
                <AdminBottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
                            <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">User Management</h1>
                            <p className="text-xs text-muted-foreground">{userRole === 'super_admin' ? 'Super Admin Mode' : 'Read-Only Mode'}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-6">
                {/* Add Role - Super Admin Only */}
                {userRole === 'super_admin' && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                Add Role
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                placeholder="User ID (UUID)"
                                value={newUserId}
                                onChange={(e) => setNewUserId(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleAddRole} disabled={adding}>
                                    Add
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* User Roles List */}
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">User List</CardTitle>
                        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loading ? (
                            [1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)
                        ) : userRoles.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No roles found</p>
                        ) : (
                            <>
                                {userRoles.map((role) => (
                                    <div
                                        key={role.id}
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${getRoleColor(role.role)} bg-opacity-20`}>
                                                {getRoleIcon(role.role)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-mono">{role.user_id.slice(0, 8)}...</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(role.created_at), 'MMM dd, yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={getRoleColor(role.role)}>
                                                {role.role}
                                            </Badge>
                                            {userRole === 'super_admin' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDeleteRole(role.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-between items-center pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0 || loading}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={!hasMore || loading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            <AdminBottomNav />
        </div>
    );
}
