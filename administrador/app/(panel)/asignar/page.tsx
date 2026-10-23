import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/server/auth/admin';
import { assignmentOptions } from '@/server/assignments/service';
import { AssignmentPlanner } from '@/components/assignment-planner';

export const metadata: Metadata = { title: 'Asignar viaje | Control vehicular' };

export default async function AsignarPage() {
  if (!await getAdmin()) redirect('/');
  const options = await assignmentOptions();
  return <div className="accounts-page assign-page">
    <header><h1 className="panel-title">Asignar viaje</h1>
      <p className="layer-note">Elige camión y piloto, marca origen y destino en el mapa y la fecha de salida. El piloto lo verá en Notificaciones de la app.</p></header>
    <AssignmentPlanner trucks={options.trucks} drivers={options.drivers} />
  </div>;
}
