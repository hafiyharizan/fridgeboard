import { Suspense } from "react";
import { PinEntry } from "@/components/PinEntry";

export default function HomePage() {
  return (
    <Suspense>
      <PinEntry />
    </Suspense>
  );
}
