import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentTerms() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Payment Terms</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Accepted Payment Methods</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Cash on Delivery (COD)</li>
                            <li>UPI Payments</li>
                            <li>Credit/Debit Cards</li>
                            <li>Net Banking</li>
                            <li>Digital Wallets</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Payment Security</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>All online payments are processed through secure payment gateways with 256-bit encryption. We do not store your card details on our servers.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Pricing</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>All prices are in Indian Rupees (INR)</li>
                            <li>Prices include applicable taxes unless stated otherwise</li>
                            <li>Promotional pricing is subject to availability</li>
                            <li>We reserve the right to modify prices without notice</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Payment Disputes</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>For any payment-related disputes or issues, please contact our support team within 48 hours of the transaction. We will investigate and resolve the issue promptly.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
