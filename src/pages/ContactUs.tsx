import { ArrowLeft, Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactUs() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Contact Us</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-6 text-center">
                        <MessageCircle className="w-12 h-12 text-primary mx-auto mb-3" />
                        <h2 className="text-xl font-bold mb-2">We're here to help!</h2>
                        <p className="text-muted-foreground">Our support team is available to assist you with any questions or concerns.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Phone className="w-5 h-5" />
                            Phone Support
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <a href="tel:+919876543210" className="text-primary font-medium text-lg">
                            +91 98765 43210
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">For orders and delivery inquiries</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Email Support
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <a href="mailto:support@premashop.in" className="text-primary font-medium">
                            support@premashop.in
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">We respond within 24 hours</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Our Location
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="font-medium">PremaShop Headquarters</p>
                        <p className="text-muted-foreground">
                            Chandapura-Anekal Road<br />
                            Bangalore, Karnataka<br />
                            India - 562106
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Business Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Monday - Saturday</span>
                                <span className="font-medium">8:00 AM - 10:00 PM</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Sunday</span>
                                <span className="font-medium">9:00 AM - 9:00 PM</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
