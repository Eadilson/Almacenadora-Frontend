import { afterEach, describe, expect, it } from 'vitest';
import { api, setActiveBranchContext } from './client.js';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  setActiveBranchContext(null);
  api.defaults.adapter = originalAdapter;
});

describe('contexto HTTP de sucursal', () => {
  it('envía la sucursal activa en todas las peticiones', async () => {
    let receivedConfig;
    api.defaults.adapter = async (config) => {
      receivedConfig = config;
      return { data: { data: null }, status: 200, statusText: 'OK', headers: {}, config };
    };

    setActiveBranchContext('sucursal-2');
    await api.get('/prueba');

    expect(receivedConfig.headers.get('X-Branch-Id')).toBe('sucursal-2');
  });

  it('retira el encabezado cuando termina la sesión', async () => {
    const observed = [];
    api.defaults.adapter = async (config) => {
      observed.push(config.headers.get('X-Branch-Id'));
      return { data: { data: null }, status: 200, statusText: 'OK', headers: {}, config };
    };

    setActiveBranchContext('sucursal-1');
    await api.get('/con-sucursal');
    setActiveBranchContext(null);
    await api.get('/sin-sucursal');

    expect(observed).toEqual(['sucursal-1', undefined]);
  });
});
