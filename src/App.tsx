import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Candidatura from "./pages/Candidatura";
import CandidaturaCompleta from "./pages/CandidaturaCompleta";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Candidature from "./pages/admin/Candidature";
import Residenti from "./pages/admin/Residenti";
import Camere from "./pages/admin/Camere";
import Strutture from "./pages/admin/Strutture";
import StudentePage from "./pages/admin/StudentePage";
import Impostazioni from "./pages/admin/Impostazioni";
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
          <Route path="/candidatura/completa/:token" element={<CandidaturaCompleta />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="candidature" element={<Candidature />} />
            <Route path="residenti" element={<Residenti />} />
            <Route path="studenti/:id" element={<StudentePage />} />
            <Route path="camere" element={<Camere />} />
            <Route path="strutture" element={<Strutture />} />
            <Route path="impostazioni" element={<Impostazioni />} />
            {/* Storico rimosso: gli archiviati vivono nelle liste principali via filtro. */}
            <Route path="storico" element={<Navigate to="/admin/candidature?stadio=archiviato" replace />} />
            <Route path="storico/*" element={<Navigate to="/admin/candidature?stadio=archiviato" replace />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
