
import React, { useState, useEffect, useRef } from 'react';
import { TripData, AppSettings } from '../types';
import { getAllDashboardData, addCompany, deleteCompany, updateTrip, saveSettings, addCarType, deleteCarType } from '../services/api';
import { generateSinglePDF, generateBulkPDF } from '../services/pdfGenerator';
import { FileText, Download, RefreshCw, Archive, Search, Building2, Trash2, Plus, Car, Settings as SettingsIcon, Save, Upload, CarFront, MapPin, Activity, Wifi, WifiOff, Zap, AlertCircle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

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
    const [autoSync, setAutoSync] = useState(true);
    const [filter, setFilter] = useState('');
    const [savingRow, setSavingRow] = useState<string | null>(null);

    // Action States
    const [newCompany, setNewCompany] = useState('');
    const [newCarType, setNewCarType] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    const pollTimerRef = useRef<number | null>(null);

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
    }, []);

    useEffect(() => {
        if (autoSync) {
            pollTimerRef.current = window.setInterval(() => {
                fetchData(false);
            }, AUTO_REFRESH_INTERVAL);
        } else {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }

        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [autoSync]);

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
            await updateTrip(timestamp, {
                id: trip.id,
                additionalKm: trip.additionalKm,
                startDateTime: trip.startDateTime,
                endDateTime: trip.endDateTime,
                totalTime: trip.totalTime,
                tripType: trip.tripType,
                source: trip.source,
                destination: trip.destination,
                vehicleRegNo: trip.vehicleRegNo,
                companyName: trip.companyName,
                bookedBy: trip.bookedBy,
                reportTo: trip.reportTo,
                startKm: trip.startKm,
                endKm: trip.endKm,
                carType: trip.carType
            });
        } catch (e) {
            console.error("Save failed", e);
        }
        setSavingRow(null);
    };

    const handleBulkDownload = async () => {
        if (!settings) return;
        const selectedTrips = trips.filter(t => selectedTimestamps.has(t.timestamp));
        if (selectedTrips.length === 0) return;

        try {
            if (selectedTrips.length === 1) await generateSinglePDF(selectedTrips[0], settings);
            else await generateBulkPDF(selectedTrips, settings);
        } catch (e) {
            console.error("Bulk download failed", e);
            alert("Encountered an error during bulk generation. Try downloading fewer files.");
        }
    };

    const handleSingleDownload = async (trip: TripData) => {
        if (!settings) return;
        try {
            await generateSinglePDF(trip, settings);
        } catch (e) {
            console.error("Single PDF download failed", e);
            alert("Failed to generate PDF for this trip. Check for missing data.");
        }
    };

    const handleAddCompany = async () => {
        if (!newCompany.trim()) return;
        setActionLoading(true);
        const success = await addCompany(newCompany.trim());
        if (success) { setCompanies(prev => [...prev, newCompany.trim()].sort()); setNewCompany(''); }
        setActionLoading(false);
    };

    const handleDeleteCompany = async (name: string) => {
        if (!confirm(`Remove "${name}"?`)) return;
        setActionLoading(true);
        if (await deleteCompany(name)) setCompanies(prev => prev.filter(c => c !== name));
        setActionLoading(false);
    };

    const handleAddCarType = async () => {
        if (!newCarType.trim()) return;
        setActionLoading(true);
        if (await addCarType(newCarType.trim())) { setCarTypes(prev => [...prev, newCarType.trim()].sort()); setNewCarType(''); }
        setActionLoading(false);
    };

    const handleDeleteCarType = async (name: string) => {
        if (!confirm(`Remove "${name}"?`)) return;
        setActionLoading(true);
        if (await deleteCarType(name)) setCarTypes(prev => prev.filter(c => c !== name));
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
            reader.onloadend = () => setSettings({ ...settings, logoBase64: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const saveSettingsToServer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setSettingsSaving(true);
        await saveSettings(settings);
        setSettingsSaving(false);
        alert("Settings saved successfully.");
    };

    const filteredTrips = trips.filter(t =>
        (t.vehicleRegNo || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.companyName || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.bookedBy || '').toLowerCase().includes(filter.toLowerCase()) ||
        (t.id && t.id.toLowerCase().includes(filter.toLowerCase()))
    );

    const formatDateForInput = (isoString: string) => {
        try { return isoString ? format(new Date(isoString), "yyyy-MM-dd'T'HH:mm") : ''; } catch { return ''; }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-slate-900 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {settings?.logoBase64 ? <img src={settings.logoBase64} alt="Logo" className="h-8 w-auto rounded bg-white p-0.5" /> : <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg">{settings?.agencyName?.charAt(0) || 'V'}</div>}
                        <div>
                            <div className="font-bold text-lg leading-tight">{settings?.agencyName || 'Vista Travels'}</div>
                            <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase flex items-center gap-1.5">
                                Administration
                                {autoSync && <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="hidden md:flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            <Zap className="w-3 h-3 fill-current" /> FAST PROXY
                        </div>
                        <button
                            onClick={() => setAutoSync(!autoSync)}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${autoSync ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                            title={autoSync ? "Live syncing enabled" : "Auto-refresh disabled"}
                        >
                            {autoSync ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            <span className="hidden sm:inline">{autoSync ? 'Live Sync' : 'Static'}</span>
                        </button>
                        <a href="#/" className="text-slate-400 hover:text-white text-sm flex items-center gap-2">
                            <Car className="w-4 h-4" /> <span className="hidden sm:inline">Driver Form</span>
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
                    <div className="flex items-center gap-3">
                        {syncing && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                <Activity className="w-3 h-3 animate-pulse" />
                                <span>Syncing...</span>
                            </div>
                        )}
                        <button onClick={() => fetchData(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                            <RefreshCw className={`h-4 w-4 ${(loading || syncing) ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'trips', label: 'Trips', icon: FileText },
                        { id: 'companies', label: 'Companies', icon: Building2 },
                        { id: 'cartypes', label: 'Car Types', icon: CarFront },
                        { id: 'settings', label: 'Settings', icon: SettingsIcon }
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <t.icon className="h-4 w-4" /> {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'trips' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center gap-4 justify-between">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input type="text" placeholder="Search trips..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} />
                            </div>
                            <button onClick={handleBulkDownload} disabled={selectedTimestamps.size === 0} className="flex items-center gap-2 bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 w-full sm:w-auto justify-center shadow">
                                <Archive className="h-4 w-4" /> <span>Download ({selectedTimestamps.size})</span>
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs">
                                    <tr>
                                        <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={filteredTrips.length > 0 && selectedTimestamps.size === filteredTrips.length} /></th>
                                        <th className="p-4">Trip ID</th>
                                        <th className="p-4">Vehicle & Car</th>
                                        <th className="p-4">Route</th>
                                        <th className="p-4">Start / End</th>
                                        <th className="p-4">Client / Guest</th>
                                        <th className="p-4">Company</th>
                                        <th className="p-4 text-center">Odometer</th>
                                        <th className="p-4 w-28">Total / Extra</th>
                                        <th className="p-4 text-right">PDF</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && trips.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-slate-400">Loading from Google Sheet...</td></tr> : filteredTrips.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-slate-400">No trips found.</td></tr> :
                                        filteredTrips.map((trip) => (
                                            <tr key={trip.timestamp} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4"><input type="checkbox" checked={selectedTimestamps.has(trip.timestamp)} onChange={() => handleSelectOne(trip.timestamp)} /></td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-1">
                                                        <input type="text" value={trip.id || ''} onChange={(e) => updateTripLocally(trip.timestamp, { id: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="ID" className={`w-24 p-1 text-xs border rounded ${!trip.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`} />
                                                        {savingRow === trip.timestamp && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
                                                    </div>
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <input type="text" value={trip.vehicleRegNo || ''} onChange={(e) => updateTripLocally(trip.timestamp, { vehicleRegNo: e.target.value.toUpperCase() })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-full p-1 text-xs border border-slate-200 rounded font-bold uppercase" />
                                                    <div className="flex gap-1">
                                                        <select value={trip.carType || ''} onChange={(e) => updateTripLocally(trip.timestamp, { carType: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-1/2 text-[10px] p-0.5 border border-slate-200 rounded bg-slate-50">
                                                            <option value="">Car Type</option>
                                                            {carTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                                                        </select>
                                                        <select value={trip.tripType || 'One way'} onChange={(e) => updateTripLocally(trip.timestamp, { tripType: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-1/2 text-[10px] p-0.5 border border-slate-200 rounded bg-slate-50">
                                                            <option value="One way">One way</option><option value="Round Trip">Round Trip</option>
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <input type="text" value={trip.source || ''} onChange={(e) => updateTripLocally(trip.timestamp, { source: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="Source" className="w-full p-1 text-xs border border-slate-200 rounded block" />
                                                    <input type="text" value={trip.destination || ''} onChange={(e) => updateTripLocally(trip.timestamp, { destination: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="Destination" className="w-full p-1 text-xs border border-slate-200 rounded block" />
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <input type="datetime-local" value={formatDateForInput(trip.startDateTime)} onChange={(e) => updateTripLocally(trip.timestamp, { startDateTime: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="p-1 border border-slate-200 rounded text-[10px] block w-full" />
                                                    <input type="datetime-local" value={formatDateForInput(trip.endDateTime)} onChange={(e) => updateTripLocally(trip.timestamp, { endDateTime: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="p-1 border border-slate-200 rounded text-[10px] block w-full" />
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <input type="text" value={trip.bookedBy || ''} onChange={(e) => updateTripLocally(trip.timestamp, { bookedBy: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="Booked By" className="w-full p-1 text-xs border border-slate-200 rounded block" />
                                                    <input type="text" value={trip.reportTo || ''} onChange={(e) => updateTripLocally(trip.timestamp, { reportTo: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="Report To" className="w-full p-1 text-xs border border-slate-200 rounded block" />
                                                </td>
                                                <td className="p-4">
                                                    <input type="text" list="company_list" value={trip.companyName || ''} onChange={(e) => updateTripLocally(trip.timestamp, { companyName: e.target.value })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-full p-1 text-xs border border-slate-200 rounded" />
                                                    <datalist id="company_list">{companies.map(c => <option key={c} value={c} />)}</datalist>
                                                </td>
                                                <td className="p-4 text-center font-mono space-y-1">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <input type="number" value={trip.startKm || 0} onChange={(e) => updateTripLocally(trip.timestamp, { startKm: parseInt(e.target.value) || 0 })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-20 p-1 text-center border border-slate-200 rounded text-xs" />
                                                        <input type="number" value={trip.endKm || 0} onChange={(e) => updateTripLocally(trip.timestamp, { endKm: parseInt(e.target.value) || 0 })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} className="w-20 p-1 text-center border border-slate-200 rounded text-xs" />
                                                    </div>
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <div className="text-center font-bold text-blue-700 text-xs">{trip.totalKm} km / {trip.totalTime}</div>
                                                    <input type="number" value={trip.additionalKm || ''} onChange={(e) => updateTripLocally(trip.timestamp, { additionalKm: parseFloat(e.target.value) || 0 })} onBlur={() => handleSaveTrip(trip.timestamp, trip)} placeholder="Extra KM" className="w-full p-1 border border-slate-200 rounded text-center text-xs" />
                                                </td>
                                                <td className="p-4 text-right"><button onClick={() => handleSingleDownload(trip)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><Download className="h-4 w-4" /></button></td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'companies' && (
                    <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200"><h2 className="font-bold text-slate-700">Companies</h2></div>
                        <div className="p-4 flex gap-2"><input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Add company" className="flex-1 p-2 border border-slate-300 rounded-lg" /><button onClick={handleAddCompany} disabled={!newCompany.trim() || actionLoading} className="bg-blue-600 text-white px-4 rounded-lg flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button></div>
                        <div className="divide-y divide-slate-100">{companies.map(c => <div key={c} className="p-4 flex items-center justify-between"><span>{c}</span><button onClick={() => handleDeleteCompany(c)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                    </div>
                )}

                {activeTab === 'cartypes' && (
                    <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200"><h2 className="font-bold text-slate-700">Car Types</h2></div>
                        <div className="p-4 flex gap-2"><input type="text" value={newCarType} onChange={(e) => setNewCarType(e.target.value)} placeholder="Add car type" className="flex-1 p-2 border border-slate-300 rounded-lg" /><button onClick={handleAddCarType} disabled={!newCarType.trim() || actionLoading} className="bg-blue-600 text-white px-4 rounded-lg flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button></div>
                        <div className="divide-y divide-slate-100">{carTypes.map(c => <div key={c} className="p-4 flex items-center justify-between"><span>{c}</span><button onClick={() => handleDeleteCarType(c)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                    </div>
                )}

                {activeTab === 'settings' && settings && (
                    <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200"><h2 className="font-bold text-slate-700">App Settings</h2></div>
                        <form onSubmit={saveSettingsToServer} className="p-6 space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5" /> Company Information
                                </h3>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Agency Name</label>
                                    <input type="text" name="agencyName" value={settings.agencyName} onChange={handleSettingChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Address Line 1</label>
                                    <input type="text" name="addressLine1" value={settings.addressLine1} onChange={handleSettingChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Address Line 2</label>
                                    <input type="text" name="addressLine2" value={settings.addressLine2} onChange={handleSettingChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Upload className="w-3.5 h-3.5" /> Branding
                                </h3>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Company Logo</label>
                                    <div className="flex items-center gap-4">
                                        {settings.logoBase64 && <img src={settings.logoBase64} className="h-12 w-auto rounded border p-1 bg-slate-50" alt="Current Logo" />}
                                        <input type="file" onChange={handleLogoUpload} className="block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5" /> Contact Details
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Phone Numbers</label>
                                        <input type="text" name="contactNumber" value={settings.contactNumber} onChange={handleSettingChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Email Address</label>
                                        <input type="text" name="email" value={settings.email} onChange={handleSettingChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={settingsSaving} className="w-full bg-blue-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] disabled:opacity-70">
                                {settingsSaving ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                {settingsSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
