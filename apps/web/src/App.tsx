import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import StorePage from "./pages/StorePage";
import ProductPage from "./pages/ProductPage";
import MetricsPage from "./pages/MetricsPage";
import Login from "./pages/Login";
import { getToken } from "./api";

const queryClient = new QueryClient();

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/stores/:storeId" element={<Protected><StorePage /></Protected>} />
          <Route path="/stores/:storeId/metrics" element={<Protected><MetricsPage /></Protected>} />
          <Route path="/stores/:storeId/products/:productId" element={<Protected><ProductPage /></Protected>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
