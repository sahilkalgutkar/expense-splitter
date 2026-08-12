import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post('groups/:groupId/invites')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(user.id, groupId, dto);
  }

  @Get('groups/:groupId/invites')
  listPending(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.invitesService.listPendingForGroup(user.id, groupId);
  }

  @Post('invites/:token/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('token') token: string) {
    return this.invitesService.acceptInvite(user.email, user.id, token);
  }
}
