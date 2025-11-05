import { API_BASE_URL } from '@/config/api';

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scope: 'global_scope' | 'faculty_specific' | 'individual';  // 'global_scope' will be mapped to 'global' for backend
  target_faculty_id?: string;
  target_user_id?: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scope: 'global' | 'faculty_specific' | 'individual';
  sender_id: number;
  sender_name: string;
  created_at: string;
  is_read: boolean;
}

export interface Faculty {
  id: number;
  name: string;
  description: string;
  student_count: number;
}

class NotificationService {
  private getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async createNotification(notification: CreateNotificationRequest): Promise<{
    success: boolean;
    notification_id: number;
    recipients_count: number;
    message: string;
  }> {
    // Transform the data to match backend expectations
    const transformedNotification = {
      ...notification,
      // Convert string IDs to numbers when present or null if empty string
      target_faculty_id: notification.target_faculty_id ? 
        (notification.target_faculty_id.trim() !== '' ? parseInt(notification.target_faculty_id) : null) : 
        null,
      target_user_id: notification.target_user_id ? 
        (notification.target_user_id.trim() !== '' ? parseInt(notification.target_user_id) : null) : 
        null
    };

    console.log('Sending notification data:', JSON.stringify(transformedNotification, null, 2));

    const response = await fetch(`${API_BASE_URL}/notifications/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(transformedNotification)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Notification creation failed with status:', response.status);
      console.error('Error response:', error);
      throw new Error(JSON.stringify(error) || 'Failed to create notification');
    }

    return response.json();
  }

  async getNotifications(): Promise<Notification[]> {
    const response = await fetch(`${API_BASE_URL}/notifications/`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch notifications');
    }

    return response.json();
  }

  async getFaculties(): Promise<Faculty[]> {
    const response = await fetch(`${API_BASE_URL}/notifications/faculties`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch faculties');
    }

    return response.json();
  }

  async markAsRead(notificationId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to mark notification as read');
    }
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete notification');
    }
  }

  // Inbox endpoints (per-user)
  async getInbox(onlyUnread: boolean = true, skip: number = 0, limit: number = 20): Promise<Notification[]> {
    const params = new URLSearchParams({
      only_unread: String(onlyUnread),
      skip: String(skip),
      limit: String(limit),
    });
    const response = await fetch(`${API_BASE_URL}/notifications/inbox?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch inbox');
    }

    return response.json();
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/mark-read`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to mark as read');
    }
  }

  async dismissNotification(notificationId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to dismiss notification');
    }
  }

  async dismissAllNotifications(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/dismiss-all`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to dismiss all notifications');
    }
  }
}

export const notificationService = new NotificationService();
