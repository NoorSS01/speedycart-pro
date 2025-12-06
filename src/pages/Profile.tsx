import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, User, LogOut, Truck, Bell } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import NotificationSettings from '@/components/NotificationSettings';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  phone: string;
  full_name: string | null;
  address: string | null;
}

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    phone: '',
    full_name: '',
    address: ''
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProfile();
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile({
        phone: data.phone || '',
        full_name: data.full_name || '',
        address: data.address || ''
      });
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        phone: profile.phone,
        full_name: profile.full_name,
        address: profile.address
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully!');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-20">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Delivery Address</Label>
              <Textarea
                id="address"
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Enter your full delivery address"
                rows={3}
              />
            </div>
            <Button onClick={saveProfile} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Push Notifications Card */}
        <NotificationSettings />

        {/* Delivery Partner Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Become a Delivery Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Join our delivery team and earn money on your schedule. Flexible hours, competitive pay, and be your own boss.
            </p>
            <Button
              onClick={() => navigate('/delivery-application')}
              variant="outline"
              className="w-full"
            >
              Apply Now
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out Card */}
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={signOut}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
