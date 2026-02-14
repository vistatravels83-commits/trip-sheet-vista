import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { FormData, TripData, AppSettings } from '../types';
import SignatureCanvas, { SignatureRef } from './SignatureCanvas';
import { saveTrip, getAllDashboardData, DEFAULT_CAR_TYPES, DEFAULT_COMPANIES } from '../services/api';
import { format, differenceInMinutes } from 'date-fns';
import { CheckCircle, AlertCircle, Loader2, Calendar, Clock, WifiOff, Wifi, Car, MapPin, User, ChevronRight, Activity, Building2, CheckCircle2, XCircle } from 'lucide-react';

const SuccessScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    if (timeLeft <= 0) {
      onFinish();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onFinish]);

  return (
    <div className="max-w-md mx-auto min-h-[85vh] flex flex-col items-center justify-center sm:p-8 p-6 animate-fade-in text-center">
      <div className="sm:w-24 sm:h-24 w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 sm:mb-8 shadow-xl shadow-primary/20 border-4 border-white">
        <CheckCircle2 className="sm:w-12 sm:h-12 w-10 h-10 text-primary animate-bounce" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-black font-outfit text-amber-950 mb-3 tracking-tight text-center uppercase">Successfully Created</h2>
      <p className="text-amber-900/60 font-bold max-w-[280px] text-sm sm:text-base">Trip logged and dashboard updated.</p>
      <div className="mt-8 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
        Redirecting in {timeLeft} seconds...
      </div>
    </div>
  );
};

