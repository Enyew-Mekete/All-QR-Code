import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Database,
  KeyRound,
  QrCode,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notificationService';
import { ApiClient } from '../services/api';
import { AppUser } from '../types';
import { getContrastTextColor, getContrastMutedColor } from '../utils/themeColors';

interface LoginPageProps {
  onLoginSuccess: (user: AppUser) => void;
  brandColor?: string;
}

type LoginStep = 'credentials' | 'otp' | 'force_password_change';

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  brandColor,
}) => {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Authenticated user pending OTP or password change
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [lastDispatchedPreview, setLastDispatchedPreview] = useState<string | null>(null);

  // Force password change fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const databaseName = StorageService.getDatabaseName();
  const theme = StorageService.getThemeSetting();

  const headerBg = theme.sidebarColor || '#064e3b';
  const accentBg = theme.primaryColor || brandColor || '#059669';
  const headerTextColor = getContrastTextColor(headerBg);
  const headerMutedColor = getContrastMutedColor(headerBg);
  const accentTextColor = getContrastTextColor(accentBg);

  // Evaluate password strength live against the 5 strict rules
  const strength = NotificationService.validatePasswordStrength(newPassword);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await ApiClient.login(identifier, password);
      setIsLoading(false);

      if (!res.success || !res.user) {
        setError(res.error || 'Invalid username or password. Please verify your credentials.');
        return;
      }

      setPendingUser(res.user);

      if (res.step === 'otp') {
        setStep('otp');
        setSuccessMsg(
          `OTP verification code sent to ${res.user.email} and ${res.user.phone || 'your registered phone'}.`
        );
        setLastDispatchedPreview(res.otpPreview || null);
      } else if (res.step === 'force_password_change') {
        setStep('force_password_change');
        setSuccessMsg('Temporary default password detected. Set a permanent password to proceed.');
      } else {
        setSuccessMsg('Credentials verified! Login successful. Entering system...');
        setTimeout(() => {
          StorageService.setCurrentUser(res.user!);
          onLoginSuccess(res.user!);
        }, 400);
      }
    } catch {
      // Fallback to localStorage check if backend is unreachable
      const users = StorageService.getAllUsersIncludingDeleted().filter((u) => !u.deletedAt);
      const trimmedInput = identifier.trim().toLowerCase();
      const user = users.find(
        (u) =>
          u.email.toLowerCase() === trimmedInput ||
          u.name.toLowerCase() === trimmedInput
      );

      setIsLoading(false);

      if (!user || user.password !== password) {
        setError('Invalid username or password. Please verify your credentials.');
        return;
      }

      if (user.status === 'suspended') {
        setError('This account has been suspended. Please contact your administrator.');
        return;
      }

      setPendingUser(user);
      if (user.otpEnabled) {
        const otpRecord = StorageService.createOTP(user, 'login');
        setStep('otp');
        setSuccessMsg(
          `OTP verification code sent to ${user.email} and ${user.phone || 'your registered phone'}.`
        );
        setLastDispatchedPreview(otpRecord.code);
      } else if (user.mustChangePassword) {
        setStep('force_password_change');
        setSuccessMsg('Temporary default password detected. Set a permanent password to proceed.');
      } else {
        setSuccessMsg('Credentials verified! Login successful. Entering system...');
        setTimeout(() => {
          StorageService.setCurrentUser(user);
          onLoginSuccess(user);
        }, 400);
      }
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const verify = await ApiClient.verifyOTP(pendingUser.email, otpCode);
      setIsLoading(false);
      if (!verify.success) {
        setError(verify.error || 'Invalid OTP code.');
        return;
      }

      const verifiedUser = verify.user || pendingUser;
      if (verify.step === 'force_password_change' || verifiedUser.mustChangePassword) {
        setStep('force_password_change');
        setSuccessMsg('OTP verified successfully! Now update your default 7-digit password.');
      } else {
        setSuccessMsg('OTP verified! Login successful. Entering system...');
        setTimeout(() => {
          StorageService.setCurrentUser(verifiedUser);
          onLoginSuccess(verifiedUser);
        }, 450);
      }
    } catch {
      const verify = StorageService.verifyOTP(pendingUser.email, otpCode);
      setIsLoading(false);
      if (!verify.success) {
        setError(verify.error || 'Invalid OTP code.');
        return;
      }
      if (pendingUser.mustChangePassword) {
        setStep('force_password_change');
        setSuccessMsg('OTP verified successfully! Now update your default 7-digit password.');
      } else {
        setSuccessMsg('OTP verified! Login successful. Entering system...');
        setTimeout(() => {
          StorageService.setCurrentUser(pendingUser);
          onLoginSuccess(pendingUser);
        }, 450);
      }
    }
  };

  const handleResendOTP = async () => {
    if (!pendingUser) return;
    setError(null);
    try {
      const res = await ApiClient.resendOTP(pendingUser.email);
      if (res.success) {
        setSuccessMsg(
          `A new OTP has been sent to ${pendingUser.email} and ${pendingUser.phone || 'your registered phone'}.`
        );
        setLastDispatchedPreview(res.otpPreview || null);
      } else {
        setError(res.error || 'Could not resend OTP.');
      }
    } catch {
      const otpRecord = StorageService.createOTP(pendingUser, 'login');
      setSuccessMsg(
        `A new OTP has been sent to ${pendingUser.email} and ${pendingUser.phone || 'your registered phone'}.`
      );
      setLastDispatchedPreview(otpRecord.code);
    }
  };

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    setError(null);

    if (!strength.isValid) {
      setError('Please satisfy all 5 password rules before continuing.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await ApiClient.changePassword(pendingUser.id, newPassword);
      setIsLoading(false);
      if (!res.success || !res.user) {
        setError(res.error || 'Failed to update password.');
        return;
      }
      setSuccessMsg('Password updated successfully! Login successful. Entering system...');
      setTimeout(() => {
        StorageService.setCurrentUser(res.user!);
        onLoginSuccess(res.user!);
      }, 500);
    } catch {
      const res = StorageService.changeUserPassword(pendingUser.id, newPassword);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || 'Failed to update password.');
        return;
      }
      setSuccessMsg('Password updated successfully! Login successful. Entering system...');
      setTimeout(() => {
        const updatedUser = { ...pendingUser, password: newPassword, mustChangePassword: false };
        StorageService.setCurrentUser(updatedUser);
        onLoginSuccess(updatedUser);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Dynamic Theme-Controlled Login Page Header */}
      <header
        className="w-full px-4 sm:px-8 py-3.5 border-b border-black/10 transition-colors duration-300"
        style={{ backgroundColor: headerBg, color: headerTextColor }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: accentBg, color: accentTextColor }}
            >
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-extrabold tracking-tight">QR Code</span>
                <span className="text-[11px] font-bold opacity-85">Enyew M.</span>
              </div>
              <p className="text-[11px]" style={{ color: headerMutedColor }}>
                Universal QR Code &amp; Dynamic Access Management
              </p>
            </div>
          </div>

          <div
            className="hidden sm:flex items-center gap-2 text-xs font-semibold"
            style={{ color: headerMutedColor }}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database:</span>
            <strong style={{ color: headerTextColor }}>{databaseName}</strong>
          </div>
        </div>
      </header>

      {/* Main Centered Login Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Card Accent Header Strip */}
          <div
            className="px-6 py-5 border-b border-black/10 transition-colors duration-300"
            style={{ backgroundColor: headerBg, color: headerTextColor }}
          >
            <h1 className="text-lg font-extrabold tracking-tight">
              {step === 'credentials'
                ? 'Sign In'
                : step === 'otp'
                ? 'OTP Verification'
                : 'Change Default Password'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: headerMutedColor }}>
              {step === 'credentials'
                ? 'Enter your username or email and password to access your workspace'
                : step === 'otp'
                ? 'Enter the 6-digit verification code sent to your email and phone'
                : 'Enforce 5-rule strong password before continuing'}
            </p>
          </div>

          <div className="p-6">
            {/* Database indicator on small screens */}
            <div className="sm:hidden mb-4 flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-[11px] font-semibold text-slate-700 border border-slate-200">
              <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Database:</span>
              <strong className="text-slate-900 font-bold">{databaseName}</strong>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* STEP 1: CREDENTIALS */}
            {step === 'credentials' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter username or email"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
                  style={{ backgroundColor: accentBg, color: accentTextColor }}
                >
                  {isLoading ? (
                    <span>Validating...</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: INSERT OTP (EMAIL / SMS) */}
            {step === 'otp' && pendingUser && (
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Two-Factor Authentication</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800">
                    A 6-digit OTP verification code has been dispatched to your registered email ({pendingUser.email}) and phone ({pendingUser.phone || 'SMS'}).
                  </p>
                  {lastDispatchedPreview && (
                    <div className="mt-2 text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 font-mono">
                      OTP Code: <strong className="text-amber-950 font-bold">{lastDispatchedPreview}</strong>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.3em] font-mono text-xl py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="w-full py-3 px-4 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: accentBg, color: accentTextColor }}
                >
                  {isLoading ? <span>Verifying...</span> : <span>Verify &amp; Login</span>}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setOtpCode('');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: FORCED PASSWORD CHANGE (5 RULES + STRENGTH BAR) */}
            {step === 'force_password_change' && pendingUser && (
              <form onSubmit={handleForcePasswordChange} className="space-y-4">
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-950">
                  <div className="font-bold flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>Security Notice: Set Permanent Password</span>
                  </div>
                  <p className="mt-1 text-[11px] text-sky-800">
                    You signed in with a temporary 7-digit default password. You must set a new permanent password meeting all 5 security rules.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, Capital, Small, Number, Special"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Password Strength Meter */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Password Strength</span>
                      <span
                        className={
                          strength.score === 5
                            ? 'text-emerald-600 font-bold'
                            : strength.score >= 3
                            ? 'text-amber-600 font-bold'
                            : 'text-rose-500 font-bold'
                        }
                      >
                        {strength.score === 5
                          ? 'Strong (All 5 Rules Met)'
                          : strength.score >= 3
                          ? 'Medium'
                          : 'Weak'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-full flex-1 transition-all ${
                            level <= strength.score
                              ? strength.score === 5
                                ? 'bg-emerald-500'
                                : strength.score >= 3
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* 5 Rules Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-1">
                      <div className={`flex items-center gap-1.5 ${strength.hasLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{strength.hasLength ? '✓' : '○'}</span>
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${strength.hasCapital ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{strength.hasCapital ? '✓' : '○'}</span>
                        <span>At least 1 Capital (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${strength.hasSmall ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{strength.hasSmall ? '✓' : '○'}</span>
                        <span>At least 1 Small (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${strength.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{strength.hasNumber ? '✓' : '○'}</span>
                        <span>At least 1 Number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 sm:col-span-2 ${strength.hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        <span>{strength.hasSpecial ? '✓' : '○'}</span>
                        <span>At least 1 Special char (!@#$%^&amp;*)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter permanent password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !strength.isValid || newPassword !== confirmPassword}
                  className="w-full py-3 px-4 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: accentBg, color: accentTextColor }}
                >
                  <span>{isLoading ? 'Saving...' : 'Save Password & Access System'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Card Footer - Powered By Enyew M. only */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-500">
              Powered By <strong className="text-slate-800 font-extrabold">Enyew M.</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
