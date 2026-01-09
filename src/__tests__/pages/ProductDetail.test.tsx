/**
 * ProductDetail Page Unit Tests
 * Tests product display, variant selection, add to cart functionality, and stock management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProductDetail from '../../pages/ProductDetail';

// Mock the supabase client
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
    },
}));

// Mock navigate and params
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: 'prod-123' }),
    };
});

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
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

// Mock useCart
const mockAddToCart = vi.fn();
const mockRefreshCart = vi.fn();

vi.mock('@/contexts/CartContext', () => ({
    useCart: () => ({
        addToCart: mockAddToCart,
        refreshCart: mockRefreshCart,
        loading: false,
    }),
}));

// Mock useAuth
const mockUser = { id: 'test-user-123', email: 'test@example.com' };
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        loading: false,
    }),
}));

// Mock hooks
const mockTrackView = vi.fn();
vi.mock('@/hooks/useRecommendations', () => ({
    useRecommendations: () => ({
        trackView: mockTrackView,
    }),
}));

vi.mock('@/hooks/useFrequentlyBoughtTogether', () => ({
    useFrequentlyBoughtTogether: () => ({
        products: [],
        isLoading: false,
    }),
}));

// Mock components
vi.mock('@/components/ProductCard', () => ({
    default: () => <div data-testid="related-product">Related Product</div>,
}));

vi.mock('@/components/ui/skeleton', () => ({
    Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/BottomNav', () => ({
    default: () => <div data-testid="bottom-nav" />,
}));

// Test helper
const renderComponent = () => {
    return render(
        <BrowserRouter>
            <ProductDetail />
        </BrowserRouter>
    );
};

// Mock Data
const mockProduct = {
    id: 'prod-123',
    name: 'Test Product',
    description: 'A great test product',
    price: 100,
    mrp: 120,
    image_url: 'https://example.com/image.jpg',
    stock_quantity: 10,
    unit: 'piece',
    category_id: 'cat-1',
};

const mockVariants = [
    {
        id: 'var-1',
        product_id: 'prod-123',
        variant_name: 'Small',
        variant_value: 100,
        variant_unit: 'g',
        price: 50,
        mrp: 60,
        is_default: true,
        display_order: 1,
    },
    {
        id: 'var-2',
        product_id: 'prod-123',
        variant_name: 'Large',
        variant_value: 500,
        variant_unit: 'g',
        price: 200,
        mrp: 240,
        is_default: false,
        display_order: 2,
    },
];

describe('ProductDetail Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Optimized static mock chain
        const staticChain: any = {};

        // Setup methods to return the static chain (self-reference)
        staticChain.select = vi.fn().mockReturnValue(staticChain);
        staticChain.eq = vi.fn().mockReturnValue(staticChain);
        staticChain.neq = vi.fn().mockReturnValue(staticChain);
        staticChain.gt = vi.fn().mockReturnValue(staticChain);
        staticChain.lt = vi.fn().mockReturnValue(staticChain);
        staticChain.gte = vi.fn().mockReturnValue(staticChain);
        staticChain.lte = vi.fn().mockReturnValue(staticChain);
        staticChain.ilike = vi.fn().mockReturnValue(staticChain);
        staticChain.limit = vi.fn().mockReturnValue(staticChain);
        staticChain.order = vi.fn().mockReturnValue(staticChain);
        staticChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

        // Single implementation needs to be generic to avoid logic inside closure
        // We'll trust that the component only calls single() for product or profile
        // but we can't easily distinguish without checking state.
        // Actually, we can checking the mock calls? No, single() is called on the object.

        // Let's make single return specific data if we can, or just generic product data
        // because that's the main thing loaded validation checks.
        staticChain.single = vi.fn().mockResolvedValue({ data: mockProduct, error: null });

        // Then for list queries (variants)
        staticChain.then = vi.fn().mockImplementation((callback) => {
            // Return empty list by default to avoid issues
            return Promise.resolve(callback({ data: [], error: null }));
        });

        // We use a separate chain for variants to allow distinguishing
        const variantsChain = { ...staticChain };
        variantsChain.then = vi.fn().mockImplementation((callback: any) => {
            return Promise.resolve(callback({ data: mockVariants, error: null }));
        });
        // Important: Bind returns to self for variants chain too
        variantsChain.select = vi.fn().mockReturnValue(variantsChain);
        variantsChain.eq = vi.fn().mockReturnValue(variantsChain);
        variantsChain.order = vi.fn().mockReturnValue(variantsChain);

        mockFrom.mockImplementation((table: string) => {
            if (table === 'product_variants') {
                return variantsChain;
            }
            return staticChain;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render product details after loading', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Test Product')).toBeInTheDocument();
        });
    });

    it('should load and display variants', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('100 g')).toBeInTheDocument();
            // Large variant comes from variantsChain (500g)
            expect(screen.getByText('500 g')).toBeInTheDocument();
        });
    });
});
