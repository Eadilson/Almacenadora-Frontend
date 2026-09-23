import { useCallback, useMemo, useState } from 'react';
import { useDebounced } from '@/hooks/useDebounced';

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
}

/**
 * Estado compartido para listados paginados.
 *
 * Centraliza el contrato que se repite en las pantallas de tabla:
 * cada cambio de filtro vuelve a la primera página y el query final no envía
 * filtros vacíos al backend.
 */
export function useListState(initialFilters = {}, { pageSize = 25, searchDelay = 300 } = {}) {
  const [filters, setFiltersState] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(filters.search ?? '', searchDelay);

  const setFilter = useCallback((key, value) => {
    setFiltersState((current) => {
      if (current[key] === value) return current;
      return { ...current, [key]: value };
    });
    setPage(1);
  }, []);

  const setFilters = useCallback((nextFilters) => {
    setFiltersState((current) => ({
      ...current,
      ...(typeof nextFilters === 'function' ? nextFilters(current) : nextFilters),
    }));
    setPage(1);
  }, []);

  const queryFilters = useMemo(() => {
    const nextFilters = { ...filters };
    if (Object.hasOwn(nextFilters, 'search')) {
      nextFilters.search = debouncedSearch;
    }
    return cleanFilters(nextFilters);
  }, [debouncedSearch, filters]);

  const query = useMemo(
    () => ({
      ...queryFilters,
      page,
      limit: pageSize,
    }),
    [page, pageSize, queryFilters],
  );

  return {
    filters,
    page,
    query,
    setFilter,
    setFilters,
    setPage,
  };
}
