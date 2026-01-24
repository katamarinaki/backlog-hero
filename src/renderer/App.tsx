import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">Steam Tracker</div>
        <div className="nav-links">
          <Link to="/" className="nav-link">Library</Link>
          <Link to="/settings" className="nav-link">Settings</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
