import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireGuest, RequirePermission } from './guards.jsx';
import { NotFoundPage } from './NotFoundPage.jsx';
import { AppLayout } from '@/layouts/AppLayout.jsx';
import { AuthLayout } from '@/layouts/AuthLayout.jsx';
import { LoginPage } from '@/features/auth/pages/LoginPage.jsx';
import { PageLoader } from '@/components/feedback/states.jsx';

/**
 * Rutas de la aplicación.
 *
 * Las rutas están en español porque son parte de la interfaz y el usuario las ve en
 * la barra de direcciones. El código sigue en inglés, que es la convención del
 * lenguaje: mezclar idiomas en los identificadores es peor que separarlos así.
 *
 * Cada sección va tras su guardia de permiso. Eso no es seguridad —la decisión real
 * la toma el servidor en cada petición— sino cortesía: evita que alguien llegue a
 * una pantalla que solo podría mostrarle un 403.
 *
 * Los módulos se cargan de forma diferida. El inicio de sesión y el panel entran en
 * el paquete inicial porque son lo primero que todos ven; el resto llega cuando hace
 * falta, y así quien solo consulta el panel no descarga el catálogo entero.
 */
const ProductsPage = lazy(() =>
  import('@/features/catalog/pages/ProductsPage.jsx').then((m) => ({ default: m.ProductsPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage.jsx').then((m) => ({
    default: m.DashboardPage,
  })),
);
const ProductFormPage = lazy(() =>
  import('@/features/catalog/pages/ProductFormPage.jsx').then((m) => ({
    default: m.ProductFormPage,
  })),
);
const CategoriesPage = lazy(() =>
  import('@/features/catalog/pages/CategoriesPage.jsx').then((m) => ({ default: m.CategoriesPage })),
);
const StockPage = lazy(() =>
  import('@/features/inventory/pages/StockPage.jsx').then((m) => ({ default: m.StockPage })),
);
const KardexPage = lazy(() =>
  import('@/features/inventory/pages/KardexPage.jsx').then((m) => ({ default: m.KardexPage })),
);
const MovementsPage = lazy(() =>
  import('@/features/inventory/pages/MovementsPage.jsx').then((m) => ({ default: m.MovementsPage })),
);
const SuppliersPage = lazy(() =>
  import('@/features/purchasing/pages/SuppliersPage.jsx').then((m) => ({ default: m.SuppliersPage })),
);
const SupplierDetailPage = lazy(() =>
  import('@/features/purchasing/pages/SupplierDetailPage.jsx').then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const PurchaseOrdersPage = lazy(() =>
  import('@/features/purchasing/pages/PurchaseOrdersPage.jsx').then((m) => ({
    default: m.PurchaseOrdersPage,
  })),
);
const PurchaseOrderFormPage = lazy(() =>
  import('@/features/purchasing/pages/PurchaseOrderFormPage.jsx').then((m) => ({
    default: m.PurchaseOrderFormPage,
  })),
);
const PurchaseOrderDetailPage = lazy(() =>
  import('@/features/purchasing/pages/PurchaseOrderDetailPage.jsx').then((m) => ({
    default: m.PurchaseOrderDetailPage,
  })),
);

const PosPage = lazy(() =>
  import('@/features/sales/pages/PosPage.jsx').then((m) => ({ default: m.PosPage })),
);
const SalesPage = lazy(() =>
  import('@/features/sales/pages/SalesPage.jsx').then((m) => ({ default: m.SalesPage })),
);
const SaleDetailPage = lazy(() =>
  import('@/features/sales/pages/SaleDetailPage.jsx').then((m) => ({ default: m.SaleDetailPage })),
);
const CustomersPage = lazy(() =>
  import('@/features/sales/pages/CustomersPage.jsx').then((m) => ({ default: m.CustomersPage })),
);
const CustomerDetailPage = lazy(() =>
  import('@/features/sales/pages/CustomerDetailPage.jsx').then((m) => ({
    default: m.CustomerDetailPage,
  })),
);

const PortfolioPage = lazy(() =>
  import('@/features/credit/pages/PortfolioPage.jsx').then((m) => ({ default: m.PortfolioPage })),
);
const CustomerAccountPage = lazy(() =>
  import('@/features/credit/pages/CustomerAccountPage.jsx').then((m) => ({
    default: m.CustomerAccountPage,
  })),
);
const PaymentsPage = lazy(() =>
  import('@/features/credit/pages/PaymentsPage.jsx').then((m) => ({ default: m.PaymentsPage })),
);

const UsersPage = lazy(() =>
  import('@/features/admin/pages/UsersPage.jsx').then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import('@/features/admin/pages/RolesPage.jsx').then((m) => ({ default: m.RolesPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/admin/pages/SettingsPage.jsx').then((m) => ({ default: m.SettingsPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage.jsx').then((m) => ({ default: m.ReportsPage })),
);
const ChangePasswordPage = lazy(() =>
  import('@/features/admin/pages/ChangePasswordPage.jsx').then((m) => ({
    default: m.ChangePasswordPage,
  })),
);
const ProfilePage = lazy(() =>
  import('@/features/admin/pages/ProfilePage.jsx').then((m) => ({ default: m.ProfilePage })),
);

export function AppRoutes() {
  return (
    <Routes>
      {/* Sin sesión */}
      <Route element={<RequireGuest />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Route>

      {/* Con sesión */}
      <Route element={<RequireAuth />}>
        <Route
          element={
            <Suspense fallback={<PageLoader label="Cargando módulo…" />}>
              <AppLayout />
            </Suspense>
          }
        >
          <Route path="/" element={<DashboardPage />} />

          {/* Catálogo */}
          <Route element={<RequirePermission permission="products:read" />}>
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
          </Route>

          <Route element={<RequirePermission permission="products:create" />}>
            <Route path="/productos/nuevo" element={<ProductFormPage />} />
          </Route>

          <Route element={<RequirePermission permission="products:update" />}>
            <Route path="/productos/:id" element={<ProductFormPage />} />
          </Route>

          {/* Inventario */}
          <Route element={<RequirePermission permission="stock:read" />}>
            <Route path="/existencias" element={<StockPage />} />
            <Route path="/movimientos" element={<MovementsPage />} />
            {/* El kardex cuelga del producto pero es una vista de inventario: su
                permiso es el de existencias, no el de catálogo. */}
            <Route path="/productos/:id/kardex" element={<KardexPage />} />
          </Route>

          {/* Compras. `/compras/nueva` se declara antes que `/compras/:id` para que
              «nueva» no se interprete como un identificador. */}
          <Route element={<RequirePermission permission="purchases:create" />}>
            <Route path="/compras/nueva" element={<PurchaseOrderFormPage />} />
          </Route>

          <Route element={<RequirePermission permission="purchases:read" />}>
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/proveedores/:id" element={<SupplierDetailPage />} />
            <Route path="/compras" element={<PurchaseOrdersPage />} />
            <Route path="/compras/:id" element={<PurchaseOrderDetailPage />} />
          </Route>

          {/* Ventas. `/ventas/nueva` antes que `/ventas/:id`, para que «nueva» no
              se interprete como un identificador. */}
          <Route element={<RequirePermission permission="sales:create" />}>
            <Route path="/ventas/nueva" element={<PosPage />} />
          </Route>

          <Route element={<RequirePermission permission="sales:read" />}>
            <Route path="/ventas" element={<SalesPage />} />
            <Route path="/ventas/:id" element={<SaleDetailPage />} />
          </Route>

          <Route element={<RequirePermission permission="customers:read" />}>
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/clientes/:id" element={<CustomerDetailPage />} />
          </Route>

          {/* Crédito y cartera. `/abonos` va antes que `/creditos/:customerId`
              porque son rutas hermanas y el orden evita ambigüedad al leerlas. */}
          <Route element={<RequirePermission permission="payments:read" />}>
            <Route path="/abonos" element={<PaymentsPage />} />
          </Route>

          <Route element={<RequirePermission permission="credit:read" />}>
            <Route path="/creditos" element={<PortfolioPage />} />
            <Route path="/creditos/:customerId" element={<CustomerAccountPage />} />
          </Route>

          {/* Reportes */}
          <Route element={<RequirePermission permission="reports:read" />}>
            <Route path="/reportes" element={<ReportsPage />} />
          </Route>

          {/* Administración */}
          <Route element={<RequirePermission permission="users:read" />}>
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/roles" element={<RolesPage />} />
          </Route>

          <Route element={<RequirePermission permission="settings:manage" />}>
            <Route path="/configuracion" element={<SettingsPage />} />
          </Route>

          {/* Sin guardia de permiso: cualquiera puede cambiar su propia clave, y
              quien llega con una temporal aún no tiene por qué tener ninguno. */}
          <Route path="/cambiar-clave" element={<ChangePasswordPage />} />

          {/* Igual sin guardia de permiso: es la propia cuenta de quien mira. */}
          <Route path="/perfil" element={<ProfilePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="/inicio" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
