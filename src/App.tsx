import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Candidatura from "./pages/Candidatura";
import Login from "./pages/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Candidature from "./pages/admin/Candidature";
import Residenti from "./pages/admin/Residenti";
import Camere from "./pages/admin/Camere";
import Strutture from "./pages/admin/Strutture";
import StoricoLayout from "./pages/admin/storico/StoricoLayout";
import StoricoCandidature from "./pages/admin/storico/StoricoCandidature";
import StoricoResidenti from "./pages/admin/storico/StoricoResidenti";
import StoricoCamere from "./pages/admin/storico/StoricoCamere";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/candidatura" element={<Candidatura />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="candidature" element={<Candidature />} />
            <Route path="residenti" element={<Residenti />} />
            <Route path="camere" element={<Camere />} />
            <Route path="strutture" element={<Strutture />} />
            <Route path="storico" element={<StoricoLayout />}>
              <Route index element={<Navigate to="candidature" replace />} />
              <Route path="candidature" element={<StoricoCandidature />} />
              <Route path="residenti" element={<StoricoResidenti />} />
              <Route path="camere" element={<StoricoCamere />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
