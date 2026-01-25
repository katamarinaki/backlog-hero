import { Routes, Route, Link } from 'react-router-dom';

import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import styles from './App.module.css';

function App() {
  return (
    <div className={styles.app}>
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>Backlog Hero</div>
        <div className={styles.navLinks}>
          <Link to="/" className={styles.navLink}>
            Library
          </Link>
          <Link to="/settings" className={styles.navLink}>
            Settings
          </Link>
        </div>
      </nav>
      <main className={styles.mainContent}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
