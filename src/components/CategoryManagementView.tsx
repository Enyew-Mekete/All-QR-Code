import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Globe,
  Send,
  Youtube,
  Share2,
  Briefcase,
  UtensilsCrossed,
  Edit2,
  Trash2,
  QrCode,
  X,
  ExternalLink,
} from 'lucide-react';
import { CustomThemeSetting, QRCategory, RestaurantQRCode } from '../types';
import { StorageService } from '../services/storage';
import { ConfirmModal } from './ConfirmModal';
import { getDistinctCreateQRTheme } from '../utils/themeColors';

interface CategoryManagementViewProps {
  categories: QRCategory[];
  qrCodes: RestaurantQRCode[];
  onCategoriesChanged: () => void;
  onOpenCreateQR: (categoryId?: string) => void;
  onEditQR: (qr: RestaurantQRCode) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  theme: CustomThemeSetting;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateQR?: boolean;
}

export const CategoryManagementView: React.FC<CategoryManagementViewProps> = ({
  categories,
  qrCodes,
  onCategoriesChanged,
  onOpenCreateQR,
  onEditQR,
  onToast,
  theme,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  canCreateQR = true,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || 'cat_website');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<QRCategory | null>(null);
  const [pendingDeleteCat, setPendingDeleteCat] = useState<QRCategory | null>(null);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Globe');
  const [description, setDescription] = useState('');

  const activeCategory = categories.find((c) => c.id === selectedCatId) || categories[0];
  const associatedQRs = activeCategory
    ? qrCodes.filter((q) => q.categoryId === activeCategory.id)
    : [];

  const createBtnTheme = getDistinctCreateQRTheme(theme);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName('');
    setIcon('Globe');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: QRCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setDescription(cat.description);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Category name is required.', 'error');
      return;
    }

    if (editingCategory) {
      const updated: QRCategory = {
        ...editingCategory,
        name: name.trim(),
        icon,
        description: description.trim(),
      };
      const res = StorageService.updateCategory(updated);
      if (res.success) {
        onCategoriesChanged();
        setIsModalOpen(false);
        onToast(`Category "${updated.name}" updated.`, 'success');
      } else {
        onToast(res.error || 'Failed to update category', 'error');
      }
    } else {
      const res = StorageService.createCategory({
        name: name.trim(),
        icon,
        description: description.trim() || 'Dynamic destination category',
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        displayOrder: categories.length + 1,
      });
      if (res.success && res.category) {
        onCategoriesChanged();
        setSelectedCatId(res.category.id);
        setIsModalOpen(false);
        onToast(`Category "${res.category.name}" created.`, 'success');
      } else {
        onToast(res.error || 'Failed to create category', 'error');
      }
    }
  };

  const confirmSoftDelete = () => {
    if (!pendingDeleteCat) return;
    const res = StorageService.softDeleteCategory(pendingDeleteCat.id);
    if (res.success) {
      onCategoriesChanged();
      if (selectedCatId === pendingDeleteCat.id) {
        const remaining = StorageService.getCategories();
        setSelectedCatId(remaining[0]?.id || '');
      }
      onToast(`Category "${pendingDeleteCat.name}" soft deleted.`, 'info');
    } else {
      onToast(res.error || 'Cannot delete category', 'error');
    }
    setPendingDeleteCat(null);
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Send':
        return <Send className="w-5 h-5 text-sky-600" />;
      case 'Youtube':
        return <Youtube className="w-5 h-5 text-rose-600" />;
      case 'Share2':
        return <Share2 className="w-5 h-5 text-violet-600" />;
      case 'Briefcase':
        return <Briefcase className="w-5 h-5 text-amber-600" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-5 h-5 text-emerald-600" />;
      default:
        return <Globe className="w-5 h-5 text-slate-700" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar: Top-left + Add Category and Create QR Code as requested */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-slate-800" />
            <span>Category Management</span>
          </h1>
          <p className="text-xs text-slate-500">
            Select a category to inspect previously generated QR codes, add a new category, or create a QR code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {canAdd && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}
          {canCreateQR && (
            <button
              type="button"
              onClick={() => onOpenCreateQR(activeCategory?.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-sm cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: createBtnTheme.bg, color: createBtnTheme.text }}
            >
              <Plus className="w-4 h-4" />
              <span>Create QR Code</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Categories Directory */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="text-xs font-bold text-slate-500">
            Categories ({categories.length})
          </div>

          <div className="space-y-2">
            {categories.map((cat) => {
              const isSelected = activeCategory?.id === cat.id;
              const count = qrCodes.filter((q) => q.categoryId === cat.id).length;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-white border-2 border-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      {getCategoryIcon(cat.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{cat.name}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {count} codes · {cat.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(cat);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canDelete && categories.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteCat(cat);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Soft Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Existing Generated QR Codes for Selected Category */}
        <div className="lg:col-span-7">
          {activeCategory && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {getCategoryIcon(activeCategory.icon)}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">{activeCategory.name}</h2>
                    <p className="text-xs text-slate-500">{activeCategory.description}</p>
                  </div>
                </div>

                {canCreateQR && (
                  <button
                    type="button"
                    onClick={() => onOpenCreateQR(activeCategory.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    style={{ backgroundColor: createBtnTheme.bg, color: createBtnTheme.text }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create QR Code</span>
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">
                    Previously Generated QR Codes ({associatedQRs.length})
                  </span>
                </div>

                {associatedQRs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">
                      No QR codes generated in {activeCategory.name} yet.
                    </p>
                    {canCreateQR && (
                      <button
                        type="button"
                        onClick={() => onOpenCreateQR(activeCategory.id)}
                        className="mt-3 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                        style={{ backgroundColor: createBtnTheme.bg, color: createBtnTheme.text }}
                      >
                        Create First QR Code
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {associatedQRs.map((qr) => (
                      <div
                        key={qr.id}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: qr.styling.fgColor }}
                          >
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{qr.title}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                              {qr.targetUrl}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                            {qr.scansCount.toLocaleString()} scans
                          </span>
                          <button
                            type="button"
                            onClick={() => onEditQR(qr)}
                            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                          >
                            Customize
                          </button>
                          <a
                            href={qr.targetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-800"
                            title="Open Target URL"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TikTok & Reels"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Icon Style</label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="Globe">Globe (Websites & Portals)</option>
                  <option value="Send">Send (Telegram Channels)</option>
                  <option value="Youtube">YouTube (Video Channels)</option>
                  <option value="Share2">Share (Social Media)</option>
                  <option value="Briefcase">Briefcase (Business Listings)</option>
                  <option value="UtensilsCrossed">Utensils (Restaurant & Dining)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Video streaming and channel links"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDeleteCat)}
        title="Soft Delete Category"
        message={`Are you sure you want to soft delete the category "${pendingDeleteCat?.name}"? Existing QR codes remain in the database and can be reassigned or restored.`}
        confirmLabel="Soft Delete"
        onConfirm={confirmSoftDelete}
        onCancel={() => setPendingDeleteCat(null)}
      />
    </div>
  );
};
