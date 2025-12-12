import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * Scrolls to top of page on every route change
 * This ensures users always start at the top when navigating
 */
export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Scroll to top instantly when route changes
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}
