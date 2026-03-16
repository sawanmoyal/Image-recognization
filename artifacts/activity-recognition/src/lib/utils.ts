import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function getActivityColor(activity: string): { bg: string, text: string, border: string } {
  const normalized = activity.toLowerCase();
  if (normalized.includes('fall')) return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive' };
  if (normalized.includes('fight')) return { bg: 'bg-destructive/20', text: 'text-destructive', border: 'border-destructive' };
  if (normalized.includes('walk')) return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' };
  if (normalized.includes('sit')) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' };
  if (normalized.includes('run')) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
  if (normalized.includes('phone')) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' };
  
  return { bg: 'bg-primary/20', text: 'text-primary', border: 'border-primary/50' };
}
