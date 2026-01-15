/**
 * OTP Service - Client for 2Factor.in via Supabase Edge Functions
 * 
 * Uses Supabase Edge Functions to securely call 2Factor.in API
 * API key is stored server-side, never exposed to client
 */

import { supabase } from '@/integrations/supabase/client';

interface SendOtpResponse {
    success: boolean;
    sessionId?: string;
    message: string;
}

interface VerifyOtpResponse {
    success: boolean;
    verified: boolean;
    message: string;
}

/**
 * Send OTP to phone number via 2Factor.in
 * @param phone - Phone number (10 digits, with or without +91)
 * @returns Session ID on success, error message on failure
 */
export async function sendOtp(phone: string): Promise<SendOtpResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('send-otp', {
            body: { phone },
        });

        if (error) {
            console.error('Send OTP error:', error);
            return {
                success: false,
                message: error.message || 'Failed to send OTP',
            };
        }

        return data as SendOtpResponse;
    } catch (error: any) {
        console.error('Send OTP exception:', error);
        return {
            success: false,
            message: error.message || 'Failed to send OTP',
        };
    }
}

/**
 * Verify OTP via 2Factor.in
 * @param sessionId - Session ID from sendOtp response
 * @param otp - OTP entered by user
 * @returns Verification result
 */
export async function verifyOtp(sessionId: string, otp: string): Promise<VerifyOtpResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('verify-otp', {
            body: { sessionId, otp },
        });

        if (error) {
            console.error('Verify OTP error:', error);
            return {
                success: false,
                verified: false,
                message: error.message || 'Failed to verify OTP',
            };
        }

        return data as VerifyOtpResponse;
    } catch (error: any) {
        console.error('Verify OTP exception:', error);
        return {
            success: false,
            verified: false,
            message: error.message || 'Failed to verify OTP',
        };
    }
}

interface CreateUserResponse {
    success: boolean;
    message: string;
    userId?: string;
}

/**
 * Create user account via Edge Function
 * Uses admin API to auto-confirm email since phone is already verified via OTP
 * @param email - User's email
 * @param password - User's password
 * @param phone - User's phone number (already verified via OTP)
 * @returns Created user ID on success
 */
export async function createUser(
    email: string,
    password: string,
    phone: string
): Promise<CreateUserResponse> {
    try {
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: { email, password, phone },
        });

        // When Edge Function returns 400, the error message is in data
        if (error) {
            console.error('Create user error:', error);
            // Try to extract message from context if available
            const errorMsg = (error as any)?.context?.body
                ? JSON.parse(await (error as any).context.body.text()).message
                : error.message;
            return {
                success: false,
                message: errorMsg || 'Failed to create account',
            };
        }

        // Check if data contains an error response (success: false)
        if (data && data.success === false) {
            return {
                success: false,
                message: data.message || 'Failed to create account',
            };
        }

        return data as CreateUserResponse;
    } catch (error: any) {
        console.error('Create user exception:', error);
        return {
            success: false,
            message: error.message || 'Failed to create account',
        };
    }
}
