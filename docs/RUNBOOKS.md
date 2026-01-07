# SpeedyCart Pro Operations Runbooks

This document provides guidance for handling common operational scenarios, errors, and incidents.

---

## Table of Contents

1. [Health Check Failures](#health-check-failures)
2. [Authentication Issues](#authentication-issues)
3. [Database Issues](#database-issues)
4. [Order Failures](#order-failures)
5. [Notification Failures](#notification-failures)
6. [Performance Degradation](#performance-degradation)
7. [Escalation Paths](#escalation-paths)

---

## Health Check Failures

### Database Status: Unhealthy

**Symptoms:**
- Health check shows Database as "Unhealthy"
- Users can't load products or place orders
- Console shows "Failed to fetch" errors

**Immediate Actions:**
1. Check Supabase dashboard status: [https://status.supabase.com](https://status.supabase.com)
2. Verify environment variables are set correctly:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Check browser network tab for 5xx errors
4. Try accessing Supabase dashboard directly

**Recovery:**
- If Supabase outage: Wait for recovery, monitor status page
- If credentials issue: Redeploy with correct env vars
- If RLS issue: Check Row Level Security policies in Supabase

---

### Auth Status: Degraded

**Symptoms:**
- Users can't sign in/out
- Session not persisting
- "Invalid credentials" errors for valid users

**Immediate Actions:**
1. Check Supabase Auth configuration
2. Verify email templates are configured
3. Check for rate limiting (too many auth attempts)

**Recovery:**
- Clear localStorage: `localStorage.clear()`
- Reset user password through admin
- Check Auth audit logs in Supabase

---

## Authentication Issues

### "useAuth must be used within an AuthProvider"

**Cause:** Component using `useAuth()` is not wrapped in `<AuthProvider>`.

**Fix:** Ensure `AuthProvider` wraps the app in `main.tsx`.

---

### User Can't Sign In

**Checklist:**
1. Verify email is confirmed (if email confirmation enabled)
2. Check password meets requirements
3. Check for account lockout
4. Verify user exists in `auth.users` table

---

## Database Issues

### "Row Level Security" Errors

**Symptoms:**
- Empty data returned when data exists
- "new row violates row-level security policy" on insert

**Diagnosis:**
```sql
-- Check RLS policies on a table
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

**Fix:**
- Review and update RLS policies
- Ensure `auth.uid()` matches the expected column

---

### Slow Queries

**Symptoms:**
- Health check shows > 2000ms latency
- Pages load slowly
- Timeouts

**Diagnosis:**
1. Check Supabase Performance tab
2. Look for missing indexes
3. Review query patterns

**Fix:**
- Add indexes for frequently queried columns
- Optimize complex queries
- Consider caching strategies

---

## Order Failures

### Order Not Created

**Checklist:**
1. Check user is authenticated
2. Verify cart has items
3. Check delivery address is set
4. Verify payment method selected

**Logs to Check:**
- Browser console for errors
- Supabase function logs (if using Edge Functions)

---

### Order Status Not Updating

**Cause:** RLS policy or trigger issue

**Fix:**
1. Check `orders` table RLS policies
2. Verify status enum values are valid
3. Check for database triggers blocking update

---

## Notification Failures

### Push Notifications Not Received

**Checklist:**
1. Verify VAPID keys are configured
2. Check browser supports Push API
3. Verify user granted permission
4. Check `push_subscriptions` table has user's subscription

**Debug:**
```javascript
// Check subscription status
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
console.log('Subscription:', sub);
```

---

## Performance Degradation

### Core Web Vitals Poor

**LCP > 2.5s:**
- Optimize largest image/element
- Implement lazy loading
- Use CDN for static assets

**CLS > 0.1:**
- Set explicit dimensions on images
- Reserve space for dynamic content
- Avoid inserting content above existing content

**FID/INP > 100ms:**
- Reduce JavaScript execution time
- Use code splitting
- Defer non-critical scripts

---

## Escalation Paths

### Level 1: On-Call Developer
- Logs and monitoring alerts
- Quick fixes and restarts
- Escalate if not resolved in 30 minutes

### Level 2: Senior Developer
- Database and infrastructure issues
- Code deployments
- Escalate if business impact continues

### Level 3: Platform Team / Supabase Support
- Supabase infrastructure issues
- Security incidents
- Data recovery needs

---

## Monitoring Alerts

### Set Up These Alerts:

| Alert | Threshold | Action |
|-------|-----------|--------|
| Health check failure | 3 consecutive | Page on-call |
| Error rate spike | > 5% of requests | Notify Slack |
| Database latency | > 2000ms avg | Warn team |
| Auth failures | > 10/minute | Investigate |

---

## Useful Commands

```powershell
# Run health check manually
npm test -- --grep "health"

# Check build for errors
npm run build

# View recent logs (if using logging service)
# Check your logging provider's CLI

# Clear local dev state
rm -rf node_modules/.vite
npm run dev
```

---

*Last updated: January 2026*
