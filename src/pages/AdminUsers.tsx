import { useState, useEffect } from 'react';
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
    }, [user, userRole, authLoading, navigate]);

    const fetchUserRoles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Failed to load user roles');
        } else {
            setUserRoles(data || []);
        }
        setLoading(false);
    };

    const handleAddRole = async () => {
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
        total: userRoles.length,
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
                            <p className="text-xs text-muted-foreground">{stats.total} users with roles</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats.admins}</p>
                            <p className="text-xs text-muted-foreground">Admins</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{stats.delivery}</p>
                            <p className="text-xs text-muted-foreground">Delivery</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-50 dark:bg-gray-900/20 border-gray-100">
                        <CardContent className="p-3 text-center">
                            <p className="text-2xl font-bold text-gray-600">{stats.users}</p>
                            <p className="text-xs text-muted-foreground">Users</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Add Role */}
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

                {/* User Roles List */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">All Roles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loading ? (
                            [1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)
                        ) : userRoles.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">No roles assigned</p>
                        ) : (
                            userRoles.map((role) => (
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
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDeleteRole(role.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </main>

            <AdminBottomNav />
        </div>
    );
}
