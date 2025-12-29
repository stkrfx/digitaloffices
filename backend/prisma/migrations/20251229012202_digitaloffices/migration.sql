/*
  Warnings:

  - You are about to drop the `TestUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('VIDEO_CALL', 'IN_PERSON_VISIT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdminLevel" AS ENUM ('SUPER_ADMIN', 'MODERATOR');

-- DropTable
DROP TABLE "TestUser";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "lastLogin" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertProfile" (
    "id" TEXT NOT NULL,
    "headshotUrl" TEXT,
    "headline" TEXT NOT NULL,
    "bio" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "organizationId" TEXT,
    "specialties" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "companyName" TEXT NOT NULL,
    "companyRegNumber" TEXT,
    "websiteUrl" TEXT,
    "address" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "level" "AdminLevel" NOT NULL DEFAULT 'MODERATOR',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(10,2) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "type" "ServiceType" NOT NULL,
    "expertId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "cancellationReason" TEXT,
    "priceSnapshot" DECIMAL(10,2) NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "meetingLink" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ExpertProfile_userId_key" ON "ExpertProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfile_userId_key" ON "OrganizationProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Availability_expertId_idx" ON "Availability"("expertId");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertProfile" ADD CONSTRAINT "ExpertProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "OrganizationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertProfile" ADD CONSTRAINT "ExpertProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfile" ADD CONSTRAINT "OrganizationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "ExpertProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
