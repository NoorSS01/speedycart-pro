// Supabase Edge Function: create-user
// Creates a user account with auto-confirmed email (since phone is verified via OTP)
// Uses service role key to bypass email confirmation requirement

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supabase configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CreateUserRequest {
    email: string;
    password: string;
    phone: string;
}

interface CreateUserResponse {
    success: boolean;
    message: string;
    userId?: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Only allow POST
        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({ success: false, message: "Method not allowed" }),
                { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check config
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
            return new Response(
                JSON.stringify({ success: false, message: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const body: CreateUserRequest = await req.json();
        const { email, password, phone } = body;

        // Validate inputs
        if (!email || !password || !phone) {
            return new Response(
                JSON.stringify({ success: false, message: "Email, password, and phone are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(
                JSON.stringify({ success: false, message: "Invalid email format" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validate password length
        if (password.length < 6) {
            return new Response(
                JSON.stringify({ success: false, message: "Password must be at least 6 characters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create Supabase admin client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Check if phone already exists in profiles
        const { data: existingProfile, error: profileCheckError } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

        if (profileCheckError) {
            console.error("Error checking phone:", profileCheckError);
        } else if (existingProfile) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "This phone number is already registered"
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Creating user with email: ${email}, phone: ${phone.substring(0, 6)}****`);

        // Create user with admin API (auto-confirms email since phone is verified)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm since phone is verified via OTP
            user_metadata: {
                phone: phone,
            },
        });

        if (authError) {
            console.error("Error creating user:", authError);

            // Check for common errors
            if (authError.message?.includes("already been registered") ||
                authError.message?.includes("already exists")) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "This email is already registered. Please sign in instead."
                    }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            return new Response(
                JSON.stringify({
                    success: false,
                    message: authError.message || "Failed to create account"
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!authData.user) {
            return new Response(
                JSON.stringify({ success: false, message: "Failed to create user" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`User created successfully: ${authData.user.id}`);

        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                phone: phone,
            });

        if (profileError) {
            console.error("Error creating profile:", profileError);
            // User was created but profile failed - still return success
        } else {
            console.log(`Profile created successfully for user: ${authData.user.id}`);
        }

        const result: CreateUserResponse = {
            success: true,
            message: "Account created successfully!",
            userId: authData.user.id,
        };

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("create-user error:", error);
        return new Response(
            JSON.stringify({ success: false, message: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
