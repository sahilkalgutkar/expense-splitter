import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Controller('groups/:groupId')
@UseGuards(JwtAuthGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('settle-up')
  getSuggestions(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.settlementsService.getSettleUpSuggestions(user.id, groupId);
  }

  @Get('settlements')
  list(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.settlementsService.listSettlements(user.id, groupId);
  }

  @Post('settlements')
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlementsService.recordSettlement(user.id, groupId, dto);
  }
}
