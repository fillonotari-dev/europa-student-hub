import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, GraduationCap } from 'lucide-react';
import logoStudentato from '@/assets/logo-studentato.svg';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoStudentato} alt="Studentato Europa" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold text-primary">Studentato Europa</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
            Area gestione
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Il tuo posto a Reggio Emilia
          </h1>
          <p className="text-muted-foreground mb-8 text-[15px]">
            Candidati per una stanza presso lo Studentato Europa.
          </p>
          <Button size="lg" onClick={() => navigate('/candidatura')}>
            Candidati ora <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card py-4">
        <div className="max-w-5xl mx-auto px-4 text-center text-[13px] text-muted-foreground">
          Studentato Europa · Reggio Emilia
        </div>
      </footer>
    </div>
  );
}
