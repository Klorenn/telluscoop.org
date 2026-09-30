-- Vista pública de eventos comunitarios para la página de descubrimiento.
--
-- Reemplaza a `gaming_events_catalog_public_view`, retirada con la capa de brackets.
-- A diferencia de aquella, NO publica nombres de inscritos: solo el conteo agregado.
-- La vieja vista exponía `registered_players` (display_name por jugador) a `anon`, lo
-- que convertía la inscripción de un evento comunitario en una lista pública de
-- asistentes. Aquí eso no se repite.
--
-- Tampoco se expone `guild_id`: el aislamiento por comunidad se mantiene en el servidor
-- y el navegador solo necesita nombre, icono y zona horaria de la comunidad.
--
-- Solo se publican eventos `scheduled` y `live`. Los `cancelled` y `completed` quedan
-- fuera de la lista pública.

create or replace view public.tierly_community_events_public_view as
select e.id         as event_id,
       e.name       as event_name,
       e.event_date,
       e.starts_at,
       e.ends_at,
       e.timezone,
       e.location,
       e.luma_url,
       e.banner_url,
       e.description,
       e.status,
       c.name       as community_name,
       c.icon_url   as community_icon_url,
       (select count(*)
          from public.tierly_event_attendance a
         where a.event_id = e.id
           and a.unregistered_at is null) as registration_count
from public.gaming_events e
join public.communities c on c.guild_id = e.guild_id
where e.guild_id is not null
  and e.status in ('scheduled', 'live');

grant select on public.tierly_community_events_public_view to anon, authenticated;