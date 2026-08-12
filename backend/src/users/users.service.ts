import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(user: { id: string; email: string; name: string; createdAt: Date }): PublicUser {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findManyByEmails(emails: string[]) {
    return this.prisma.user.findMany({ where: { email: { in: emails } } });
  }

  async getPublicProfile(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }
}
