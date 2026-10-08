/** Three animated bars shown next to the song that is playing. */
export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="eq flex h-4 items-end gap-[3px]" data-playing={playing} aria-hidden="true">
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </span>
  );
}
