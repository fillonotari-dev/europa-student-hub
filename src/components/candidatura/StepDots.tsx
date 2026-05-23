import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { total: number; current: number };

export function StepDots({ total, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
      {Array.from({ length: total }).map((_, i) => {
        const completed = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center gap-2 sm:gap-3">
            <motion.div
              initial={false}
              animate={{
                scale: active ? 1.15 : 1,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className={cn(
                'relative flex items-center justify-center rounded-full transition-colors',
                'w-3 h-3 sm:w-3.5 sm:h-3.5',
                completed && 'bg-primary',
                active && 'bg-primary',
                !completed && !active && 'bg-muted border border-border',
              )}
            >
              {active && (
                <motion.span
                  layoutId="stepdot-halo"
                  className="absolute inset-0 rounded-full ring-4 ring-primary/20"
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
              {completed && <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />}
            </motion.div>
            {i < total - 1 && (
              <div className="relative h-px w-8 sm:w-12 bg-border overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ scaleX: completed ? 1 : 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  style={{ originX: 0 }}
                  className="absolute inset-0 bg-primary"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}