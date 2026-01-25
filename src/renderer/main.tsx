import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';

import { Header } from 'components/header';
import { HomePage } from 'pages/home-page';
import { SettingsPage } from 'pages/settings-page';

import styles from './main.module.css';
import './styles.global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <div className={styles.app}>
        <Header />
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  </StrictMode>,
);
