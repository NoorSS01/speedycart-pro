import { Package, ShoppingCart, ClipboardList, Inbox, Search, Truck, Users, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    type?: 'orders' | 'cart' | 'products' | 'search' | 'delivery' | 'users' | 'general';
    title?: string;
    description?: string;
    className?: string;
    action?: React.ReactNode;
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

export default function EmptyState({
    type = 'general',
    title,
    description,
    className,
    action
}: EmptyStateProps) {
    const Icon = iconMap[type] || Inbox;
    const messages = defaultMessages[type] || defaultMessages.general;

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-4 text-center",
            className
        )}>
            {/* Icon with animated background */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full blur-xl scale-150" />
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
