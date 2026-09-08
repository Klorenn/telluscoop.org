t# Tierly Racer — diseño de Fase 1

Estado: aprobado para planificación e implementación  
Fecha: 2026-08-29

## Decisión y alcance

Tierly incorporará una carrera arcade 2D nativa, renderizada con `<canvas>`,
para una persona contra bots deterministas. Una corrida verificable comprende
tres vueltas, checkpoints ordenados, cronómetro y clasificación final. Terminar,
ganar y mejorar una marca personal pueden sumar puntos sólo después de una
validación del lado servidor.

La Fase 1 no incluye multiplayer online, matchmaking, salas, chat, ghosts,
leaderboards de tiempos públicos, compras, wallets ni física en tiempo real
entre navegadores. Supabase Realtime Broadcast queda para Fase 2; no es
necesario para una carrera correcta contra bots.

## Encaje con Tierly

Tierly es una SPA estática y expone sesión, perfil de jugador y cliente de
Supabase mediante `window.TierlyBridge`. Carreras será un módulo hermano de
Ajedrez: usa el bridge para identidad, traducciones y llamadas autenticadas,
pero jamás concede puntos desde el navegador.

```text
Canvas del navegador -> replay acotado -> Edge Function Racer
  -> corrida validada -> gaming_matches + gaming_match_participants
  -> match confirmed -> pipeline existente de gaming_scores
```

La Edge Function es la única autoridad que crea una corrida acreditable,
calcula su resultado y confirma el `gaming_match`. No se entrega al cliente
una ruta para insertar puntos, placements o tiempos. Esto conserva el límite
de confianza de Ajedrez: el navegador interactúa, el servidor decide el
resultado y el crédito entra por `gaming_matches -> confirmed`.

## Experiencia de juego

La pantalla permite iniciar y abandonar una corrida, conducir con flechas/WASD
y controles táctiles equivalentes, y ver vuelta actual de tres, siguiente
checkpoint, tiempo, posición y resultado accesible. Los bots visibles salen
del mismo seed que emite el servidor y no son jugadores de Tierly ni reciben
puntos. Al final, el resultado es provisional hasta que la función devuelva
“validado y acreditado”, “validado sin puntos” o un error recuperable.

La pista, vehículos, idioma y estética final son decisiones de implementación.
Deben ser originales y coherentes con Tierly: este diseño no indica copiar UI
ni assets de una referencia externa.

## Simulación y replay deterministas

La versión de simulación debe fijar las reglas, pista, constantes físicas y
codificación de input. `track_id`, `simulation_version` y un seed generado
por servidor determinan estado inicial, comportamiento bot y variaciones
permitidas. El cliente registra entradas discretas por tick fijo (acelerar,
frenar, girar o transiciones), nunca snapshots de posición, velocidad,
vueltas, tiempo, puntuación ni placement.

El ticket comunica los límites máximos de ticks, duración, payload y cambios de
input. El servidor los exige también. La función re-simula desde el estado
inicial usando ticket, seed y replay para obtener checkpoints, vueltas, tiempo,
clasificación y elegibilidad de premio. `requestAnimationFrame` sólo renderiza:
los FPS del dispositivo no son un reloj de autoridad.

## Contratos conceptuales

Los nombres son conceptuales. La migración y API exactas deben seguir los
patrones de RLS y `security definer` ya presentes en Tierly.

### Emisión de ticket

Una llamada autenticada, por ejemplo `POST /functions/v1/racer` con acción
`start`, resuelve el `gaming_player` de la sesión, fija versión y pista,
genera un seed criptográfico y persiste un ticket de un uso. Responde:

```text
run_id, opaque_ticket, track_id, simulation_version, seed/public config,
expires_at, input_limits
```

Una tabla conceptual `gaming_racer_runs` contiene id, player_id, ticket hash
(no el token en claro), pista, versión, seed, estado
`issued|submitted|validated|rejected|expired`, timestamps, resultado derivado
y `match_id` único cuando se acredita. Hay que limitar tickets activos por
jugador y expirar los que nunca se envían. El ticket no sirve para otro jugador,
pista, versión ni intento.

### Envío, validación y crédito

`submit` recibe sólo `run_id`, ticket opaco y replay dentro de los límites. La
función:

1. autentica propiedad y bloquea la corrida;
2. rechaza ticket vencido, reutilizado, malformado o ya procesado;
3. carga una versión admitida y re-simula seed + replay;
4. rechaza si faltan tres vueltas o checkpoints ordenados, o se exceden los
   límites de integridad;
5. persiste el resultado derivado y crea idempotentemente un `gaming_match` y
   su único participante humano;
6. asigna puntos derivados, confirma el match por el pipeline existente y
   devuelve el resultado acreditado.

Los campos `score`, `points`, `elapsed_time`, `finish_position`, `lap_count`,
`checkpoint_state` y coordenadas de cliente no son de autoridad y no deben
aceptarse. Si el servicio falla después de validar, repetir el submit debe
devolver el mismo resultado, nunca crear una recompensa adicional.

### Puntos y marca personal

