/** Empty Milk Road-sized block until Pau sends the plain LATAM map. No kids. No drawings. */
export default function SlotPlaceholder({
  slot,
  className = "",
}: {
  slot: "mapa";
  className?: string;
}) {
  return <div data-slot={slot} aria-hidden="true" className={className} />;
}
