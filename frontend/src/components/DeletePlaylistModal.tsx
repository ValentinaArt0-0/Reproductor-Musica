import { useState } from "react";
import type { PlaylistSummary } from "../types";
import { Modal, modalDangerButton, modalSecondaryButton } from "./Modal";

interface DeletePlaylistModalProps {
  playlist: PlaylistSummary;
  /** Resolves to null on success, or a message to show in the dialog. */
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}

export function DeletePlaylistModal({ playlist, onConfirm, onClose }: DeletePlaylistModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    const message = await onConfirm();
    setPending(false);
    if (message) setError(message);
    else onClose();
  };

  const songs =
    playlist.songCount === 0
      ? ""
      : playlist.songCount === 1
        ? "Se quitará 1 canción de la lista. "
        : `Se quitarán ${playlist.songCount} canciones de la lista. `;

  return (
    <Modal
      title={`¿Eliminar “${playlist.name}”?`}
      description={`${songs}Esta acción no se puede deshacer.`}
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-clay-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" data-autofocus onClick={onClose} className={modalSecondaryButton}>
          Cancelar
        </button>
        <button type="button" disabled={pending} onClick={handleConfirm} className={modalDangerButton}>
          {pending ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}
