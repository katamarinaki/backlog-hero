import { Link } from 'react-router-dom';

import styles from './header.module.css';

export const Header = () => {
  return (
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
  );
};
