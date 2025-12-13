import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Smartphone, TrendingUp, ShoppingBag, Wallet } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
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
      // Revenue calculation not strictly needed here but good for verification if wanted
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

  if (loading || userRole === null || loadingPage) {
    return (
      <AdminLayout title="Pending Payments">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </AdminLayout>
    );
  }

  // Don't render if not admin
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return null;
  }

  return (
    <AdminLayout title="Pending Payments">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Developer (Website Builder)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{stats.commissionDeveloper.toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Orders: {stats.deliveredOrders}</span>
              <span>To: {DEVELOPER_PHONE}</span>
            </div>
            <div className="mt-3">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20" onClick={() => setShowDeveloperPayOptions(true)}>
                <Smartphone className="h-4 w-4 mr-2" />
                Pay Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-500" />
              Delivery Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{stats.commissionDelivery.toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Orders: {stats.deliveredOrders}</span>
              <span className="truncate max-w-[150px]">
                {deliveryProfile?.phone
                  ? `${deliveryProfile.full_name || 'Partner'}`
                  : 'No Partner'}
              </span>
            </div>
            <div className="mt-3">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                onClick={() => setShowDeliveryPayOptions(true)}
                disabled={!deliveryProfile?.phone}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Pay Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Developer pay options popup */}
      {showDeveloperPayOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pay Developer</h2>
            <p className="text-sm text-muted-foreground">Select payment method for ₹{stats.commissionDeveloper.toFixed(2)}</p>
            <div className="flex gap-3 mt-2">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  handlePayDeveloper();
                  setShowDeveloperPayOptions(false);
                }}
              >
                GPay
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pay Delivery Partner</h2>
            <p className="text-sm text-muted-foreground">Select payment method for ₹{stats.commissionDelivery.toFixed(2)}</p>
            <div className="flex gap-3 mt-2">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  handlePayDelivery();
                  setShowDeliveryPayOptions(false);
                }}
                disabled={!deliveryProfile?.phone}
              >
                GPay
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
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
    </AdminLayout>
  );
};

export default AdminToPay;
