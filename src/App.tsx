import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, RotateCcw, ShieldCheck, ArrowLeft, Smartphone } from 'lucide-react';
import {
  AppUser,
  CustomThemeSetting,
  OTPRecord,
  QRCategory,
  QRScanEvent,
  RestaurantProfile,
  RestaurantQRCode,
  RoleDefinition,
  SystemSection,
} from './types';
import { StorageService, subscribeToLiveSync } from './services/storage';
import { NotificationService, SentNotificationRecord } from './services/notificationService';
import { ApiClient } from './services/api';
import { UrlResolver } from './services/urlResolver';
import { LoginPage } from './components/LoginPage';
import { Sidebar, SidebarSection } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { QRCodeList } from './components/QRCodeList';
import { QRCodeCreatorModal } from './components/QRCodeCreatorModal';
import { QRCodeCustomizer } from './components/QRCodeCustomizer';
import { CategoryManagementView } from './components/CategoryManagementView';
import { AnalyticsView } from './components/AnalyticsView';
import { RoleManagementView } from './components/RoleManagementView';
import { UserManagementView } from './components/UserManagementView';
import { ThemeManagementView } from './components/ThemeManagementView';
import { ReportsView } from './components/ReportsView';
import { QRScanLandingView } from './components/QRScanLandingView';
import { MobileDeviceFrame } from './components/MobileDeviceFrame';
import { PrintTableTentModal } from './components/PrintTableTentModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ToastContainer, ToastItem } from './components/ToastContainer';

