import { createContext } from 'react';

/**
 * Contextos de la aplicación.
 *
 * Viven en un archivo sin componentes a propósito: así los proveedores y los hooks
 * pueden importarlos sin crear dependencias circulares, y la recarga en caliente
 * de Vite no pierde el estado al editar un componente.
 */

/**
 * @typedef {'light'|'dark'} Theme
 * @typedef {{ theme: Theme, setTheme: (theme: Theme) => void, toggleTheme: () => void }} ThemeContextValue
 */

/** @type {import('react').Context<ThemeContextValue|null>} */
export const ThemeContext = createContext(null);

/**
 * @typedef {'loading'|'authenticated'|'unauthenticated'} SessionStatus
 *
 * @typedef {object} SessionContextValue
 * @property {SessionStatus} status
 * @property {import('@/api/endpoints/auth').SessionUser|null} user
 * @property {import('@/api/endpoints/auth').SessionTenant|null} tenant
 * @property {(credentials: { email: string, password: string, remember?: boolean }) => Promise<void>} login
 * @property {() => Promise<void>} logout
 * @property {() => Promise<void>} logoutAllSessions
 * @property {() => Promise<void>} reload
 * @property {(payload: { name: string }) => Promise<void>} updateProfile
 * @property {(permission: string) => boolean} can
 * @property {(feature: string) => boolean} hasFeature
 * @property {string|null} activeBranchId
 * @property {(branchId: string) => void} setActiveBranch
 */

/** @type {import('react').Context<SessionContextValue|null>} */
export const SessionContext = createContext(null);

/**
 * @typedef {'info'|'success'|'warning'|'destructive'} ToastVariant
 * @typedef {{ id: string, title: string, description?: string, variant: ToastVariant, requestId?: string|null }} Toast
 * @typedef {{ toasts: Toast[], notify: (toast: Omit<Toast, 'id'>) => string, dismiss: (id: string) => void }} ToastContextValue
 */

/** @type {import('react').Context<ToastContextValue|null>} */
export const ToastContext = createContext(null);
