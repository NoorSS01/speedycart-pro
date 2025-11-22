-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('user', 'admin', 'delivery', 'super_admin');

-- Create enum for order status
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled', 'rejected');

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

-- RLS Policies for malicious_activities
CREATE POLICY "Admins can view all malicious activities" ON malicious_activities FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "System can insert malicious activities" ON malicious_activities FOR INSERT WITH CHECK (true);

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

-- Enable realtime for orders and delivery_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_assignments;