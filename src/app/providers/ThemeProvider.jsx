import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from '@/app/contexts';
import { StorageKeys, readPreference, writePreference } from '@/lib/storage';

/**
 * @returns {import('@/app/contexts').Theme}
 */
function initialTheme() {
  const stored = readPreference(StorageKeys.THEME);
  if (stored === 'light' || stored === 'dark') return stored;
  // Sin preferencia guardada se respeta la del sistema operativo.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Tema claro/oscuro.
 *
 * El valor inicial ya se aplicó en `index.html` antes del primer pintado, para que
 * no haya un destello blanco al recargar en modo oscuro. Aquí solo se sincroniza el
 * estado de React con lo que el documento ya tiene.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writePreference(StorageKeys.THEME, theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;

    /** @param {MediaQueryListEvent} event */
    const handleChange = (event) => {
      // Solo se sigue al sistema si el usuario no eligió explícitamente: su
      // elección manda sobre la del sistema operativo.
      if (!readPreference(StorageKeys.THEME)) setThemeState(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((next) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
