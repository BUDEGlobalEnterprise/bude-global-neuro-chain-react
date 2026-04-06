import React from 'react';
import styles from '../styles/components/Footer.module.css';

const Footer = React.memo(() => {
  const [showPolicies, setShowPolicies] = React.useState(false);
  const year = new Date().getFullYear();

  return (
    <div className={styles.footer}>
      <div className={styles.line}>
        <span className={styles.brandName}>Bude Global</span>
        <span className={styles.separator}>•</span>
        <span className={styles.tagline}>Visualizing Innovation Networks</span>
        <span className={styles.separator}>•</span>
        <span className={styles.year}>© {year}</span>
        
        <span className={styles.divider}>|</span>
        
        <a href="https://budeglobal.in" target="_blank" rel="noopener noreferrer" className={styles.link}>Website</a>
        <span className={styles.separator}>•</span>
        <a href="mailto:contact@budeglobal.in" className={styles.link}>Contact</a>

        <span className={styles.divider}>|</span>

        <button 
            className={styles.policyToggle} 
            onClick={() => setShowPolicies(!showPolicies)}
        >
            {showPolicies ? 'Hide Policies' : 'Policies'}
        </button>

        <div className={`${styles.scrollableLinks} ${showPolicies ? styles.show : ''}`}>
             <span className={styles.divider}>|</span>
             <a href="https://budeglobal.in/privacy" className={styles.policyLink}>Privacy</a>
            <a href="https://budeglobal.in/terms" className={styles.policyLink}>Terms</a>
            <a href="https://budeglobal.in/cookies" className={styles.policyLink}>Cookies</a>
            <a href="https://budeglobal.in/security" className={styles.policyLink}>Security</a>
            <a href="https://budeglobal.in/acceptable-use" className={styles.policyLink}>Acceptable Use</a>
            <a href="https://budeglobal.in/sla" className={styles.policyLink}>SLA</a>
            <a href="https://budeglobal.in/disclaimer" className={styles.policyLink}>Disclaimer</a>
            <a href="https://budeglobal.in/code-of-conduct" className={styles.policyLink}>Code of Conduct</a>
            <a href="https://budeglobal.in/contributors-guide" className={styles.policyLink}>Contributors</a>
        </div>
      </div>
    </div>
  );
});

Footer.displayName = 'Footer';

export default Footer;
