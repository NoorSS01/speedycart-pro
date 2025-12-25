// Supabase Edge Function: process-notifications
// Scheduled function to process pending notifications and daily reminders
// Run this via Supabase Cron Jobs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { type } = await req.json().catch(() => ({ type: "all" }));

        const results: any = {
            pending_notifications: 0,
            daily_reminders: 0,
            profit_summaries: 0,
            scheduled_broadcasts: 0,
        };

        // 1. Process pending notification logs (from database triggers)
        if (type === "all" || type === "pending") {
            const { data: pendingLogs, error: logsError } = await supabase
                .from("notification_logs")
                .select("*")
                .eq("status", "pending")
                .limit(100);

            if (pendingLogs && !logsError) {
                for (const log of pendingLogs) {
                    // Determine target users
                    let targetUserIds: string[] = [];

                    if (log.user_id) {
                        targetUserIds = [log.user_id];
                    } else if (log.notification_type === "order_status" || log.notification_type === "low_stock") {
                        // Send to admins
                        const { data: adminIds } = await supabase.rpc("get_admin_user_ids");
                        targetUserIds = adminIds || [];
                    }

                    if (targetUserIds.length > 0) {
                        // Send via send-push-notification function
                        await supabase.functions.invoke("send-push-notification", {
                            body: {
                                user_ids: targetUserIds,
                                title: log.title,
                                body: log.body,
                                url: log.url,
                                notification_type: log.notification_type,
                            },
                        });

                        // Update log status
                        await supabase
                            .from("notification_logs")
                            .update({ status: "sent", sent_at: new Date().toISOString() })
                            .eq("id", log.id);

                        results.pending_notifications++;
                    }
                }
            }
        }

        // 2. Process daily reminders
        if (type === "all" || type === "daily_reminders") {
            const now = new Date();
            const currentHour = now.getHours().toString().padStart(2, "0");
            const currentMinute = now.getMinutes().toString().padStart(2, "0");
            const currentTimeStr = `${currentHour}:${currentMinute}:00`;

            // Get users whose reminder time matches current time (within 5-minute window)
            const { data: subscriptions, error: subError } = await supabase
                .from("push_subscriptions")
                .select("user_id, reminder_time")
                .eq("daily_reminders", true)
                .gte("reminder_time", `${currentHour}:${Math.max(0, parseInt(currentMinute) - 5).toString().padStart(2, "0")}:00`)
                .lte("reminder_time", `${currentHour}:${Math.min(59, parseInt(currentMinute) + 5).toString().padStart(2, "0")}:00`);

            if (subscriptions && !subError) {
                for (const sub of subscriptions) {
                    // Get pending orders count
                    const { count } = await supabase
                        .from("orders")
                        .select("*", { count: "exact", head: true })
                        .eq("status", "pending");

                    const timeOfDay = parseInt(currentHour) < 12 ? "Morning" : parseInt(currentHour) < 17 ? "Afternoon" : "Evening";

                    await supabase.functions.invoke("send-push-notification", {
                        body: {
                            user_ids: [sub.user_id],
                            title: `☀️ Good ${timeOfDay}!`,
                            body: `Time to check your shop! ${count || 0} pending orders waiting.`,
                            url: "/admin",
                            notification_type: "daily_reminder",
                        },
                    });

                    results.daily_reminders++;
                }
            }
        }

        // 3. Process daily profit summaries (run at 9 PM)
        if (type === "all" || type === "profit_summary") {
            const now = new Date();
            const currentHour = now.getHours();

            // Only run at 9 PM (21:00)
            if (currentHour === 21 || type === "profit_summary") {
                // Get today's stats
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: orders } = await supabase
                    .from("orders")
                    .select("total_amount, status")
                    .gte("created_at", today.toISOString())
                    .eq("status", "delivered");

                const { data: expenses } = await supabase
                    .from("expenses")
                    .select("amount")
                    .gte("date", today.toISOString().split("T")[0]);

                const revenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
                const orderCount = orders?.length || 0;
                const expenseTotal = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
                const profit = revenue - expenseTotal;

                if (orderCount > 0 || expenseTotal > 0) {
                    // Send to admins with profit_alerts enabled
                    await supabase.functions.invoke("send-push-notification", {
                        body: {
                            title: "💰 Daily Profit Summary",
                            body: `Today: ₹${revenue.toFixed(0)} revenue, ₹${profit.toFixed(0)} profit from ${orderCount} orders!`,
                            url: "/admin",
                            notification_type: "profit_summary",
                            send_to_admins: true,
                            preference_filter: "profit_alerts",
                        },
                    });

                    results.profit_summaries++;
                }
            }
        }

        // 4. Process scheduled broadcasts
        if (type === "all" || type === "scheduled") {
            const now = new Date().toISOString();

            const { data: scheduledBroadcasts } = await supabase
                .from("broadcast_notifications")
                .select("*")
                .eq("status", "scheduled")
                .lte("scheduled_at", now);

            if (scheduledBroadcasts) {
                for (const broadcast of scheduledBroadcasts) {
                    // Update status to sending
                    await supabase
                        .from("broadcast_notifications")
                        .update({ status: "sending" })
                        .eq("id", broadcast.id);

                    // Send the broadcast
                    await supabase.functions.invoke("send-push-notification", {
                        body: {
                            title: broadcast.title,
                            body: broadcast.body,
                            url: broadcast.url,
                            notification_type: "broadcast",
                            broadcast_id: broadcast.id,
                            send_to_admins: broadcast.target_audience === "admins",
                            send_to_delivery: broadcast.target_audience === "delivery",
                            user_ids: broadcast.target_user_ids?.length > 0 ? broadcast.target_user_ids : undefined,
                        },
                    });

                    results.scheduled_broadcasts++;
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: results,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        console.error("Error processing notifications:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
