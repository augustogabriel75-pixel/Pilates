-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "cpf" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "emergencyContact" TEXT,
    "profession" TEXT,
    "medicalHistory" TEXT,
    "medications" TEXT,
    "goals" TEXT,
    "plan" TEXT,
    "monthlyFee" REAL NOT NULL DEFAULT 0,
    "dueDay" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "weekdays" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 50,
    "capacity" INTEGER NOT NULL DEFAULT 3,
    "instructor" TEXT,
    "startDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classGroupId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classGroupId" TEXT,
    "title" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "isMakeup" BOOLEAN NOT NULL DEFAULT false,
    "makeupAvailable" BOOLEAN NOT NULL DEFAULT false,
    "rescheduledFromId" TEXT,
    "confirmedAt" DATETIME,
    "checkedInAt" DATETIME,
    "validatedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvolutionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT,
    "date" DATETIME NOT NULL,
    "evolutionNotes" TEXT NOT NULL,
    "painLevel" INTEGER,
    "painLocation" TEXT,
    "posturalAssessment" TEXT,
    "observations" TEXT,
    "patientGuidance" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvolutionRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvolutionRecord_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" TEXT,
    "homeGuidance" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prescriptionId" TEXT NOT NULL,
    "apparatus" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" TEXT,
    "load" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "apparatus" TEXT NOT NULL,
    "description" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_classGroupId_patientId_key" ON "Enrollment"("classGroupId", "patientId");

-- CreateIndex
CREATE INDEX "Session_startsAt_idx" ON "Session"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_classGroupId_startsAt_key" ON "Session"("classGroupId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_rescheduledFromId_key" ON "Booking"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Booking_sessionId_status_idx" ON "Booking"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Booking_patientId_status_idx" ON "Booking"("patientId", "status");

-- CreateIndex
CREATE INDEX "Payment_year_month_idx" ON "Payment"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_patientId_year_month_key" ON "Payment"("patientId", "year", "month");

-- CreateIndex
CREATE INDEX "EvolutionRecord_patientId_date_idx" ON "EvolutionRecord"("patientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_apparatus_key" ON "Exercise"("name", "apparatus");
