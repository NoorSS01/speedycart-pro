# PremasShop Push Notification System - Deployment Guide

## 🚀 Complete Production Push Notification System

This guide will help you deploy the full push notification system similar to Zepto/Blinkit.

---

## 📋 Prerequisites

1. ✅ Supabase project with Edge Functions enabled
2. ✅ VAPID keys generated and stored
3. ✅ Push notification SQL schema deployed

---

## 🔐 Step 1: Configure Supabase Secrets

Go to **Supabase Dashboard → Project Settings → Edge Functions → Secrets**

Add these secrets:

```
VAPID_PUBLIC_KEY=your_public_vapid_key
VAPID_PRIVATE_KEY=your_private_vapid_key
VAPID_SUBJECT=mailto:admin@premasshop.com
```

> 💡 Generate keys at https://vapidkeys.com/

---

## 📦 Step 2: Deploy Database Schema

Run this SQL in **Supabase SQL Editor**:

```sql
-- Copy contents from: supabase/push_notifications_v2.sql
```

This creates:
- `notification_templates` - Pre-defined notification templates
- `broadcast_notifications` - Admin broadcast history
- `notification_logs` - All notification tracking
- Database triggers for automatic notifications on:
  - Order status changes
  - Low stock alerts

---

## ⚡ Step 3: Deploy Edge Functions

### Option A: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy send-push-notification
supabase functions deploy process-notifications
```

### Option B: Manual Deployment via Dashboard

1. Go to **Supabase Dashboard → Edge Functions**
2. Click **New Function**
3. Name: `send-push-notification`
4. Copy code from `supabase/functions/send-push-notification/index.ts`
5. Repeat for `process-notifications`

---

## ⏰ Step 4: Set Up Cron Jobs

Go to **Supabase Dashboard → Database → Extensions** and enable `pg_cron`.

Then run this SQL:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule notification processor every 5 minutes
SELECT cron.schedule(
  'process-pending-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('type', 'pending')
  );
  $$
);

-- Schedule daily reminders every minute (checks user-specific times)
SELECT cron.schedule(
  'process-daily-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('type', 'daily_reminders')
  );
  $$
);

-- Schedule daily profit summary at 9 PM IST (3:30 PM UTC)
SELECT cron.schedule(
  'daily-profit-summary',
  '30 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('type', 'profit_summary')
  );
  $$
);

-- Process scheduled broadcasts every minute
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('type', 'scheduled')
  );
  $$
);
```

> ⚠️ Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values.

---

## 🔔 Notification Types

### 1. Order Status Notifications (Automatic)
- **New Order** → Sent to admins
- **Order Confirmed** → Sent to customer
- **Out for Delivery** → Sent to customer
- **Delivered** → Sent to customer
- **Cancelled** → Sent to customer

### 2. Low Stock Alerts (Automatic)
- Triggered when product stock ≤ 5 units
- Critical alert when stock ≤ 2 units
- Sent to admins only

### 3. Daily Profit Summary (Scheduled)
- Sent at 9 PM daily
- Includes revenue, profit, order count
- Sent to admins with profit_alerts enabled

### 4. Daily Reminders (Scheduled)
- Sent at user's chosen time
- Personalized for each user
- Shows pending orders count

### 5. Admin Broadcasts (Manual)
- Custom title and message
- Target: All users, Admins, Delivery, or Specific users
- Can be scheduled or sent immediately

---

## 🧪 Testing

### From Admin Dashboard:
1. Go to `/admin/notifications`
2. Use the "Test" tab
3. Send test notifications for each type

### Verify Triggers:
1. Create a test order → Should trigger new order notification
2. Reduce product stock → Should trigger low stock alert
3. Schedule a broadcast → Should send at scheduled time

---

## 📱 User Preferences

Users can configure in their Profile:
- ✅ Order Updates
- ✅ Daily Reminders (with custom time)
- ✅ Profit Alerts (admin only)
- ✅ Low Stock Alerts (admin only)
- ✅ Promotional Alerts
- ✅ Sound & Vibration settings

---

## 🔧 Troubleshooting

### Notifications not sending?
1. Check browser console for errors
2. Verify VAPID keys are correct
3. Check Edge Function logs in Supabase
4. Ensure user has granted permission

### Cron jobs not running?
1. Verify pg_cron extension is enabled
2. Check cron job status: `SELECT * FROM cron.job;`
3. View job history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### Permission denied errors?
1. RLS policies may be blocking access
2. Check user roles table
3. Verify service role key in cron jobs

---

## 📊 Monitoring

View notification stats in:
- Admin Dashboard → Broadcast Center → Stats cards
- Database: `SELECT * FROM notification_stats;`
- Logs: `SELECT * FROM notification_logs ORDER BY created_at DESC;`

---

## 🎯 Best Practices

1. **Don't spam users** - Limit broadcast frequency
2. **Respect preferences** - Always check user settings
3. **Use deep links** - Direct users to relevant pages
4. **Track metrics** - Monitor delivery and click rates
5. **Test regularly** - Use test notifications before campaigns

---

## 🔗 API Reference

### Send Push Notification
```javascript
await supabase.functions.invoke('send-push-notification', {
  body: {
    title: 'Notification Title',
    body: 'Notification message',
    url: '/dist/target-page',
    notification_type: 'broadcast',
    user_ids: ['user-uuid'], // or use:
    send_to_admins: true,
    send_to_delivery: true,
    preference_filter: 'promotional_alerts',
  }
});
```

### Process Scheduled Notifications
```javascript
await supabase.functions.invoke('process-notifications', {
  body: {
    type: 'all' // or: 'pending', 'daily_reminders', 'profit_summary', 'scheduled'
  }
});
```

---

## ✅ Deployment Checklist

- [ ] VAPID keys configured in Supabase secrets
- [ ] SQL schema deployed
- [ ] Edge Functions deployed
- [ ] pg_cron extension enabled
- [ ] Cron jobs scheduled
- [ ] Test notifications working
- [ ] Service worker registered
- [ ] PWA installed and tested

---

Happy notifying! 🔔
