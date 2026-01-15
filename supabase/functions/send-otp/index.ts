// Supabase Edge Function: send-otp
// Sends OTP via 2Factor.in SMS API
// Includes phone uniqueness check before sending

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2Factor API configuration
const TWOFACTOR_API_KEY = Deno.env.get("TWOFACTOR_API_KEY");
const TWOFACTOR_BASE_URL = "https://2factor.in/API/V1";

// Supabase configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface SendOtpRequest {
    phone: string;
    checkUnique?: boolean; // If true, check if phone is already registered
}

interface SendOtpResponse {
    success: boolean;
    sessionId?: string;
    message: string;
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

        // Check API key is configured
        if (!TWOFACTOR_API_KEY) {
            console.error("TWOFACTOR_API_KEY not configured");
            return new Response(
                JSON.stringify({ success: false, message: "OTP service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const body: SendOtpRequest = await req.json();
        const { phone, checkUnique = true } = body;

        // Validate phone number
        if (!phone) {
            return new Response(
                JSON.stringify({ success: false, message: "Phone number is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Clean phone number - remove +91 prefix if present, ensure 10 digits
        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.startsWith("91") && cleanPhone.length === 12) {
            cleanPhone = cleanPhone.substring(2);
        }

        if (cleanPhone.length !== 10) {
            return new Response(
                JSON.stringify({ success: false, message: "Invalid phone number. Must be 10 digits." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const normalizedPhone = `+91${cleanPhone}`;

        // Check if phone is already registered (for signup flow)
        if (checkUnique && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            const { data: existingProfile, error: checkError } = await supabase
                .from('profiles')
                .select('id')
                .eq('phone', normalizedPhone)
                .maybeSingle();

            if (checkError) {
                console.error("Error checking phone uniqueness:", checkError);
            } else if (existingProfile) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "This phone number is already registered. Please sign in instead."
                    }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        console.log(`Sending OTP to: ${cleanPhone.substring(0, 4)}****${cleanPhone.substring(8)}`);

        // Call 2Factor API to send OTP
        const apiUrl = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/${cleanPhone}/AUTOGEN`;

        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });

        const data = await response.json();
        console.log("2Factor response:", JSON.stringify(data));

        // Check 2Factor response
        if (data.Status === "Success") {
            const result: SendOtpResponse = {
                success: true,
                sessionId: data.Details,
                message: "OTP sent successfully",
            };

            return new Response(
                JSON.stringify(result),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else {
            console.error("2Factor error:", data.Details);
            return new Response(
                JSON.stringify({
                    success: false,
                    message: data.Details || "Failed to send OTP"
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

    } catch (error) {
        console.error("send-otp error:", error);
        return new Response(
            JSON.stringify({ success: false, message: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
