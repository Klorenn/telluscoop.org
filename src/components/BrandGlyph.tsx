export default function BrandGlyph({
  file,
  size = 18,
}: {
  file: string;
  size?: number;
}) {
  const src = `/brand/social/${file}.svg`;
  return (
    <span
      aria-hidden="true"
      className="block bg-current"
      style={{
        width: size,
        height: size,
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
  );
}
