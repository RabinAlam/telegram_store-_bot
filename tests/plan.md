# EM Store test plan
1. Happy path (Stars dev invoice): home -> p-gemini-18m qty 6 -> quote $0.70/pc total $4.20 -> Stars intent -> webhooks/stars successful_payment -> success DELIVERED + code copy.
2. Underpay crypto: POST webhooks/crypto amount-0.01 -> NEEDS_REVIEW, no fulfill.
3. Duplicate webhook: same txHash twice -> second deduped:true, single credit.
4. Out of stock: p-netflix-1m -> Buy hidden, Notify me -> notify-me ok; admin import 5 codes -> stock 5.
5. Cancel mid-payment: pay screen Cancel -> CANCELLED + 'Deposit cancelled' + Return to Menu; success page shows cancelled.
6. Stars refund: admin Orders -> Refund -> REFUNDING.
7. Deep links: ?startapp=product_p-gemini-18m -> /p/..., restock_ -> /feed, order_ -> /success/....
8. Expiry: intent older than 30m -> status EXPIRED on poll.
