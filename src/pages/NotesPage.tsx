import React, { useEffect, useState } from 'react';
import { noteService } from '../services/noteService';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types/database.types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { formatDateTime } from '../utils/dateUtils';
import { Plus, FileText, Trash2, Edit2, Loader2, X, AlertCircle, Search } from 'lucide-react';

export const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
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
    fetchNotes();
  }, []);

  const openCreateModal = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    setEditingNote(null);
    setFormError(null);
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
        };
        await noteService.updateNote(editingNote.id, updates);
      } else {
        const input: CreateNoteInput = {
          title: cleanTitle,
          content: content.trim(),
        };
        await noteService.createNote(input);
      }

      closeFormModal();
      await fetchNotes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingNote) return;
    try {
      setIsDeleting(true);
      await noteService.deleteNote(deletingNote.id);
      setDeletingNote(null);
      await fetchNotes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete note.';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(query) ||
      n.content.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal Notes</h1>
          <p className="text-sm text-gray-500">Capture your ideas, memos, and personal notes.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Note
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchNotes}
            className="text-xs underline hover:no-underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search Input */}
      {notes.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Notes Grid */}
      <div>
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">No notes yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Jot down quick reminders, meeting notes, or ideas.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create First Note
            </button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            <p className="text-sm">No notes match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 text-base line-clamp-1">
                    {note.title}
                  </h3>
                  <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap line-clamp-6">
                    {note.content || <span className="italic text-gray-400">No content</span>}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>{formatDateTime(note.updated_at)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(note)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Edit Note"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingNote(note)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ideas for weekend trip"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note here..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingNote)}
        title="Delete Note"
        message={`Are you sure you want to delete note "${deletingNote?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingNote(null)}
      />
    </div>
  );
};
