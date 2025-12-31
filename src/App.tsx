import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import ScrollToTop from "@/components/ScrollToTop";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Delivery from "./pages/Delivery";
import DeliveryOrderDetail from "./pages/DeliveryOrderDetail";
import DeliveryProfile from "./pages/DeliveryProfile";
import Admin from "./pages/Admin";
import AdminStock from "./pages/AdminStock";
import AdminBanners from "./pages/AdminBanners";
import AdminCouponTriggers from "./pages/AdminCouponTriggers";
import AdminToPay from "./pages/AdminToPay";
import AdminNotifications from "./pages/AdminNotifications";
import AdminDeliveryApps from "./pages/AdminDeliveryApps";
import AdminSecurity from "./pages/AdminSecurity";
import AdminUsers from "./pages/AdminUsers";
import AdminOrders from "./pages/AdminOrders";
import AdminOrderDetail from "./pages/AdminOrderDetail";
import AdminProfile from "./pages/AdminProfile";
import UserOrderDetail from "./pages/UserOrderDetail";
import SuperAdmin from "./pages/SuperAdmin";
import DeliveryApplication from "./pages/DeliveryApplication";
import PhoneSetup from "./pages/PhoneSetup";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Categories from "./pages/Categories";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import RefundPolicy from "./pages/RefundPolicy";
import ShippingPolicy from "./pages/ShippingPolicy";
import ContactUs from "./pages/ContactUs";
import PaymentTerms from "./pages/PaymentTerms";
import GrievancePolicy from "./pages/GrievancePolicy";
import Settings from "./pages/Settings";


const queryClient = new QueryClient();

// Hostinger serves app from root via proper rewrites, so router basename should be "/"
// even though assets are in /dist/ (configured in vite.config.ts)
const basename = '/';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={basename}>
        {/* Scroll to top on every navigation */}
        <ScrollToTop />
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:orderId" element={<UserOrderDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/delivery" element={<Delivery />} />
              <Route path="/delivery/order/:orderId" element={<DeliveryOrderDetail />} />
              <Route path="/delivery/profile" element={<DeliveryProfile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/stock" element={<AdminStock />} />
              <Route path="/admin/banners" element={<AdminBanners />} />
              <Route path="/admin/coupon-triggers" element={<AdminCouponTriggers />} />
              <Route path="/admin/to-pay" element={<AdminToPay />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/delivery-apps" element={<AdminDeliveryApps />} />
              <Route path="/admin/security" element={<AdminSecurity />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/order/:orderId" element={<AdminOrderDetail />} />
              <Route path="/admin/profile" element={<AdminProfile />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/delivery-application" element={<DeliveryApplication />} />
              <Route path="/admin/add-product" element={<AddProduct />} />
              <Route path="/phone-setup" element={<PhoneSetup />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              {/* Legal Pages */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsConditions />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/payment-terms" element={<PaymentTerms />} />
              <Route path="/grievance" element={<GrievancePolicy />} />
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* PWA Install Prompt */}
            <PWAInstallPrompt />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
