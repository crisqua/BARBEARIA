import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const BUCKET = 'tenant-logos';

/**
 * Presigned URL do Supabase Storage (seção 6.1.6 do CLAUDE.md) — o cliente
 * (painel-barbearia) sobe o arquivo direto pro Supabase, sem passar pelo
 * NestJS. Tamanho/tipo permitido são garantidos pela config do bucket em si
 * (file_size_limit + allowed_mime_types), não só pela validação daqui.
 *
 * Client inicializado sob demanda (não no construtor): se SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY ainda não estiverem configuradas (ex: logo após
 * antes de fazer o setup do bucket), só o upload de logo falha — não derruba
 * o boot da aplicação inteira.
 */
@Injectable()
export class TenantLogoStorageService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Upload de logo indisponível: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas.',
      );
    }

    this.client = createClient(url, serviceRoleKey);
    return this.client;
  }

  async createUploadUrl(tenantId: string, extension: string) {
    const client = this.getClient();
    const path = `${tenantId}/${randomUUID()}.${extension}`;

    const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) {
      throw new InternalServerErrorException('Não foi possível gerar a URL de upload do logo.');
    }

    const { data: publicUrlData } = client.storage.from(BUCKET).getPublicUrl(path);

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  }
}
