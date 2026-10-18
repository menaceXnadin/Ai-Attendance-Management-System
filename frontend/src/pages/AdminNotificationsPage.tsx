import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminNotificationCreator from '@/components/AdminNotificationCreator';
import EnhancedNotificationSystem from '@/components/EnhancedNotificationSystem';
import { Send20Regular, Alert20Regular } from '@fluentui/react-icons';

const AdminNotificationsPage: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <h1 className="text-page-title text-text-primary">Notification Management</h1>
        <p className="text-body text-text-muted mt-1">Create and manage notifications for students and faculty</p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Send20Regular className="shrink-0" aria-hidden />
            Send Notification
          </TabsTrigger>
          <TabsTrigger value="view" className="gap-2">
            <Alert20Regular className="shrink-0" aria-hidden />
            All Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-4">
          <AdminNotificationCreator />
        </TabsContent>

        <TabsContent value="view" className="mt-4">
          <EnhancedNotificationSystem />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotificationsPage;
