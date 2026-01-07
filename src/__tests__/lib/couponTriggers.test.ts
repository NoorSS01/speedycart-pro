/**
 * Coupon Triggers Unit Tests
 * Tests coupon code generation and validation logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client before importing the module
const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Import after mocking
import {
    checkNewUserTrigger,
    checkInactivityTrigger,
    checkLoyaltyTrigger,
    getUserTriggeredCoupons,
    validateTriggeredCoupon,
    applyTriggeredCoupon,
    checkAllTriggers,
} from '@/lib/couponTriggers';

describe('Coupon Triggers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkNewUserTrigger', () => {
        it('should return null if user has existing orders', async () => {
            // Mock: user has orders
            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({
                            data: [{ id: 'order-1' }],
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                };
            });

            const result = await checkNewUserTrigger('user-123');
            expect(result).toBeNull();
        });

        it('should return null if user already has new_user coupon', async () => {
            // Mock: no orders, but has existing coupon
            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }
                if (table === 'user_triggered_coupons') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        contains: vi.fn().mockResolvedValue({
                            data: [{ id: 'existing-coupon' }],
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                };
            });

            const result = await checkNewUserTrigger('user-123');
            expect(result).toBeNull();
        });
    });

    describe('checkInactivityTrigger', () => {
        it('should return null if user has no orders', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                };
            });

            const result = await checkInactivityTrigger('user-123');
            expect(result).toBeNull();
        });

        it('should return null if no active inactivity triggers exist', async () => {
            const lastOrderDate = new Date();
            lastOrderDate.setDate(lastOrderDate.getDate() - 10); // 10 days ago

            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({
                            data: [{ created_at: lastOrderDate.toISOString() }],
                            error: null,
                        }),
                    };
                }
                if (table === 'coupon_triggers') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                };
            });

            const result = await checkInactivityTrigger('user-123');
            expect(result).toBeNull();
        });
    });

    describe('checkLoyaltyTrigger', () => {
        it('should return null if user has no delivered orders', async () => {
            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                };
            });

            const result = await checkLoyaltyTrigger('user-123');
            expect(result).toBeNull();
        });
    });

    describe('getUserTriggeredCoupons', () => {
        it('should return empty array when user has no coupons', async () => {
            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            }));

            const result = await getUserTriggeredCoupons('user-123');
            expect(result).toEqual([]);
        });

        it('should return valid coupons for user', async () => {
            const mockCoupons = [
                {
                    id: 'coupon-1',
                    coupon_code: 'SAVE10',
                    discount_type: 'percentage',
                    discount_value: 10,
                    min_order_amount: 100,
                    max_discount: 50,
                    valid_until: new Date(Date.now() + 86400000).toISOString(),
                    is_used: false,
                },
            ];

            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                    data: mockCoupons,
                    error: null,
                }),
            }));

            const result = await getUserTriggeredCoupons('user-123');
            expect(result).toHaveLength(1);
            expect(result[0].coupon_code).toBe('SAVE10');
        });
    });

    describe('validateTriggeredCoupon', () => {
        it('should return null for invalid coupon code', async () => {
            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'Not found' },
                }),
            }));

            const result = await validateTriggeredCoupon('user-123', 'INVALID');
            expect(result).toBeNull();
        });

        it('should return coupon data for valid code', async () => {
            const mockCoupon = {
                id: 'coupon-1',
                coupon_code: 'SAVE20',
                discount_type: 'percentage',
                discount_value: 20,
                min_order_amount: 200,
                max_discount: 100,
                valid_until: new Date(Date.now() + 86400000).toISOString(),
                is_used: false,
            };

            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: mockCoupon,
                    error: null,
                }),
            }));

            const result = await validateTriggeredCoupon('user-123', 'SAVE20');
            expect(result).not.toBeNull();
            expect(result?.coupon_code).toBe('SAVE20');
            expect(result?.discount_value).toBe(20);
        });

        it('should uppercase the coupon code for comparison', async () => {
            mockFrom.mockImplementation(() => ({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn((column: string, value: string) => {
                    // Verify uppercase conversion
                    if (column === 'coupon_code') {
                        expect(value).toBe('SAVE20');
                    }
                    return {
                        eq: vi.fn().mockReturnThis(),
                        gte: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }),
            }));

            await validateTriggeredCoupon('user-123', 'save20');
        });
    });

    describe('applyTriggeredCoupon', () => {
        it('should return true on successful application', async () => {
            mockFrom.mockImplementation(() => ({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                    error: null,
                }),
            }));

            const result = await applyTriggeredCoupon('coupon-123', 'order-456');
            expect(result).toBe(true);
        });

        it('should return false on error', async () => {
            mockFrom.mockImplementation(() => ({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockResolvedValue({
                    error: { message: 'Update failed' },
                }),
            }));

            const result = await applyTriggeredCoupon('coupon-123', 'order-456');
            expect(result).toBe(false);
        });
    });

    describe('checkAllTriggers', () => {
        it('should check all trigger types', async () => {
            // Mock all triggers return null
            mockFrom.mockImplementation((table: string) => {
                if (table === 'orders') {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockResolvedValue({
                            data: [{ id: 'order-1' }], // Has orders, so new user = null
                            error: null,
                        }),
                    };
                }
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            });

            const result = await checkAllTriggers('user-123');
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
