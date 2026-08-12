import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendInviteEmail(toEmail: string, groupName: string, inviteLink: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping invite email to ${toEmail}. Invite link: ${inviteLink}`,
      );
      return;
    }

    await this.resend.emails.send({
      from: process.env.INVITE_FROM_EMAIL ?? 'invites@example.com',
      to: toEmail,
      subject: `You've been invited to join "${groupName}" on SplitEasy`,
      html: `
        <p>You've been invited to join the group <strong>${groupName}</strong> on SplitEasy.</p>
        <p><a href="${inviteLink}">Click here to accept the invite</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
  }
}
