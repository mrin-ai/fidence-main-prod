import { StackgridNav } from "@/components/StackgridNav";
import { getStackgridNavHtml } from "@/lib/stackgrid-nav";

type Props = {
  children: React.ReactNode;
  flush?: boolean;
};

export function SiteChrome({ children, flush = false }: Props) {
  const navHtml = getStackgridNavHtml();

  return (
    <>
      <StackgridNav html={navHtml} />
      <div className={flush ? "site-with-nav-flush" : "blog-with-site-nav"}>
        {children}
      </div>
    </>
  );
}
