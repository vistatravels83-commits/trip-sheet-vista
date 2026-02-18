import { createClient } from '@supabase/supabase-js';
import { TripData, AppSettings } from '../types';

// ==============================================================================
// CONFIGURATION & SAFE INITIALIZATION
// ==============================================================================

/**
 * Retrieves environment variables using Vite's import.meta.env.
 * Variables must be prefixed with VITE_ in the .env file and Netlify settings.
 */
const getEnvVar = (key: string, fallback: string): string => {
  const viteKey = `VITE_${key}`;
  return import.meta.env[viteKey] || import.meta.env[key] || fallback;
};

const SUPABASE_URL = getEnvVar('SUPABASE_URL', '');
const SUPABASE_KEY = getEnvVar('SUPABASE_KEY', '');

// Initialize Supabase Client safely
let supabase: any = null;

const isConfigured = SUPABASE_URL && SUPABASE_URL.startsWith('http') && SUPABASE_KEY;

if (isConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized Successfully");
  } catch (err) {
    console.error("Supabase Initialization Failed:", err);
    supabase = null;
  }
} else {
  console.warn("Supabase Config Missing — URL:", SUPABASE_URL ? "Set" : "Missing", "| Key:", SUPABASE_KEY ? "Set" : "Missing");
  console.warn("Ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set in Netlify Site Settings > Environment Variables.");
}

export const DEFAULT_COMPANIES = ["Vista Travels HQ"];
export const DEFAULT_CAR_TYPES = ["Sedan", "SUV", "Innova", "Crysta", "Tempo Traveller"];

const DEFAULT_SETTINGS: AppSettings = {
  agencyName: "Vista Travels",
  addressLine1: "No. 51, Brodies Road, Karayanchavadi,",
  addressLine2: "Poonamallee, Chennai - 600056",
  contactNumber: "+91 98400 12345",
  email: "bookings@vistatravels.com",
};

// --- Helpers for Data Mapping (DB Snake_Case <-> App CamelCase) ---

const mapTripFromDB = (row: any): TripData => ({
  id: row.trip_id || '',
  companyName: row.company_name,
  bookedBy: row.booked_by,
  reportTo: row.report_to,
  carType: row.car_type,
  tripType: row.trip_type,
  source: row.source,
  destination: row.destination,
  vehicleRegNo: row.vehicle_reg_no,
  startKm: row.start_km,
  endKm: row.end_km,
  totalKm: row.total_km,
  startDateTime: row.start_date_time,
  endDateTime: row.end_date_time,
  totalTime: row.total_time,
  tollParking: row.toll_parking,
  additionalKm: row.additional_km,
  signature: row.signature,
  timestamp: row.updated_at
});

const mapTripToDB = (data: TripData) => ({
  trip_id: data.id,
  company_name: data.companyName,
  booked_by: data.bookedBy,
  report_to: data.reportTo,
  car_type: data.carType,
  trip_type: data.tripType,
  source: data.source,
  destination: data.destination,
  vehicle_reg_no: data.vehicleRegNo,
  start_km: data.startKm,
  end_km: data.endKm,
  total_km: data.totalKm,
  start_date_time: data.startDateTime,
  end_date_time: data.endDateTime,
  total_time: data.totalTime,
  toll_parking: data.tollParking,
  additional_km: data.additionalKm,
  signature: data.signature,
  updated_at: data.timestamp
});

// --- API Functions ---

