import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Clock, MapPin, Package } from 'lucide-react';

export default function ShippingPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Shipping & Delivery</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <Truck className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-lg">Free Delivery</p>
                                <p className="text-sm text-muted-foreground">On all orders</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Delivery Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Standard delivery: 15-30 minutes</li>
                            <li>Peak hours may have slightly longer delivery times</li>
                            <li>Delivery partners will contact you before arrival</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Delivery Area
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>We currently deliver to:</p>
                        <ul>
                            <li>VBHC Vaibhava, Chandapura-Anekal Road</li>
                            <li>Symphony, Chandapura-Anekal Road</li>
                            <li>Surrounding areas within 5km radius</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Delivery Instructions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li>Ensure someone is available to receive the order</li>
                            <li>Keep your phone accessible for delivery partner calls</li>
                            <li>Verify products at the time of delivery</li>
                            <li>Report any issues immediately to our support</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
