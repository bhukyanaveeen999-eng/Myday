import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Note } from '../../types/database.types';
import { NOTE_CATEGORIES, countWords, getCategoryStyles } from './noteCategories';
import { Pin, Save, RotateCcw, X, Loader2, Tag, Check } from 'lucide-react';

interface NoteEditorModalProps {
  isOpen: boolean;
  editingNote: Note | null;
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  draftRestored: boolean;
  formError: string | null;
  isSubmitting: boolean;
  onTitleChange: (val: string) => void;
  onContentChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onPinnedChange: (val: boolean) => void;
  onDiscardDraft: () => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  editingNote,
  title,
  content,
  category,
  isPinned,
  draftRestored,
  formError,
  isSubmitting,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onPinnedChange,
  onDiscardDraft,
  onClose,
  onSubmit,
}) => {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Focus title on open for new notes & support Esc / Ctrl+S shortcuts
  useEffect(() => {
    if (!isOpen) return;

    if (!editingNote && !title) {
      const timer = setTimeout(() => titleInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editingNote, title]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isSubmitting) {
          formRef.current?.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const hasUnsavedInput = Boolean(title.trim() || content.trim());
  const words = countWords(content);
  const chars = content.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="note-editor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/45 backdrop-blur-[2px]"
        >
          <motion.div
            key="note-editor-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] sm:max-h-[86vh] overflow-hidden"
          >
            {/* Top Editor Toolbar */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">
                  {editingNote ? 'Edit Note' : 'New Note'}
                </span>
                {hasUnsavedInput && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full truncate">
                    <Save className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {draftRestored ? 'Draft restored' : 'Saved locally'}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => onPinnedChange(!isPinned)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isPinned
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={isPinned ? 'Unpin note' : 'Pin note to top'}
                >
                  <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                  <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                </motion.button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition-colors"
                  aria-label="Close editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form
              ref={formRef}
              onSubmit={onSubmit}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Category Picker Strip */}
              <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="flex items-center gap-1.5">
                  {NOTE_CATEGORIES.map((cat) => {
                    const active = category === cat;
                    const styles = getCategoryStyles(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => onCategoryChange(cat)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ${
                          active
                            ? `${styles.badge} ring-1 ring-inset ring-current/20 shadow-2xs`
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        {cat}
                        {active && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {formError}
                </div>
              )}

              {/* Writing Surface */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Note title..."
                  className="w-full text-xl sm:text-2xl font-bold text-gray-900 placeholder-gray-300 border-0 focus:outline-none focus:ring-0 bg-transparent tracking-tight"
                />

                <textarea
                  rows={11}
                  value={content}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder="Start writing your thoughts, ideas, meeting notes, or checklists..."
                  className="w-full text-sm sm:text-[15px] leading-relaxed text-gray-700 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 resize-none bg-transparent min-h-[240px]"
                />
              </div>

              {/* Editor Footer */}
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    {words} {words === 1 ? 'word' : 'words'} · {chars} chars
                  </span>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span className="hidden sm:inline">Ctrl+S to save</span>
                  {hasUnsavedInput && (
                    <button
                      type="button"
                      onClick={onDiscardDraft}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {editingNote ? 'Reset' : 'Clear'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingNote ? 'Save Changes' : 'Save Note'}
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

