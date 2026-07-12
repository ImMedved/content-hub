import { useEffect, useRef, useState } from "react";

function shouldRevealImmediately(enabled) {
    if (!enabled) {
        return true;
    }

    if (typeof window === "undefined") {
        return true;
    }

    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function useRevealOnScroll(enabled = true) {
    const elementRef = useRef(null);
    const [isVisible, setIsVisible] = useState(() => shouldRevealImmediately(enabled));

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const currentElement = elementRef.current;

        if (!currentElement) {
            return undefined;
        }

        let frameId = null;

        const revealIfNeeded = () => {
            const element = elementRef.current;

            if (!element) {
                return;
            }

            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const revealThreshold = viewportHeight * 0.92;
            const hideThreshold = viewportHeight * 1.04;
            const nextVisible = rect.top <= revealThreshold && rect.bottom >= 0;

            if (nextVisible) {
                setIsVisible((current) => (current ? current : true));
                return;
            }

            if (rect.top > hideThreshold || rect.bottom < 0) {
                setIsVisible((current) => (current ? false : current));
            }
        };

        const handleViewportChange = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                revealIfNeeded();
            });
        };

        revealIfNeeded();

        window.addEventListener("scroll", handleViewportChange, { passive: true });
        window.addEventListener("resize", handleViewportChange);

        return () => {
            window.removeEventListener("scroll", handleViewportChange);
            window.removeEventListener("resize", handleViewportChange);

            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [enabled]);

    return { elementRef, isVisible };
}

export default useRevealOnScroll;
