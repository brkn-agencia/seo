import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import StorePage from "./pages/StorePage";
import ProductPage from "./pages/ProductPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stores/:storeId" element={<StorePage />} />
          <Route path="/stores/:storeId/products/:productId" element={<ProductPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
