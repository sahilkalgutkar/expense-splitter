import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { GroupsModule } from '../groups/groups.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [GroupsModule, EmailModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
