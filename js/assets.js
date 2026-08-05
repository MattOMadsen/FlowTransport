/** Image loading for places, vehicles, tiles */

const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const img = new Image();
  img.src = src;
  const p = new Promise((resolve) => {
    if (img.complete && img.naturalWidth) resolve(img);
    else {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    }
  });
  cache.set(src, p);
  return p;
}

const PLACE_SRC = {
  capital: 'assets/places/capital.png',
  town: 'assets/places/town.png',
  town2: 'assets/places/town2.png',
  town3: 'assets/places/town3.png',
  farm: 'assets/places/farm.png',
  factory: 'assets/places/factory.png',
  harbor: 'assets/places/harbor.png'
};

const VEHICLE_SRC = {
  car: 'assets/vehicles/car.png',
  car_fast: 'assets/vehicles/car_fast.png',
  truck: 'assets/vehicles/truck.png',
  truck_heavy: 'assets/vehicles/truck_heavy.png',
  bus: 'assets/vehicles/bus.png',
  van: 'assets/vehicles/van.png'
};

let placeImgs = {};
let vehicleImgs = {};
let tileImgs = {};

export async function loadGameAssets() {
  const placeKeys = Object.keys(PLACE_SRC);
  const vehKeys = Object.keys(VEHICLE_SRC);
  const tiles = ['grass', 'grass2', 'water', 'forest', 'asphalt'];

  await Promise.all([
    ...placeKeys.map(async (k) => {
      placeImgs[k] = await loadImage(PLACE_SRC[k]);
    }),
    ...vehKeys.map(async (k) => {
      vehicleImgs[k] = await loadImage(VEHICLE_SRC[k]);
    }),
    ...tiles.map(async (k) => {
      tileImgs[k] = await loadImage(`assets/tiles/${k}.png`);
    })
  ]);
  return { placeImgs, vehicleImgs, tileImgs };
}

export function getPlaceImage(type, variant = 0) {
  if (type === 'town') {
    const keys = ['town', 'town2', 'town3'];
    return placeImgs[keys[variant % 3]] || placeImgs.town;
  }
  return placeImgs[type] || placeImgs.town;
}

export function getVehicleImage(classId) {
  if (classId && vehicleImgs[classId]) return vehicleImgs[classId];
  if (classId === 'bus') return vehicleImgs.bus || vehicleImgs.car;
  if (classId === 'van') return vehicleImgs.van || vehicleImgs.truck;
  if (classId === 'truck' || classId === 'truck_heavy') {
    return vehicleImgs.truck || vehicleImgs.van || vehicleImgs.car;
  }
  return vehicleImgs.car;
}

export function getTileImage(name) {
  return tileImgs[name] || null;
}
