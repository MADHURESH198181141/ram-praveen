import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, TrendingUp, Users, Calendar, ArrowUpRight, ArrowDownRight, Package, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEmployeePerformanceMetrics, getEmployeeTasks, getAttendance } from '@/lib/storage';
import { EmployeePerformance, EmployeeTask, AttendanceRecord } from '@/types';
import { format } from 'date-fns';

export default function TrackerReports() {
    const [metrics, setMetrics] = useState<EmployeePerformance[]>([]);
    const [recentTasks, setRecentTasks] = useState<EmployeeTask[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

    useEffect(() => {
        setMetrics(getEmployeePerformanceMetrics());
        setRecentTasks(getEmployeeTasks().filter(t => t.status === 'completed').slice(-10).reverse());
        setAttendance(getAttendance().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const totalBills = metrics.reduce((acc, curr) => acc + curr.totalBills, 0);
    const totalTime = metrics.reduce((acc, curr) => acc + curr.totalTime, 0);
    const avgTime = metrics.length > 0 && totalBills > 0 ? Math.round(totalTime / totalBills) : 0;

    // Attendance stats
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const checkedOutToday = todayAttendance.filter(a => a.checkOut).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Tracker Analytics</h1>
                <p className="text-muted-foreground">Monitor employee efficiency, task performance, and attendance.</p>
            </div>

            <Tabs defaultValue="performance">
                <TabsList>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-6 mt-4">
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-blue-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Total Bills Handled</CardTitle>
                                <Package className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-900">{totalBills}</div>
                                <p className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                                    <ArrowUpRight className="h-3 w-3" /> All time
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-emerald-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Avg. Time Per Bill</CardTitle>
                                <Clock className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-900">{formatDuration(avgTime)}</div>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                                    <ArrowDownRight className="h-3 w-3" /> Average per task
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-purple-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                                <Users className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-900">{metrics.length}</div>
                                <p className="text-xs text-purple-600 font-medium mt-1">With tracked tasks</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-amber-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Total Collection Time</CardTitle>
                                <BarChart3 className="h-4 w-4 text-amber-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-900">{Math.round(totalTime / 3600)}h</div>
                                <p className="text-xs text-amber-600 font-medium mt-1">Total man-hours tracked</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                        {/* Performance by Employee */}
                        <Card className="col-span-4 border-none shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Employee Rankings
                                </CardTitle>
                                <CardDescription>Performance metrics by individual employee</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {metrics.sort((a, b) => a.averageTime - b.averageTime).map((p, idx) => (
                                        <div key={p.employeeId} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{p.employeeName}</p>
                                                    <p className="text-xs text-muted-foreground">{p.totalBills} bills completed</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900">{formatDuration(p.averageTime)}</p>
                                                <p className="text-xs text-muted-foreground">average</p>
                                            </div>
                                        </div>
                                    ))}
                                    {metrics.length === 0 && (
                                        <div className="text-center py-10 text-muted-foreground">No performance data yet</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Tasks */}
                        <Card className="col-span-3 border-none shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Recent Collections
                                </CardTitle>
                                <CardDescription>Latest 10 completed tasks</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {recentTasks.map(task => (
                                        <div key={task.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none font-mono">{task.billNumber}</p>
                                                <p className="text-xs text-muted-foreground">{task.employeeName}</p>
                                            </div>
                                            <div className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
                                                {formatDuration(task.duration || 0)}
                                            </div>
                                        </div>
                                    ))}
                                    {recentTasks.length === 0 && (
                                        <div className="text-center py-10 text-muted-foreground">No recent tasks</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-6 mt-4">
                    {/* Today Stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-emerald-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                                <CheckSquare className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-900">{todayAttendance.length}</div>
                                <p className="text-xs text-emerald-600 font-medium mt-1">Employees checked in today</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-blue-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
                                <Clock className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-900">{checkedOutToday}</div>
                                <p className="text-xs text-blue-600 font-medium mt-1">Completed day today</p>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-purple-50 to-white">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                                <Calendar className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-900">{attendance.length}</div>
                                <p className="text-xs text-purple-600 font-medium mt-1">All-time attendance entries</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Attendance Table */}
                    <Card className="border-none shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckSquare className="h-5 w-5 text-primary" />
                                Attendance Records
                            </CardTitle>
                            <CardDescription>All employee attendance — most recent first</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/30">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-semibold">Employee</th>
                                            <th className="text-left py-3 px-4 font-semibold">Date</th>
                                            <th className="text-left py-3 px-4 font-semibold">Check In</th>
                                            <th className="text-left py-3 px-4 font-semibold">Check Out</th>
                                            <th className="text-right py-3 px-4 font-semibold">Total Hours</th>
                                            <th className="text-center py-3 px-4 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.map(record => (
                                            <tr key={record.id} className="border-b hover:bg-muted/20 transition-colors">
                                                <td className="py-3 px-4 font-medium">{record.employeeName}</td>
                                                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                                                    {format(new Date(record.date), 'dd MMM yyyy')}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-xs text-emerald-700">
                                                    {format(new Date(record.checkIn), 'hh:mm a')}
                                                </td>
                                                <td className="py-3 px-4 font-mono text-xs text-slate-600">
                                                    {record.checkOut ? format(new Date(record.checkOut), 'hh:mm a') : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-semibold">
                                                    {record.totalHours != null ? `${record.totalHours}h` : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {record.checkOut ? (
                                                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Complete</span>
                                                    ) : (
                                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Active</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {attendance.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                                                    No attendance records yet. Employees can mark attendance via the Task Tracker.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
