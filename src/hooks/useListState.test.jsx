import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useListState } from './useListState';

describe('useListState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a clean paginated query', () => {
    const { result } = renderHook(() =>
      useListState({ search: '', status: '', type: 'CASH' }, { pageSize: 10 }),
    );

    expect(result.current.query).toEqual({ type: 'CASH', page: 1, limit: 10 });
  });

  it('resets the page when a filter changes', () => {
    const { result } = renderHook(() => useListState({ status: '' }));

    act(() => {
      result.current.setPage(3);
    });

    expect(result.current.query.page).toBe(3);

    act(() => {
      result.current.setFilter('status', 'CONFIRMED');
    });

    expect(result.current.filters.status).toBe('CONFIRMED');
    expect(result.current.query.page).toBe(1);
  });

  it('debounces search before adding it to the query', () => {
    const { result } = renderHook(() => useListState({ search: '' }, { searchDelay: 300 }));

    act(() => {
      result.current.setFilter('search', 'factura');
    });

    expect(result.current.query).toEqual({ page: 1, limit: 25 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.query).toEqual({ search: 'factura', page: 1, limit: 25 });
  });
});
