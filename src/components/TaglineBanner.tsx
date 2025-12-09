import { Zap } from 'lucide-react';

export default function TaglineBanner() {
    return (
        <div className="w-full bg-primary/10 border-b border-primary/20">
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4 text-primary fill-primary" />
                    <span className="text-sm font-medium text-primary">
                        Rapid Delivery in 14 mins
                    </span>
                </div>
            </div>
        </div>
    );
}
