import { useEffect, useMemo, useState } from "react";

import { ThemeContext } from "./theme-context";

const STORAGE_KEY = "content-hub-theme";

function getSystemTheme() {
    if (typeof window === "undefined") return "light";

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialThemePreference() {
    if (typeof window === "undefined") return "system";

    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

export function ThemeProvider({ children }) {
    const [themePreference, setThemePreference] = useState(getInitialThemePreference);
    const [systemTheme, setSystemTheme] = useState(getSystemTheme);

    const activeTheme = themePreference === "system" ? systemTheme : themePreference;

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleSystemThemeChange = (event) => {
            setSystemTheme(event.matches ? "dark" : "light");
        };

        mediaQuery.addEventListener("change", handleSystemThemeChange);

        return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.theme = activeTheme;
        document.documentElement.style.colorScheme = activeTheme;
    }, [activeTheme]);

    useEffect(() => {
        if (themePreference === "system") {
            window.localStorage.removeItem(STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, themePreference);
    }, [themePreference]);

    const value = useMemo(
        () => ({
            activeTheme,
            themePreference,
            toggleTheme: () => {
                setThemePreference((currentPreference) => {
                    const currentActiveTheme =
                        currentPreference === "system" ? getSystemTheme() : currentPreference;

                    return currentActiveTheme === "dark" ? "light" : "dark";
                });
            },
        }),
        [activeTheme, themePreference],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
