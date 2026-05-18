interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav className="flex items-center justify-center gap-4 py-4" aria-label="Pagination">
      <button
        className="px-4 py-2 rounded text-sm font-medium transition-colors bg-midnightBlue text-lightSilver hover:bg-electricBlue hover:text-pureWhite disabled:bg-midnightBlue disabled:text-softFog disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        aria-label="Go to previous page"
      >
        Previous
      </button>

      <span className="text-sm text-lightSilver">
        Page {currentPage} of {totalPages}
      </span>

      <button
        className="px-4 py-2 rounded text-sm font-medium transition-colors bg-midnightBlue text-lightSilver hover:bg-electricBlue hover:text-pureWhite disabled:bg-midnightBlue disabled:text-softFog disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage}
        aria-label="Go to next page"
      >
        Next
      </button>
    </nav>
  );
}
