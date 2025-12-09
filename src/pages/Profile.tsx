import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  User,
  LogOut,
  Truck,
  Bell,
  MapPin,
  Shield,
  Mail,
  Phone,
  ChevronRight,
  Trash2,
  Plus,
  Check,
  Ticket,
  Heart,
  Languages,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import NotificationSettings from '@/components/NotificationSettings';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  phone: string;
  full_name: string | null;
  address: string | null;
  avatar_url?: string | null;
}

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  is_default: boolean;
}

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    phone: '',
    full_name: '',
    address: '',
    avatar_url: null
  });

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressText, setNewAddressText] = useState('');

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
      const profileData = data as any;
      setProfile({
        phone: profileData.phone || '',
        full_name: profileData.full_name || '',
        address: profileData.address || '',
        avatar_url: profileData.avatar_url || null
      });
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!user) return;

    // Validate phone (if provided)
    if (profile.phone && profile.phone.length > 0) {
      const digitsOnly = profile.phone.replace(/\D/g, '');
      if (digitsOnly.length !== 10 && !profile.phone.startsWith('+91')) {
        toast.error('Please enter a valid 10-digit phone number');
        return;
      }
    }

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    toast.error('Account deletion is not available in this version');
    setShowDeleteDialog(false);
    setDeleteConfirmText('');
  };

  const getInitials = (name: string | null) => {
    if (!name) return user?.email?.[0]?.toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <div className="flex flex-col items-center gap-4 py-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Profile</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-2xl font-bold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{profile.full_name || 'User'}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Contact Information */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <div className="flex">
                <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  value={profile.phone.replace('+91', '')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setProfile({ ...profile, phone: `+91${digits}` });
                  }}
                  className="rounded-l-none"
                  placeholder="9876543210"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>
            <Button onClick={saveProfile} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Default Address */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Textarea
              value={profile.address || ''}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="Enter your delivery address"
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This address will be used as default for your orders
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <NotificationSettings />

        {/* Quick Links */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-2">
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <button
              onClick={() => navigate('/orders')}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                </div>
                <span className="font-medium">My Orders</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-green-500" />
                </div>
                <span className="font-medium">Coupons & Offers</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Become a Delivery Partner */}
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Become a Delivery Partner</h3>
                <p className="text-sm text-muted-foreground">Earn money on your schedule</p>
              </div>
              <Button variant="default" size="sm" onClick={() => navigate('/delivery-application')}>
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={signOut}
            variant="outline"
            className="w-full h-12 text-base"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Sign Out
          </Button>

          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-bold text-destructive">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
