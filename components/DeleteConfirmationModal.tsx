import React from 'react';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title: string;
  message: React.ReactNode;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 p-6 rounded-xl border border-red-500/50 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-red-500/20 p-4 rounded-full">
            <AlertTriangle size={48} className="text-red-500" />
          </div>
          <h3 className="text-xl font-black text-white uppercase">{title}</h3>
          <div className="text-slate-300 text-sm">{message}</div>
          <p className="text-red-400 font-bold text-xs uppercase bg-red-900/20 px-3 py-1 rounded">
            Esta ação não pode ser desfeita.
          </p>

          <div className="flex gap-3 w-full pt-4 border-t border-slate-700">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              {isDeleting ? 'Apagando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
