import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Delivery from "./pages/Delivery";
import Admin from "./pages/Admin";
import AdminStock from "./pages/AdminStock";
import AdminToPay from "./pages/AdminToPay";
import AdminNotifications from "./pages/AdminNotifications";
import SuperAdmin from "./pages/SuperAdmin";
import DeliveryApplication from "./pages/DeliveryApplication";
import PhoneSetup from "./pages/PhoneSetup";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";

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
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/delivery" element={<Delivery />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/stock" element={<AdminStock />} />
              <Route path="/admin/to-pay" element={<AdminToPay />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/delivery-application" element={<DeliveryApplication />} />
              <Route path="/admin/add-product" element={<AddProduct />} />
              <Route path="/phone-setup" element={<PhoneSetup />} />
              <Route path="/product/:id" element={<ProductDetail />} />
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
