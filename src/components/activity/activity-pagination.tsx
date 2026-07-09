import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function buildActivityPageHref(page: number) {
  return page <= 1 ? "/activity" : `/activity?page=${page}`;
}

function getVisiblePages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
}

export function ActivityPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <Pagination className="justify-between sm:justify-center">
      <PaginationContent className="flex-wrap gap-1">
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={buildActivityPageHref(page - 1)} />
          ) : (
            <PaginationPrevious
              href={buildActivityPageHref(1)}
              className="pointer-events-none opacity-40"
              aria-disabled
              tabIndex={-1}
            />
          )}
        </PaginationItem>

        {visiblePages.map((pageNumber, index) => {
          const previous = visiblePages[index - 1];
          const showEllipsis = previous != null && pageNumber - previous > 1;

          return (
            <span key={pageNumber} className="contents">
              {showEllipsis ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              <PaginationItem>
                <PaginationLink
                  href={buildActivityPageHref(pageNumber)}
                  isActive={pageNumber === page}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            </span>
          );
        })}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationNext href={buildActivityPageHref(page + 1)} />
          ) : (
            <PaginationNext
              href={buildActivityPageHref(totalPages)}
              className="pointer-events-none opacity-40"
              aria-disabled
              tabIndex={-1}
            />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function ActivityPageSummary({
  page,
  limit,
  total,
  totalPages,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}) {
  if (total === 0) {
    return <p className="text-xs text-muted-foreground">No events yet</p>;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <p className="text-xs text-muted-foreground">
      Showing {start}–{end} of {total} · Page {page} of {totalPages}
    </p>
  );
}
