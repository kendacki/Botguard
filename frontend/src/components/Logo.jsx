export default function Logo({ className = "h-8 w-8" }) {
  return (
    <img src="/logo.svg" alt="BOTGUARD" className={className} width={32} height={32} />
  );
}
