-- VNPay uses orderCode as vnp_TxnRef, which must identify exactly one order.
CREATE UNIQUE INDEX "orders_orderCode_key" ON "orders"("orderCode");
