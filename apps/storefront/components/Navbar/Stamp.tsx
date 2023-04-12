import Image from "next/legacy/image";

interface StampProps {
  width?: number;
  height?: number;
  className?: string;
}

function Stamp({ width = 32, height = 33, ...rest }: StampProps) {
  return (
    <div className="mt-px group block h-[65px] w-[150px] relative">
      <Image src="/kuuza-logo.png" alt="Kuuza Online Shopping" layout="fill" className="p2" />
    </div>
  );
}

export default Stamp;
