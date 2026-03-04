/**
 * useIsMobile.ts
 * Returns true when the viewport width is at or below the given breakpoint.
 * Default breakpoint: 480px — covers Discord's mobile Activity WebView (~360-414px).
 *
 * Uses a ResizeObserver on window so it reacts to orientation changes
 * without needing a resize event (which some WebViews suppress).
 */

import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 480): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint,
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);

    // ResizeObserver fires on any layout change, including orientation
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(document.documentElement);
    }

    // Fallback for environments without ResizeObserver
    window.addEventListener('resize', check);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
