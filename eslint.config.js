import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[_A-Z]' }],
      // La consola del navegador no es un canal de registro: los errores se
      // muestran al usuario o se envían al servicio de seguimiento.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      // El almacenamiento persistente no debe guardar credenciales: el token de
      // acceso vive en memoria y el de refresco en una cookie httpOnly (ADR-009).
      'no-restricted-properties': [
        'error',
        {
          object: 'localStorage',
          property: 'setItem',
          message:
            'No guarde tokens ni datos de sesión en localStorage. Use el estado en memoria; el tema y las preferencias de interfaz sí pueden ir aquí mediante src/lib/storage.js.',
        },
      ],
    },
  },
  {
    // El acceso controlado a localStorage vive en un único módulo.
    files: ['src/lib/storage.js'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // Las pruebas corren en Node aunque el entorno simulado sea el navegador.
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
    rules: { 'no-console': 'off' },
  },
  {
    // Los archivos de configuración se ejecutan en Node, no en el navegador.
    files: ['vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
