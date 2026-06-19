import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, AlertCircle, Languages, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserRole } from '@/types';
import { Language } from '@/lib/translations';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<UserRole>('employee');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/billing" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for demo
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = login(userId, password, activeTab);

    if (success) {
      if (activeTab === 'tracker') {
        navigate('/tracker');
      } else {
        navigate('/billing');
      }
    } else {
      setError(
        activeTab === 'admin'
          ? t('login.invalid_admin')
          : t('login.invalid_employee')
      );
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-glass-gradient dark:bg-glass-gradient-dark bg-cover bg-fixed relative z-0 p-4">
      {/* Decorative blurred blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[10%] left-[15%] w-[30%] h-[30%] rounded-full bg-primary/40 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse-soft"></div>
        <div className="absolute bottom-[10%] right-[15%] w-[40%] h-[40%] rounded-full bg-accent/40 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-soft" style={{ animationDelay: '1.5s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-in">
        {/* Logo / Branding */}
        <div className="text-center mb-8 animate-spring-in">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white p-2 mb-4 shadow-sm border border-slate-100">
            <img src="logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('login.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('login.subtitle')}</p>
        </div>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mb-6">
          {(['en', 'ta', 'hi'] as Language[]).map((lang) => (
            <Button
              key={lang}
              variant={language === lang ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLanguage(lang)}
              className="px-4 py-1 h-auto text-xs font-medium"
            >
              {lang === 'en' ? 'English' : lang === 'ta' ? 'தமிழ்' : 'हिंदी'}
            </Button>
          ))}
        </div>

        {/* Login Card */}
        <div className="login-card">
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as UserRole);
            // Clear credentials when switching tabs, especially for tracker
            setUserId('');
            setPassword('');
            setError('');
          }}>
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/70 backdrop-blur-md p-1 rounded-xl shadow-inner">
              <TabsTrigger value="employee" className="gap-2 rounded-lg data-[state=active]:shadow-md data-[state=active]:bg-background/80 transition-all">
                <User className="h-4 w-4" />
                {t('login.employee')}
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-2 rounded-lg data-[state=active]:shadow-md data-[state=active]:bg-background/80 transition-all">
                <ShieldCheck className="h-4 w-4" />
                {t('login.admin')}
              </TabsTrigger>
              <TabsTrigger value="tracker" className="gap-2 rounded-lg data-[state=active]:shadow-md data-[state=active]:bg-background/80 transition-all">
                <Clock className="h-4 w-4" />
                Tracker
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TabsContent value="employee" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emp-id">{t('login.emp_id_label')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="emp-id"
                      placeholder={t('login.emp_id_placeholder')}
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-password">{t('login.password_label')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="emp-password"
                      type="password"
                      placeholder={t('login.password_placeholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-id">{t('login.admin_user_label')}</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-id"
                      placeholder={t('login.admin_user_placeholder')}
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">{t('login.password_label')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder={t('login.password_placeholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Added TabsContent for Tracker */}
              <TabsContent value="tracker" className="mt-0 space-y-6 py-4">
                <div className="text-center space-y-4">
                  <div className="bg-primary/10 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-inner">
                    <Clock className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-slate-900">Task Tracker Dashboard</h3>
                    <p className="text-muted-foreground text-sm max-w-[250px] mx-auto mt-2">
                      Access the employee dashboard to track bill item collection times.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => navigate('/tracker')}
                    className="w-full h-12 bg-primary hover:bg-primary/90 font-bold text-base shadow-lg shadow-primary/20"
                  >
                    Go to Tracker
                  </Button>
                </div>
              </TabsContent>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                disabled={!userId || !password || isLoading}
              >
                {isLoading ? t('login.signing_in') : t('login.signin_button')}
              </Button>
            </form>
          </Tabs>

          {/* Demo Credentials Hint */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm">
            <div className="font-medium mb-2">{t('login.demo_credentials')}</div>
            <div className="space-y-1 text-muted-foreground">
              <div><span className="font-medium">{t('login.admin')}:</span> admin / admin123</div>
              <div><span className="font-medium">{t('login.employee')}:</span> EMP001 / emp123</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Mano Innovation Club v1.0</p>
        </div>
      </div>
    </div>
  );
}
