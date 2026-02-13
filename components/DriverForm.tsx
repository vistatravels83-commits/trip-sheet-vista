import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { FormData, TripData, AppSettings } from '../types';
import SignatureCanvas, { SignatureRef } from './SignatureCanvas';
import { saveTrip, getAllDashboardData, DEFAULT_CAR_TYPES, DEFAULT_COMPANIES } from '../services/api';
import { format, differenceInMinutes } from 'date-fns';
import { CheckCircle, AlertCircle, Loader2, Calendar, Clock, WifiOff, Wifi } from 'lucide-react';

const DriverForm: React.FC = () => {
  const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');
  const getCurrentTime = () => format(new Date(), 'HH:mm');

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      startDate: getTodayDate(),
      startTime: getCurrentTime(),
      endDate: getTodayDate(),
      endTime: getCurrentTime(),
      tollParking: 0,
      companyName: '',
      carType: '',
      tripType: 'One way',
      source: '',
      destination: '',
      vehicleRegNo: '',
      startKm: 0,
      endKm: 0,
      bookedBy: '',
      reportTo: ''
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [initError, setInitError] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<string[]>(DEFAULT_COMPANIES);
  const [carTypeOptions, setCarTypeOptions] = useState<string[]>(DEFAULT_CAR_TYPES);
  const [agencyName, setAgencyName] = useState('Vista Travels');
  const sigPadRef = useRef<SignatureRef>(null);

  useEffect(() => {
    const initData = async () => {
      // First try to load from session storage for immediate UI
      const cached = sessionStorage.getItem('vista_cache_all');
      if (cached) {
        const d = JSON.parse(cached);
        if (d.companies?.length) setCompanyOptions(d.companies.sort());
        if (d.carTypes?.length) setCarTypeOptions(d.carTypes.sort());
        if (d.settings?.agencyName) setAgencyName(d.settings.agencyName);
      }

      try {
        const data = await getAllDashboardData();
        if (data.fetchError) {
          setInitError("Backend connection failed");
          console.warn("Running in offline/cached mode due to:", data.fetchError);
        } else {
          setInitError(null);
        }

        if (data.companies?.length) setCompanyOptions(data.companies.sort());
        if (data.carTypes?.length) setCarTypeOptions(data.carTypes.sort());
        if (data.settings?.agencyName) setAgencyName(data.settings.agencyName);
      } catch (e: any) {
        console.error("Failed to sync latest data", e);
        setInitError("Network Error");
      }
    };
    initData();
  }, []);

  const startKm = watch('startKm');
  const endKm = watch('endKm');
  const startDate = watch('startDate');
  const startTime = watch('startTime');
  const endDate = watch('endDate');
  const endTime = watch('endTime');

  const totalKm = (startKm !== undefined && endKm !== undefined) ? endKm - startKm : 0;

  let durationDisplay = "0h 0m";
  if (startDate && startTime && endDate && endTime) {
    const d1 = new Date(`${startDate}T${startTime}`), d2 = new Date(`${endDate}T${endTime}`);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diff = differenceInMinutes(d2, d1);
      if (diff >= 0) durationDisplay = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }
  }

  const handleSigBegin = useCallback(() => setSignatureError(false), []);

  const onSubmit = async (data: FormData) => {
    setErrorMessage('');
    if (sigPadRef.current?.isEmpty()) {
      setSignatureError(true);
      return;
    }

    if (data.startKm > 0 && data.endKm > 0 && Number(data.endKm) < Number(data.startKm)) {
      alert("End KM cannot be less than Start KM");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      let signatureData = '';
      const trimmed = sigPadRef.current?.getTrimmedCanvas();

      if (trimmed) {
        // Create a temporary canvas to resize/compress the image
        // Max width 500px ensures payload isn't too large for GAS
        const maxWidth = 500;
        let newWidth = trimmed.width;
        let newHeight = trimmed.height;

        if (newWidth > maxWidth) {
          const ratio = maxWidth / newWidth;
          newWidth = maxWidth;
          newHeight = trimmed.height * ratio;
        }

        const white = document.createElement('canvas');
        white.width = newWidth;
        white.height = newHeight;
        const ctx = white.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, white.width, white.height);
          // Draw scaled image
          ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, newWidth, newHeight);
          // High signature quality (0.9) ensures it looks sharp in the PDF
          signatureData = white.toDataURL('image/jpeg', 0.9);
        }
      }

      const tripData: TripData = {
        id: "",
        companyName: data.companyName || '',
        bookedBy: data.bookedBy || '',
        reportTo: data.reportTo || '',
        carType: data.carType || '',
        tripType: data.tripType || 'One way',
        source: data.source || '',
        destination: data.destination || '',
        vehicleRegNo: (data.vehicleRegNo || '').toUpperCase(),
        startKm: Number(data.startKm || 0),
        endKm: Number(data.endKm || 0),
        totalKm: Number(data.endKm || 0) - Number(data.startKm || 0),
        startDateTime: data.startDate && data.startTime ? `${data.startDate}T${data.startTime}` : new Date().toISOString(),
        endDateTime: data.endDate && data.endTime ? `${data.endDate}T${data.endTime}` : new Date().toISOString(),
        totalTime: durationDisplay,
        tollParking: Number(data.tollParking || 0),
        signature: signatureData,
        timestamp: new Date().toISOString()
      };

      const result = await saveTrip(tripData);

      if (result) {
        setSubmitStatus('success');
        reset({
          startDate: getTodayDate(),
          startTime: getCurrentTime(),
          endDate: getTodayDate(),
          endTime: getCurrentTime(),
          tollParking: 0,
          companyName: '',
          carType: '',
          tripType: 'One way',
          source: '',
          destination: '',
          vehicleRegNo: '',
          startKm: 0,
          endKm: 0,
          bookedBy: '',
          reportTo: ''
        });
        sigPadRef.current?.clear();
        setTimeout(() => setSubmitStatus('idle'), 5000);
      } else {
        throw new Error("Server returned an unexpected response.");
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      setSubmitStatus('error');

      let msg = err.message || "Failed to save trip.";
      if (msg.includes("404")) msg = "Backend not reachable (404). Check internet or config.";
      if (msg.includes("500")) msg = "Server error. Please try again later.";

      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-blue-800 p-6 text-white relative">
        <h1 className="text-2xl font-bold">{agencyName}</h1>
        <p className="text-blue-100 text-sm">Driver Trip Entry</p>

        {initError ? (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 text-amber-100 text-[10px] rounded border border-amber-500/30 backdrop-blur-sm" title={initError}>
            <WifiOff className="w-3 h-3" /> Offline
          </div>
        ) : (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-green-500/20 text-green-100 text-[10px] rounded border border-green-500/30 backdrop-blur-sm">
            <Wifi className="w-3 h-3" /> Online
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
        {/* Company Selection */}
        <div>
          <label className="text-sm font-semibold text-slate-700">Company Name</label>
          <input
            list="companies"
            {...register('companyName')}
            className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Select or enter company"
          />
          <datalist id="companies">
            {companyOptions.map(o => <option key={o} value={o} />)}
          </datalist>
        </div>

        {/* Client & Guest */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Booked By</label>
            <input {...register('bookedBy')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Client Name" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Report To</label>
            <input {...register('reportTo')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Guest Name" />
          </div>
        </div>

        {/* Car & Trip Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Car Type</label>
            <select {...register('carType')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">Select</option>
              {carTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Trip Type</label>
            <select {...register('tripType')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="One way">One way</option>
              <option value="Round Trip">Round Trip</option>
            </select>
          </div>
        </div>

        {/* Route */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">From</label>
            <input {...register('source')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Source" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">To</label>
            <input {...register('destination')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Destination" />
          </div>
        </div>

        {/* Vehicle */}
        <div>
          <label className="text-sm font-semibold text-slate-700">Vehicle Reg No.</label>
          <input {...register('vehicleRegNo')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 uppercase focus:ring-2 focus:ring-blue-500 outline-none" placeholder="TN-00-AA-0000" />
        </div>

        {/* Date & Time Section */}
        <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5" /> Start Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" {...register('startDate')} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="time" {...register('startTime')} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5" /> End Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" {...register('endDate')} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="time" {...register('endTime')} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-600">Total Duration:</span>
            <span className="font-bold text-blue-700">{durationDisplay}</span>
          </div>
        </div>

        {/* KM Section */}
        <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Start KM</label>
              <input type="number" {...register('startKm')} className="w-full p-2.5 border border-slate-300 rounded-lg mt-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">End KM</label>
              <input type="number" {...register('endKm')} className="w-full p-2.5 border border-slate-300 rounded-lg mt-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-sm font-medium text-slate-600">Total Distance:</span>
            <span className="font-bold text-blue-700">{totalKm} km</span>
          </div>
        </div>

        {/* Expenses */}
        <div>
          <label className="text-sm font-semibold text-slate-700">Tolls/Parking (Rs)</label>
          <input type="number" {...register('tollParking')} className="w-full p-3 border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
        </div>

        {/* Signature */}
        <div>
          <label className="text-sm font-semibold text-slate-700">Guest Signature <span className="text-red-500">*</span></label>
          <div className={`mt-2 ${signatureError ? 'ring-2 ring-red-500 rounded-lg' : ''}`}>
            <SignatureCanvas ref={sigPadRef} onBegin={handleSigBegin} />
          </div>
          {signatureError && <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Signature is required to submit</p>}
          <div className="text-right mt-1.5">
            <button type="button" onClick={() => sigPadRef.current?.clear()} className="text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors">Clear Signature</button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-4">
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span>Processing...</span>
              </>
            ) : "Submit Trip Sheet"}
          </button>

          {submitStatus === 'success' && (
            <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="h-5 w-5" /> Trip sheet submitted successfully!
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Submission Failed</div>
                <div className="text-xs opacity-90">{errorMessage || "Check your internet connection and try again."}</div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default DriverForm;