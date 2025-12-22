import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GrievancePolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-8">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Grievance Redressal</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">How to File a Complaint</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>If you have a complaint or concern about our products or services, you can reach out to us through:</p>
                        <ul>
                            <li>Email: grievance@premashop.in</li>
                            <li>Phone: +91 98765 43210</li>
                            <li>In-app support chat</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Resolution Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <ul>
                            <li><strong>Acknowledgement:</strong> Within 24 hours of receiving your complaint</li>
                            <li><strong>Initial Response:</strong> Within 48 hours</li>
                            <li><strong>Resolution:</strong> Within 7 working days for standard issues</li>
                            <li><strong>Complex Cases:</strong> Up to 15 working days with regular updates</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Grievance Officer</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p><strong>Name:</strong> Grievance Officer</p>
                        <p><strong>Email:</strong> grievance@premashop.in</p>
                        <p><strong>Address:</strong> Chandapura-Anekal Road, Bangalore - 562106</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            The Grievance Officer shall endeavor to address your concerns and provide you with a resolution in a timely manner.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Escalation Process</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-sm dark:prose-invert">
                        <p>If you are not satisfied with the resolution provided, you may escalate your complaint to our senior management by writing to escalation@premashop.in within 7 days of receiving the initial resolution.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
