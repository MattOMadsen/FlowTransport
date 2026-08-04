/** Simple fleet classes */

export const VEHICLE_CLASSES = {
  car: {
    id: 'car',
    label: 'Personbil',
    kind: 'car',
    speed: 95,
    capacity: 4,
    buyPrice: 220,
    sprite: 'car'
  },
  truck: {
    id: 'truck',
    label: 'Lastbil',
    kind: 'truck',
    speed: 72,
    capacity: 8,
    buyPrice: 380,
    sprite: 'truck'
  }
};

export function vehicleCanDoJob(classId, job) {
  const cls = VEHICLE_CLASSES[classId] || VEHICLE_CLASSES.car;
  if (job.type === 'cargo') return cls.kind === 'truck';
  return cls.kind === 'car';
}

export function buyPrice(classId) {
  return VEHICLE_CLASSES[classId]?.buyPrice ?? 220;
}
