/**
 * Phone OTP Authentication Component
 * Two-step flow: Phone Input → OTP Verification
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { firebaseAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from '@/lib/firebase';
import { logger } from '@/lib/logger';

interface PhoneAuthProps {
    onSuccess: () => Promise<void>;
    isLoading: boolean;
}

export default function PhoneAuth({ onSuccess, isLoading }: PhoneAuthProps) {
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [otp, setOtp] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    // Countdown timer for resend
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Initialize reCAPTCHA on mount
    useEffect(() => {
        if (recaptchaContainerRef.current && !recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, {
                    size: 'invisible',
                    callback: () => {
                        // reCAPTCHA solved
                    },
                    'expired-callback': () => {
                        toast.error('reCAPTCHA expired. Please try again.');
                        recaptchaVerifierRef.current = null;
                    }
                });
            } catch (error) {
                logger.error('reCAPTCHA initialization error', { error });
            }
        }
    }, []);

    // Handle phone input - digits only
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
        setPhone(value);
        if (value.length > 0 && value.length !== 10) {
            setPhoneError(`${10 - value.length} more digits needed`);
        } else {
            setPhoneError('');
        }
    };

    // Send OTP
    const handleSendOtp = async () => {
        if (phone.length !== 10) {
            setPhoneError('Please enter exactly 10 digits');
            return;
        }

        setSendingOtp(true);
        try {
            // Log for debugging
            console.log('🔐 Starting OTP send process...');
            console.log('📱 Phone number:', `+91${phone}`);

            // Clear existing reCAPTCHA and create new one
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                } catch (e) {
                    console.log('Could not clear existing reCAPTCHA');
                }
                recaptchaVerifierRef.current = null;
            }

            // Create fresh reCAPTCHA verifier
            if (recaptchaContainerRef.current) {
                console.log('🔄 Creating reCAPTCHA verifier...');
                recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current, {
                    size: 'invisible',
                    callback: () => {
                        console.log('✅ reCAPTCHA solved');
                    },
                    'expired-callback': () => {
                        console.log('⚠️ reCAPTCHA expired');
                        toast.error('reCAPTCHA expired. Please try again.');
                        recaptchaVerifierRef.current = null;
                    }
                });
            }

            if (!recaptchaVerifierRef.current) {
                throw new Error('reCAPTCHA not initialized');
            }

            const phoneNumber = `+91${phone}`;
            console.log('📤 Calling signInWithPhoneNumber...');

            const confirmation = await signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifierRef.current);

            console.log('✅ OTP sent successfully!', confirmation);
            setConfirmationResult(confirmation);
            setStep('otp');
            setResendTimer(60);
            toast.success('OTP sent to your phone');
        } catch (error: any) {
            // Detailed error logging
            console.error('❌ Send OTP Error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            logger.error('Send OTP error', { error, code: error.code, message: error.message });

            // User-friendly error messages
            if (error.code === 'auth/invalid-phone-number') {
                toast.error('Invalid phone number. Please check and try again.');
            } else if (error.code === 'auth/too-many-requests') {
                toast.error('Too many attempts. Please try again later.');
            } else if (error.code === 'auth/quota-exceeded') {
                toast.error('SMS quota exceeded. Please try again later.');
            } else if (error.code === 'auth/captcha-check-failed') {
                toast.error('reCAPTCHA verification failed. Please refresh and try again.');
            } else if (error.code === 'auth/missing-phone-number') {
                toast.error('Phone number is missing. Please enter a valid number.');
            } else if (error.code === 'auth/operation-not-allowed') {
                toast.error('Phone authentication is not enabled. Please contact support.');
            } else if (error.code === 'auth/invalid-app-credential') {
                toast.error('App configuration error. Please contact support.');
            } else {
                toast.error(`Failed to send OTP: ${error.message || 'Please try again.'}`);
            }

            // Reset reCAPTCHA for retry
            recaptchaVerifierRef.current = null;
        } finally {
            setSendingOtp(false);
        }
    };

    // Verify OTP
    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            toast.error('Please enter the complete 6-digit OTP');
            return;
        }

        if (!confirmationResult) {
            toast.error('Session expired. Please request a new OTP.');
            setStep('phone');
            return;
        }

        setVerifying(true);
        try {
            // Verify OTP with Firebase
            await confirmationResult.confirm(otp);

            // Firebase auth is now complete, notify parent
            // The Supabase client will automatically use the Firebase JWT via accessToken
            await onSuccess();

        } catch (error: any) {
            logger.error('Verify OTP error', { error });

            if (error.code === 'auth/invalid-verification-code') {
                toast.error('Incorrect OTP. Please try again.');
            } else if (error.code === 'auth/code-expired') {
                toast.error('OTP expired. Please request a new one.');
                setStep('phone');
            } else {
                toast.error('Verification failed. Please try again.');
            }
        } finally {
            setVerifying(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;

        // Reset and re-send
        recaptchaVerifierRef.current = null;
        setOtp('');
        await handleSendOtp();
    };

    // Go back to phone input
    const handleEditPhone = () => {
        setStep('phone');
        setOtp('');
        setConfirmationResult(null);
    };

    const isProcessing = isLoading || sendingOtp || verifying;

    return (
        <div className="space-y-6">
            {/* Hidden reCAPTCHA container */}
            <div ref={recaptchaContainerRef} id="recaptcha-container" />

            {step === 'phone' ? (
                /* Step 1: Phone Input */
                <div className="space-y-4">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                            <Phone className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold">Enter your phone number</h3>
                        <p className="text-sm text-muted-foreground">
                            We'll send you a one-time verification code
                        </p>
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
                                value={phone}
                                onChange={handlePhoneChange}
                                className={`rounded-l-none text-lg tracking-wider ${phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                maxLength={10}
                                disabled={isProcessing}
                                autoFocus
                            />
                        </div>
                        {phoneError && (
                            <p className="text-sm text-destructive">{phoneError}</p>
                        )}
                    </div>

                    <Button
                        onClick={handleSendOtp}
                        className="w-full h-12 text-base"
                        disabled={phone.length !== 10 || isProcessing}
                    >
                        {sendingOtp ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Sending OTP...
                            </>
                        ) : (
                            'Send OTP'
                        )}
                    </Button>
                </div>
            ) : (
                /* Step 2: OTP Verification */
                <div className="space-y-4">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold">Verify your number</h3>
                        <p className="text-sm text-muted-foreground">
                            Enter the 6-digit code sent to
                        </p>
                        <p className="font-medium">+91 {phone}</p>
                    </div>

                    <div className="flex justify-center">
                        <InputOTP
                            value={otp}
                            onChange={setOtp}
                            maxLength={6}
                            disabled={isProcessing}
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    <Button
                        onClick={handleVerifyOtp}
                        className="w-full h-12 text-base"
                        disabled={otp.length !== 6 || isProcessing}
                    >
                        {verifying ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Verify & Continue'
                        )}
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                        <button
                            type="button"
                            onClick={handleEditPhone}
                            className="text-primary hover:underline flex items-center gap-1"
                            disabled={isProcessing}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Change number
                        </button>
                        <button
                            type="button"
                            onClick={handleResendOtp}
                            className={`${resendTimer > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline'}`}
                            disabled={resendTimer > 0 || isProcessing}
                        >
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
