import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips sending and logs a warning (with the invite link) when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.sendInviteEmail(
      'dave@example.com',
      'Trip',
      'https://app.example.com/invite/abc',
    );

    expect(sendMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dave@example.com'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://app.example.com/invite/abc'),
    );
  });

  it('sends via Resend with the configured from address when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.INVITE_FROM_EMAIL = 'invites@spliteasy.test';
    const service = new EmailService();

    await service.sendInviteEmail(
      'dave@example.com',
      'Trip',
      'https://app.example.com/invite/abc',
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'invites@spliteasy.test',
        to: 'dave@example.com',
        subject: expect.stringContaining('Trip'),
        html: expect.stringContaining('https://app.example.com/invite/abc'),
      }),
    );
  });

  it('defaults the from address when INVITE_FROM_EMAIL is not set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    delete process.env.INVITE_FROM_EMAIL;
    const service = new EmailService();

    await service.sendInviteEmail(
      'dave@example.com',
      'Trip',
      'https://app.example.com/invite/abc',
    );

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'invites@example.com' }),
    );
  });

  it('does not construct a Resend client at all when no API key is present', () => {
    delete process.env.RESEND_API_KEY;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { Resend } = jest.requireMock('resend');
    Resend.mockClear();

    new EmailService();

    expect(Resend).not.toHaveBeenCalled();
  });
});
