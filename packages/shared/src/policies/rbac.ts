import { PermissionAction, PermissionModule } from '@sync-erp/database';

/**
 * Privileged role names are normalized here because the database stores
 * company-defined role names rather than a role enum. `Administrator` is the
 * role created by the existing company bootstrap path.
 */
export const PRIVILEGED_ROLE_NAMES = new Set([
  'ADMIN',
  'OWNER',
  'ADMINISTRATOR',
]);

/**
 * These capabilities are privileged management operations. The current
 * schema has no dedicated admin/replay/API-key/integration permission
 * namespace, so they are intentionally role-gated until one is introduced;
 * generic business CRUD permissions are never treated as a grant here.
 */
export const PRIVILEGED_SESSION_CAPABILITIES = [
  'admin',
  'replay',
  'apiKeyManagement',
  'integrationManagement',
  'roleManagement',
] as const;

export type SessionCapability =
  (typeof PRIVILEGED_SESSION_CAPABILITIES)[number];

/**
 * This is the complete tRPC API-key scope catalog. These are the existing
 * external integration scopes; arbitrary strings must never become authority.
 */
export const API_KEY_PERMISSION_REQUIREMENTS = {
  'rental:read': [
    `${PermissionModule.RENTAL}:${PermissionAction.READ}`,
  ],
  'rental:write': [
    `${PermissionModule.RENTAL}:${PermissionAction.CREATE}`,
    `${PermissionModule.RENTAL}:${PermissionAction.UPDATE}`,
    `${PermissionModule.RENTAL}:${PermissionAction.DELETE}`,
    `${PermissionModule.RENTAL}:${PermissionAction.APPROVE}`,
  ],
} as const;

export type ApiKeyPermission = keyof typeof API_KEY_PERMISSION_REQUIREMENTS;

export function normalizeRole(role: string | undefined): string | undefined {
  const normalized = role?.trim().toUpperCase();
  return normalized || undefined;
}

export function isPrivilegedRole(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized ? PRIVILEGED_ROLE_NAMES.has(normalized) : false;
}

/**
 * A delegated role manager may manage ordinary roles, but may not mint an
 * administrative role for itself or another member. Privileged roles remain
 * the explicit authority boundary for assigning privileged roles.
 */
export function canAssignRole(
  actorRole: string | undefined,
  targetRole: string | undefined
): boolean {
  if (!normalizeRole(actorRole) || !normalizeRole(targetRole)) {
    return false;
  }

  return isPrivilegedRole(actorRole) || !isPrivilegedRole(targetRole);
}

export function normalizeCatalogPermission(permission: string): string {
  return permission.trim().toUpperCase();
}

/**
 * Catalog permission matching supports the legacy session wildcards already
 * used by the application. API-key permissions are checked separately and do
 * not use this wildcard path.
 */
export function hasCatalogPermission(
  permissions: readonly string[] | undefined,
  required: string
): boolean {
  const normalized =
    permissions?.map(normalizeCatalogPermission).filter(Boolean) ?? [];
  const requiredPermission = normalizeCatalogPermission(required);
  const module = requiredPermission.split(':')[0];

  return (
    normalized.includes(requiredPermission) ||
    normalized.includes(`${module}:*`) ||
    normalized.includes('*:*')
  );
}

/**
 * A session must have a real membership-derived role. Privileged role names
 * carry the administrative authority. Generic business CRUD permissions do
 * not grant these management capabilities, and a missing role fails closed.
 */
export function canSessionPerformCapability(
  role: string | undefined,
  permissions: readonly string[] | undefined,
  capability: SessionCapability
): boolean {
  // Keep the parameter explicit for call-site clarity and future dedicated
  // capability grants. Until such a grant exists, only trusted privileged
  // roles may cross this boundary.
  void permissions;
  return (
    PRIVILEGED_SESSION_CAPABILITIES.includes(capability) &&
    isPrivilegedRole(role)
  );
}

export function normalizeApiKeyPermissions(
  permissions: readonly string[] | undefined
): string[] {
  return Array.from(
    new Set(
      (permissions ?? [])
        .map((permission) => permission.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function getInvalidApiKeyPermissions(
  permissions: readonly string[] | undefined
): string[] {
  const normalized = normalizeApiKeyPermissions(permissions);
  return normalized.filter(
    (permission) =>
      !Object.prototype.hasOwnProperty.call(
        API_KEY_PERMISSION_REQUIREMENTS,
        permission
      )
  );
}

export function canIssueApiKeyPermission(
  role: string | undefined,
  permissions: readonly string[] | undefined,
  requested: ApiKeyPermission
): boolean {
  if (!normalizeRole(role)) {
    return false;
  }

  if (isPrivilegedRole(role)) {
    return true;
  }

  return API_KEY_PERMISSION_REQUIREMENTS[requested].every((required) =>
    hasCatalogPermission(permissions, required)
  );
}

export function getActorApiKeyPermissions(
  role: string | undefined,
  permissions: readonly string[] | undefined
): ApiKeyPermission[] {
  if (!normalizeRole(role)) {
    return [];
  }

  return (Object.keys(API_KEY_PERMISSION_REQUIREMENTS) as ApiKeyPermission[]).filter(
    (permission) => canIssueApiKeyPermission(role, permissions, permission)
  );
}
