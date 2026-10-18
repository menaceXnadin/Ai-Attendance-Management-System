import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/integrations/api/client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Copy16Regular,
  ArrowSync16Regular,
  Password20Regular,
  Clock20Regular,
  Clock16Regular,
  Mail16Regular,
  Person16Regular,
  ShieldLock16Regular,
  Warning16Regular,
  Info16Regular,
  Key16Regular,
  CheckmarkCircle16Filled,
  CheckmarkCircle24Filled,
} from '@fluentui/react-icons';

interface ResetRequest {
  id: number;
  email: string;
  full_name: string;
  role: string;
  created_at: string; // UTC ISO string with Z
  expires_at: string; // UTC ISO string with Z
  expired: boolean;
  token: string;
}

const AdminGenerateResetLinkPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data: requestsData, isLoading: requestsLoading, refetch } = useQuery({
    queryKey: ['password-reset-requests'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; requests: ResetRequest[] }>('/auth/admin/reset-requests');
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const onGenerate = async (userEmail?: string) => {
    const targetEmail = userEmail || email;
    if (!targetEmail) return;
    setLoading(true);
    setLink(null);
    try {
      const res = await apiClient.post<{ success: boolean; message: string; reset_url?: string }>(
        '/auth/admin/generate-reset-link',
        { email: targetEmail }
      );
      if (res.data?.success && res.data.reset_url) {
        setLink(res.data.reset_url);
        toast({ title: 'Reset link generated', description: 'Share this link securely with the user.' });
        refetch(); // Refresh pending requests
      } else {
        toast({ title: 'Unable to generate', description: res.data?.message || 'Check the email and try again', variant: 'destructive' });
      }
    } catch (err: unknown) {
      const apiStatus = (err as { response?: { status?: number } })?.response?.status;
      const msg = apiStatus === 401 ? 'Unauthorized. Admin access required.' : 'Failed to generate link';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Link copied to clipboard' });
  };

  const getTimeRemaining = (expiresAt: string, expired: boolean) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    if (expired) {
      if (minutes < -60) return `Expired ${Math.abs(Math.floor(minutes / 60))}h ago`;
      return `Expired ${Math.abs(minutes)}m ago`;
    }
    if (minutes < 60) return `${minutes}m remaining`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
  };

  const pendingRequests = requestsData?.requests || [];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-page-title text-text-primary">Password Reset Management</h1>
        <p className="text-body text-text-muted mt-1">
          Review pending institutional reset requests and issue secure one-time credentials
        </p>
      </div>

      {/* Pending Requests Section */}
      <Card className="border-0 shadow overflow-hidden">
        <CardHeader className="border-b border-border-subtle px-5 py-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Clock20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                Pending Account Reset Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" shape="pill" className="tabular-nums">{pendingRequests.length}</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-caption text-text-muted">
                Incoming requests submitted via the institutional portal
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={requestsLoading}
            >
              <ArrowSync16Regular className={requestsLoading ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {requestsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-body text-text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
              <span>Loading requests...</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-success-subtle text-status-success">
                <CheckmarkCircle24Filled aria-hidden />
              </div>
              <h3 className="text-subheading text-text-primary">All Clear</h3>
              <p className="text-body text-text-muted mt-0.5">No pending password reset requests at this time</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                    <TableHead className="h-9 px-4 text-caption-strong text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Person16Regular aria-hidden />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="h-9 px-4 text-caption-strong text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Mail16Regular aria-hidden />
                        Email
                      </div>
                    </TableHead>
                    <TableHead className="h-9 px-4 text-caption-strong text-text-secondary">Role</TableHead>
                    <TableHead className="h-9 px-4 text-caption-strong text-text-secondary">Requested</TableHead>
                    <TableHead className="h-9 px-4 text-caption-strong text-text-secondary">Status</TableHead>
                    <TableHead className="h-9 px-4 text-right text-caption-strong text-text-secondary">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((req) => (
                    <TableRow key={req.id} className="border-b border-border-subtle hover:bg-surface-hover">
                      <TableCell className="px-4 py-2.5 text-body-strong text-text-primary">{req.full_name}</TableCell>
                      <TableCell className="px-4 py-2.5 text-body text-text-secondary">{req.email}</TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Badge variant="secondary" shape="pill" className="capitalize">
                          {req.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-body text-text-muted tabular-nums">
                        {new Date(req.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        {req.expired ? (
                          <span className="flex items-center gap-1 text-caption text-status-error">
                            <Warning16Regular aria-hidden />
                            {getTimeRemaining(req.expires_at, req.expired)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-caption-strong text-status-success">
                            <Clock16Regular aria-hidden />
                            {getTimeRemaining(req.expires_at, req.expired)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        {req.expired ? (
                          <Badge variant="destructive" shape="pill">
                            Expired
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const url = `${window.location.origin}/reset-password?token=${req.token}`;
                              copyToClipboard(url);
                            }}
                          >
                            <Copy16Regular aria-hidden /> Copy Link
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Generation Section */}
      <Card className="max-w-2xl border-0 shadow overflow-hidden">
        <CardHeader className="space-y-0.5 border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <Password20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Issue Direct Reset Link
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            Create an immediate one-time recovery URL for any registered user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-body-strong text-text-primary">
              Target User Email
            </Label>
            <div className="relative">
              <Mail16Regular className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@institution.edu"
                className="pl-9"
              />
            </div>
          </div>

          {link && (
            <div className="space-y-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-3" role="status">
              <div className="flex items-center gap-2 text-body-strong text-text-primary">
                <CheckmarkCircle16Filled className="shrink-0 text-status-success" aria-hidden />
                <span>Link Generated Successfully</span>
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-caption"
                  aria-label="Generated reset link"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(link!)}
                  className="flex-shrink-0"
                >
                  <Copy16Regular aria-hidden /> Copy
                </Button>
              </div>
              <p className="flex items-center gap-1 text-caption text-text-secondary">
                <ShieldLock16Regular className="shrink-0 text-status-success" aria-hidden />
                Share securely • Valid for 1 hour • Single-use only
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2">
            <Info16Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
            <p className="text-body text-text-primary">
              Always verify the user's institutional identity before distributing temporary reset URLs.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border-subtle bg-surface-subtle px-5 py-3">
          <Button
            onClick={() => onGenerate()}
            disabled={loading || !email.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <ArrowSync16Regular className="animate-spin" aria-hidden />
                Generating...
              </>
            ) : (
              <>
                <Key16Regular aria-hidden />
                Generate Secure Reset Link
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminGenerateResetLinkPage;
