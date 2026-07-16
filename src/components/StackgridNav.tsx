import { StackgridNavClient } from "@/components/StackgridNavClient";

type Props = {
  html: string;
};

export function StackgridNav({ html }: Props) {
  return (
    <>
      <link rel="stylesheet" href="/stackgrid/styles.css" />
      <link rel="stylesheet" href="/stackgrid/theme.css" />
      <div
        className="stackgrid-root stackgrid-site-nav framer-LqpOF framer-yqpees"
        data-layout-template="true"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <StackgridNavClient />
    </>
  );
}
