import { TripData, AppSettings } from '../types';
import { format } from 'date-fns';

/**
 * Generates a CSV file from trip data and triggers a download.
 * This is a lightweight alternative to XLSX that avoids external dependencies.
 */
export const generateCSV = (trips: TripData[], settings: AppSettings) => {
    try {
        // 1. Define Headers
        const headers = [
            'Booking ID',
            'Company Name',
            'Booked By',
            'Report To',
            'Vehicle Reg No',
            'Car Type',
            'Trip Type',
            'Source',
            'Destination',
            'Start Date/Time',
            'End Date/Time',
            'Start Km',
            'End Km',
            'Additional Km',
            'Total Km',
            'Duration',
            'Toll & Parking',
            'Submitted At'
        ];

        // 2. Map Trip Data to CSV Rows
        const rows = trips.map(trip => [
            trip.id || '-',
            trip.companyName || '-',
            trip.bookedBy || '-',
            trip.reportTo || '-',
            trip.vehicleRegNo || '-',
            trip.carType || '-',
            trip.tripType || '-',
            trip.source || '-',
            trip.destination || '-',
            trip.startDateTime ? format(new Date(trip.startDateTime), 'dd/MM/yyyy HH:mm') : '-',
            trip.endDateTime ? format(new Date(trip.endDateTime), 'dd/MM/yyyy HH:mm') : '-',
            trip.startKm || 0,
            trip.endKm || 0,
            trip.additionalKm || 0,
            (trip.endKm || 0) - (trip.startKm || 0) + (trip.additionalKm || 0),
            trip.totalTime || '-',
            trip.tollParking || 0,
            trip.timestamp ? format(new Date(trip.timestamp), 'dd/MM/yyyy HH:mm') : '-'
        ]);

        // 3. Helper to escape CSV values
        const escapeCSV = (val: any) => {
            let str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // 4. Combine Headers and Rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(escapeCSV).join(','))
        ].join('\n');

        // 5. Create Blob and Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const filename = `${String(settings.agencyName || "Vista").replace(/\s+/g, '_')}_Trips_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;
    } catch (error) {
        console.error("CSV Generation Error:", error);
        return false;
    }
};
