import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { requireTenantId } from '../common/require-tenant-id';
import { TenantTx } from '../prisma/tenant-context.service';
import { AssignServiceDto } from './dto/assign-service.dto';
import { ProfessionalsService } from './professionals.service';

@Controller('professionals/:professionalId/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class ProfessionalServicesController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  @Roles('admin', 'barbeiro', 'cliente')
  async list(@CurrentTenant() tx: TenantTx, @Param('professionalId') professionalId: string) {
    const links = await tx.professionalService.findMany({ where: { professionalId } });
    if (links.length === 0) return [];

    return tx.service.findMany({ where: { id: { in: links.map((link) => link.serviceId) } } });
  }

  @Post()
  @Roles('admin')
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Body() dto: AssignServiceDto,
  ) {
    await this.professionalsService.assertIsProfessional(tx, professionalId);

    try {
      return await tx.professionalService.create({
        data: { tenantId: requireTenantId(user), professionalId, serviceId: dto.serviceId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') throw new ConflictException('Serviço já associado a este profissional.');
        if (err.code === 'P2003') throw new NotFoundException('Serviço não encontrado neste tenant.');
      }
      throw err;
    }
  }

  @Delete(':serviceId')
  @Roles('admin')
  async unassign(
    @CurrentTenant() tx: TenantTx,
    @Param('professionalId') professionalId: string,
    @Param('serviceId') serviceId: string,
  ) {
    try {
      await tx.professionalService.delete({
        where: { professionalId_serviceId: { professionalId, serviceId } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException();
      }
      throw err;
    }
    return { success: true };
  }
}
