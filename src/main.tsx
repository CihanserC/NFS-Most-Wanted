import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/global.css';
import { useAppStore } from './core/store/appStore';
import { useBuildStore } from './core/store/stores';

if (import.meta.env.DEV) Object.assign(window, { __muscleGarage: { useBuildStore, useAppStore } });

const root = document.getElementById('root');
if (!root) throw new Error('#root elementi bulunamadı');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
