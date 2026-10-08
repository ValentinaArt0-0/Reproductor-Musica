import { useState, type FormEvent } from "react";
import { Modal, modalPrimaryButton, modalSecondaryButton } from "./Modal";

interface CreatePlaylistModalProps {
  /** Resolves to null on success, or a message to show in the dialog. */
  onSubmit: (name: string) => Promise<string | null>;
  onClose: () => void;
}

export function CreatePlaylistModal({ onSubmit, onClose }: CreatePlaylistModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe un nombre para la lista.");
      return;
    }
    setPending(true);
    const message = await onSubmit(trimmed);
    setPending(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Modal
      title="Nueva lista de reproducción"
      description="Ponle un nombre. Podrás agregar canciones después."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="new-playlist-name" className="text-sm font-semibold text-ink-700">
          Nombre de la lista
        </label>
        <input
          id="new-playlist-name"
          data-autofocus
          type="text"
          value={name}
          maxLength={80}
          autoComplete="off"
          placeholder="Ej. Para estudiar"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-playlist-error" : undefined}
          className="mt-2 w-full rounded-2xl border border-sand-300 bg-sand-100 px-4 py-3 text-[15px] text-ink-800 placeholder:text-ink-500 focus-visible:border-sage-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500"
        />
        {error && (
          <p id="new-playlist-error" role="alert" className="mt-2 text-sm font-medium text-clay-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={modalSecondaryButton}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={modalPrimaryButton}>
            {pending ? "Creando…" : "Crear lista"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
