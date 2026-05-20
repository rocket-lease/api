# Rocket Lease — Domain Context

Master glossary for Rocket Lease. Spanish terms are canonical for user-facing copy and conversation. Code identifiers use English equivalents (`Reservation`, `Vehicle`) — but the domain meaning stays anchored to the Spanish term defined here.

This file is the source of truth. Each repo's `CONTEXT.md` may add repo-specific terms; cross-repo terms must match this file (drift-check enforces).

## Product vision (one-liner)

Marketplace mobile-first de alquiler de vehículos que conecta **rentadoras** con **conductores**, integrando gestión de flota, pagos, reputación, y firma de contrato digital.

## Core glossary

| Spanish term (canonical) | Code identifier | Definition |
|--------------------------|-----------------|------------|
| **Rentador** / **Rentadora** | `Rentador` (role) | Persona o empresa propietaria de vehículos, los publica para alquiler. Una persona puede ser tanto rentador como conductor (multi-rol, decisión #23). "Rentadora" se usa también para referirse al negocio de la persona; en código, sólo el rol existe. |
| **Conductor** | `Conductor` (role) | Cliente que busca, reserva y maneja un vehículo. Por defecto todo usuario es conductor (`isConductor = true`). |
| **Vehículo** | `Vehicle` | Auto publicado por un rentador. Tiene fotos, características (transmisión, accesibilidad, etiquetas), set de reglas de reserva, precio. |
| **Transmisión** | `Transmission` | `automatic` \| `manual`. Filtro crítico para Conductor con movilidad reducida (persona Martín). |
| **Accesibilidad** | `accessibility` (tags array) | Etiquetas: adaptaciones para movilidad reducida, asientos especiales, etc. Filtro de búsqueda. |
| **Reserva** | `Reservation` | Compromiso de alquiler de un vehículo por un conductor en un rango de fechas. Estado modelado (ver state machine). Concurrencia controlada via Postgres EXCLUDE constraint (decisión #22). |
| **Set de reglas de reserva** | `ReservationRuleSet` | Plantilla reutilizable de condiciones (mínimo de horas, política de cancelación, depósito requerido, edad mínima del conductor, etc.) que el rentador asocia a uno o varios vehículos. |
| **Voucher digital** / **Voucher con QR** | `Voucher` | Comprobante de reserva confirmada. Contiene QR escaneado al retirar/devolver. |
| **Retiro** (con código QR) | `pickup` | Acción del conductor de tomar posesión del vehículo. Inicia el alquiler. Marca reserva como `in_progress`. |
| **Devolución** (con código QR) | `return` | Acción del conductor de entregar el vehículo. Cierra el alquiler. Marca reserva como `completed`. |
| **Verificación de identidad** | `IdentityVerification` | Validación del DNI (rentador y conductor) y de la licencia de conducir (sólo conductor). Para extranjeros, validación equivalente. Stub v1 (decisión #21). |
| **Niveles** | `Level` | Sistema de fidelización. Conductor sube de nivel por cantidad/calidad de alquileres. Cada nivel da beneficios (descuentos, prioridad, etc.). |
| **Reputación** | `Reputation` (score) | Score numérico que afecta precios, disputas, prioridad de promociones, posicionamiento en búsqueda. Calculado a partir de reviews + comportamiento. |
| **Review** | `Review` | Calificación + comentario que un usuario deja sobre otro luego de una reserva completada. Conductores reseñan rentadores y vehículos; rentadores reseñan conductores. |
| **Firma de contrato digital** | `Contract` | Aceptación explícita por el conductor de las condiciones específicas del alquiler (cláusulas del set de reglas + responsabilidad en caso de choque). Persistido como evento auditable. |
| **Tarifas escalonadas por duración** | `tieredPricing` | Precio que escala por días/horas (ej: 1 día = $X, 7 días = $X × 6.5, 30 días = $X × 25). Definido por rentador o por sistema. |
| **Edición masiva de precios** | `bulkPriceUpdate` | Operación del rentador que aplica cambios de precio a múltiples vehículos a la vez (por categoría, temporada, etc.). |
| **Promocionar** / **Destacar** vehículo | `promote` | Acción del rentador para que un vehículo aparezca en posición destacada en búsqueda. Posiblemente con costo. |
| **Cancelación con reembolso/penalización** | `cancellation` | Cancelación de reserva. Política depende del set de reglas del vehículo + tiempo restante hasta el retiro. |
| **Disputa** / **Ticket de disputa** | `Dispute` | Conflicto entre conductor y rentador (daños, devolución tardía, cargos extras). Pasa por un flujo de resolución con soporte. |
| **Reporte de mal cliente** | `BadActorReport` | Rentador reporta un conductor con conducta problemática. Puede afectar reputación del conductor. |
| **Dashboard rentadora** | `RentadoraDashboard` | Vista para rentador: ocupación, ingresos, rentabilidad, cancelaciones, tendencias. |
| **Mapa interactivo** | `Map` | Vista geográfica de rentadoras cercanas, sus vehículos y precios. |
| **Re-reserva** | `rebook` | Acción del conductor de reservar nuevamente un vehículo (o de un rentador) usado previamente. Acceso desde historial. |

## Personas (resumen)

- **Julián (34)** — Conductor frecuente, viaja por negocios. Quiere rapidez, perfil precargado, re-reserva, niveles con beneficios.
- **Lucas (45)** — Rentador mediano (20 vehículos, zona turística). Quiere dashboard con métricas, control de stock, promociones segmentadas.
- **Martín (29)** — Conductor con movilidad reducida (sólo automático). Quiere filtros por transmisión y accesibilidad, etiquetas claras.
- **Sofía (22)** — Conductora primeriza, desconfiada. Quiere transparencia total: contrato claro, desglose de costos, soporte directo.
- **Carmen (52)** — Rentadora grande estacional (350 vehículos, costa). Quiere edición masiva de precios, etiquetas destacadas.
- **Tomás (20)** — Conductor joven sin tarjeta de crédito. Quiere múltiples medios de pago (débito, transferencia, billetera virtual), confirmación inmediata, voucher QR.

Detalle completo: ver hoja `Personas` del archivo `Artefactos_RocketLease.xlsx`.

## Hace / No hace (scope)

**Hace**: registro y verificación, gestión de vehículos (CRUD + masivo), búsqueda con filtros (incluye transmisión + accesibilidad), reserva con concurrencia, pagos múltiples métodos (stub), firma de contrato digital, reviews + reputación + niveles, soporte (FAQ/chat/disputas/reportes), notificaciones push, mapa interactivo, dashboard rentadora, historial, voucher QR, tarifas escalonadas, transferir responsabilidad al rentador en caso de choque.

**No hace**: compraventa de vehículos, aseguradora, contabilidad/facturación completa, red social, transporte (Uber/Cabify), mantenimiento mecánico, pólizas propias, cobros fuera de plataforma, verificación física en tiempo real, conductor con chofer, gestión de multas.

## Reservation state machine

```
pending_payment ──(payment ok)──▶ confirmed ──(QR pickup)──▶ in_progress ──(QR return)──▶ completed
       │                                │                          │
       └─(TTL 10 min)─▶ expired         ├─(user cancels)─▶ cancelled_with_refund
                                        └─(rentador cancels)─▶ rejected
                       confirmed/in_progress ─(no return)─▶ no_show
```

State transitions are gated in the `reservations` service. Each transition emits a domain event (auditable).

## Cross-cutting rules

- All user-facing strings in **Spanish (rioplatense)**. No i18n v1 (decisión #27).
- All money in **integer cents**, currency code stored, displayed via `Intl.NumberFormat('es-AR', { currency: 'ARS' })` (decisión #32).
- All timestamps **UTC** in DB and JSON. Display in `America/Argentina/Buenos_Aires` (decisión #31).
- Reservations use `tstzrange` for date-range columns (required for EXCLUDE constraint, decisión #22).
- External providers (payment, identity verification) are **stubbed v1** behind interfaces (decisión #21). Real adapters drop in later.

## Where to look next

- Full backlog: `Artefactos_RocketLease.xlsx` → `Backlog-US` sheet (~80 user stories with Gherkin acceptance criteria).
- Sprint allocation: same file → `Cronograma` sheet.
- Architectural decisions: `api/docs/adr/`.
- Cross-repo conventions (errors, money, dates, commits): `api/docs/CONVENTIONS.md`.
