"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
export function Volver({ destino = "/panel" }: { destino?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-outline back-button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(destino);
      }}
    >
      <ArrowLeft size={18} />
      Volver atrás
    </button>
  );
}
