import { useParams } from 'react-router-dom';
import PlanViewer from '../components/plan/PlanViewer';

export default function PlanViewerPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-text-secondary">No plan ID provided.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PlanViewer planId={id} />
    </div>
  );
}
