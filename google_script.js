/**
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to drive.google.com -> New -> More -> Google Apps Script
 * 2. Paste this code into the Code.gs file
 * 3. Run the 'setupSheet' function ONCE manually to ensure structure.
 * 4. Click 'Deploy' -> 'New deployment' -> 'Web app'
 * 5. Execute as: 'Me', Who has access: 'Anyone'
 */

function getDB() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) {}
  }
  return null;
}

function setupSheet() {
  var ss = getDB();
  if (!ss) {
    ss = SpreadsheetApp.create("Vista Travels Database");
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }
  
  var tripHeaders = [
    "ID", "Company", "BookedBy", "ReportTo", "CarType", "VehicleNo", 
    "StartKM", "EndKM", "TotalKM", 
    "StartDateTime", "EndDateTime", "TotalTime", 
    "TollParking", "AdditionalKM", "Signature", "TripType", "Timestamp", "Source", "Destination"
  ];
  
  var tripsSheet = ss.getSheetByName("Trips") || ss.insertSheet("Trips");
  if (tripsSheet.getLastRow() === 0) tripsSheet.appendRow(tripHeaders);
  
  var companiesSheet = ss.getSheetByName("Companies") || ss.insertSheet("Companies");
  if (companiesSheet.getLastRow() === 0) {
    companiesSheet.appendRow(["Name"]);
    companiesSheet.appendRow(["Vista Travels HQ"]);
  }

  var carTypesSheet = ss.getSheetByName("CarTypes") || ss.insertSheet("CarTypes");
  if (carTypesSheet.getLastRow() === 0) {
    carTypesSheet.appendRow(["Type"]);
    ["Sedan", "SUV", "Innova", "Crysta", "Tempo Traveller"].forEach(t => carTypesSheet.appendRow([t]));
  }

  var settingsSheet = ss.getSheetByName("Settings") || ss.insertSheet("Settings");
  if (settingsSheet.getLastRow() === 0) {
      settingsSheet.appendRow(["Key", "Value"]);
      settingsSheet.appendRow(["agencyName", "Vista Travels"]);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Try lock for 10 seconds (Increased from 5s to reduce contention errors)
  const lockAcquired = lock.tryLock(10000);
  if (!lockAcquired) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: 'System busy, please retry.'})).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = getDB();
    if (!ss) throw new Error("Database not initialized.");
    
    // Parse JSON body safely
    var body;
    try {
        body = JSON.parse(e.postData.contents);
    } catch(err) {
        throw new Error("Invalid JSON payload");
    }
    
    if (body.action === 'add') {
      const sheet = ss.getSheetByName("Trips") || ss.getSheets()[0];
      const d = body.data;
      const row = [
        d.id, d.companyName, d.bookedBy, d.reportTo || '', d.carType || '', d.vehicleRegNo,
        d.startKm, d.endKm, d.totalKm, d.startDateTime, d.endDateTime, d.totalTime, 
        d.tollParking, d.additionalKm || 0, d.signature, d.tripType || 'One way', 
        d.timestamp, d.source || '', d.destination || ''
      ];
      // Faster insertion than appendRow for concurrency
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'updateTrip') {
      const sheet = ss.getSheetByName("Trips");
      const data = sheet.getDataRange().getValues();
      let found = false;
      for (let i = data.length - 1; i >= 1; i--) { 
        let rowTs = data[i][16];
        if (rowTs instanceof Date) rowTs = rowTs.toISOString();
        if (rowTs === body.timestamp) {
          const rowNum = i + 1;
          if (body.id !== undefined) sheet.getRange(rowNum, 1).setValue(body.id); 
          if (body.startDateTime !== undefined) sheet.getRange(rowNum, 10).setValue(body.startDateTime); 
          if (body.endDateTime !== undefined) sheet.getRange(rowNum, 11).setValue(body.endDateTime);
          if (body.totalTime !== undefined) sheet.getRange(rowNum, 12).setValue(body.totalTime);
          if (body.additionalKm !== undefined) sheet.getRange(rowNum, 14).setValue(body.additionalKm);
          if (body.tripType !== undefined) sheet.getRange(rowNum, 16).setValue(body.tripType);
          if (body.source !== undefined) sheet.getRange(rowNum, 18).setValue(body.source);
          if (body.destination !== undefined) sheet.getRange(rowNum, 19).setValue(body.destination);
          if (body.vehicleRegNo !== undefined) sheet.getRange(rowNum, 6).setValue(body.vehicleRegNo);
          if (body.companyName !== undefined) sheet.getRange(rowNum, 2).setValue(body.companyName);
          if (body.bookedBy !== undefined) sheet.getRange(rowNum, 3).setValue(body.bookedBy);
          if (body.reportTo !== undefined) sheet.getRange(rowNum, 4).setValue(body.reportTo);
          if (body.startKm !== undefined) sheet.getRange(rowNum, 7).setValue(body.startKm);
          if (body.endKm !== undefined) sheet.getRange(rowNum, 8).setValue(body.endKm);
          if (body.carType !== undefined) sheet.getRange(rowNum, 5).setValue(body.carType);
          found = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({result: found ? 'success' : 'not found'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Administrative actions
    if (body.action === 'addCompany') {
      ss.getSheetByName("Companies").appendRow([body.name]);
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    if (body.action === 'deleteCompany') {
      const sheet = ss.getSheetByName("Companies");
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 0; i--) { if (data[i][0] === body.name) { sheet.deleteRow(i + 1); break; } }
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    if (body.action === 'addCarType') {
      ss.getSheetByName("CarTypes").appendRow([body.name]);
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    if (body.action === 'deleteCarType') {
      const sheet = ss.getSheetByName("CarTypes");
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 0; i--) { if (data[i][0] === body.name) { sheet.deleteRow(i + 1); break; } }
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    if (body.action === 'updateSettings') {
        const setSheet = ss.getSheetByName("Settings");
        const settings = body.settings;
        const data = setSheet.getDataRange().getValues();
        Object.keys(settings).forEach(key => {
            let f = false;
            for(let i=0; i<data.length; i++) {
                if(data[i][0] === key) { setSheet.getRange(i+1, 2).setValue(settings[key]); f = true; break; }
            }
            if(!f) setSheet.appendRow([key, settings[key]]);
        });
        return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const ss = getDB();
  if (!ss) return ContentService.createTextOutput(JSON.stringify({error: "No DB"})).setMimeType(ContentService.MimeType.JSON);
  const type = e.parameter.type || 'all';
  
  const getTripsData = () => {
    const sheet = ss.getSheetByName("Trips") || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    return data.slice(1).map(row => {
      let ts = row[16];
      if (ts instanceof Date) ts = ts.toISOString();
      return {
        id: row[0], companyName: row[1], bookedBy: row[2], reportTo: row[3], carType: row[4], vehicleRegNo: row[5],
        startKm: row[6], endKm: row[7], totalKm: row[8], startDateTime: row[9], endDateTime: row[10], totalTime: row[11],
        tollParking: row[12], additionalKm: row[13], signature: row[14], tripType: row[15] || 'One way', 
        timestamp: ts, source: row[17], destination: row[18]
      };
    });
  };

  const getData = (sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    return sheet ? sheet.getDataRange().getValues().slice(1).map(r => r[0]).filter(Boolean) : [];
  };

  const getSettingsData = () => {
    const sheet = ss.getSheetByName("Settings");
    if (!sheet) return {};
    const data = sheet.getDataRange().getValues();
    const settings = {};
    for(let i=1; i<data.length; i++) settings[data[i][0]] = data[i][1];
    return settings;
  };

  const res = {};
  if (type === 'all' || type === 'trips') res.trips = getTripsData();
  if (type === 'all' || type === 'companies') res.companies = getData("Companies");
  if (type === 'all' || type === 'carTypes') res.carTypes = getData("CarTypes");
  if (type === 'all' || type === 'settings') res.settings = getSettingsData();
  
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}