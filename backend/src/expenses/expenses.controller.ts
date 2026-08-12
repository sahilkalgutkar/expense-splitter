import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('groups/:groupId/expenses')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.createExpense(user.id, groupId, dto);
  }

  @Get('groups/:groupId/expenses')
  list(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.expensesService.listGroupExpenses(user.id, groupId);
  }

  @Patch('expenses/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.updateExpense(user.id, id, dto);
  }

  @Delete('expenses/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expensesService.deleteExpense(user.id, id);
  }
}
