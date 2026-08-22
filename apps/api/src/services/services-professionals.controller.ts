import { Controller, Get, NotFoundException, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { TenantTx } from '../prisma/tenant-context.service';

/** Lookup reverso — usado pelo fluxo de agendamento da Sprint 5 (serviço -> profissionais que o fazem). */
@Controller('services/:serviceId/professionals')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles('admin', 'barbeiro', 'cliente')
export class ServicesProfessionalsController {
  @Get()
  async list(@CurrentTenant() tx: TenantTx, @Param('serviceId') serviceId: string) {
    const service = await tx.service.findFirst({ where: { id: serviceId, active: true } });
    if (!service) throw new NotFoundException('Serviço não encontrado ou inativo.');

    const links = await tx.professionalService.findMany({
      where: { serviceId },
      select: { professionalId: true },
    });

    if (links.length === 0) return [];

    return tx.user.findMany({
      where: { id: { in: links.map((link) => link.professionalId) }, role: 'barbeiro', active: true },
      select: { id: true, name: true, email: true, phone: true },
    });
  }
}
