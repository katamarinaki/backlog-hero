import { NavLink } from 'react-router-dom';

import styles from './header.module.css';

const getLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`;

export const Header = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.navBrand}>Backlog Hero</div>
      <div className={styles.navLinks}>
        <NavLink to="/" className={getLinkClass} end>
          Library
        </NavLink>
        <NavLink to="/settings" className={getLinkClass}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
};
