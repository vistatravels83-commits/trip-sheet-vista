
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { TripData, AppSettings } from '../types';
import { format, isValid } from 'date-fns';

/**
 * Enhanced downloader that ensures the blob is valid and handles the anchor click more safely.
 */
const triggerDownload = (blob: Blob, filename: string) => {
  if (!blob || blob.size === 0) {
    console.error("PDF generation resulted in an empty file.");
    return;
  }
  
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Position off-screen and append to ensure it's "interactive"
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Delay cleanup to ensure browser captures the click event
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.error("Critical download error:", err);
    alert("Download failed. Your browser settings might be blocking the download.");
  }
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 148;
const MARGIN = 10;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  primary: [185, 28, 28],
  text: [30, 41, 59],
  label: [100, 116, 139],
  border: [203, 213, 225],
  headerBg: [241, 245, 249],
  gridLine: [226, 232, 240]
};

/**
 * Validate base64 image strings to prevent jsPDF from crashing.
 */
const isValidBase64Image = (str: string | undefined): boolean => {
  if (!str || typeof str !== 'string') return false;
  // Basic check for data URI pattern
  return str.startsWith('data:image/') && str.includes(';base64,') && str.length > 50;
};

const drawBranding = (doc: jsPDF, x: number, y: number, settings: AppSettings) => {
  if (!settings) return;
  doc.setLineWidth(1);
  doc.setLineCap('round');

  const agencyText = String(settings.agencyName || "TripSheetPro");

  if (isValidBase64Image(settings.logoBase64)) {
    try {
        // Render Logo
        // @ts-ignore
        const imgProps = doc.getImageProperties(settings.logoBase64);
        const ratio = imgProps.height / imgProps.width;
       
        const width = 30;
        const height = width * ratio;

        doc.addImage(settings.logoBase64, 'JPEG', x, y - 2, width, height, undefined, 'FAST');
        
        // Render Company Name Text next to logo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text(agencyText, x + 35, y + 7);
    } catch (e) {
        console.warn("Logo image error, using text fallback", e);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.text(agencyText, x, y + 9);
    }
  } else {
      // Default Logo Graphics (Abstract car shape)
      doc.setDrawColor(220, 38, 38); 
      doc.line(x, y + 5, x + 10, y);
      doc.setDrawColor(6, 182, 212); 
      doc.line(x + 2, y + 7, x + 12, y + 2);
      doc.setDrawColor(34, 197, 94); 
      doc.line(x + 4, y + 9, x + 14, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.text(agencyText, x + 20, y + 9);
  }
};

const formatDateTimeSafe = (isoString?: string) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isValid(d)) return format(d, 'dd/MM/yyyy h:mm a'); 
    return String(isoString).replace('T', ' ');
  } catch {
    return String(isoString || '-');
  }
};

const formatDateOnlySafe = (isoString?: string) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isValid(d)) return format(d, 'dd/MM/yyyy');
    return String(isoString).split('T')[0];
  } catch {
    return String(isoString || '-');
  }
};

