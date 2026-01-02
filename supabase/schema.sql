-- PremasShop - Supabase schema
-- Copy everything in this file and run it in the SQL editor of your Supabase project.

-- =============================
-- Base enums, tables, RLS, triggers
-- From migration: 20251122091459_7dee6f9b-a967-4e52-932b-84e0f5197546.sql
-- =============================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles (idempotent)
DO $$
BEGIN
  CREATE TYPE app_role AS ENUM ('user', 'admin', 'delivery', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create enum for order status (idempotent)
DO $$
BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  full_name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  stock_quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'piece',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cart_items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_address TEXT NOT NULL,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delivery_assignments table
CREATE TABLE delivery_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  delivery_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  marked_delivered_at TIMESTAMPTZ,
  user_confirmed_at TIMESTAMPTZ,
  is_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT
);

-- Create malicious_activities table
CREATE TABLE malicious_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE malicious_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON user_roles FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can manage roles" ON user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for categories
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for products
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- RLS Policies for cart_items
CREATE POLICY "Users can view their own cart" ON cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own cart" ON cart_items FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Delivery persons can view assigned orders" ON orders FOR SELECT USING (
  has_role(auth.uid(), 'delivery') AND 
  EXISTS (SELECT 1 FROM delivery_assignments WHERE order_id = orders.id AND delivery_person_id = auth.uid())
);

-- RLS Policies for order_items
CREATE POLICY "Users can view their order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admins can view all order items" ON order_items FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can create order items for their orders" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- RLS Policies for delivery_assignments
CREATE POLICY "Delivery persons can view their assignments" ON delivery_assignments FOR SELECT USING (auth.uid() = delivery_person_id);
CREATE POLICY "Delivery persons can update their assignments" ON delivery_assignments FOR UPDATE USING (auth.uid() = delivery_person_id);
CREATE POLICY "Admins can manage all assignments" ON delivery_assignments FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view their order assignments" ON delivery_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = delivery_assignments.order_id AND orders.user_id = auth.uid())
);

-- Allow order owners (customers) to update their own assignments (e.g. confirm / reject delivery)
DROP POLICY IF EXISTS "Order owners can update their assignments" ON delivery_assignments;
CREATE POLICY "Order owners can update their assignments"
ON delivery_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = delivery_assignments.order_id 
      AND orders.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = delivery_assignments.order_id 
      AND orders.user_id = auth.uid()
  )
);

-- RLS Policies for malicious_activities
CREATE POLICY "Admins can view all malicious activities" ON malicious_activities FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "System can insert malicious activities" ON malicious_activities FOR INSERT WITH CHECK (true);

