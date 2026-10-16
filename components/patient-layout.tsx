import { PublicHeader, PublicFooter } from "@/components/brand";

export function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site patient-site">
      <PublicHeader />
      <div className="patient-content">{children}</div>
      <PublicFooter />
    </div>
  );
}
