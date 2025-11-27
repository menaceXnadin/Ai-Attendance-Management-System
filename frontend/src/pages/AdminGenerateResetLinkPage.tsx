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
import { Copy, RefreshCw, KeyRound, Clock, Mail, User, Shield, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

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

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString() + ` (${date.toISOString()})`;
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-teal-400 rounded-xl shadow-lg">
            <KeyRound className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent">
              Password Reset Management
            </h1>
            <p className="text-blue-300 text-sm mt-1">
              Review pending requests and generate secure reset links
            </p>
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      <Card className="bg-slate-900/80 border border-slate-700/50 shadow-2xl backdrop-blur-md">
        <CardHeader className="pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-semibold flex items-center gap-2 text-blue-200">
                <Clock className="h-5 w-5 text-teal-400" />
                Pending Reset Requests
              </CardTitle>
              <CardDescription className="text-blue-300">
                Users who submitted a reset request via the public form
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={requestsLoading}
              className="self-start sm:self-auto border-slate-600 text-blue-300 hover:border-teal-400 hover:bg-slate-800/50 hover:text-teal-300 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${requestsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-8 w-8 border-3 border-teal-700 border-t-teal-400 rounded-full animate-spin"></div>
              <p className="text-sm text-blue-300">Loading requests...</p>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                <CheckCircle className="h-12 w-12 text-teal-400" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-blue-200">All clear!</h3>
                <p className="text-sm text-blue-300">No pending password reset requests at this time</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800/50 hover:bg-slate-800/50 border-b border-slate-700">
                    <TableHead className="font-semibold text-blue-300">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        User
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Role
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">Requested</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-slate-800/30 transition-colors border-b border-slate-800">
                      <TableCell className="font-medium text-blue-200">{req.full_name}</TableCell>
                      <TableCell className="text-blue-300">{req.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className="bg-teal-950/30 border-teal-700/50 text-teal-300"
                        >
                          {req.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-blue-300">
                        {new Date(req.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.expired ? (
                          <div className="flex items-center gap-2 text-red-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">{getTimeRemaining(req.expires_at, req.expired)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-teal-400">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">{getTimeRemaining(req.expires_at, req.expired)}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {req.expired ? (
                          <Badge 
                            variant="destructive" 
                            className="bg-gradient-to-r from-red-500 to-red-600 shadow-sm"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 shadow-md shadow-teal-500/30 transition-all duration-200 text-white font-medium"
                            onClick={() => {
                              const url = `${window.location.origin}/reset-password?token=${req.token}`;
                              copyToClipboard(url);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
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
      <Card className="max-w-2xl bg-slate-900/80 border border-slate-700/50 shadow-2xl backdrop-blur-md">
        <CardHeader className="pb-6">
          <div className="space-y-1.5">
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-blue-200">
              <Sparkles className="h-5 w-5 text-teal-400" />
              Generate Reset Link
            </CardTitle>
            <CardDescription className="text-blue-300">
              Create a secure reset link for any user, even without a pending request
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-blue-300 flex items-center gap-2">
              <Mail className="h-4 w-4 text-teal-400" />
              User Email
            </Label>
            <Input 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="student@university.edu"
              className="h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-teal-400 focus:ring-teal-400 transition-all duration-200"
            />
          </div>
          
          {link && (
            <div className="space-y-3 p-4 bg-blue-950/50 border border-teal-700/30 rounded-xl animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-teal-400">
                <CheckCircle className="h-5 w-5" />
                <Label className="font-semibold text-blue-200">Reset Link Generated</Label>
              </div>
              <div className="space-y-2">
                <Input 
                  readOnly 
                  value={link} 
                  onFocus={(e) => e.currentTarget.select()} 
                  className="font-mono text-sm bg-slate-800/50 border-teal-700/50 text-white focus:border-teal-400"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => copyToClipboard(link!)}
                  className="w-full border-teal-700/50 text-teal-300 hover:bg-slate-800/50 hover:border-teal-400 transition-colors"
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
                </Button>
              </div>
              <p className="text-xs text-teal-300/80 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Share this link securely with the user • Valid for 1 hour • Single use only
              </p>
            </div>
          )}

          <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-amber-300 text-sm">Security Notice</h4>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  This tool generates a one-time password reset link. Always verify the user's identity before sharing the link. Links expire after 1 hour and can only be used once.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => onGenerate()} 
            disabled={loading || !email.trim()}
            className="w-full h-11 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 shadow-lg shadow-teal-500/30 transition-all duration-200 disabled:opacity-50 text-white font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Generating Link...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Generate Secure Link
              </span>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminGenerateResetLinkPage;
