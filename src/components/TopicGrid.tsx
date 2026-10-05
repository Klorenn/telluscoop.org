import Link from "next/link";
import Character, { type CharacterName } from "./Character";
import { TOPIC_CARDS } from "@/lib/site";

export default function TopicGrid() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">Explora por temas</p>
      <h2 className="mt-1 font-display text-[32px] font-bold tracking-[-0.025em] md:text-[40px]">Temas claros para profundizar</h2>
      <p className="mt-2 max-w-[36rem] font-sans text-[17px] leading-[1.5] text-ink-2">Sin perder tiempo. Cuatro puertas al archivo, en español.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {TOPIC_CARDS.map((card) => (
          <Link
            key={card.slug}
            href={`/t/${card.slug}`}
            className="group flex flex-col overflow-hidden rounded-[20px] bg-sand-soft ring-1 ring-line transition-colors hover:ring-ink"
          >
            <div className="flex flex-1 flex-col px-5 pt-5">
              <h3 className="font-display text-[22px] font-bold tracking-[-0.02em] group-hover:text-teal-dark">{card.title}</h3>
              <p className="mt-2 font-sans text-[14px] leading-[1.45] text-ink-2">{card.body}</p>
            </div>
            <div className="relative mt-3 h-[168px] w-full">
              <Character
                name={card.mascot as CharacterName}
                alt=""
                className="absolute inset-x-0 bottom-0 mx-auto h-[168px] w-auto max-w-[92%] object-contain object-bottom"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
