import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, AlertCircle, ArrowLeft, Timer, User, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { getActiveTask, clockIn, clockOut, getUsers, getTodaysAttendance, checkInEmployee, checkOutEmployee } from '@/lib/storage';
import { EmployeeTask, User as UserType, AttendanceRecord } from '@/types';

export default function TaskTracker() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<UserType[]>([]);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [billNumber, setBillNumber] = useState('');
    const [activeTask, setActiveTask] = useState<EmployeeTask | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | undefined>(undefined);

    useEffect(() => {
        const allUsers = getUsers();
        setEmployees(allUsers.filter(u => u.role === 'employee'));
    }, []);

    useEffect(() => {
        if (selectedEmpId) {
            const task = getActiveTask(selectedEmpId);
            setActiveTask(task || null);
            setTodayAttendance(getTodaysAttendance(selectedEmpId));
        } else {
            setActiveTask(null);
            setTodayAttendance(undefined);
        }
    }, [selectedEmpId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeTask && activeTask.status === 'active') {
            interval = setInterval(() => {
                const seconds = Math.floor((new Date().getTime() - new Date(activeTask.startTime).getTime()) / 1000);
                setElapsedTime(seconds);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTask]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleClockIn = () => {
        if (!selectedEmpId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Please select an employee.",
            });
            return;
        }
        if (!billNumber) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Please enter a bill number.",
            });
            return;
        }

        try {
            const emp = employees.find(e => e.id === selectedEmpId);
            const task = clockIn(selectedEmpId, emp?.name || 'Unknown', billNumber);
            setActiveTask(task);
            setBillNumber('');
            toast({
                title: "Clocked In",
                description: `Task started for Bill #${billNumber}`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        }
    };

    const handleClockOut = () => {
        if (!activeTask) return;

        try {
            const task = clockOut(activeTask.id);
            setActiveTask(null);
            setElapsedTime(0);
            toast({
                title: "Clocked Out",
                description: `Task completed. Duration: ${formatTime(task.duration || 0)}`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        }
    };

    const handleAttendanceCheckIn = () => {
        if (!selectedEmpId) return;
        try {
            const emp = employees.find(e => e.id === selectedEmpId);
            const record = checkInEmployee(selectedEmpId, emp?.name || 'Unknown');
            setTodayAttendance(record);
            toast({ title: 'Checked In', description: `Attendance recorded at ${new Date(record.checkIn).toLocaleTimeString()}` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const handleAttendanceCheckOut = () => {
        if (!selectedEmpId) return;
        try {
            const record = checkOutEmployee(selectedEmpId);
            setTodayAttendance(record);
            toast({ title: 'Checked Out', description: `Total hours today: ${record.totalHours}h` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate('/login')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Back to Login
                    </Button>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-slate-900 font-outfit">Task Tracker</h1>
                        <p className="text-slate-500 text-sm">Monitor item collection efficiency</p>
                    </div>
                </div>

                <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Identify Employee
                        </CardTitle>
                        <CardDescription>Select your name or scan your ID to begin</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="employee">Select Employee</Label>
                            <select
                                id="employee"
                                className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                value={selectedEmpId}
                                onChange={(e) => setSelectedEmpId(e.target.value)}
                            >
                                <option value="">Choose your name...</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.barcode || 'No ID'})</option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {selectedEmpId && !activeTask && (
                    <Card className="border-none shadow-xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="h-2 bg-primary/10" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Hash className="h-5 w-5 text-primary" />
                                Start New Task
                            </CardTitle>
                            <CardDescription>Enter the bill number from the order slip</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="billNumber">Bill Number</Label>
                                <Input
                                    id="billNumber"
                                    placeholder="e.g. INV-20240308-0001"
                                    value={billNumber}
                                    onChange={(e) => setBillNumber(e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                            <Button onClick={handleClockIn} className="w-full h-12 text-base font-semibold gap-2 shadow-lg shadow-primary/20">
                                <Clock className="h-5 w-5" /> Clock In
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {activeTask && (
                    <Card className="border-none shadow-xl bg-white border-l-4 border-l-primary overflow-hidden animate-in zoom-in-95">
                        <CardHeader className="bg-primary/5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-primary flex items-center gap-2">
                                        <Timer className="h-5 w-5 animate-pulse" />
                                        Active Task
                                    </CardTitle>
                                    <CardDescription className="text-primary/70 font-medium">Currently collecting items</CardDescription>
                                </div>
                                <div className="text-3xl font-bold text-primary font-mono bg-white px-4 py-2 rounded-xl shadow-sm border border-primary/10">
                                    {formatTime(elapsedTime)}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Bill Number</p>
                                    <p className="text-lg font-bold text-slate-900 font-mono mt-1">{activeTask.billNumber}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Started At</p>
                                    <p className="text-lg font-bold text-slate-900 mt-1">{new Date(activeTask.startTime).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Task in Progress</AlertTitle>
                                <AlertDescription>
                                    Make sure to click Clock Out after you finish collecting all items for this bill.
                                </AlertDescription>
                            </Alert>

                            <Button
                                onClick={handleClockOut}
                                variant="destructive"
                                className="w-full h-14 text-lg font-bold gap-2 shadow-lg shadow-destructive/20"
                            >
                                <CheckCircle2 className="h-6 w-6" /> Clock Out & Complete
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!selectedEmpId && (
                    <div className="text-center p-12 bg-white/40 rounded-3xl border-2 border-dashed border-slate-200">
                        <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Please select an employee to continue</p>
                    </div>
                )}

                {/* Attendance Section */}
                {selectedEmpId && (
                    <Card className="border-none shadow-xl bg-white overflow-hidden animate-in fade-in">
                        <div className="h-2 bg-emerald-400" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="h-5 w-5" />
                                Today's Attendance
                            </CardTitle>
                            <CardDescription>
                                {todayAttendance
                                    ? `Checked in at ${new Date(todayAttendance.checkIn).toLocaleTimeString()}`
                                    : 'Mark your attendance for today'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {todayAttendance && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Check In</p>
                                        <p className="text-base font-bold text-emerald-700 mt-1 font-mono">
                                            {new Date(todayAttendance.checkIn).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Check Out</p>
                                        <p className="text-base font-bold text-slate-700 mt-1 font-mono">
                                            {todayAttendance.checkOut
                                                ? new Date(todayAttendance.checkOut).toLocaleTimeString()
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {!todayAttendance ? (
                                <Button
                                    onClick={handleAttendanceCheckIn}
                                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                                >
                                    <CheckCircle2 className="h-4 w-4" /> Mark Attendance — Check In
                                </Button>
                            ) : !todayAttendance.checkOut ? (
                                <Button
                                    onClick={handleAttendanceCheckOut}
                                    variant="outline"
                                    className="w-full gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                                >
                                    <CheckCircle2 className="h-4 w-4" /> Check Out
                                </Button>
                            ) : (
                                <div className="text-center text-sm text-emerald-600 font-semibold py-2">
                                    ✅ Attendance complete — {todayAttendance.totalHours}h today
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
