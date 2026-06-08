import { createContext, useContext } from 'react';
import type { ToastVariant } from './useToast.js';

export type ToastFn = (message: string, variant?: ToastVariant, duration?: number) => void;

export const ToastContext = createContext<ToastFn>(() => undefined);
export const useToastFn = () => useContext(ToastContext);
