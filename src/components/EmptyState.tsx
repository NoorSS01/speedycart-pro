import { Package, ShoppingCart, ClipboardList, Inbox, Search, Truck, Users, Snowflake, Sun, CloudRain, Flower } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface EmptyStateProps {
    type?: 'orders' | 'cart' | 'products' | 'search' | 'delivery' | 'users' | 'general';
    title?: string;
    description?: string;
    className?: string;
    action?: React.ReactNode;
    /** If true, show seasonal theming when a theme is active */
    seasonal?: boolean;
}

const iconMap = {
    orders: ClipboardList,
    cart: ShoppingCart,
    products: Package,
    search: Search,
    delivery: Truck,
    users: Users,
    general: Inbox,
};

const defaultMessages = {
    orders: { title: 'No orders yet', description: 'Your orders will appear here once you place them' },
    cart: { title: 'Your cart is empty', description: 'Add items to get started' },
    products: { title: 'No products found', description: 'Try adjusting your filters or search' },
    search: { title: 'No results found', description: 'Try a different search term' },
    delivery: { title: 'No deliveries', description: 'Assigned deliveries will appear here' },
    users: { title: 'No users found', description: 'Users will appear here' },
    general: { title: 'Nothing here', description: 'No items to display' },
};

// Seasonal message variants - used when theme is active and seasonal=true
const seasonalMessages: Record<string, Record<string, { title: string; description: string; icon?: React.ElementType }>> = {
    'Winter Wonderland': {
        cart: { title: 'Your cart is as empty as fresh snow! ❄️', description: 'Add some cozy winter favorites', icon: Snowflake },
        products: { title: 'No products in this winter aisle', description: 'Check back for seasonal specials!' },
        search: { title: 'Nothing found... like searching for summer! 🌨️', description: 'Try a different search term' },
        orders: { title: 'No winter orders yet', description: 'Warm up your day with some shopping!' },
        general: { title: 'Snow problem here!', description: 'Nothing to display at the moment' },
    },
    'Summer Vibes': {
        cart: { title: 'Your cart is sun-kissed empty! ☀️', description: 'Add some summer essentials', icon: Sun },
        products: { title: 'Beach is clear of products', description: 'Surf over to another category!' },
        search: { title: 'No catch in these waters 🏖️', description: 'Try different search terms' },
        orders: { title: 'No summer orders yet', description: 'Beat the heat with some shopping!' },
        general: { title: 'Clear skies here!', description: 'Nothing to show right now' },
    },
    'Monsoon Magic': {
        cart: { title: 'Your cart is dry! 🌧️', description: 'Fill it up before the next shower', icon: CloudRain },
        products: { title: 'Products taking shelter from the rain', description: 'Check again soon!' },
        search: { title: 'Nothing surfaced in this storm 🌊', description: 'Try a splash of different words' },
        orders: { title: 'No monsoon orders yet', description: 'Rain or shine, we deliver!' },
        general: { title: 'Calm before the rain', description: 'Nothing here yet' },
    },
    'Spring Bloom': {
        cart: { title: 'Your cart hasn\'t bloomed yet! 🌸', description: 'Plant some products to watch it grow', icon: Flower },
        products: { title: 'This garden is waiting to bloom', description: 'New products sprouting soon!' },
        search: { title: 'No flowers found in this bed 🌷', description: 'Try searching for something else' },
        orders: { title: 'No spring orders yet', description: 'Fresh orders are just a click away!' },
        general: { title: 'Fresh as spring!', description: 'Nothing to display just yet' },
    },
};

export default function EmptyState({
    type = 'general',
    title,
    description,
    className,
    action,
    seasonal = true,
}: EmptyStateProps) {
    const { theme } = useTheme();

    // Determine which messages to use
    let messages = defaultMessages[type] || defaultMessages.general;
    let SeasonalIcon: React.ElementType | undefined;

    // Check for seasonal theming - access theme name from metadata
    const themeName = theme?.metadata?.name;
    if (seasonal && themeName) {
        const seasonalVariant = seasonalMessages[themeName];
        if (seasonalVariant && seasonalVariant[type]) {
            messages = { ...messages, ...seasonalVariant[type] };
            SeasonalIcon = seasonalVariant[type].icon;
        }
    }

    const Icon = SeasonalIcon || iconMap[type] || Inbox;

    // Get theme-aware gradient colors
    const gradientFrom = theme ? 'from-primary/20' : 'from-primary/20';
    const gradientTo = theme ? 'to-primary/5' : 'to-primary/5';

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-4 text-center",
            className
        )}>
            {/* Icon with animated background */}
            <div className="relative mb-6">
                <div className={cn(
                    "absolute inset-0 rounded-full blur-xl scale-150 transition-colors duration-500",
                    `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
                )} />
                <div className="relative w-20 h-20 rounded-full bg-muted/80 flex items-center justify-center ring-4 ring-background shadow-lg">
                    <Icon className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
                </div>
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-foreground mb-2">
                {title || messages.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
                {description || messages.description}
            </p>

            {/* Optional action button */}
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
}

/**
 * Inline empty state for smaller sections (like card content)
 */
export function EmptyStateInline({
    icon: CustomIcon,
    text,
    className
}: {
    icon?: React.ElementType;
    text: string;
    className?: string;
}) {
    const Icon = CustomIcon || Inbox;

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-8 text-center",
            className
        )}>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Icon className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

