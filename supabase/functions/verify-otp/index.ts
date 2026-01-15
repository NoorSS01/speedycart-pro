// Supabase Edge Function: verify-otp
// Verifies OTP via 2Factor.in SMS API
// Keeps API key secure on server-side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2Factor API configuration
const TWOFACTOR_API_KEY = Deno.env.get("TWOFACTOR_API_KEY");
const TWOFACTOR_BASE_URL = "https://2factor.in/API/V1";

interface VerifyOtpRequest {
    sessionId: string;
    otp: string;
}

interface VerifyOtpResponse {
    success: boolean;
    verified: boolean;
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
                JSON.stringify({ success: false, verified: false, message: "Method not allowed" }),
                { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check API key is configured
        if (!TWOFACTOR_API_KEY) {
            console.error("TWOFACTOR_API_KEY not configured");
            return new Response(
                JSON.stringify({ success: false, verified: false, message: "OTP service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const body: VerifyOtpRequest = await req.json();
        const { sessionId, otp } = body;

        // Validate inputs
        if (!sessionId) {
            return new Response(
                JSON.stringify({ success: false, verified: false, message: "Session ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!otp) {
            return new Response(
                JSON.stringify({ success: false, verified: false, message: "OTP is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Clean OTP - only digits
        const cleanOtp = otp.replace(/\D/g, "");

        if (cleanOtp.length < 4 || cleanOtp.length > 6) {
            return new Response(
                JSON.stringify({ success: false, verified: false, message: "OTP must be 4-6 digits" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Verifying OTP for session: ${sessionId.substring(0, 8)}...`);

        // Call 2Factor API to verify OTP
        const apiUrl = `${TWOFACTOR_BASE_URL}/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${cleanOtp}`;

        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });

        const data = await response.json();
        console.log("2Factor verify response:", JSON.stringify(data));

        // Check 2Factor response
        // Success: { "Status": "Success", "Details": "OTP Matched" }
        // Error: { "Status": "Error", "Details": "OTP Mismatch" or other error }

        if (data.Status === "Success" && data.Details === "OTP Matched") {
            const result: VerifyOtpResponse = {
                success: true,
                verified: true,
                message: "Phone number verified successfully",
            };

            return new Response(
                JSON.stringify(result),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else if (data.Details === "OTP Mismatch") {
            return new Response(
                JSON.stringify({
                    success: true,
                    verified: false,
                    message: "Invalid OTP. Please try again."
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else if (data.Details === "OTP Expired") {
            return new Response(
                JSON.stringify({
                    success: true,
                    verified: false,
                    message: "OTP expired. Please request a new one."
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        } else {
            console.error("2Factor verify error:", data.Details);
            return new Response(
                JSON.stringify({
                    success: false,
                    verified: false,
                    message: data.Details || "Verification failed"
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

    } catch (error) {
        console.error("verify-otp error:", error);
        return new Response(
            JSON.stringify({ success: false, verified: false, message: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
