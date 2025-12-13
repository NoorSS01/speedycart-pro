import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Smartphone, TrendingUp, ShoppingBag, Wallet, Truck } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';

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

    if (userRole === null) return;

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

    if (rolesError || !rolesData || rolesData.length === 0) return;

    const userIds = rolesData.map((r) => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds);

    if (profilesData && profilesData.length > 0) {
      const first = profilesData[0];
      setDeliveryProfile({ full_name: first.full_name, phone: first.phone });
    }
  };

  const createUpiLink = (upiId: string, name: string, amount: number) => {
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('PremasShop payout')}`;
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

  if (loading || userRole === null || loadingPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </main>
        <AdminBottomNav />
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'super_admin') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
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

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Developer Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Developer Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount to Pay</p>
                <p className="text-3xl font-bold">₹{stats.commissionDeveloper}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{stats.deliveredOrders} orders</p>
                <p>₹4/order</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Pay to: {DEVELOPER_PHONE}</p>
            <Button className="w-full" onClick={() => setShowDeveloperPayOptions(true)}>
              <Smartphone className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </CardContent>
        </Card>

        {/* Delivery Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-rose-500" />
              Delivery Partner Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount to Pay</p>
                <p className="text-3xl font-bold">₹{stats.commissionDelivery}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{stats.deliveredOrders} orders</p>
                <p>₹5/order</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {deliveryProfile?.phone
                ? `Pay to: ${deliveryProfile.full_name || 'Partner'} (${deliveryProfile.phone})`
                : 'No delivery partner found'}
            </p>
            <Button
              className="w-full"
              onClick={() => setShowDeliveryPayOptions(true)}
              disabled={!deliveryProfile?.phone}
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Developer Pay Modal */}
      {showDeveloperPayOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border">
            <h2 className="text-lg font-bold">Pay Developer</h2>
            <p className="text-sm text-muted-foreground">Amount: ₹{stats.commissionDeveloper}</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => { handlePayDeveloper(); setShowDeveloperPayOptions(false); }}>
                GPay
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => { handlePayDeveloper(); setShowDeveloperPayOptions(false); }}>
                PhonePe
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setShowDeveloperPayOptions(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Delivery Pay Modal */}
      {showDeliveryPayOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border">
            <h2 className="text-lg font-bold">Pay Delivery Partner</h2>
            <p className="text-sm text-muted-foreground">Amount: ₹{stats.commissionDelivery}</p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => { handlePayDelivery(); setShowDeliveryPayOptions(false); }}>
                GPay
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => { handlePayDelivery(); setShowDeliveryPayOptions(false); }}>
                PhonePe
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setShowDeliveryPayOptions(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <AdminBottomNav />
    </div>
  );
};

export default AdminToPay;
