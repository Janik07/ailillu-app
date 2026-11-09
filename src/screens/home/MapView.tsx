import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl } from '../../api/client';
import type { Branch, Chain } from '../../domain/catalog';
import { plural } from '../../domain/format';
import { distanceKm, distanceLabel, type Point } from '../../domain/geo';
import { menuRoute, useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { Icon } from '../../ui/Icon';
import { ChainThumb } from '../../ui/parts';
import './map.css';

interface Spot {
  chain: Chain;
  branch: Branch;
  index: number;
  point: Point;
}

maplibregl.setWorkerUrl(workerUrl);

/** Pins closer than this on screen merge into one, so a dense centre stays readable. */
const MERGE_PX = 46;

const isDark = () => {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

const styleUrl = () => `https://tiles.openfreemap.org/styles/${isDark() ? 'dark' : 'positron'}`;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function mergeSpots(map: maplibregl.Map, spots: Spot[]) {
  const groups: { x: number; y: number; spots: Spot[] }[] = [];
  for (const spot of spots) {
    const p = map.project([spot.point.lon, spot.point.lat]);
    const near = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < MERGE_PX);
    if (near) near.spots.push(spot);
    else groups.push({ x: p.x, y: p.y, spots: [spot] });
  }
  return groups.map((g) => g.spots);
}

function pinElement(group: Spot[], selected: boolean, onClick: () => void) {
  const first = group[0];
  const el = document.createElement('button');
  el.className = `pin${selected ? ' on' : ''}`;
  el.setAttribute('aria-label', group.length > 1 ? `${group.length} ${plural(group.length, 'заведение', 'заведения', 'заведений')}` : first.chain.title);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  const ring = document.createElement('div');
  ring.className = 'ring';
  const photo = first.branch.photo ?? first.chain.photo;
  if (group.length > 1) {
    ring.classList.add('many');
    ring.textContent = String(group.length);
  } else if (photo) {
    const img = document.createElement('img');
    img.src = mediaUrl('restaurant', photo, 320);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => img.remove();
    ring.append(img);
  } else {
    ring.textContent = first.chain.title.slice(0, 1);
  }
  const tail = document.createElement('div');
  tail.className = 'tail';
  el.append(ring, tail);
  return el;
}

export default function MapView({ chains, city }: { chains: Chain[]; city: string }) {
  const nav = useNav();
  const me = useApp((s) => s.me);
  const locate = useApp((s) => s.locate);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [broken, setBroken] = useState(false);

  const spots = useMemo(() => {
    const out: Spot[] = [];
    chains.forEach((chain) =>
      chain.branches.forEach((branch, index) => {
        if (branch.lat != null && branch.lon != null) {
          out.push({ chain, branch, index, point: { lat: branch.lat, lon: branch.lon } });
        }
      }),
    );
    return out;
  }, [chains]);
  const missing = chains.reduce((a, c) => a + c.branches.filter((b) => b.lat == null).length, 0);

  const latest = useRef({ spots, selected });
  latest.current = { spots, selected };

  const drawPins = useRef(() => {});
  drawPins.current = () => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    const current = latest.current.selected;
    markers.current = mergeSpots(map, latest.current.spots).map((group) => {
      const isOn = !!current && group.some((s) => s.chain.id === current.chain.id && s.index === current.index);
      const el = pinElement(group, isOn, () => {
        if (group.length === 1) {
          setSelected(group[0]);
          return;
        }
        const bounds = new maplibregl.LngLatBounds();
        group.forEach((s) => bounds.extend([s.point.lon, s.point.lat]));
        if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 25) setSelected(group[0]); // one building
        else map.fitBounds(bounds, { padding: 90, maxZoom: 17, duration: 350 });
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([group[0].point.lon, group[0].point.lat])
        .addTo(map);
    });
  };

  useEffect(() => {
    if (!box.current) return;
    let map: maplibregl.Map;
    try {
      const start = latest.current.spots;
      map = new maplibregl.Map({
        container: box.current,
        style: styleUrl(),
        center: start.length
          ? [median(start.map((s) => s.point.lon)), median(start.map((s) => s.point.lat))]
          : [71.43, 51.13],
        zoom: 11.8,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        fadeDuration: 0,
        maxTileCacheSize: 80,
      });
    } catch {
      setBroken(true); // no WebGL on this device
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.on('style.load', () => {
      // OpenStreetMap often has both spellings, guests read Russian here.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field')) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
        }
      }
    });
    // The credit stays one tap away instead of covering pins on a phone screen.
    map.on('load', () => box.current?.querySelector('.maplibregl-ctrl-attrib')?.removeAttribute('open'));
    map.on('zoomend', () => drawPins.current());
    map.on('click', () => setSelected(null));
    mapRef.current = map;
    drawPins.current(); // pins need no tiles, so they appear before the streets do
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    drawPins.current();
    if (selected && !spots.some((s) => s.chain.id === selected.chain.id && s.index === selected.index)) setSelected(null);
  }, [spots, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !spots.length) return;
    map.jumpTo({ center: [median(spots.map((s) => s.point.lon)), median(spots.map((s) => s.point.lat))] });
    // Only a new city recentres the map; filters should leave it where the guest put it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    if (!meMarker.current) {
      const dot = document.createElement('span');
      dot.className = 'me-dot';
      meMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([me.lon, me.lat]).addTo(map);
    } else {
      meMarker.current.setLngLat([me.lon, me.lat]);
    }
  }, [me]);

  const findMe = async () => {
    const point = await locate();
    if (point) mapRef.current?.easeTo({ center: [point.lon, point.lat], zoom: Math.max(mapRef.current.getZoom(), 14), duration: 500 });
  };

  if (broken) {
    return (
      <div className="pad map-area">
        <div className="note">
          <Icon name="info" />
          <div>Это устройство не поддерживает карту. Переключитесь на список, там те же заведения.</div>
        </div>
      </div>
    );
  }

  const sel = selected;
  return (
    <div className="map-area">
      <div className="map-box" ref={box} />
      <button className="iconbtn map-locate" aria-label="Показать, где я" onClick={() => void findMe()}>
        <Icon name="locate" />
      </button>
      {sel ? (
        <div className="map-card">
          <div className="row">
            <ChainThumb chain={{ title: sel.chain.title, photo: sel.branch.photo ?? sel.chain.photo }} size={64} />
            <div className="grow">
              <div className="map-card-title">
                {sel.chain.title}
                {sel.chain.branches.length > 1 && ` · ${sel.branch.short}`}
              </div>
              <div className="small muted">
                {sel.chain.type} · {sel.branch.address}
              </div>
              {me && (
                <div className="small walk">
                  <Icon name="walk" size={13} weight={2} />
                  {distanceLabel(distanceKm(me, sel.point))}
                </div>
              )}
            </div>
            <button className="iconbtn" aria-label="Закрыть" onClick={() => setSelected(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="row map-actions">
            <a
              className="btn ghost"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://yandex.kz/maps/?rtext=~${sel.point.lat},${sel.point.lon}&rtt=pd`}
            >
              <Icon name="route" />
              Маршрут
            </a>
            <button className="btn" onClick={() => nav.push(menuRoute(sel.branch))}>
              Открыть
            </button>
          </div>
        </div>
      ) : (
        <div className="small map-hint">
          На карте {spots.length}.{missing > 0 && ` Ещё ${missing} без координат, они есть в списке.`}
        </div>
      )}
    </div>
  );
}
