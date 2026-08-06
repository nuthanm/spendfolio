-- AlterTable
ALTER TABLE "User" ADD COLUMN     "enabledModules" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "MetalHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metalType" TEXT NOT NULL,
    "goalGrams" DOUBLE PRECISION,
    "goalDate" TEXT,
    "currentRate" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetalHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetalTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metalType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "ratePerGram" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "realizedPL" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main residence',
    "address" TEXT NOT NULL DEFAULT '',
    "purchaseDate" TEXT,
    "purchasePrice" DOUBLE PRECISION,
    "loanDetails" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetalHolding_userId_idx" ON "MetalHolding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MetalHolding_userId_metalType_key" ON "MetalHolding"("userId", "metalType");

-- CreateIndex
CREATE INDEX "MetalTransaction_userId_metalType_idx" ON "MetalTransaction"("userId", "metalType");

-- CreateIndex
CREATE INDEX "MetalTransaction_userId_date_idx" ON "MetalTransaction"("userId", "date");

-- CreateIndex
CREATE INDEX "HouseProfile_userId_idx" ON "HouseProfile"("userId");

-- CreateIndex
CREATE INDEX "HouseExpense_userId_houseId_idx" ON "HouseExpense"("userId", "houseId");

-- CreateIndex
CREATE INDEX "HouseExpense_userId_date_idx" ON "HouseExpense"("userId", "date");

-- AddForeignKey
ALTER TABLE "MetalHolding" ADD CONSTRAINT "MetalHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetalTransaction" ADD CONSTRAINT "MetalTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseProfile" ADD CONSTRAINT "HouseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseExpense" ADD CONSTRAINT "HouseExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseExpense" ADD CONSTRAINT "HouseExpense_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "HouseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
