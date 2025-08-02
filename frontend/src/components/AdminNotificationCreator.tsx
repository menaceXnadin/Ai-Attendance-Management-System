import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { notificationService, type CreateNotificationRequest, type Faculty } from '@/services/notificationService';
import { 
  Send, 
  Globe, 
  Users, 
  User, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  AlertCircle,
  Megaphone
} from 'lucide-react';

const AdminNotificationCreator: React.FC = () => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CreateNotificationRequest>({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    scope: 'global_scope',
    target_faculty_id: '',
    target_user_id: ''
  });

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false);

  // Load faculties when component mounts
  useEffect(() => {
    const loadFaculties = async () => {
      setIsLoadingFaculties(true);
      try {
        const facultiesData = await notificationService.getFaculties();
        setFaculties(facultiesData);
      } catch (error) {
        console.error('Failed to load faculties:', error);
        toast({
          title: "Error",
          description: "Failed to load faculties",
          variant: "destructive"
        });
      } finally {
        setIsLoadingFaculties(false);
      }
    };

    loadFaculties();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and message are required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await notificationService.createNotification(formData);
      
      toast({
        title: "Notification Sent!",
        description: `${result.message} (${result.recipients_count} recipients)`,
        variant: "default"
      });
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'info',
        priority: 'medium',
        scope: 'global_scope',
        target_faculty_id: '',
        target_user_id: ''
      });
      
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send notification",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'danger': return <AlertCircle className="h-4 w-4" />;
      case 'announcement': return <Megaphone className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'text-blue-400 bg-blue-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'success': return 'text-green-400 bg-green-500/20';
      case 'danger': return 'text-red-400 bg-red-500/20';
      case 'announcement': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-blue-400 bg-blue-500/20';
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global': return <Globe className="h-4 w-4" />;
      case 'faculty_specific': return <Users className="h-4 w-4" />;
      case 'individual': return <User className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-400" />
          Send Notification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-slate-300">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter notification title"
              className="bg-slate-800 border-slate-600 text-white"
              maxLength={200}
            />
            <p className="text-xs text-slate-400">{formData.title.length}/200 characters</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-slate-300">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter your message"
              rows={4}
              className="bg-slate-800 border-slate-600 text-white resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-slate-400">{formData.message.length}/2000 characters</p>
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: CreateNotificationRequest['type']) => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-400" />
                      Information
                    </div>
                  </SelectItem>
                  <SelectItem value="warning">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      Warning
                    </div>
                  </SelectItem>
                  <SelectItem value="success">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      Success
                    </div>
                  </SelectItem>
                  <SelectItem value="danger">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      Danger
                    </div>
                  </SelectItem>
                  <SelectItem value="announcement">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-purple-400" />
                      Announcement
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: CreateNotificationRequest['priority']) => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label className="text-slate-300">Target Audience</Label>
            <Select 
              value={formData.scope} 
              onValueChange={(value: CreateNotificationRequest['scope']) => 
                setFormData(prev => ({ ...prev, scope: value, target_faculty_id: '', target_user_id: '' }))
              }
            >
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="global_scope">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    All Students
                  </div>
                </SelectItem>
                <SelectItem value="faculty_specific">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-400" />
                    Specific Faculty
                  </div>
                </SelectItem>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-purple-400" />
                    Individual Student
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Faculty Selection (when faculty_specific is selected) */}
          {formData.scope === 'faculty_specific' && (
            <div className="space-y-2">
              <Label className="text-slate-300">Select Faculty</Label>
              <Select 
                value={formData.target_faculty_id || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, target_faculty_id: value }))}
                disabled={isLoadingFaculties}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder={isLoadingFaculties ? "Loading faculties..." : "Select a faculty"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {faculties.map((faculty) => (
                    <SelectItem key={faculty.id} value={faculty.id.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{faculty.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({faculty.student_count} students)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          <div className="border border-slate-600 rounded-lg p-4 bg-slate-800/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium">Preview</h4>
              <div className="flex items-center gap-2">
                <Badge className={`${getTypeColor(formData.type)} border-current`}>
                  {getTypeIcon(formData.type)}
                  <span className="ml-1 capitalize">{formData.type}</span>
                </Badge>
                <Badge variant="outline" className="text-slate-300">
                  {getScopeIcon(formData.scope)}
                  <span className="ml-1 capitalize">{formData.scope.replace('_', ' ')}</span>
                </Badge>
              </div>
            </div>
            <h5 className="text-white font-semibold mb-1">{formData.title || 'Notification Title'}</h5>
            <p className="text-slate-300 text-sm">{formData.message || 'Your notification message will appear here...'}</p>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isLoading || !formData.title.trim() || !formData.message.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminNotificationCreator;
