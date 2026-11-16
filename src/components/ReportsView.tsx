import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Mail,
  KeyRound,
  QrCode,
  Trash2,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  AppUser,
  OTPRecord,
  QRCategory,
  QRScanEvent,
  RestaurantQRCode,
  RoleDefinition,
} from '../types';
import { SentNotificationRecord } from '../services/notificationService';
import { StorageService } from '../services/storage';

interface ReportsViewProps {
  scanEvents: QRScanEvent[];
  notifications: SentNotificationRecord[];
  otps: OTPRecord[];
  onDataRestored: () => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  canRestore: boolean;
}

type ReportTab = 'scans' | 'notifications' | 'otps' | 'deleted';

export const ReportsView: React.FC<ReportsViewProps> = ({
  scanEvents,
  notifications,
  otps,
  onDataRestored,
  onToast,
  canRestore,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('scans');

  const deletedUsers: AppUser[] = StorageService.getAllUsersIncludingDeleted().filter((u) => u.deletedAt);
  const deletedRoles: RoleDefinition[] = StorageService.getAllRolesIncludingDeleted().filter((r) => r.deletedAt);
  const deletedCategories: QRCategory[] = StorageService.getAllCategoriesIncludingDeleted().filter((c) => c.deletedAt);
  const deletedQRs: RestaurantQRCode[] = StorageService.getAllQRCodesIncludingDeleted().filter((q) => q.deletedAt);
  const totalDeleted =
    deletedUsers.length + deletedRoles.length + deletedCategories.length + deletedQRs.length;

  const handleExportScansCSV = () => {
    const header = 'ID,QR Code,Timestamp,Device,Location\n';
    const rows = scanEvents
      .map(
        (ev) =>
          `"${ev.id}","${ev.qrTitle.replace(/"/g, '""')}","${ev.timestamp}","${ev.device}","${
            ev.city || 'Addis Ababa, ET'
          }"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_scan_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast('Scan activity CSV exported.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-slate-800" />
            <span>System Reports & Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Database: {StorageService.getDatabaseName()} · Inspect scan events, email/SMS gateway logs, OTP records, and soft-deleted items.
          </p>
        </div>

        {activeTab === 'scans' && scanEvents.length > 0 && (
          <button
            type="button"
            onClick={handleExportScansCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        )}
      </div>

      {/* Segmented Report Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {[
          { id: 'scans' as ReportTab, label: `Scan Events (${scanEvents.length})`, icon: QrCode },
          { id: 'notifications' as ReportTab, label: `Email & SMS Logs (${notifications.length})`, icon: Mail },
          { id: 'otps' as ReportTab, label: `OTP Details (${otps.length})`, icon: KeyRound },
          { id: 'deleted' as ReportTab, label: `Soft Deleted (${totalDeleted})`, icon: Trash2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isActive ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Scan Events */}
      {activeTab === 'scans' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">QR Code Title</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scanEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      No scan events recorded yet.
                    </td>
                  </tr>
                ) : (
                  scanEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">{ev.qrTitle}</td>
                      <td className="py-3 px-4 text-slate-600">{ev.device}</td>
                      <td className="py-3 px-4 text-slate-600">{ev.city || 'Addis Ababa, ET'}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Email & SMS Dispatch Logs */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Sender Gateway</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject & Message</th>
                  <th className="py-3 px-4 text-right">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No email or SMS notifications dispatched yet. Create a user, trigger OTP, or reset a password to log dispatches.
                    </td>
                  </tr>
                ) : (
                  notifications.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50/70 align-top">
                      <td className="py-3 px-4 font-bold text-slate-800 capitalize whitespace-nowrap">
                        {n.type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        <div>{n.fromEmail}</div>
                        <div>{n.fromPhone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                        <div>{n.toEmail}</div>
                        <div className="text-slate-500">{n.toPhone}</div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-bold text-slate-900">{n.subject}</div>
                        <div className="text-slate-600 mt-0.5 leading-relaxed">{n.message}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {new Date(n.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: OTP Details */}
      {activeTab === 'otps' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">User Email / Phone</th>
                  <th className="py-3 px-4">OTP Code</th>
                  <th className="py-3 px-4">Channels</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Expires At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {otps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No OTP records generated yet.
                    </td>
                  </tr>
                ) : (
                  otps.map((o) => {
                    const expired = new Date(o.expiresAt).getTime() < Date.now();
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{o.email}</div>
                          <div className="text-[11px] font-mono text-slate-500">{o.phone || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                          {o.code}
                        </td>
                        <td className="py-3 px-4 text-slate-600 capitalize">
                          {o.sentVia.join(' · ')}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {o.used ? (
                            <span className="text-emerald-700">Verified & Used</span>
                          ) : expired ? (
                            <span className="text-rose-600">Expired</span>
                          ) : (
                            <span className="text-amber-700">Pending Verification</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                          {new Date(o.expiresAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Soft-Deleted Records & Recovery */}
      {activeTab === 'deleted' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          {totalDeleted === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No soft-deleted records exist in the database. All deleted QR codes, categories, users, and roles are retained safely here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deletedQRs.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">QR Code · {q.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Deleted {q.deletedAt ? new Date(q.deletedAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {canRestore && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restoreQRCode(q.id);
                        onDataRestored();
                        onToast(`Restored QR Code "${q.title}".`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              ))}

              {deletedCategories.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">Category · {c.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Deleted {c.deletedAt ? new Date(c.deletedAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {canRestore && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restoreCategory(c.id);
                        onDataRestored();
                        onToast(`Restored category "${c.name}".`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              ))}

              {deletedUsers.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">User · {u.name} ({u.email})</div>
                    <div className="text-[11px] text-slate-500">
                      Deleted {u.deletedAt ? new Date(u.deletedAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {canRestore && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restoreUser(u.id);
                        onDataRestored();
                        onToast(`Restored user "${u.name}".`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              ))}

              {deletedRoles.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">Role · {r.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Deleted {r.deletedAt ? new Date(r.deletedAt).toLocaleString() : ''}
                    </div>
                  </div>
                  {canRestore && (
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.restoreRole(r.id);
                        onDataRestored();
                        onToast(`Restored role "${r.name}".`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
