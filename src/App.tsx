import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";

// Eagerly loaded pages (core user flows)
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import UserOrderDetail from "./pages/UserOrderDetail";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Categories from "./pages/Categories";
import FlashDealsPage from "./pages/FlashDealsPage";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import PhoneSetup from "./pages/PhoneSetup";
import DeliveryApplication from "./pages/DeliveryApplication";

// Legal pages (eagerly loaded since they're lightweight)
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import RefundPolicy from "./pages/RefundPolicy";
import ShippingPolicy from "./pages/ShippingPolicy";
import ContactUs from "./pages/ContactUs";
import PaymentTerms from "./pages/PaymentTerms";
import GrievancePolicy from "./pages/GrievancePolicy";

import OfflineBanner from "@/components/OfflineBanner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ThemeAnimations from "@/components/ThemeAnimations";

// Lazy loaded pages (admin-only, delivery-only, heavy pages)
// These will be code-split into separate chunks
const Delivery = lazy(() => import("./pages/Delivery"));
const DeliveryOrderDetail = lazy(() => import("./pages/DeliveryOrderDetail"));
const DeliveryProfile = lazy(() => import("./pages/DeliveryProfile"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminStock = lazy(() => import("./pages/AdminStock"));
const AdminBanners = lazy(() => import("./pages/AdminBanners"));
const AdminCouponTriggers = lazy(() => import("./pages/AdminCouponTriggers"));
const AdminHeroBanners = lazy(() => import("./pages/AdminHeroBanners"));
const AdminOfferSections = lazy(() => import("./pages/AdminOfferSections"));
const AdminFlashDeals = lazy(() => import("./pages/AdminFlashDeals"));
const AdminToPay = lazy(() => import("./pages/AdminToPay"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminDeliveryApps = lazy(() => import("./pages/AdminDeliveryApps"));
const AdminDeliveryActivations = lazy(() => import("./pages/AdminDeliveryActivations"));
const AdminThemes = lazy(() => import("./pages/AdminThemes"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminOrderDetail = lazy(() => import("./pages/AdminOrderDetail"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));

// Loading fallback component
const LazyLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);


const queryClient = new QueryClient();

// Hostinger serves app from root via proper rewrites, so router basename should be "/"
// even though assets are in /dist/ (configured in vite.config.ts)
const basename = '/';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <OfflineBanner />
        <ThemeAnimations />
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          {/* Scroll to top on every navigation */}
          <ScrollToTop />
          <AuthProvider>
            <CartProvider>
              <Suspense fallback={<LazyLoading />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/flash-deals/:id" element={<FlashDealsPage />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/orders/:orderId" element={<UserOrderDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  {/* Delivery routes - protected for delivery/admin/super_admin */}
                  <Route path="/delivery" element={
                    <ProtectedRoute requiredRoles={['delivery', 'admin', 'super_admin']}>
                      <Delivery />
                    </ProtectedRoute>
                  } />
                  <Route path="/delivery/order/:orderId" element={
                    <ProtectedRoute requiredRoles={['delivery', 'admin', 'super_admin']}>
                      <DeliveryOrderDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="/delivery/profile" element={
                    <ProtectedRoute requiredRoles={['delivery', 'admin', 'super_admin']}>
                      <DeliveryProfile />
                    </ProtectedRoute>
                  } />
                  {/* Admin routes - protected for admin/super_admin */}
                  <Route path="/admin" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <Admin />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/stock" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminStock />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/banners" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminBanners />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/coupon-triggers" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminCouponTriggers />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/hero-banners" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminHeroBanners />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/offer-sections" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminOfferSections />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/flash-deals" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminFlashDeals />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/to-pay" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminToPay />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/notifications" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminNotifications />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/delivery-apps" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminDeliveryApps />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/delivery-activations" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminDeliveryActivations />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/themes" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminThemes />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/security" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminSecurity />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/users" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/orders" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminOrders />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/order/:orderId" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminOrderDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/profile" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AdminProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/add-product" element={
                    <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                      <AddProduct />
                    </ProtectedRoute>
                  } />
                  {/* Super Admin - protected for super_admin only */}
                  <Route path="/super-admin" element={
                    <ProtectedRoute requiredRoles={['super_admin']}>
                      <SuperAdmin />
                    </ProtectedRoute>
                  } />
                  <Route path="/delivery-application" element={<DeliveryApplication />} />
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
              </Suspense>
              {/* PWA Install Prompt */}
              <PWAInstallPrompt />
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
