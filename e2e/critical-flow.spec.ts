
import { test, expect } from '@playwright/test';

test.describe('Critical Path: Guest Shopping Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Mock Products API to return consistent data
        await page.route('**/rest/v1/products*', async (route) => {
            const json = [
                {
                    id: 'test-product-1',
                    name: 'Premium Water Bottle',
                    description: '20L Premium Mineral Water',
                    price: 150,
                    mrp: 200,
                    image_url: 'https://placehold.co/400',
                    category_id: 'water',
                    is_active: true,
                    unit: '20L',
                    stock_quantity: 100,
                    max_quantity_per_user: 10
                }
            ];
            await route.fulfill({ json });
        });

        // Mock other potential API calls to avoid errors
        await page.route('**/rest/v1/flash_deals*', async route => route.fulfill({ json: [] }));
        await page.route('**/rest/v1/hero_banners*', async route => route.fulfill({ json: [] }));
        await page.route('**/rest/v1/categories*', async route => route.fulfill({ json: [] }));
    });

    test('should allow a guest to add item to cart and view it', async ({ page }) => {
        // 1. Visit Home Page
        await page.goto('/');

        // Verify Product Card is visible
        const productCard = page.locator('text=Premium Water Bottle').first();
        await expect(productCard).toBeVisible({ timeout: 10000 });

        // 2. Add to Cart (assuming Compact QuantityControls or Add button)
        // First, find the "Add" button or Quantity Control
        // The text might be "Add" or just a Plus icon if quantity is 0, depends on implementation
        // Based on previous files, ProductCard uses QuantityControls

        // Check if there is an "Add" button first
        const addBtn = page.getByRole('button', { name: /add/i }).first();
        if (await addBtn.isVisible()) {
            await addBtn.click();
        } else {
            // Only if "Add" button not found, look for Plus icon
            // But usually QuantityControls defaults to "Add" text or 0 state? 
            // Let's assume there is some way to add.
            // Actually, looking at ProductCard.tsx, if quantity is 0 it shows "ADD" button
            await page.getByText('ADD').first().click();
        }

        // 3. Verify Quantity increased
        await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

        // 4. Open Cart
        // Typically a cart icon in header/footer
        // The Cart icon in QuantityControls might not be there 
        // Go to /cart directly or click floating action button
        // Using direct navigation for robustness
        await page.goto('/cart');

        // 5. Verify Item in Cart
        await expect(page.locator('text=Premium Water Bottle')).toBeVisible();
        await expect(page.locator('text=₹150')).toBeVisible();

        // 6. Verify Checkout Button is visible
        const checkoutBtn = page.getByRole('button', { name: /checkout/i }).first();
        await expect(checkoutBtn).toBeVisible();
    });
});
