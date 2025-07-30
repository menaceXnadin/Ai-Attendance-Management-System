export interface Student {
  id: string;
  name: string;
  full_name?: string;
  email: string;
  rollNo?: string;
  studentId?: string;
  student_id?: string;
  faculty?: string;
  semester?: number;
  year?: number;
  batch?: number;
  phone_number?: string;
  emergency_contact?: string;
  profileImage?: string | null;
  profile_image_url?: string | null;
  face_encoding?: number[] | null;
  user?: {
    id: string;
    email: string;
    full_name?: string;
    role?: string;
    is_active?: boolean;
  };
}