const DriverForm: React.FC = () => {
  const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');
  const getCurrentTime = () => format(new Date(), 'HH:mm');

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      startDate: getTodayDate(),
      startTime: getCurrentTime(),
      endDate: getTodayDate(),
      endTime: getCurrentTime(),
      tollParking: 0,
      companyName: '',
      carType: '',
      tripType: 'Local',
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

  const getFieldClass = (fieldName: keyof FormData, baseClasses: string = "") => {
    const hasError = !!errors[fieldName];
    return `${baseClasses} ${hasError ? 'border-rose-500 ring-4 ring-rose-500/10 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-primary/10'}`;
  };

  const handleNumericInput = (fieldName: keyof FormData, allowZeroValue: boolean = false) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Remove leading zeros
    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '');
    }

    // For fields that cannot be absolute 0
    if (!allowZeroValue && val === '0') {
      val = '';
    }

    setValue(fieldName, val as any);
  };

  useEffect(() => {
    const initData = async () => {
      const cached = sessionStorage.getItem('vista_cache_all');
      if (cached) {
        const d = JSON.parse(cached);
        if (d.companies?.length) setCompanyOptions(d.companies.sort());
        if (d.carTypes?.length) setCarTypeOptions(d.carTypes.sort());
        if (d.settings?.agencyName) setAgencyName(d.settings.agencyName);
      }

      try {
        const data = await getAllDashboardData();
        if (data.fetchError) setInitError("Backend sync issues");
        else setInitError(null);

        if (data.companies?.length) setCompanyOptions(data.companies.sort());
        if (data.carTypes?.length) setCarTypeOptions(data.carTypes.sort());
        if (data.settings?.agencyName) setAgencyName(data.settings.agencyName);
      } catch (e: any) {
        setInitError("Network Error");
      }
    };
    initData();
  }, []);

  const totalKm = (watch('startKm') !== undefined && watch('endKm') !== undefined) ? watch('endKm') - watch('startKm') : 0;

  let durationDisplay = "0h 0m";
  const sd = watch('startDate'), st = watch('startTime'), ed = watch('endDate'), et = watch('endTime');
  if (sd && st && ed && et) {
    const d1 = new Date(`${sd}T${st}`), d2 = new Date(`${ed}T${et}`);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diff = differenceInMinutes(d2, d1);
      if (diff >= 0) durationDisplay = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }
  }

  const handleSigBegin = useCallback(() => setSignatureError(false), []);

  const onSubmit = async (data: FormData) => {
    setErrorMessage('');
    // Signature is handled manually as it's not a standard form field
    if (sigPadRef.current?.isEmpty()) {
      setSignatureError(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      let signatureData = '';
      const trimmed = sigPadRef.current?.getTrimmedCanvas();

      if (trimmed) {
        const maxWidth = 500;
        let newWidth = trimmed.width, newHeight = trimmed.height;
        if (newWidth > maxWidth) {
          const ratio = maxWidth / newWidth;
          newWidth = maxWidth;
          newHeight = trimmed.height * ratio;
        }

        const white = document.createElement('canvas');
        white.width = newWidth; white.height = newHeight;
        const ctx = white.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, white.width, white.height);
          ctx.drawImage(trimmed, 0, 0, trimmed.width, trimmed.height, 0, 0, newWidth, newHeight);
          signatureData = white.toDataURL('image/jpeg', 0.9);
        }
      }

      const id = `VT-${format(new Date(), 'yyyyMMdd')}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

      const tripData: TripData = {
        id,
        companyName: data.companyName || '',
        bookedBy: data.bookedBy || '',
        reportTo: data.reportTo || '',
        carType: data.carType || '',
        tripType: data.tripType || 'Local',
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

      if (await saveTrip(tripData)) {
        setSubmitStatus('success');
        reset({
          startDate: getTodayDate(), startTime: getCurrentTime(), endDate: getTodayDate(), endTime: getCurrentTime(),
          tollParking: 0, companyName: '', carType: '', tripType: 'Local',
          source: '', destination: '', vehicleRegNo: '', startKm: 0, endKm: 0,
          bookedBy: '', reportTo: ''
        });
        sigPadRef.current?.clear();
      } else {
        throw new Error("Cloud sync failed");
      }
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message || "Failed to save trip.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return <SuccessScreen onFinish={() => setSubmitStatus('idle')} />;
  }

  return (
    <div className="max-w-lg mx-auto glass sm:rounded-3xl rounded-2xl overflow-hidden shadow-2xl border border-white/50 bg-white/40 animate-fade-in m-2">
      <div className="glass-dark sm:p-6 p-4 text-white relative">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl font-black font-outfit tracking-tighter uppercase">{agencyName}</h1>
          <p className="text-primary text-[10px] font-black tracking-[0.3em] uppercase flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Driver Trip Sheet
          </p>
        </div>

        {initError ? (
          <div className="absolute top-6 sm:top-10 right-6 sm:right-10 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-500/10 text-rose-300 text-[10px] font-black rounded-full border border-rose-500/20 glass">
            <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> OFFLINE
          </div>
        ) : (
          <div className="absolute top-6 sm:top-10 right-6 sm:right-10 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/20 glass">
            <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> ONLINE
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="sm:p-4 p-3 space-y-2 sm:space-y-3">
        {/* Entity Choice */}
        <div className="space-y-2">
          <div className="group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-primary" /> Company Name
            </label>
            <input
              list="companies" {...register('companyName', { required: true })}
              className={getFieldClass('companyName', "w-full p-2.5 bg-white rounded-xl outline-none transition-all shadow-inner font-bold text-slate-700 placeholder:text-slate-300 border text-sm")}
              placeholder="Select Company"
            />
            <datalist id="companies">{companyOptions.map(o => <option key={o} value={o} />)}</datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Booked By</label>
              <input {...register('bookedBy', { required: true })} className={getFieldClass('bookedBy', "w-full p-2.5 bg-white rounded-xl focus:ring-4 outline-none shadow-inner font-bold border text-sm")} placeholder="Name" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Report To</label>
              <input {...register('reportTo', { required: true })} className={getFieldClass('reportTo', "w-full p-2.5 bg-white rounded-xl focus:ring-4 outline-none shadow-inner font-bold border text-sm")} placeholder="Name" />
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="bg-amber-50/20 sm:p-3 p-2 sm:rounded-2xl rounded-xl border border-amber-100/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-0.5 block">Car Type</label>
              <select {...register('carType', { required: true })} className={getFieldClass('carType', "w-full p-2.5 bg-white border rounded-xl outline-none font-black text-slate-700 appearance-none shadow-sm cursor-pointer text-xs")}>
                <option value="">Choose Type</option>
                {carTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-0.5 block">Trip Type</label>
              <select {...register('tripType', { required: true })} className={getFieldClass('tripType', "w-full p-2.5 bg-white border rounded-xl outline-none font-black text-slate-700 appearance-none shadow-sm cursor-pointer text-xs")}>
                <option value="Local">Local</option>
                <option value="Outstation">Outstation</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-primary/70 uppercase tracking-widest mb-0.5 block">Vehicle Registration Number</label>
            <input {...register('vehicleRegNo', { required: true, maxLength: 13 })} maxLength={13} className={getFieldClass('vehicleRegNo', "w-full p-2.5 bg-white border rounded-xl uppercase font-black text-lg tracking-widest outline-none shadow-sm text-amber-950 placeholder:text-slate-200")} placeholder="TN-00-AA-0000" />
          </div>
        </div>

        {/* Mission Route */}
        <div className="relative pt-0.5 pl-2">
          <div className="absolute left-6 top-8 bottom-8 w-[1px] bg-slate-200 border-l border-dashed border-slate-300 opacity-50"></div>
          <div className="space-y-2">
            <div className="relative pl-10">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-50 z-10 shadow-sm"></div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block">Source Point</label>
              <input {...register('source', { required: true })} className={getFieldClass('source', "w-full p-2.5 bg-white/40 border rounded-xl outline-none shadow-sm font-bold text-xs")} placeholder="Departure" />
            </div>
            <div className="relative pl-10">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white ring-2 ring-amber-50 z-10 shadow-sm"></div>
              <label className="text-[10px] font-black text-amber-900/40 uppercase tracking-[0.3em] mb-0.5 block">Terminal Point</label>
              <input {...register('destination', { required: true })} className={getFieldClass('destination', "w-full p-2.5 bg-white/40 border rounded-xl outline-none shadow-sm font-bold text-amber-950 text-xs")} placeholder="Arrival" />
            </div>
          </div>
        </div>

        {/* Telemetry Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-slate-50/30 p-3 rounded-2xl border border-slate-100/50 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-2">
              <Clock className="w-4 h-4 opacity-50" /> Log Schedule
            </p>
            <div className="space-y-1">
              <div className="flex gap-1.5">
                <input type="date" {...register('startDate', { required: true })} className={getFieldClass('startDate', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")} />
                <input type="time" {...register('startTime', { required: true })} className={getFieldClass('startTime', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")} />
              </div>
              <div className="flex gap-1.5">
                <input type="date" {...register('endDate', { required: true })} className={getFieldClass('endDate', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")} />
                <input type="time" {...register('endTime', { required: true })} className={getFieldClass('endTime', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")} />
              </div>
            </div>
          </div>

          <div className="bg-slate-50/30 p-3 rounded-2xl border border-slate-100/50 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 flex items-center gap-2">
              <Activity className="w-4 h-4 opacity-50" /> Odometer Readings
            </p>
            <div className="space-y-2 relative pl-6">
              <div className="absolute left-2 top-2.5 bottom-2.5 w-[1px] bg-slate-200 border-l border-dashed border-slate-300 opacity-30"></div>

              <div className="relative">
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500/50 border border-white z-10 shadow-sm"></div>
                <input
                  type="number"
                  {...register('startKm', {
                    required: true,
                    min: 1,
                    pattern: { value: /^[1-9]\d*$/, message: "Leading zeros not allowed" }
                  })}
                  onInput={handleNumericInput('startKm')}
                  className={getFieldClass('startKm', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")}
                  placeholder="Start Reading"
                />
              </div>

              <div className="relative">
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/50 border border-white z-10 shadow-sm"></div>
                <input
                  type="number"
                  {...register('endKm', {
                    required: true,
                    min: 1,
                    pattern: { value: /^[1-9]\d*$/, message: "Leading zeros not allowed" },
                    validate: (value) => Number(value) >= Number(watch('startKm')) || "End KM must be greater than Start KM"
                  })}
                  onInput={handleNumericInput('endKm')}
                  className={getFieldClass('endKm', "w-full p-2 border rounded-xl text-[10px] font-black bg-white outline-none shadow-sm")}
                  placeholder="End Reading"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Global Summary Tally */}
        <div className="bg-primary sm:rounded-2xl rounded-xl sm:p-4 p-3 text-amber-950 flex justify-between items-center shadow-2xl shadow-primary/20 group">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Trip Duration</span>
            <span className="text-xl sm:text-2xl font-black font-outfit leading-none">{durationDisplay}</span>
          </div>
          <div className="h-6 w-[1px] bg-amber-950/20"></div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em]">Net Odo</span>
            <span className="text-xl sm:text-2xl font-black font-outfit leading-none">{totalKm} <span className="text-[10px] opacity-50">KM</span></span>
          </div>
        </div>

        {/* Cash Disbursements */}
        <div className="group">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1">
            <span>Toll / Parking (Rs.)</span>
            <Activity className="w-4 h-4 text-primary" />
          </label>
          <input
            type="number"
            {...register('tollParking', {
              required: true,
              min: 0,
              pattern: { value: /^(0|[1-9]\d*)$/, message: "Leading zeros not allowed" }
            })}
            onInput={handleNumericInput('tollParking', true)}
            className={getFieldClass('tollParking', "w-full p-3 border rounded-xl outline-none shadow-inner font-black text-slate-700 text-base")}
            placeholder="0"
          />
        </div>

        {/* Forensic Validation (Signature) */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center justify-between">
            <span>Guest Signature</span>
            <span className="text-rose-500 text-base">*</span>
          </label>
          <div className={`mt-0.5 bg-white rounded-xl overflow-hidden border-2 transition-all ${signatureError ? 'border-rose-500 ring-4 ring-rose-500/5' : 'border-slate-100 shadow-inner focus-within:border-primary'}`}>
            <SignatureCanvas ref={sigPadRef} onBegin={handleSigBegin} />
          </div>
          <div className="flex justify-between items-center">
            {signatureError ?
              <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Required</p> :
              <div />
            }
            <button type="button" onClick={() => sigPadRef.current?.clear()} className="p-1.5 px-3 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">Clear</button>
          </div>
        </div>

        {/* Command Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary !w-full !rounded-2xl !py-4 !shadow-primary/20 group active:scale-95 transition-transform !text-amber-950"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span className="uppercase tracking-wider font-black text-sm">Submitting...</span>
              </>
            ) : (
              <>
                <span className="uppercase tracking-wider font-black text-base">Submit Trip Sheet</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform opacity-30" />
              </>
            )}
          </button>

          {submitStatus === 'error' && (
            <div className="mt-8 p-6 bg-rose-50 text-rose-700 border border-rose-100 rounded-[2rem] flex items-start gap-5 animate-in fade-in slide-in-from-top-6">
              <XCircle className="h-8 w-8 shrink-0 text-rose-400" />
              <div className="flex-1">
                <p className="font-black uppercase text-xs tracking-widest mb-1.5 opacity-60">Submission Error</p>
                <p className="font-bold text-sm">{errorMessage || "Failed to send data. Please check your connection and try again."}</p>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default DriverForm;