export const getAllDashboardData = async (): Promise<any> => {
  // If not configured, return cached data or default empty state immediately
  if (!supabase) {
    const cached = sessionStorage.getItem('vista_cache_all');
    if (cached) return JSON.parse(cached);
    return {
      trips: [],
      companies: DEFAULT_COMPANIES,
      carTypes: DEFAULT_CAR_TYPES,
      settings: DEFAULT_SETTINGS,
      fetchError: "Supabase credentials missing"
    };
  }

  try {
    // Parallel fetch for efficiency
    const [tripsRes, companiesRes, carTypesRes, settingsRes] = await Promise.all([
      supabase.from('trips').select('*').order('updated_at', { ascending: false }),
      supabase.from('companies').select('name').order('name'),
      supabase.from('car_types').select('name').order('name'),
      supabase.from('settings').select('*')
    ]);

    if (tripsRes.error) throw tripsRes.error;
    if (companiesRes.error) throw companiesRes.error;

    // Transform Data
    const trips = (tripsRes.data || []).map(mapTripFromDB);
    const companies = (companiesRes.data || []).map((c: any) => c.name);
    const carTypes = (carTypesRes.data || []).map((c: any) => c.name);

    // Transform Settings
    const settingsObj: any = { ...DEFAULT_SETTINGS };
    (settingsRes.data || []).forEach((row: any) => {
      settingsObj[row.key] = row.value;
    });

    const fullData = {
      trips,
      companies: companies.length ? companies : DEFAULT_COMPANIES,
      carTypes: carTypes.length ? carTypes : DEFAULT_CAR_TYPES,
      settings: settingsObj
    };

    // Cache for offline support
    sessionStorage.setItem('vista_cache_all', JSON.stringify(fullData));

    return fullData;

  } catch (error: any) {
    console.error("Supabase API Error:", error);

    // Fallback to cache
    const cached = sessionStorage.getItem('vista_cache_all');
    if (cached) return JSON.parse(cached);

    return {
      trips: [],
      companies: DEFAULT_COMPANIES,
      carTypes: DEFAULT_CAR_TYPES,
      settings: DEFAULT_SETTINGS,
      fetchError: error.message || "Connection Failed"
    };
  }
};

export const saveTrip = async (data: TripData): Promise<boolean> => {
  if (!supabase) {
    console.error("Cannot save trip: Supabase not configured");
    throw new Error("Database not connected. Please check configuration.");
  }

  try {
    const dbPayload = mapTripToDB(data);
    const { error } = await supabase.from('trips').insert([dbPayload]);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("Save Trip Error:", error);
    throw new Error(error.message || "Failed to save trip");
  }
};

export const updateTrip = async (timestamp: string, updates: Partial<TripData>): Promise<boolean> => {
  if (!supabase) return false;

  try {
    // Map the updates to DB columns
    const dbUpdates: any = {};
    if (updates.id !== undefined) dbUpdates.trip_id = updates.id;
    if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
    if (updates.bookedBy !== undefined) dbUpdates.booked_by = updates.bookedBy;
    if (updates.reportTo !== undefined) dbUpdates.report_to = updates.reportTo;
    if (updates.carType !== undefined) dbUpdates.car_type = updates.carType;
    if (updates.tripType !== undefined) dbUpdates.trip_type = updates.tripType;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    if (updates.destination !== undefined) dbUpdates.destination = updates.destination;
    if (updates.vehicleRegNo !== undefined) dbUpdates.vehicle_reg_no = updates.vehicleRegNo;
    if (updates.startKm !== undefined) dbUpdates.start_km = updates.startKm;
    if (updates.endKm !== undefined) dbUpdates.end_km = updates.endKm;
    if (updates.totalKm !== undefined) dbUpdates.total_km = updates.totalKm;
    if (updates.startDateTime !== undefined) dbUpdates.start_date_time = updates.startDateTime;
    if (updates.endDateTime !== undefined) dbUpdates.end_date_time = updates.endDateTime;
    if (updates.totalTime !== undefined) dbUpdates.total_time = updates.totalTime;
    if (updates.tollParking !== undefined) dbUpdates.toll_parking = updates.tollParking;
    if (updates.additionalKm !== undefined) dbUpdates.additional_km = updates.additionalKm;
    if (updates.signature !== undefined) dbUpdates.signature = updates.signature;

    const { error } = await supabase
      .from('trips')
      .update(dbUpdates)
      .eq('updated_at', timestamp);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Update Trip Error:", error);
    return false;
  }
};

export const addCompany = async (name: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('companies').insert([{ name }]);
    return !error;
  } catch (error) {
    return false;
  }
};

export const deleteCompany = async (name: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('companies').delete().eq('name', name);
    return !error;
  } catch (error) {
    return false;
  }
};

export const addCarType = async (name: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('car_types').insert([{ name }]);
    return !error;
  } catch (error) {
    return false;
  }
};

export const deleteCarType = async (name: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('car_types').delete().eq('name', name);
    return !error;
  } catch (error) {
    return false;
  }
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const upserts = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    const { error } = await supabase.from('settings').upsert(upserts);
    return !error;
  } catch (error) {
    return false;
  }
};

/**
 * Subscribes to real-time changes in the 'trips' table.
 * @param onUpdate Callback function to handle the updated trip data.
 */
export const subscribeToTrips = (onUpdate: () => void) => {
  if (!supabase) return null;

  const subscription = supabase
    .channel('trips-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trips' },
      () => {
        console.log('Real-time trip update received');
        onUpdate();
      }
    )
    .subscribe();

  return subscription;
};