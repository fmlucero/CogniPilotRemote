-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin_sistema', 'supervisor', 'gerente', 'repartidor');

-- CreateEnum
CREATE TYPE "AccionRegla" AS ENUM ('bloquear', 'alertar');

-- CreateEnum
CREATE TYPE "TipoRegla" AS ENUM ('paquete_fuera_parada', 'ventana_horaria', 'app_bloqueada_en_horario');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('app_opened', 'warning_shown', 'scan_detected', 'user_continued', 'user_cancelled', 'global_app_opened', 'global_clicked');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "contacto" JSONB,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "deviceUuid" TEXT NOT NULL,
    "fcmToken" TEXT,
    "modelo" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLat" DECIMAL(9,6),
    "lastLng" DECIMAL(9,6),
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha" DATE NOT NULL,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parada" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "direccion" TEXT,
    "ventanaDesde" TEXT,
    "ventanaHasta" TEXT,

    CONSTRAINT "Parada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "id" TEXT NOT NULL,
    "paradaId" TEXT NOT NULL,
    "codigoMl" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "repartidorId" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regla" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "rutaId" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoRegla" NOT NULL,
    "accion" "AccionRegla" NOT NULL,
    "condicion" JSONB NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaHistorial" (
    "id" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campo" TEXT NOT NULL,
    "valorOld" JSONB,
    "valorNew" JSONB,

    CONSTRAINT "ReglaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoApp" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "dispositivoId" TEXT,
    "inSchedule" BOOLEAN,
    "screenName" TEXT,
    "appPackage" TEXT,
    "keywords" TEXT[],
    "screenText" TEXT[],

    CONSTRAINT "EventoApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incidente" (
    "id" TEXT NOT NULL,
    "repartidorId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "reglaId" TEXT,
    "paqueteId" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "datos" JSONB,

    CONSTRAINT "Incidente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posicion" (
    "id" TEXT NOT NULL,
    "repartidorId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "Posicion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nombre_key" ON "Empresa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cuit_key" ON "Empresa"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_deviceUuid_key" ON "Dispositivo"("deviceUuid");

-- CreateIndex
CREATE INDEX "Dispositivo_usuarioId_idx" ON "Dispositivo"("usuarioId");

-- CreateIndex
CREATE INDEX "Ruta_empresaId_fecha_idx" ON "Ruta"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "Paquete_codigoMl_idx" ON "Paquete"("codigoMl");

-- CreateIndex
CREATE UNIQUE INDEX "Asignacion_repartidorId_fecha_key" ON "Asignacion"("repartidorId", "fecha");

-- CreateIndex
CREATE INDEX "Regla_empresaId_activa_idx" ON "Regla"("empresaId", "activa");

-- CreateIndex
CREATE INDEX "ReglaHistorial_reglaId_ts_idx" ON "ReglaHistorial"("reglaId", "ts");

-- CreateIndex
CREATE INDEX "EventoApp_ts_idx" ON "EventoApp"("ts");

-- CreateIndex
CREATE INDEX "EventoApp_dispositivoId_ts_idx" ON "EventoApp"("dispositivoId", "ts");

-- CreateIndex
CREATE INDEX "Incidente_repartidorId_ts_idx" ON "Incidente"("repartidorId", "ts");

-- CreateIndex
CREATE INDEX "Posicion_repartidorId_ts_idx" ON "Posicion"("repartidorId", "ts");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parada" ADD CONSTRAINT "Parada_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_paradaId_fkey" FOREIGN KEY ("paradaId") REFERENCES "Parada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regla" ADD CONSTRAINT "Regla_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regla" ADD CONSTRAINT "Regla_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaHistorial" ADD CONSTRAINT "ReglaHistorial_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "Regla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaHistorial" ADD CONSTRAINT "ReglaHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoApp" ADD CONSTRAINT "EventoApp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoApp" ADD CONSTRAINT "EventoApp_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posicion" ADD CONSTRAINT "Posicion_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posicion" ADD CONSTRAINT "Posicion_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
