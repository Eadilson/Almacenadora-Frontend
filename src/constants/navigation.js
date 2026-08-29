import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  ShoppingCart,
  Tag,
  Truck,
  Users,
} from 'lucide-react';

/**
 * Navegación de la aplicación.
 *
 * Cada entrada declara el **permiso** que la habilita y, si aplica, la capacidad
 * del plan. La barra lateral se construye filtrando esta lista: así, un vendedor
 * simplemente no ve «Compras», en lugar de verla y encontrarse un 403.
 *
 * Se declara por permiso y nunca por nombre de rol: los roles son configurables
 * por cada empresa (ADR-010).
 *
 * `status: 'pending'` marca los módulos aún no construidos. Se muestran
 * deshabilitados con una etiqueta, para que el avance sea visible y nadie tenga que
 * adivinar si algo falta o está roto.
 *
 * @typedef {object} NavigationItem
 * @property {string} label
 * @property {string} to
 * @property {React.ElementType} icon
 * @property {string} [permission]
 * @property {string} [feature]
 * @property {'available'|'pending'} status
 *
 * @typedef {{ title: string|null, items: NavigationItem[] }} NavigationGroup
 */

/** @type {NavigationGroup[]} */
export const navigation = [
  {
    title: null,
    items: [
      {
        label: 'Panel',
        to: '/',
        icon: LayoutDashboard,
        status: 'available',
      },
    ],
  },
  {
    title: 'Operación',
    items: [
      {
        label: 'Punto de venta',
        to: '/ventas/nueva',
        icon: ShoppingCart,
        permission: 'sales:create',
        status: 'available',
      },
      {
        label: 'Ventas',
        to: '/ventas',
        icon: Receipt,
        permission: 'sales:read',
        status: 'available',
      },
      {
        label: 'Clientes',
        to: '/clientes',
        icon: Users,
        permission: 'customers:read',
        status: 'available',
      },
      {
        label: 'Créditos',
        to: '/creditos',
        icon: CreditCard,
        permission: 'credit:read',
        feature: 'CREDIT_SALES',
        status: 'available',
      },
      {
        label: 'Abonos',
        to: '/abonos',
        icon: HandCoins,
        permission: 'payments:read',
        feature: 'CREDIT_SALES',
        status: 'available',
      },
    ],
  },
  {
    title: 'Inventario',
    items: [
      {
        label: 'Productos',
        to: '/productos',
        icon: Package,
        permission: 'products:read',
        status: 'available',
      },
      {
        label: 'Categorías',
        to: '/categorias',
        icon: Tag,
        permission: 'products:read',
        status: 'available',
      },
      {
        label: 'Existencias',
        to: '/existencias',
        icon: Boxes,
        permission: 'stock:read',
        status: 'available',
      },
      {
        label: 'Movimientos',
        to: '/movimientos',
        icon: ClipboardList,
        permission: 'stock:read',
        status: 'available',
      },
    ],
  },
  {
    title: 'Abastecimiento',
    items: [
      {
        label: 'Compras',
        to: '/compras',
        icon: FileText,
        permission: 'purchases:read',
        status: 'available',
      },
      {
        label: 'Proveedores',
        to: '/proveedores',
        icon: Truck,
        permission: 'purchases:read',
        status: 'available',
      },
    ],
  },
  {
    title: 'Análisis',
    items: [
      {
        label: 'Reportes',
        to: '/reportes',
        icon: BarChart3,
        permission: 'reports:read',
        status: 'available',
      },
    ],
  },
  {
    title: 'Administración',
    items: [
      {
        label: 'Usuarios',
        to: '/usuarios',
        icon: UserCog,
        permission: 'users:read',
        status: 'available',
      },
      {
        label: 'Roles y permisos',
        to: '/roles',
        icon: ShieldCheck,
        permission: 'users:read',
        status: 'available',
      },
      {
        label: 'Configuración',
        to: '/configuracion',
        icon: Settings,
        permission: 'settings:manage',
        status: 'available',
      },
    ],
  },
];

/**
 * Filtra la navegación según los permisos y el plan.
 *
 * @param {NavigationGroup[]} groups
 * @param {(permission: string) => boolean} can
 * @param {(feature: string) => boolean} hasFeature
 * @returns {NavigationGroup[]}
 */
export function visibleNavigation(groups, can, hasFeature) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.permission || can(item.permission)) && (!item.feature || hasFeature(item.feature)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
