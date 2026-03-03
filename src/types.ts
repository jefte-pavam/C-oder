export type UserRole = 'DONOR' | 'ADOPTER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  emoji?: string;
  bio?: string;
}

export interface DogBehavior {
  energy: number; // 1-5
  sociability: number; // 1-5
  training: number; // 1-5
  barking: number; // 1-5
}

export interface Dog {
  id: string;
  owner_id: string;
  owner_name?: string;
  name: string;
  breed: string;
  age: string;
  photos: string[];
  behavior: DogBehavior;
  bio: string;
}

export interface Match {
  id: string;
  adopter_id: string;
  dog_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  dog_name?: string;
  dog_photos?: string[];
  owner_name?: string;
}

export interface Message {
  id?: number;
  match_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'audio' | 'video_call_request';
  created_at?: string;
}
