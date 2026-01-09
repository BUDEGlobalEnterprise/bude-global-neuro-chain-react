import React from 'react';
import styles from '../styles/components/Footer.module.css';

const Footer = React.memo(() => {
  return (
    <div className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.brand}>
          <span className={styles.brandName}>Bude Global</span>
          <span className={styles.separator}>•</span>
          <span className={styles.tagline}>Visualizing Innovation Networks</span>
        </div>
        <div className={styles.links}>
          <a href="https://budeglobal.in" target="_blank" rel="noopener noreferrer" className={styles.link}>
            Website
          </a>
          <span className={styles.separator}>•</span>
          <a href="mailto:contact@budeglobal.in" className={styles.link}>
            Contact
          </a>
        </div>
      </div>
      
      <div className={styles.policyBar}>
        <a href="https://budeglobal.in/privacy" className={styles.policyLink}>Privacy Policy</a>
        <a href="https://budeglobal.in/terms" className={styles.policyLink}>Terms of Service</a>
        <a href="https://budeglobal.in/cookies" className={styles.policyLink}>Cookie Policy</a>
        <a href="https://budeglobal.in/refunds" className={styles.policyLink}>Refund Policy</a>
        <a href="https://budeglobal.in/security" className={styles.policyLink}>Security</a>
        <a href="https://budeglobal.in/acceptable-use" className={styles.policyLink}>Acceptable Use</a>
        <a href="https://budeglobal.in/sla" className={styles.policyLink}>SLA</a>
        <a href="https://budeglobal.in/disclaimer" className={styles.policyLink}>Disclaimer</a>
        <a href="https://budeglobal.in/code-of-conduct" className={styles.policyLink}>Code of Conduct</a>
        <a href="https://budeglobal.in/contributors-guide" className={styles.policyLink}>Contributors Guide</a>
      </div>
    </div>
  );
});

Footer.displayName = 'Footer';

export default Footer;
