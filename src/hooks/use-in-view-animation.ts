'use client';

import { useInView } from 'framer-motion';
import { useRef } from 'react';

type MarginValue = `${number}${'px' | '%'}`;
type ViewMargin =
  | MarginValue
  | `${MarginValue} ${MarginValue}`
  | `${MarginValue} ${MarginValue} ${MarginValue}`
  | `${MarginValue} ${MarginValue} ${MarginValue} ${MarginValue}`;

export function useInViewAnimation(once = true, margin: ViewMargin = '-50px') {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once, margin });

  return { ref, isInView };
}

export const revealVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.5, 
      ease: [0.25, 0.1, 0.25, 1] 
    } 
  }
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    }
  }
};