export const generateSinglePDF = (trip: TripData, settings: AppSettings, save = true): jsPDF => {
  try {
    // Initializing jsPDF with explicit options
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [210, 148],
      putOnlyUsedFonts: true,
      compress: true
    });
    
    // External Frame
    doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, PAGE_WIDTH - 10, PAGE_HEIGHT - 10);

    drawBranding(doc, MARGIN + 2, 12, settings);

    const addressX = PAGE_WIDTH - MARGIN - 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    
    doc.text(String(settings.addressLine1 || ''), addressX, 12, { align: 'right' });
    doc.text(String(settings.addressLine2 || ''), addressX, 16, { align: 'right' });
    doc.text(`Cell: ${String(settings.contactNumber || '')}`, addressX, 20, { align: 'right' });
    doc.text(`E-mail: ${String(settings.email || '')}`, addressX, 24, { align: 'right' });

    const titleY = 32;
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(MARGIN, titleY, CONTENT_WIDTH, 8, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("TRIP SHEET", MARGIN + 4, titleY + 5.5);

    doc.setFontSize(9);
    let headerCenterText = `Booking No: ${String(trip.id || '________')}`;
    if (trip.tripType) headerCenterText += `  |  ${String(trip.tripType)}`;
    doc.text(headerCenterText, PAGE_WIDTH / 2, titleY + 5.5, { align: 'center' });
    
    const tripDate = formatDateOnlySafe(trip.startDateTime);
    doc.text(`Date: ${tripDate}`, PAGE_WIDTH - MARGIN - 4, titleY + 5.5, { align: 'right' });

    let y = titleY + 14;

    const drawField = (label: string, value: any, x: number, w: number) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]);
      doc.setFontSize(8);
      doc.text(String(label), x, y);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const displayValue = String(value ?? '-');
      const splitVal = doc.splitTextToSize(displayValue, w);
      doc.text(splitVal, x, y + 5);
      return splitVal.length * 4;
    };

    const h1 = drawField("Company Name", trip.companyName, MARGIN + 2, 60);
    const h2 = drawField("Booked By", trip.bookedBy, MARGIN + 65, 40);
    const h3 = drawField("Report To", trip.reportTo || '-', MARGIN + 107, 40);
    const h4 = drawField("Vehicle Reg No", trip.vehicleRegNo, MARGIN + 150, 30);
    
    y += Math.max(h1, h2, h3, h4) + 8;

    const h5 = drawField("Car Type", trip.carType || '-', MARGIN + 2, 60);

    let h6 = 0;
    if (trip.source && String(trip.source).trim()) {
      h6 = drawField("From (Source)", trip.source, MARGIN + 65, 60);
    }
    let h7 = 0;
    if (trip.destination && String(trip.destination).trim()) {
      h7 = drawField("To (Destination)", trip.destination, MARGIN + 130, 40);
    }
    

    y += Math.max(h5, h6, h7) + 8;

    const headerHeight = 8;
    const rowHeight = 9;
    const gridH = headerHeight + (rowHeight * 2);
    const colW = CONTENT_WIDTH / 3;

    doc.setFillColor(COLORS.headerBg[0], COLORS.headerBg[1], COLORS.headerBg[2]);
    doc.rect(MARGIN, y, CONTENT_WIDTH, headerHeight, 'F');
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.rect(MARGIN, y, CONTENT_WIDTH, gridH);
    doc.line(MARGIN + colW, y, MARGIN + colW, y + gridH);
    doc.line(MARGIN + (colW * 2), y, MARGIN + (colW * 2), y + gridH);
    doc.setDrawColor(COLORS.gridLine[0], COLORS.gridLine[1], COLORS.gridLine[2]);
    doc.line(MARGIN, y + headerHeight, PAGE_WIDTH - MARGIN, y + headerHeight);
    doc.line(MARGIN, y + headerHeight + rowHeight, PAGE_WIDTH - MARGIN, y + headerHeight + rowHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    
    const textCenter = (txt: string, x: number, offY: number) => {
      doc.text(String(txt), x + (colW/2), y + offY, { align: 'center' });
    };
    textCenter("STARTING", MARGIN, 5.5);
    textCenter("CLOSING", MARGIN + colW, 5.5);
    textCenter("TOTAL", MARGIN + (colW * 2), 5.5);

    const startKmVal = Number(trip.startKm || 0);
    const finalEndKm = Number(trip.endKm || 0) + Number(trip.additionalKm || 0); 
    const totalKmDist = finalEndKm - startKmVal;
    const startTimeStr = formatDateTimeSafe(trip.startDateTime);
    const endTimeStr = formatDateTimeSafe(trip.endDateTime);

    const valY = y + headerHeight + 6;
    const timeY = y + headerHeight + rowHeight + 6;

    const drawMetric = (label: string, val: string, colIdx: number, rowY: number) => {
      const xBase = MARGIN + (colW * colIdx);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]);
      doc.setFontSize(8);
      doc.text(String(label), xBase + 4, rowY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0,0,0);
      doc.setFontSize(9);
      doc.text(String(val), xBase + colW - 4, rowY, { align: 'right' });
    };

    drawMetric("Odometer (Km)", `${startKmVal}`, 0, valY);
    drawMetric("Odometer (Km)", `${finalEndKm}`, 1, valY);
    drawMetric("Distance (Km)", `${totalKmDist}`, 2, valY);
    drawMetric("Time", startTimeStr, 0, timeY);
    drawMetric("Time", endTimeStr, 1, timeY);
    drawMetric("Duration", String(trip.totalTime || "0h 0m"), 2, timeY);

    y += gridH + 10;

    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(MARGIN, y, 60, 20, 2, 2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.label[0], COLORS.label[1], COLORS.label[2]);
    doc.text("Toll & Parking Charges:", MARGIN + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(`Rs. ${String(trip.tollParking || 0)}`, MARGIN + 4, y + 15);

    const sigW = 50; 
    const sigH = 20;
    const sigX = PAGE_WIDTH - MARGIN - sigW;
    const sigY = y;
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(sigX, sigY, sigW, sigH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text("Guest Signature", sigX + 2, sigY + sigH - 2);

    if (isValidBase64Image(trip.signature)) {
      try {
        let formatImg = 'JPEG';
        if (trip.signature.startsWith('data:image/png')) formatImg = 'PNG';
        // @ts-ignore
        doc.addImage(trip.signature, formatImg, sigX + 1, sigY + 1, sigW - 2, sigH - 5, undefined, 'FAST');
      } catch (e) {
        console.warn("Signature Image Render Error", e);
      }
    }

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(`For ${String(settings.agencyName || "Vista Travels")}`, MARGIN + 2, PAGE_HEIGHT - 12);

    if (save) {
      const safeId = String(trip.id || trip.timestamp || Date.now()).replace(/[^a-z0-9]/gi, '_').slice(0, 15);
      const filename = `Tripsheet_${String(trip.vehicleRegNo).replace(/[^a-z0-9]/gi, '_')}_${safeId}.pdf`;
      const pdfBlob = doc.output('blob');
      triggerDownload(pdfBlob, filename);
    }
    return doc;
  } catch (error) {
    console.error("Internal PDF generation crash:", error);
    // Rethrow to be caught by the UI handler
    throw error;
  }
};

export const generateBulkPDF = async (trips: TripData[], settings: AppSettings) => {
  try {
    const zip = new JSZip();
    const folder = zip.folder("tripsheets");
    if (!folder) throw new Error("ZIP library error");

    for (const trip of trips) {
      try {
        const doc = generateSinglePDF(trip, settings, false);
        const pdfBlob = doc.output('blob');
        const safeId = String(trip.id || trip.timestamp || Date.now()).replace(/[^a-z0-9]/gi, '_').slice(0, 15);
        folder.file(`Tripsheet_${String(trip.vehicleRegNo).replace(/[^a-z0-9]/gi, '_')}_${safeId}.pdf`, pdfBlob);
      } catch (singleErr) {
        console.error("Skipping faulty trip in bulk generation:", trip.vehicleRegNo, singleErr);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const filename = `${String(settings.agencyName || "Vista").replace(/\s+/g, '_')}_Tripsheets.zip`;
    triggerDownload(content, filename);
  } catch (error) {
    console.error("Bulk PDF Generation crashed:", error);
    alert("An error occurred while building the ZIP archive.");
  }
};