-- Function to auto-assign a random delivery person when an order is created
-- Only assigns to delivery partners with approved activation for today
CREATE OR REPLACE FUNCTION public.auto_assign_delivery_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_person_id uuid;
BEGIN
  -- Pick a random delivery user who has approved activation for today
  SELECT ur.user_id
  INTO v_delivery_person_id
  FROM user_roles ur
  INNER JOIN delivery_activations da 
    ON da.delivery_partner_id = ur.user_id
    AND da.activation_date = CURRENT_DATE
    AND da.status = 'approved'
  WHERE ur.role = 'delivery'
  ORDER BY random()
  LIMIT 1;

  -- If we found an active delivery person, create the assignment
  IF v_delivery_person_id IS NOT NULL THEN
    INSERT INTO delivery_assignments (order_id, delivery_person_id)
    VALUES (NEW.id, v_delivery_person_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to call the auto-assign function after an order is created
DROP TRIGGER IF EXISTS auto_assign_delivery_person_on_orders ON public.orders;
CREATE TRIGGER auto_assign_delivery_person_on_orders
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_delivery_person();

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'phone', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO categories (name, display_order, is_active) VALUES
('Vegetables & Fruits', 1, true),
('Dairy & Breakfast', 2, true),
('Munchies', 3, true),
('Cold Drinks & Juices', 4, true),
('Instant & Frozen Food', 5, true),
('Tea, Coffee & Health Drinks', 6, true),
('Bakery & Biscuits', 7, true),
('Sweet Tooth', 8, true),
('Atta, Rice & Dal', 9, true),
('Masala, Oil & More', 10, true),
('Sauces & Spreads', 11, true),
('Chicken, Meat & Fish', 12, true),
('Paan Corner', 13, true),
('Organic & Premium', 14, true),
('Baby Care', 15, true),
('Pharma & Wellness', 16, true),
('Cleaning Essentials', 17, true),
('Home & Office', 18, true),
('Personal Care', 19, true),
('Pet Care', 20, true);

-- Sample products
INSERT INTO products (name, price, unit, description, image_url)
VALUES
  ('Fresh Apples (1kg)', 120.00, 'kg', 'Crisp and juicy seasonal apples.', NULL),
  ('Organic Milk (1L)', 65.00, 'litre', 'Farm fresh organic cow milk.', NULL),
  ('Brown Bread', 45.00, 'piece', 'Soft and healthy brown bread loaf.', NULL),
  ('Cold Drink - Cola (1.25L)', 80.00, 'bottle', 'Chilled fizzy cola beverage.', NULL),
  ('Premium Basmati Rice (5kg)', 650.00, 'bag', 'Long grain aromatic basmati rice.', NULL),
  ('Toor Dal (1kg)', 140.00, 'kg', 'High quality toor dal for daily cooking.', NULL),
  ('Eggs (12 pack)', 90.00, 'pack', 'Fresh farm eggs (pack of 12).', NULL),
  ('Refined Sunflower Oil (1L)', 180.00, 'litre', 'Light refined sunflower cooking oil.', NULL),
  ('Sugar (1kg)', 55.00, 'kg', 'Fine granulated white sugar.', NULL),
  ('Instant Noodles (4 pack)', 70.00, 'pack', 'Instant masala noodles family pack (4x).', NULL);

-- Enable realtime for orders and delivery_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_assignments;


-- =============================
-- Fix update_updated_at_column function
-- From migration: 20251122091518_76c2bda1-bedb-485c-b59f-eaaacd587d83.sql
-- =============================

-- Fix the update_updated_at_column function to have immutable search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================
-- Delivery applications table & RLS
-- From migration: 20251125050203_5dfef2f8-f3b1-4e27-8eb7-a820622adf1e.sql
-- =============================

-- Create delivery applications table
CREATE TABLE IF NOT EXISTS public.delivery_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  license_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_applications ENABLE ROW LEVEL SECURITY;

-- Users can create their own application
DROP POLICY IF EXISTS "Users can create their own application" ON public.delivery_applications;
CREATE POLICY "Users can create their own application"
ON public.delivery_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own application
DROP POLICY IF EXISTS "Users can view their own application" ON public.delivery_applications;
CREATE POLICY "Users can view their own application"
ON public.delivery_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all applications (FIXED: was USING(true) which allowed any authenticated user)
DROP POLICY IF EXISTS "Admins can view all applications" ON public.delivery_applications;
CREATE POLICY "Admins can view all applications"
ON public.delivery_applications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Admins can update all applications
DROP POLICY IF EXISTS "Admins can update all applications" ON public.delivery_applications;
CREATE POLICY "Admins can update all applications"
ON public.delivery_applications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_delivery_applications_updated_at ON public.delivery_applications;
CREATE TRIGGER update_delivery_applications_updated_at
BEFORE UPDATE ON public.delivery_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- =============================
-- Additional helpers and policy fixes
-- From migration: 20251126052630_0330d2d8-dc40-4ea8-a67d-de36a4187842.sql
-- =============================

-- Function to check if user is delivery person for a specific order
CREATE OR REPLACE FUNCTION public.is_delivery_person_for_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM delivery_assignments
    WHERE order_id = _order_id 
      AND delivery_person_id = _user_id
  )
$$;

-- Drop and recreate the problematic policy for delivery persons
DROP POLICY IF EXISTS "Delivery persons can view assigned orders" ON orders;

CREATE POLICY "Delivery persons can view assigned orders"
ON orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'delivery'::app_role) 
  AND is_delivery_person_for_order(auth.uid(), id)
);

-- Allow admins to update orders
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

CREATE POLICY "Admins can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow system to update orders (for delivery workflow)
DROP POLICY IF EXISTS "System can update orders" ON orders;

CREATE POLICY "System can update orders"
ON orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'delivery'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins to delete orders
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

CREATE POLICY "Admins can delete orders"
ON orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins to manage delivery assignments
DROP POLICY IF EXISTS "Admins can insert assignments" ON delivery_assignments;

CREATE POLICY "Admins can insert assignments"
ON delivery_assignments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins to delete user roles
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

CREATE POLICY "Admins can delete roles"
ON user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure products can be properly managed
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Admins can delete products"
ON products
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- =============================
-- Stock Management Trigger
-- Automatically reduces product stock when order items are created
-- =============================

-- Function to reduce stock when order is placed
CREATE OR REPLACE FUNCTION reduce_stock_on_order_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Reduce the stock quantity by the ordered quantity
  UPDATE products 
  SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
      updated_at = NOW()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_order ON order_items;

-- Create the trigger
CREATE TRIGGER trigger_reduce_stock_on_order
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION reduce_stock_on_order_item();

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_stock_on_order_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore stock if status changed to 'cancelled' or 'rejected'
  IF NEW.status IN ('cancelled', 'rejected') AND OLD.status NOT IN ('cancelled', 'rejected') THEN
    -- Restore stock for each order item
    UPDATE products p
    SET stock_quantity = stock_quantity + oi.quantity,
        updated_at = NOW()
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND p.id = oi.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancel ON orders;

-- Create the trigger for cancelled/rejected orders
CREATE TRIGGER trigger_restore_stock_on_cancel
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION restore_stock_on_order_cancel();
