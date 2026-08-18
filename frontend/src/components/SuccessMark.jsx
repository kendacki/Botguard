import { LottieSvg } from "lottie-react";
import successAnimation from "../assets/success.json";

export default function SuccessMark({ className = "h-[132px] w-[132px]" }) {
  return (
    <LottieSvg
      src={successAnimation}
      autoplay
      loop={false}
      className={className}
      aria-label="Verified"
    />
  );
}
