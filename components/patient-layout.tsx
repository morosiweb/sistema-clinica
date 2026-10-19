import { PublicHeader, PublicFooter } from "@/components/brand";
import { Volver } from "@/components/volver";

export function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site patient-site">
      <PublicHeader />
      <div className="patient-content">
        <Volver destino="/" />
        {children}
      </div>
      <PublicFooter />
    </div>
  );
}
