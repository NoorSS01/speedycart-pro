import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RefundPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Refund & Return Policy</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Cancellation Policy</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Orders can be cancelled before confirmation</li>
                            <li>Once order is out for delivery, cancellation is not possible</li>
                            <li>Cancellation requests can be made through the app or by contacting support</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Return Policy</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Returns accepted within 24 hours of delivery</li>
                            <li>Products must be unused and in original packaging</li>
                            <li>Perishable items cannot be returned unless damaged/spoiled</li>
                            <li>Report damaged/incorrect items immediately upon delivery</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Refund Process</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Refunds processed within 5-7 business days</li>
                            <li>Amount credited to original payment method</li>
                            <li>For damaged items, full refund or replacement provided</li>
                            <li>Partial refunds for partially incorrect orders</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Non-Refundable Items</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Opened or used products</li>
                            <li>Products without original packaging</li>
                            <li>Items reported after 24 hours of delivery</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
