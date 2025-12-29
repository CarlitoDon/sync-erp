/*
  Warnings:

  - You are about to drop the `GoodsReceipt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GoodsReceiptItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Shipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShipmentItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_companyId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceiptItem" DROP CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceiptItem" DROP CONSTRAINT "GoodsReceiptItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceiptItem" DROP CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_salesOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentItem" DROP CONSTRAINT "ShipmentItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentItem" DROP CONSTRAINT "ShipmentItem_salesOrderItemId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentItem" DROP CONSTRAINT "ShipmentItem_shipmentId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "dpAmount" DECIMAL(15,2),
ADD COLUMN     "dpPercent" DECIMAL(5,2);

-- DropTable
DROP TABLE "GoodsReceipt";

-- DropTable
DROP TABLE "GoodsReceiptItem";

-- DropTable
DROP TABLE "Shipment";

-- DropTable
DROP TABLE "ShipmentItem";
