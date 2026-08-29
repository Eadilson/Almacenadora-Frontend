import '@testing-library/jest-dom/vitest';

// La zona horaria se fija para que las pruebas de formato de fechas sean
// deterministas en cualquier máquina y en integración continua.
process.env.TZ = 'UTC';
