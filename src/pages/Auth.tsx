/**
 * Auth Page - Modern Progressive Authentication with Phone OTP
 * 
 * Sign In Flow:
 * 1. Google OAuth OR Email input
 * 2. Password input → Sign In
 * 
 * Sign Up Flow:
 * 1. Google OAuth OR Email input
 * 2. Password input
 * 3. Phone input → Send OTP
 * 4. OTP verification → Create Account
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Phone, Shield, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendOtp, verifyOtp, createUser } from '@/lib/otpService';
import { logger } from '@/lib/logger';

type AuthMode = 'signin' | 'signup';
type AuthStep = 'email' | 'password' | 'phone' | 'otp';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: ''
  });
  const [phoneError, setPhoneError] = useState('');

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Validate phone number (exactly 10 digits)
  const validatePhone = (phone: string): boolean => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setPhoneError('Please enter exactly 10 digits');
      return false;
    }
    setPhoneError('');
    return true;
  };

  // Handle phone input - digits only
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, phone: digitsOnly });
    if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
      setPhoneError(`${10 - digitsOnly.length} more digits needed`);
    } else {
      setPhoneError('');
    }
  };

  // Handle OTP input - digits only
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setOtpError('');
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle email continue
  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Please enter your email');
      return;
    }
    if (!isValidEmail(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setStep('password');
  };

  // Handle sign in
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email first');
        } else {
          toast.error('Something went wrong');
        }
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (e) {
      logger.error('Sign in error', { error: e });
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password continue for signup
  const handlePasswordContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password) {
      toast.error('Please enter a password');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setStep('phone');
  };

  // Send OTP to phone
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validatePhone(formData.phone)) {
      return;
    }

    if (!tosAccepted) {
      toast.error('Please accept the Terms of Service');
      return;
    }

    setIsLoading(true);
    setOtpError('');

    try {
      const result = await sendOtp(`+91${formData.phone}`);

      if (result.success && result.sessionId) {
        setOtpSessionId(result.sessionId);
        setStep('otp');
        setResendTimer(30); // 30 second cooldown
        toast.success('OTP sent to your phone!');
      } else {
        toast.error(result.message || 'Failed to send OTP');
      }
    } catch (e) {
      logger.error('Send OTP error', { error: e });
      toast.error('Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    await handleSendOtp();
  };

  // Verify OTP and create account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length < 4) {
      setOtpError('Please enter the OTP');
      return;
    }

    setIsLoading(true);
    setOtpError('');

    try {
      const result = await verifyOtp(otpSessionId, otp);

      if (result.success && result.verified) {
        // Create account via Edge Function (auto-confirms email since phone is verified)
        const normalizedPhone = `+91${formData.phone}`;
        const createResult = await createUser(formData.email, formData.password, normalizedPhone);

        if (createResult.success && createResult.userId) {
          logger.info('Account created successfully', { userId: createResult.userId });

          // Auto sign-in after account creation
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (signInError) {
            logger.error('Auto sign-in failed', { error: signInError.message });
            toast.success('Account created! Please sign in.');
            setMode('signin');
            setStep('email');
          } else {
            toast.success('Account created! Welcome to PremaShop!');
            navigate('/');
          }
        } else {
          logger.error('Account creation failed', { message: createResult.message });
          toast.error(createResult.message || 'Failed to create account');
        }
      } else {
        setOtpError(result.message || 'Invalid OTP');
      }
    } catch (e) {
      logger.error('Verify OTP error', { error: e });
      setOtpError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast.error('Google sign in failed');
        setIsLoading(false);
      }
    } catch (e) {
      logger.error('Google auth error', { error: e });
      toast.error('Something went wrong');
      setIsLoading(false);
    }
  };

  // Go back to previous step
  const handleGoBack = () => {
    if (step === 'otp') {
      setStep('phone');
      setOtp('');
      setOtpError('');
    } else if (step === 'phone') {
      setStep('password');
    } else if (step === 'password') {
      setStep('email');
    } else {
      navigate('/shop');
    }
  };

  // Switch between sign in and sign up
  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setStep('email');
    setFormData({ email: '', password: '', phone: '' });
    setTosAccepted(false);
    setOtp('');
    setOtpSessionId('');
    setOtpError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 relative">
      {/* Back/Close button - top right */}
      <button
        onClick={() => navigate('/shop')}
        className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 hover:bg-muted transition-colors z-10"
        aria-label="Back to shop"
      >
        <X className="h-5 w-5 text-foreground" />
      </button>

      <Card className="w-full max-w-md shadow-xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src="/dist/logo.svg" alt="PremaShop" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === 'signin' ? 'Welcome back' :
              step === 'otp' ? 'Verify your phone' : 'Create account'}
          </CardTitle>
          <CardDescription>
            {mode === 'signin'
              ? 'Sign in to continue shopping'
              : step === 'otp'
                ? `Enter the OTP sent to +91 ${formData.phone}`
                : 'Get started with PremaShop'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Google OAuth Button - Only on email step */}
          {step === 'email' && (
            <>
              <Button
                variant="outline"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full h-12 text-base font-medium border-2 hover:bg-muted/50 text-foreground"
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleEmailContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 text-base"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                Continue with Email
              </Button>
            </form>
          )}

          {/* Password Step - Sign In */}
          {step === 'password' && mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formData.email}</span>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 text-base pr-12"
                    autoFocus
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Sign In
              </Button>
              <button
                type="button"
                onClick={handleGoBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
            </form>
          )}

          {/* Password Step - Sign Up */}
          {step === 'password' && mode === 'signup' && (
            <form onSubmit={handlePasswordContinue} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formData.email}</span>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 text-base pr-12"
                    autoFocus
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                Continue
              </Button>
              <button
                type="button"
                onClick={handleGoBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
            </form>
          )}

          {/* Phone Step - Sign Up Only */}
          {step === 'phone' && mode === 'signup' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{formData.email}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex">
                  <div className="flex items-center justify-center px-4 bg-muted border border-r-0 rounded-l-md text-sm font-medium text-muted-foreground">
                    +91
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className={`h-12 text-base rounded-l-none ${phoneError ? 'border-destructive' : ''}`}
                    maxLength={10}
                    autoFocus
                    required
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  We'll send a verification code to this number
                </p>
              </div>
              <div className="flex items-start space-x-2 py-2">
                <Checkbox
                  id="tos-accept"
                  checked={tosAccepted}
                  onCheckedChange={(checked) => setTosAccepted(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="tos-accept" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary hover:underline" target="_blank">Terms</Link>
                  {' '}and{' '}
                  <Link to="/privacy-policy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>
                </Label>
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading || !tosAccepted}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Phone className="mr-2 h-5 w-5" />}
                Send OTP
              </Button>
              <button
                type="button"
                onClick={handleGoBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
            </form>
          )}

          {/* OTP Step - Sign Up Only */}
          {step === 'otp' && mode === 'signup' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp" className="sr-only">Enter OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={handleOtpChange}
                  className={`h-14 text-center text-2xl tracking-[0.5em] font-mono ${otpError ? 'border-destructive' : ''}`}
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                />
                {otpError && (
                  <p className="text-sm text-destructive text-center">{otpError}</p>
                )}
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={isLoading || otp.length < 4}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Verify & Create Account
              </Button>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Resend OTP in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-sm text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Didn't receive OTP? Resend
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleGoBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Change phone number
              </button>
            </form>
          )}

          {/* Switch Mode Link - Hide on OTP step */}
          {step !== 'otp' && (
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary hover:underline font-medium"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
