import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Privacy Policy</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Information We Collect</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>We collect information you provide directly to us, such as when you create an account, place an order, or contact us for support.</p>
                        <ul>
                            <li><strong>Account Information:</strong> Name, email, phone number, and delivery address</li>
                            <li><strong>Order Information:</strong> Products purchased, payment method, delivery preferences</li>
                            <li><strong>Device Information:</strong> Browser type, IP address, device identifiers</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">How We Use Your Information</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Process and deliver your orders</li>
                            <li>Send order updates and delivery notifications</li>
                            <li>Improve our services and user experience</li>
                            <li>Respond to your questions and concerns</li>
                            <li>Prevent fraud and ensure security</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Data Security</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>We implement appropriate security measures to protect your personal information. Your data is encrypted in transit and at rest using industry-standard protocols.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Contact Us</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>If you have questions about this Privacy Policy, please contact us at:</p>
                        <p><strong>Email:</strong> support@premashop.in</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
