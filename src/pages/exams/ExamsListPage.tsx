/**
 * ExamsListPage.tsx — Legacy redirect shim.
 * M3.8: All exam content now lives at /entities/recruitment.
 * This component is only kept so the router redirect works.
 */
import { Navigate } from "react-router-dom";

export function ExamsListPage() {
  return <Navigate to="/entities/recruitment" replace />;
}
