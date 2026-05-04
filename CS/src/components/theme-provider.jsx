import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'theme';

export const ThemeContext = createContext();

// Channel → Color mapping
const channelColors = {
  instagram: "#E1306C",
  linkedin: "#0077B5",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  threads: "#000000",
  facebook: "#1877F2",
  github: "#333333",
};

export function ThemeProvider({ children, activeChannel }) {
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme || "light";
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Persona color based on active channel
  const personaColor = channelColors[activeChannel] || "#333";

  const contextValue = useMemo(
    () => ({ theme, setTheme, personaColor }),
    [theme, activeChannel]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {/* 👇 Apply theme class here */}
      <div className={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}