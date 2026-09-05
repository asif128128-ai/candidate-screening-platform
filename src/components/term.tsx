// Shared <Term> component for mixed-direction text (ARCHITECTURE.md §9):
// wraps LTR technical tokens (numbers, URLs, emails, phone numbers) in <bdi>
// so they render correctly inside RTL Hebrew sentences.
// Owned in practice by whichever engineer builds the first page that needs
// it (candidate-flow); kept here since it's shared UI infrastructure.
export function Term({ children }: { children: React.ReactNode }) {
  return (
    <bdi className="ltr-inline">
      {children}
    </bdi>
  );
}
