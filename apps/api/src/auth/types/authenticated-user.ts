export type UserRole = 'super_admin' | 'admin' | 'barbeiro' | 'cliente';

/** Payload decodificado do access token (JWT), validado pelo JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  role: UserRole;
}
