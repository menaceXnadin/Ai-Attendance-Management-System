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
import { Copy, Renew, Password, Time, Email, User, Security, WarningAlt, CheckmarkFilled } from '@carbon/icons-react';

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Password Reset Management</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Review pending institutional reset requests and issue secure one-time credentials
        </p>
      </div>

      {/* Pending Requests Section */}
      <Card className="border border-border-subtle bg-surface-default shadow-card">
        <CardHeader className="border-b border-border-subtle pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-text-primary">
                <Time className="w-4 h-4 text-action-primary" />
                Pending Account Reset Requests
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Incoming requests submitted via the institutional portal
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={requestsLoading}
              className="text-xs h-8"
            >
              <Renew className={`w-3.5 h-3.5 mr-1.5 ${requestsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12 space-x-2 text-xs text-text-muted">
              <Renew className="w-4 h-4 animate-spin text-action-primary" />
              <span>Loading requests...</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <CheckmarkFilled className="w-10 h-10 text-status-success" />
              <div className="space-y-0.5">
                <h3 className="font-semibold text-sm text-text-primary">All Clear</h3>
                <p className="text-xs text-text-muted">No pending password reset requests at this time</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border-subtle overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-canvas border-b border-border-subtle">
                    <TableHead className="text-xs font-semibold text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Email className="w-3.5 h-3.5" />
                        Email
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-text-secondary">Role</TableHead>
                    <TableHead className="text-xs font-semibold text-text-secondary">Requested</TableHead>
                    <TableHead className="text-xs font-semibold text-text-secondary">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-text-secondary text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((req) => (
                    <TableRow key={req.id} className="border-b border-border-subtle hover:bg-surface-canvas/50">
                      <TableCell className="font-medium text-xs text-text-primary">{req.full_name}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{req.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 uppercase">
                          {req.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">
                        {new Date(req.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {req.expired ? (
                          <span className="flex items-center gap-1 text-status-error">
                            <WarningAlt className="w-3.5 h-3.5" />
                            {getTimeRemaining(req.expires_at, req.expired)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-status-success font-medium">
                            <Time className="w-3.5 h-3.5" />
                            {getTimeRemaining(req.expires_at, req.expired)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.expired ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                            Expired
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const url = `${window.location.origin}/reset-password?token=${req.token}`;
                              copyToClipboard(url);
                            }}
                          >
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
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
      <Card className="border border-border-subtle bg-surface-default shadow-card max-w-2xl">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-text-primary">
            <Password className="w-4 h-4 text-action-primary" />
            Issue Direct Reset Link
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Create an immediate one-time recovery URL for any registered user
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Email className="w-3.5 h-3.5 text-text-muted" />
              Target User Email
            </Label>
            <Input 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="user@institution.edu"
            />
          </div>
          
          {link && (
            <div className="space-y-2 p-3 bg-surface-canvas border border-border-subtle rounded-md">
              <div className="flex items-center gap-1.5 text-status-success text-xs font-semibold">
                <CheckmarkFilled className="w-4 h-4" />
                <span>Link Generated Successfully</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={link} 
                  onFocus={(e) => e.currentTarget.select()} 
                  className="font-mono text-xs"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(link!)}
                  className="flex-shrink-0 text-xs"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                </Button>
              </div>
              <p className="text-[11px] text-text-muted flex items-center gap-1">
                <Security className="w-3 h-3 text-action-primary" />
                Share securely • Valid for 1 hour • Single-use only
              </p>
            </div>
          )}

          <div className="bg-surface-canvas border border-border-subtle rounded-md p-3">
            <div className="flex items-start gap-2 text-xs">
              <Security className="w-4 h-4 text-action-primary flex-shrink-0 mt-0.5" />
              <p className="text-text-secondary leading-relaxed">
                Always verify the user's institutional identity before distributing temporary reset URLs.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border-subtle pt-4">
          <Button 
            onClick={() => onGenerate()} 
            disabled={loading || !email.trim()}
            className="w-full sm:w-auto"
            size="sm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Renew className="w-4 h-4 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Password className="w-4 h-4" />
                Generate Secure Reset Link
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminGenerateResetLinkPage;
