import { TenantTx } from '../prisma/tenant-context.service';

/** Grava um evento em `platform_activities` — sempre dentro de uma transação
 * já com tenant context configurado (`tx` vindo de `TenantContextService`),
 * nunca com o client global. Ver seção "Atividade recente" do admin-desenvolvain.md. */
export function logActivity(tx: TenantTx, tenantId: string, action: string, description: string) {
  return tx.platformActivity.create({ data: { tenantId, action, description } });
}

/** Formata centavos como "R$ 1.234,56" (pt-BR) — mesma convenção do frontend. */
export function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
