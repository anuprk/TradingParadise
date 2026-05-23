import { useParams } from 'react-router-dom';
import PlanEditor from '../components/plan/PlanEditor';

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-4 py-3">
      <PlanEditor planId={id} />
    </div>
  );
}
