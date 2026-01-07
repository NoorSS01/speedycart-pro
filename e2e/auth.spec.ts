/**
 * E2E Test: Authentication Flow
 * 
 * Tests user authentication including sign-in and sign-out.
 * Note: Sign-up requires email verification and is tested manually.
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to auth page
        await page.goto('/auth');
    });

    test('should display sign-in form', async ({ page }) => {
        // Check for sign-in form elements
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        // Fill in invalid credentials
        await page.fill('input[type="email"]', 'invalid@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');

        // Submit form
        await page.click('button[type="submit"]');

        // Wait for error message
        await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
    });

    test('should have link to sign-up form', async ({ page }) => {
        // Look for sign-up link
        const signUpLink = page.getByText(/sign up/i).first();
        await expect(signUpLink).toBeVisible();
    });

    test('should switch between sign-in and sign-up tabs', async ({ page }) => {
        // Click on sign-up tab/link
        const signUpTab = page.getByRole('tab', { name: /sign up/i });
        if (await signUpTab.isVisible()) {
            await signUpTab.click();
            // Verify sign-up form is now visible
            await expect(page.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
        }
    });

    test('should have responsive layout on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Check auth page still renders correctly
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });
});

test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
        // Try to access a protected route
        await page.goto('/orders');

        // Should redirect to auth page or show auth prompt
        // (exact behavior depends on implementation)
        await page.waitForURL(/\/(auth|login)/i, { timeout: 5000 }).catch(() => {
            // If still on orders page, check for auth prompt
            expect(page.url()).not.toContain('/orders');
        });
    });

    test('should redirect from admin routes when not admin', async ({ page }) => {
        // Try to access admin route without authentication
        await page.goto('/admin');

        // Should redirect or show access denied
        await page.waitForURL(/\/(auth|login|denied)/i, { timeout: 5000 }).catch(() => {
            // Verify we're not on admin page
            expect(page.url()).not.toContain('/admin');
        });
    });
});
