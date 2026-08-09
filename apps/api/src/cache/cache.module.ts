import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { MemoryCacheService } from './memory-cache.service';
import { RedisCacheService } from './redis-cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: (): CacheService => {
        const redisUrl = process.env.REDIS_URL;
        return redisUrl ? new RedisCacheService(redisUrl) : new MemoryCacheService();
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
