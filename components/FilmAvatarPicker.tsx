'use client';

import { useEffect, useRef, useState } from 'react';
import { filmAvatars, type FilmAvatar } from './filmAvatars';

export function FilmAvatarArt({ avatar }: { avatar: FilmAvatar }) {
  return <span aria-hidden="true" className="flex size-full items-center justify-center bg-gradient-to-br from-[#315e7c] to-[#11263c]">{avatar.symbol}</span>;
}

interface Props {
  current: string;
  savedPhoto: string;
  initial: string;
  onPreview: (value: string | null) => void;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}

export default function FilmAvatarPicker({ current, savedPhoto, initial, onPreview, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState(current);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const search = query.trim().toLocaleLowerCase('nl');
  const visible = search ? filmAvatars.filter(({ name, film }) =>
    `${name} ${film}`.toLocaleLowerCase('nl').includes(search)) : showAll ? filmAvatars : filmAvatars.slice(0, 12);
  const selected = filmAvatars.find(({ id }) => id === choice);
  const preview = choice === '' ? savedPhoto : '';

  const choose = (value: string) => {
    setChoice(value);
    onPreview(value);
    setError('');
  };

  const close = () => {
    onPreview(null);
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(choice);
      close();
    } catch {
      setError('De profielfoto kon niet worden opgeslagen. Probeer het opnieuw.');
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="film-avatar-title" onCancel={(event) => {
      event.preventDefault();
      if (!saving) close();
    }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[46rem] overflow-y-auto rounded-2xl border border-sky-200/25 bg-[#193952] p-5 text-sky-50 shadow-2xl backdrop:bg-[#061522]/75 sm:p-7">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#28536f] text-2xl font-black">
          {selected ? <FilmAvatarArt avatar={selected} /> : preview ? <img src={preview} alt="" className="size-full object-cover" /> : initial}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="film-avatar-title" className="text-xl font-black">Kies je profielfoto</h2>
          <p className="text-sm text-sky-100/80">{selected?.name ?? (preview ? 'Eigen foto' : 'Mijn initiaal')}</p>
        </div>
        <button type="button" aria-label="Sluiten" disabled={saving} onClick={close} className="min-h-10 min-w-10 rounded-full hover:bg-sky-100/10">×</button>
      </div>
      <label className="mt-5 block text-sm font-bold">
        Zoek op personage of film
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-2 w-full rounded-xl border border-sky-200/25 bg-[#10283e] px-3 py-2.5 font-normal" />
      </label>
      <div className="my-3 flex flex-wrap gap-2">
        <button type="button" aria-pressed={choice === 'initial'} disabled={saving} onClick={() => choose('initial')} className="rounded-full border border-sky-200/25 px-3 py-2 text-sm aria-pressed:bg-sky-800">Mijn initiaal</button>
        {savedPhoto && <button type="button" aria-pressed={choice === ''} disabled={saving} onClick={() => choose('')} className="rounded-full border border-sky-200/25 px-3 py-2 text-sm aria-pressed:bg-sky-800">Mijn eigen foto</button>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {visible.map((avatar: FilmAvatar) => (
          <button key={avatar.id} type="button" disabled={saving} aria-pressed={choice === avatar.id} onClick={() => choose(avatar.id)} title={avatar.film} className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-transparent px-1 py-2 text-center text-xs font-bold hover:bg-sky-100/10 aria-pressed:border-sky-300 aria-pressed:bg-sky-800">
            <span className="size-12 overflow-hidden rounded-full text-2xl sm:size-16 sm:text-3xl"><FilmAvatarArt avatar={avatar} /></span>
            {avatar.name}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="py-4 text-sm">Geen personages gevonden.</p>}
      {!search && !showAll && filmAvatars.length > 12 && <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-sm font-bold text-sky-200 hover:underline">Bekijk alle {filmAvatars.length} personages</button>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-sky-200/20 pt-4">
        <button type="button" disabled={saving} onClick={close} className="rounded-full px-4 py-2 text-sm hover:bg-sky-100/10">Annuleren</button>
        <button type="button" disabled={saving || choice === current} onClick={save} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold disabled:opacity-50">{saving ? 'Opslaan…' : 'Opslaan'}</button>
      </div>
    </dialog>
  );
}
