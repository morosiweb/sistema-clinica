"use client";
export function AvisoBorrador({
  disponible,
  obsoleto,
  estado,
  restaurar,
  descartar,
}: {
  disponible: boolean;
  obsoleto?: boolean;
  estado: string;
  restaurar: () => void;
  descartar: () => Promise<void>;
}) {
  return (
    <>
      {disponible && (
        <div className="notice space-y-2">
          <p>
            Tenés un borrador privado guardado.
            {obsoleto
              ? " La ficha cambió desde entonces: revisá su contenido antes de guardar."
              : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-link" onClick={restaurar}>
              Restaurar borrador
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                void descartar().catch(() => {});
              }}
            >
              Descartar borrador
            </button>
          </div>
        </div>
      )}
      {estado && (
        <p role="status" className="text-sm text-neutral-500">
          {estado}
        </p>
      )}
    </>
  );
}
