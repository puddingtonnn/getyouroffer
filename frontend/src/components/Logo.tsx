// «G-курс» monogram (variant 1a restyled): ink tile, Oswald G with an
// electric arrow tucked into the corner.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="relative inline-block flex-none rounded-lg bg-ink"
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      <span
        className="absolute font-display font-extrabold text-paper"
        style={{ left: size * 0.17, top: size * 0.08, fontSize: size * 0.52, lineHeight: 1 }}
      >
        G
      </span>
      <span
        className="absolute font-display font-black text-gold"
        style={{ right: size * 0.09, bottom: size * 0.02, fontSize: size * 0.38, lineHeight: 1 }}
      >
        →
      </span>
    </span>
  )
}

export function LogoWord({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <b className="font-sans text-[15px] font-bold tracking-tight">GetYourOffer</b>
    </span>
  )
}
