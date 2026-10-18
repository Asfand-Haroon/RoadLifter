export type UserRole = 'DRIVER' | 'SENDER' | 'ADMIN';

export type ShipmentStatus = 'OPEN' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export type CargoType =
  | 'GENERAL'
  | 'ELECTRONICS'
  | 'PERISHABLE'
  | 'CONSTRUCTION'
  | 'FURNITURE'
  | 'AUTO_PARTS'
  | 'HAZARDOUS'
  | 'LIVESTOCK';

export type TruckType = 'FLATBED' | 'DRY_VAN' | 'REFRIGERATED' | 'TANKER' | 'LOWBOY' | 'BOX_TRUCK';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  auth_provider?: 'google';
  phone?: string;
  avatar_url?: string | null;
  rating_avg?: number;
  rating_count?: number;
  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  // Driver verification fields
  legal_name?: string;
  cnic_number?: string;
  vehicle_number?: string;
  license_number?: string;
  license_expiry?: string;
  profile_completed?: boolean;
  verification_status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verified_at?: string;
  email_verified?: boolean;
}

export interface Shipment {
  id: string;
  sender_id: string;
  driver_id?: string;
  title: string;
  description?: string;
  cargo_type: CargoType;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  weight_kg?: number;
  budget?: number;
  status: ShipmentStatus;
  accepted_at?: string;
  created_at: string;
  // Joined fields
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  sender_rating_avg?: number;
  sender_rating_count?: number;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  driver_rating_avg?: number;
  driver_rating_count?: number;
  my_rating_id?: string | null;
  my_rating?: number | null;
  my_rating_comment?: string | null;
  distance_km?: number;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  lat: number;
  lng: number;
  heading: number;
  speed?: number;
  isActive: boolean;
  distance_km?: number;
  rating_avg?: number;
  rating_count?: number;
  // Truck info
  plate_number?: string;
  truck_type?: TruckType;
  truck_model?: string;
  capacity_tons?: number;
}

export interface Truck {
  id: string;
  driver_id: string;
  plate_number: string;
  truck_type: TruckType;
  truck_model?: string;
  capacity_tons?: number;
  year?: number;
  is_primary: boolean;
}

export interface CreateShipmentPayload {
  title: string;
  description?: string;
  cargo_type: CargoType;
  pickup_address: string;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  weight_kg?: number;
  budget?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RatingRecord {
  id: string;
  cargo_id: string;
  rater_id: string;
  ratee_id: string;
  rating: number;
  on_time: boolean;
  items_intact: boolean;
  paid_agreed: boolean;
  accurate_description: boolean;
  comment?: string | null;
  created_at: string;
  rater_name?: string;
  rater_role?: UserRole;
  cargo_title?: string;
}

export interface RatingBreakdown {
  on_time_pct: number;
  items_intact_pct: number;
  paid_agreed_pct: number;
  accurate_desc_pct: number;
}

export interface RatingProfile {
  user: {
    id: string;
    name: string;
    role: UserRole;
    rating_avg: number;
    rating_count: number;
    is_blacklisted?: boolean;
  };
  breakdown: RatingBreakdown;
  reviews: RatingRecord[];
}

export interface DriverVerificationForm {
  legal_name: string;
  cnic_number: string;
  vehicle_number: string;
  license_number: string;
  license_expiry: string;
}
