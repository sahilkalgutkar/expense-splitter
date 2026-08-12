import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { GroupsModule } from '../groups/groups.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [GroupsModule, BalancesModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
})
export class SettlementsModule {}
