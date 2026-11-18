import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { noteService } from '../services/noteService';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types/database.types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteEditorModal } from '../components/notes/NoteEditorModal';
import { NOTE_CATEGORIES } from '../components/notes/noteCategories';
import { formatDateTime } from '../utils/dateUtils';
import {
  loadAppState,
  updateAppState,
  type NotesSortBy,
  type NotesViewMode,
} from '../utils/appStateStorage';
import {
  loadNoteDraft,
  saveNoteDraft,
  clearNoteDraft,
  NEW_NOTE_DRAFT_ID,
  type NoteDraft,
} from '../utils/noteDraftStorage';
import {
  Plus,
  FileText,
  AlertCircle,
  Search,
  X,
  Pin,
  LayoutGrid,
  List,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';

export const NotesPage: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persistent per-user UI preferences
  const initialPrefs = useMemo(() => loadAppState(userId), [userId]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialPrefs.notesCategory);
  const [viewMode, setViewMode] = useState<NotesViewMode>(initialPrefs.notesViewMode);
  const [sortBy, setSortBy] = useState<NotesSortBy>(initialPrefs.notesSortBy);

  // Local draft tracking for new notes (isolated per user)
  const [newNoteDraft, setNewNoteDraft] = useState<NoteDraft | null>(() =>
    loadNoteDraft(userId, NEW_NOTE_DRAFT_ID)
  );

  // Modal / editor states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Editor form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pinning & delete states
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await noteService.getNotes();
      setNotes(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch notes.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prefs = loadAppState(userId);
    setSelectedCategory(prefs.notesCategory);
    setViewMode(prefs.notesViewMode);
    setSortBy(prefs.notesSortBy);
    setNewNoteDraft(loadNoteDraft(userId, NEW_NOTE_DRAFT_ID));
    fetchNotes();
  }, [userId]);

  // '/' keyboard shortcut focuses search when editor is closed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !isFormOpen &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen]);

  const handleCategoryFilterChange = (cat: string) => {
    setSelectedCategory(cat);
    updateAppState(userId, { notesCategory: cat });
  };

  const handleViewModeChange = (mode: NotesViewMode) => {
    setViewMode(mode);
    updateAppState(userId, { notesViewMode: mode });
  };

  const handleSortChange = (sort: NotesSortBy) => {
    setSortBy(sort);
    updateAppState(userId, { notesSortBy: sort });
  };

  const currentDraftId = editingNote ? editingNote.id : NEW_NOTE_DRAFT_ID;

  const openCreateModal = () => {
    setEditingNote(null);
    const savedDraft = loadNoteDraft(userId, NEW_NOTE_DRAFT_ID);
    if (savedDraft) {
      setTitle(savedDraft.title);
      setContent(savedDraft.content);
      setCategory(savedDraft.category || 'General');
      setIsPinned(savedDraft.isPinned ?? false);
      setDraftRestored(true);
    } else {
      setTitle('');
      setContent('');
      // Default to currently selected category if it's a real category
      const defaultCat =
        selectedCategory !== 'all' && selectedCategory !== 'pinned'
          ? selectedCategory
          : 'General';
      setCategory(defaultCat);
      setIsPinned(selectedCategory === 'pinned');
      setDraftRestored(false);
    }
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    const savedDraft = loadNoteDraft(userId, note.id);
    if (savedDraft) {
      setTitle(savedDraft.title);
      setContent(savedDraft.content);
      setCategory(savedDraft.category || note.category || 'General');
      setIsPinned(savedDraft.isPinned ?? note.is_pinned ?? false);
      setDraftRestored(true);
    } else {
      setTitle(note.title);
      setContent(note.content);
      setCategory(note.category || 'General');
      setIsPinned(note.is_pinned ?? false);
      setDraftRestored(false);
    }
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setNewNoteDraft(loadNoteDraft(userId, NEW_NOTE_DRAFT_ID));
    setIsFormOpen(false);
    setEditingNote(null);
    setFormError(null);
    setDraftRestored(false);
  };

  const persistCurrentDraft = (
    nextTitle: string,
    nextContent: string,
    nextCat: string,
    nextPinned: boolean
  ) => {
    const saved = saveNoteDraft(userId, currentDraftId, nextTitle, nextContent, {
      category: nextCat,
      isPinned: nextPinned,
    });
    if (!editingNote) {
      setNewNoteDraft(saved);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    persistCurrentDraft(newTitle, content, category, isPinned);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    persistCurrentDraft(title, newContent, category, isPinned);
  };

  const handleEditorCategoryChange = (newCat: string) => {
    setCategory(newCat);
    persistCurrentDraft(title, content, newCat, isPinned);
  };

  const handleEditorPinnedChange = (newPinned: boolean) => {
    setIsPinned(newPinned);
    persistCurrentDraft(title, content, category, newPinned);
  };

  const handleDiscardCurrentDraft = () => {
    clearNoteDraft(userId, currentDraftId);
    if (editingNote) {
      setTitle(editingNote.title);
      setContent(editingNote.content);
      setCategory(editingNote.category || 'General');
      setIsPinned(editingNote.is_pinned ?? false);
    } else {
      setTitle('');
      setContent('');
      setCategory('General');
      setIsPinned(false);
      setNewNoteDraft(null);
    }
    setDraftRestored(false);
  };

  const handleDiscardNewDraftBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearNoteDraft(userId, NEW_NOTE_DRAFT_ID);
    setNewNoteDraft(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim() || 'Untitled Note';

    try {
      setIsSubmitting(true);
      if (editingNote) {
        const updates: UpdateNoteInput = {
          title: cleanTitle,
          content: content.trim(),
          category,
          is_pinned: isPinned,
        };
        const updated = await noteService.updateNote(editingNote.id, updates);
        clearNoteDraft(userId, editingNote.id);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else {
        const input: CreateNoteInput = {
          title: cleanTitle,
          content: content.trim(),
          category,
          is_pinned: isPinned,
        };
        const created = await noteService.createNote(input);
        clearNoteDraft(userId, NEW_NOTE_DRAFT_ID);
        setNewNoteDraft(null);
        setNotes((prev) => [created, ...prev]);
      }

      closeFormModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (note: Note) => {
    const previous = notes;
    const optimisticPinned = !note.is_pinned;

    // Optimistic UI update for snappy pin transitions
    setPinningId(note.id);
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, is_pinned: optimisticPinned } : n))
    );

    try {
      const updated = await noteService.togglePin(note.id, note.is_pinned);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (err: unknown) {
      setNotes(previous);
      const msg = err instanceof Error ? err.message : 'Failed to update pin status.';
      setError(msg);
    } finally {
      setPinningId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingNote) return;
    try {
      setIsDeleting(true);
      await noteService.deleteNote(deletingNote.id);
      clearNoteDraft(userId, deletingNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== deletingNote.id));
      setDeletingNote(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete note.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute category counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: notes.length,
      pinned: notes.filter((n) => n.is_pinned).length,
    };
    for (const cat of NOTE_CATEGORIES) {
      map[cat] = notes.filter((n) => (n.category || 'General') === cat).length;
    }
    return map;
  }, [notes]);

  // Filter & sort notes
  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = notes.filter((n) => {
      if (selectedCategory === 'pinned' && !n.is_pinned) return false;
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'pinned' &&
        (n.category || 'General') !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.category || 'General').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, searchQuery, selectedCategory, sortBy]);

  const pinnedNotes = useMemo(
    () => filteredAndSorted.filter((n) => n.is_pinned),
    [filteredAndSorted]
  );
  const otherNotes = useMemo(
    () => filteredAndSorted.filter((n) => !n.is_pinned),
    [filteredAndSorted]
  );

  const filterTabs = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'pinned', label: 'Pinned' },
      ...NOTE_CATEGORIES.map((c) => ({ id: c, label: c })),
    ],
    []
  );

  const gridClass =
    viewMode === 'list'
      ? 'flex flex-col gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 pb-20 md:pb-12">
        {/* Header Workspace Bar */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Notes</h1>
              {!loading && notes.length > 0 && (
                <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full">
                  {counts.all} {counts.all === 1 ? 'note' : 'notes'}
                  {counts.pinned > 0 ? ` · ${counts.pinned} pinned` : ''}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Capture ideas, organize by category, and pin important notes to the top.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={openCreateModal}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {newNoteDraft ? 'Resume Draft' : 'New Note'}
          </motion.button>
        </div>

        {/* Global Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm"
            >
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Something went wrong</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchNotes}
                className="text-xs underline hover:no-underline font-medium"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search, Sort & Layout Controls Card */}
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search notes by title, content, or category... (press /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-gray-50/80 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort & View Mode Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex items-center">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                <select
                  aria-label="Sort notes"
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as NotesSortBy)}
                  className="pl-8 pr-3 py-2 bg-gray-50/80 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="updated">Last Updated</option>
                  <option value="created">Newest First</option>
                  <option value="title">Title (A–Z)</option>
                </select>
              </div>

              <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('grid')}
                  aria-label="Grid view"
                  title="Grid view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('list')}
                  aria-label="List view"
                  title="List view"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Animated Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {filterTabs.map((tab) => {
              const isActive = selectedCategory === tab.id;
              const count = counts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleCategoryFilterChange(tab.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                    isActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="notes-active-category-pill"
                      transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                      className="absolute inset-0 bg-blue-50 border border-blue-200/90 rounded-lg -z-0"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.id === 'pinned' && <Pin className="w-3 h-3" />}
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Local Unsaved Draft Banner Card */}
        <AnimatePresence>
          {newNoteDraft && (
            <motion.div
              key="local-draft-banner"
              initial={{ opacity: 0, y: -10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              onClick={openCreateModal}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openCreateModal();
                }
              }}
              className="bg-amber-50/75 border border-dashed border-amber-300 rounded-xl p-4 cursor-pointer hover:bg-amber-50 hover:border-amber-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Unsaved Draft (Local)
                    </span>
                    <span className="text-xs text-amber-700/90">
                      {formatDateTime(newNoteDraft.savedAt)}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold text-gray-900 text-sm truncate">
                    {newNoteDraft.title || 'Untitled Draft'}
                  </h3>
                  {newNoteDraft.content && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2 whitespace-pre-wrap">
                      {newNoteDraft.content}
                    </p>
                  )}
                  <p className="mt-2 text-xs font-medium text-blue-700">
                    Click to continue writing and save to your account →
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardNewDraftBanner}
                  className="px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 shrink-0 transition-colors"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notes Content Workspace */}
        {loading ? (
          <div className={gridClass}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200/80 p-5 h-44 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-4 w-20 bg-gray-100 rounded-full" />
                  <div className="h-4 w-3/4 bg-gray-200/80 rounded" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-100 rounded" />
                    <div className="h-3 w-5/6 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-3 w-1/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200/90 p-12 text-center shadow-2xs"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Your notes workspace is ready</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Capture thoughts, project notes, or quick checklists. Pin key notes and organize everything by category.
            </p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {newNoteDraft ? 'Resume Draft' : 'Create First Note'}
            </motion.button>
          </motion.div>
        ) : filteredAndSorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-200/90 p-10 text-center"
          >
            <FileText className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">No matching notes</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery
                ? `No notes match "${searchQuery}" in this filter.`
                : `No notes in "${selectedCategory}" yet.`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    handleCategoryFilterChange('all');
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                New Note
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-7">
            {/* Pinned Section */}
            <AnimatePresence initial={false}>
              {pinnedNotes.length > 0 && (
                <motion.section
                  key="pinned-section"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <Pin className="w-3.5 h-3.5 text-blue-600 fill-current" />
                    <span>Pinned ({pinnedNotes.length})</span>
                  </div>
                  <motion.div layout className={gridClass}>
                    <AnimatePresence mode="popLayout">
                      {pinnedNotes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          viewMode={viewMode}
                          hasDraft={Boolean(loadNoteDraft(userId, note.id))}
                          isPinning={pinningId === note.id}
                          onOpen={openEditModal}
                          onTogglePin={handleTogglePin}
                          onDelete={setDeletingNote}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Other / All Notes Section */}
            {otherNotes.length > 0 && (
              <motion.section layout className="space-y-3">
                {pinnedNotes.length > 0 && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Others ({otherNotes.length})
                  </div>
                )}
                <motion.div layout className={gridClass}>
                  <AnimatePresence mode="popLayout">
                    {otherNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        viewMode={viewMode}
                        hasDraft={Boolean(loadNoteDraft(userId, note.id))}
                        isPinning={pinningId === note.id}
                        onOpen={openEditModal}
                        onTogglePin={handleTogglePin}
                        onDelete={setDeletingNote}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.section>
            )}
          </div>
        )}

        {/* Animated Note Editor Modal */}
        <NoteEditorModal
          isOpen={isFormOpen}
          editingNote={editingNote}
          title={title}
          content={content}
          category={category}
          isPinned={isPinned}
          draftRestored={draftRestored}
          formError={formError}
          isSubmitting={isSubmitting}
          onTitleChange={handleTitleChange}
          onContentChange={handleContentChange}
          onCategoryChange={handleEditorCategoryChange}
          onPinnedChange={handleEditorPinnedChange}
          onDiscardDraft={handleDiscardCurrentDraft}
          onClose={closeFormModal}
          onSubmit={handleFormSubmit}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={Boolean(deletingNote)}
          title="Delete Note"
          message={`Are you sure you want to delete "${deletingNote?.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDangerous={true}
          isLoading={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingNote(null)}
        />
      </div>
    </MotionConfig>
  );
};
