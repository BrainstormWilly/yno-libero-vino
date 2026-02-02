
type LogoVariant = "dark" | "light";

type LogoProps = {
  variant?: LogoVariant;
};

export const YnoLiberoVinoLogo = ({ variant = "dark" }: LogoProps) => {
  const src =
    variant === "dark"
      ? "/media/yno-lv-logo-dark.png"
      : "/media/yno-lv-logo-light.png";

  return (
    <a href="/">
      <img src={src} alt="Yno LiberoVino" className="max-w-70 md:max-w-100" />
    </a>
  );
};