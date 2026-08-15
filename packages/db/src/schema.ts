import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  time,
  timestamp,
  index,
  unique,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "receptionist", "assistant", "doctor"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "solicitada",
  "confirmada",
  "en_espera",
  "en_atencion",
  "atendida",
  "no_show",
  "cancelada",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "yape",
  "plin",
  "efectivo",
  "tarjeta_pos",
  "tarjeta_online",
  "otro",
]);

export const planCodeEnum = pgEnum("plan_code", ["free", "pro", "premium"]);

export const planStatusEnum = pgEnum("plan_status", [
  "activo",
  "por_renovar",
  "suspendido",
  "cancelado",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/Lima"),
  bookingMode: text("booking_mode").notNull().default("solicitud"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("receptionist"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("memberships_team_user_key").on(t.teamId, t.userId),
    index("memberships_user_id_idx").on(t.userId),
    index("memberships_team_id_idx").on(t.teamId),
  ],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("receptionist"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    duracionMin: integer("duracion_min").notNull(),
    precio: numeric("precio", { precision: 10, scale: 2 }).notNull(),
    bufferMin: integer("buffer_min").notNull().default(0),
    codigoProcedimiento: text("codigo_procedimiento"),
    activo: boolean("activo").notNull().default(true),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("services_tenant_idx").on(t.tenantId)],
);

export const staffSchedules = pgTable(
  "staff_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
  },
  (t) => [index("staff_schedules_membership_idx").on(t.membershipId)],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    celular: text("celular").notNull(),
    email: text("email"),
    documento: text("documento"),
    fnac: date("fnac"),
    alergias: text("alergias"),
    gestacion: boolean("gestacion").notNull().default(false),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("patients_tenant_celular_key").on(t.tenantId, t.celular),
    index("patients_tenant_idx").on(t.tenantId),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: uuid("doctor_id"),
    preferredDoctorId: uuid("preferred_doctor_id"),
    fecha: date("fecha").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
    estado: appointmentStatusEnum("estado").notNull().default("solicitada"),
    modoSolicitud: boolean("modo_solicitud").notNull().default(true),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull().default("0"),
    montoPagado: numeric("monto_pagado", { precision: 10, scale: 2 }).notNull().default("0"),
    notas: text("notas"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_tenant_fecha_idx").on(t.tenantId, t.fecha),
    index("appointments_estado_idx").on(t.estado),
    index("appointments_doctor_fecha_idx").on(t.doctorId, t.fecha),
  ],
);

export const blockedSlots = pgTable(
  "blocked_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id"),
    fecha: date("fecha").notNull(),
    horaIni: time("hora_ini").notNull(),
    horaFin: time("hora_fin").notNull(),
    motivo: text("motivo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocked_slots_tenant_fecha_idx").on(t.tenantId, t.fecha)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    patientId: uuid("patient_id").references(() => patients.id),
    monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
    metodo: paymentMethodEnum("metodo").notNull(),
    referencia: text("referencia"),
    registradoPor: uuid("registrado_por"),
    cajaCerrada: boolean("caja_cerrada").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

export const subscriptions = pgTable("subscriptions", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  plan: planCodeEnum("plan").notNull().default("free"),
  estado: planStatusEnum("estado").notNull().default("activo"),
  vence: date("vence"),
  monto: numeric("monto", { precision: 10, scale: 2 }),
  metodoPago: text("metodo_pago"),
  nota: text("nota"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    accion: text("accion").notNull(),
    entidad: text("entidad"),
    entidadId: uuid("entidad_id"),
    ip: text("ip"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt)],
);