Antes del lanzamiento se configura del lado servidor una política numérica por
temporada/pista. Debe separar finalización verificada, victoria verificada ante
bots y una mejora verificada de la mejor marca del jugador para pista + versión
de simulación. La marca se actualiza dentro de la misma transacción idempotente
que acredita el match. Corridas abandonadas, rechazadas, expiradas, replayadas
o incompletas no cambian puntos ni marca. La recomendación para un empate de
marca es no otorgar bonus; debe decidirse antes de implementación.

## Validación y abuso

El objetivo es rechazar resultados imposibles, no ocultar reglas en JavaScript.

| Caso | Respuesta de la función |
| --- | --- |
| Puntaje o tiempo inventado | Ignorarlo: no integra el contrato de autoridad. |
| Replay que intenta teletransportar | La re-simulación no completa las reglas; rechazar. |
| Ticket robado | Asociarlo a `player_id` y exigir JWT de su sesión. |
| Reenvío exitoso | Ticket de un uso, estado atómico y `match_id` único; devolver resultado previo. |
| Payload/ticks excesivos o spam | Límite de tamaño/ticks y rate limit antes de simular. |
| Pista o versión manipulada | Allowlist; el ticket es la única autorización. |
| Récord concurrente | Bloqueo/transacción sobre jugador+pista+versión. |
| Abandono o desconexión | No hay crédito: el ticket vence sin efectos. |

Un replay válido prueba reglas, no que la persona no automatizó teclas. Registrar
cadencias anómalas, rechazos y resultados inverosímiles para revisión. La Fase
1 no aplica baneos automáticos; debe existir una vía administrativa revisable
para revertir crédito antes de producción.

## Observabilidad y privacidad

La función registra `run_id`, id interno/pseudónimo de jugador, versión, pista,
resultado, causa de rechazo, duración de simulación y si hubo puntos/marca. No
registrará el ticket, JWT ni replay completo. Métricas mínimas: tickets emitidos
y expirados, submits aceptados/rechazados por causa, latencia de validación,
créditos idempotentes, finalizaciones, puntos y récords. Alertar ante alzas de
rechazos, payloads máximos, tiempo de validación o puntos por jugador.

El historial queda limitado al propio jugador; las tablas base no se abren a
anon. Realtime Broadcast en Fase 2 puede transportar estado de presencia o
partida, pero nunca convierte al cliente en autoridad de físicas o puntos.

## Estrategia de pruebas

- Simulación pura: igual seed + versión + replay produce el mismo estado final
  en navegador y servidor; cubre límites, checkpoints, tres vueltas,
  off-track y clasificación bot.
- Edge Function: autenticación, propiedad, expiración, input malformado,
  resultado imposible, doble submit, fallo intermedio y carrera concurrente
  por marca personal.
- Integración: sólo una corrida validada crea un match, participante y
  actualización de puntaje; una rechazada no toca el pipeline.
- Cliente: teclado, táctil, abandono y estados provisional/error/acreditado;
  no hay método cliente que adjudique puntos.
- Regresión: conservar `node --test` para rutas, bridge, contrato y límite de
  confianza; pruebas deterministas para lógica compartible sin navegador.
- Manual: teclado y viewport táctil a tasas de refresco distintas; la
  clasificación validada no puede cambiar por FPS.

## Fuera de alcance / Fase 2

Fase 2 podrá reutilizar formato de replay y simulación para desafíos online,
matchmaking y presencia. Carreras simultáneas requieren definir autoridad de
partida, reconexión, lag, abandonos, colisiones humanas y anti-cheat adicional.
También quedan fuera de Fase 1 dos humanos en un dispositivo, replays/ghosts
compartidos, más pistas, monetización y activos o marcas de terceros sin
licencia.

## Referencia Moto Racer y atribución

La jugabilidad se inspira conceptualmente en [Moto Racer](https://github.com/jgzuo/moto-racer), un juego Canvas/JavaScript con teclado, tres vueltas y
checkpoints. Su README declara MIT, pero el repositorio mostrado enumera sólo
`index.html`, `ABOUT.html` y `README.md`. Antes de copiar código, assets o
texto, hay que fijar un commit y confirmar una licencia MIT aplicable en ese
origen. Sin licencia verificable, se implementa desde cero usando sólo ideas
no protegibles y no se copia material del repositorio.

Si se reutiliza código bajo MIT, se conserva el aviso de copyright y permiso
con la distribución (por ejemplo `NOTICE` o atribuciones de despliegue), se
identifica el commit upstream y se enumeran archivos adaptados. No se debe
presentar a Moto Racer como aval de Tierly. Texto de referencia:
[MIT License](https://opensource.org/license/mit).

## Supuestos pendientes

- Se puede resolver de forma segura el `gaming_player` autenticado desde una
  Edge Function sin exponer service role ni permisos de escritura al browser.
- Navegador y Edge Function pueden compartir una simulación realmente
  determinista. Si no, habrá aritmética fixed-point o un runtime canónico
  único antes de acreditar.
- La política numérica de puntos y límite de tickets activos se aprueban antes
  de publicar; este documento fija autoridad e idempotencia, no números
  inventados.

