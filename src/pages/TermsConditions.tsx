import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsConditions() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Terms & Conditions</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Acceptance of Terms</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>By accessing and using PremaShop, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Account Responsibilities</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>You must provide accurate and complete information when creating an account</li>
                            <li>You are responsible for maintaining the confidentiality of your account</li>
                            <li>You must notify us immediately of any unauthorized use</li>
                            <li>One account per person; accounts are non-transferable</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Orders & Delivery</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>All orders are subject to product availability</li>
                            <li>Prices are subject to change without notice</li>
                            <li>Delivery times are estimates and may vary</li>
                            <li>We reserve the right to refuse or cancel orders</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Limitation of Liability</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>PremaShop shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
