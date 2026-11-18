import React from 'react';
import { motion } from 'framer-motion';
import type { Note } from '../../types/database.types';
import type { NotesViewMode } from '../../utils/appStateStorage';
import { formatDateTime } from '../../utils/dateUtils';
import { countWords, getCategoryStyles } from './noteCategories';
import { Pin, Edit2, Trash2, Clock } from 'lucide-react';

interface NoteCardProps {
  note: Note;
  viewMode: NotesViewMode;
  hasDraft: boolean;
  isPinning: boolean;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  viewMode,
  hasDraft,
  isPinning,
  onOpen,
  onTogglePin,
  onDelete,
}) => {
  const category = note.category || 'General';
  const styles = getCategoryStyles(category);
  const words = countWords(note.content);
  const isList = viewMode === 'list';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={() => onOpen(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(note);
        }
      }}
      className={`group relative bg-white rounded-xl border transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
        note.is_pinned
          ? 'border-blue-200/90 shadow-xs hover:shadow-md hover:border-blue-300'
          : `border-gray-200/90 shadow-2xs hover:shadow-md ${styles.accentBorder}`
      } ${isList ? 'p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3' : 'p-5 flex flex-col justify-between min-h-[190px]'}`}
    >
      {/* Top Pinned Accent Strip */}
      {note.is_pinned && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-5 right-5 h-0.5 rounded-b-full bg-blue-500/80"
        />
      )}

      <div className={isList ? 'min-w-0 flex-1' : 'flex-1'}>
        {/* Top Row: Category + Draft + Pin */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${styles.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
              {category}
            </span>
            {hasDraft && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                Unsaved draft
              </span>
            )}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            disabled={isPinning}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note);
            }}
            aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}
            title={note.is_pinned ? 'Unpin note' : 'Pin note'}
            className={`p-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
              note.is_pinned
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 hover:text-blue-600 hover:bg-gray-100'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'fill-current' : ''}`} />
          </motion.button>
        </div>

        {/* Note Title */}
        <h3 className="font-semibold text-gray-900 text-[15px] leading-snug tracking-tight line-clamp-1 group-hover:text-blue-700 transition-colors">
          {note.title || 'Untitled Note'}
        </h3>

        {/* Note Excerpt */}
        <p
          className={`mt-2 text-[13px] leading-relaxed text-gray-600 whitespace-pre-wrap ${
            isList ? 'line-clamp-2' : 'line-clamp-4'
          }`}
        >
          {note.content ? (
            note.content
          ) : (
            <span className="italic text-gray-400">Empty note — click to start writing...</span>
          )}
        </p>
      </div>

      {/* Footer Metadata & Actions */}
      <div
        className={`${
          isList
            ? 'flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0'
            : 'mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2'
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="w-3 h-3 shrink-0" />
            {formatDateTime(note.updated_at)}
          </span>
          {words > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{words} {words === 1 ? 'word' : 'words'}</span>
            </>
          )}
        </div>

        <div
          className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onOpen(note)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Note"
            aria-label="Edit Note"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(note)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Note"
            aria-label="Delete Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
};

