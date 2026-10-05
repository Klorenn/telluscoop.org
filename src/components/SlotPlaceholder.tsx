/** Empty Milk Road-sized block until Pau sends the Figma export. No drawings. */
export default function SlotPlaceholder({
  slot,
  className = "",
}: {
  slot: "mapa" | "ninos";
  className?: string;
}) {
  return <div data-slot={slot} aria-hidden="true" className={className} />;
}
