// CogniPilot — seed inicial
// Empresa, usuarios con roles, dispositivo del repartidor, rutas/paradas/paquetes
// realistas en zona Mendoza, reglas activas.
//
// Correr: npm run prisma:seed

import { PrismaClient, Rol, TipoRegla, AccionRegla, TipoEvento } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding CogniPilot...");

  // ── Empresa
  const empresa = await prisma.empresa.upsert({
    where: { cuit: "30-71234567-8" },
    update: {},
    create: {
      nombre: "Logística Cuyo SA",
      cuit: "30-71234567-8",
      contacto: {
        email: "contacto@logisticacuyo.com.ar",
        telefono: "+54 261 555 0100",
        direccion: "San Martín 1234, Mendoza",
      },
    },
  });

  // ── Usuarios
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const admin = await prisma.usuario.upsert({
    where: { email: "facu@cognipilot.local" },
    update: {},
    create: {
      email: "facu@cognipilot.local",
      passwordHash: hash("admin123"),
      nombre: "Facundo Lucero",
      rol: Rol.admin_sistema,
    },
  });

  const supervisor = await prisma.usuario.upsert({
    where: { email: "supervisor@logisticacuyo.com.ar" },
    update: {},
    create: {
      empresaId: empresa.id,
      email: "supervisor@logisticacuyo.com.ar",
      passwordHash: hash("super123"),
      nombre: "Ana Bermúdez",
      rol: Rol.supervisor,
    },
  });

  const gerente = await prisma.usuario.upsert({
    where: { email: "gerente@logisticacuyo.com.ar" },
    update: {},
    create: {
      empresaId: empresa.id,
      email: "gerente@logisticacuyo.com.ar",
      passwordHash: hash("gerente123"),
      nombre: "Roberto Páez",
      rol: Rol.gerente,
    },
  });

  const repartidor = await prisma.usuario.upsert({
    where: { email: "fm.lucero@alumno.um.edu.ar" },
    update: {},
    create: {
      empresaId: empresa.id,
      email: "fm.lucero@alumno.um.edu.ar",
      passwordHash: hash("repartidor123"),
      nombre: "Facu (repartidor)",
      rol: Rol.repartidor,
    },
  });

  // ── Dispositivo del repartidor (1 personal)
  await prisma.dispositivo.upsert({
    where: { deviceUuid: "dev-seed-facu-personal" },
    update: { activo: true },
    create: {
      usuarioId: repartidor.id,
      deviceUuid: "dev-seed-facu-personal",
      modelo: "Pixel/Sample",
      osVersion: "Android 14",
      appVersion: "0.1.0-seed",
    },
  });

  // ── Rutas (1 hoy, 1 ayer) en zona Mendoza
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  const rutaHoy = await prisma.ruta.create({
    data: {
      empresaId: empresa.id,
      nombre: "Ciudad — Godoy Cruz",
      fecha: hoy,
      paradas: {
        create: [
          {
            orden: 1,
            lat: -32.8895,
            lng: -68.8458,
            direccion: "Av. San Martín 850, Mendoza",
            ventanaDesde: "09:00",
            ventanaHasta: "12:00",
            paquetes: {
              create: [
                { codigoMl: "ML-2025-0001", descripcion: "Caja chica electrónica" },
                { codigoMl: "ML-2025-0002", descripcion: "Sobre documentos" },
              ],
            },
          },
          {
            orden: 2,
            lat: -32.9077,
            lng: -68.8538,
            direccion: "Belgrano 1290, Mendoza",
            ventanaDesde: "10:00",
            ventanaHasta: "13:00",
            paquetes: {
              create: [
                { codigoMl: "ML-2025-0003", descripcion: "Caja media indumentaria" },
              ],
            },
          },
          {
            orden: 3,
            lat: -32.9293,
            lng: -68.8421,
            direccion: "Hipólito Yrigoyen 220, Godoy Cruz",
            ventanaDesde: "11:00",
            ventanaHasta: "14:00",
            paquetes: {
              create: [
                { codigoMl: "ML-2025-0004", descripcion: "Caja grande electrodoméstico" },
                { codigoMl: "ML-2025-0005", descripcion: "Sobre tarjetas" },
                { codigoMl: "ML-2025-0006", descripcion: "Caja libros" },
              ],
            },
          },
        ],
      },
    },
  });

  const rutaAyer = await prisma.ruta.create({
    data: {
      empresaId: empresa.id,
      nombre: "Las Heras — Centro",
      fecha: ayer,
      paradas: {
        create: [
          {
            orden: 1,
            lat: -32.8492,
            lng: -68.8253,
            direccion: "San Miguel 540, Las Heras",
            ventanaDesde: "09:00",
            ventanaHasta: "12:00",
            paquetes: {
              create: [
                { codigoMl: "ML-2025-0010", descripcion: "Caja media" },
              ],
            },
          },
          {
            orden: 2,
            lat: -32.8853,
            lng: -68.8378,
            direccion: "Patricias Mendocinas 1456, Mendoza",
            ventanaDesde: "10:00",
            ventanaHasta: "13:00",
            paquetes: {
              create: [
                { codigoMl: "ML-2025-0011", descripcion: "Sobre documentos" },
                { codigoMl: "ML-2025-0012", descripcion: "Caja chica" },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Asignaciones
  await prisma.asignacion.upsert({
    where: { repartidorId_fecha: { repartidorId: repartidor.id, fecha: hoy } },
    update: { rutaId: rutaHoy.id },
    create: { repartidorId: repartidor.id, rutaId: rutaHoy.id, fecha: hoy },
  });
  await prisma.asignacion.upsert({
    where: { repartidorId_fecha: { repartidorId: repartidor.id, fecha: ayer } },
    update: { rutaId: rutaAyer.id },
    create: { repartidorId: repartidor.id, rutaId: rutaAyer.id, fecha: ayer },
  });

  // ── Reglas activas
  await prisma.regla.createMany({
    data: [
      {
        empresaId: empresa.id,
        nombre: "Ventana horaria estándar 08:00–18:00 ART",
        tipo: TipoRegla.ventana_horaria,
        accion: AccionRegla.bloquear,
        condicion: {
          desde: "08:00",
          hasta: "18:00",
          tz: "America/Argentina/Buenos_Aires",
        },
      },
      {
        empresaId: empresa.id,
        nombre: "Paquete fuera de parada (Poka-Yoke)",
        tipo: TipoRegla.paquete_fuera_parada,
        accion: AccionRegla.bloquear,
        condicion: {},
      },
      {
        empresaId: empresa.id,
        nombre: "Bloquear redes sociales en horario laboral",
        tipo: TipoRegla.app_bloqueada_en_horario,
        accion: AccionRegla.bloquear,
        condicion: {
          packages: [
            "com.instagram.android",
            "com.facebook.katana",
            "com.zhiliaoapp.musically", // TikTok
            "com.twitter.android",
            "com.whatsapp", // ojo: WhatsApp puede ser laboral, queda como ejemplo
          ],
          desde: "08:00",
          hasta: "18:00",
          tz: "America/Argentina/Buenos_Aires",
        },
      },
    ],
  });

  console.log(`✅ Seed completo:`);
  console.log(`   Empresa: ${empresa.nombre} (${empresa.id})`);
  console.log(`   Admin:        facu@cognipilot.local             / admin123`);
  console.log(`   Supervisor:   supervisor@logisticacuyo.com.ar   / super123`);
  console.log(`   Gerente:      gerente@logisticacuyo.com.ar      / gerente123`);
  console.log(`   Repartidor:   fm.lucero@alumno.um.edu.ar        / repartidor123`);
  console.log(`   Dispositivo seed UUID: dev-seed-facu-personal`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
