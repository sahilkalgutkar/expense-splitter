import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

describe('AuthService', () => {
  let prisma: any;
  let jwtService: any;
  let usersService: any;
  let authService: AuthService;

  const user = {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeAll(async () => {
    user.passwordHash = await bcrypt.hash('correct-password', 10);
  });

  beforeEach(() => {
    prisma = {
      user: { create: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    usersService = {
      findByEmail: jest.fn(),
      toPublic: jest.fn((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
      })),
    };

    authService = new AuthService(prisma, jwtService, usersService);
    prisma.refreshToken.create.mockResolvedValue({});
  });

  describe('register', () => {
    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        authService.register({
          email: user.email,
          password: 'whatever123',
          name: 'Alice',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and issues tokens for a new user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await authService.register({
        email: user.email,
        password: 'correct-password',
        name: 'Alice',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe('correct-password');
      expect(createArgs.data.email).toBe(user.email);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      });
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('stores only a SHA-256 hash of the refresh token, never the raw value', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await authService.register({
        email: user.email,
        password: 'correct-password',
        name: 'Alice',
      });

      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.tokenHash).toBe(hashToken(result.refreshToken));
      expect(createArgs.data.tokenHash).not.toBe(result.refreshToken);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        authService.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens when credentials are correct', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      const result = await authService.login({
        email: user.email,
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.id).toBe(user.id);
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no token is provided', async () => {
      await expect(authService.refresh(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the token is unknown, revoked, or expired', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(authService.refresh('some-raw-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates the token: revokes the old one and issues a new pair', async () => {
      const rawToken = 'raw-refresh-token';
      prisma.refreshToken.findFirst.mockResolvedValue({ id: 'rt-1', user });

      const result = await authService.refresh(rawToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: hashToken(rawToken),
          revoked: false,
          expiresAt: { gt: expect.any(Date) },
        },
        include: { user: true },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).not.toBe(rawToken);
    });
  });

  describe('logout', () => {
    it('does nothing when no token is provided', async () => {
      await authService.logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokes the matching refresh token by its hash', async () => {
      const rawToken = 'raw-refresh-token';

      await authService.logout(rawToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(rawToken), revoked: false },
        data: { revoked: true },
      });
    });
  });
});
