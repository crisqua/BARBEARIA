import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, UserRole } from './types/authenticated-user';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
  type?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (!tenant || tenant.status !== 'active') {
      throw new NotFoundException('Barbearia não encontrada.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const created = await this.tenantContext.runInTenantContext(tenant.id, async (tx) => {
      const existing = await tx.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
      });
      if (existing) {
        throw new ConflictException('E-mail já cadastrado nesta barbearia.');
      }

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          role: 'cliente',
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });
    });

    const user: AuthenticatedUser = {
      id: created.id,
      tenantId: created.tenantId,
      role: created.role as UserRole,
    };
    return { user, tokens: await this.issueTokens(user) };
  }

  async validateCredentials(dto: LoginDto): Promise<AuthenticatedUser> {
    const invalidCredentials = () => new UnauthorizedException('Credenciais inválidas.');

    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      if (!tenant || tenant.status !== 'active') throw invalidCredentials();

      const found = await this.tenantContext.runInTenantContext(tenant.id, (tx) =>
        tx.user.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
        }),
      );
      if (!found || !(await bcrypt.compare(dto.password, found.passwordHash))) {
        throw invalidCredentials();
      }
      return { id: found.id, tenantId: found.tenantId, role: found.role as UserRole };
    }

    // Sem tenantSlug = login de Super Admin. Roda fora de qualquer tenant
    // context (seção 6.4 do CLAUDE.md) — cai no braço "tenant_id IS NULL" da
    // policy de RLS ajustada na migration 0002.
    const found = await this.prisma.user.findFirst({
      where: { role: 'super_admin', email: dto.email },
    });
    if (!found || !(await bcrypt.compare(dto.password, found.passwordHash))) {
      throw invalidCredentials();
    }
    return { id: found.id, tenantId: found.tenantId, role: found.role as UserRole };
  }

  async issueTokens(user: AuthenticatedUser): Promise<TokenPair> {
    const payload = { sub: user.id, tenantId: user.tenantId, role: user.role };

    // `expiresIn` do jsonwebtoken só aceita number ou um formato restrito
    // ("15m", "7d", ...) — a env var é validada por convenção própria, não pelo compilador.
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'],
      },
    );

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token não é um refresh token.');
    }

    const user: AuthenticatedUser = { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
    return this.issueTokens(user);
  }
}
