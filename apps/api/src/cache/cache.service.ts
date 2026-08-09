/**
 * Cache de config de tenant (cor/logo/módulos) — seção 8.3 do CLAUDE.md.
 * Duas implementações: Redis (produção, via REDIS_URL) e memória (dev local
 * sem depender de uma instância Redis rodando). Ver cache.module.ts.
 */
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  abstract del(key: string): Promise<void>;
}
