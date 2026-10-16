import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";

export function PageHeading({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
  back?: { href: string; label: string };
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          {back && (
            <Link href={back.href} className="text-link mb-3">
              <ArrowLeft size={14} />
              {back.label}
            </Link>
          )}
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action && (
          <Link href={action.href} className="btn btn-primary btn-small">
            <Plus size={16} />
            {action.label}
          </Link>
        )}
      </div>
    </>
  );
}
