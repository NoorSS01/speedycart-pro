-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payer_id UUID REFERENCES auth.users(id),
  payee_id UUID REFERENCES auth.users(id), -- Null for Developer (Global) or specific User ID
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  type TEXT NOT NULL CHECK (type IN ('developer_commission', 'delivery_commission')),
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Policies

-- Admin can see all payouts they made
CREATE POLICY "Admins can view their payouts" 
  ON public.payouts FOR SELECT 
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Admin can insert payouts (when they pay)
CREATE POLICY "Admins can create payouts" 
  ON public.payouts FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Payees (Delivery) can view their own payouts
CREATE POLICY "Payees can view their received payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = payee_id OR (payee_id IS NULL AND has_role(auth.uid(), 'super_admin')));

-- Payees can update status (Approve/Reject)
CREATE POLICY "Payees can update their payout status"
  ON public.payouts FOR UPDATE
  USING (auth.uid() = payee_id OR (payee_id IS NULL AND has_role(auth.uid(), 'super_admin')));

-- Add update trigger
CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
