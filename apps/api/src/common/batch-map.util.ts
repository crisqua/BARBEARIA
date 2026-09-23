/**
 * Roda `fn` para cada item de `items`, no máximo `concurrency` em paralelo por vez.
 *
 * Usado nas agregações cross-tenant do Super Admin (seção 6.4 do CLAUDE.md): como
 * `users`/`appointments`/etc. têm RLS forçado, somar dado de todos os tenants exige
 * abrir uma transação (`runInTenantContext`) por tenant — cada uma com sua própria
 * conexão. Disparar todas de uma vez via `Promise.all` cresce sem limite junto com o
 * número de tenants e estoura o pool de conexões do Prisma (`P2028: Unable to start
 * a transaction in the given time`, observado com 56 tenants em homolog). Aqui, um
 * pool fixo de workers consome a lista aos poucos — mesmo resultado, sem depender de
 * quantos tenants existem.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
