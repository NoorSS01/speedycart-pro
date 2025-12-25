// Supabase Edge Function: send-push-notification
// Core function to send web push notifications using VAPID

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push library for Deno
async function sendWebPush(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    vapidDetails: { subject: string; publicKey: string; privateKey: string }
) {
    const encoder = new TextEncoder();

    // Import VAPID keys
    const publicKeyBuffer = base64UrlToUint8Array(vapidDetails.publicKey);
    const privateKeyBuffer = base64UrlToUint8Array(vapidDetails.privateKey);

    // Create JWT for VAPID
    const jwt = await createVapidJwt(subscription.endpoint, vapidDetails);

    // Encrypt payload
    const encryptedPayload = await encryptPayload(
        payload,
        subscription.keys.p256dh,
        subscription.keys.auth
    );

    // Send push notification
    const response = await fetch(subscription.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "Authorization": `vapid t=${jwt}, k=${vapidDetails.publicKey}`,
            "TTL": "86400",
            "Urgency": "high",
        },
        body: encryptedPayload,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Push failed: ${response.status} - ${text}`);
    }

    return response;
}

// Base64 URL decode
function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Create VAPID JWT
async function createVapidJwt(endpoint: string, vapidDetails: any): Promise<string> {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const header = { alg: "ES256", typ: "JWT" };
    const payload = {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
        sub: vapidDetails.subject,
    };

    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const data = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();

    // Import private key and sign
    const privateKeyBuffer = base64UrlToUint8Array(vapidDetails.privateKey);
    const key = await crypto.subtle.importKey(
        "raw",
        privateKeyBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        encoder.encode(data)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${data}.${signatureB64}`;
}

