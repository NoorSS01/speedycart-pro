import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Orders from "./pages/Orders";
import Profile from "./pages/Profile";
import Delivery from "./pages/Delivery";
import Admin from "./pages/Admin";
import AdminToPay from "./pages/AdminToPay";
import SuperAdmin from "./pages/SuperAdmin";
import DeliveryApplication from "./pages/DeliveryApplication";
import PhoneSetup from "./pages/PhoneSetup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/to-pay" element={<AdminToPay />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/delivery-application" element={<DeliveryApplication />} />
            <Route path="/phone-setup" element={<PhoneSetup />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
