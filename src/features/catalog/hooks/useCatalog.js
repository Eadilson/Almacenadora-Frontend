import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api/endpoints/catalog';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Acceso a los datos del catálogo.
 *
 * Las consultas se agrupan aquí para que las pantallas no repitan claves de caché
 * ni reglas de invalidación. Las claves salen del catálogo central: dispersarlas es
 * la causa habitual de que una lista siga mostrando datos viejos tras guardar, sin
 * que nada falle de forma visible.
 */

/** Las categorías y las unidades cambian poco: no vale la pena recargarlas seguido. */
const STABLE_DATA = { staleTime: 5 * 60 * 1000 };

/**
 * @returns {import('@tanstack/react-query').UseQueryResult<import('@/api/endpoints/catalog').Category[]>}
 */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: catalogApi.listCategories,
    ...STABLE_DATA,
  });
}

/**
 * @returns {import('@tanstack/react-query').UseQueryResult<import('@/api/endpoints/catalog').Unit[]>}
 */
export function useUnits() {
  return useQuery({
    queryKey: queryKeys.units.all,
    queryFn: catalogApi.listUnits,
    ...STABLE_DATA,
  });
}

/**
 * Definiciones de atributo de una categoría.
 *
 * Es la consulta que alimenta el formulario dinámico. Se pide solo cuando hay
 * categoría elegida: sin ella no hay formulario que construir.
 *
 * @param {string|null} categoryId
 */
export function useCategoryAttributes(categoryId) {
  return useQuery({
    queryKey: queryKeys.categories.attributes(categoryId ?? 'none'),
    queryFn: () => catalogApi.getCategoryAttributes(/** @type {string} */ (categoryId)),
    enabled: Boolean(categoryId),
    ...STABLE_DATA,
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function useProducts(filters) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => catalogApi.searchProducts(filters),
    // Al cambiar de página o de filtro se conserva el resultado anterior mientras
    // llega el nuevo: evita el parpadeo de la tabla vaciándose y volviéndose a
    // llenar en cada pulsación.
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|null} id
 */
export function useProduct(id) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? 'new'),
    queryFn: () => catalogApi.getProduct(/** @type {string} */ (id)),
    enabled: Boolean(id),
  });
}

/**
 * Mutaciones del catálogo con invalidación e informe al usuario.
 *
 * @returns {Record<string, any>}
 */
export function useCatalogMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /** @param {string} message */
  const notifyError = (message) => toast({ variant: 'destructive', title: message });

  const invalidateProducts = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });

  const createProduct = useMutation({
    mutationFn: catalogApi.createProduct,
    onSuccess: (product) => {
      void invalidateProducts();
      toast({ variant: 'success', title: `Producto ${product.sku} creado` });
    },
    // Los errores por campo los coloca el formulario sobre cada control; aquí solo
    // se avisa de los que no corresponden a un campo concreto.
    onError: (error) => {
      if (!/** @type {any} */ (error).isValidation) notifyError(error.message);
    },
  });

  const updateProduct = useMutation({
    mutationFn: catalogApi.updateProduct,
    onSuccess: (product) => {
      void invalidateProducts();
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.id) });
      toast({ variant: 'success', title: 'Cambios guardados' });
    },
    onError: (error) => {
      if (!/** @type {any} */ (error).isValidation) notifyError(error.message);
    },
  });

  const deactivateProduct = useMutation({
    mutationFn: catalogApi.deactivateProduct,
    onSuccess: (product) => {
      void invalidateProducts();
      // Se dice «desactivado» y no «eliminado» porque es exactamente lo que ocurre:
      // el producto sigue existiendo para el historial de ventas y el kardex.
      toast({ variant: 'success', title: `${product.sku} desactivado` });
    },
    onError: (error) => notifyError(error.message),
  });

  const createCategory = useMutation({
    mutationFn: catalogApi.createCategory,
    onSuccess: (category) => {
      void invalidateCategories();
      toast({ variant: 'success', title: `Categoría «${category.name}» creada` });
    },
    onError: (error) => {
      if (!/** @type {any} */ (error).isValidation) notifyError(error.message);
    },
  });

  const addAttribute = useMutation({
    mutationFn: catalogApi.addAttribute,
    onSuccess: (result) => {
      void invalidateCategories();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.attributes(result.categoryId),
      });
      toast({ variant: 'success', title: 'Atributo agregado' });
    },
    onError: (error) => {
      if (!/** @type {any} */ (error).isValidation) notifyError(error.message);
    },
  });

  const removeAttribute = useMutation({
    mutationFn: catalogApi.removeAttribute,
    onSuccess: (result) => {
      void invalidateCategories();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.attributes(result.categoryId),
      });
      toast({ variant: 'success', title: 'Atributo eliminado' });
    },
    // El servidor rechaza eliminar un atributo con valores registrados: ese mensaje
    // es útil tal cual, explica cuántos productos lo usan.
    onError: (error) => notifyError(error.message),
  });

  const deactivateCategory = useMutation({
    mutationFn: catalogApi.deactivateCategory,
    onSuccess: () => {
      void invalidateCategories();
      toast({ variant: 'success', title: 'Categoría desactivada' });
    },
    onError: (error) => notifyError(error.message),
  });

  return {
    createProduct,
    updateProduct,
    deactivateProduct,
    createCategory,
    deactivateCategory,
    addAttribute,
    removeAttribute,
  };
}
