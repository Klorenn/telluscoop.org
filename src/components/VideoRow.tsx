import Link from "next/link";
import VideoPlayer from "./VideoPlayer";
import SectionHeading from "./SectionHeading";
import type { SessionVideo } from "@/lib/content";

export default function VideoRow({
  videos,
  channelHref,
}: {
  videos: SessionVideo[];
  channelHref?: string;
}) {
  if (!videos.length) return null;
  return (
    <section id="sesiones" className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
      <SectionHeading kicker="Videos" title="Sesiones en español" href={channelHref} cta="Ver canal" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <article key={v.id}>
            <VideoPlayer id={v.id} title={v.title} />
            <h3 className="mt-3 font-display text-[18px] font-bold leading-[1.25] tracking-[-0.02em]">
              <Link prefetch={false} href={`/p/${v.slug}`} className="hover:text-teal-dark">
                {v.title}
              </Link>
            </h3>
          </article>
        ))}
      </div>
    </section>
  );
}
