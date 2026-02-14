import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { TripData, AppSettings } from '../types';
import { getAllDashboardData, addCompany, deleteCompany, updateTrip, saveSettings, addCarType, deleteCarType, subscribeToTrips } from '../services/api';
import { generateSinglePDF, generateBulkPDF } from '../services/pdfGenerator';
import { FileText, Download, RefreshCw, Archive, Search, Building2, Trash2, Plus, Car, Settings as SettingsIcon, Save, Upload, CarFront, MapPin, Activity, Zap, TrendingUp, Users, Fuel, CheckCircle2, XCircle } from 'lucide-react';
import { format, differenceInMinutes, isToday } from 'date-fns';

// --- Toast System Components ---
type ToastType = 'success' | 'error';
interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

const ToastMessage = ({ toast, onRemove }: { toast: Toast, onRemove: (id: string) => void, key?: string }) => {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), 5000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    return (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {toast.type === 'success' ?
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                <XCircle className="w-5 h-5 text-rose-500" />
            }
            <span className="text-sm font-medium text-slate-700">{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="ml-auto text-slate-400 hover:text-slate-600">
                <XCircle className="w-4 h-4 opacity-50" />
            </button>
        </div>
    );
};

// --- Optimized Table Row Component ---
const TripRow = memo(({
    trip,
    selected,
    onSelect,
    onUpdate,
    onSave,
    onDownload,
    saving,
    carTypes,
    companies
}: {
    trip: TripData;
    selected: boolean;
    onSelect: () => void;
    onUpdate: (timestamp: string, updates: Partial<TripData>) => void;
    onSave: () => void;
    onDownload: () => void;
    saving: boolean;
    carTypes: string[];
    companies: string[];
}) => {
    const formatDateForInput = (isoString: string) => {
        try { return isoString ? format(new Date(isoString), "yyyy-MM-dd'T'HH:mm") : ''; } catch { return ''; }
    };

    return (
        <tr className="hover:bg-primary-light/50 transition-colors animate-fade-in group border-b border-primary-light/20">
            <td className="sm:p-4 p-2.5">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
            </td>
            <td className="sm:p-4 p-2.5">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={trip.id || ''}
                        readOnly
                        placeholder="ID"
                        className="w-24 p-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-500 font-bold outline-none cursor-not-allowed shadow-inner"
                    />
                    {saving && <RefreshCw className="h-3 w-3 animate-spin text-primary" />}
                </div>
            </td>
            <td className="p-4 space-y-2">
                <input
                    type="text"
                    value={trip.vehicleRegNo || ''}
                    onChange={(e) => onUpdate(trip.timestamp, { vehicleRegNo: e.target.value.toUpperCase() })}
                    onBlur={onSave}
                    className="w-full p-2 text-xs border border-slate-200 rounded-xl font-black uppercase focus:ring-4 focus:ring-primary/10 outline-none bg-white tracking-widest"
                />
                <div className="flex gap-2">
                    <select
                        value={trip.carType || ''}
                        onChange={(e) => onUpdate(trip.timestamp, { carType: e.target.value })}
                        onBlur={onSave}
                        className="w-1/2 text-[10px] p-1.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-4 focus:ring-primary/10 outline-none font-bold"
                    >
                        <option value="">Car Type</option>
                        {carTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                    <select
                        value={trip.tripType || 'One way'}
                        onChange={(e) => onUpdate(trip.timestamp, { tripType: e.target.value })}
                        onBlur={onSave}
                        className="w-1/2 text-[10px] p-1.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-4 focus:ring-primary/10 outline-none font-bold"
                    >
                        <option value="One way">One way</option><option value="Round Trip">Round Trip</option>
                    </select>
                </div>
            </td>
            <td className="p-4 space-y-2">
                <input type="text" value={trip.source || ''} onChange={(e) => onUpdate(trip.timestamp, { source: e.target.value })} onBlur={onSave} placeholder="Source" className="w-full p-2 text-xs border border-slate-200 rounded-xl block focus:ring-4 focus:ring-primary/10 outline-none bg-white" />
                <input type="text" value={trip.destination || ''} onChange={(e) => onUpdate(trip.timestamp, { destination: e.target.value })} onBlur={onSave} placeholder="Destination" className="w-full p-2 text-xs border border-slate-200 rounded-xl block focus:ring-4 focus:ring-primary/10 outline-none bg-white" />
            </td>
            <td className="p-4 space-y-2">
                <input type="datetime-local" value={formatDateForInput(trip.startDateTime)} onChange={(e) => onUpdate(trip.timestamp, { startDateTime: e.target.value })} onBlur={onSave} className="p-2 border border-slate-200 rounded-xl text-[10px] block w-full focus:ring-4 focus:ring-primary/10 outline-none bg-white font-bold" />
                <input type="datetime-local" value={formatDateForInput(trip.endDateTime)} onChange={(e) => onUpdate(trip.timestamp, { endDateTime: e.target.value })} onBlur={onSave} className="p-2 border border-slate-200 rounded-xl text-[10px] block w-full focus:ring-4 focus:ring-primary/10 outline-none bg-white font-bold" />
            </td>
            <td className="p-4 space-y-2">
                <input type="text" value={trip.bookedBy || ''} onChange={(e) => onUpdate(trip.timestamp, { bookedBy: e.target.value })} onBlur={onSave} placeholder="Booked By" className="w-full p-2 text-xs border border-slate-200 rounded-xl block focus:ring-4 focus:ring-primary/10 outline-none bg-white" />
                <input type="text" value={trip.reportTo || ''} onChange={(e) => onUpdate(trip.timestamp, { reportTo: e.target.value })} onBlur={onSave} placeholder="Report To" className="w-full p-2 text-xs border border-slate-200 rounded-xl block focus:ring-4 focus:ring-primary/10 outline-none bg-white" />
            </td>
            <td className="sm:p-4 p-2.5">
                <input type="text" list="company_list" value={trip.companyName || ''} onChange={(e) => onUpdate(trip.timestamp, { companyName: e.target.value })} onBlur={onSave} className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none bg-white font-bold" />
            </td>
            <td className="p-4 text-center font-mono space-y-2">
                <div className="flex flex-col gap-2 items-center">
                    <input type="number" value={trip.startKm || 0} onChange={(e) => onUpdate(trip.timestamp, { startKm: parseInt(e.target.value) || 0 })} onBlur={onSave} className="w-24 p-2 text-center border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-primary/10 outline-none bg-white font-bold" />
                    <input type="number" value={trip.endKm || 0} onChange={(e) => onUpdate(trip.timestamp, { endKm: parseInt(e.target.value) || 0 })} onBlur={onSave} className="w-24 p-2 text-center border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-primary/10 outline-none bg-white font-bold" />
                </div>
            </td>
            <td className="p-4 space-y-2">
                <div className="text-center font-black text-amber-700 text-[10px]">{trip.totalKm} km / {trip.totalTime}</div>
                <div className="flex flex-col gap-1.5">
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">Extra KM</span>
                        <input type="number" value={trip.additionalKm || ''} onChange={(e) => onUpdate(trip.timestamp, { additionalKm: parseFloat(e.target.value) || 0 })} onBlur={onSave} className="w-full p-1.5 pl-12 border border-slate-200 rounded-lg text-right text-[10px] focus:ring-4 focus:ring-primary/10 outline-none bg-white font-black" />
                    </div>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary uppercase">Toll/Prk</span>
                        <input type="number" value={trip.tollParking || ''} onChange={(e) => onUpdate(trip.timestamp, { tollParking: parseFloat(e.target.value) || 0 })} onBlur={onSave} className="w-full p-1.5 pl-12 border border-slate-200 rounded-lg text-right text-[10px] focus:ring-4 focus:ring-primary/10 outline-none bg-white font-black text-primary" />
                    </div>
                </div>
            </td>
            <td className="p-4 text-right">
                <button
                    onClick={onDownload}
                    className="p-3 text-primary hover:bg-primary hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm bg-white border border-primary-light"
                >
                    <Download className="h-4 w-4" />
                </button>
            </td>
        </tr>
    );
});

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) => (
    <div className="glass sm:p-5 p-4 sm:rounded-2xl rounded-xl flex items-center justify-between animate-fade-in shadow-md border border-white/60 group hover:shadow-xl hover:shadow-primary/5 transition-all">
        <div>
            <p className="text-[10px] font-black text-amber-800/60 uppercase tracking-[0.2em] mb-1.5 sm:mb-2">{title}</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-outfit tracking-tighter">{value}</h3>
        </div>
        <div className={`sm:p-4 p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform`}>
            <Icon className={`sm:w-8 sm:h-8 w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
    </div>
);

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'trips' | 'companies' | 'cartypes' | 'settings'>('trips');

    // Data States
    const [trips, setTrips] = useState<TripData[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);
    const [carTypes, setCarTypes] = useState<string[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    // UI States
    const [selectedTimestamps, setSelectedTimestamps] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [filter, setFilter] = useState('');
    const [savingRow, setSavingRow] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Action States
    const [newCompany, setNewCompany] = useState('');
    const [newCarType, setNewCarType] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    const addToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const fetchData = async (isManual = false) => {
        if (isManual) setLoading(true);
        else setSyncing(true);

        try {
            const data = await getAllDashboardData();

            const sortedTrips = (data.trips || []).sort((a: any, b: any) => {
                const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return tB - tA;
            });

            setTrips(sortedTrips);
            setCompanies((data.companies || []).sort());
            setCarTypes((data.carTypes || []).sort());
            setSettings(data.settings);
        } catch (error) {
            console.error("Dashboard fetch error", error);
            addToast("Failed to fetch dashboard data", "error");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    useEffect(() => {
        const cached = sessionStorage.getItem('vista_cache_all');
        if (cached) {
            const data = JSON.parse(cached);
            setTrips((data.trips || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            setCompanies((data.companies || []).sort());
            setCarTypes((data.carTypes || []).sort());
            setSettings(data.settings);
        }

        fetchData(!cached);

        // Real-time listener
        const subscription = subscribeToTrips(() => {
            fetchData(false);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Statistics Memoization
    const stats = useMemo(() => {
        const today = trips.filter(t => t.timestamp && isToday(new Date(t.timestamp)));
        const totalEarnings = trips.reduce((acc, t) => acc + Number(t.tollParking || 0), 0);
        const totalKm = trips.reduce((acc, t) => acc + Number(t.totalKm || 0) + Number(t.additionalKm || 0), 0);

        return {
            todayCount: today.length,
            totalCount: trips.length,
            earnings: totalEarnings,
            km: totalKm
        };
    }, [trips]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedTimestamps(new Set(trips.map(t => t.timestamp)));
        else setSelectedTimestamps(new Set());
    };

    const handleSelectOne = (timestamp: string) => {
        const newSet = new Set(selectedTimestamps);
        if (newSet.has(timestamp)) newSet.delete(timestamp);
        else newSet.add(timestamp);
        setSelectedTimestamps(newSet);
    };

    const updateTripLocally = (timestamp: string, updates: Partial<TripData>) => {
        setTrips(prev => prev.map(t => {
            if (t.timestamp !== timestamp) return t;
            const updated = { ...t, ...updates };

            // Recalculate total KM
            const sKm = Number(updated.startKm || 0);
            const eKm = Number(updated.endKm || 0);
            updated.totalKm = eKm - sKm;

            // Recalculate total time
            if (updated.startDateTime && updated.endDateTime) {
                const d1 = new Date(updated.startDateTime);
                const d2 = new Date(updated.endDateTime);
                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                    const diff = differenceInMinutes(d2, d1);
                    if (diff >= 0) {
                        updated.totalTime = `${Math.floor(diff / 60)}h ${diff % 60}m`;
                    } else {
                        updated.totalTime = "Invalid";
                    }
                }
            }
            return updated;
        }));
    };

    const handleSaveTrip = async (timestamp: string, trip: TripData) => {
        setSavingRow(timestamp);
        try {
            await updateTrip(timestamp, trip);
            addToast("Trip record updated successfully");
        } catch (e) {
            console.error("Save failed", e);
            addToast("Failed to update trip record", "error");
        }
        setSavingRow(null);
    };

    // Bulk & Single Downloads
    const handleBulkDownload = async () => {
        if (!settings) return;
        const selectedTrips = trips.filter(t => selectedTimestamps.has(t.timestamp));
        if (selectedTrips.length === 0) return;

        try {
            if (selectedTrips.length === 1) await generateSinglePDF(selectedTrips[0], settings);
            else await generateBulkPDF(selectedTrips, settings);
            addToast(`Successfully generated ${selectedTrips.length} PDF(s)`);
        } catch (e) {
            console.error("Bulk download failed", e);
            addToast("Encryption or generation failed for bulk PDFs", "error");
        }
    };

    const handleSingleDownload = async (trip: TripData) => {
        if (!settings) return;
        try {
            await generateSinglePDF(trip, settings);
            addToast("PDF generated successfully");
        } catch (e) {
            console.error("Single PDF download failed", e);
            addToast("PDF generation failed", "error");
        }
    };

    const handleExportAllTrips = async () => {
        if (!settings) return;
        if (filteredTrips.length === 0) {
            addToast("No trips found to export", "warning");
            return;
        }

        setLoading(true);
        try {
            if (filteredTrips.length === 1) await generateSinglePDF(filteredTrips[0], settings);
            else await generateBulkPDF(filteredTrips, settings);
            addToast(`Successfully exported ${filteredTrips.length} trip(s)`);
        } catch (e) {
            console.error("Export failed", e);
            addToast("Failed to export trip details", "error");
        } finally {
            setLoading(false);
        }
    };

    // Data Management Actions
    const handleAddCompany = async () => {
        if (!newCompany.trim()) return;
        setActionLoading(true);
        const success = await addCompany(newCompany.trim());
        if (success) {
            setCompanies(prev => [...prev, newCompany.trim()].sort());
            setNewCompany('');
            addToast(`Added "${newCompany}" to client list`);
        } else {
            addToast("Failed to add company", "error");
        }
        setActionLoading(false);
    };

    const handleDeleteCompany = async (name: string) => {
        setActionLoading(true);
        if (await deleteCompany(name)) {
            setCompanies(prev => prev.filter(c => c !== name));
            addToast(`Removed "${name}" from client list`);
        } else {
            addToast("Failed to remove company", "error");
        }
        setActionLoading(false);
    };

    const handleAddCarType = async () => {
        if (!newCarType.trim()) return;
        setActionLoading(true);
        if (await addCarType(newCarType.trim())) {
            setCarTypes(prev => [...prev, newCarType.trim()].sort());
            setNewCarType('');
            addToast(`Added "${newCarType}" to vehicles`);
        } else {
            addToast("Failed to add car type", "error");
        }
        setActionLoading(false);
    };

    const handleDeleteCarType = async (name: string) => {
        setActionLoading(true);
        if (await deleteCarType(name)) {
            setCarTypes(prev => prev.filter(c => c !== name));
            addToast(`Removed "${name}" from vehicles`);
        } else {
            addToast("Failed to remove car type", "error");
        }
        setActionLoading(false);
    };

    const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!settings) return;
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && settings) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({ ...settings, logoBase64: reader.result as string });
                addToast("Logo updated (Save required to persist)");
            };
            reader.readAsDataURL(file);
        }
    };

    const saveSettingsToServer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setSettingsSaving(true);
        const success = await saveSettings(settings);
        if (success) {
            addToast("Branding settings saved successfully");
        } else {
            addToast("Failed to persist settings", "error");
        }
        setSettingsSaving(false);
    };

    const filteredTrips = useMemo(() => trips.filter(t =>
        (t.vehicleRegNo || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.companyName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.bookedBy || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.id && t.id.toLowerCase().includes(filter.toLowerCase()))
    ), [trips, filter]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Toast Notifications */}
            <div className="toast-container">
                {toasts.map(toast => (
                    <ToastMessage key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>

            {/* Header with Glassmorphism */}
            <header className="glass-dark sticky top-0 z-50 sm:px-8 px-4 sm:h-20 h-16 flex items-center shadow-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative group">
                            {settings?.logoBase64 ?
                                <img src={settings.logoBase64} alt="Logo" className="sm:h-12 h-10 w-auto rounded-xl sm:rounded-2xl bg-white p-1 sm:p-1.5 shadow-inner" /> :
                                <div className="sm:w-12 sm:h-12 w-10 h-10 bg-primary rounded-xl sm:rounded-2xl flex items-center justify-center font-black sm:text-2xl text-xl text-amber-950 shadow-lg shadow-primary/30 font-outfit">V</div>
                            }
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-4 border-slate-900 animate-pulse"></div>
                        </div>
                        <div>
                            <div className="font-black sm:text-2xl text-lg leading-none text-white font-outfit uppercase tracking-tighter">{settings?.agencyName || 'Vista Travels'}</div>
                            <div className="text-[10px] text-amber-200/40 font-black tracking-[0.3em] uppercase hidden sm:flex items-center gap-2 mt-1">
                                <Activity className="w-3.5 h-3.5 text-primary" />
                                Industrial Control Panel
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-white bg-indigo-500/20 px-3 py-1.5 rounded-full border border-indigo-400/20 glass">
                            <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> SUPABASE LIVE PUSH
                        </div>
                        <a href="#/" className="btn btn-secondary !bg-white/10 !text-white !border-white/10 glass sm:!px-6 !px-4 sm:!py-3 !py-2.5 !text-xs">
                            <Car className="w-4 h-4" /> <span className="hidden sm:inline">Switch to Form</span><span className="sm:hidden">Form</span>
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto sm:p-8 p-3.5 sm:space-y-8 space-y-5">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Today's Trips" value={stats.todayCount} icon={Car} color="bg-indigo-500" />
                    <StatCard title="Total Volume" value={stats.totalCount} icon={TrendingUp} color="bg-emerald-500" />
                    <StatCard title="Total KMs" value={`${stats.km.toLocaleString()} km`} icon={Fuel} color="bg-amber-500" />
                    <StatCard title="Collections" value={`Rs. ${stats.earnings.toLocaleString()}`} icon={Users} color="bg-rose-500" />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="flex bg-white/60 sm:p-2 p-1.5 rounded-xl sm:rounded-[1.5rem] glass shadow-md w-full sm:w-auto overflow-x-auto no-scrollbar">
                        {[
                            { id: 'trips', label: 'Trips', icon: FileText },
                            { id: 'companies', label: 'Companies', icon: Building2 },
                            { id: 'cartypes', label: 'Vehicles', icon: CarFront },
                            { id: 'settings', label: 'Config', icon: SettingsIcon }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'bg-primary text-amber-950 shadow-lg shadow-primary/20' : 'text-amber-900/40 hover:text-amber-950 hover:bg-white/50'}`}
                            >
                                <t.icon className="h-4 w-4" /> {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        {syncing && (
                            <div className="flex items-center gap-3 text-xs font-black text-amber-900 bg-amber-50 px-5 py-2.5 rounded-full border border-primary/20 glass animate-pulse">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>SYNCING SYSTEM...</span>
                            </div>
                        )}
                        {activeTab === 'trips' && (
                            <button onClick={handleExportAllTrips} disabled={loading} className="btn btn-primary !rounded-[1.25rem] !px-8 !py-3 !shadow-primary/10 !text-amber-950 font-black">
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                EXPORT TRIP DETAILS
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="animate-fade-in translate-y-0 opacity-100">
                    {activeTab === 'trips' && (
                        <div className="glass sm:rounded-[2.5rem] rounded-2xl overflow-hidden shadow-2xl border border-white/60 bg-white/40">
                            <div className="sm:p-8 p-6 border-b border-primary-light bg-white/60 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 justify-between">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-amber-900/30" />
                                    <input
                                        type="text"
                                        placeholder="Search trips, vehicles, or companies..."
                                        className="w-full pl-14 sm:pl-16 pr-6 py-3.5 sm:py-4 bg-white border border-slate-100 rounded-xl sm:rounded-[1.5rem] focus:ring-8 focus:ring-primary/5 outline-none text-xs sm:text-sm transition-all shadow-inner font-bold"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleBulkDownload}
                                    disabled={selectedTimestamps.size === 0}
                                    className="btn btn-primary !w-full sm:!w-auto !rounded-xl sm:!rounded-[1.5rem] !px-8 sm:!px-10 !py-3.5 sm:!py-4 !shadow-primary/10 !font-black !text-amber-950 uppercase tracking-widest text-xs"
                                >
                                    <Archive className="h-4 w-4" /> <span>Export Selection ({selectedTimestamps.size})</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto shadow-sm rounded-3xl border border-slate-100 bg-white/40">
                                <table className="w-full min-w-[1200px] text-left text-xs text-slate-600">
                                    <thead className="bg-slate-100/50 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="sm:p-4 p-2.5">
                                                <input type="checkbox" onChange={handleSelectAll} checked={filteredTrips.length > 0 && selectedTimestamps.size === filteredTrips.length} className="rounded" />
                                            </th>
                                            <th className="sm:p-4 p-2.5">Booking ID</th>
                                            <th className="sm:p-4 p-2.5">Vehicle Specs</th>
                                            <th className="sm:p-4 p-2.5">Route Info</th>
                                            <th className="sm:p-4 p-2.5">Schedule</th>
                                            <th className="sm:p-4 p-2.5">Parties</th>
                                            <th className="sm:p-4 p-2.5">Contractor</th>
                                            <th className="sm:p-4 p-2.5 text-center">Fuel/Odo</th>
                                            <th className="sm:p-4 p-2.5 w-48">Summary / Tolls</th>
                                            <th className="sm:p-4 p-2.5 text-right">PDF</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/60">
                                        {loading && trips.length === 0 ?
                                            <tr><td colSpan={10} className="p-20 text-center"><div className="flex flex-col items-center gap-4"><RefreshCw className="w-12 h-12 animate-spin text-primary/30" /><p className="font-black text-amber-900/40 uppercase tracking-[0.3em] text-sm">Hydrating System...</p></div></td></tr> :
                                            filteredTrips.length === 0 ?
                                                <tr><td colSpan={10} className="p-20 text-center text-slate-400 font-medium italic">No results found for "{filter}"</td></tr> :
                                                filteredTrips.map((trip) => (
                                                    <TripRow
                                                        key={trip.timestamp}
                                                        trip={trip}
                                                        selected={selectedTimestamps.has(trip.timestamp)}
                                                        onSelect={() => handleSelectOne(trip.timestamp)}
                                                        onUpdate={updateTripLocally}
                                                        onSave={() => handleSaveTrip(trip.timestamp, trip)}
                                                        onDownload={() => handleSingleDownload(trip)}
                                                        saving={savingRow === trip.timestamp}
                                                        carTypes={carTypes}
                                                        companies={companies}
                                                    />
                                                ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'companies' && (
                        <div className="max-w-3xl glass rounded-3xl overflow-hidden bg-white/60 mx-auto">
                            <div className="p-6 bg-white/80 border-b border-slate-100"><h2 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-600" /> Manage Companies</h2></div>
                            <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-3">
                                <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Enter new company name" className="flex-1 p-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none shadow-inner bg-white/50 font-medium" />
                                <button onClick={handleAddCompany} disabled={!newCompany.trim() || actionLoading} className="btn btn-primary !rounded-2xl !px-8 !shadow-primary/10 !font-bold !w-full sm:!w-auto">
                                    {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="h-5 w-5" />} Add
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {companies.map(c => (
                                    <div key={c} className="p-4 bg-white rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
                                        <span className="font-bold text-slate-700 text-sm">{c}</span>
                                        <button onClick={() => handleDeleteCompany(c)} className="text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'cartypes' && (
                        <div className="max-w-3xl glass rounded-3xl overflow-hidden bg-white/60 mx-auto">
                            <div className="p-6 bg-white/80 border-b border-slate-100"><h2 className="font-bold text-slate-800 text-lg flex items-center gap-2"><CarFront className="w-5 h-5 text-indigo-600" /> Vehicle Types</h2></div>
                            <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-3">
                                <input type="text" value={newCarType} onChange={(e) => setNewCarType(e.target.value)} placeholder="e.g. Luxury SUV" className="flex-1 p-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none shadow-inner bg-white/50 font-medium" />
                                <button onClick={handleAddCarType} disabled={!newCarType.trim() || actionLoading} className="btn btn-primary !rounded-2xl !px-8 !shadow-primary/10 !font-bold !w-full sm:!w-auto">
                                    {actionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="h-5 w-5" />} Add
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {carTypes.map(c => (
                                    <div key={c} className="p-4 bg-white rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
                                        <span className="font-bold text-slate-700 text-sm">{c}</span>
                                        <button onClick={() => handleDeleteCarType(c)} className="text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && settings && (
                        <div className="max-w-4xl glass rounded-[2.5rem] overflow-hidden bg-white/60 mx-auto">
                            <div className="p-8 bg-white/80 border-b border-primary-light"><h2 className="font-black text-amber-950 text-xl flex items-center gap-3"><SettingsIcon className="w-6 h-6 text-primary" /> System Configuration</h2></div>
                            <form onSubmit={saveSettingsToServer} className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-full pb-2 border-b border-slate-100"><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">Core Identity</h3></div>
                                    <div className="col-span-full">
                                        <label className="text-sm font-bold text-slate-700 mb-2 block">Agency Legal Name</label>
                                        <input type="text" name="agencyName" value={settings.agencyName} onChange={handleSettingChange} className="w-full p-4 border border-slate-200 rounded-2xl bg-white shadow-inner focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium" />
                                    </div>
                                    <div className="col-span-full">
                                        <label className="text-sm font-bold text-slate-700 mb-2 block">Primary Logo</label>
                                        <div className="flex items-center gap-6 p-6 bg-slate-50/50 border border-slate-200 rounded-3xl">
                                            {settings.logoBase64 && <img src={settings.logoBase64} className="h-20 w-auto rounded-xl border-2 border-white p-1 bg-white shadow-md" alt="Current Logo" />}
                                            <input type="file" onChange={handleLogoUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-primary/10" />
                                        </div>
                                    </div>
                                    <div className="col-span-full pt-4 pb-2 border-b border-slate-100"><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">Contact & Operations</h3></div>
                                    <div className="space-y-4 col-span-full lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Address Line 1</label>
                                            <input type="text" name="addressLine1" value={settings.addressLine1} onChange={handleSettingChange} className="w-full p-4 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Address Line 2</label>
                                            <input type="text" name="addressLine2" value={settings.addressLine2} onChange={handleSettingChange} className="w-full p-4 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Support Phone</label>
                                            <input type="text" name="contactNumber" value={settings.contactNumber} onChange={handleSettingChange} className="w-full p-4 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Business Email</label>
                                            <input type="text" name="email" value={settings.email} onChange={handleSettingChange} className="w-full p-4 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={settingsSaving} className="btn btn-primary !w-full !py-5 !rounded-3xl !text-lg !font-black !shadow-primary/10">
                                    {settingsSaving ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                                    {settingsSaving ? 'Processing Updates...' : 'Publish Global Settings'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
