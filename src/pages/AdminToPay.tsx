import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Smartphone, TrendingUp, Wallet, Truck, AlertCircle } from 'lucide-react';
import AdminBottomNav from '@/components/AdminBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import PaymentDialog from '@/components/PaymentDialog';
import { format } from 'date-fns';

interface PayoutStats {
  deliveredOrders: number;
  totalDeveloperCommission: number;
  paidDeveloperCommission: number;
  pendingDeveloper: number;
}

interface DeliveryPartnerStats {
  id: string; // user_id
  full_name: string;
  phone: string;
  deliveredOrders: number;
  totalCommission: number;
  paidCommission: number;
  pendingAmount: number;
}

const DEVELOPER_PHONE = '8310807978';
const DEVELOPER_UPI_ID = `${DEVELOPER_PHONE}@ybl`;

const AdminToPay = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PayoutStats>({
    deliveredOrders: 0,
    totalDeveloperCommission: 0,
    paidDeveloperCommission: 0,
    pendingDeveloper: 0
  });

  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerStats[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Payment Dialog State
  const [paymentState, setPaymentState] = useState<{
    open: boolean;
    upiId: string;
    payeeName: string;
    amount: number;
    payeeId: string | null; // null for developer
    type: 'developer_commission' | 'delivery_commission';
  }>({
    open: false,
    upiId: '',
    payeeName: '',
    amount: 0,
    payeeId: null,
    type: 'developer_commission'
  });

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      navigate('/shop');
      return;
    }

    fetchEverything();
  }, [user, userRole, loading, navigate]);

  const fetchEverything = async () => {
    setLoadingPage(true);
    setError(null);
    try {
      await Promise.all([fetchDeveloperStats(), fetchDeliveryPartnersStats()]);
    } catch (e) {
      logger.error('Failed to load payment data', { error: e });
      setError('Failed to load payment data. Please try again.');
    } finally {
      setLoadingPage(false);
    }
  };

  const fetchDeveloperStats = async () => {
    // 1. Get total orders delivered (lifetime)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'delivered');

    if (ordersError) throw ordersError;
    const count = orders?.length || 0;
    const totalCommission = count * 4; // ₹4 per order

    // 2. Get total APPROVED only (pending payments shouldn't reduce pending amount)
    const { data: payouts, error: payoutsError } = await supabase
      .from('payouts' as any)
      .select('amount, status')
      .eq('type', 'developer_commission')
      .eq('status', 'approved'); // Only count approved as paid

    if (payoutsError) console.warn('Developer payout error', payoutsError);
    const approvedAmount = payouts?.reduce((sum, p) => sum + (Number((p as any).amount) || 0), 0) || 0;

    setStats({
      deliveredOrders: count,
      totalDeveloperCommission: totalCommission,
      paidDeveloperCommission: approvedAmount,
      pendingDeveloper: Math.max(0, totalCommission - approvedAmount)
    });
  };

  const fetchDeliveryPartnersStats = async () => {
    // 1. Get all delivery users
    const { data: deliveryUsers, error: userError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'delivery');

    if (userError || !deliveryUsers) return;

    // 2. Get profiles for names/phones
    const userIds = deliveryUsers.map(u => u.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds);

    if (!profiles) return;

    const partners: DeliveryPartnerStats[] = [];

    // 3. For each partner, calculate stats
    for (const profile of profiles) {
      try {
        // Get assignments
        const { data: assignments } = await supabase
          .from('delivery_assignments')
          .select('order_id, orders!inner(status)')
          .eq('delivery_person_id', profile.id)
          .eq('orders.status', 'delivered');

        const deliveredCount = assignments?.length || 0;
        const totalComm = deliveredCount * 5; // ₹5 per order

        // Get payouts - only count APPROVED as paid
        const { data: payouts, error: payoutError } = await supabase
          .from('payouts' as any)
          .select('amount')
          .eq('payee_id', profile.id)
          .eq('type', 'delivery_commission')
          .eq('status', 'approved'); // Only count approved

        if (payoutError) console.warn('Payout fetch error', payoutError);

        const approvedAmt = payouts?.reduce((sum, p) => sum + (Number((p as any).amount) || 0), 0) || 0;
        const pending = Math.max(0, totalComm - approvedAmt);

        partners.push({
          id: profile.id,
          full_name: profile.full_name || 'Delivery Partner',
          phone: profile.phone || '',
          deliveredOrders: deliveredCount,
          totalCommission: totalComm,
          paidCommission: approvedAmt,
          pendingAmount: pending
        });
      } catch (err) {
        logger.error(`Failed to calc stats for ${profile.id}`, { error: err });
      }
    }

    setDeliveryPartners(partners);
  };

  const initiatePayment = (
    payeeId: string | null,
    name: string,
    phone: string | null,
    amount: number,
    type: 'developer_commission' | 'delivery_commission'
  ) => {
    if (amount <= 0) {
      toast.success('No pending payment!');
      return;
    }

    const upiId = payeeId === null ? DEVELOPER_UPI_ID : `${phone}@upi`; // Default assumption if no VPA stored

    setPaymentState({
      open: true,
      upiId,
      payeeName: name,
      amount,
      payeeId,
      type
    });
  };

  const handlePaymentConfirmed = async () => {
    // Prevent double submission
    if (paymentSubmitting) return;
    setPaymentSubmitting(true);

    try {
      const { error } = await supabase.from('payouts' as any).insert({
        payer_id: user?.id,
        payee_id: paymentState.payeeId, // null for developer
        amount: paymentState.amount,
        status: 'pending', // Waiting for receiver to approve
        type: paymentState.type
      });

      if (error) throw error;

      toast.success('Payment recorded! Waiting for approval.');
      setPaymentState(prev => ({ ...prev, open: false }));

      // Refresh stats
      fetchEverything();
    } catch (e) {
      toast.error('Failed to record payment');
      logger.error('Payment insert error', { error: e });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (loading || userRole === null || loadingPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
        {/* Loading Skeleton */}
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
          <div className="container mx-auto px-4 py-4"><Skeleton className="h-8 w-48" /></div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </main>
        <AdminBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-24">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Daily Payouts</h1>
              <p className="text-xs text-muted-foreground">{format(new Date(), 'MMM dd, yyyy')}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Error Display */}
        {error && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchEverything}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* Developer Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1">Platform Fees</h2>
          <Card className="border-indigo-500/20 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Developer</h3>
                    <p className="text-xs text-muted-foreground">Commission (₹4/order)</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">
                    ₹{stats.pendingDeveloper.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Pending</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-muted/40 p-3 rounded-lg">
                <div>
                  <p className="text-muted-foreground">Total Earned</p>
                  <p className="font-semibold">₹{stats.totalDeveloperCommission}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Total Paid</p>
                  <p className="font-semibold text-green-600">₹{stats.paidDeveloperCommission}</p>
                </div>
              </div>

              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                size="lg"
                disabled={stats.pendingDeveloper <= 0}
                onClick={() => initiatePayment(null, 'Developer', DEVELOPER_PHONE, stats.pendingDeveloper, 'developer_commission')}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Pay Remainder
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Delivery Partners</h2>
            <span className="text-xs bg-muted px-2 py-1 rounded-full">{deliveryPartners.length} Active</span>
          </div>

          {deliveryPartners.map(partner => (
            <Card key={partner.id} className="border-rose-500/20 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-500"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <Truck className="h-5 w-5 text-rose-600" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-lg truncate w-32 md:w-auto">{partner.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{partner.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-rose-600">
                      ₹{partner.pendingAmount.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Due Today</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-muted/40 p-3 rounded-lg">
                  <div>
                    <p className="text-muted-foreground">Orders</p>
                    <p className="font-semibold">{partner.deliveredOrders}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Paid So Far</p>
                    <p className="font-semibold text-green-600">₹{partner.paidCommission}</p>
                  </div>
                </div>

                <Button
                  className="w-full bg-rose-600 hover:bg-rose-700"
                  size="lg"
                  disabled={partner.pendingAmount <= 0}
                  onClick={() => initiatePayment(partner.id, partner.full_name, partner.phone, partner.pendingAmount, 'delivery_commission')}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay Partner
                </Button>
              </CardContent>
            </Card>
          ))}

          {deliveryPartners.length === 0 && (
            <div className="text-center py-8 bg-muted/20 rounded-xl">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">No active delivery partners found.</p>
            </div>
          )}
        </div>
      </main>

      <AdminBottomNav />

      <PaymentDialog
        open={paymentState.open}
        onOpenChange={(val) => setPaymentState(prev => ({ ...prev, open: val }))}
        upiId={paymentState.upiId}
        payeeName={paymentState.payeeName}
        amount={paymentState.amount}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </div>
  );
};

export default AdminToPay;
