export interface TripData {
  id: string;
  companyName: string;
  // Merged fields
  startDateTime: string; // ISO string
  endDateTime: string; // ISO string

  bookedBy: string;
  reportTo: string;
  carType: string; // New field
  tripType: string; // New field: 'Local' | 'Outstation'
  source: string; // New field
  destination: string; // New field
  vehicleRegNo: string;
  startKm: number;
  endKm: number;
  totalKm: number;
  totalTime: string; // HH:mm format or "Xh Ym"
  tollParking: number;
  signature: string; // Base64 string
  additionalKm?: number; // Added by admin
  timestamp: string;
}

export interface FormData {
  companyName: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  bookedBy: string;
  reportTo: string;
  carType: string;
  tripType: string;
  source: string;
  destination: string;
  vehicleRegNo: string;
  startKm: number;
  endKm: number;
  tollParking: number;
}

export interface AppSettings {
  agencyName: string;
  addressLine1: string;
  addressLine2: string;
  contactNumber: string;
  email: string;
  logoBase64?: string; // Optional custom logo
}