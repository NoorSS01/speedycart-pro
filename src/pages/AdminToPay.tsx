import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Smartphone, TrendingUp, ShoppingBag, Wallet } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';

interface PayoutStats {
  deliveredOrders: number;
  commissionDeveloper: number;
  commissionDelivery: number;
}

interface DeliveryProfile {
  full_name: string | null;
  phone: string | null;
}

const DEVELOPER_PHONE = '8310807978';
const DEVELOPER_UPI_ID = `${DEVELOPER_PHONE}@ybl`;

const AdminToPay = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PayoutStats>({
    deliveredOrders: 0,
    commissionDeveloper: 0,
    commissionDelivery: 0,
  });
  const [deliveryProfile, setDeliveryProfile] = useState<DeliveryProfile | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [showDeveloperPayOptions, setShowDeveloperPayOptions] = useState(false);
  const [showDeliveryPayOptions, setShowDeliveryPayOptions] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // Wait for userRole to be loaded
    if (userRole === null) return;

    // Redirect non-admins
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      switch (userRole) {
        case 'delivery':
          navigate('/delivery');
          break;
        default:
          navigate('/shop');
          break;
      }
      return;
    }

    const init = async () => {
      try {
        await Promise.all([fetchPayoutStats(), fetchFirstDeliveryProfile()]);
      } finally {
        setLoadingPage(false);
      }
    };

    init();
  }, [user, userRole, loading, navigate]);

  const fetchPayoutStats = async () => {
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('status, total_amount');

    if (error) {
      console.error('Error fetching payout stats', error);
      toast.error('Failed to load payout details');
      return;
    }

    if (ordersData) {
      const deliveredOrders = ordersData.filter((o) => o.status === 'delivered').length;
      const revenue = ordersData
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + Number(o.total_amount), 0);

      const commissionDeveloper = deliveredOrders * 4;
      const commissionDelivery = deliveredOrders * 5;

      setStats({ deliveredOrders, commissionDeveloper, commissionDelivery });
    }
  };

  const fetchFirstDeliveryProfile = async () => {
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery');

    if (rolesError) {
      console.error('Error fetching delivery roles', rolesError);
      return;
    }

    if (!rolesData || rolesData.length === 0) return;

    const userIds = rolesData.map((r) => r.user_id);

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching delivery profiles', profilesError);
      return;
    }

    if (profilesData && profilesData.length > 0) {
      const first = profilesData[0];
      setDeliveryProfile({ full_name: first.full_name, phone: first.phone });
    }
  };

  const createUpiLink = (upiId: string, name: string, amount: number) => {
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(
      2
    )}&cu=INR&tn=${encodeURIComponent('PremasShop payout')}`;
  };

  const openUpiLink = (url: string) => {
    window.location.href = url;
  };

  const handlePayDeveloper = () => {
    if (stats.commissionDeveloper <= 0) {
      toast.message('No payout pending for developer');
      return;
    }

    const url = createUpiLink(DEVELOPER_UPI_ID, 'Developer', stats.commissionDeveloper);
    openUpiLink(url);
  };

  const handlePayDelivery = () => {
    if (stats.commissionDelivery <= 0) {
      toast.message('No payout pending for delivery partners');
      return;
    }

    if (!deliveryProfile || !deliveryProfile.phone) {
      toast.error('No delivery partner phone available');
      return;
    }

    const upiId = `${deliveryProfile.phone}@upi`;
    const name = deliveryProfile.full_name || 'Delivery Partner';
    const url = createUpiLink(upiId, name, stats.commissionDelivery);
    openUpiLink(url);
  };

  // Show loading while checking auth
  if (loading || userRole === null || loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="flex flex-col items-center gap-3">
          <Wallet className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-[0_10px_40px_rgba(15,23,42,0.35)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pending Payments</h1>
              <p className="text-xs text-muted-foreground">Manage commission payouts</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Developer (Website Builder)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount to Pay</p>
                  <p className="text-2xl font-bold text-foreground">₹{stats.commissionDeveloper.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Orders: {stats.deliveredOrders}</p>
              <p className="text-xs text-muted-foreground">Pay to: {DEVELOPER_PHONE}</p>
              <div className="mt-3">
                <Button className="w-full" onClick={() => setShowDeveloperPayOptions(true)}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Partner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount to Pay</p>
                  <p className="text-2xl font-bold text-foreground">₹{stats.commissionDelivery.toFixed(2)}</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Orders: {stats.deliveredOrders}</p>
              <p className="text-xs text-muted-foreground">
                {deliveryProfile?.phone
                  ? `Pay to: ${deliveryProfile.full_name || 'Delivery Partner'} (${deliveryProfile.phone})`
                  : 'No delivery partner phone found'}
              </p>
              <div className="mt-3">
                <Button
                  className="w-full"
                  onClick={() => setShowDeliveryPayOptions(true)}
                  disabled={!deliveryProfile?.phone}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Developer pay options popup */}
      {showDeveloperPayOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-lg p-4 w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Pay Developer</h2>
            <p className="text-sm text-muted-foreground">Choose payment app</p>
            <div className="flex gap-2 mt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  handlePayDeveloper();
                  setShowDeveloperPayOptions(false);
                }}
              >
                GPay
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handlePayDeveloper();
                  setShowDeveloperPayOptions(false);
                }}
              >
                PhonePe
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setShowDeveloperPayOptions(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Delivery pay options popup */}
      {showDeliveryPayOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-lg p-4 w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Pay Delivery Partner</h2>
            <p className="text-sm text-muted-foreground">Choose payment app</p>
            <div className="flex gap-2 mt-2">
              <Button
                className="flex-1"
                onClick={() => {
                  handlePayDelivery();
                  setShowDeliveryPayOptions(false);
                }}
                disabled={!deliveryProfile?.phone}
              >
                GPay
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handlePayDelivery();
                  setShowDeliveryPayOptions(false);
                }}
                disabled={!deliveryProfile?.phone}
              >
                PhonePe
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setShowDeliveryPayOptions(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Admin Bottom Navigation */}
      <AdminBottomNav />
    </div>
  );
};

export default AdminToPay;
