import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Package, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PhoneSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
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
        .select('phone')
        .eq('id', user.id)
        .single();

      // Check if phone already exists and is valid (10+ digits)
      if (!error && data?.phone) {
        const digitsOnly = data.phone.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
          navigate('/shop');
          return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validatePhone(phone)) {
      return;
    }

    const normalizedPhone = `+91${phone}`;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone: normalizedPhone })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to save phone number');
    } else {
      toast.success('Phone number saved successfully!');
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
            Please add your phone number to complete your account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={saving || phone.length !== 10}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to Shop
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
