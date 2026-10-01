import Image from "next/image";

/**
 * Brand logo.
 *
 * The source PNG is fully opaque — brand-blue artwork on a near-white
 * #F5FAFE plate — not a transparent mark. So it can't sit directly on the
 * header in dark mode, where it would read as a pale square. The white
 * plate below is part of the treatment: it frames the mark deliberately in
 * both themes instead of leaving a floating box.
 */
export function Logo({
  className = "",
  /** Height in px. Width follows the image's 492:469 aspect ratio. */
  height = 40,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * (492 / 469));

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ${className}`}
      style={{ width, height }}
    >
      <Image
        src="/kllogo.png"
        alt="KnightLead Solutions"
        width={width}
        height={height}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );
}