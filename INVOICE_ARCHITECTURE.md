Damaged goods are shown in both places, for different reasons, and I made one rule too strict. The status confusion has a clear fix: not everything you listed is a status of the same kind. They split into four separate things.

The four layers

1. Physical state: exactly one at a time for any given unit of stock.

Available: can be sold.
Quarantine: counted in, not yet cleared.
In transit: later, when transfers exist.

A variant isn’t in one state. It holds quantities in several, such as 50 available and 10 in quarantine. Each unit sits in exactly one state.

2. Stage inside quarantine: exactly one per pile. This is the “hold” status we already have.

Awaiting check.
Damaged.
Accepted, which moves it to available.
Returned or written off, which removes it.

So damaged is not a separate physical state. It’s a stage inside quarantine. A damaged pile is still physically in quarantine. To your question: it can’t be both “quarantine” and “damaged” as two competing statuses, but it can be quarantine, at the stage damaged.

3. Reserved: an overlay, not a status. It’s a promise on a quantity, with a reason: sales order, purchase return, or transfer. Reserved stock is still in its physical state, and it just can’t be used for anything else. So a damaged pile can be reserved for a return at the same moment. That is how “in a return” works, because a return is a document with its own status (draft, approved, dispatched), not a stock status.

4. Flags worked out from other data: never stored as statuses.

Unbilled is a financial matter on the receipt line, not stock. A pile can be in quarantine and unbilled at once.
Expired and expiring soon are worked out from the batch’s expiry date.

So the answer to “how many statuses?”: one physical state, plus one stage if it’s in quarantine, plus any reservations with reasons, plus flags that are calculated. Nothing you listed conflicts.

Damaged is not “return”

You’re right, and I’d mistaken this. Damaged only describes the goods. Goods can be damaged:

at the door, from the supplier;
later, from our own handling;
through expiry.

What happens next is a separate decision:

Supplier-caused, linked to a receipt: purchases may return it for credit.
Our own handling, expired, or old stock: it’s written off. There’s no supplier to return it to.
Immediately rejected on arrival: purchases can return it straight from quarantine without anyone marking it damaged. The new return page already lets them pick any quarantine pile, so this works today.