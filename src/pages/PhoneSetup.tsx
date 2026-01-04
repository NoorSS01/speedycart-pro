import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Phone, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function PhoneSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone, username')
        .eq('id', user.id)
        .single();

      // Check if phone and username already exist and are valid
      if (!error && data) {
        const hasValidPhone = data.phone && data.phone.replace(/\D/g, '').length >= 10;
        const hasUsername = data.username && data.username.length >= 3;

        if (hasValidPhone && hasUsername) {
          navigate('/shop');
          return;
        }

        // Pre-fill existing data
        if (data.phone) {
          const digitsOnly = data.phone.replace(/\D/g, '');
          setPhone(digitsOnly.slice(-10));
        }
        if (data.username) {
          setUsername(data.username);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, authLoading, navigate]);

  const validatePhone = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setPhoneError(`Please enter exactly 10 digits (${10 - digitsOnly.length} more needed)`);
      return false;
    }
    setPhoneError('');
    return true;
  };

  const validateUsername = (value: string): boolean => {
    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    if (value.length > 20) {
      setUsernameError('Username cannot exceed 20 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError('Only letters, numbers, and underscores allowed');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(input);

    if (input.length === 10) {
      setPhoneError('');
    } else if (input.length > 0) {
      const remaining = 10 - input.length;
      setPhoneError(`${remaining} more digit${remaining !== 1 ? 's' : ''} needed`);
    } else {
      setPhoneError('');
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(value);

    if (value.length > 0 && value.length < 3) {
      setUsernameError(`${3 - value.length} more characters needed`);
    } else {
      setUsernameError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validatePhone(phone) || !validateUsername(username)) {
      return;
    }

    // Validate ToS acceptance
    if (!tosAccepted) {
      toast.error('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setSaving(true);

    // Check if username is already taken
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .neq('id', user.id)
      .maybeSingle();

    if (existingUsername) {
      toast.error('This username is already taken');
      setSaving(false);
      return;
    }

    const normalizedPhone = `+91${phone}`;

    const { error } = await supabase
      .from('profiles')
      .update({
        phone: normalizedPhone,
        username: username.toLowerCase(),
        tos_accepted_at: new Date().toISOString()
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to save your details');
    } else {
      toast.success('Account setup complete!');
      navigate('/shop');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-2xl mx-auto mb-2" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-2xl">
              <Package className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Almost there!</CardTitle>
          <CardDescription>
            Complete your profile to start shopping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Username *
              </Label>
              <div className="flex">
                <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground">
                  @
                </div>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe_123"
                  value={username}
                  onChange={handleUsernameChange}
                  className={`rounded-l-none ${usernameError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  maxLength={20}
                  required
                />
              </div>
              {usernameError && (
                <p className="text-sm text-destructive">{usernameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Letters, numbers, and underscores only (3-20 chars)
              </p>
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Mobile Number *
              </Label>
              <div className="flex">
                <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="9876543210"
                  value={phone}
                  onChange={handlePhoneChange}
                  className={`rounded-l-none ${phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  maxLength={10}
                  required
                />
              </div>
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                We'll use this number for order updates and delivery coordination
              </p>
            </div>

            {/* ToS Acceptance */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="tos-accept"
                checked={tosAccepted}
                onCheckedChange={(checked) => setTosAccepted(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="tos-accept" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline" target="_blank">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={saving || phone.length !== 10 || username.length < 3}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to Shop
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