// Encrypt payload using Web Push encryption
async function encryptPayload(
    payload: string,
    p256dh: string,
    auth: string
): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);

    // For simplicity, we'll use a basic encryption approach
    // In production, use web-push library or proper ECDH+HKDF+AES-GCM

    // Generate ephemeral key pair
    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    // Import subscriber's public key
    const subscriberKey = await crypto.subtle.importKey(
        "raw",
        base64UrlToUint8Array(p256dh),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: "ECDH", public: subscriberKey },
        keyPair.privateKey,
        256
    );

    // Export ephemeral public key
    const publicKeyBytes = await crypto.subtle.exportKey("raw", keyPair.publicKey);

    // Derive encryption key using HKDF
    const authSecret = base64UrlToUint8Array(auth);
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const prk = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(sharedSecret),
        { name: "HKDF" },
        false,
        ["deriveBits"]
    );

    const keyMaterial = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt,
            info: encoder.encode("Content-Encoding: aes128gcm\0"),
        },
        prk,
        128
    );

    const nonceMaterial = await crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt,
            info: encoder.encode("Content-Encoding: nonce\0"),
        },
        prk,
        96
    );

    // Import AES-GCM key
    const aesKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(keyMaterial),
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    // Encrypt payload
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: new Uint8Array(nonceMaterial), tagLength: 128 },
        aesKey,
        payloadBytes
    );

    // Build final message
    const publicKeyArray = new Uint8Array(publicKeyBytes);
    const encryptedArray = new Uint8Array(encrypted);

    const recordSize = 4096;
    const header = new Uint8Array(21 + publicKeyArray.length);
    const view = new DataView(header.buffer);

    header.set(salt, 0);
    view.setUint32(16, recordSize, false);
    header[20] = publicKeyArray.length;
    header.set(publicKeyArray, 21);

    const result = new Uint8Array(header.length + encryptedArray.length);
    result.set(header, 0);
    result.set(encryptedArray, header.length);

    return result;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Get VAPID keys from environment
        const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
        const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
        const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@premasshop.com";

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            throw new Error("VAPID keys not configured");
        }

        // Parse request body
        const {
            user_ids,           // Array of user IDs to notify
            notification_type,  // Type of notification
            title,              // Notification title
            body,               // Notification body
            url,                // URL to open on click
            icon,               // Icon name
            image_url,          // Optional image
            data,               // Additional data
            broadcast_id,       // Optional broadcast reference
            send_to_admins,     // Send to all admins
            send_to_delivery,   // Send to all delivery personnel
            preference_filter,  // Filter by preference (e.g., 'profit_alerts')
        } = await req.json();

        // Create Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Build query to get subscriptions
        let subscriptions: any[] = [];

        if (send_to_admins) {
            const { data: adminIds } = await supabase.rpc('get_admin_user_ids');
            if (adminIds && adminIds.length > 0) {
                const { data } = await supabase
                    .from('push_subscriptions')
                    .select('*')
                    .in('user_id', adminIds);
                if (data) subscriptions.push(...data);
            }
        } else if (send_to_delivery) {
            const { data: deliveryIds } = await supabase.rpc('get_delivery_user_ids');
            if (deliveryIds && deliveryIds.length > 0) {
                const { data } = await supabase
                    .from('push_subscriptions')
                    .select('*')
                    .in('user_id', deliveryIds);
                if (data) subscriptions.push(...data);
            }
        } else if (user_ids && user_ids.length > 0) {
            const { data } = await supabase
                .from('push_subscriptions')
                .select('*')
                .in('user_id', user_ids);
            if (data) subscriptions.push(...data);
        } else {
            // Get all subscriptions with preference filter
            let query = supabase.from('push_subscriptions').select('*');

            if (preference_filter) {
                query = query.eq(preference_filter, true);
            }

            const { data } = await query;
            if (data) subscriptions = data;
        }

        // Remove duplicates
        const uniqueSubscriptions = subscriptions.filter(
            (sub, index, self) =>
                index === self.findIndex(s => s.endpoint === sub.endpoint)
        );

        // Prepare notification payload
        const notificationPayload = JSON.stringify({
            title,
            body,
            icon: icon || 'bell',
            url: url || '/',
            image: image_url,
            type: notification_type,
            data: data || {},
            timestamp: Date.now(),
        });

        const vapidDetails = {
            subject: VAPID_SUBJECT,
            publicKey: VAPID_PUBLIC_KEY,
            privateKey: VAPID_PRIVATE_KEY,
        };

        // Send notifications
        const results = await Promise.allSettled(
            uniqueSubscriptions.map(async (sub) => {
                try {
                    await sendWebPush(
                        {
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth },
                        },
                        notificationPayload,
                        vapidDetails
                    );

                    // Log success
                    await supabase.from('notification_logs').insert({
                        user_id: sub.user_id,
                        title,
                        body,
                        icon,
                        url,
                        image_url,
                        notification_type: notification_type || 'general',
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        broadcast_id,
                    });

                    // Update subscription stats
                    await supabase
                        .from('push_subscriptions')
                        .update({
                            last_notification_at: new Date().toISOString(),
                            notification_count: sub.notification_count + 1,
                        })
                        .eq('id', sub.id);

                    return { success: true, user_id: sub.user_id };
                } catch (error) {
                    // Log failure
                    await supabase.from('notification_logs').insert({
                        user_id: sub.user_id,
                        title,
                        body,
                        icon,
                        url,
                        image_url,
                        notification_type: notification_type || 'general',
                        status: 'failed',
                        error_message: (error as Error).message,
                        broadcast_id,
                    });

                    // If endpoint is invalid, remove subscription
                    if (error.message.includes('410') || error.message.includes('404')) {
                        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                    }

                    return { success: false, user_id: sub.user_id, error: (error as Error).message };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        // Update broadcast status if applicable
        if (broadcast_id) {
            await supabase
                .from('broadcast_notifications')
                .update({
                    status: 'sent',
                    sent_count: successful,
                    failed_count: failed,
                    sent_at: new Date().toISOString(),
                })
                .eq('id', broadcast_id);
        }

        return new Response(
            JSON.stringify({
                success: true,
                sent: successful,
                failed,
                total: uniqueSubscriptions.length,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error) {
        console.error("Error sending push notification:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
