const FILES: Record<string, { label: string; file: string }> = {
  X: { label: "X", file: "x" },
  Instagram: { label: "Instagram", file: "instagram" },
  LinkedIn: { label: "LinkedIn", file: "linkedin" },
  YouTube: { label: "YouTube", file: "youtube" },
  Discord: { label: "Discord", file: "discord" },
};

export default function SocialIcons({
  links,
}: {
  links: { href?: string; label: string }[];
}) {
  const items = links.filter((s) => s.href && FILES[s.label]);
  if (!items.length) return null;

  return (
    <ul className="mt-6 flex flex-wrap items-center gap-1" data-social="icons">
      {items.map((s) => {
        const icon = FILES[s.label];
        const src = `/brand/social/${icon.file}.svg`;
        return (
          <li key={s.label}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={icon.label}
              className="grid h-10 w-10 place-items-center rounded-full text-sand/55 transition-colors hover:bg-white/10 hover:text-sand"
            >
              <span
                aria-hidden="true"
                className="block h-[18px] w-[18px] bg-current"
                style={{
                  maskImage: `url(${src})`,
                  WebkitMaskImage: `url(${src})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
