import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAcceptInvite } from '../api/invites';
import { useAuth } from '../auth/AuthContext';

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const acceptInvite = useAcceptInvite();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !token || acceptInvite.isPending || done) return;
    acceptInvite.mutate(token, {
      onSuccess: (group) => {
        setDone(true);
        navigate(`/groups/${group.id}`);
      },
      onError: (err) => {
        setError(isAxiosError(err) ? (err.response?.data?.message ?? 'Could not accept invite') : 'Could not accept invite');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

  if (authLoading) {
    return (
      <Layout>
        <p className="text-slate-500">Loading…</p>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <Card className="mx-auto max-w-sm text-center">
          <p className="mb-4 text-slate-700">Log in or create an account to accept this invite.</p>
          <div className="flex justify-center gap-3">
            <Link to="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
            <Link to="/register">
              <Button>Sign up</Button>
            </Link>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card className="mx-auto max-w-sm text-center">
        {error ? <p className="text-red-600">{error}</p> : <p className="text-slate-500">Joining group…</p>}
      </Card>
    </Layout>
  );
}
