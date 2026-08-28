import { AppLoadingMark } from "@/components/AppLoadingMark";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <AppLoadingMark fill="host" />
    </div>
  );
}