export default function App() {
  // Persisted Database Entities ("QR Code Generator")
  const [currentUser, setCurrentUser] = useState<AppUser | null>(StorageService.getCurrentUser());
  const [theme, setTheme] = useState<CustomThemeSetting>(StorageService.getThemeSetting());
  const [roles, setRoles] = useState<RoleDefinition[]>(StorageService.getRoles());
  const [users, setUsers] = useState<AppUser[]>(StorageService.getUsers());
  const [categories, setCategories] = useState<QRCategory[]>(StorageService.getCategories());
  const [qrCodes, setQRCodes] = useState<RestaurantQRCode[]>(StorageService.getQRCodes());
  const [scanEvents, setScanEvents] = useState<QRScanEvent[]>(StorageService.getScanEvents());
  const [otps, setOTPs] = useState<OTPRecord[]>(StorageService.getOTPs());
  const [notifications, setNotifications] = useState<SentNotificationRecord[]>(
    NotificationService.getHistory()
  );
  const [restaurant, setRestaurant] = useState<RestaurantProfile>(StorageService.getRestaurant());

  // UI Navigation & Modal State
  const [activeSection, setActiveSection] = useState<SidebarSection>('Dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [editingQRCode, setEditingQRCode] = useState<RestaurantQRCode | null>(null);
  const [previewScanQR, setPreviewScanQR] = useState<RestaurantQRCode | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorDefaultCategoryId, setCreatorDefaultCategoryId] = useState<string | undefined>(
    undefined
  );
  const [printTentQR, setPrintTentQR] = useState<RestaurantQRCode | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Public QR Scan Landing Session (when opened via scanned QR URL)
  const [directScanMode, setDirectScanMode] = useState<boolean>(false);
  const [directScanQRId, setDirectScanQRId] = useState<string | undefined>(undefined);
  const hasRecordedDirectScan = useRef(false);

  const addToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshAllFromStorage = useCallback(() => {
    setTheme(StorageService.getThemeSetting());
    setRoles(StorageService.getRoles());
    setUsers(StorageService.getUsers());
    setCategories(StorageService.getCategories());
    setQRCodes(StorageService.getQRCodes());
    setScanEvents(StorageService.getScanEvents());
    setOTPs(StorageService.getOTPs());
    setNotifications(NotificationService.getHistory());
    setRestaurant(StorageService.getRestaurant());
    setCurrentUser(StorageService.getCurrentUser());
  }, []);

  // Hydrate initial state from Neon PostgreSQL backend + handle QR scan session
  useEffect(() => {
    let mounted = true;
    const session = UrlResolver.detectScanSession();

    ApiClient.bootstrap()
      .then((boot) => {
        if (!mounted || !boot.success) return;
        StorageService.hydrateFromBackend(boot);
        refreshAllFromStorage();

        if (session.isScan) {
          setDirectScanMode(true);
          const loadedQRs = StorageService.getQRCodes();
          const target =
            (session.qrId && loadedQRs.find((q) => q.id === session.qrId)) || loadedQRs[0];
          if (target) {
            setDirectScanQRId(target.id);
            if (!hasRecordedDirectScan.current) {
              hasRecordedDirectScan.current = true;
              const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
              const device = /iPhone|iPad|iPod/i.test(ua)
                ? 'iOS'
                : /Android/i.test(ua)
                ? 'Android'
                : 'Desktop';
              StorageService.recordScan(target.id, device);
              setQRCodes(StorageService.getQRCodes());
              setScanEvents(StorageService.getScanEvents());
            }
          }
        }
      })
      .catch(() => {
        // Fallback if backend unavailable
        if (session.isScan) {
          setDirectScanMode(true);
          const loadedQRs = StorageService.getQRCodes();
          const target =
            (session.qrId && loadedQRs.find((q) => q.id === session.qrId)) || loadedQRs[0];
          if (target) {
            setDirectScanQRId(target.id);
            if (!hasRecordedDirectScan.current) {
              hasRecordedDirectScan.current = true;
              const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
              const device = /iPhone|iPad|iPod/i.test(ua)
                ? 'iOS'
                : /Android/i.test(ua)
                ? 'Android'
                : 'Desktop';
              StorageService.recordScan(target.id, device);
              setQRCodes(StorageService.getQRCodes());
              setScanEvents(StorageService.getScanEvents());
            }
          }
        }
      });

    return () => {
      mounted = false;
    };
  }, [refreshAllFromStorage]);

  // Live Cross-Tab & In-App Storage Sync
  useEffect(() => {
    const unsubscribe = subscribeToLiveSync((event) => {
      switch (event.type) {
        case 'THEME_UPDATED':
          setTheme(StorageService.getThemeSetting());
          break;
        case 'ROLES_UPDATED':
          setRoles(StorageService.getRoles());
          break;
        case 'CATEGORIES_UPDATED':
          setCategories(StorageService.getCategories());
          break;
        case 'USERS_UPDATED':
          setUsers(StorageService.getUsers());
          setOTPs(StorageService.getOTPs());
          setNotifications(NotificationService.getHistory());
          break;
        case 'QR_CODES_UPDATED':
        case 'SCAN_RECORDED':
          setQRCodes(StorageService.getQRCodes());
          setScanEvents(StorageService.getScanEvents());
          break;
        case 'RESTAURANT_UPDATED':
          setRestaurant(StorageService.getRestaurant());
          break;
        case 'SESSION_CHANGED':
          setCurrentUser(StorageService.getCurrentUser());
          break;
        case 'RESET_ALL':
          refreshAllFromStorage();
          break;
      }
    });
    return unsubscribe;
  }, [refreshAllFromStorage]);

  // Resolve current user's RoleDefinition & Privileges
  const userRole = currentUser
    ? roles.find((r) => r.id === currentUser.role)
    : undefined;

  const hasPrivilege = (
    section: SystemSection,
    action: 'view' | 'add' | 'edit' | 'delete'
  ): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    return Boolean(userRole?.privileges?.[section]?.[action]);
  };

  // Ensure activeSection stays within sections the signed-in role can view
  useEffect(() => {
    if (!currentUser) return;
    const sectionsOrder: SystemSection[] = [
      'Dashboard',
      'QR Codes',
      'Category Management',
      'Analytics',
      'Role Management',
      'User Management',
      'Theme Settings',
      'Reports',
    ];
    if (!hasPrivilege(activeSection, 'view')) {
      const firstAllowed = sectionsOrder.find((sec) => hasPrivilege(sec, 'view'));
      if (firstAllowed) {
        setActiveSection(firstAllowed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, roles]);

  // Direct Public Scan Mode (when a smartphone scans a generated QR code)
  if (directScanMode) {
    const scannedQR =
      qrCodes.find((q) => q.id === directScanQRId) || qrCodes[0] || null;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <div className="flex-1 max-w-xl w-full mx-auto bg-white shadow-sm min-h-screen">
          <QRScanLandingView qrCode={scannedQR} restaurant={restaurant} theme={theme} />
        </div>

        <button
          onClick={() => {
            setDirectScanMode(false);
            if (typeof window !== 'undefined' && window.history.replaceState) {
              const cleanUrl = window.location.origin + window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
            }
          }}
          className="fixed bottom-3 right-3 z-50 bg-slate-900/80 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold shadow-lg cursor-pointer"
        >
          Admin Console
        </button>
      </div>
    );
  }

  const resolveFirstAllowedSection = (
    user: AppUser,
    availableRoles: RoleDefinition[]
  ): SidebarSection | null => {
    const sectionsOrder: SystemSection[] = [
      'Dashboard',
      'QR Codes',
      'Category Management',
      'Analytics',
      'Role Management',
      'User Management',
      'Theme Settings',
      'Reports',
    ];
    if (user.role === 'super_admin') return 'Dashboard';
    const roleDef = availableRoles.find((r) => r.id === user.role);
    const found = sectionsOrder.find((sec) => Boolean(roleDef?.privileges?.[sec]?.view));
    return found || null;
  };

  // Authentication Gate
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={async (user) => {
            try {
              const boot = await ApiClient.bootstrap();
              if (boot.success) {
                StorageService.hydrateFromBackend(boot);
              }
            } catch {
              // fallback to local roles
            }
            const latestRoles = StorageService.getRoles();
            const landingSection = resolveFirstAllowedSection(user, latestRoles);
            if (landingSection) {
              setActiveSection(landingSection);
            }
            setCurrentUser(user);
            refreshAllFromStorage();
            addToast(`Welcome back, ${user.name}!`, 'success');
          }}
          brandColor={theme.primaryColor}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Handlers
  const handleOpenCreateQR = (categoryId?: string) => {
    setCreatorDefaultCategoryId(categoryId);
    setIsCreatorOpen(true);
  };

  const handleCreateNewQR = (newQRPartial: Partial<RestaurantQRCode>): RestaurantQRCode => {
    const newQR: RestaurantQRCode = {
      id: `qr_${Date.now()}`,
      restaurantId: restaurant.id,
      categoryId: newQRPartial.categoryId || creatorDefaultCategoryId || categories[0]?.id,
      title: newQRPartial.title || 'Dynamic QR Code',
      description: newQRPartial.description || '',
      ctaLabel: newQRPartial.ctaLabel || 'See More',
      type: newQRPartial.type || 'website',
      targetUrl: newQRPartial.targetUrl || '',
      shortUrl:
        newQRPartial.shortUrl ||
        `dineqr.io/${Math.random().toString(36).slice(2, 7)}`,
      scansCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: newQRPartial.expiresAt ?? null,
      welcomeScreen: newQRPartial.welcomeScreen,
      uploadedFiles: newQRPartial.uploadedFiles || [],
      styling: newQRPartial.styling || {
        fgColor: '#059669',
        bgColor: '#ffffff',
        frameStyle: 'scan-me',
        frameText: 'SCAN QR CODE',
        dotStyle: 'rounded',
        logoInCenter: true,
        size: 280,
      },
    };

    StorageService.createQRCode(newQR);
    setQRCodes(StorageService.getQRCodes());
    setCreatorDefaultCategoryId(undefined);
    setActiveSection('QR Codes');
    addToast(`Generated QR Code "${newQR.title}"`, 'success');
    return newQR;
  };

  const handleDuplicateQR = (qr: RestaurantQRCode) => {
    const duplicated: RestaurantQRCode = {
      ...qr,
      id: `qr_${Date.now()}`,
      title: `${qr.title} (Copy)`,
      shortUrl: `dineqr.io/${Math.random().toString(36).slice(2, 7)}`,
      scansCount: 0,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    StorageService.createQRCode(duplicated);
    setQRCodes(StorageService.getQRCodes());
    addToast(`Duplicated "${qr.title}"`, 'success');
  };

  const handleSoftDeleteQR = (id: string) => {
    StorageService.softDeleteQRCode(id);
    setQRCodes(StorageService.getQRCodes());
    if (editingQRCode?.id === id) setEditingQRCode(null);
    addToast('QR code moved to soft-deleted archive (recoverable in Reports).', 'info');
  };

  const handleSaveCustomizer = (
    updatedQR: RestaurantQRCode,
    updatedRestaurant: RestaurantProfile
  ) => {
    StorageService.updateQRCode(updatedQR);
    StorageService.saveRestaurant(updatedRestaurant);
    setQRCodes(StorageService.getQRCodes());
    setRestaurant(updatedRestaurant);
    setEditingQRCode(updatedQR);
  };

  const handleApplyTheme = (nextTheme: CustomThemeSetting) => {
    StorageService.saveThemeSetting(nextTheme);
    setTheme(nextTheme);
  };

  const handleResetDemoState = () => {
    StorageService.resetAllToDefault();
    setIsResetConfirmOpen(false);
    refreshAllFromStorage();
    addToast('Database "QR Code Generator" restored to initial defaults.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Fixed Responsive Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setEditingQRCode(null);
          setPreviewScanQR(null);
        }}
        onOpenCreateQR={() => handleOpenCreateQR()}
        onLogout={() => {
          StorageService.logout();
          setCurrentUser(null);
          setEditingQRCode(null);
          setPreviewScanQR(null);
        }}
        currentUser={currentUser}
        userRole={userRole}
        theme={theme}
        qrCount={qrCodes.length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Right Shell Offset for Fixed Desktop Sidebar */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen transition-all">
        {/* Minimal Top Strip: NO header except Role Name (+ mobile drawer trigger on <lg) */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open navigation sidebar"
            className="lg:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{userRole?.name || currentUser.role}</span>
          </div>
        </div>

        {/* Main Active Workspace */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {previewScanQR ? (
            /* Live Smartphone Scan Preview Simulation */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                    <span>Live Scan Preview · {previewScanQR.title}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Interactive simulation of the Welcome Screen and destination card when scanned on mobile devices.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintTentQR(previewScanQR)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Print Standee
                  </button>
                  <button
                    onClick={() => setPreviewScanQR(null)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                </div>
              </div>

              <div className="py-2 flex justify-center">
                <MobileDeviceFrame width={390} height={780} restaurantName={previewScanQR.title}>
                  <QRScanLandingView
                    qrCode={previewScanQR}
                    restaurant={restaurant}
                    theme={theme}
                    isPreview={true}
                  />
                </MobileDeviceFrame>
              </div>
            </div>
          ) : editingQRCode ? (
            <QRCodeCustomizer
              qrCode={editingQRCode}
              categories={categories}
              restaurant={restaurant}
              theme={theme}
              onBack={() => setEditingQRCode(null)}
              onSave={handleSaveCustomizer}
              onToast={addToast}
            />
          ) : activeSection === 'Dashboard' ? (
            <DashboardView
              currentUser={currentUser}
              userRole={userRole}
              qrCodes={qrCodes}
              categories={categories}
              users={users}
              roles={roles}
              otps={otps}
              notifications={notifications}
              scanEvents={scanEvents}
              theme={theme}
              onNavigate={(sec) => {
                setActiveSection(sec);
                setEditingQRCode(null);
              }}
            />
          ) : activeSection === 'QR Codes' ? (
            <QRCodeList
              qrCodes={qrCodes}
              categories={categories}
              restaurant={restaurant}
              theme={theme}
              onCreateNew={() => handleOpenCreateQR()}
              onEdit={(qr) => setEditingQRCode(qr)}
              onOpenScanPreview={(qr) => setPreviewScanQR(qr)}
              onSoftDelete={handleSoftDeleteQR}
              onDuplicate={handleDuplicateQR}
              onPrintTent={(qr) => setPrintTentQR(qr)}
              onToast={addToast}
              canAdd={hasPrivilege('QR Codes', 'add')}
              canEdit={hasPrivilege('QR Codes', 'edit')}
              canDelete={hasPrivilege('QR Codes', 'delete')}
            />
          ) : activeSection === 'Category Management' ? (
            <CategoryManagementView
              categories={categories}
              qrCodes={qrCodes}
              onCategoriesChanged={() => setCategories(StorageService.getCategories())}
              onOpenCreateQR={(catId) => handleOpenCreateQR(catId)}
              onEditQR={(qr) => {
                setActiveSection('QR Codes');
                setEditingQRCode(qr);
              }}
              onToast={addToast}
              theme={theme}
              canAdd={hasPrivilege('Category Management', 'add')}
              canEdit={hasPrivilege('Category Management', 'edit')}
              canDelete={hasPrivilege('Category Management', 'delete')}
              canCreateQR={hasPrivilege('QR Codes', 'add')}
            />
          ) : activeSection === 'Analytics' ? (
            <AnalyticsView
              qrCodes={qrCodes}
              categories={categories}
              scanEvents={scanEvents}
              theme={theme}
            />
          ) : activeSection === 'Role Management' ? (
            <RoleManagementView
              onToast={addToast}
              onRolesChanged={() => setRoles(StorageService.getRoles())}
              theme={theme}
              canAdd={hasPrivilege('Role Management', 'add')}
              canEdit={hasPrivilege('Role Management', 'edit')}
              canDelete={hasPrivilege('Role Management', 'delete')}
            />
          ) : activeSection === 'User Management' ? (
            <UserManagementView
              currentUser={currentUser}
              roles={roles}
              theme={theme}
              onUsersChanged={() => {
                setUsers(StorageService.getUsers());
                setNotifications(NotificationService.getHistory());
              }}
              onToast={addToast}
              canAdd={hasPrivilege('User Management', 'add')}
              canEdit={hasPrivilege('User Management', 'edit')}
              canDelete={hasPrivilege('User Management', 'delete')}
            />
          ) : activeSection === 'Theme Settings' ? (
            <ThemeManagementView
              currentTheme={theme}
              onApplyTheme={handleApplyTheme}
              onToast={addToast}
              canEdit={hasPrivilege('Theme Settings', 'edit')}
            />
          ) : activeSection === 'Reports' && hasPrivilege('Reports', 'view') ? (
            <ReportsView
              scanEvents={scanEvents}
              notifications={notifications}
              otps={otps}
              onDataRestored={refreshAllFromStorage}
              onToast={addToast}
              canRestore={hasPrivilege('Reports', 'edit')}
            />
          ) : !hasPrivilege(activeSection, 'view') ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12">
              <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h2 className="text-base font-extrabold text-slate-900">Access Restricted</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your current role (<strong>{userRole?.name || currentUser.role}</strong>) does not have permission to view any sections. Contact a Super Admin to assign privileges.
              </p>
            </div>
          ) : null}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span>© 2026 QR Code</span>
              <span>·</span>
              <span className="font-semibold text-slate-700">
                Powered By <strong className="font-extrabold text-slate-900">Enyew M.</strong>
              </span>
              <span className="hidden md:inline text-slate-400">
                · Database: QR Code Generator
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo State</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Create QR Code Modal */}
      {isCreatorOpen && (
        <QRCodeCreatorModal
          categories={categories}
          defaultCategoryId={creatorDefaultCategoryId}
          theme={theme}
          restaurant={restaurant}
          onClose={() => {
            setIsCreatorOpen(false);
            setCreatorDefaultCategoryId(undefined);
          }}
          onCreate={handleCreateNewQR}
          onEditCreated={(qr) => {
            setIsCreatorOpen(false);
            setCreatorDefaultCategoryId(undefined);
            setEditingQRCode(qr);
          }}
          onPreviewCreated={(qr) => {
            setIsCreatorOpen(false);
            setCreatorDefaultCategoryId(undefined);
            setPreviewScanQR(qr);
          }}
        />
      )}

      {/* Printable Table Tent / Standee Modal */}
      {printTentQR && (
        <PrintTableTentModal
          qrCode={printTentQR}
          restaurant={restaurant}
          onClose={() => setPrintTentQR(null)}
        />
      )}

      {/* Confirm Demo Reset Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset Database State"
        message="This will restore all roles, categories, users, QR codes, and analytics inside 'QR Code Generator' to initial defaults. Proceed?"
        confirmLabel="Reset Defaults"
        variant="warning"
        onConfirm={handleResetDemoState}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Global Toast Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
