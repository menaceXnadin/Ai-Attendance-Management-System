import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminNotificationCreator from '@/components/AdminNotificationCreator';
import EnhancedNotificationSystem from '@/components/EnhancedNotificationSystem';
import { Send, Bell, BarChart3 } from 'lucide-react';

const AdminNotificationsPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Notification Management</h1>
        <p className="text-slate-400">Create and manage notifications for students and faculty</p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger 
            value="create" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-400 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Notification
          </TabsTrigger>
          <TabsTrigger 
            value="view" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
          >
            <Bell className="h-4 w-4 mr-2" />
            All Notifications
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <AdminNotificationCreator />
        </TabsContent>

        <TabsContent value="view" className="mt-6">
          <EnhancedNotificationSystem />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="text-center py-12 text-slate-400">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Notification Analytics</h3>
            <p>Detailed analytics and engagement metrics coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotificationsPage;
