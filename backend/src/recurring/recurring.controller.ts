import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RecurringService } from './recurring.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringActiveDto } from './dto/update-recurring-active.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post('groups/:groupId/recurring')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.recurringService.create(user.id, groupId, dto);
  }

  @Get('groups/:groupId/recurring')
  list(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.recurringService.listForGroup(user.id, groupId);
  }

  @Patch('recurring/:id/active')
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringActiveDto,
  ) {
    return this.recurringService.setActive(user.id, id, dto.active);
  }
}
