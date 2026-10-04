import { useAuth } from '../contexts/AuthContext';

/**
 * Route-key to role permission map.
 *
 * Admin sidebar keys (Tasks 4/5):
 *   dashboard, map, admin-complaints, admin-emergency, admin-alerts, users, roles, profile
 *
 * Citizen sidebar keys:
 *   dashboard, map, air-quality, traffic, weather, water-flood,
 *   complaints, emergency, profile
 *
 * Future admin modules (preserved for merge, NOT in sidebar yet):
 *   water, electricity, waste, traffic, air-quality, weather
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  // ── Super admin: everything ────────────────────────────────────────────
  super_admin: [
    'dashboard', 'map',
    'admin', 'admin-complaints', 'admin-emergency', 'admin-alerts',
    'users', 'roles', 'profile',
    'traffic', 'air-quality', 'water', 'water-flood', 'electricity', 'waste',
    'complaints', 'emergency', 'weather',
    'case-detail', 'officer-complaints', 'agriculture',
  ],
  // ── City admin ─────────────────────────────────────────────────────────
  city_admin: [
    'dashboard', 'map',
    'admin', 'admin-complaints', 'admin-emergency', 'admin-alerts',
    'users', 'roles', 'profile',
    'traffic', 'air-quality', 'water', 'water-flood', 'electricity', 'waste',
    'complaints', 'emergency', 'weather',
    'case-detail', 'officer-complaints', 'agriculture',
  ],
  // ── Legacy "admin" role ────────────────────────────────────────────────
  admin: [
    'dashboard', 'map',
    'admin', 'admin-complaints', 'admin-emergency', 'admin-alerts',
    'users', 'roles', 'profile',
    'traffic', 'air-quality', 'water', 'water-flood', 'electricity', 'waste',
    'complaints', 'emergency', 'weather',
    'case-detail', 'officer-complaints', 'agriculture',
  ],
  // ── Citizen ────────────────────────────────────────────────────────────
  citizen: [
    'dashboard', 'map',
    'air-quality', 'traffic', 'weather', 'water-flood',
    'complaints', 'emergency', 'profile',
    'case-detail',
  ],
  // ── Operational roles ──────────────────────────────────────────────────
  emergency: [
    'dashboard', 'map', 'emergency', 'officer-complaints', 'profile',
    'case-detail',
  ],
  traffic_officer: [
    'dashboard', 'map', 'traffic', 'officer-complaints', 'profile',
    'case-detail',
  ],
  police: [
    'dashboard', 'map', 'emergency', 'officer-complaints', 'profile',
    'case-detail',
  ],
  fire_service: [
    'dashboard', 'map', 'emergency', 'officer-complaints', 'profile',
    'case-detail',
  ],
};

/** Route keys that belong exclusively to the admin panel */
export const ADMIN_ONLY_KEYS = new Set([
  'admin', 'admin-complaints', 'admin-emergency', 'admin-alerts', 'users', 'roles',
]);

/** Route keys that appear in the citizen panel */
export const CITIZEN_KEYS = new Set([
  'dashboard', 'map', 'air-quality', 'traffic', 'weather',
  'water-flood', 'complaints', 'emergency', 'profile',
]);

export const useRBAC = () => {
  const { user } = useAuth();

  const userRole = user?.roles?.[0]?.name || 'citizen';

  const hasPermission = (routeKey: string): boolean => {
    const allowed =
      ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] ??
      ROLE_PERMISSIONS.citizen;
    return allowed.includes(routeKey);
  };

  const isAdmin = ['admin', 'super_admin', 'city_admin'].includes(userRole);
  const isSuperAdmin = userRole === 'super_admin';

  return { userRole, hasPermission, isAdmin, isSuperAdmin };
};
