import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { resetDatabase } from './reset-db';

function firstCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookie) throw new Error('Expected a Set-Cookie header on the response');
  return cookie;
}

describe('Full app flow (e2e, real Postgres)', () => {
  let app: INestApplication<App>;
  let server: App;

  let aliceToken: string;
  let aliceId: string;
  let aliceRefreshCookie: string;
  let bobToken: string;
  let bobId: string;
  let carolToken: string;
  let carolId: string;
  let groupId: string;
  let inviteToken: string;
  let recurringId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();

    const prisma = app.get(PrismaService);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to a protected route', async () => {
    await request(server).get('/api/groups').expect(401);
  });

  it('registers alice, bob, and carol', async () => {
    const aliceRes = await request(server)
      .post('/api/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
      })
      .expect(201);
    aliceToken = aliceRes.body.accessToken;
    aliceId = aliceRes.body.user.id;
    aliceRefreshCookie = firstCookie(aliceRes);
    expect(aliceRefreshCookie).toContain('refresh_token=');

    const bobRes = await request(server)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'password123', name: 'Bob' })
      .expect(201);
    bobToken = bobRes.body.accessToken;
    bobId = bobRes.body.user.id;

    const carolRes = await request(server)
      .post('/api/auth/register')
      .send({
        email: 'carol@example.com',
        password: 'password123',
        name: 'Carol',
      })
      .expect(201);
    carolToken = carolRes.body.accessToken;
    carolId = carolRes.body.user.id;
  });

  it('rejects duplicate registration with an already-used email', async () => {
    await request(server)
      .post('/api/auth/register')
      .send({
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice Again',
      })
      .expect(409);
  });

  it('rejects login with the wrong password and accepts the right one', async () => {
    await request(server)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' })
      .expect(401);

    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('refreshes the access token using the refresh cookie and rotates it', async () => {
    const res = await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', aliceRefreshCookie)
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    aliceToken = res.body.accessToken;
    aliceRefreshCookie = firstCookie(res);
  });

  it('creates a group as alice, making her the OWNER', async () => {
    const res = await request(server)
      .post('/api/groups')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Ski Trip' })
      .expect(201);
    groupId = res.body.id;
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].role).toBe('OWNER');
  });

  it('forbids carol, who is not a member, from viewing the group', async () => {
    await request(server)
      .get(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${carolToken}`)
      .expect(403);
  });

  it('invites bob to the group and returns a usable token', async () => {
    const res = await request(server)
      .post(`/api/groups/${groupId}/invites`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: 'bob@example.com' })
      .expect(201);
    inviteToken = res.body.token;
    expect(inviteToken).toBeTruthy();
  });

  it('rejects invite acceptance from the wrong email address', async () => {
    await request(server)
      .post(`/api/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${carolToken}`)
      .expect(403);
  });

  it('lets bob accept the invite and join the group', async () => {
    const res = await request(server)
      .post(`/api/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(201);
    expect(res.body.members).toHaveLength(2);
  });

  it('rejects accepting the same invite twice', async () => {
    await request(server)
      .post(`/api/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(400);
  });

  it('creates an equal-split expense paid by alice', async () => {
    const res = await request(server)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        description: 'Cabin',
        amountCents: 10000,
        paidById: aliceId,
        splitType: 'EQUAL',
        participantUserIds: [aliceId, bobId],
      })
      .expect(201);
    expect(res.body.splits).toHaveLength(2);
    expect(
      res.body.splits.reduce((sum: number, s: any) => sum + s.shareCents, 0),
    ).toBe(10000);
  });

  it('rejects an expense paid by someone outside the group', async () => {
    await request(server)
      .post(`/api/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        description: 'Bad',
        amountCents: 1000,
        paidById: carolId,
        splitType: 'EQUAL',
        participantUserIds: [aliceId, bobId],
      })
      .expect(400);
  });

  it('computes real balances from the recorded expense', async () => {
    const res = await request(server)
      .get(`/api/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    const alice = res.body.find((b: any) => b.userId === aliceId);
    const bob = res.body.find((b: any) => b.userId === bobId);
    expect(alice.netCents).toBe(5000);
    expect(bob.netCents).toBe(-5000);
  });

  it('suggests a settle-up payment from bob to alice', async () => {
    const res = await request(server)
      .get(`/api/groups/${groupId}/settle-up`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        fromUserId: bobId,
        toUserId: aliceId,
        amountCents: 5000,
      }),
    ]);
  });

  it('records the settlement and balances zero out', async () => {
    await request(server)
      .post(`/api/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ fromUserId: bobId, toUserId: aliceId, amountCents: 5000 })
      .expect(201);

    const res = await request(server)
      .get(`/api/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    const alice = res.body.find((b: any) => b.userId === aliceId);
    const bob = res.body.find((b: any) => b.userId === bobId);
    expect(alice.netCents).toBe(0);
    expect(bob.netCents).toBe(0);
  });

  it('creates a recurring expense and lists it for the group', async () => {
    const res = await request(server)
      .post(`/api/groups/${groupId}/recurring`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        description: 'Rent',
        amountCents: 20000,
        paidById: aliceId,
        splitType: 'EQUAL',
        participantUserIds: [aliceId, bobId],
        cadence: 'MONTHLY',
      })
      .expect(201);
    recurringId = res.body.id;

    const listRes = await request(server)
      .get(`/api/groups/${groupId}/recurring`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('forbids a non-creator, non-owner member from toggling the recurring expense', async () => {
    await request(server)
      .patch(`/api/recurring/${recurringId}/active`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ active: false })
      .expect(403);
  });

  it('allows the owner to deactivate the recurring expense', async () => {
    await request(server)
      .patch(`/api/recurring/${recurringId}/active`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ active: false })
      .expect(200);
  });

  it('removes bob from the group', async () => {
    await request(server)
      .delete(`/api/groups/${groupId}/members/${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const res = await request(server)
      .get(`/api/groups/${groupId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res.body.members).toHaveLength(1);
  });

  it('logs alice out, revoking the refresh token so it can no longer be used', async () => {
    await request(server)
      .post('/api/auth/logout')
      .set('Cookie', aliceRefreshCookie)
      .expect(200);

    await request(server)
      .post('/api/auth/refresh')
      .set('Cookie', aliceRefreshCookie)
      .expect(401);
  });
});
