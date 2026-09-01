// Maps every status string used across Sales documents to one of three
// semantic tones, so "Paid", "Fulfilled", "Completed" etc. all read the
// same visual language without a hardcoded switch on every page.
const OK = ["Accepted", "Fulfilled", "Completed", "Paid", "Closed", "Approved", "Applied"];
const WARN = ["Sent", "Draft", "Confirmed", "Pending", "Partially Fulfilled", "Partially Paid", "Requested", "Unpaid"];
const BAD = ["Rejected", "Expired", "Cancelled", "Overdue"];

export default function StatusBadge({ status }) {
  const tone = OK.includes(status)
    ? "bg-ok-dim text-ok"
    : BAD.includes(status)
    ? "bg-bad-dim text-bad"
    : WARN.includes(status)
    ? "bg-warn-dim text-warn"
    : "bg-line text-inkmute";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}
