import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageBackButton({ fallbackTo = '/' , label = 'Back' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(fallbackTo, { replace: true });
        }
      }}
      className="relative z-10 mt-2 inline-flex items-center gap-1 rounded-md py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
