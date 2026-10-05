import SubscribeCard from "./SubscribeCard";

export default function InlineSubscribeCta() {
  return (
    <div className="my-10 md:my-12">
      <SubscribeCard
        placement="inline"
        compact
        title="¿Sigues leyendo? Lleva esto a tu correo"
        body="Guías, Stellar y Web3 en español, una vez a la semana. Gratis."
      />
    </div>
  );
}
