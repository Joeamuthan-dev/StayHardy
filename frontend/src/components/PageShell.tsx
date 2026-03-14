import React from 'react';

/**
 * PageShell wraps every authenticated page.
 * On mobile: full-width, bottom-padded for the bottom nav.
 * On desktop: content shifts right of the 240px sidebar automatically via CSS.
 */
const PageShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`page-shell ${className}`}>
      {children}
    </div>
  );
};

export default PageShell;
